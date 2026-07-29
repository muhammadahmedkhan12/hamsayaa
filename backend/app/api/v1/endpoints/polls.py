from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel, Field
from typing import List, Optional
from app.db.supabase import db_service

router = APIRouter()

DEFAULT_SOCIETY_ID = "a1b2c3d4-e5f6-7890-abcd-111111111111"

class PollCreate(BaseModel):
    title: str = Field(..., example="Should we upgrade the Block B elevators?")
    options: List[str] = Field(..., example=["Yes", "No", "Abstain"])
    expiry_timestamp: str = Field(..., example="2026-08-15T00:00:00Z")
    society_id: Optional[str] = Field(DEFAULT_SOCIETY_ID)

class VoteCast(BaseModel):
    resident_id: str
    selected_option: str

@router.get("/")
async def list_polls(society_id: str = Query(DEFAULT_SOCIETY_ID)):
    """
    List all active and closed community polls.
    """
    polls = db_service.get_polls(society_id=society_id)
    return {"polls": polls}

@router.post("/")
async def create_new_poll(payload: PollCreate):
    """
    Create a new society digital poll.
    """
    poll_data = {
        "society_id": payload.society_id or DEFAULT_SOCIETY_ID,
        "title": payload.title,
        "options": payload.options,
        "expiry_timestamp": payload.expiry_timestamp,
        "is_closed": False
    }
    result = db_service.create_poll(poll_data)
    if not result:
        raise HTTPException(status_code=500, detail="Failed to create poll")
    return {"status": "success", "poll": result}

@router.patch("/{poll_id}/close")
async def close_existing_poll(poll_id: str):
    """
    Manually close an active poll.
    """
    result = db_service.close_poll(poll_id)
    if not result:
        raise HTTPException(status_code=404, detail="Poll not found")
    return {"status": "success", "poll": result}

@router.post("/{poll_id}/vote")
async def cast_poll_vote(poll_id: str, payload: VoteCast):
    """
    Cast/simulate a vote for a resident on a specific poll.
    """
    result = db_service.cast_vote(
        poll_id=poll_id,
        resident_id=payload.resident_id,
        selected_option=payload.selected_option
    )
    if not result:
        raise HTTPException(status_code=500, detail="Failed to cast vote or duplicate vote detected")
    return {"status": "success", "vote": result}

@router.get("/{poll_id}/report")
async def export_poll_report(poll_id: str, format: str = Query("pdf")):
    """
    Generate a download URL for a completed poll's results report.
    """
    return {
        "status": "success",
        "poll_id": poll_id,
        "format": format,
        "download_url": f"https://your-project-id.supabase.co/storage/v1/object/public/reports/poll_report_{poll_id}.{format}"
    }
