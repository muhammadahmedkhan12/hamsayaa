from fastapi import APIRouter, Request, HTTPException, Query, Response, status
from app.core.config import settings
from app.core.security import validate_whatsapp_signature
from app.db.supabase import db_service
from app.services.gemini import gemini_engine
from app.services.whatsapp import whatsapp_service
import logging

router = APIRouter()
logger = logging.getLogger(__name__)

DEFAULT_SOCIETY_ID = "a1b2c3d4-e5f6-7890-abcd-111111111111"

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

@router.post("/webhook")
async def handle_whatsapp_event(request: Request):
    """
    Meta Cloud API Inbound Event Webhook.
    1. Validates HMAC SHA-256 signature using Meta App Secret.
    2. Extracts resident phone number and body text.
    3. Looks up resident in Supabase database.
    4. Enforces manual account block check (is_blocked).
    5. Invokes Gemini 1.5 Flash AI Engine for intent processing.
    6. Dispatches outbound WhatsApp message.
    """
    body_bytes = await request.body()
    signature_header = request.headers.get("X-Hub-Signature-256", "")
    
    # 1. HMAC SHA-256 Signature Verification
    if settings.WHATSAPP_APP_SECRET and signature_header:
        if not validate_whatsapp_signature(body_bytes, settings.WHATSAPP_APP_SECRET, signature_header):
            logger.warning("Invalid WhatsApp HMAC signature detected")
            raise HTTPException(status_code=401, detail="Invalid signature")

    payload = await request.json()
    
    # Parse Meta webhook payload
    try:
        entry = payload.get("entry", [])[0]
        changes = entry.get("changes", [])[0]
        value = changes.get("value", {})
        messages = value.get("messages", [])
        
        if not messages:
            return {"status": "ignored", "reason": "No messages array in payload"}

        msg = messages[0]
        sender_phone = msg.get("from", "")
        message_text = msg.get("text", {}).get("body", "")

        if not sender_phone or not message_text:
            return {"status": "ignored", "reason": "Empty sender phone or message text"}

        # Format phone string
        if not sender_phone.startswith("+"):
            sender_phone = "+" + sender_phone

        # 2. Resident Lookup in Supabase DB
        resident = None
        if db_service.client:
            res = db_service.client.table("residents").select("*").eq("phone_number", sender_phone).execute()
            if res.data and len(res.data) > 0:
                resident = res.data[0]

        # If resident not registered in society
        if not resident:
            reply = "Hello! Your phone number is not currently registered in the society directory. Please contact your building management."
            await whatsapp_service.send_text_message(sender_phone, reply)
            return {"status": "unregistered_resident", "phone": sender_phone}

        # 3. Check Manual Account Block (is_blocked)
        if resident.get("is_blocked"):
            block_reply = (
                "⚠️ *ACCOUNT ACCESS SUSPENDED*\n"
                f"Hello {resident.get('name')}, your WhatsApp bot access is currently suspended due to overdue maintenance dues.\n\n"
                "🏦 *Payment Account Details:*\n"
                "Meezan Bank - A/C 01020304050607 (Lakeview Maint Account)\n\n"
                "Please send a screenshot of your payment receipt to building management to restore immediate access."
            )
            await whatsapp_service.send_text_message(sender_phone, block_reply)
            return {"status": "resident_blocked", "phone": sender_phone}

        # 4. Invoke Gemini 1.5 Flash AI Engine
        ai_response = await gemini_engine.process_resident_message(
            resident=resident,
            message_text=message_text,
            failed_attempts=0
        )

        reply_text = ai_response.get("reply_text", "Thank you for contacting Hamsayaa Society Concierge.")

        # 5. Dispatch Outbound WhatsApp Response
        await whatsapp_service.send_text_message(sender_phone, reply_text)

        return {
            "status": "success",
            "phone": sender_phone,
            "resident_name": resident.get("name"),
            "ai_intent": ai_response.get("intent", "general"),
            "reply_text": reply_text
        }

    except Exception as e:
        logger.error(f"Error handling WhatsApp webhook event: {e}")
        return {"status": "error", "message": str(e)}
