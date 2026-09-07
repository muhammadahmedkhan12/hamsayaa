import logging
import json
from datetime import datetime, timezone, timedelta
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel, Field

from app.db.supabase import db_service
from app.services.whatsapp import whatsapp_service
from app.api.v1.endpoints.whatsapp import redis_client

logger = logging.getLogger(__name__)
router = APIRouter()

DEFAULT_SOCIETY_ID = "a1b2c3d4-e5f6-7890-abcd-111111111111"
PKT = timezone(timedelta(hours=5))

NUMBER_EMOJIS = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣", "🔟"]


class PollCreate(BaseModel):
    title: str = Field(..., example="Should we upgrade the Block B elevators?")
    options: List[str] = Field(..., example=["Yes", "No", "Abstain"])
    expiry_timestamp: str = Field(..., example="2026-08-15T00:00:00Z")
    society_id: Optional[str] = Field(DEFAULT_SOCIETY_ID)
    send_whatsapp: bool = Field(True, description="Whether to broadcast poll via WhatsApp upon creation")
    building: Optional[str] = Field(None, description="Scope filter (e.g. 'All', 'Block A')")


class PollBroadcastRequest(BaseModel):
    building: Optional[str] = Field(None, example="All")
    society_id: Optional[str] = Field(DEFAULT_SOCIETY_ID)


class VoteCast(BaseModel):
    resident_id: str
    selected_option: str


def _format_expiry_display(iso_timestamp: str) -> str:
    """Format ISO timestamp into human-readable date & time in Pakistan Time (e.g. '15 Aug 2026, 06:00 PM (PKT)')."""
    try:
        dt = datetime.fromisoformat(iso_timestamp.replace("Z", "+00:00"))
        dt_pkt = dt.astimezone(PKT)
        return dt_pkt.strftime("%d %b %Y, %I:%M %p (PKT)")
    except Exception:
        return iso_timestamp


async def _broadcast_poll_whatsapp(
    poll: dict,
    society_id: str,
    building: Optional[str] = None
) -> dict:
    """
    Broadcasts a community poll to residents with strict 1-message-per-apartment deduplication.
    """
    target_building = building if building and building != "All" else None
    residents = db_service.get_residents(society_id=society_id, building=target_building)

    # Strict deduplication: Exactly ONE message per apartment/unit (keyed by building + unit_number)
    # Sort so owner or active tenant is prioritized as primary contact
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
        scope_label = building or "Whole Society"
        return {
            "status": "success",
            "message": f"No active apartment contacts found for target {scope_label}.",
            "targets_count": 0,
            "sent_count": 0,
            "failed_count": 0,
            "failed_recipients": []
        }

    raw_options = poll.get("options") or []
    if isinstance(raw_options, str):
        import json
        try:
            raw_options = json.loads(raw_options)
        except Exception:
            raw_options = [o.strip() for o in raw_options.split(",") if o.strip()]

    options_lines = []
    for idx, opt in enumerate(raw_options):
        prefix = NUMBER_EMOJIS[idx] if idx < len(NUMBER_EMOJIS) else f"{idx+1}."
        options_lines.append(f"{prefix} {opt}")
    options_text = "\n".join(options_lines)

    expiry_formatted = _format_expiry_display(poll.get("expiry_timestamp", ""))
    first_opt = raw_options[0] if raw_options else "Option"

    sent_count = 0
    failed_count = 0
    failed_recipients = []

    for r in eligible_residents:
        phone = r.get("phone_number")
        name = r.get("name", "Resident")
        bld = r.get("building", "Society")
        unit = r.get("unit_number", "")

        formatted_msg = (
            f"🗳️ *COMMUNITY POLL: {poll.get('title', '').upper()}*\n\n"
            f"Dear Resident *{name}* ({bld} - Unit {unit}),\n"
            f"Management has opened an official community poll:\n\n"
            f"❓ *Question:*\n"
            f"_{poll.get('title')}_\n\n"
            f"📋 *Options:*\n"
            f"{options_text}\n\n"
            f"⏳ *Voting Deadline:* {expiry_formatted}\n\n"
            f"👉 *How to Vote:*\n"
            f"Simply reply directly to this WhatsApp message with your choice (e.g. reply *\"1\"* or *\"{first_opt}\"*).\n"
            f"_Note: Strict 1 vote per apartment applies._\n"
            f"━━━━━━━━━━━━━━━━━━━━\n"
            f"_Official Community Poll • Hamsayaa_"
        )

        try:
            dispatch_res = await whatsapp_service.send_text_message(phone, formatted_msg)
            if dispatch_res.get("status") != "error":
                sent_count += 1
                if redis_client:
                    try:
                        clean_phone = phone.replace("+", "").replace(" ", "").replace("-", "")
                        # Save active poll session for resident so replies map to this poll
                        redis_client.set(f"resident_active_poll:{clean_phone}", str(poll.get("id")), ex=7 * 86400)
                        # Append outbound poll notification to chat history so Gemini has 100% conversational context
                        history_key = f"chat_history:{clean_phone}"
                        redis_client.rpush(history_key, json.dumps({"role": "assistant", "text": formatted_msg}))
                        redis_client.expire(history_key, 86400)
                    except Exception as e:
                        logger.debug(f"Redis save poll context error for {phone}: {e}")
            else:
                err = dispatch_res.get("response") or dispatch_res.get("message") or "Meta dispatch error"
                failed_count += 1
                failed_recipients.append({"name": name, "unit": unit, "building": bld, "phone": phone, "error": str(err)})
        except Exception as e:
            logger.warning(f"Failed to dispatch poll notice to {phone}: {e}")
            failed_count += 1
            failed_recipients.append({"name": name, "unit": unit, "building": bld, "phone": phone, "error": str(e)})

    scope_name = target_building if target_building else "Whole Society"
    return {
        "status": "success",
        "message": f"Poll dispatched to {len(eligible_residents)} apartment(s) in {scope_name} (1 message per apartment): {sent_count} sent, {failed_count} failed.",
        "targets_count": len(eligible_residents),
        "sent_count": sent_count,
        "failed_count": failed_count,
        "failed_recipients": failed_recipients
    }


@router.get("")
@router.get("/")
async def list_polls(society_id: str = Query(DEFAULT_SOCIETY_ID)):
    """
    List all active and closed community polls.
    """
    polls = db_service.get_polls(society_id=society_id)
    return {"polls": polls}


@router.post("")
@router.post("/")
async def create_new_poll(payload: PollCreate):
    """
    Create a new society digital poll and optionally broadcast to residents via WhatsApp.
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

    broadcast_info = None
    if payload.send_whatsapp:
        broadcast_info = await _broadcast_poll_whatsapp(
            poll=result,
            society_id=payload.society_id or DEFAULT_SOCIETY_ID,
            building=payload.building
        )

    return {
        "status": "success",
        "poll": result,
        "broadcast": broadcast_info
    }


@router.post("/{poll_id}/broadcast")
async def broadcast_poll(poll_id: str, payload: PollBroadcastRequest = PollBroadcastRequest()):
    """
    Broadcast or re-broadcast an active community poll to residents on WhatsApp.
    """
    poll = db_service.get_poll_by_id(poll_id)
    if not poll:
        raise HTTPException(status_code=404, detail="Poll not found")
    if poll.get("is_closed"):
        raise HTTPException(status_code=400, detail="Cannot broadcast a closed poll")

    soc_id = payload.society_id or poll.get("society_id") or DEFAULT_SOCIETY_ID
    broadcast_info = await _broadcast_poll_whatsapp(
        poll=poll,
        society_id=soc_id,
        building=payload.building
    )
    return {
        "status": "success",
        "poll_id": poll_id,
        **broadcast_info
    }


@router.patch("/{poll_id}/close")
async def close_existing_poll(poll_id: str):
    """
    Manually close an active poll.
    """
    result = db_service.close_poll(poll_id)
    if not result:
        raise HTTPException(status_code=404, detail="Poll not found")
    return {"status": "success", "poll": result}

@router.delete("/{poll_id}")
async def delete_existing_poll(poll_id: str):
    """
    Delete a closed or existing poll and its associated votes from the database.
    """
    poll = db_service.get_poll_by_id(poll_id)
    if not poll:
        raise HTTPException(status_code=404, detail="Poll not found")
    success = db_service.delete_poll(poll_id)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to delete poll")
    return {"status": "success", "message": f"Poll '{poll.get('title')}' deleted successfully"}


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
    if not result or result.get("status") == "error":
        raise HTTPException(status_code=500, detail="Failed to cast vote")
    if result.get("status") == "expired":
        raise HTTPException(status_code=400, detail="Voting for this poll has ended. No further votes can be accepted.")
    if result.get("status") == "already_voted":
        return {
            "status": "already_voted",
            "message": f"Resident has already voted for '{result.get('existing_option')}'.",
            "existing_option": result.get("existing_option")
        }
    if result.get("status") == "updated":
        return {
            "status": "updated",
            "message": f"Resident vote updated from '{result.get('previous_option')}' to '{result.get('new_option')}'.",
            "previous_option": result.get("previous_option"),
            "new_option": result.get("new_option"),
            "vote": result.get("vote")
        }
    return {"status": "success", "vote": result.get("vote")}

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
