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
- When asked for a bill breakdown, show it itemized (maintenance fee +
  utility charges + Hamsayaa fee = total) — not just a lump total.
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
            try:
                audio_part = types.Part.from_bytes(data=audio_bytes, mime_type=mime_type)
                prompt = "Listen to this resident's voice note (which may be spoken in Urdu, Roman Urdu, or English). Transcribe the exact message clearly. Return ONLY the transcribed text message, nothing else."
                
                res = self.client.models.generate_content(
                    model=settings.GEMINI_MODEL,
                    contents=[audio_part, prompt]
                )
                if res and res.text:
                    transcribed_text = res.text.strip()
                    print(f"--> [Voice Note Transcribed]: '{transcribed_text}'")
            except Exception as e:
                logger.error(f"Error transcribing audio with Gemini: {e}")

        if not transcribed_text:
            transcribed_text = "Resident sent a voice note regarding maintenance issue."

        # Upload audio recording to Supabase Storage for permanent admin playback
        filename = f"{resident.get('id', 'guest')}_{random.randint(10000, 99999)}.ogg"
        audio_url = db_service.upload_voice_note(audio_bytes, filename)

        # Process transcribed message through full agentic memory pipeline
        res_payload = await self.process_resident_message(resident, transcribed_text)
        
        # Attach audio URL to payload if available
        if audio_url:
            res_payload["audio_url"] = audio_url

        return res_payload

    async def process_resident_message(
        self,
        resident: dict,
        message_text: str,
        failed_attempts: int = 0
    ) -> dict:
        """
        Processes inbound resident WhatsApp message through Gemini AI Engine with Upstash Redis memory.
        1. Context Hydration: Loads Upstash conversation memory and active complaints from Supabase.
        2. Off-Topic Guardrail: Rejects unrelated spam politely without writing to database.
        3. Resident Ticket Closure: Allows members to close any of their open complaints on demand.
        4. Visitor Pass Issuance: Generates gated visitor access passes with parameter validation.
        5. New Complaint & Smart Duplicate Matching: Evaluates issues, links duplicate community complaints to existing ticket, logs new tickets.
        6. Conversational AI Reasoning: Powered by Gemini 2.0 Flash for questions, follow-ups, and community interactions.
        """
        text_lower = message_text.lower().strip()
        phone = resident.get("phone_number", "") if resident else ""
        name = resident.get("name", "Resident") if resident else "Resident"
        building = resident.get("building", "Block A") if resident else "Block A"
        unit = resident.get("unit_number", "101") if resident else "101"

        # 1. Load Upstash Redis Chat Memory & Active DB Tickets Context
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

        # 2. ACTION: Off-Topic Guardrail (NO DATABASE WRITES!)
        off_topic_keywords = ["weather", "joke", "politics", "president", "crypto", "bitcoin", "stock market", "buy car", "sell car"]
        if any(w in text_lower for w in off_topic_keywords):
            res_payload = {
                "status": "flagged_irrelevant",
                "reply_text": f"Hello {name}, I am your Hamsayaa Society Concierge. I am dedicated to helping you with society operations (complaints, visitor passes, maintenance dues, amenities, and community polls)."
            }
            return self._dispatch_response(res_payload, resident, message_text)

        # 3. ACTION: Resident-Led Complaint Closure / Cancellation Flow
        tck_match = re.search(r'TCK-\d{4}', message_text, re.IGNORECASE)
        closure_keywords = [
            "close complaint", "cancel complaint", "close ticket", "cancel ticket",
            "close my complaint", "cancel my complaint", "close my ticket", "cancel my ticket",
            "close my", "cancel my", "resolve my", "fixed now", "issue is fixed",
            "issue is resolved", "problem is resolved", "resolved on its own",
            "already fixed", "never mind", "problem solved", "fixed it",
            "cancel it", "close it", "mark resolved"
        ]
        has_closure_intent = any(kw in text_lower for kw in closure_keywords) or (
            any(w in text_lower for w in ["close", "cancel", "resolved", "solved"])
            and any(w in text_lower for w in ["complaint", "ticket", "issue"])
        )

        if has_closure_intent or (tck_match and any(w in text_lower for w in ["close", "cancel", "resolve", "resolved", "fixed"])):
            if tck_match:
                target_tck_num = tck_match.group(0).upper()
                target_ticket = next((t for t in open_tickets if t.get("ticket_number") == target_tck_num), None)
                
                # If not in the resident's recent cache, do a fresh query for this resident
                if not target_ticket and resident and db_service.client:
                    try:
                        q_res = db_service.client.table("complaints").select("*").eq("resident_id", resident.get("id")).eq("ticket_number", target_tck_num).in_("status", ["open", "in_progress", "needs_human_review"]).execute()
                        if q_res.data:
                            target_ticket = q_res.data[0]
                    except Exception as e:
                        logger.error(f"Error checking specific ticket for closure: {e}")

                if target_ticket:
                    if db_service.client:
                        try:
                            db_service.client.table("complaints").update({"status": "resolved"}).eq("id", target_ticket.get("id")).execute()
                        except Exception as e:
                            logger.error(f"Error closing complaint in database: {e}")
                    
                    res_payload = {
                        "status": "success",
                        "intent": "complaint_closed",
                        "ticket_number": target_tck_num,
                        "reply_text": (
                            f"✅ *COMPLAINT CLOSED*\n\n"
                            f"Hello {name}, your complaint has been marked as resolved at your request:\n"
                            f"• *Ticket ID:* `{target_tck_num}`\n"
                            f"• *Category:* {target_ticket.get('category', 'Maintenance')}\n"
                            f"• *Issue:* \"{target_ticket.get('description', '')}\"\n"
                            f"• *Status:* ✅ Resolved\n\n"
                            f"Glad everything is sorted out! Feel free to message anytime if you need help."
                        )
                    }
                    return self._dispatch_response(res_payload, resident, message_text)
                else:
                    res_payload = {
                        "status": "not_found",
                        "reply_text": f"Hello {name}, I couldn't find an open complaint with Ticket ID *{target_tck_num}* registered under your unit. It may already be resolved or closed!"
                    }
                    return self._dispatch_response(res_payload, resident, message_text)

            # No specific ticket ID provided in message:
            if len(open_tickets) == 1:
                target = open_tickets[0]
                t_num = target.get("ticket_number", "TCK-XXXX")
                if db_service.client:
                    try:
                        db_service.client.table("complaints").update({"status": "resolved"}).eq("id", target.get("id")).execute()
                    except Exception as e:
                        logger.error(f"Error closing single open complaint: {e}")

                res_payload = {
                    "status": "success",
                    "intent": "complaint_closed",
                    "ticket_number": t_num,
                    "reply_text": (
                        f"✅ *COMPLAINT CLOSED*\n\n"
                        f"Hello {name}, your active complaint has been marked as resolved at your request:\n"
                        f"• *Ticket ID:* `{t_num}`\n"
                        f"• *Category:* {target.get('category', 'Maintenance')}\n"
                        f"• *Issue:* \"{target.get('description', '')}\"\n"
                        f"• *Status:* ✅ Resolved\n\n"
                        f"Glad to know the issue is resolved! Let us know if you need anything else. 🏠"
                    )
                }
                return self._dispatch_response(res_payload, resident, message_text)

            elif len(open_tickets) > 1:
                t_lines = "\n".join([f"• *{t.get('ticket_number')}* ({t.get('category')}): \"{t.get('description')}\"" for t in open_tickets])
                res_payload = {
                    "status": "multiple_tickets",
                    "reply_text": (
                        f"Hello {name}, you currently have {len(open_tickets)} open complaints:\n\n"
                        f"{t_lines}\n\n"
                        f"Which one would you like to close? Please reply with the Ticket ID (e.g. *Close {open_tickets[0].get('ticket_number')}*)."
                    )
                }
                return self._dispatch_response(res_payload, resident, message_text)

            else:
                res_payload = {
                    "status": "no_open_tickets",
                    "reply_text": f"Hello {name}, you currently have no open complaints to close. Everything under your unit is all clear! Let me know if you need any other assistance."
                }
                return self._dispatch_response(res_payload, resident, message_text)

        # 4. ACTION: Visitor Pass Request Handling (Check Parameters)
        is_pass_request = any(w in text_lower for w in ["visitor pass", "guest pass", "gate pass", "generate pass", "issue pass", "need a pass"])
        if is_pass_request:
            cnic_match = re.search(r'\d{5}[-\s]?\d{7}[-\s]?\d', message_text)
            visitor_cnic = cnic_match.group(0) if cnic_match else None
            
            plate_match = re.search(r'[A-Za-z]{2,3}[-\s]?\d{3,4}', message_text)
            vehicle_plate = plate_match.group(0).upper() if plate_match else None
            
            name_match = re.search(r'(?:name|visitor|for|guest)\s+([A-Za-z\s]{3,25})', message_text, re.IGNORECASE)
            visitor_name = name_match.group(1).strip().title() if name_match else None

            if visitor_name and any(token in visitor_name.lower() for token in ["pass", "cnic", "gate", "car", "unit"]):
                visitor_name = None

            missing = []
            if not visitor_name:
                missing.append("1. *Visitor Full Name*")
            if not visitor_cnic:
                missing.append("2. *Visitor CNIC / ID Number* (e.g. 42101-9988776-5)")
            if not vehicle_plate:
                missing.append("3. *Vehicle License Plate* (e.g. KHI-8921)")

            if missing:
                missing_str = "\n".join(missing)
                res_payload = {
                    "status": "missing_information",
                    "intent": "visitor_pass_incomplete",
                    "reply_text": f"📋 *VISITOR PASS DETAILS REQUIRED*\nTo issue your gate pass, please reply with the following details:\n\n{missing_str}\n\n*Example:* Visitor Tariq Mahmood, CNIC 42101-9988776-5, Vehicle KHI-8921"
                }
                return self._dispatch_response(res_payload, resident, message_text)

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

            res_payload = {
                "status": "success",
                "intent": "visitor_pass",
                "pass_code": pass_code,
                "reply_text": f"🎫 *HAMSAYAA VISITOR PASS ISSUED*\nPass Code: *{pass_code}*\nVisitor: *{visitor_name}*\nCNIC: {visitor_cnic}\nVehicle Plate: {vehicle_plate}\nResident: {name} (Unit {unit})\nValid Window: Next 4 Hours\n\n📌 *Gatekeeper Verification:* Present this pass code visually at the main gate."
            }
            return self._dispatch_response(res_payload, resident, message_text)

        # 5. ACTION: New Complaint Reporting with Smart Duplicate Matching
        is_question = any(w in text_lower for w in ["what", "when", "how", "why", "where", "who", "which", "can u", "can you", "is there", "status", "timeline", "update", "progress", "tell me"])
        new_issue_keywords = ["water leak", "leakage", "plumbing", "broken", "not working", "no light", "outage", "stuck elevator", "garbage not collected", "noise complaint", "overflow", "repair needed", "file a complaint", "log a complaint", "register complaint", "report an issue", "report issue", "missing", "asleep", "dark", "burst", "faulty", "smell", "dirt", "no water", "no guard"]
        
        fault_tokens = ["stuck", "broken", "leak", "leaking", "outage", "damage", "damaged", "repair", "not working", "not moving", "spark", "sparking", "burst", "overflow", "smell", "dirt", "noise", "missing", "asleep", "dark", "faulty", "choked", "tripped", "beeping", "stopped"]
        system_tokens = ["elevator", "lift", "light", "lights", "tap", "pipe", "water", "electricity", "power", "generator", "tanker", "gate", "guard", "door", "pump", "drain", "gutter", "garbage", "trash", "intercom", "wiring", "fan", "ac"]

        has_fault_and_system = any(f in text_lower for f in fault_tokens) and any(s in text_lower for s in system_tokens)
        has_direct_complaint_kw = any(kw in text_lower for kw in ["complaint", "issue", "problem", "fault", "file complaint", "register complaint", "report issue", "fix this"]) or any(kw in text_lower for kw in new_issue_keywords)

        is_new_complaint = (has_fault_and_system or has_direct_complaint_kw) and not is_question

        if is_new_complaint and not is_question:
            if any(w in text_lower for w in ["water", "plumb", "leak", "pipe", "drain", "sewer", "tanker"]):
                category = "Water & Plumbing"
            elif any(w in text_lower for w in ["electric", "light", "power", "outage", "generator"]):
                category = "Electrical & Power"
            elif any(w in text_lower for w in ["lift", "elevator", "stuck"]):
                category = "Elevators & Lifts"
            elif any(w in text_lower for w in ["garbage", "trash", "dirty", "clean", "smell", "waste"]):
                category = "Sanitation & Waste"
            elif any(w in text_lower for w in ["park", "security", "gate", "guard"]):
                category = "Security & Parking"
            else:
                category = "General Maintenance & Repair"

            # SMART DUPLICATE MATCHING:
            # Check active open tickets in the society to see if this is already an ongoing reported problem
            existing_match = None
            if resident and db_service.client:
                try:
                    soc_tcks = db_service.client.table("complaints").select("*").eq("society_id", resident.get("society_id")).in_("status", ["open", "in_progress"]).order("created_at", desc=True).limit(20).execute()
                    active_soc_tickets = soc_tcks.data or []
                    
                    common_tokens = ["guard", "gate", "lift", "elevator", "generator", "power", "electricity", "tanker", "water supply", "corridor", "hallway", "parking", "garbage", "trash", "security", "pump"]
                    matched_tokens = [tok for tok in common_tokens if tok in text_lower]

                    if matched_tokens:
                        for t in active_soc_tickets:
                            t_desc_lower = (t.get("description") or "").lower()
                            if any(tok in t_desc_lower for tok in matched_tokens):
                                existing_match = t
                                break
                except Exception as e:
                    logger.error(f"Error checking duplicate complaints: {e}")

            if existing_match:
                match_tck_num = existing_match.get("ticket_number", "TCK-XXXX")
                res_payload = {
                    "status": "success",
                    "intent": "complaint_duplicate_matched",
                    "ticket_number": match_tck_num,
                    "reply_text": (
                        f"ℹ️ *COMPLAINT ALREADY LOGGED & IN PROGRESS*\n\n"
                        f"Hello {name}, our management team is already aware of this issue and actively working on it:\n"
                        f"• *Ticket ID:* `{match_tck_num}`\n"
                        f"• *Category:* {existing_match.get('category')}\n"
                        f"• *Issue Details:* \"{existing_match.get('description')}\"\n"
                        f"• *Status:* 🟡 In Progress\n\n"
                        f"Our maintenance team has been dispatched. You can track this issue anytime by asking for the status of *{match_tck_num}*!"
                    )
                }
                return self._dispatch_response(res_payload, resident, message_text)

            # Not a duplicate -> Create new ticket!
            ticket_num = self._generate_ticket_number()
            if resident and db_service.client:
                try:
                    db_service.client.table("complaints").insert({
                        "society_id": resident.get("society_id"),
                        "resident_id": resident.get("id"),
                        "ticket_number": ticket_num,
                        "category": category,
                        "description": message_text,
                        "status": "open"
                    }).execute()
                except Exception as e:
                    logger.error(f"Error writing complaint ticket: {e}")

            res_payload = {
                "status": "success",
                "intent": "complaint",
                "ticket_number": ticket_num,
                "reply_text": (
                    f"🛠️ *HAMSAYAA TICKET REGISTERED*\n\n"
                    f"Hello {name}, your society issue has been logged:\n"
                    f"• *Ticket ID:* `{ticket_num}`\n"
                    f"• *Category:* {category}\n"
                    f"• *Location:* {building} - Unit {unit}\n"
                    f"• *Details:* \"{message_text}\"\n\n"
                    f"📌 *Status:* Open & Dispatched to Maintenance Team. Our team will attend to your unit shortly!"
                )
            }
            return self._dispatch_response(res_payload, resident, message_text)

        # 6. CONVERSATIONAL REASONING FLOW (Gemini 2.0 Flash)
        # Handles questions, status inquiries, timelines, amenity queries, and general chat.
        # NEVER inserts into complaints table!
        if self.client and USING_NEW_GENAI:
            try:
                full_prompt = (
                    f"RESIDENT PROFILE:\n"
                    f"Name: {name}\n"
                    f"Unit: {building} - Unit {unit}\n"
                )
                if active_tickets_summary:
                    full_prompt += f"\n{active_tickets_summary}\n"
                if history_context:
                    full_prompt += f"\nRECENT CONVERSATION HISTORY (UPSTASH MEMORY):\n{history_context}\n"
                
                full_prompt += (
                    f"\nNEW RESIDENT MESSAGE: \"{message_text}\"\n\n"
                    f"STRICT BEHAVIOR INSTRUCTIONS FOR AI CONCIERGE:\n"
                    f"1. You are a personal, warm, and highly professional concierge manager for {name}.\n"
                    f"2. Read the conversation history and active tickets above carefully.\n"
                    f"3. If the resident asks a question about complaints, status, timelines, or amenities, answer conversationally in a natural, personalized tone without rigid templates.\n"
                    f"4. If asking about a timeline, give an estimated turnaround of 1 to 2 hours with reassuring updates."
                )

                res = self.client.models.generate_content(
                    model=settings.GEMINI_MODEL,
                    contents=full_prompt,
                    config=types.GenerateContentConfig(
                        system_instruction=HAMSAYAA_SYSTEM_PROMPT
                    )
                )
                if res and res.text:
                    res_payload = {"status": "success", "reply_text": res.text}
                    return self._dispatch_response(res_payload, resident, message_text)
            except Exception as e:
                logger.error(f"Gemini API offline / rate-limited, using Smart Agentic Resolver: {e}")

        # 7. Smart Agentic Resolver Fallback (For Questions/Status when LLM is unavailable)
        if recent_tickets:
            latest = recent_tickets[0]
            t_id = latest.get("ticket_number", "TCK-XXXX")
            t_cat = latest.get("category", "Maintenance")
            t_desc = latest.get("description", "Issue report")
            t_status = latest.get("status", "open").upper()

            if any(w in text_lower for w in ["what", "list", "show", "registered", "my complaint"]):
                reply = (
                    f"Hello {name}! You currently have active complaint *{t_id}* logged for Unit {unit}:\n"
                    f"• *Category:* {t_cat}\n"
                    f"• *Issue Details:* \"{t_desc}\"\n"
                    f"• *Current Status:* {t_status}"
                )
            elif any(w in text_lower for w in ["timeline", "when", "time", "resolved", "fixed", "status", "long"]):
                reply = (
                    f"Hello {name}, regarding your open ticket *{t_id}* ({t_cat}):\n"
                    f"Our society maintenance staff is currently attending to {building}. The estimated resolution time is within *1 to 2 hours*."
                )
            else:
                reply = (
                    f"Hello {name}, I am tracking your ticket *{t_id}* ({t_cat}). Our maintenance team is currently working on it for Unit {unit}!"
                )
        else:
            reply = f"Hello {name}! I am your Hamsayaa Concierge for Unit {unit}. You currently have no open complaints logged. How can I assist you today?"

        res_payload = {"status": "success", "reply_text": reply}
        return self._dispatch_response(res_payload, resident, message_text)

gemini_engine = GeminiEngine()
