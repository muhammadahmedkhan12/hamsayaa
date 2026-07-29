import google.generativeai as genai
from app.core.config import settings

class GeminiEngine:
    def __init__(self):
        if settings.GEMINI_API_KEY:
            genai.configure(api_key=settings.GEMINI_API_KEY)
            self.model = genai.GenerativeModel(settings.GEMINI_MODEL)
        else:
            self.model = None

    async def evaluate_context_guardrail(self, message_text: str, context: dict) -> dict:
        """
        Evaluates inbound resident WhatsApp message through Gemini 1.5 Flash guardrails.
        Returns evaluation status: valid, flagged, or needs_human_review.
        """
        if not self.model:
            return {"status": "valid", "category": "general", "description": message_text}
            
        # Placeholder for Gemini prompt guardrail processing
        return {
            "status": "valid",
            "category": "general_query",
            "description": message_text
        }

gemini_engine = GeminiEngine()
