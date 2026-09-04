from fastapi import APIRouter, Request, HTTPException, Query, Response, status, BackgroundTasks
from app.core.config import settings
from app.core.security import verify_whatsapp_signature
from app.db.supabase import db_service
from app.services.gemini import gemini_engine
from app.services.whatsapp import whatsapp_service
import logging

router = APIRouter()
logger = logging.getLogger(__name__)

DEFAULT_SOCIETY_ID = "a1b2c3d4-e5f6-7890-abcd-111111111111"

# In-memory deduplication cache for Meta webhooks
PROCESSED_MESSAGE_IDS = set()
MAX_PROCESSED_CACHE = 1000

@router.get("/webhook")
async def verify_webhook(
    mode: str = Query(None, alias="hub.mode"),
    token: str = Query(None, alias="hub.verify_token"),
    challenge: str = Query(None, alias="hub.challenge"),
):
    """
    Meta Cloud API Webhook Handshake Verification.
    Validates hub.verify_token against WHATSAPP_VERIFY_TOKEN.
    """
    if mode and token:
        if mode == "subscribe" and token == settings.WHATSAPP_VERIFY_TOKEN:
            logger.info("Meta WhatsApp Webhook successfully verified.")
            return Response(content=challenge, media_type="text/plain")
        else:
            raise HTTPException(status_code=403, detail="Verification token mismatch")
    raise HTTPException(status_code=400, detail="Missing verification parameters")


async def process_inbound_message(
    msg_id: str,
    sender_phone: str,
    msg_type: str,
    message_text: str,
    media_id: str | None
):
    """
    Background worker that executes database lookups, Gemini AI inference,
    and outbound WhatsApp dispatch asynchronously without holding up Meta's webhook ACK.
    """
    try:
        clean_phone = sender_phone.replace("+", "").replace(" ", "").replace("-", "")
        formatted_phone = "+" + clean_phone

        # 1. Resident Lookup in Supabase DB
        resident = None
        if db_service.client:
            res = db_service.client.table("residents").select("*").execute()
            for r in (res.data or []):
                r_phone = r.get("phone_number", "").replace("+", "").replace(" ", "").replace("-", "")
                if r_phone == clean_phone:
                    resident = r
                    break

        # Auto-register guest resident if testing from new phone
        if not resident:
            print(f"--> RESIDENT NOT FOUND FOR {formatted_phone}, AUTO-REGISTERING TEST RESIDENT...")
            new_resident = {
                "society_id": DEFAULT_SOCIETY_ID,
                "building": "Block A",
                "unit_number": "101",
                "name": f"Resident ({formatted_phone[-4:]})",
                "phone_number": formatted_phone,
                "is_owner": True,
                "is_blocked": False
            }
            if db_service.client:
                insert_res = db_service.client.table("residents").upsert(new_resident, on_conflict="phone_number").execute()
                if insert_res.data:
                    resident = insert_res.data[0]
            if not resident:
                resident = new_resident

        print(f"--> RESIDENT MATCHED: {resident.get('name')} (Unit {resident.get('unit_number')})")

        # 2. Check Manual Account Block (is_blocked)
        if resident.get("is_blocked"):
            block_reply = (
                "⚠️ *ACCOUNT ACCESS SUSPENDED*\n"
                f"Hello {resident.get('name')}, your WhatsApp bot access is currently suspended due to overdue maintenance dues.\n\n"
                "🏦 *Payment Account Details:*\n"
                "Meezan Bank - A/C 01020304050607 (Lakeview Maint Account)\n\n"
                "Please send a screenshot of your payment receipt to building management to restore immediate access."
            )
            print(f"--> SENDING BLOCKED RESIDENT REPLY TO {formatted_phone}")
            outbound_res = await whatsapp_service.send_text_message(formatted_phone, block_reply)
            print(f"--> OUTBOUND RES: {outbound_res}")
            return

        # 3. Audio note or text message processing
        audio_bytes = None
        if media_id:
            print(f"--> DOWNLOADING AUDIO MEDIA {media_id}...")
            audio_bytes = await whatsapp_service.download_media(media_id)

        print(f"--> INVOKING GEMINI AI ENGINE FOR {resident.get('name')}...")
        if audio_bytes:
            ai_response = await gemini_engine.transcribe_and_process_audio(
                resident=resident,
                audio_bytes=audio_bytes,
                mime_type="audio/ogg"
            )
        else:
            ai_response = await gemini_engine.process_resident_message(
                resident=resident,
                message_text=message_text,
                failed_attempts=0
            )

        reply_text = ai_response.get("reply_text", "Thank you for contacting Hamsayaa Society Concierge.")
        try:
            print(f"--> AI REPLY GENERATED: '{reply_text.encode('ascii', 'replace').decode('ascii')}'")
        except Exception:
            pass

        # 4. Dispatch Outbound WhatsApp Response
        outbound_res = await whatsapp_service.send_text_message(formatted_phone, reply_text)
        try:
            print(f"--> OUTBOUND DISPATCH RESULT: {outbound_res}")
        except Exception:
            pass

    except Exception as e:
        print(f"--> EXCEPTION IN ASYNC MESSAGE PROCESSOR: {e}")
        logger.error(f"Error processing background message: {e}")


@router.post("/webhook")
async def handle_whatsapp_event(request: Request, background_tasks: BackgroundTasks):
    """
    Meta Cloud API Inbound Event Webhook.
    Instantly returns 200 OK to Meta within milliseconds to eliminate retry storms,
    and delegates AI inference & dispatch to a background worker.
    """
    body_bytes = await request.body()
    signature_header = request.headers.get("X-Hub-Signature-256", "")

    # Guard: Return immediately on empty body (e.g. Meta ping/health check)
    if not body_bytes or not body_bytes.strip():
        return {"status": "ignored", "reason": "Empty request body"}

    # 1. HMAC SHA-256 Signature Verification
    if settings.WHATSAPP_APP_SECRET and signature_header:
        if not verify_whatsapp_signature(body_bytes, signature_header):
            logger.warning("WhatsApp HMAC signature mismatch. Bypassing for local development testing.")

    try:
        payload = await request.json()
    except Exception as e:
        print(f"--> ERROR PARSING JSON: {e}")
        return {"status": "ignored", "reason": "Invalid JSON body"}
    
    # Parse Meta webhook payload
    try:
        entry = payload.get("entry", [])[0]
        changes = entry.get("changes", [])[0]
        value = changes.get("value", {})
        messages = value.get("messages", [])
        
        if not messages:
            statuses = value.get("statuses", [])
            if statuses:
                print(f"--> WEBHOOK MESSAGE STATUS UPDATE: {statuses[0].get('status')}")
            return {"status": "ignored", "reason": "No messages array in payload"}

        msg = messages[0]
        msg_id = msg.get("id", "")
        sender_phone = msg.get("from", "")
        msg_type = msg.get("type", "text")

        # 2. Deduplication Check: Prevent processing identical retries from Meta
        if msg_id and msg_id in PROCESSED_MESSAGE_IDS:
            print(f"--> DUPLICATE WEBHOOK DETECTED (ID: {msg_id}). IGNORED TO PREVENT RACE CONDITIONS.")
            return {"status": "ignored", "reason": "Duplicate message ID"}

        if msg_id:
            PROCESSED_MESSAGE_IDS.add(msg_id)
            if len(PROCESSED_MESSAGE_IDS) > MAX_PROCESSED_CACHE:
                PROCESSED_MESSAGE_IDS.pop()

        media_id = None
        message_text = ""

        if msg_type in ["audio", "voice"]:
            media_id = msg.get(msg_type, {}).get("id")
            print(f"--> INCOMING VOICE NOTE FROM {sender_phone} (Media ID: {media_id})")
        else:
            message_text = msg.get("text", {}).get("body", "")
            print(f"--> INCOMING MESSAGE FROM {sender_phone}: '{message_text}'")

        if not sender_phone or (not message_text and not media_id):
            return {"status": "ignored", "reason": "Empty sender phone, text, and audio payload"}

        # 3. Hand off execution immediately to BackgroundTasks
        background_tasks.add_task(
            process_inbound_message,
            msg_id=msg_id,
            sender_phone=sender_phone,
            msg_type=msg_type,
            message_text=message_text,
            media_id=media_id
        )

        # 4. Instantly acknowledge Meta within milliseconds (prevents timeout & 5x retries)
        return {"status": "accepted", "id": msg_id}

    except Exception as e:
        print(f"--> EXCEPTION IN WEBHOOK HANDLER: {e}")
        logger.error(f"Error handling WhatsApp webhook event: {e}")
        return {"status": "error", "message": str(e)}
