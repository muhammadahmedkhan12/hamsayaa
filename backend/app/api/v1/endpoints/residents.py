from fastapi import APIRouter, UploadFile, File, HTTPException, Query, status
from pydantic import BaseModel, Field
from typing import Optional
import csv
import io
import re
import logging
from app.db.supabase import db_service

logger = logging.getLogger(__name__)

router = APIRouter()

DEFAULT_SOCIETY_ID = "a1b2c3d4-e5f6-7890-abcd-111111111111"  # Lakeview Apartments

def normalize_phone_number(raw_phone: str) -> str:
    """
    Sanitizes and standardizes phone numbers into E.164-like format (e.g. +923001234567).
    - Strips whitespace, dashes, dots, parentheses.
    - Standardizes Pakistani numbers (03xx -> +923xx, 92xx -> +92xx).
    - Ensures leading '+'.
    """
    if not raw_phone:
        return ""
    cleaned = re.sub(r"[^\d+]", "", raw_phone.strip())
    if cleaned.startswith("00"):
        cleaned = "+" + cleaned[2:]
    if cleaned.startswith("03") and len(cleaned) == 11:
        cleaned = "+92" + cleaned[1:]
    elif cleaned.startswith("3") and len(cleaned) == 10:
        cleaned = "+92" + cleaned
    elif cleaned.startswith("92") and not cleaned.startswith("+"):
        cleaned = "+" + cleaned
    elif not cleaned.startswith("+") and cleaned:
        cleaned = "+" + cleaned
    return cleaned

class ResidentCreate(BaseModel):
    building: str = Field(default="Block A", example="Block A")
    unit_number: str = Field(..., example="101")
    name: str = Field(..., example="Muhammad Ahmed")
    phone_number: str = Field(..., example="+923001234567")
    cnic: Optional[str] = Field(default=None, example="42101-1234567-1")
    is_owner: bool = True
    is_tenant: bool = False
    vehicle_plate: Optional[str] = Field(default=None, example="KHI-1234")

class BlockToggleRequest(BaseModel):
    is_blocked: bool

@router.get("/")
async def list_residents(
    society_id: str = Query(DEFAULT_SOCIETY_ID),
    building: Optional[str] = Query(None)
):
    """
    Fetch residents for a society, optionally filtered by Building/Block.
    """
    residents = db_service.get_residents(society_id=society_id, building=building)
    return {"residents": residents}

@router.post("/")
async def create_resident(payload: ResidentCreate, society_id: str = Query(DEFAULT_SOCIETY_ID)):
    """
    Create a new resident record under a specified Building/Block and Unit Number.
    """
    clean_phone = normalize_phone_number(payload.phone_number)
    if not clean_phone or len(clean_phone) < 8:
        raise HTTPException(status_code=400, detail="Invalid phone number format.")
        
    data = {
        "society_id": society_id,
        "building": payload.building.strip(),
        "unit_number": payload.unit_number.strip(),
        "name": payload.name.strip(),
        "phone_number": clean_phone,
        "cnic": payload.cnic.strip() if payload.cnic else None,
        "is_owner": payload.is_owner,
        "is_tenant": payload.is_tenant,
        "is_blocked": False,
    }
    
    result = db_service.create_resident(data)
    
    # Auto-create initial maintenance invoice for the new resident so they immediately appear in the Finance tab
    if result and isinstance(result, dict) and "id" in result:
        try:
            db_service.get_or_create_advance_invoice(society_id, result["id"])
        except Exception as e:
            logger.debug(f"Auto-creating invoice for new resident failed: {e}")
            
    return {"status": "success", "data": result}

@router.patch("/{resident_id}/toggle-block")
async def toggle_block_resident(resident_id: str, payload: BlockToggleRequest):
    """
    Manually toggle account suspension for a resident (is_blocked).
    """
    result = db_service.toggle_resident_block(resident_id, payload.is_blocked)
    return {
        "status": "success",
        "resident_id": resident_id,
        "is_blocked": payload.is_blocked,
        "data": result,
        "message": f"Resident block status manually updated to {payload.is_blocked}"
    }

@router.post("/bulk-import")
async def bulk_import_residents(
    file: UploadFile = File(...),
    society_id: str = Query(DEFAULT_SOCIETY_ID)
):
    """
    Bulk import resident roster and registered vehicles via CSV / Excel.
    Expected columns: building, unit_number, name, phone_number, cnic, is_owner, is_tenant
    """
    if not file.filename.endswith(('.csv', '.xlsx', '.xls')):
        raise HTTPException(status_code=400, detail="Invalid file type. Upload CSV or Excel file.")

    content = await file.read()
    residents_to_insert = []
    
    if file.filename.endswith('.csv'):
        text_stream = io.StringIO(content.decode("utf-8-sig"))
        reader = csv.DictReader(text_stream)
        for row in reader:
            bld = row.get("building") or row.get("Building") or "Block A"
            unit = row.get("unit_number") or row.get("Unit") or row.get("Unit Number") or "101"
            name = row.get("name") or row.get("Name") or "Resident"
            raw_phone = row.get("phone_number") or row.get("Phone") or ""
            phone = normalize_phone_number(raw_phone)
            if not phone or len(phone) < 8:
                continue
                
            residents_to_insert.append({
                "society_id": society_id,
                "building": bld.strip(),
                "unit_number": str(unit).strip(),
                "name": name.strip(),
                "phone_number": phone,
                "cnic": (row.get("cnic") or row.get("CNIC") or "").strip() or None,
                "is_owner": str(row.get("is_owner", "true")).lower() == "true",
                "is_tenant": str(row.get("is_tenant", "false")).lower() == "true",
                "is_blocked": False,
            })

    result = db_service.bulk_upsert_residents(residents_to_insert)
    if result and isinstance(result, list):
        for r in result:
            if r and isinstance(r, dict) and "id" in r:
                try:
                    db_service.get_or_create_advance_invoice(society_id, r["id"])
                except Exception:
                    pass
    return {
        "status": "success",
        "filename": file.filename,
        "records_imported": len(residents_to_insert),
        "data": result
    }

class BroadcastNotificationRequest(BaseModel):
    title: str = Field(..., min_length=2, max_length=150, example="Scheduled Water Tank Maintenance")
    message: str = Field(..., min_length=5, max_length=2500, example="Water supply will be paused from 2 PM to 5 PM today for routine maintenance.")
    building: Optional[str] = Field(default=None, example="Block A")  # None or "All" for whole society
    category: Optional[str] = Field(default="Announcement", example="Water Supply")

@router.post("/broadcast-notification")
async def broadcast_notification(
    payload: BroadcastNotificationRequest,
    society_id: str = Query(DEFAULT_SOCIETY_ID)
):
    """
    Broadcasts an official WhatsApp announcement notification to all residents of a society
    or to residents of a specific building/block.
    """
    from app.services.whatsapp import whatsapp_service
    from app.api.v1.endpoints.whatsapp import redis_client
    import json
    from datetime import datetime, timezone

    target_building = payload.building if payload.building and payload.building != "All" else None
    residents = db_service.get_residents(society_id=society_id, building=target_building)

    # Filter active, non-blocked residents with valid phone numbers
    eligible_residents = [
        r for r in residents
        if not r.get("is_blocked") and r.get("phone_number") and len(r.get("phone_number", "")) >= 8
    ]

    if not eligible_residents:
        return {
            "status": "success",
            "message": f"No active residents found for target {payload.building or 'Whole Society'}.",
            "targets_count": 0,
            "sent_count": 0,
            "failed_count": 0,
            "failed_recipients": []
        }

    sent_count = 0
    failed_count = 0
    failed_recipients = []

    # Choose emoji based on notification category
    cat_lower = (payload.category or "").lower()
    if "water" in cat_lower:
        category_emoji = "🚰"
    elif "power" in cat_lower or "electric" in cat_lower or "generator" in cat_lower:
        category_emoji = "⚡"
    elif "security" in cat_lower or "alert" in cat_lower:
        category_emoji = "🛡️"
    elif "sanitation" in cat_lower or "fumigation" in cat_lower or "clean" in cat_lower:
        category_emoji = "🧹"
    elif "maintenance" in cat_lower or "repair" in cat_lower:
        category_emoji = "🛠️"
    else:
        category_emoji = "📢"

    for r in eligible_residents:
        phone = r.get("phone_number")
        name = r.get("name", "Resident")
        bld = r.get("building", "Society")
        unit = r.get("unit_number", "")

        # Format official WhatsApp notice (strictly adheres to WhatsApp bold/italic syntax)
        formatted_msg = (
            f"{category_emoji} *SOCIETY NOTICE: {payload.title.upper()}*\n"
            f"Hello *{name}* ({bld} - Unit {unit}),\n\n"
            f"{payload.message.strip()}\n\n"
            f"━━━━━━━━━━━━━━━━━━━━\n"
            f"_Official notice sent by Society Management Office via Hamsayaa._"
        )

        try:
            dispatch_res = await whatsapp_service.send_text_message(phone, formatted_msg)
            if dispatch_res.get("status") != "error":
                sent_count += 1
            else:
                err = dispatch_res.get("response") or dispatch_res.get("message") or "Meta dispatch error"
                failed_count += 1
                failed_recipients.append({"name": name, "unit": unit, "building": bld, "phone": phone, "error": str(err)})
        except Exception as e:
            logger.warning(f"Failed to dispatch broadcast notice to {phone}: {e}")
            failed_count += 1
            failed_recipients.append({"name": name, "unit": unit, "building": bld, "phone": phone, "error": str(e)})

    # Log broadcast to Redis if available
    if redis_client:
        try:
            log_item = {
                "id": f"bc_{int(datetime.now(timezone.utc).timestamp())}",
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "title": payload.title,
                "category": payload.category,
                "building": payload.building or "All",
                "targets_count": len(eligible_residents),
                "sent_count": sent_count,
                "failed_count": failed_count,
            }
            redis_client.lpush(f"broadcast_history:{society_id}", json.dumps(log_item))
            redis_client.ltrim(f"broadcast_history:{society_id}", 0, 49)  # Retain last 50 broadcasts
        except Exception as ex:
            logger.debug(f"Redis broadcast logging failed: {ex}")

    scope_name = f"Building {payload.building}" if target_building else "Whole Society"
    return {
        "status": "success",
        "message": f"Broadcast dispatched to {len(eligible_residents)} residents in {scope_name}: {sent_count} sent, {failed_count} failed.",
        "targets_count": len(eligible_residents),
        "sent_count": sent_count,
        "failed_count": failed_count,
        "building": payload.building or "All",
        "failed_recipients": failed_recipients
    }

@router.get("/broadcast-history")
async def get_broadcast_history(society_id: str = Query(DEFAULT_SOCIETY_ID)):
    """
    Returns recent broadcast notifications dispatched to residents.
    """
    from app.api.v1.endpoints.whatsapp import redis_client
    import json

    if not redis_client:
        return {"history": []}
    try:
        raw_items = redis_client.lrange(f"broadcast_history:{society_id}", 0, 19)
        history = [json.loads(i) for i in raw_items if i]
        return {"history": history}
    except Exception:
        return {"history": []}
