from app.core.config import settings
from app.db.supabase import db_service
import random
import logging

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
You are Hamsayaa AI Concierge (ہمسایہ AI), a professional, polite, empathetic, and highly efficient operational AI assistant for gated communities, residential societies, and apartment complexes.

YOUR MANDATE:
You assist verified residents with all community operations, complaints, and society inquiries:
1. Registering & tracking complaints/service tickets for any society issue (water leaks, plumbing, electrical outages, elevator faults, gate security, waste management, noise disputes, parking problems, generator issues).
2. Generating guest visitor passes (requiring visitor name, visitor CNIC/ID, vehicle plate, validity window).
3. Looking up monthly cumulative bills, maintenance dues breakdown, and society payment bank account details.
4. Answering operational questions regarding community amenities (gym timings, swimming pool rules, event hall bookings).
5. Recording resident votes for active community polls.

COMPLAINT & ISSUE HANDLING GUIDELINES:
- When a resident reports ANY issue or complaint regarding their unit or society infrastructure, immediately acknowledge their problem with empathy.
- Provide a clear, structured confirmation detailing the Ticket ID (e.g. TCK-XXXX), Category, Resident Unit, and assurance that the maintenance team has been notified.
- Support queries in English, Urdu, or Roman Urdu seamlessly.
- Be clear, professional, and reassuring.
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
            key = f"chat_history:{phone}"
            raw_items = self.redis.lrange(key, -6, -1) or []
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

    async def process_resident_message(
        self,
        resident: dict,
        message_text: str,
        failed_attempts: int = 0
    ) -> dict:
        """
        Processes inbound resident WhatsApp message through Gemini AI Engine with Upstash Redis memory.
        Differentiates dynamically between conversational inquiries/follow-ups and new ticket/pass creations.
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
        if resident and db_service.client:
            try:
                tck_res = db_service.client.table("complaints").select("*").eq("resident_id", resident.get("id")).order("created_at", desc=True).limit(5).execute()
                recent_tickets = tck_res.data or []
                if recent_tickets:
                    t_lines = [f"- Ticket {t['ticket_number']} ({t['category']}): STATUS={t['status'].upper()} - Details: \"{t['description']}\"" for t in recent_tickets]
                    active_tickets_summary = "Resident Logged Tickets in Database:\n" + "\n".join(t_lines)
            except Exception as e:
                logger.error(f"Error fetching tickets context: {e}")

        # 2. Guardrail: Off-Topic Detection
        off_topic_keywords = ["weather", "joke", "politics", "president", "crypto", "bitcoin", "buy", "sell"]
        if any(w in text_lower for w in off_topic_keywords):
            if resident and db_service.client:
                try:
                    db_service.client.table("complaints").insert({
                        "society_id": resident.get("society_id"),
                        "resident_id": resident.get("id"),
                        "ticket_number": self._generate_ticket_number(),
                        "category": "Off-Topic / Flagged",
                        "description": message_text,
                        "status": "flagged_irrelevant"
                    }).execute()
                except Exception as e:
                    logger.error(f"Error logging flagged complaint: {e}")

            res_payload = {
                "status": "flagged_irrelevant",
                "reply_text": f"Hello {name}, I am your Hamsayaa Society Concierge. I am dedicated to helping you with society operations (complaints, visitor passes, maintenance dues, amenities, and community polls)."
            }
            return self._dispatch_response(res_payload, resident, message_text)

        # 3. Explicit Visitor Pass Request Handling (Check Parameters)
        is_pass_request = any(w in text_lower for w in ["visitor pass", "guest pass", "gate pass", "generate pass", "issue pass", "need a pass"])
        if is_pass_request:
            import re
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
            from datetime import datetime, timezone, timedelta
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

        # 4. Explicit NEW Complaint Reporting (e.g., "Water is leaking in my kitchen", "Elevator in Block B is broken")
        # Only register a new ticket if the resident is explicitly reporting a NEW problem, NOT asking a question/follow-up
        is_question = any(w in text_lower for w in ["what", "when", "how", "why", "where", "who", "which", "can u", "can you", "is there", "status", "timeline", "update", "progress"])
        new_issue_keywords = ["water leak", "leakage", "plumbing", "broken", "not working", "no light", "outage", "stuck elevator", "garbage not collected", "noise complaint", "overflow", "repair needed", "file a complaint", "log a complaint", "register complaint", "report an issue", "report issue"]
        
        is_new_complaint = any(kw in text_lower for kw in new_issue_keywords) or (any(w in text_lower for w in ["complaint", "issue", "leak", "broken"]) and not is_question)

        if is_new_complaint and not is_question:
            ticket_num = self._generate_ticket_number()
            
            if any(w in text_lower for w in ["water", "plumb", "leak", "pipe", "drain", "sewer", "tanker"]):
                category = "Water & Plumbing"
            elif any(w in text_lower for w in ["electric", "light", "power", "outage", "generator"]):
                category = "Electrical & Power"
            elif any(w in text_lower for w in ["lift", "elevator", "stuck"]):
                category = "Elevators & Lifts"
            elif any(w in text_lower for w in ["garbage", "trash", "dirty", "clean", "smell"]):
                category = "Sanitation & Waste"
            elif any(w in text_lower for w in ["park", "security", "gate"]):
                category = "Security & Parking"
            else:
                category = "General Maintenance & Repair"

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

        # 5. Dynamic LLM Reasoning Engine for Questions, Context Inquiries, & Follow-Ups (Uses Upstash Memory)
        if self.client:
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
                    f"3. If the resident asks a question about existing complaints (e.g. 'what complaint i have registered?', 'can u give a timeline for this to get resolved?'), answer them in a conversational, personalized tone using their exact ticket details. DO NOT output structured template boxes for conversational follow-ups.\n"
                    f"4. If the resident is asking for a timeline on an open ticket, give a realistic, reassuring estimated turnaround time (e.g., 1 to 2 hours) and explain that the maintenance team is attending to their block.\n"
                    f"5. Maintain context across turns seamlessly. Keep your response concise, polite, and directly relevant."
                )

                if USING_NEW_GENAI:
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
                logger.error(f"Gemini API rate-limited / error, using Smart Agentic Resolver: {e}")

        # 6. Smart Agentic Resolver (Guarantees personalized context even if LLM API is rate-limited)
        if recent_tickets:
            latest = recent_tickets[0]
            t_id = latest.get("ticket_number", "TCK-XXXX")
            t_cat = latest.get("category", "Maintenance")
            t_desc = latest.get("description", "Issue report")
            t_status = latest.get("status", "open").upper()

            if any(w in text_lower for w in ["what", "list", "show", "registered", "my complaint"]):
                reply = (
                    f"Hello {name}! You currently have active complaint **{t_id}** logged for Unit {unit}:\n"
                    f"• *Category:* {t_cat}\n"
                    f"• *Issue Details:* \"{t_desc}\"\n"
                    f"• *Current Status:* {t_status}"
                )
            elif any(w in text_lower for w in ["timeline", "when", "time", "resolved", "fixed", "status", "long"]):
                reply = (
                    f"Hello {name}, regarding your open ticket **{t_id}** ({t_cat}):\n"
                    f"Our society maintenance staff is currently attending to {building}. The estimated resolution time is within **1 to 2 hours**."
                )
            else:
                reply = (
                    f"Hello {name}, I am tracking your ticket **{t_id}** ({t_cat}). Our maintenance team is currently working on it for Unit {unit}!"
                )
        else:
            reply = f"Hello {name}! I am your Hamsayaa Concierge for Unit {unit}. You currently have no open complaints logged. How can I assist you today?"

        res_payload = {"status": "success", "reply_text": reply}
        return self._dispatch_response(res_payload, resident, message_text)

gemini_engine = GeminiEngine()
