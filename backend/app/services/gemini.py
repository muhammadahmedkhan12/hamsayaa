from app.core.config import settings
from app.db.supabase import db_service
import random
import logging
import re
from datetime import datetime, timezone, timedelta

logger = logging.getLogger(__name__)

# Import official google.genai SDK with fallback
try:
    from google import genai
    from google.genai import types
    USING_NEW_GENAI = True
except ImportError:
    try:
        import google.generativeai as genai
        USING_NEW_GENAI = False
    except ImportError:
        genai = None
        USING_NEW_GENAI = False

import json

try:
    from upstash_redis import Redis
    USING_UPSTASH = True
except ImportError:
    Redis = None
    USING_UPSTASH = False
HAMSAYAA_SYSTEM_PROMPT = """
You are Hamsayaa AI Concierge (ہمسایہ AI) — the WhatsApp assistant for a gated
residential society. You talk to verified residents only. You are warm,
efficient, and direct — never robotic, never overly formal, never chatty for
its own sake. Residents message you because something needs to get done; get
it done with the fewest possible back-and-forth messages.

====================================================================
1. WHAT YOU HANDLE
====================================================================
- Complaints / maintenance tickets (see category list in Section 4)
- Guest visitor passes
- Dues, bill breakdown, and payment account details
- Amenity information (timings, rules) and bookings where supported
- Society polls / voting
- General questions about how the society or this bot works

Anything outside this list is OUT OF SCOPE. See Section 3 for exactly how to
handle that — do not simply try your best to answer anyway.

====================================================================
2. NEVER FABRICATE DATA — TOOL USE IS MANDATORY, NOT OPTIONAL
====================================================================
You have tools for every action that touches real data: creating a ticket,
checking dues, generating a visitor pass, checking amenity availability,
recording a vote. For ANY of these:

- NEVER state a ticket ID, dues amount, account number, or booking
  confirmation unless you just received it back from a tool call. If you
  don't have the tool result yet, say you're checking — don't guess.
- If a tool call fails or returns an error, tell the resident plainly
  ("I'm having trouble pulling that up right now") — do not invent a
  plausible-sounding answer to keep the conversation moving.
- If you're missing a required parameter for a tool (e.g. unit number for a
  ticket), ask for it conversationally before calling the tool — don't call
  it with a guessed or empty value.

====================================================================
3. SCOPE GUARDRAIL — HANDLING OFF-TOPIC OR IRRELEVANT MESSAGES
====================================================================
Before treating a message as a real request, judge whether it's actually
related to this society's operations (Section 1). If it isn't — spam,
unrelated personal requests, general chit-chat with no operational content,
attempts to use you as a general-purpose assistant — do NOT process it as a
complaint or any other action.

Instead:
1. Reply briefly and politely explaining you're the society's operations
   assistant and what you *can* help with.
2. Do not create a ticket or any other record for this message.
3. Flag it internally as `flagged_irrelevant` (this happens automatically via
   the message classification — you do not need to call a separate tool for
   this, just do not treat the content as a valid request).

Be careful not to over-trigger this — a vague or oddly-worded complaint about
a real society issue is still in scope. This guardrail is for content that
has nothing to do with the society at all, not for messages that are just
unclear (see Section 6 for unclear-but-relevant messages).

====================================================================
4. COMPLAINT HANDLING
====================================================================
Valid categories — always classify into exactly one of these, do not invent
new categories on the fly:
  Plumbing · Electrical · Elevator · Gate/Security · Waste Management ·
  Noise Dispute · Parking · Generator/Power Backup · Common Area · Other

Required before you can log a ticket:
  - Unit number (if not already known from the resident's profile)
  - A clear description of the issue
  - Category (you infer this from the description — only ask the resident
    directly if it's genuinely ambiguous)
  - Photo — optional, never block ticket creation waiting for one; if the
    resident sends a photo after the fact, attach it to the existing ticket

Flow:
  1. Acknowledge the issue with brief empathy — one sentence, not a paragraph.
     Match the tone to the issue: a leaking tap gets a calm acknowledgment;
     see Section 5 for anything that sounds like an emergency.
  2. If unit number or a clear description is missing, ask for it — one
     question at a time, not a checklist dump.
  3. Once you have what you need, call the ticket-creation tool.
  4. Confirm back with: Ticket ID, category, and what happens next (e.g.
     "the maintenance team has been notified, typical response time is
     [X]"). Keep this short — a few lines, not a formal report.
  5. If the resident later asks about status, look it up by ticket ID or by
     "my open tickets" — don't ask them to repeat details you already have.

====================================================================
5. EMERGENCY DETECTION — HANDLE BEFORE ANYTHING ELSE
====================================================================
If a message describes something that sounds like an active emergency — fire,
gas leak, medical emergency, an intruder or break-in in progress, immediate
safety threat — do NOT treat this as a normal complaint ticket.

  1. Immediately tell the resident to contact local emergency services
     directly (police / fire / ambulance) if they haven't already — do not
     make them wait for a maintenance ticket workflow.
  2. Still log a ticket for the record, but tag it urgent/emergency category
     so it surfaces immediately on the admin dashboard.
  3. Do not use routine, reassuring "the team has been notified, expect a
     response within X hours" language — that's the wrong tone for something
     urgent and can read as dismissive.

====================================================================
6. WHEN YOU DON'T UNDERSTAND — ESCALATION, NOT GUESSING
====================================================================
If after a genuine attempt you still can't determine what the resident needs
(ambiguous message, contradictory details, a request you don't have a tool
for), try ONE clarifying question. If that still doesn't resolve it:

  - Tell the resident plainly you're flagging this for the team to follow up
    with them directly.
  - Log it as a ticket tagged `needs_human_review` with whatever context you
    do have.
  - Do not keep asking clarifying questions indefinitely — two failed
    attempts is the limit, then hand off.

This is different from Section 3 (off-topic). This is for messages that ARE
plausibly in-scope but you can't parse clearly enough to act on.

====================================================================
7. VISITOR PASSES
====================================================================
Required fields, gathered conversationally (don't demand all four in one
robotic list unless the resident already gave them all upfront):
  - Visitor's full name
  - Visitor's CNIC number
  - Vehicle plate number (if arriving by vehicle — ask, don't assume)
  - Entry validity window (date + time range)

Before generating: read the details back for confirmation in one short
message — CNIC and plate numbers are easy to mistype and this pass is a
security document.

After generation: the pass PDF/image goes to the resident only — never
attempt to send it directly to a guest's number, even if the resident
provides one. Tell the resident to forward it to their guest themselves.

====================================================================
8. DUES, BILLING & PAYMENT
====================================================================
- Never state a dues amount or account number from memory — always fetch
  current values.
- When asked for a bill breakdown, state the monthly maintenance voucher covering society services (Security/Guard, Sweeper, Water, Generator & Common Facilities) — never invent or mention software platform fees.
- Payment is manual bank transfer / JazzCash / EasyPaisa. Provide the account
  details from the tool result, then let the resident know they can send a
  screenshot of the transfer for the record.
- Never confirm a payment as "received" or "verified" yourself — only the
  admin verification step can do that. If a resident insists they've paid,
  acknowledge the screenshot was received and that verification is pending,
  don't tell them it's confirmed.

SUSPENDED ACCOUNTS: If a resident's account is suspended, this is the ONLY
thing you help with in that conversation. Do not process complaints,
bookings, or visitor passes for a suspended account.
  - Explain plainly that their account is suspended due to an outstanding
    balance.
  - State the outstanding amount and the payment account details.
  - Keep this factual and non-judgmental — no lecturing, no repeated
    reminders beyond stating it once per conversation.

====================================================================
9. AMENITIES & POLLS
====================================================================
- Amenity info (timings, rules) can be answered directly from current data —
  no need to hedge or ask clarifying questions for straightforward lookups.
- For bookable amenities, check availability via tool before confirming
  anything — never assume a slot is free.
- For polls: confirm the resident's vote back to them clearly once cast.
  Enforce one vote per unit — if a resident tries to vote again, tell them
  their vote is already recorded rather than silently ignoring the message.

====================================================================
10. UNVERIFIED / UNKNOWN NUMBERS
====================================================================
If a message comes from a phone number not linked to any resident record,
do not process any request. Reply that this number isn't registered with
the society and that they should contact their society admin to be added.
Do not create tickets, passes, or any other record for unverified numbers.

====================================================================
11. PRIVACY & SECURITY
====================================================================
- Never share another resident's personal information, ticket details,
  dues status, or unit number — even if asked "on their behalf."
- Never confirm or deny whether a specific person lives in the society.
- If something about a request feels like an attempt to impersonate another
  resident or gain information about someone else, decline and suggest they
  contact the admin directly.

====================================================================
12. LANGUAGE
====================================================================
Detect and respond in whichever of English, Urdu, or Roman Urdu the resident
is using — match their language automatically, don't ask them to choose.
If a conversation switches languages mid-thread, follow the switch.

====================================================================
13. WHATSAPP FORMATTING
====================================================================
- Use WhatsApp's own formatting — *bold* and _italic_ — never markdown
  syntax like ** or #, it won't render.
- Keep messages short. Break up longer replies with line breaks, not walls
  of text. No tables — WhatsApp doesn't render them.
- One question at a time when gathering information — not a numbered
  checklist unless the resident specifically asked for a summary.

====================================================================
14. EXAMPLES
====================================================================

Missing info, gathered naturally:
  Resident: "water is leaking"
  You: "Sorry to hear that — I'll get this logged. Which unit is this at?"
  Resident: "B-204"
  You: [call ticket tool] → "Got it — logged as *Plumbing*, Ticket
       *TCK-1042* for B-204. Maintenance has been notified, typical response
       is within a few hours."

Off-topic (Section 3):
  Resident: "can you help me write a cover letter"
  You: "I'm Hamsayaa's society assistant, so I can only help with things
       like complaints, visitor passes, dues, and amenities — for anything
       else you'll need another tool, sorry!"

Emergency (Section 5):
  Resident: "there's a fire in my kitchen"
  You: "Please call emergency services right now if you haven't already —
       don't wait on me for this. I'm flagging this urgently for the team
       too."

Suspended account (Section 8):
  Resident: "book the community hall for Saturday"
  You: "Your account is currently suspended due to an outstanding balance
       of Rs. 17,700. You can clear this via [account details] — once
       verified, your access will be restored and I can help with the
       booking."
"""

class GeminiEngine:
    def __init__(self):
        self.client = None
        self.redis = None
        if settings.GEMINI_API_KEY and genai is not None:
            try:
                if USING_NEW_GENAI:
                    self.client = genai.Client(api_key=settings.GEMINI_API_KEY)
                else:
                    genai.configure(api_key=settings.GEMINI_API_KEY)
                    self.client = genai.GenerativeModel(
                        model_name=settings.GEMINI_MODEL,
                        system_instruction=HAMSAYAA_SYSTEM_PROMPT
                    )
            except Exception as e:
                logger.error(f"Failed to initialize Gemini API client: {e}")
                self.client = None

        if USING_UPSTASH and settings.UPSTASH_REDIS_REST_URL and settings.UPSTASH_REDIS_REST_TOKEN:
            try:
                self.redis = Redis(url=settings.UPSTASH_REDIS_REST_URL, token=settings.UPSTASH_REDIS_REST_TOKEN)
            except Exception as e:
                logger.error(f"Failed to initialize Upstash Redis: {e}")

    def _get_model_candidates(self) -> list[str]:
        """
        Returns an ordered list of Gemini model candidates for resilient fallback.
        If the primary model is rate-limited (429) or experiencing temporary high demand (503),
        the engine seamlessly cascades to the next available model.
        """
        candidates = []
        base_model = settings.GEMINI_MODEL
        if base_model and not base_model.startswith("gemini-2.") and base_model != "gemini-flash-latest":
            candidates.append(base_model)
        for fallback in ["gemini-3.5-flash-lite", "gemini-3.7-flash", "gemini-3.6-flash", "gemini-flash-latest", "gemini-3-flash-preview"]:
            if fallback not in candidates:
                candidates.append(fallback)
        return candidates

    def _get_chat_history(self, phone: str) -> str:
        if not self.redis or not phone:
            return ""
        try:
            clean_phone = phone.replace("+", "").replace(" ", "").replace("-", "")
            key = f"chat_history:{clean_phone}"
            raw_items = self.redis.lrange(key, -6, -1) or []
            print(f"--> [Upstash Memory] Loading history for {clean_phone} (found {len(raw_items)} messages)")
            context_lines = []
            for item in raw_items:
                try:
                    obj = json.loads(item) if isinstance(item, str) else item
                    role = "Resident" if obj.get("role") == "user" else "AI Concierge"
                    context_lines.append(f"{role}: {obj.get('text')}")
                except Exception:
                    pass
            return "\n".join(context_lines)
        except Exception as e:
            logger.error(f"Error fetching Upstash Redis chat history: {e}")
            return ""

    def _save_chat_history(self, phone: str, user_text: str, assistant_reply: str):
        if not self.redis or not phone:
            return
        try:
            clean_phone = phone.replace("+", "").replace(" ", "").replace("-", "")
            key = f"chat_history:{clean_phone}"
            self.redis.rpush(key, json.dumps({"role": "user", "text": user_text}))
            self.redis.rpush(key, json.dumps({"role": "assistant", "text": assistant_reply}))
            self.redis.expire(key, 86400) # 24 hour conversation memory
            print(f"--> [Upstash Memory] Saved user turn and assistant reply for {clean_phone}")
        except Exception as e:
            logger.error(f"Error saving Upstash Redis chat history: {e}")

    def _dispatch_response(self, payload: dict, resident: dict, user_text: str) -> dict:
        if resident and payload.get("reply_text"):
            phone = resident.get("phone_number", "")
            self._save_chat_history(phone, user_text, payload["reply_text"])
        return payload

    def _generate_ticket_number(self) -> str:
        num = random.randint(1000, 9999)
        return f"TCK-{num}"

    def _generate_pass_code(self) -> str:
        num = random.randint(1000, 9999)
        return f"LV-{num}"

    async def transcribe_and_process_audio(
        self,
        resident: dict,
        audio_bytes: bytes,
        mime_type: str = "audio/ogg"
    ) -> dict:
        """
        Transcribes WhatsApp voice note using Gemini 2.0 Flash multimodal capabilities,
        uploads original recording to Supabase Storage, and processes transcribed text seamlessly.
        """
        if not audio_bytes:
            return {"status": "error", "reply_text": "I could not process the voice note because the audio payload was empty."}

        transcribed_text = ""
        if self.client and USING_NEW_GENAI:
            audio_part = types.Part.from_bytes(data=audio_bytes, mime_type=mime_type)
            prompt = "Listen to this resident's voice note (which may be spoken in Urdu, Roman Urdu, or English). Transcribe the exact message clearly. Return ONLY the transcribed text message, nothing else."
            
            for model_name in self._get_model_candidates():
                try:
                    res = self.client.models.generate_content(
                        model=model_name,
                        contents=[audio_part, prompt]
                    )
                    if res and res.text:
                        transcribed_text = res.text.strip()
                        print(f"--> [Voice Note Transcribed with {model_name}]: '{transcribed_text}'")
                        break
                except Exception as e:
                    logger.warning(f"Audio transcription failed on model {model_name}: {e}. Trying next candidate...")

        if not transcribed_text:
            transcribed_text = "Resident sent a voice note regarding maintenance issue."

        # Upload audio recording to Supabase Storage for permanent admin playback
        filename = f"{resident.get('id', 'guest')}_{random.randint(10000, 99999)}.ogg"
        audio_url = db_service.upload_voice_note(audio_bytes, filename)

        # Process transcribed message through full agentic memory pipeline
        res_payload = await self.process_resident_message(resident, transcribed_text, audio_url=audio_url)
        
        # Attach audio URL to payload if available
        if audio_url:
            res_payload["audio_url"] = audio_url

        return res_payload

    async def process_image_message(
        self,
        resident: dict,
        image_bytes: bytes,
        caption: str = "",
        mime_type: str = "image/jpeg"
    ) -> dict:
        """
        Multimodal WhatsApp Image Processor using Gemini Vision.
        Handles:
        1. Payment receipts & bank transfer slips (attaches to invoice, advances, audit).
        2. Maintenance defect / fault photos (creates complaint ticket with photo_url).
        3. Irrelevant / boundary images.
        """
        phone = resident.get("phone_number", "") if resident else ""
        name = resident.get("name", "Resident") if resident else "Resident"
        building = resident.get("building", "Block A") if resident else "Block A"
        unit = resident.get("unit_number", "101") if resident else "101"
        society_id = resident.get("society_id", "a1b2c3d4-e5f6-7890-abcd-111111111111") if resident else "a1b2c3d4-e5f6-7890-abcd-111111111111"
        res_id = resident.get("id") if resident else None

        if not image_bytes:
            return {"status": "error", "reply_text": "I could not process the image because the image payload was empty."}

        vision_data = None
        if self.client and USING_NEW_GENAI:
            image_part = types.Part.from_bytes(data=image_bytes, mime_type=mime_type)
            vision_prompt = (
                f"You are Hamsayaa AI Concierge analyzing an image sent via WhatsApp by a verified resident.\n"
                f"Resident: {name} ({building} - Unit {unit})\n"
                f"Resident Caption: \"{caption}\"\n\n"
                f"Analyze BOTH the visual content and the resident's caption together to determine intent:\n"
                f"1. 'payment_slip': If the image shows a bank transfer slip, receipt, cheque, or transaction screen, OR if the resident sent a slip image stating they paid their maintenance dues/fee.\n"
                f"2. 'maintenance_issue': If the image or caption shows or describes a physical defect, damage, leak, broken fixture, elevator fault, sanitation issue, electrical hazard, or repair need.\n"
                f"3. 'irrelevant': A selfie, greeting, meme, nature photo, or image completely unrelated to society maintenance or fee payments.\n\n"
                f"Return ONLY a JSON object with this schema:\n"
                f"{{\n"
                f"  \"image_type\": \"payment_slip\" | \"maintenance_issue\" | \"irrelevant\",\n"
                f"  \"amount\": number or null,\n"
                f"  \"bank_or_app\": string or null,\n"
                f"  \"reference_number\": string or null,\n"
                f"  \"payment_date\": string or null,\n"
                f"  \"complaint_category\": \"Water & Plumbing\" | \"Electrical & Power\" | \"Elevators & Lifts\" | \"Sanitation & Waste\" | \"Security & Parking\" | \"General Maintenance & Repair\" | null,\n"
                f"  \"description\": string,\n"
                f"  \"reply_text\": string\n"
                f"}}"
            )

            for model_name in self._get_model_candidates():
                try:
                    res = self.client.models.generate_content(
                        model=model_name,
                        contents=[image_part, vision_prompt],
                        config=types.GenerateContentConfig(
                            response_mime_type="application/json"
                        )
                    )
                    if res and res.text:
                        vision_data = json.loads(res.text)
                        print(f"--> [Gemini Vision using {model_name}]: image_type='{vision_data.get('image_type')}'")
                        break
                except Exception as e:
                    logger.warning(f"Vision analysis failed on model {model_name}: {e}. Trying next candidate...")

        if not vision_data:
            # Fallback heuristic if all vision models failed
            vision_data = {
                "image_type": "payment_slip" if any(k in caption.lower() for k in ["fee", "paid", "slip", "receipt", "transfer", "raast"]) else "maintenance_issue",
                "amount": None,
                "bank_or_app": None,
                "reference_number": None,
                "payment_date": None,
                "complaint_category": "General Maintenance & Repair",
                "description": caption or "Image received from resident",
                "reply_text": ""
            }

        image_type = vision_data.get("image_type", "payment_slip")
        amount = vision_data.get("amount")
        bank_or_app = vision_data.get("bank_or_app") or "Bank Transfer"
        ref_no = vision_data.get("reference_number") or "N/A"

        # Case 1: Payment Slip / Receipt Screenshot
        if image_type == "payment_slip":
            # 1. Upload receipt to Supabase Storage
            filename = f"receipt_{res_id or 'guest'}_{random.randint(10000, 99999)}.jpg"
            receipt_url = db_service.upload_image(image_bytes, filename, bucket_name="society-receipts", mime_type=mime_type)

            # 2. Lookup or create advance invoice
            inv = db_service.get_or_create_advance_invoice(society_id, res_id) if res_id else None

            # 3. Check if already settled
            is_already_settled = False
            if inv:
                is_already_settled = bool(inv.get("is_already_settled") or inv.get("status") in ["paid", "verified"])

            if is_already_settled:
                amt_str = f"PKR {amount:,.0f}" if amount else "your payment"
                reply = (
                    f"ℹ️ *DUES ALREADY SETTLED*\n\n"
                    f"Hello *{name}*, our records show that your maintenance voucher for the current cycle is already marked as *Paid / Verified*! 🎉\n\n"
                    f"• *Current Balance:* Rs. 0 (All clear)\n"
                    f"• *Slip Recorded:* {amt_str} (Ref: {ref_no})\n\n"
                    f"If this transfer was for advance maintenance or a separate society charge, our management office has recorded it for review."
                )
                res_payload = {
                    "status": "success",
                    "intent": "payment_already_settled",
                    "receipt_url": receipt_url,
                    "reply_text": reply
                }
                return self._dispatch_response(res_payload, resident, caption or "[Payment Screenshot]")

            # Not settled: attach receipt to active / advance invoice
            if inv:
                db_service.attach_invoice_receipt(inv["id"], receipt_url)

            amt_display = f"PKR {amount:,.0f}" if amount else "Maintenance Dues"
            reply = (
                f"✅ *PAYMENT RECEIPT RECEIVED*\n\n"
                f"Hello *{name}* ({building} - Unit {unit}), thank you!\n\n"
                f"We have received your payment transfer screenshot:\n"
                f"• 💰 *Amount:* {amt_display}\n"
                f"• 🏦 *Method / Bank:* {bank_or_app}\n"
                f"• 🔖 *Reference / TxID:* {ref_no}\n"
                f"• 🏠 *Unit:* {building} - Unit {unit}\n\n"
                f"⏳ *Status: Under Verification*\n"
                f"Your payment receipt has been attached to your voucher. The society office / admin will manually review and approve the transfer before updating your account to Paid. ✅\n\n"
                f"_💡 Note: If you ever send a wrong image or make another transfer, simply send the new screenshot here and it will update your verification record._"
            )
            res_payload = {
                "status": "success",
                "intent": "payment_receipt_submitted",
                "receipt_url": receipt_url,
                "amount": amount,
                "invoice_id": inv.get("id") if inv else None,
                "reply_text": reply
            }
            return self._dispatch_response(res_payload, resident, caption or "[Payment Screenshot]")

        # Case 2: Maintenance Fault / Defect Photo
        elif image_type == "maintenance_issue":
            filename = f"complaint_{res_id or 'guest'}_{random.randint(10000, 99999)}.jpg"
            photo_url = db_service.upload_image(image_bytes, filename, bucket_name="society-voice-notes", mime_type=mime_type)

            ticket_num = self._generate_ticket_number()
            category = vision_data.get("complaint_category") or "General Maintenance & Repair"
            description = vision_data.get("description") or caption or "Maintenance issue reported with photo"

            if res_id and db_service.client:
                try:
                    db_service.client.table("complaints").insert({
                        "society_id": society_id,
                        "resident_id": res_id,
                        "ticket_number": ticket_num,
                        "category": category,
                        "description": description,
                        "photo_url": photo_url,
                        "status": "open"
                    }).execute()
                except Exception as e:
                    logger.error(f"Error writing complaint ticket with photo: {e}")

            reply = (
                f"🛠️ *HAMSAYAA TICKET REGISTERED*\n\n"
                f"Hello *{name}*, your maintenance issue has been logged with photo attached:\n"
                f"• *Ticket ID:* `{ticket_num}`\n"
                f"• *Category:* {category}\n"
                f"• *Location:* {building} - Unit {unit}\n"
                f"• *Details:* \"{description}\"\n\n"
                f"📌 *Status:* Open (Notified to society management office)"
            )
            res_payload = {
                "status": "success",
                "intent": "complaint_with_photo",
                "ticket_number": ticket_num,
                "photo_url": photo_url,
                "reply_text": reply
            }
            return self._dispatch_response(res_payload, resident, caption or "[Maintenance Photo]")

        # Case 3: Irrelevant Image / Off-topic
        else:
            reply = (
                f"Hello *{name}*! We received your image, but it does not appear to be a maintenance fault or payment receipt.\n\n"
                f"As Hamsayaa Concierge, I can assist you with:\n"
                f"• 🛠️ Logging maintenance complaints\n"
                f"• 🧾 Checking maintenance vouchers & recording payment slips\n"
                f"• 🎫 Issuing guest visitor passes\n"
                f"• 🏊 Facility timings & community polls\n\n"
                f"Please let me know if you need assistance with any of these!"
            )
            res_payload = {
                "status": "success",
                "intent": "irrelevant_image",
                "reply_text": reply
            }
            return self._dispatch_response(res_payload, resident, caption or "[Irrelevant Image]")

    async def process_resident_message(
        self,
        resident: dict,
        message_text: str,
        failed_attempts: int = 0,
        audio_url: str | None = None
    ) -> dict:
        """
        Pure LLM-First Resident Message Processing.
        All inbound resident messages are analyzed and reasoned over by Gemini.
        Zero hardcoded keyword arrays or regex gates.
        If Gemini is unavailable across all candidate models, sends a clean service-busy notification.
        """
        phone = resident.get("phone_number", "") if resident else ""
        name = resident.get("name", "Resident") if resident else "Resident"
        building = resident.get("building", "Block A") if resident else "Block A"
        unit = resident.get("unit_number", "101") if resident else "101"

        # 1. Hydrate Context from Supabase & Upstash Redis
        history_context = self._get_chat_history(phone)
        
        active_tickets_summary = ""
        recent_tickets = []
        open_tickets = []
        if resident and db_service.client:
            try:
                tck_res = db_service.client.table("complaints").select("*").eq("resident_id", resident.get("id")).order("created_at", desc=True).limit(10).execute()
                recent_tickets = tck_res.data or []
                open_tickets = [t for t in recent_tickets if t.get("status") in ["open", "in_progress", "needs_human_review"]]
                if recent_tickets:
                    t_lines = [f"- Ticket {t['ticket_number']} ({t['category']}): STATUS={t['status'].upper()} - Details: \"{t['description']}\"" for t in recent_tickets]
                    active_tickets_summary = "Resident Active Logged Tickets in Database:\n" + "\n".join(t_lines)
            except Exception as e:
                logger.error(f"Error fetching tickets context: {e}")

        active_invoice = None
        invoice_summary = ""
        if resident and db_service.client:
            try:
                inv_res = db_service.client.table("invoices").select("*").eq("resident_id", resident.get("id")).order("created_at", desc=True).limit(3).execute()
                invoices_list = inv_res.data or []
                active_invoice = next((i for i in invoices_list if i.get("status") in ["unpaid", "overdue"]), invoices_list[0] if invoices_list else None)
                if active_invoice:
                    total_amt = active_invoice.get('total_amount') or active_invoice.get('society_maintenance_fee', 0)
                    invoice_summary = (
                        f"RESIDENT DUES & MONTHLY VOUCHER (LIVE SUPABASE DB):\n"
                        f"• Status: {active_invoice.get('status', '').upper()}\n"
                        f"• Monthly Maintenance Voucher: PKR {total_amt:,.2f} (Includes Security/Guard, Sweeper/Sanitation, Water Supply, Generator & Common Facilities)\n"
                        f"• Total Amount Due: PKR {total_amt:,.2f}\n"
                        f"• Due Date: {active_invoice.get('due_date', 'N/A')}\n"
                        f"• Payment Account: {active_invoice.get('account_shown') or 'Meezan Bank - A/C PK42MEZN00012345678901 - Lakeview Maint Account'}"
                    )
            except Exception as e:
                logger.error(f"Error fetching invoice context: {e}")

        polls_summary = ""
        active_polls = []
        if resident and resident.get("society_id"):
            try:
                polls_list = db_service.get_polls(resident.get("society_id"), resident_id=resident.get("id"))
                active_polls = [p for p in polls_list if not p.get("is_closed")]
                if active_polls:
                    p_lines = []
                    for p in active_polls:
                        line = f"- Poll UUID: {p.get('id')} | Question: \"{p.get('title')}\" | Options: {', '.join(p.get('options') or [])} | Total Votes: {p.get('total_votes', 0)}"
                        if p.get("resident_voted_option"):
                            line += f" [ALREADY VOTED: '{p.get('resident_voted_option')}']"
                        p_lines.append(line)
                    polls_summary = "Active Community Polls:\n" + "\n".join(p_lines)
            except Exception as e:
                logger.error(f"Error fetching polls context: {e}")

        amenities_summary = ""
        if resident and resident.get("society_id"):
            try:
                amenities_list = db_service.get_amenities(resident.get("society_id"))
                if amenities_list:
                    am_lines = [
                        f"• {a.get('name')}: Timings: {a.get('timings', 'Standard')}, Rules: {a.get('rules', 'Standard community guidelines')}, Bookable: {'Yes' if a.get('is_bookable') else 'No'}"
                        for a in amenities_list
                    ]
                    amenities_summary = "Society Amenities & Facilities Directory:\n" + "\n".join(am_lines)
            except Exception as e:
                logger.error(f"Error fetching amenities context: {e}")

        # 2. Build LLM Structured Action Prompt
        full_prompt = (
            f"RESIDENT PROFILE:\n"
            f"Name: {name}\n"
            f"Unit: {building} - Unit {unit}\n\n"
        )
        if active_tickets_summary:
            full_prompt += f"{active_tickets_summary}\n\n"
        if invoice_summary:
            full_prompt += f"{invoice_summary}\n\n"
        if amenities_summary:
            full_prompt += f"{amenities_summary}\n\n"
        if polls_summary:
            full_prompt += f"{polls_summary}\n\n"
        if history_context:
            full_prompt += f"RECENT CONVERSATION HISTORY (UPSTASH MEMORY):\n{history_context}\n\n"
        
        full_prompt += f"NEW RESIDENT MESSAGE: \"{message_text}\"\n"

        structured_system_prompt = (
            f"{HAMSAYAA_SYSTEM_PROMPT}\n\n"
            "====================================================================\n"
            "STRUCTURED ACTION OUTPUT INSTRUCTIONS\n"
            "====================================================================\n"
            "You are the autonomous concierge brain. Analyze the resident's message and context, then return ONLY a JSON object with this schema:\n"
            "{\n"
            "  \"action\": \"reply\" | \"create_complaint\" | \"close_complaints\" | \"issue_visitor_pass\" | \"cast_poll_vote\",\n"
            "  \"complaint_category\": \"Water & Plumbing\" | \"Electrical & Power\" | \"Elevators & Lifts\" | \"Sanitation & Waste\" | \"Security & Parking\" | \"Emergency & Life Safety\" | \"General Maintenance & Repair\" | null,\n"
            "  \"complaint_description\": string | null,\n"
            "  \"close_all\": boolean,\n"
            "  \"ticket_numbers\": list[string],\n"
            "  \"visitor_name\": string | null,\n"
            "  \"visitor_cnic\": string | null,\n"
            "  \"vehicle_plate\": string | null,\n"
            "  \"poll_id\": string | null,\n"
            "  \"poll_option\": string | null,\n"
            "  \"reply_text\": string\n"
            "}\n\n"
            "CRITICAL ACTION DISPATCH RULES:\n"
            "1. 'create_complaint': Select ONLY when the resident is explicitly reporting or filing a genuine new issue/maintenance fault for their unit or building. Do NOT select this if the resident is just asking about existing complaints or inquiring about status!\n"
            "2. 'close_complaints': Select when the resident wants to close/resolve/cancel their complaint(s). Set close_all=true if they want to close all/every ticket, or list specific ticket IDs in ticket_numbers.\n"
            "3. 'issue_visitor_pass': Select when the resident wants to issue a visitor pass AND has provided visitor details. If required details (name, CNIC/plate) are missing, select 'reply' and ask conversationally for the missing details.\n"
            "4. 'cast_poll_vote': Select when the resident is casting a vote for an active society poll. CRITICAL: 'poll_id' MUST be the exact 36-character Poll UUID (e.g. 'c3d4e5f6-...') copied directly from 'Poll UUID:' in the Active Community Polls section above, NEVER the question text. 'poll_option' must match one of the listed options. If the poll context shows [ALREADY VOTED], do NOT select 'cast_poll_vote' — instead select 'reply' and inform the resident they have already voted.\n"
            "5. 'reply': Select for ALL questions, inquiries, status checks, dues/bill requests, amenities info, off-topic boundaries, life safety emergency advice, or general conversation. Craft a warm, helpful reply_text matching their language (English, Urdu, or Roman Urdu). Use *bold* and _italic_ for WhatsApp formatting.\n"
            "6. EMERGENCY: If resident describes fire, gas leak, medical emergency, or active intruder, immediately advise calling 1122/16/15 in reply_text AND select action 'create_complaint' with category 'Emergency & Life Safety'.\n"
            "7. NEVER invent dues, bank accounts, or ticket IDs. Use only values from the context.\n"
            "8. NEVER claim that a maintenance team or technician has been dispatched unless the context explicitly states that. Keep status factual: 'logged and routed to society management'.\n"
            "9. IN-UNIT COMPLAINT INTEGRITY: If the resident is reporting a maintenance problem for their apartment (such as a water leak, electrical issue, etc.), select 'create_complaint'. Do NOT treat different issues (e.g. water leak vs no water supply) as duplicates.\n"
            "10. TEXT PAYMENT CLAIMS: If the resident states in text that they have paid their bill or dues (e.g. 'I have paid', 'fee transfer kardi hai') without sending an image, select 'reply' and politely ask them to send a screenshot or photo of their payment receipt/bank slip right here on WhatsApp so the management office can verify it."
        )

        # 3. Invoke LLM Cascade
        llm_data = None
        if self.client and USING_NEW_GENAI:
            for model_name in self._get_model_candidates():
                try:
                    res = self.client.models.generate_content(
                        model=model_name,
                        contents=full_prompt,
                        config=types.GenerateContentConfig(
                            system_instruction=structured_system_prompt,
                            response_mime_type="application/json"
                        )
                    )
                    if res and res.text:
                        llm_data = json.loads(res.text)
                        print(f"--> [Gemini AI Decision using {model_name}]: action='{llm_data.get('action')}'")
                        break
                except Exception as e:
                    logger.warning(f"Gemini model {model_name} unavailable: {e}. Trying next model in cascade...")

        # 4. If AI Service is completely down across all models in cascade:
        if not llm_data:
            reply = (
                f"⚠️ *AI CONCIERGE TEMPORARILY BUSY*\n\n"
                f"Hello {name}, our AI concierge service is currently experiencing high network demand or temporary downtime.\n\n"
                f"Your message has been received. Please try again in a few moments, or if your request is urgent, please contact the society management office directly:\n"
                f"• 🏢 *Office Intercom:* Ext 100\n"
                f"• 📞 *Society Helpline:* +92 300 1234567"
            )
            res_payload = {"status": "service_unavailable", "reply_text": reply}
            return self._dispatch_response(res_payload, resident, message_text)

        action = llm_data.get("action", "reply")
        reply_text = llm_data.get("reply_text", "")

        # 5. Execute Action based on LLM Decision

        # Action A: Create Complaint
        if action == "create_complaint":
            category = llm_data.get("complaint_category") or "General Maintenance & Repair"
            description = llm_data.get("complaint_description") or message_text

            # Insert new complaint directly based on LLM decision
            ticket_num = self._generate_ticket_number()
            if resident and db_service.client:
                try:
                    db_service.client.table("complaints").insert({
                        "society_id": resident.get("society_id"),
                        "resident_id": resident.get("id"),
                        "ticket_number": ticket_num,
                        "category": category,
                        "description": description,
                        "status": "open",
                        "photo_url": audio_url
                    }).execute()
                except Exception as e:
                    logger.error(f"Error writing complaint ticket: {e}")

            if not reply_text:
                reply_text = (
                    f"🛠️ *HAMSAYAA TICKET REGISTERED*\n\n"
                    f"Hello {name}, your society issue has been logged:\n"
                    f"• *Ticket ID:* `{ticket_num}`\n"
                    f"• *Category:* {category}\n"
                    f"• *Location:* {building} - Unit {unit}\n"
                    f"• *Details:* \"{description}\"\n\n"
                    f"📌 *Status:* Open (Notified to society management office)"
                )
            else:
                # Ensure ticket number is mentioned in AI confirmation
                if ticket_num not in reply_text:
                    reply_text = f"{reply_text}\n\n📌 *Ticket ID:* `{ticket_num}` (Category: {category})"

            res_payload = {
                "status": "success",
                "intent": "complaint",
                "ticket_number": ticket_num,
                "reply_text": reply_text
            }
            return self._dispatch_response(res_payload, resident, message_text)

        # Action B: Close Complaints
        elif action == "close_complaints":
            close_all = llm_data.get("close_all", False)
            target_tcks = [t.upper() for t in (llm_data.get("ticket_numbers") or [])]

            if close_all and open_tickets:
                if db_service.client:
                    try:
                        ids = [t.get("id") for t in open_tickets if t.get("id")]
                        db_service.client.table("complaints").update({"status": "resolved"}).in_("id", ids).execute()
                    except Exception as e:
                        logger.error(f"Error closing all complaints: {e}")
                if not reply_text:
                    reply_text = f"✅ *ALL {len(open_tickets)} COMPLAINTS CLOSED*\n\nHello {name}, all {len(open_tickets)} of your active complaints have been marked as resolved at your request."
            elif target_tcks:
                matched_ids = [t.get("id") for t in open_tickets if t.get("ticket_number") in target_tcks]
                if matched_ids and db_service.client:
                    try:
                        db_service.client.table("complaints").update({"status": "resolved"}).in_("id", matched_ids).execute()
                    except Exception as e:
                        logger.error(f"Error closing complaints: {e}")
                if not reply_text:
                    reply_text = f"✅ *COMPLAINT CLOSED*\n\nHello {name}, ticket(s) {', '.join(target_tcks)} have been marked as resolved at your request."

            res_payload = {
                "status": "success",
                "intent": "complaint_closed",
                "reply_text": reply_text
            }
            return self._dispatch_response(res_payload, resident, message_text)

        # Action C: Issue Visitor Pass
        elif action == "issue_visitor_pass":
            visitor_name = llm_data.get("visitor_name")
            visitor_cnic = llm_data.get("visitor_cnic") or "Unspecified"
            vehicle_plate = llm_data.get("vehicle_plate") or "None (Walk-in)"

            if visitor_name:
                pass_code = self._generate_pass_code()
                now_utc = datetime.now(timezone.utc)
                valid_from = now_utc.isoformat()
                valid_until = (now_utc + timedelta(hours=4)).isoformat()

                if resident and db_service.client:
                    try:
                        db_service.client.table("visitor_passes").insert({
                            "society_id": resident.get("society_id"),
                            "resident_id": resident.get("id"),
                            "visitor_name": visitor_name,
                            "visitor_cnic": visitor_cnic,
                            "vehicle_plate": vehicle_plate,
                            "pass_code": pass_code,
                            "valid_from": valid_from,
                            "valid_until": valid_until
                        }).execute()
                    except Exception as e:
                        logger.error(f"Error writing visitor pass: {e}")

                if not reply_text or pass_code not in reply_text:
                    reply_text = (
                        f"🎫 *HAMSAYAA VISITOR PASS ISSUED*\n"
                        f"• *Pass Code:* *{pass_code}*\n"
                        f"• *Visitor:* {visitor_name}\n"
                        f"• *CNIC:* {visitor_cnic}\n"
                        f"• *Vehicle Plate:* {vehicle_plate}\n"
                        f"• *Resident:* {name} (Unit {unit})\n"
                        f"• *Validity:* Next 4 Hours\n\n"
                        f"📌 *Gatekeeper Verification:* Present this pass code visually at the main security gate."
                    )

                res_payload = {
                    "status": "success",
                    "intent": "visitor_pass",
                    "pass_code": pass_code,
                    "reply_text": reply_text
                }
                return self._dispatch_response(res_payload, resident, message_text)

        # Action D: Cast Poll Vote
        elif action == "cast_poll_vote":
            poll_id = llm_data.get("poll_id")
            poll_opt = llm_data.get("poll_option")
            
            # Defensive check: if poll_id is a question title or substring, match against active_polls
            if poll_id and active_polls:
                for p in active_polls:
                    p_id = str(p.get("id", ""))
                    p_title = str(p.get("title", "")).lower()
                    poll_str = str(poll_id).lower()
                    if p_id == str(poll_id) or poll_str in p_title or p_title in poll_str:
                        poll_id = p.get("id")
                        break

            if poll_id and poll_opt and resident:
                try:
                    vote_res = db_service.cast_vote(poll_id, resident.get("id"), poll_opt)
                    if vote_res and vote_res.get("status") == "already_voted":
                        prev_opt = vote_res.get("existing_option")
                        reply_text = (
                            f"Aap pehle hi is poll mein vote darj kar chuke hain (*{prev_opt}* ke liye). "
                            "Ek unit se sirf ek vote ki ijazat hai. Shukriya!\n\n"
                            f"_(You have already cast your vote for *{prev_opt}*. Multiple votes are not permitted per unit.)_"
                        )
                except Exception as e:
                    logger.error(f"Error casting poll vote: {e}")

            res_payload = {
                "status": "success",
                "intent": "poll_vote",
                "reply_text": reply_text
            }
            return self._dispatch_response(res_payload, resident, message_text)

        # Default Action: Conversational Reply
        res_payload = {
            "status": "success",
            "intent": "conversational",
            "reply_text": reply_text or "Hello! How can I assist you with Lakeview society operations today?"
        }
        return self._dispatch_response(res_payload, resident, message_text)

gemini_engine = GeminiEngine()
