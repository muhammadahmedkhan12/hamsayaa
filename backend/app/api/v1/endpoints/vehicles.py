from fastapi import APIRouter, HTTPException, Query, UploadFile, File, status
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, timezone, timedelta
import io
import csv
from app.db.supabase import db_service

router = APIRouter()

DEFAULT_SOCIETY_ID = "a1b2c3d4-e5f6-7890-abcd-111111111111"
OVERSTAY_THRESHOLD_HOURS = 3  # Standard society policy: 3 hours for guest vehicles

class VehicleLogCreate(BaseModel):
    vehicle_plate: str = Field(..., min_length=3, example="KHI-8921")
    entry_time: Optional[str] = None
    source: Optional[str] = Field("manual", example="manual")
    society_id: Optional[str] = Field(DEFAULT_SOCIETY_ID)

class CameraDetectionEvent(BaseModel):
    vehicle_plate: str = Field(..., min_length=3, example="LEB-4412")
    camera_id: Optional[str] = Field("Gate-1-Entrance", example="Gate-1-Entrance")
    society_id: Optional[str] = Field(DEFAULT_SOCIETY_ID)

def _enrich_log(log: dict, reg_map: dict) -> dict:
    """Calculates time inside complex and computes dynamic overstay flags."""
    plate = log.get("vehicle_plate", "").strip().upper()
    is_reg = log.get("is_registered", False) or (plate in reg_map)
    resident_info = reg_map.get(plate)

    entry_str = log.get("entry_time")
    exit_str = log.get("exit_time")
    
    now = datetime.now(timezone.utc)
    duration_mins = None
    is_overstay = log.get("is_flagged_overstay", False)

    if entry_str:
        try:
            # Parse ISO timestamp
            clean_ts = entry_str.replace("Z", "+00:00")
            e_dt = datetime.fromisoformat(clean_ts)
            if exit_str:
                clean_exit = exit_str.replace("Z", "+00:00")
                x_dt = datetime.fromisoformat(clean_exit)
                duration_mins = int((x_dt - e_dt).total_seconds() / 60)
            else:
                duration_mins = int((now - e_dt).total_seconds() / 60)
                # If guest vehicle is inside > OVERSTAY_THRESHOLD_HOURS, flag as overstay
                if not is_reg and duration_mins > (OVERSTAY_THRESHOLD_HOURS * 60):
                    is_overstay = True
        except Exception:
            pass

    return {
        **log,
        "vehicle_plate": plate,
        "is_registered": is_reg,
        "is_flagged_overstay": is_overstay,
        "duration_minutes": duration_mins,
        "is_inside": exit_str is None,
        "resident_name": resident_info.get("residents", {}).get("name") if resident_info else None,
        "resident_unit": f"{resident_info.get('residents', {}).get('building', '')} {resident_info.get('residents', {}).get('unit_number', '')}".strip() if resident_info else None,
    }

@router.get("/logs")
async def list_vehicle_logs(society_id: Optional[str] = Query(None)):
    """
    Returns all gate vehicle entry and exit logs, dynamically enriched
    with resident registration status and overstay calculations.
    """
    target_id = society_id if isinstance(society_id, str) and society_id else DEFAULT_SOCIETY_ID
    
    # Fetch registered vehicles map
    reg_list = db_service.get_registered_vehicles(target_id)
    reg_map = {r.get("vehicle_plate", "").strip().upper(): r for r in reg_list}

    # Fetch logs
    raw_logs = db_service.get_vehicle_logs(target_id)
    enriched = [_enrich_log(l, reg_map) for l in raw_logs]
    
    return {"logs": enriched}

@router.get("/overstays")
async def list_overstays(society_id: Optional[str] = Query(None)):
    """
    Returns unregistered/visitor vehicles currently inside that exceed
    the allowed stay duration threshold.
    """
    all_logs_res = await list_vehicle_logs(society_id=society_id)
    logs = all_logs_res.get("logs", [])
    overstays = [l for l in logs if l.get("is_inside") and l.get("is_flagged_overstay")]
    return {"overstays": overstays}

@router.post("/logs", status_code=status.HTTP_201_CREATED)
async def create_manual_log(payload: VehicleLogCreate):
    """
    Manual gatekeeper/admin entry log.
    Automatically checks if plate belongs to a registered resident.
    """
    target_id = payload.society_id or DEFAULT_SOCIETY_ID
    log_data = {
        "society_id": target_id,
        "vehicle_plate": payload.vehicle_plate.strip().upper(),
        "source": payload.source or "manual",
        "entry_time": payload.entry_time or datetime.now(timezone.utc).isoformat()
    }
    created = db_service.create_vehicle_log(log_data)
    if not created:
        raise HTTPException(status_code=500, detail="Failed to log vehicle entry in database.")
    
    return {"status": "success", "log": created}

@router.post("/camera-event", status_code=status.HTTP_201_CREATED)
async def camera_detection_event(payload: CameraDetectionEvent):
    """
    ANPR Camera Webhook / Simulator endpoint.
    Ready to receive automated license plate recognition payloads from CCTV / camera hardware.
    """
    target_id = payload.society_id or DEFAULT_SOCIETY_ID
    log_data = {
        "society_id": target_id,
        "vehicle_plate": payload.vehicle_plate.strip().upper(),
        "source": "camera",
        "entry_time": datetime.now(timezone.utc).isoformat()
    }
    created = db_service.create_vehicle_log(log_data)
    if not created:
        raise HTTPException(status_code=500, detail="Failed to log camera detection event.")

    return {
        "status": "success",
        "message": f"ANPR Camera [{payload.camera_id}] logged vehicle {payload.vehicle_plate}",
        "log": created
    }

@router.patch("/logs/{log_id}/exit")
async def mark_vehicle_exit(log_id: str):
    """
    Record vehicle exit timestamp and clear active overstay flag.
    """
    updated = db_service.mark_vehicle_exit(log_id)
    if not updated:
        raise HTTPException(status_code=404, detail="Vehicle log record not found or already closed.")
    return {"status": "success", "log": updated}

@router.post("/logs/bulk-import")
async def bulk_import_vehicle_logs(file: UploadFile = File(...), society_id: Optional[str] = Query(None)):
    """
    Bulk import gate entry records from CSV / Excel export.
    """
    target_id = society_id if isinstance(society_id, str) and society_id else DEFAULT_SOCIETY_ID
    content = await file.read()
    records_processed = 0

    try:
        # Try decoding as CSV
        text = content.decode("utf-8-sig", errors="ignore")
        reader = csv.DictReader(io.StringIO(text))
        for row in reader:
            # Look for plate in common column names
            plate = (
                row.get("vehicle_plate") or 
                row.get("Plate") or 
                row.get("plate") or 
                row.get("License Plate") or 
                row.get("Number Plate") or ""
            ).strip().upper()

            if plate:
                entry_time = row.get("entry_time") or row.get("Entry Time") or datetime.now(timezone.utc).isoformat()
                db_service.create_vehicle_log({
                    "society_id": target_id,
                    "vehicle_plate": plate,
                    "entry_time": entry_time,
                    "source": "excel_import"
                })
                records_processed += 1
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse import file: {str(e)}")

    return {
        "status": "success",
        "filename": file.filename,
        "records_processed": records_processed
    }
