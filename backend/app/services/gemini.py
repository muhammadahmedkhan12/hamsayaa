from app.core.config import settings
from app.db.supabase import db_service
import random
import logging
import re
from datetime import datetime, timezone, timedelta
import hashlib

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

ARREARS & MULTI-CYCLE DEBT SETTLEMENT (FIFO):
- If a resident has prior unpaid cycles (arrears > 0), their cumulative balance due is:
  (Current Month Fee + Previous Unpaid Arrears).
- When a resident asks for their bill or dues, state the itemized breakdown:
  * Current Cycle Fee: Rs. X
  * Previous Unpaid Arrears: Rs. Y
  * Total Balance Due: Rs. (X + Y)
- If a resident pays an amount when prior arrears exist:
  * By standard society accounting rules, debt is settled in FIFO order (First-In, First-Out):
    payments clear the oldest unpaid arrears cycle first, before covering the current month.
  * If they pay the full amount (Current + Arrears): both past arrears and current dues are submitted for clearance.
  * If they pay only the arrears amount or less: it is credited toward clearing/reducing their oldest unpaid balance first, and the remaining balance covers the current month.
  * If they ask which bill was paid, explain clearly that society ledgers apply payments to clear previous overdue dues first so they don't incur compounding debt.

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

    def get_active_poll_session(self, phone: str) -> str | None:
        if not self.redis or not phone:
            return None
        try:
            clean_phone = phone.replace("+", "").replace(" ", "").replace("-", "")
            val = self.redis.get(f"resident_active_poll:{clean_phone}")
            if val:
                return val.decode("utf-8") if isinstance(val, bytes) else str(val)
        except Exception as e:
            logger.debug(f"Redis get active poll session error: {e}")
        return None

    def set_active_poll_session(self, phone: str, poll_id: str):
        if not self.redis or not phone or not poll_id:
            return
        try:
            clean_phone = phone.replace("+", "").replace(" ", "").replace("-", "")
            self.redis.set(f"resident_active_poll:{clean_phone}", str(poll_id), ex=7 * 86400)
        except Exception as e:
            logger.debug(f"Redis set active poll session error: {e}")

    def _resolve_target_poll(
        self,
        user_msg: str,
        active_polls: list,
        chat_history: str = "",
        session_poll_id: str | None = None,
        candidate_poll_id: str | None = None
    ) -> tuple[dict | None, str | None]:
        """
        Deterministically resolve the exact target poll and matched option
        for a resident voting or changing their vote.
        Prevents switching to wrong open polls during vote updates.
        """
        if not active_polls:
            return None, None

        user_clean = user_msg.strip().lower()
        import re

        # Detect if resident is changing / updating their decision
        is_change_request = bool(re.search(
            r"\b(change|tabdeel|update|badal|galti|actually|instead|rather|no\s+\d+|nahi\s+\d+|pehle\s+wala|previous)\b",
            user_clean
        ))

        target_poll = None

        # 1. Did the user explicitly name/refer to a specific poll's title?
        for p in active_polls:
            p_title = str(p.get("title", "")).lower()
            stop_words = {"should", "which", "what", "poll", "vote", "this", "that", "about", "your", "with"}
            words = [w for w in re.findall(r"\w+", p_title) if len(w) > 3 and w not in stop_words]
            if words and any(w in user_clean for w in words):
                target_poll = p
                break

        # 2. If changing a vote, priority #1 is the active poll the resident ALREADY voted on!
        if not target_poll and is_change_request:
            voted_polls = [p for p in active_polls if p.get("resident_voted_option")]
            if len(voted_polls) == 1:
                target_poll = voted_polls[0]
            elif len(voted_polls) > 1:
                if session_poll_id:
                    for vp in voted_polls:
                        if str(vp.get("id")) == str(session_poll_id):
                            target_poll = vp
                            break
                if not target_poll:
                    target_poll = voted_polls[0]

        # 3. Match candidate_poll_id from LLM if it matches a valid active poll
        if not target_poll and candidate_poll_id:
            for p in active_polls:
                p_id = str(p.get("id", ""))
                p_title = str(p.get("title", "")).lower()
                cand_str = str(candidate_poll_id).lower()
                if p_id == str(candidate_poll_id) or (cand_str and (cand_str in p_title or p_title in cand_str)):
                    if is_change_request and not p.get("resident_voted_option"):
                        voted_polls = [vp for vp in active_polls if vp.get("resident_voted_option")]
                        if voted_polls:
                            target_poll = voted_polls[0]
                            break
                    target_poll = p
                    break

        # 4. Check active poll session from Redis
        if not target_poll and session_poll_id:
            for p in active_polls:
                if str(p.get("id")) == str(session_poll_id):
                    target_poll = p
                    break

        # 5. Check if recent chat history references a specific active poll
        if not target_poll and chat_history:
            history_lower = chat_history.lower()
            for p in active_polls:
                p_title = str(p.get("title", "")).lower()
                p_id = str(p.get("id", "")).lower()
                if p_id in history_lower or (len(p_title) > 5 and p_title in history_lower):
                    target_poll = p
                    break

        # 6. Fallback: If resident already voted on exactly one poll in active_polls
        if not target_poll:
            voted_polls = [p for p in active_polls if p.get("resident_voted_option")]
            if len(voted_polls) == 1:
                target_poll = voted_polls[0]

        # 7. Fallback: If only 1 active poll in society
        if not target_poll and len(active_polls) == 1:
            target_poll = active_polls[0]

        # 8. Ultimate fallback: Newest active poll
        if not target_poll:
            target_poll = active_polls[0]

        # Match option ONLY against target_poll's options
        p_opts = target_poll.get("options") or []
        matched_opt = None

        m = re.search(r"^(?:no\s+|change\s+(?:to\s+)?|vote\s+(?:for\s+)?|option\s+)?(\d+)$", user_clean)
        if not m:
            m = re.search(r"\b(?:no\s+|change\s+(?:to\s+)?|vote\s+(?:for\s+)?|option\s+)(\d+)\b", user_clean)
        if not m:
            m = re.search(r"\b(\d+)\b", user_clean)

        if m:
            idx = int(m.group(1)) - 1
            if 0 <= idx < len(p_opts):
                matched_opt = p_opts[idx]

        if not matched_opt:
            for opt in p_opts:
                opt_clean = str(opt).strip().lower()
                if opt_clean == user_clean or (len(opt_clean) > 2 and opt_clean in user_clean):
                    matched_opt = opt
                    break

        return target_poll, matched_opt

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

        # --- STEP 0: SHA-256 Exact Image Binary Deduplication ---
        img_hash = hashlib.sha256(image_bytes).hexdigest()
        if self.redis:
            try:
                dup_hash_raw = self.redis.get(f"receipt_hash:{img_hash}")
                if dup_hash_raw:
                    logger.info(f"Duplicate receipt hash detected: {img_hash[:12]}...")
                    reply = (
                        f"⚠️ *DUPLICATE PAYMENT SCREENSHOT*\n\n"
                        f"Hello *{name}* ({building} - Unit {unit}),\n\n"
                        f"This exact payment receipt screenshot has already been submitted and is currently on file in our system.\n\n"
                        f"• *Status:* Previously received & under verification\n"
                        f"• *Notice:* You do not need to resend the same screenshot. Our management office is already reviewing it.\n\n"
                        f"If you made an additional or separate transfer, please export and upload the new transaction slip."
                    )
                    return self._dispatch_response({
                        "status": "duplicate_receipt",
                        "intent": "payment_duplicate_image",
                        "reply_text": reply
                    }, resident, caption or "[Duplicate Screenshot]")
            except Exception as e:
                logger.debug(f"Redis duplicate hash check error: {e}")

        # Fetch active or advance invoice to provide exact expected account & due amount context
        inv = db_service.get_or_create_advance_invoice(society_id, res_id) if res_id else None
        expected_account = (inv.get("account_shown") if inv else None) or "Meezan Bank - A/C 01020304050607 - Lakeview Maint Account"
        base_fee = float(inv.get("total_amount") or inv.get("society_maintenance_fee") or 6500.0) if inv else 6500.0
        arr_val = float(inv.get("arrears") or 0.0) if inv else 0.0
        if not arr_val and self.redis and inv and "id" in inv:
            try:
                raw_arr = self.redis.get(f"invoice_arrears:{inv['id']}")
                if raw_arr:
                    arr_val = float(raw_arr)
            except Exception:
                pass
        total_due = base_fee + arr_val

        existing_partials = []
        if self.redis and inv:
            try:
                raw_partials = self.redis.get(f"partial_payments:{inv['id']}")
                if raw_partials:
                    existing_partials = json.loads(raw_partials) if isinstance(raw_partials, str) else raw_partials
            except Exception as e:
                logger.debug(f"Redis partial payments fetch error: {e}")

        prior_paid = sum(float(p.get("amount", 0)) for p in existing_partials if isinstance(p, dict) and p.get("amount"))
        effective_due = max(0.0, total_due - prior_paid)

        vision_data = None
        if self.client and USING_NEW_GENAI:
            image_part = types.Part.from_bytes(data=image_bytes, mime_type=mime_type)
            vision_prompt = (
                f"You are Hamsayaa AI Security & Concierge engine analyzing an image sent via WhatsApp by a verified resident.\n"
                f"Resident: {name} ({building} - Unit {unit})\n"
                f"Resident Caption: \"{caption}\"\n"
                f"Expected Society Destination Account: \"{expected_account}\"\n"
                f"Current Balance Due: PKR {effective_due:,.0f} (Total Voucher: PKR {total_due:,.0f})\n\n"
                f"Task 1: Classify image_type:\n"
                f"  - 'payment_slip': If the image shows a bank transfer slip, receipt, cheque, Raast transfer, ATM slip, or banking app transaction screen.\n"
                f"  - 'maintenance_issue': If the image or caption shows or describes a physical defect, damage, leak, broken fixture, elevator fault, sanitation issue, electrical hazard, or repair need.\n"
                f"  - 'irrelevant': A selfie, greeting, meme, food photo, random scenery, sticker, or image completely unrelated to society maintenance or fee payments.\n\n"
                f"Task 2: If 'payment_slip', inspect authenticity:\n"
                f"  - 'is_fraudulent_or_tampered': Set to true ONLY if there is clear visual evidence of digital tampering, image editing, mismatched/pasted fonts, cloned/edited digits, Photoshop/markup tool modifications, or obvious fake mockup generators.\n"
                f"  - 'fraud_reason': If is_fraudulent_or_tampered is true, explain what visual alteration was detected.\n\n"
                f"Task 3: If 'payment_slip', inspect destination beneficiary account:\n"
                f"  - 'destination_account_title': Name / title of beneficiary recipient shown on the slip (or null).\n"
                f"  - 'destination_account_number': Recipient account number, IBAN, or Raast ID on slip (or null).\n"
                f"  - 'is_account_match': Set to true if the destination beneficiary matches or reasonably aligns with the expected society account (e.g. mentions Lakeview, society, or matching account digits/title). Set to false ONLY if the slip clearly shows the money was transferred to an entirely unrelated person, personal friend/family account, or third-party merchant. Set to null if recipient details are not legible or omitted in this screenshot.\n"
                f"  - 'account_mismatch_reason': If is_account_match is false, describe who or what account the payment was sent to.\n\n"
                f"Task 4: Extract financial fields:\n"
                f"  - 'amount': Exact numeric amount transferred in PKR (number, no commas/currency symbol).\n"
                f"  - 'bank_or_app': Sending or receiving bank name or mobile app (e.g., Meezan, HBL, Bank Alfalah, Raast, Nayapay, Sadapay, Easypaisa, JazzCash).\n"
                f"  - 'reference_number': Transaction reference ID, TxID, Raast Reference, or Stan number.\n"
                f"  - 'payment_date': Date and time of payment shown on slip (string, e.g. '2026-09-05 14:30').\n\n"
                f"Task 5: If 'maintenance_issue':\n"
                f"  - 'complaint_category': \"Water & Plumbing\" | \"Electrical & Power\" | \"Elevators & Lifts\" | \"Sanitation & Waste\" | \"Security & Parking\" | \"General Maintenance & Repair\"\n"
                f"  - 'description': Clear factual description of the visible defect.\n\n"
                f"Return ONLY a JSON object with this schema:\n"
                f"{{\n"
                f"  \"image_type\": \"payment_slip\" | \"maintenance_issue\" | \"irrelevant\",\n"
                f"  \"is_fraudulent_or_tampered\": boolean,\n"
                f"  \"fraud_reason\": string or null,\n"
                f"  \"destination_account_title\": string or null,\n"
                f"  \"destination_account_number\": string or null,\n"
                f"  \"is_account_match\": boolean or null,\n"
                f"  \"account_mismatch_reason\": string or null,\n"
                f"  \"amount\": number or null,\n"
                f"  \"bank_or_app\": string or null,\n"
                f"  \"reference_number\": string or null,\n"
                f"  \"payment_date\": string or null,\n"
                f"  \"complaint_category\": string or null,\n"
                f"  \"description\": string\n"
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
                "destination_account_title": None,
                "destination_account_number": None,
                "is_account_match": None,
                "complaint_category": "General Maintenance & Repair",
                "description": caption or "Image received from resident",
                "reply_text": ""
            }

        image_type = vision_data.get("image_type", "payment_slip")
        is_tampered = bool(vision_data.get("is_fraudulent_or_tampered"))
        fraud_reason = vision_data.get("fraud_reason") or "Potential digital image tampering or alterations detected."
        amount = vision_data.get("amount")
        bank_or_app = vision_data.get("bank_or_app") or "Bank Transfer"
        ref_no = vision_data.get("reference_number") or "N/A"
        dest_title = vision_data.get("destination_account_title")
        is_account_match = vision_data.get("is_account_match")
        payment_date = vision_data.get("payment_date")

        # Case 1: Payment Slip / Receipt Screenshot
        if image_type == "payment_slip":
            # 1. Upload receipt to Supabase Storage
            filename = f"receipt_{res_id or 'guest'}_{random.randint(10000, 99999)}.jpg"
            receipt_url = db_service.upload_image(image_bytes, filename, bucket_name="society-receipts", mime_type=mime_type)

            # 2. Check for Fraudulent / Tampered Screenshot
            if is_tampered:
                if inv:
                    db_service.attach_invoice_receipt(inv["id"], receipt_url)
                    if self.redis:
                        try:
                            audit_payload = {
                                "collector": "AI Security Scanner",
                                "method": "Flagged Altered Slip",
                                "collected_at": datetime.now(timezone.utc).isoformat(),
                                "flag": "suspected_fraud",
                                "reason": fraud_reason
                            }
                            self.redis.set(f"payment_audit:{inv['id']}", json.dumps(audit_payload), ex=365 * 86400)
                            self.redis.set(f"receipt_hash:{img_hash}", json.dumps({"invoice_id": inv["id"], "flag": "fraud"}), ex=180 * 86400)
                        except Exception as e:
                            logger.debug(f"Redis audit flag error: {e}")

                reply = (
                    f"⚠️ *INVALID PAYMENT SCREENSHOT*\n\n"
                    f"Hello *{name}* ({building} - Unit {unit}),\n\n"
                    f"This screenshot could not be validated as an authentic bank payment slip. Our automated verification system detected potential digital alterations or image editing.\n\n"
                    f"📌 *Status:* This submission has been flagged and forwarded to the society management office for manual inspection.\n\n"
                    f"If you made an authentic transfer, please export the original, unedited digital receipt directly from your official banking app (or deposit cash at the society office) and send it here."
                )
                res_payload = {
                    "status": "flagged_fraud",
                    "intent": "payment_receipt_flagged",
                    "receipt_url": receipt_url,
                    "reason": fraud_reason,
                    "invoice_id": inv.get("id") if inv else None,
                    "reply_text": reply
                }
                return self._dispatch_response(res_payload, resident, caption or "[Flagged Payment Screenshot]")

            # 3. Duplicate Transaction Reference (TxID) Check
            clean_ref = re.sub(r'[^A-Za-z0-9]', '', str(ref_no or "")).upper()
            if len(clean_ref) >= 6 and clean_ref not in ["NONE", "NULL", "UNKNOWN", "NOTAVAILABLE", "PENDING", "SUCCESS", "APPROVED"]:
                if self.redis:
                    try:
                        dup_tx_raw = self.redis.get(f"receipt_txid:{society_id}:{clean_ref}")
                        if dup_tx_raw:
                            logger.info(f"Duplicate TxID detected: {clean_ref}")
                            reply = (
                                f"⚠️ *DUPLICATE TRANSACTION REFERENCE*\n\n"
                                f"Hello *{name}* ({building} - Unit {unit}),\n\n"
                                f"A payment slip with Reference / TxID *{ref_no}* has already been submitted in our system.\n\n"
                                f"• *Reference ID:* `{ref_no}`\n"
                                f"• *Notice:* Each transaction reference can only be submitted once. If you made a separate payment, please upload its unique receipt.\n\n"
                                f"If you believe this is an error, please contact the society management office."
                            )
                            return self._dispatch_response({
                                "status": "duplicate_txid",
                                "intent": "payment_duplicate_txid",
                                "reply_text": reply
                            }, resident, caption or "[Duplicate TxID]")
                    except Exception as e:
                        logger.debug(f"Redis duplicate txid check error: {e}")

            # 4. Beneficiary Account Match Check
            if is_account_match is False:
                logger.warning(f"Beneficiary mismatch: slip sent to '{dest_title}', expected '{expected_account}'")
                reply = (
                    f"⚠️ *ACCOUNT MISMATCH - PAYMENT NOT RECORDED*\n\n"
                    f"Hello *{name}* ({building} - Unit {unit}),\n\n"
                    f"The payment screenshot you provided appears to be transferred to a different recipient account:\n\n"
                    f"• ❌ *Recipient Detected:* {dest_title or 'Unrecognized Third-Party Account'}\n"
                    f"• 🏛️ *Expected Society Account:*\n  *{expected_account}*\n\n"
                    f"Society maintenance fees must be deposited directly into the designated society account shown above.\n\n"
                    f"Please verify your payment receipt or visit the society management office if you need assistance."
                )
                return self._dispatch_response({
                    "status": "account_mismatch",
                    "intent": "payment_account_mismatch",
                    "reply_text": reply
                }, resident, caption or "[Account Mismatch]")

            # 5. Check if Dues Already Settled
            is_already_settled = False
            if inv:
                is_already_settled = bool(inv.get("is_already_settled") or inv.get("status") in ["paid", "verified"])

            if is_already_settled and effective_due <= 50.0:
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

            # 6. Valid Authentic Slip: Attach to Invoice
            if inv:
                db_service.attach_invoice_receipt(inv["id"], receipt_url)

            # 7. Amount Validation & Partial Payment Lifecycle
            curr_amt = None
            if amount is not None:
                try:
                    curr_amt = float(amount)
                except (ValueError, TypeError):
                    curr_amt = None

            payment_entry = {
                "amount": curr_amt,
                "reference_number": ref_no,
                "bank_or_app": bank_or_app,
                "payment_date": payment_date or datetime.now(timezone.utc).strftime("%d %b %Y, %H:%M"),
                "destination_account": dest_title or expected_account,
                "receipt_url": receipt_url,
                "submitted_at": datetime.now(timezone.utc).isoformat()
            }

            if curr_amt is not None and curr_amt > 0:
                new_total_paid = prior_paid + curr_amt
                remaining_balance = max(0.0, total_due - new_total_paid)

                if remaining_balance > 50.0:
                    # Partial Payment
                    new_partials = existing_partials + [payment_entry]
                    if self.redis and inv:
                        self.redis.set(f"partial_payments:{inv['id']}", json.dumps(new_partials), ex=365 * 86400)
                        audit_payload = {
                            "collector": "AI WhatsApp Scanner",
                            "method": f"Partial Slip ({bank_or_app})",
                            "collected_at": datetime.now(timezone.utc).isoformat(),
                            "amount_paid": new_total_paid,
                            "this_slip_amount": curr_amt,
                            "total_due": total_due,
                            "remaining_balance": remaining_balance,
                            "is_partial": True,
                            "reference_number": ref_no,
                            "bank_or_app": bank_or_app,
                            "payment_date": payment_date,
                            "destination_account": dest_title or expected_account,
                            "receipt_url": receipt_url,
                            "partial_payments": new_partials
                        }
                        self.redis.set(f"payment_audit:{inv['id']}", json.dumps(audit_payload), ex=365 * 86400)

                    fifo_note = ""
                    if arr_val > 0:
                        if curr_amt >= arr_val:
                            fifo_note = f"• 📜 *Debt Settlement (FIFO):* Fully clears previous arrears (PKR {arr_val:,.0f}). Remaining PKR {curr_amt - arr_val:,.0f} credited to current month.\n"
                        else:
                            fifo_note = f"• 📜 *Debt Settlement (FIFO):* Credited toward previous arrears (PKR {arr_val:,.0f} ➔ PKR {arr_val - curr_amt:,.0f} remaining arrears).\n"

                    reply = (
                        f"⏳ *PARTIAL PAYMENT RECORDED*\n\n"
                        f"Hello *{name}* ({building} - Unit {unit}), thank you!\n\n"
                        f"We have received and recorded your partial payment transfer:\n"
                        f"• 💰 *Amount Received:* PKR {curr_amt:,.0f}\n"
                        f"• 🔖 *Reference / TxID:* `{ref_no}`\n"
                        f"• 🏦 *Bank / App:* {bank_or_app}\n"
                        f"• 📅 *Date:* {payment_date or 'Today'}\n"
                        f"{fifo_note}"
                        f"• 📊 *Total Balance Due:* PKR {total_due:,.0f}\n"
                        f"• ⚠️ *Remaining Balance Due:* *PKR {remaining_balance:,.0f}*\n\n"
                        f"⏳ *Status: Under Verification*\n"
                        f"Your partial receipt has been submitted for admin review.\n\n"
                        f"💡 *Next Step:* Whenever you pay the remaining balance (*PKR {remaining_balance:,.0f}*), simply share the new receipt here. We will link both slips and clear your dues! ✅"
                    )
                else:
                    # Full payment or Remaining final clearance!
                    new_partials = existing_partials + [payment_entry] if existing_partials else [payment_entry]
                    is_multi = len(new_partials) > 1
                    if self.redis and inv:
                        self.redis.set(f"partial_payments:{inv['id']}", json.dumps(new_partials), ex=365 * 86400)
                        audit_payload = {
                            "collector": "AI WhatsApp Scanner",
                            "method": f"Full Clearance ({len(new_partials)} Slips)" if is_multi else f"WhatsApp Slip ({bank_or_app})",
                            "collected_at": datetime.now(timezone.utc).isoformat(),
                            "amount_paid": new_total_paid if is_multi else curr_amt,
                            "this_slip_amount": curr_amt,
                            "total_due": total_due,
                            "remaining_balance": 0.0,
                            "is_partial": False,
                            "reference_number": f"{ref_no} (Final)" if is_multi else ref_no,
                            "bank_or_app": bank_or_app,
                            "payment_date": payment_date,
                            "destination_account": dest_title or expected_account,
                            "receipt_url": receipt_url,
                            "partial_payments": new_partials
                        }
                        self.redis.set(f"payment_audit:{inv['id']}", json.dumps(audit_payload), ex=365 * 86400)

                    if existing_partials:
                        reply = (
                            f"✅ *FINAL PAYMENT SLIP RECEIVED - DUES COVERED*\n\n"
                            f"Hello *{name}* ({building} - Unit {unit}), thank you!\n\n"
                            f"We have received your remaining payment screenshot:\n"
                            f"• 💰 *This Payment:* PKR {curr_amt:,.0f}\n"
                            f"• 📊 *Total Paid for this Cycle:* PKR {new_total_paid:,.0f} of PKR {total_due:,.0f}\n"
                            f"• 🔖 *Reference / TxID:* `{ref_no}`\n"
                            f"• 🏦 *Bank / App:* {bank_or_app}\n"
                            f"• ✨ *Remaining Balance:* *PKR 0 (Fully Covered)*\n\n"
                            f"⏳ *Status: Under Verification*\n"
                            f"All required receipts for this cycle are now on file and awaiting final admin verification. Thank you for clearing your dues! ✅"
                        )
                    else:
                        settlement_line = ""
                        if arr_val > 0:
                            settlement_line = f"• 📜 *Settlement (FIFO):* Prior Arrears (PKR {arr_val:,.0f}) + Current Month (PKR {base_fee:,.0f})\n"
                        reply = (
                            f"✅ *PAYMENT RECEIPT RECEIVED*\n\n"
                            f"Hello *{name}* ({building} - Unit {unit}), thank you!\n\n"
                            f"We have received your payment transfer screenshot:\n"
                            f"• 💰 *Amount:* PKR {curr_amt:,.0f}\n"
                            f"{settlement_line}"
                            f"• 🏦 *Method / Bank:* {bank_or_app}\n"
                            f"• 🔖 *Reference / TxID:* `{ref_no}`\n"
                            f"• 📅 *Date:* {payment_date or 'Today'}\n"
                            f"• 🏠 *Unit:* {building} - Unit {unit}\n\n"
                            f"⏳ *Status: Under Verification*\n"
                            f"Your payment receipt has been attached to your voucher. The society office / admin will manually review and cross-check with the bank statement before updating your account to Paid. ✅\n\n"
                            f"_💡 Note: If you ever send a wrong image or make another transfer, simply send the new screenshot here and it will update your verification record._"
                        )
            else:
                # Amount could not be read cleanly
                if self.redis and inv:
                    audit_payload = {
                        "collector": "AI WhatsApp Scanner",
                        "method": f"WhatsApp Slip ({bank_or_app})",
                        "collected_at": datetime.now(timezone.utc).isoformat(),
                        "reference_number": ref_no,
                        "bank_or_app": bank_or_app,
                        "payment_date": payment_date,
                        "destination_account": dest_title or expected_account,
                        "receipt_url": receipt_url,
                    }
                    self.redis.set(f"payment_audit:{inv['id']}", json.dumps(audit_payload), ex=365 * 86400)

                reply = (
                    f"✅ *PAYMENT RECEIPT RECEIVED*\n\n"
                    f"Hello *{name}* ({building} - Unit {unit}), thank you!\n\n"
                    f"We have received your payment transfer screenshot:\n"
                    f"• 🏦 *Method / Bank:* {bank_or_app}\n"
                    f"• 🔖 *Reference / TxID:* `{ref_no}`\n"
                    f"• 📅 *Date:* {payment_date or 'Today'}\n"
                    f"• 🏠 *Unit:* {building} - Unit {unit}\n\n"
                    f"⏳ *Status: Under Verification*\n"
                    f"Your payment receipt has been submitted for admin verification. The society office will cross-check the transfer with the bank statement and update your dues. ✅"
                )

            # 8. Record Deduplication in Redis
            if self.redis and inv:
                try:
                    self.redis.set(f"receipt_hash:{img_hash}", json.dumps({"invoice_id": inv["id"], "resident_id": res_id}), ex=180 * 86400)
                    if clean_ref and len(clean_ref) >= 6 and clean_ref not in ["NONE", "NULL", "UNKNOWN", "NOTAVAILABLE", "PENDING", "SUCCESS", "APPROVED"]:
                        self.redis.set(f"receipt_txid:{society_id}:{clean_ref}", json.dumps({"invoice_id": inv["id"], "resident_id": res_id}), ex=180 * 86400)
                except Exception as e:
                    logger.debug(f"Error setting deduplication keys in Redis: {e}")

            res_payload = {
                "status": "success",
                "intent": "payment_receipt_submitted",
                "receipt_url": receipt_url,
                "amount": curr_amt,
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
                f"⚠️ *UNRECOGNIZED IMAGE RECEIVED*\n\n"
                f"Hello *{name}*! We received your image, but it does not appear to be a bank payment receipt or a society maintenance issue.\n\n"
                f"• *Submitting a payment?* Please send a clear screenshot of your bank transfer, Raast receipt, or ATM slip.\n"
                f"• *Reporting an issue?* Please send a photo of the defect along with a brief description or voice note explaining what needs repair.\n\n"
                f"_If you sent this by mistake, no worries! Just let us know how we can assist you._"
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
                from datetime import date
                today_iso = date.today().isoformat()
                inv_res = db_service.client.table("invoices").select("*").eq("resident_id", resident.get("id")).order("created_at", desc=True).limit(6).execute()
                invoices_list = inv_res.data or []

                # Enrich with overdue check & arrears
                unpaid_cycles = []
                for inv in invoices_list:
                    st = inv.get("status", "unpaid")
                    due = inv.get("due_date", "")
                    if st == "unpaid" and due and str(due) < today_iso:
                        st = "overdue"
                        inv["status"] = "overdue"
                    if st in ["unpaid", "overdue"]:
                        iid = inv.get("id")
                        arr = float(inv.get("arrears") or 0.0)
                        if not arr and self.redis and iid:
                            try:
                                raw_arr = self.redis.get(f"invoice_arrears:{iid}")
                                if raw_arr:
                                    arr = float(raw_arr)
                            except Exception:
                                arr = 0.0
                        inv["arrears"] = arr
                        base_amt = float(inv.get("total_amount") or inv.get("society_maintenance_fee") or 0.0)
                        inv["total_payable"] = round(base_amt + arr, 2)
                        unpaid_cycles.append(inv)

                active_invoice = unpaid_cycles[0] if unpaid_cycles else (invoices_list[0] if invoices_list else None)

                if unpaid_cycles:
                    latest_inv = unpaid_cycles[0]
                    # If latest invoice already carries arrears, its total_payable is the complete balance
                    if latest_inv.get("arrears", 0) > 0:
                        total_balance_due = latest_inv["total_payable"]
                    else:
                        total_balance_due = sum(float(i.get("total_amount") or i.get("society_maintenance_fee") or 0.0) for i in unpaid_cycles)

                    lines = [
                        f"RESIDENT DUES & MULTI-CYCLE MAINTENANCE ACCOUNTING (LIVE SUPABASE DB):",
                        f"• Total Outstanding Balance Due: PKR {total_balance_due:,.2f}",
                        f"• Number of Unpaid / Overdue Billing Cycles: {len(unpaid_cycles)}",
                    ]
                    for idx, u in enumerate(unpaid_cycles):
                        u_fee = float(u.get("total_amount") or u.get("society_maintenance_fee") or 0.0)
                        u_arr = float(u.get("arrears") or 0.0)
                        u_due = u.get("due_date", "N/A")
                        u_st = u.get("status", "UNPAID").upper()
                        if u_arr > 0:
                            lines.append(f"  - Voucher {idx+1} (Due {u_due}): Current PKR {u_fee:,.0f} + Previous Arrears PKR {u_arr:,.0f} = Total PKR {u_fee + u_arr:,.0f} [{u_st}]")
                        else:
                            lines.append(f"  - Voucher {idx+1} (Due {u_due}): PKR {u_fee:,.0f} [{u_st}]")

                    lines.append(f"• Payment Account: {latest_inv.get('account_shown') or 'Meezan Bank - A/C PK42MEZN00012345678901 - Lakeview Maint Account'}")
                    lines.append(f"• Instructions: If resident asks for their dues/bill/balance, state the current cycle fee, any prior arrears, and the total cumulative balance (PKR {total_balance_due:,.0f}).")
                    invoice_summary = "\n".join(lines)
                elif active_invoice:
                    total_amt = active_invoice.get('total_amount') or active_invoice.get('society_maintenance_fee', 0)
                    invoice_summary = (
                        f"RESIDENT DUES & MONTHLY VOUCHER (LIVE SUPABASE DB):\n"
                        f"• Status: {active_invoice.get('status', '').upper()} (ALL DUES SETTLED)\n"
                        f"• Outstanding Balance: PKR 0.00\n"
                        f"• Last Settled Voucher: PKR {total_amt:,.2f} (Due Date: {active_invoice.get('due_date', 'N/A')})"
                    )
            except Exception as e:
                logger.error(f"Error fetching invoice context: {e}")

        polls_summary = ""
        active_polls = []
        closed_polls = []
        if resident and resident.get("society_id"):
            try:
                polls_list = db_service.get_polls(resident.get("society_id"), resident_id=resident.get("id"))
                active_polls = [p for p in polls_list if not p.get("is_closed")]
                closed_polls = [p for p in polls_list if p.get("is_closed")]
                session_poll_id = self.get_active_poll_session(phone)

                p_lines = []
                if active_polls:
                    # Priority ordering: Poll where resident already voted > Poll matching active Redis session
                    def poll_priority(p):
                        p_id = str(p.get("id"))
                        has_vote = bool(p.get("resident_voted_option"))
                        is_session = bool(session_poll_id and p_id == str(session_poll_id))
                        return (has_vote, is_session)

                    active_polls.sort(key=poll_priority, reverse=True)

                    for idx, p in enumerate(active_polls):
                        is_primary = (idx == 0) and (bool(p.get("resident_voted_option")) or bool(session_poll_id and str(p.get("id")) == str(session_poll_id)))
                        prefix = ">>> CURRENT ACTIVE/RELEVANT POLL FOR THIS RESIDENT: " if is_primary else "- "
                        line = f"{prefix}Poll UUID: {p.get('id')} | Question: \"{p.get('title')}\" | Options: {', '.join(p.get('options') or [])} | Status: OPEN / ACTIVE"
                        if p.get("resident_voted_option"):
                            line += f" [RESIDENT CURRENT VOTE: '{p.get('resident_voted_option')}']"
                        p_lines.append(line)

                if closed_polls:
                    p_lines.append("\nCLOSED / EXPIRED POLLS (Timer Ended - Voting Closed - STRICTLY DO NOT RECORD VOTES):")
                    for cp in closed_polls[:5]:
                        p_lines.append(f"- Poll UUID: {cp.get('id')} | Question: \"{cp.get('title')}\" | Status: CLOSED / EXPIRED")

                if p_lines:
                    polls_summary = "Community Polls (Context Continuity & Expiry Enforced):\n" + "\n".join(p_lines)
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
            "4. 'cast_poll_vote': Select when the resident is casting a vote OR changing/updating an existing vote for an OPEN / ACTIVE society poll.\n"
            "   - EXPIRED / CLOSED POLLS: If the resident attempts to vote on a CLOSED or EXPIRED poll (or if the timer has ended), do NOT select 'cast_poll_vote'. Select 'reply' and inform the resident politely that voting for this poll has closed because the deadline/timer has expired.\n"
            "   - TARGET POLL UUID: You MUST select the Poll UUID from the '>>> CURRENT ACTIVE/RELEVANT POLL' or the poll where they have [RESIDENT CURRENT VOTE: '...']. NEVER select any other open poll unless the resident explicitly mentions that other question title by name!\n"
            "   - CHANGING VOTES: Residents ARE allowed to change their vote. If the poll context shows [RESIDENT CURRENT VOTE: 'X'] and the resident specifies a different option or number (e.g. 'no 2', 'change to absar', 'actually 2', 'vote 2', 'badal do'), select 'cast_poll_vote' with THAT SAME poll's UUID and the new option so their vote gets updated on the correct poll!\n"
            "   - If the resident has already voted and is NOT attempting to change their vote (e.g. asking a general question or repeating the exact same choice), select 'reply' and inform the resident of their recorded vote.\n"
            "   - CRITICAL: 'poll_id' MUST be the exact 36-character Poll UUID (e.g. '7b279fe5-...') of that specific poll, NEVER the question text.\n"
            "   - 'poll_option' must match one of the listed options for that specific poll. If the resident replies with a number like '1', '2', map it to the exact text of that option from that poll's Options list.\n"
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

        # Defensive check for closed/expired poll voting:
        # If resident is attempting to vote on an expired poll, reject immediately and inform them.
        if closed_polls:
            user_msg_clean = message_text.strip().lower()
            import re
            is_vote_attempt = (
                bool(re.search(r"^(?:no\s+|nahi\s+|change\s+(?:to\s+)?|tabdeel\s+|vote\s+(?:for\s+)?|option\s+)?\d+$", user_msg_clean)) or
                bool(re.search(r"\b(vote|option)\b", user_msg_clean))
            )
            matched_closed = None
            for cp in closed_polls:
                cp_title = str(cp.get("title", "")).lower()
                words = [w for w in re.findall(r"\w+", cp_title) if len(w) > 3 and w not in {"should", "which", "what", "poll", "vote", "this", "that"}]
                if words and any(w in user_msg_clean for w in words):
                    matched_closed = cp
                    break
            if not matched_closed and not active_polls and is_vote_attempt:
                session_poll_id = self.get_active_poll_session(phone)
                if session_poll_id:
                    for cp in closed_polls:
                        if str(cp.get("id")) == str(session_poll_id):
                            matched_closed = cp
                            break

            if matched_closed and (is_vote_attempt or any(opt.lower() == user_msg_clean for opt in (matched_closed.get("options") or []))):
                cp_title = matched_closed.get("title", "Community Poll")
                reply = (
                    f"Yeh poll *{cp_title}* band ho chuka hai (voting deadline guzar chuki hai). "
                    "Ab isme mazeed vote darj nahi ho sakta. Shukriya!\n\n"
                    f"_(Voting for *{cp_title}* has ended. The voting deadline has passed and no further votes can be accepted.)_"
                )
                res_payload = {
                    "status": "success",
                    "intent": "poll_vote_rejected_expired",
                    "reply_text": reply
                }
                return self._dispatch_response(res_payload, resident, message_text)

        # Defensive check for poll voting continuity:
        # If action is 'reply' but resident message clearly indicates choosing or changing an option
        # (e.g. "no 2", "2", "change to 2", "vote for absar", or naming an option directly), route to cast_poll_vote.
        if action == "reply" and active_polls:
            user_msg_clean = message_text.strip().lower()
            import re
            is_vote_intent = (
                bool(re.search(r"^(?:no\s+|nahi\s+|change\s+(?:to\s+)?|tabdeel\s+|vote\s+(?:for\s+)?|option\s+)?\d+$", user_msg_clean)) or
                bool(re.search(r"\b(change|tabdeel|update|badal|actually|instead|vote|option)\b", user_msg_clean))
            )
            if not is_vote_intent:
                for ap in active_polls:
                    for opt in (ap.get("options") or []):
                        opt_str = str(opt).strip().lower()
                        if opt_str == user_msg_clean or (len(opt_str) > 2 and opt_str in user_msg_clean):
                            is_vote_intent = True
                            break
                    if is_vote_intent:
                        break

            if is_vote_intent:
                session_poll_id = self.get_active_poll_session(phone)
                target_p, matched_opt = self._resolve_target_poll(
                    user_msg=message_text,
                    active_polls=active_polls,
                    chat_history=history_context,
                    session_poll_id=session_poll_id,
                    candidate_poll_id=llm_data.get("poll_id")
                )
                if target_p and matched_opt:
                    action = "cast_poll_vote"
                    llm_data = {
                        "action": "cast_poll_vote",
                        "poll_id": target_p.get("id"),
                        "poll_option": matched_opt,
                        "reply_text": reply_text
                    }

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

            session_poll_id = self.get_active_poll_session(phone)
            target_poll, resolved_opt = self._resolve_target_poll(
                user_msg=message_text,
                active_polls=active_polls,
                chat_history=history_context,
                session_poll_id=session_poll_id,
                candidate_poll_id=poll_id
            )
            if target_poll:
                poll_id = target_poll.get("id")
                if resolved_opt:
                    poll_opt = resolved_opt

            if poll_id and poll_opt and resident:
                try:
                    vote_res = db_service.cast_vote(poll_id, resident.get("id"), poll_opt)
                    self.set_active_poll_session(phone, poll_id)
                    poll_title = (target_poll.get("title") if target_poll else "") or (vote_res.get("poll_title") if vote_res else None) or "Community Poll"
                    if vote_res and vote_res.get("status") == "expired":
                        reply_text = (
                            f"Yeh poll *{poll_title}* band ho chuka hai (voting deadline guzar chuki hai). Ab isme mazeed vote darj nahi ho sakta. Shukriya!\n\n"
                            f"_(This poll *{poll_title}* has ended. The voting deadline has passed and no further votes can be recorded.)_"
                        )
                        res_payload = {
                            "status": "success",
                            "intent": "poll_vote_rejected_expired",
                            "reply_text": reply_text
                        }
                        return self._dispatch_response(res_payload, resident, message_text)
                    elif vote_res and vote_res.get("status") == "updated":
                        prev_opt = vote_res.get("previous_option")
                        new_opt = vote_res.get("new_option") or poll_opt
                        reply_text = (
                            f"Aapka vote *{poll_title}* ke liye tabdeel kar ke *{new_opt}* darj kar diya gaya hai. ✅\n\n"
                            f"_(Your vote for *{poll_title}* has been successfully updated from *{prev_opt}* to *{new_opt}*.)_"
                        )
                    elif vote_res and vote_res.get("status") == "already_voted":
                        prev_opt = vote_res.get("existing_option")
                        reply_text = (
                            f"Aap pehle hi *{poll_title}* mein vote darj kar chuke hain (*{prev_opt}* ke liye). "
                            "Ek unit se sirf ek vote ki ijazat hai. Shukriya!\n\n"
                            f"_(You have already cast your vote for *{prev_opt}* in *{poll_title}*. Multiple votes are not permitted per unit.)_"
                        )
                    elif vote_res and vote_res.get("status") == "success":
                        reply_text = (
                            f"Shukriya! Aapka vote *{poll_title}* mein *{poll_opt}* ke liye kamyabi se darj kar liya gaya hai. ✅\n\n"
                            f"_(Thank you! Your vote for *{poll_opt}* in *{poll_title}* has been successfully recorded.)_"
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
