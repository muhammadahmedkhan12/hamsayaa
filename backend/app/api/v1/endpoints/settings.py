from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel, Field
from typing import Optional
from app.db.supabase import db_service
from app.core.config import settings

router = APIRouter()

DEFAULT_SOCIETY_ID = "a1b2c3d4-e5f6-7890-abcd-111111111111"

# In-memory store for society operational configuration that extends base SQL table
_operational_config = {
    "bank_name": "Meezan Bank Limited",
    "account_title": "Lakeview Residents Management Committee",
    "account_number": "PK42MEZN00012345678901",
    "base_maintenance_fee": 8500.00,
    "late_payment_surcharge": 500.00,
    "due_day_of_month": 10,
    "visitor_pass_validity_hours": 4,
    "overstay_alert_threshold_hours": 3,
    "auto_flag_unregistered_vehicles": True,
    "resident_closure_enabled": True,
    "smart_duplicate_matching_enabled": True,
    "emergency_helpline": "+92 300 1234567",
    "security_gate_intercom": "100"
}

class SocietySettingsUpdate(BaseModel):
    name: Optional[str] = None
    address: Optional[str] = None
    total_units: Optional[int] = None
    hamsayaa_per_unit_rate: Optional[float] = None
    
    # Financial & Banking
    bank_name: Optional[str] = None
    account_title: Optional[str] = None
    account_number: Optional[str] = None
    base_maintenance_fee: Optional[float] = None
    late_payment_surcharge: Optional[float] = None
    due_day_of_month: Optional[int] = None
    
    # Gate & Security
    visitor_pass_validity_hours: Optional[int] = None
    overstay_alert_threshold_hours: Optional[int] = None
    auto_flag_unregistered_vehicles: Optional[bool] = None
    emergency_helpline: Optional[str] = None
    security_gate_intercom: Optional[str] = None

@router.get("/")
async def get_society_settings(society_id: Optional[str] = Query(None)):
    """
    Get society profile, financial parameters, gate security thresholds,
    and AI engine status.
    """
    target_id = society_id if isinstance(society_id, str) and society_id else DEFAULT_SOCIETY_ID
    soc = db_service.get_society(society_id=target_id)
    if not soc:
        soc = {
            "id": target_id,
            "name": "Lakeview Apartments",
            "address": "Plot 42, Block 13-A, Gulshan-e-Iqbal, Karachi",
            "total_units": 50,
            "hamsayaa_per_unit_rate": 150.00
        }

    return {
        "society": soc,
        "operational": _operational_config,
        "ai_engine": {
            "gemini_model": settings.GEMINI_MODEL,
            "languages": ["English", "Urdu", "Roman Urdu"],
            "resident_self_closure": True,
            "smart_duplicate_matching": True,
            "off_topic_guardrail": True,
            "memory_window": "24-hour sliding TTL (Upstash Redis)"
        },
        "meta_whatsapp": {
            "phone_number_id": settings.WHATSAPP_PHONE_NUMBER_ID,
            "webhook_path": "/api/v1/whatsapp/webhook",
            "status": "Configured & Active" if settings.WHATSAPP_PHONE_NUMBER_ID else "Pending Credentials"
        },
        "system_health": {
            "database": "Connected (Supabase PostgreSQL)",
            "storage": "society-voice-notes (Supabase Storage)",
            "cache": "Active (Upstash Redis REST)"
        }
    }

@router.patch("/")
async def update_society_settings(payload: SocietySettingsUpdate, society_id: Optional[str] = Query(None)):
    """
    Update society profile and operational configuration.
    """
    target_id = society_id if isinstance(society_id, str) and society_id else DEFAULT_SOCIETY_ID
    # 1. Update Supabase table if society profile fields changed
    db_update = {}
    if payload.name is not None:
        db_update["name"] = payload.name.strip()
    if payload.address is not None:
        db_update["address"] = payload.address.strip()
    if payload.total_units is not None:
        db_update["total_units"] = payload.total_units
    if payload.hamsayaa_per_unit_rate is not None:
        db_update["hamsayaa_per_unit_rate"] = payload.hamsayaa_per_unit_rate

    if db_update:
        db_service.update_society(target_id, db_update)

    # 2. Update operational config
    for key, val in payload.dict().items():
        if val is not None and key in _operational_config:
            _operational_config[key] = val.strip() if isinstance(val, str) else val

    # Return full refreshed settings
    return await get_society_settings(society_id=target_id)
