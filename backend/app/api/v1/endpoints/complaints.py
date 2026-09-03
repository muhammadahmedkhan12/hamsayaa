from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel, Field
from typing import Optional
from app.db.supabase import db_service
from app.services.whatsapp import whatsapp_service

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
    When resolved, automatically sends a WhatsApp notification to the resident.
    """
    # Fetch the complaint details before updating
    complaint_data = None
    resident_data = None
    if db_service.client:
        try:
            comp_res = db_service.client.table("complaints").select("*, residents(name, phone_number, unit_number, building)").eq("id", complaint_id).limit(1).execute()
            if comp_res.data:
                complaint_data = comp_res.data[0]
                resident_data = complaint_data.get("residents")
        except Exception:
            pass

    result = db_service.update_complaint_status(complaint_id, payload.status)

    # Send WhatsApp notification when complaint is resolved
    if payload.status == "resolved" and resident_data:
        phone = resident_data.get("phone_number", "")
        name = resident_data.get("name", "Resident")
        ticket_num = complaint_data.get("ticket_number", "N/A")
        category = complaint_data.get("category", "Maintenance")
        description = complaint_data.get("description", "")

        resolution_msg = (
            f"✅ *COMPLAINT RESOLVED*\n\n"
            f"Hello {name}, great news! Your complaint has been resolved:\n\n"
            f"• *Ticket ID:* {ticket_num}\n"
            f"• *Category:* {category}\n"
            f"• *Issue:* \"{description}\"\n"
            f"• *Status:* ✅ Resolved\n\n"
            f"If the issue persists, simply send us a message and we'll reopen it. Thank you for your patience! 🏠"
        )

        try:
            await whatsapp_service.send_text_message(phone, resolution_msg)
            print(f"--> [WhatsApp] Sent resolution notification to {name} ({phone}) for {ticket_num}")
        except Exception as e:
            print(f"--> [WhatsApp] Failed to send resolution notification: {e}")

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

