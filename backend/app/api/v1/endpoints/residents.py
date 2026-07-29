from fastapi import APIRouter, UploadFile, File, HTTPException, Query, status
from pydantic import BaseModel, Field
from typing import Optional
import csv
import io
from app.db.supabase import db_service

router = APIRouter()

DEFAULT_SOCIETY_ID = "a1b2c3d4-e5f6-7890-abcd-111111111111"  # Lakeview Apartments

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
    # Clean phone number
    clean_phone = payload.phone_number.strip()
    if not clean_phone.startswith("+"):
        clean_phone = "+" + clean_phone
        
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
            phone = row.get("phone_number") or row.get("Phone") or ""
            if not phone:
                continue
            if not phone.startswith("+"):
                phone = "+" + phone
                
            residents_to_insert.append({
                "society_id": society_id,
                "building": bld.strip(),
                "unit_number": str(unit).strip(),
                "name": name.strip(),
                "phone_number": phone.strip(),
                "cnic": row.get("cnic") or row.get("CNIC"),
                "is_owner": row.get("is_owner", "true").lower() == "true",
                "is_tenant": row.get("is_tenant", "false").lower() == "true",
                "is_blocked": False,
            })

    result = db_service.bulk_upsert_residents(residents_to_insert)
    return {
        "status": "success",
        "filename": file.filename,
        "records_imported": len(residents_to_insert),
        "data": result
    }
