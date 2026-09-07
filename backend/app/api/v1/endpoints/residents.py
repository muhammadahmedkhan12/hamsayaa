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
    cnic: str = Field(..., min_length=5, max_length=30, example="42101-1234567-1")
    is_owner: bool = True
    is_tenant: bool = False
    vehicle_plate: Optional[str] = Field(default=None, example="KHI-1234")
    document_url: Optional[str] = Field(default=None, example="https://xyz.supabase.co/storage/v1/object/public/society-receipts/documents/doc_123.pdf")

class ResidentUpdate(BaseModel):
    building: Optional[str] = Field(default=None, example="Block A")
    unit_number: Optional[str] = Field(default=None, example="101")
    name: Optional[str] = Field(default=None, example="Muhammad Ahmed")
    phone_number: Optional[str] = Field(default=None, example="+923001234567")
    cnic: Optional[str] = Field(default=None, min_length=5, max_length=30, example="42101-1234567-1")
    is_owner: Optional[bool] = None
    is_tenant: Optional[bool] = None
    is_blocked: Optional[bool] = None
    vehicle_plate: Optional[str] = None
    document_url: Optional[str] = None

class BlockToggleRequest(BaseModel):
    is_blocked: bool

@router.get("")
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

@router.post("")
@router.post("/")
async def create_resident(payload: ResidentCreate, society_id: str = Query(DEFAULT_SOCIETY_ID)):
    """
    Create a new resident record under a specified Building/Block and Unit Number.
    CNIC is compulsory. Document URL is optional and can be attached anytime.
    """
    clean_phone = normalize_phone_number(payload.phone_number)
    if not clean_phone or len(clean_phone) < 8:
        raise HTTPException(status_code=400, detail="Invalid phone number format.")
        
    clean_cnic = payload.cnic.strip() if payload.cnic else ""
    if not clean_cnic or len(clean_cnic) < 5:
        raise HTTPException(status_code=400, detail="CNIC is compulsory and must contain at least 5 characters.")

    # Check if a resident with this phone number already exists
    existing = db_service.get_resident_by_phone(clean_phone)
    if existing:
        bld = existing.get("building", "the society")
        unit = existing.get("unit_number", "")
        name = existing.get("name", "Another resident")
        raise HTTPException(
            status_code=400,
            detail=f"Phone number {clean_phone} is already registered to {name} ({bld}, Unit {unit}). Each resident must have a unique phone number."
        )

    data = {
        "society_id": society_id,
        "building": payload.building.strip(),
        "unit_number": payload.unit_number.strip(),
        "name": payload.name.strip(),
        "phone_number": clean_phone,
        "cnic": clean_cnic,
        "is_owner": payload.is_owner,
        "is_tenant": payload.is_tenant,
        "is_blocked": False,
    }
    if payload.document_url and payload.document_url.strip():
        data["document_url"] = payload.document_url.strip()
    
    try:
        result = db_service.create_resident(data)
    except Exception as e:
        err_str = str(e)
        if "residents_phone_number_key" in err_str or "23505" in err_str:
            raise HTTPException(
                status_code=400,
                detail=f"A resident with phone number {clean_phone} already exists in the database."
            )
        raise HTTPException(
            status_code=500,
            detail=f"Failed to save resident to database: {err_str}"
        )

    if not result:
        raise HTTPException(
            status_code=500,
            detail="Failed to save resident to database. Please check Supabase connection."
        )
    
    # Auto-create initial maintenance invoice for the new resident so they immediately appear in the Finance tab
    if result and isinstance(result, dict) and "id" in result:
        res_id = result["id"]
        try:
            db_service.get_or_create_advance_invoice(society_id, res_id)
        except Exception as e:
            logger.debug(f"Auto-creating invoice for new resident failed: {e}")

        # Register vehicle plate if specified
        if payload.vehicle_plate and payload.vehicle_plate.strip():
            try:
                if db_service.client:
                    db_service.client.table("registered_vehicles").insert({
                        "society_id": society_id,
                        "resident_id": res_id,
                        "plate_number": payload.vehicle_plate.strip().upper(),
                        "vehicle_type": "Car"
                    }).execute()
            except Exception as ev:
                logger.debug(f"Could not register vehicle for new resident: {ev}")
            
    return {"status": "success", "data": result}

@router.patch("/{resident_id}")
async def update_resident(resident_id: str, payload: ResidentUpdate):
    """
    Update an existing resident's details (Name, Phone, compulsory CNIC, Building, Unit, Role, Document, Vehicle).
    """
    update_data = {}
    if payload.name is not None:
        update_data["name"] = payload.name.strip()
    if payload.building is not None:
        update_data["building"] = payload.building.strip()
    if payload.unit_number is not None:
        update_data["unit_number"] = payload.unit_number.strip()
    if payload.phone_number is not None:
        clean_phone = normalize_phone_number(payload.phone_number)
        if not clean_phone or len(clean_phone) < 8:
            raise HTTPException(status_code=400, detail="Invalid phone number format.")
        update_data["phone_number"] = clean_phone
    if payload.cnic is not None:
        clean_cnic = payload.cnic.strip()
        if not clean_cnic or len(clean_cnic) < 5:
            raise HTTPException(status_code=400, detail="CNIC is compulsory and cannot be empty.")
        update_data["cnic"] = clean_cnic
    if payload.is_owner is not None:
        update_data["is_owner"] = payload.is_owner
    if payload.is_tenant is not None:
        update_data["is_tenant"] = payload.is_tenant
    if payload.is_blocked is not None:
        update_data["is_blocked"] = payload.is_blocked
    if payload.document_url is not None:
        update_data["document_url"] = payload.document_url.strip()

    # Update or insert vehicle plate if provided
    if payload.vehicle_plate is not None:
        plate = payload.vehicle_plate.strip().upper()
        try:
            if db_service.client:
                existing_v = db_service.client.table("registered_vehicles").select("id").eq("resident_id", resident_id).execute()
                if plate:
                    if existing_v.data:
                        db_service.client.table("registered_vehicles").update({"plate_number": plate}).eq("resident_id", resident_id).execute()
                    else:
                        db_service.client.table("registered_vehicles").insert({
                            "society_id": DEFAULT_SOCIETY_ID,
                            "resident_id": resident_id,
                            "plate_number": plate,
                            "vehicle_type": "Car"
                        }).execute()
                elif existing_v.data:
                    db_service.client.table("registered_vehicles").delete().eq("resident_id", resident_id).execute()
        except Exception as ex_v:
            logger.debug(f"Could not update vehicle plate for resident {resident_id}: {ex_v}")

    updated = db_service.update_resident(resident_id, update_data)
    if not updated:
        raise HTTPException(status_code=404, detail="Resident not found or update failed")

    return {
        "status": "success",
        "message": "Resident details updated successfully",
        "data": updated
    }

@router.post("/upload-document")
async def upload_resident_document(
    file: UploadFile = File(...)
):
    """
    Upload a resident verification document (PDF, PNG, JPG) to Supabase Storage.
    Returns the public document URL for attaching to a resident profile.
    """
    allowed_types = ["application/pdf", "image/jpeg", "image/png", "image/webp", "image/jpg"]
    content_type = file.content_type or "application/pdf"
    if content_type not in allowed_types and not file.filename.lower().endswith(('.pdf', '.jpg', '.jpeg', '.png', '.webp')):
        raise HTTPException(status_code=400, detail="Unsupported file format. Please upload a PDF or image document.")

    file_bytes = await file.read()
    if len(file_bytes) == 0:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")
    if len(file_bytes) > 20 * 1024 * 1024:  # 20MB limit
        raise HTTPException(status_code=400, detail="File size exceeds 20MB limit.")

    from datetime import datetime, timezone
    safe_filename = re.sub(r"[^a-zA-Z0-9._-]", "_", file.filename)
    timestamp = int(datetime.now(timezone.utc).timestamp())
    unique_filename = f"doc_{timestamp}_{safe_filename}"

    public_url = db_service.upload_document(file_bytes, unique_filename, mime_type=content_type)
    if not public_url:
        raise HTTPException(status_code=500, detail="Failed to upload document to storage.")

    return {
        "status": "success",
        "filename": file.filename,
        "document_url": public_url
    }

@router.post("/{resident_id}/document")
async def attach_resident_document(
    resident_id: str,
    file: UploadFile = File(...)
):
    """
    Directly upload and attach a verification document to an existing resident record.
    """
    upload_res = await upload_resident_document(file)
    doc_url = upload_res.get("document_url")
    updated = db_service.update_resident(resident_id, {"document_url": doc_url})
    return {
        "status": "success",
        "message": "Document attached to resident successfully",
        "document_url": doc_url,
        "data": updated
    }

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

@router.delete("/{resident_id}")
async def delete_resident(resident_id: str):
    """
    Permanently delete a resident record and cascade their associated records.
    """
    success = db_service.delete_resident(resident_id)
    if not success:
        raise HTTPException(status_code=404, detail="Resident not found or could not be deleted")
    return {
        "status": "success",
        "message": "Resident deleted successfully",
        "resident_id": resident_id
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
    unit_number: Optional[str] = Field(default=None, example="221")  # Specific unit number if targeting single apartment
    category: Optional[str] = Field(default="Announcement", example="Water Supply")

@router.post("/broadcast-notification")
async def broadcast_notification(
    payload: BroadcastNotificationRequest,
    society_id: str = Query(DEFAULT_SOCIETY_ID)
):
    """
    Broadcasts an official WhatsApp announcement notification with strict 1-message-per-apartment deduplication.
    Can target Whole Society, a Single Building, or a Specific Apartment.
    """
    from app.services.whatsapp import whatsapp_service
    from app.api.v1.endpoints.whatsapp import redis_client
    import json
    from datetime import datetime, timezone

    target_building = payload.building if payload.building and payload.building != "All" else None
    target_unit = str(payload.unit_number).strip() if payload.unit_number and payload.unit_number != "All" else None

    residents = db_service.get_residents(society_id=society_id, building=target_building)

    # Filter to specific unit if single apartment is selected
    if target_unit:
        residents = [
            r for r in residents
            if str(r.get("unit_number", "")).strip().lower() == target_unit.lower()
        ]

    # Deduplicate: Exactly ONE message per apartment/unit (keyed by building + unit_number)
    # Sort so owner or active tenant is prioritized as primary contact for the apartment
    seen_apartments = set()
    eligible_residents = []

    sorted_residents = sorted(
        residents,
        key=lambda x: (not x.get("is_owner", False), not x.get("is_tenant", False))
    )

    for r in sorted_residents:
        phone = r.get("phone_number")
        if not phone or len(phone) < 8:
            continue

        bld = r.get("building", "General")
        unit = str(r.get("unit_number", "")).strip()
        apt_key = (bld.lower(), unit.lower())

        if apt_key in seen_apartments:
            continue

        seen_apartments.add(apt_key)
        eligible_residents.append(r)

    if not eligible_residents:
        scope_label = f"{target_building} - Unit {target_unit}" if (target_building and target_unit) else (payload.building or "Whole Society")
        return {
            "status": "success",
            "message": f"No active apartment contacts found for target {scope_label}.",
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
                "unit_number": payload.unit_number or "All",
                "targets_count": len(eligible_residents),
                "sent_count": sent_count,
                "failed_count": failed_count,
            }
            redis_client.lpush(f"broadcast_history:{society_id}", json.dumps(log_item))
            redis_client.ltrim(f"broadcast_history:{society_id}", 0, 49)  # Retain last 50 broadcasts
        except Exception as ex:
            logger.debug(f"Redis broadcast logging failed: {ex}")

    if target_unit and target_building:
        scope_name = f"{target_building} - Unit {target_unit}"
    elif target_building:
        scope_name = f"Building {payload.building}"
    else:
        scope_name = "Whole Society"

    return {
        "status": "success",
        "message": f"Broadcast dispatched to {len(eligible_residents)} apartment(s) in {scope_name} (1 message per apartment): {sent_count} sent, {failed_count} failed.",
        "targets_count": len(eligible_residents),
        "sent_count": sent_count,
        "failed_count": failed_count,
        "building": payload.building or "All",
        "unit_number": payload.unit_number or "All",
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
