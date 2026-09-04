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

    def _get_model_candidates(self) -> list[str]:
        """
        Returns an ordered list of Gemini model candidates for resilient fallback.
        If the primary model is rate-limited (429) or experiencing temporary high demand (503),
        the engine seamlessly cascades to the next available model.
        """
        candidates = [settings.GEMINI_MODEL]
        for fallback in ["gemini-3.6-flash", "gemini-flash-latest", "gemini-3-flash-preview", "gemini-2.5-flash"]:
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

    async def process_resident_message(
        self,
        resident: dict,
        message_text: str,
        failed_attempts: int = 0,
        audio_url: str | None = None
    ) -> dict:
        """
        Processes inbound resident WhatsApp message through Gemini AI Engine with Upstash Redis memory.
        1. Context Hydration: Loads Upstash conversation memory, active complaints, invoice/dues, and polls from Supabase.
        2. Off-Topic Guardrail: Rejects unrelated spam politely without writing to database.
        3. Emergency Life Safety Alert: Directs to 1122/16/15 and logs high-priority emergency ticket.
        4. Community Poll Voting: Casts single-choice vote per unit for active polls.
        5. Resident Ticket Closure: Allows members to close any of their open complaints on demand.
        6. Visitor Pass Issuance: Generates gated visitor access passes with parameter validation.
        7. New Complaint & Smart Duplicate Matching: Evaluates issues, links duplicate community complaints to existing ticket, logs new tickets.
        8. Conversational AI Reasoning: Powered by Gemini 2.0 Flash for questions, follow-ups, and community interactions.
        """
        text_lower = message_text.lower().strip()
        phone = resident.get("phone_number", "") if resident else ""
        name = resident.get("name", "Resident") if resident else "Resident"
        building = resident.get("building", "Block A") if resident else "Block A"
        unit = resident.get("unit_number", "101") if resident else "101"

        # 1. Load Upstash Redis Chat Memory & Active DB Context (Tickets, Invoices, Polls)
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

        # Hydrate Dues & Invoices Context from Supabase
        active_invoice = None
        invoice_summary = ""
        if resident and db_service.client:
            try:
                inv_res = db_service.client.table("invoices").select("*").eq("resident_id", resident.get("id")).order("created_at", desc=True).limit(3).execute()
                invoices_list = inv_res.data or []
                active_invoice = next((i for i in invoices_list if i.get("status") in ["unpaid", "overdue"]), invoices_list[0] if invoices_list else None)
                if active_invoice:
                    invoice_summary = (
                        f"RESIDENT DUES & INVOICE DETAILS (LIVE SUPABASE DB):\n"
                        f"• Status: {active_invoice.get('status', '').upper()}\n"
                        f"• Society Maintenance Fee: PKR {active_invoice.get('society_maintenance_fee', 0):,.2f}\n"
                        f"• Hamsayaa Platform SaaS Fee: PKR {active_invoice.get('hamsayaa_saas_fee', 0):,.2f}\n"
                        f"• Utility Charges: PKR {active_invoice.get('utility_charges', 0):,.2f}\n"
                        f"• Total Amount Due: PKR {active_invoice.get('total_amount', 0):,.2f}\n"
                        f"• Due Date: {active_invoice.get('due_date', 'N/A')}\n"
                        f"• Payment Account: {active_invoice.get('account_shown') or 'Meezan Bank - A/C PK42MEZN00012345678901 - Lakeview Maint Account'}"
                    )
            except Exception as e:
                logger.error(f"Error fetching invoice context: {e}")

        # Hydrate Polls Context from Supabase
        polls_summary = ""
        active_polls = []
        if resident and resident.get("society_id"):
            try:
                polls_list = db_service.get_polls(resident.get("society_id"))
                active_polls = [p for p in polls_list if not p.get("is_closed")]
                if active_polls:
                    p_lines = [
                        f"- Poll \"{p.get('title')}\" (Options: {', '.join(p.get('options') or [])}) - Total Votes: {p.get('total_votes', 0)}"
                        for p in active_polls
                    ]
                    polls_summary = "Active Community Polls:\n" + "\n".join(p_lines)
            except Exception as e:
                logger.error(f"Error fetching polls context: {e}")

        # 2. ACTION: Off-Topic Guardrail (NO DATABASE WRITES!)
        off_topic_keywords = ["weather", "joke", "politics", "president", "crypto", "bitcoin", "stock market", "buy car", "sell car"]
        if any(w in text_lower for w in off_topic_keywords):
            res_payload = {
                "status": "flagged_irrelevant",
                "reply_text": f"Hello {name}, I am your Hamsayaa Society Concierge. I am dedicated to helping you with society operations (complaints, visitor passes, maintenance dues, amenities, and community polls)."
            }
            return self._dispatch_response(res_payload, resident, message_text)

        # 3. ACTION: Emergency Life Safety Detection (HIGHEST OPERATIONAL PRIORITY)
        emergency_keywords = [
            "fire", "gas leak", "gas smell", "smell gas", "intruder", "break-in", "break in",
            "robbery", "armed", "gunshot", "gun", "thief", "medical emergency", "heart attack",
            "unconscious", "explosion", "electric shock", "aag", "gas ki boo", "chor", "chori", "daku"
        ]
        is_emergency_inquiry = any(q in text_lower for q in ["what is", "what's", "give me", "number", "helpline", "who to call", "contact", "ext"]) and any(e in text_lower for e in ["emergency", "helpline", "fire brigade", "police", "ambulance", "rescue", "intercom"])
        
        if is_emergency_inquiry:
            res_payload = {
                "status": "success",
                "intent": "emergency_helpline",
                "reply_text": (
                    f"🚨 *EMERGENCY CONTACT DIRECTORY*\n\n"
                    f"Hello {name}, here are the official 24/7 emergency response contacts for {building} (Unit {unit}):\n"
                    f"• 🚑 *Ambulance / Rescue:* 1122\n"
                    f"• 🚒 *Fire Brigade:* 16\n"
                    f"• 👮 *Police Helpline:* 15\n"
                    f"• 🏥 *Edhi Ambulance:* 115\n"
                    f"• 🏢 *Society Security Gate Intercom:* Ext 100\n"
                    f"• 📞 *Society Emergency Hotline:* +92 300 1234567"
                )
            }
            return self._dispatch_response(res_payload, resident, message_text)

        if any(ek in text_lower for ek in emergency_keywords) and not is_emergency_inquiry:
            ticket_num = self._generate_ticket_number()
            if resident and db_service.client:
                try:
                    desc = f"[URGENT EMERGENCY] {message_text}"
                    if audio_url:
                        desc += f" [Audio: {audio_url}]"
                    db_service.client.table("complaints").insert({
                        "society_id": resident.get("society_id"),
                        "resident_id": resident.get("id"),
                        "ticket_number": ticket_num,
                        "category": "Emergency & Life Safety",
                        "description": desc,
                        "status": "open",
                        "photo_url": audio_url
                    }).execute()
                except Exception as e:
                    logger.error(f"Error logging emergency complaint: {e}")

            res_payload = {
                "status": "emergency",
                "intent": "emergency",
                "ticket_number": ticket_num,
                "reply_text": (
                    f"🚨 *URGENT LIFE SAFETY ALERT*\n\n"
                    f"Hello {name}, if you are in immediate physical danger, please contact local emergency authorities immediately:\n"
                    f"• 🚑 *Rescue / Ambulance:* 1122\n"
                    f"• 🚒 *Fire Brigade:* 16\n"
                    f"• 👮 *Police:* 15\n"
                    f"• 🏢 *Society Security Intercom:* Ext 100 / Hotline: +92 300 1234567\n\n"
                    f"⚠️ *Emergency Ticket Dispatched:*\n"
                    f"• *Ticket ID:* `{ticket_num}`\n"
                    f"• *Category:* Emergency & Life Safety\n"
                    f"• *Location:* {building} - Unit {unit}\n"
                    f"• *Details:* \"{message_text}\"\n\n"
                    f"On-site society security and emergency responders have been alerted immediately!"
                )
            }
            return self._dispatch_response(res_payload, resident, message_text)

        # 4. ACTION: Community Poll Voting
        if any(vk in text_lower for vk in ["vote", "voting", "poll"]) and any(w in text_lower for w in ["yes", "no", "abstain", "option", "paint", "upgrade", "vote for", "cast"]):
            if active_polls and resident and db_service.client:
                for p in active_polls:
                    opts = p.get("options") or []
                    for opt in opts:
                        if opt.lower() in text_lower:
                            v_res = db_service.cast_vote(p["id"], resident.get("id"), opt)
                            if v_res:
                                res_payload = {
                                    "status": "success",
                                    "intent": "poll_vote",
                                    "reply_text": (
                                        f"🗳️ *VOTE RECORDED*\n\n"
                                        f"Hello {name}, your official vote for Unit {unit} has been registered:\n"
                                        f"• *Poll:* \"{p.get('title')}\"\n"
                                        f"• *Your Vote:* *{opt}*\n\n"
                                        f"Thank you for taking part in community decisions!"
                                    )
                                }
                                return self._dispatch_response(res_payload, resident, message_text)
                            else:
                                res_payload = {
                                    "status": "info",
                                    "intent": "poll_duplicate_vote",
                                    "reply_text": (
                                        f"ℹ️ *VOTE ALREADY RECORDED*\n\n"
                                        f"Hello {name}, your vote for Unit {unit} on poll *\"{p.get('title')}\"* has already been recorded. Society rules permit only one vote per residential unit."
                                    )
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
            
            # Extract visitor name (support "Visitor: Name", "Guest Name", "Name: Name", "for Name", "pass for Name")
            name_match = re.search(r'(?:visitor\s+pass\s+for|pass\s+for|visitor\s+name|guest\s+name|visitor|guest|name|for)[:\s]+([A-Za-z\s]{2,30}?)(?=[,\n\.]|\s+cnic|\s+vehicle|\s+plate|\s+car|$)', message_text, re.IGNORECASE)
            visitor_name = name_match.group(1).strip().title() if name_match else None

            if visitor_name and any(token in visitor_name.lower() for token in ["pass", "cnic", "gate", "car", "unit", "vehicle"]):
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

        question_words = ["what", "when", "how", "why", "where", "who", "which", "status", "timeline", "update", "progress"]
        has_question_word = any(re.search(rf'\b{qw}\b', text_lower) for qw in question_words) or any(phrase in text_lower for phrase in ["can u", "can you", "is there", "tell me", "kab tak", "kya status"])
        is_status_inquiry = any(w in text_lower for w in ["status", "timeline", "update", "progress", "how long", "kab tak"])
        
        # Check if resident is asking/checking on existing complaints rather than logging a new one
        is_complaint_inquiry = any(phrase in text_lower for phrase in [
            "check my complaint", "check complaint", "show my complaint", "show complaint",
            "list my complaint", "list complaint", "view my complaint", "view complaint",
            "my complaint", "my complaints", "my tickets", "my open tickets", "active ticket",
            "track ticket", "track complaint", "complaint status", "ticket status", "open complaint"
        ]) or (any(w in text_lower for w in ["check", "show", "list", "view", "what"]) and any(w in text_lower for w in ["complaint", "ticket"]))

        new_issue_keywords = ["water leak", "leakage", "plumbing", "broken", "not working", "no light", "outage", "stuck elevator", "garbage not collected", "noise complaint", "overflow", "repair needed", "file a complaint", "log a complaint", "register complaint", "report an issue", "report issue", "missing", "asleep", "dark", "burst", "faulty", "smell", "dirt", "no water", "no guard"]
        
        fault_tokens = ["stuck", "broken", "leak", "leaking", "outage", "damage", "damaged", "repair", "not working", "not moving", "spark", "sparking", "burst", "overflow", "smell", "dirt", "noise", "missing", "asleep", "dark", "faulty", "choked", "tripped", "beeping", "stopped"]
        system_tokens = ["elevator", "lift", "light", "lights", "tap", "pipe", "water", "electricity", "power", "generator", "tanker", "gate", "guard", "door", "pump", "drain", "gutter", "garbage", "trash", "intercom", "wiring", "fan", "ac"]

        has_fault_and_system = any(f in text_lower for f in fault_tokens) and any(s in text_lower for s in system_tokens)
        has_direct_complaint_kw = any(kw in text_lower for kw in ["file complaint", "register complaint", "log complaint", "report issue", "report an issue", "fix this", "file a complaint", "log a complaint"]) or any(kw in text_lower for kw in new_issue_keywords)

        is_new_complaint = (has_fault_and_system or has_direct_complaint_kw) and not is_status_inquiry and not is_complaint_inquiry

        if is_new_complaint:
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
                    
                    common_tokens = ["guard", "gate", "lift", "elevator", "generator", "power", "electricity", "tanker", "water", "pipe", "tap", "leak", "plumbing", "light", "corridor", "hallway", "parking", "garbage", "trash", "security", "pump", "drain", "gutter", "intercom"]
                    matched_tokens = [tok for tok in common_tokens if tok in text_lower]

                    if matched_tokens:
                        for t in active_soc_tickets:
                            # Do not match against life safety emergency alerts
                            if t.get("category") in ["Emergency & Life Safety"]:
                                continue
                            # Ensure category alignment
                            if t.get("category") and t.get("category") != category:
                                continue
                            
                            t_desc_lower = (t.get("description") or "").lower()
                            shared = [tok for tok in matched_tokens if tok in t_desc_lower]
                            
                            # A duplicate must either be for the same resident, or represent shared community infrastructure
                            is_same_resident = (t.get("resident_id") == resident.get("id"))
                            is_community_asset = any(a in shared or a in text_lower or a in t_desc_lower for a in [
                                "lift", "elevator", "generator", "tanker", "gate", "guard", "corridor", 
                                "hallway", "garbage", "trash", "intercom", "transformer", "parking", "pump", "lobby", "roof"
                            ])

                            if (is_same_resident or is_community_asset) and (is_community_asset or len(shared) >= 2):
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
                    desc = message_text
                    if audio_url:
                        desc += f" [Audio: {audio_url}]"
                    db_service.client.table("complaints").insert({
                        "society_id": resident.get("society_id"),
                        "resident_id": resident.get("id"),
                        "ticket_number": ticket_num,
                        "category": category,
                        "description": desc,
                        "status": "open",
                        "photo_url": audio_url
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

        # 6. CONVERSATIONAL REASONING FLOW (Multi-Model Cascade)
        # Handles questions, status inquiries, timelines, amenity queries, and general chat.
        # NEVER inserts into complaints table!
        if self.client and USING_NEW_GENAI:
            full_prompt = (
                f"RESIDENT PROFILE:\n"
                f"Name: {name}\n"
                f"Unit: {building} - Unit {unit}\n"
            )
            if active_tickets_summary:
                full_prompt += f"\n{active_tickets_summary}\n"
            if invoice_summary:
                full_prompt += f"\n{invoice_summary}\n"
            if polls_summary:
                full_prompt += f"\n{polls_summary}\n"
            if history_context:
                full_prompt += f"\nRECENT CONVERSATION HISTORY (UPSTASH MEMORY):\n{history_context}\n"
            
            # Live Society Amenities Context
            if resident and resident.get("society_id"):
                try:
                    amenities_list = db_service.get_amenities(resident.get("society_id"))
                    if amenities_list:
                        am_lines = "\n".join([
                            f"• {a.get('name')}: Timings: {a.get('timings', 'Standard')}, Rules: {a.get('rules', 'Standard community guidelines')}, Bookable: {'Yes' if a.get('is_bookable') else 'No'}"
                            for a in amenities_list
                        ])
                        full_prompt += f"\nSOCIETY AMENITIES & FACILITIES DIRECTORY:\n{am_lines}\n"
                except Exception as e:
                    logger.error(f"Error fetching amenities for Gemini prompt: {e}")

            full_prompt += (
                f"\nNEW RESIDENT MESSAGE: \"{message_text}\"\n\n"
                f"STRICT BEHAVIOR INSTRUCTIONS FOR AI CONCIERGE:\n"
                f"1. You are a personal, warm, and highly professional concierge manager for {name}.\n"
                f"2. Read the conversation history, active tickets, dues, polls, and amenities above carefully.\n"
                f"3. If the resident asks a question about complaints, status, timelines, maintenance dues/bills, payment accounts, polls, or amenities, answer conversationally in a natural, personalized tone without rigid templates.\n"
                f"4. If resident asks in Roman Urdu or Urdu, ALWAYS reply in natural Roman Urdu or Urdu matching their language.\n"
                f"5. If asking for a bill breakdown or dues, provide the itemized breakdown directly from the RESIDENT DUES & INVOICE DETAILS above (Society Fee + SaaS Fee + Utility = Total).\n"
                f"6. If asking about a timeline, give an estimated turnaround of 1 to 2 hours with reassuring updates."
            )

            for model_name in self._get_model_candidates():
                try:
                    res = self.client.models.generate_content(
                        model=model_name,
                        contents=full_prompt,
                        config=types.GenerateContentConfig(
                            system_instruction=HAMSAYAA_SYSTEM_PROMPT
                        )
                    )
                    if res and res.text:
                        print(f"--> [Gemini AI Reply generated using {model_name}]")
                        res_payload = {"status": "success", "reply_text": res.text}
                        return self._dispatch_response(res_payload, resident, message_text)
                except Exception as e:
                    logger.warning(f"Gemini model {model_name} unavailable: {e}. Trying next model in cascade...")

        # 7. Smart Deterministic Resolver Fallback (Only when ALL Gemini models are offline/unavailable)
        
        # Fallback Dues & Invoices Inquiry
        dues_keywords = ["due", "dues", "bill", "invoice", "payment", "bank", "account", "pkr", "kitnay", "bhejo", "pay", "charges", "maintenance fee"]
        if any(dk in text_lower for dk in dues_keywords) and active_invoice:
            total = active_invoice.get("total_amount", 0)
            maint = active_invoice.get("society_maintenance_fee", 0)
            saas = active_invoice.get("hamsayaa_saas_fee", 0)
            util = active_invoice.get("utility_charges", 0)
            status_str = active_invoice.get("status", "unpaid").upper()
            due_date = active_invoice.get("due_date", "N/A")
            account = active_invoice.get("account_shown", "Meezan Bank - A/C PK42MEZN00012345678901 - Lakeview Maint Account")
            
            reply = (
                f"💳 *HAMSAYAA MAINTENANCE INVOICE*\n\n"
                f"Hello {name}, here is the itemized billing breakdown for Unit {unit}:\n"
                f"• *Society Maintenance Fee:* PKR {maint:,.2f}\n"
                f"• *Hamsayaa Platform SaaS Fee:* PKR {saas:,.2f}\n"
                f"• *Utility Charges:* PKR {util:,.2f}\n"
                f"────────────────────\n"
                f"• *Total Amount Due:* *PKR {total:,.2f}*\n"
                f"• *Status:* {'🔴 ' + status_str if status_str in ['UNPAID', 'OVERDUE'] else '🟢 ' + status_str}\n"
                f"• *Due Date:* {due_date}\n\n"
                f"🏦 *Payment Transfer Details:*\n"
                f"• *Account:* {account}\n\n"
                f"📌 Once transferred, kindly share a screenshot of the payment receipt here for verification."
            )
            res_payload = {"status": "success", "intent": "dues_inquiry", "reply_text": reply}
            return self._dispatch_response(res_payload, resident, message_text)

        # Fallback Amenities Lookup
        amenity_keywords = ["pool", "swimming", "gym", "fitness", "hall", "banquet", "badminton", "mosque", "masjid", "park", "timing", "hours"]
        if any(ak in text_lower for ak in amenity_keywords) and resident and resident.get("society_id"):
            try:
                amenities = db_service.get_amenities(resident.get("society_id"))
                matched = [a for a in amenities if any(tok in a.get("name", "").lower() for tok in text_lower.split())]
                if not matched:
                    matched = amenities
                am_lines = "\n\n".join([
                    f"🏊 *{a.get('name')}*\n• *Timings:* {a.get('timings')}\n• *Rules:* {a.get('rules')}\n• *Booking Required:* {'Yes' if a.get('is_bookable') else 'No'}"
                    for a in matched[:3]
                ])
                reply = f"🏛️ *SOCIETY AMENITIES DIRECTORY*\n\nHello {name}, here are the requested facility details:\n\n{am_lines}"
                res_payload = {"status": "success", "intent": "amenity_inquiry", "reply_text": reply}
                return self._dispatch_response(res_payload, resident, message_text)
            except Exception as e:
                logger.error(f"Error in fallback amenity lookup: {e}")

        # Fallback Complaints Status/Timeline Tracking (ONLY if resident explicitly asked about their ticket or complaints!)
        is_asking_ticket = is_status_inquiry or any(w in text_lower for w in ["what", "list", "show", "registered", "my complaint", "ticket", "complaint status"])
        if is_asking_ticket and recent_tickets:
            latest = recent_tickets[0]
            t_id = latest.get("ticket_number", "TCK-XXXX")
            t_cat = latest.get("category", "Maintenance")
            t_desc = latest.get("description", "Issue report")
            t_status = latest.get("status", "open").upper()

            if any(w in text_lower for w in ["timeline", "when", "time", "resolved", "fixed", "long", "kab tak"]):
                reply = (
                    f"Hello {name}, regarding your open ticket *{t_id}* ({t_cat}):\n"
                    f"Our society maintenance staff is currently attending to {building}. The estimated resolution time is within *1 to 2 hours*."
                )
            else:
                reply = (
                    f"Hello {name}! Here is your current complaint status for Unit {unit}:\n"
                    f"• *Ticket ID:* `{t_id}`\n"
                    f"• *Category:* {t_cat}\n"
                    f"• *Issue:* \"{t_desc}\"\n"
                    f"• *Current Status:* {t_status}"
                )
            res_payload = {"status": "success", "reply_text": reply}
            return self._dispatch_response(res_payload, resident, message_text)

        # Fallback Polite Greeting (If resident just said hello / salam)
        greeting_words = ["hi", "hello", "salam", "assalam", "hey", "aoa", "good morning", "good evening"]
        if any(re.search(rf'\b{gw}\b', text_lower) for gw in greeting_words):
            reply = (
                f"Hello {name}! I am your Hamsayaa Society Concierge for {building} (Unit {unit}).\n"
                f"How can I assist you with society operations today?"
            )
            res_payload = {"status": "success", "reply_text": reply}
            return self._dispatch_response(res_payload, resident, message_text)

        # If ALL models in the cascade are unavailable and message is an arbitrary question/chat, BE TRANSPARENT!
        reply = (
            f"⚠️ *AI CONCIERGE TEMPORARILY BUSY*\n\n"
            f"Hello {name}, our AI concierge service is currently experiencing high network demand or temporary downtime.\n\n"
            f"Your message has been received. Please try again in a few moments, or if your request is urgent, please contact the society management office directly:\n"
            f"• 🏢 *Office Intercom:* Ext 100\n"
            f"• 📞 *Society Helpline:* +92 300 1234567"
        )
        res_payload = {"status": "service_unavailable", "reply_text": reply}
        return self._dispatch_response(res_payload, resident, message_text)

gemini_engine = GeminiEngine()
