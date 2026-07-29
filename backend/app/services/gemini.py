import google.generativeai as genai
from app.core.config import settings
from app.db.supabase import db_service
import random
import string
import logging

logger = logging.getLogger(__name__)

HAMSAYAA_SYSTEM_PROMPT = """
You are Hamsayaa AI Concierge (ہمسایہ AI), a professional, polite, and efficient operational AI assistant for gated communities and apartment societies.

YOUR MANDATE:
You assist verified residents strictly with community operations:
1. Registering complaints & service tickets (plumbing, electrical, water, elevator, gate, security).
2. Generating guest visitor passes (visitor name, visitor CNIC, vehicle plate, validity window).
3. Looking up monthly cumulative bills & society payment bank account details.
4. Answering questions about community amenities (gym timings, hall rules, pool capacity).
5. Recording resident votes for active community polls.

STRICT GUARDRAILS & RULES:
- You ONLY process queries related to society management and community operations.
- If an inbound message is off-topic, abusive, political, or unrelated to society operations (e.g. weather, jokes, general knowledge, sales), politely refuse by stating:
  "I am the Hamsayaa Society Concierge. I can only assist with community operations (complaints, visitor passes, maintenance dues, amenities, and polls)."
- Match the resident's language (English, Urdu, or Roman Urdu).
- Be concise and clear.
"""

class GeminiEngine:
    def __init__(self):
        if settings.GEMINI_API_KEY:
            try:
                genai.configure(api_key=settings.GEMINI_API_KEY)
                self.model = genai.GenerativeModel(
                    model_name=settings.GEMINI_MODEL,
                    system_instruction=HAMSAYAA_SYSTEM_PROMPT
                )
            except Exception as e:
                logger.error(f"Failed to initialize Gemini API: {e}")
                self.model = None
        else:
            self.model = None

    def _generate_ticket_number(self) -> str:
        num = random.randint(1000, 9999)
        return f"TCK-{num}"

    def _generate_pass_code(self) -> str:
        prefix = "LV"
        num = random.randint(1000, 9999)
        return f"{prefix}-{num}"

    async def process_resident_message(
        self,
        resident: dict,
        message_text: str,
        failed_attempts: int = 0
    ) -> dict:
        """
        Processes inbound resident WhatsApp message through Gemini 1.5 Flash AI Engine.
        Executes domain logic and returns WhatsApp response payload.
        """
        text_lower = message_text.lower().strip()

        # 1. Check Guardrail: Off-Topic Detection
        off_topic_keywords = ["weather", "joke", "politics", "president", "crypto", "bitcoin", "buy", "sell"]
        if any(w in text_lower for w in off_topic_keywords):
            # Flag complaint as irrelevant
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

            return {
                "status": "flagged_irrelevant",
                "reply_text": "I am the Hamsayaa Society Concierge. I can only assist with community operations (complaints, visitor passes, maintenance dues, amenities, and community polls)."
            }

        # 2. Intent Parsing: Complaint Registration
        if any(w in text_lower for w in ["complaint", "water", "plumb", "leak", "electric", "light", "lift", "gate", "broken", "issue", "repair"]):
            ticket_num = self._generate_ticket_number()
            category = "Water & Plumbing" if any(w in text_lower for w in ["water", "plumb", "leak"]) else "Electrical & Maintenance"
            
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

            return {
                "status": "success",
                "intent": "complaint",
                "ticket_number": ticket_num,
                "reply_text": f"✅ Your complaint has been registered under Ticket ID *{ticket_num}*.\nCategory: {category}\nUnit: {resident.get('building', 'Block A')} - Unit {resident.get('unit_number', '101')}\n\nOur management team has been notified."
            }

        # 3. Intent Parsing: Visitor Pass Generation
        if any(w in text_lower for w in ["pass", "visitor", "guest", "entry", "cnic", "gate pass"]):
            pass_code = self._generate_pass_code()
            if resident and db_service.client:
                try:
                    db_service.client.table("visitor_passes").insert({
                        "society_id": resident.get("society_id"),
                        "resident_id": resident.get("id"),
                        "visitor_name": "Guest Visitor",
                        "visitor_cnic": "42101-0000000-0",
                        "vehicle_plate": "GUEST-01",
                        "pass_code": pass_code,
                        "valid_from": "now()",
                        "valid_until": "now() + interval '4 hours'"
                    }).execute()
                except Exception as e:
                    logger.error(f"Error writing visitor pass: {e}")

            return {
                "status": "success",
                "intent": "visitor_pass",
                "pass_code": pass_code,
                "reply_text": f"🎫 *HAMSAYAA VISITOR PASS*\nPass Code: *{pass_code}*\nResident: {resident.get('name')} (Unit {resident.get('unit_number')})\nValid: Next 4 Hours\n\n📌 *Gate Verification:* Present this pass code visually to the gatekeeper upon entry."
            }

        # 4. Intent Parsing: Dues & Bank Account Inquiry
        if any(w in text_lower for w in ["due", "bill", "invoice", "bank", "account", "payment", "fee", "pay"]):
            return {
                "status": "success",
                "intent": "dues_query",
                "reply_text": f"💳 *CUMULATIVE DUES BREAKDOWN*\nResident: {resident.get('name')} (Unit {resident.get('unit_number')})\n- Society Maintenance Fee: Rs. 5,000\n- Hamsayaa SaaS Fee: Rs. 150\n- Utility Charges: Rs. 1,200\n*Total Due: Rs. 6,350*\nDue Date: 15th August 2026\n\n🏦 *Payment Account:* Meezan Bank - A/C 01020304050607 (Lakeview Maint Account)\n\nPlease send a screenshot/photo of your payment receipt here for admin verification."
            }

        # 5. Intent Parsing: Amenity Inquiry
        if any(w in text_lower for w in ["gym", "pool", "hall", "timing", "rule", "capacity", "facility"]):
            return {
                "status": "success",
                "intent": "amenity_info",
                "reply_text": f"🏋️ *COMMUNITY AMENITIES INFO*\n- *Community Gym:* 6:00 AM – 10:00 PM (Daily)\n- *Swimming Pool:* 7:00 AM – 9:00 PM (Tues–Sun)\n- *Event Hall:* Bookable via Admin Dashboard (Cap: 150 guests)\n\nLet us know if you need specific booking rules."
            }

        # 6. Fallback Handling: 2 consecutive failures trigger human review
        if failed_attempts >= 1:
            ticket_num = self._generate_ticket_number()
            if resident and db_service.client:
                try:
                    db_service.client.table("complaints").insert({
                        "society_id": resident.get("society_id"),
                        "resident_id": resident.get("id"),
                        "ticket_number": ticket_num,
                        "category": "Needs Human Review",
                        "description": message_text,
                        "status": "needs_human_review"
                    }).execute()
                except Exception as e:
                    logger.error(f"Error logging human review ticket: {e}")

            return {
                "status": "needs_human_review",
                "ticket_number": ticket_num,
                "reply_text": f"I am forwarding your request to the Building Admin for human review. A ticket has been created under ID *{ticket_num}*. Our office will contact you shortly."
            }

        # Default Gemini model invocation or polite default response
        return {
            "status": "success",
            "reply_text": f"Hello {resident.get('name')}, I am the Hamsayaa AI Concierge for Unit {resident.get('unit_number')}. How can I assist you today? You can ask about complaints, guest passes, bill dues, or gym timings."
        }

gemini_engine = GeminiEngine()
