from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel, Field
from typing import Optional
from app.db.supabase import db_service
from app.services.gemini import gemini_engine
from app.services.whatsapp import whatsapp_service

router = APIRouter()

class WhatsAppSimulateRequest(BaseModel):
    phone_number: str = Field(default="+923001234567", example="+923001234567")
    message_text: str = Field(..., example="Corridor light flickering near Unit 101 elevator")
    failed_attempts: int = Field(default=0, example=0)

@router.post("/test-simulate")
async def simulate_whatsapp_message(payload: WhatsAppSimulateRequest):
    """
    Developer Simulation Endpoint to test the WhatsApp Gemini AI Concierge Engine.
    Simulates inbound WhatsApp resident queries and evaluates guardrails, resident block status, ticket creation, and visitor pass generation.
    """
    clean_phone = payload.phone_number.strip()
    if not clean_phone.startswith("+"):
        clean_phone = "+" + clean_phone

    # 1. Resident Lookup
    resident = None
    if db_service.client:
        try:
            res = db_service.client.table("residents").select("*").eq("phone_number", clean_phone).execute()
            if res.data and len(res.data) > 0:
                resident = res.data[0]
        except Exception as e:
            pass

    # Mock resident fallback if DB is not populated locally
    if not resident:
        if clean_phone == "+923003456789":
            resident = {
                "id": "r3333333-3333-3333-3333-333333333333",
                "society_id": "a1b2c3d4-e5f6-7890-abcd-111111111111",
                "name": "Bilal Sheikh",
                "building": "Block B",
                "unit_number": "201",
                "phone_number": "+923003456789",
                "is_blocked": True, # Suspended resident
            }
        else:
            resident = {
                "id": "r1111111-1111-1111-1111-111111111111",
                "society_id": "a1b2c3d4-e5f6-7890-abcd-111111111111",
                "name": "Muhammad Ahmed",
                "building": "Block A",
                "unit_number": "101",
                "phone_number": clean_phone,
                "is_blocked": False,
            }

    # 2. Check Blocked Status
    if resident.get("is_blocked"):
        block_reply = (
            "⚠️ *ACCOUNT ACCESS SUSPENDED*\n"
            f"Hello {resident.get('name')}, your WhatsApp bot access is currently suspended due to overdue maintenance dues.\n\n"
            "🏦 *Payment Account Details:*\n"
            "Meezan Bank - A/C 01020304050607 (Lakeview Maint Account)\n\n"
            "Please send a screenshot of your payment receipt to building management to restore access."
        )
        return {
            "simulation_result": "resident_blocked",
            "phone_number": clean_phone,
            "resident_name": resident.get("name"),
            "is_blocked": True,
            "outbound_whatsapp_reply": block_reply
        }

    # 3. Process via Gemini Engine
    ai_response = await gemini_engine.process_resident_message(
        resident=resident,
        message_text=payload.message_text,
        failed_attempts=payload.failed_attempts
    )

    return {
        "simulation_result": "success",
        "phone_number": clean_phone,
        "resident_name": resident.get("name"),
        "building": resident.get("building"),
        "unit_number": resident.get("unit_number"),
        "is_blocked": False,
        "inbound_message": payload.message_text,
        "ai_engine_output": ai_response,
        "outbound_whatsapp_reply": ai_response.get("reply_text")
    }
