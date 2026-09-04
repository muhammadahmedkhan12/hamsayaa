from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel, Field
from typing import Optional
from app.db.supabase import db_service

router = APIRouter()

DEFAULT_SOCIETY_ID = "a1b2c3d4-e5f6-7890-abcd-111111111111"

class AmenityCreate(BaseModel):
    name: str = Field(..., min_length=2, example="Rooftop Swimming Pool")
    description: Optional[str] = Field(None, example="Semi-Olympic pool with separate shallow kids area.")
    timings: Optional[str] = Field("06:00 - 22:00 Daily", example="06:00 - 22:00 Daily")
    rules: Optional[str] = Field(None, example="Proper swimwear required. No glass containers. Children under 12 must be supervised.")
    capacity: Optional[int] = Field(30, example=30)
    is_bookable: Optional[bool] = Field(False, example=False)
    society_id: Optional[str] = Field(DEFAULT_SOCIETY_ID)

class AmenityUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    timings: Optional[str] = None
    rules: Optional[str] = None
    capacity: Optional[int] = None
    is_bookable: Optional[bool] = None

@router.get("/")
async def list_amenities(society_id: Optional[str] = Query(None)):
    """
    List all community amenities, facility rules, and schedules.
    These records are also dynamically referenced by the Gemini WhatsApp bot.
    """
    target_id = society_id if isinstance(society_id, str) and society_id else DEFAULT_SOCIETY_ID
    amenities = db_service.get_amenities(target_id)
    return {"amenities": amenities}

@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_amenity(payload: AmenityCreate):
    """
    Add a new community facility / amenity.
    """
    target_id = payload.society_id or DEFAULT_SOCIETY_ID
    amenity_data = {
        "society_id": target_id,
        "name": payload.name.strip(),
        "description": payload.description.strip() if payload.description else None,
        "timings": payload.timings.strip() if payload.timings else "06:00 - 22:00 Daily",
        "rules": payload.rules.strip() if payload.rules else None,
        "capacity": payload.capacity,
        "is_bookable": payload.is_bookable or False
    }
    created = db_service.create_amenity(amenity_data)
    if not created:
        raise HTTPException(status_code=500, detail="Failed to create amenity record in database.")
    return {"status": "success", "amenity": created}

@router.patch("/{amenity_id}")
async def update_amenity(amenity_id: str, payload: AmenityUpdate):
    """
    Update amenity timings, capacity, or guidelines.
    """
    update_data = {k: v.strip() if isinstance(v, str) else v for k, v in payload.dict().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields provided to update.")
    
    updated = db_service.update_amenity(amenity_id, update_data)
    if not updated:
        raise HTTPException(status_code=404, detail="Amenity not found or update failed.")
    return {"status": "success", "amenity": updated}

@router.delete("/{amenity_id}")
async def delete_amenity(amenity_id: str):
    """
    Remove an amenity from the directory.
    """
    success = db_service.delete_amenity(amenity_id)
    if not success:
        raise HTTPException(status_code=404, detail="Failed to delete amenity.")
    return {"status": "success", "deleted_id": amenity_id}
