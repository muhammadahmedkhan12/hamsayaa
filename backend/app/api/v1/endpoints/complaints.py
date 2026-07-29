from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel, Field
from typing import Optional
from app.db.supabase import db_service

router = APIRouter()

DEFAULT_SOCIETY_ID = "a1b2c3d4-e5f6-7890-abcd-111111111111"

class ComplaintStatusUpdate(BaseModel):
    status: str = Field(..., example="resolved")

@router.get("/")
async def list_complaints(
    society_id: str = Query(DEFAULT_SOCIETY_ID),
    status: Optional[str] = Query(None)
):
    """
    List resident complaints for a society, optionally filtered by status.
    """
    complaints = db_service.get_complaints(society_id=society_id, status=status)
    return {"complaints": complaints}

@router.patch("/{complaint_id}")
async def update_complaint_status(complaint_id: str, payload: ComplaintStatusUpdate):
    """
    Update complaint ticket status (e.g. open, in_progress, resolved).
    """
    result = db_service.update_complaint_status(complaint_id, payload.status)
    return {
        "status": "success",
        "complaint_id": complaint_id,
        "new_status": payload.status,
        "data": result
    }

@router.get("/summary")
async def get_dashboard_summary(society_id: str = Query(DEFAULT_SOCIETY_ID)):
    """
    Aggregated dashboard metric summary for Screen 1 Overview page.
    """
    summary = db_service.get_dashboard_summary(society_id=society_id)
    return {"summary": summary}
