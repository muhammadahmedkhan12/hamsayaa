from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel, Field
from typing import Optional
from datetime import date, datetime, timezone
from app.db.supabase import db_service

router = APIRouter()

DEFAULT_SOCIETY_ID = "a1b2c3d4-e5f6-7890-abcd-111111111111"

class AssetCreate(BaseModel):
    name: str = Field(..., min_length=2, example="Main Generator 250kVA - Block A")
    category: Optional[str] = Field("Generators & Power", example="Generators & Power")
    install_date: Optional[date] = Field(None, example="2023-01-15")
    next_service_due: Optional[date] = Field(None, example="2026-10-15")
    society_id: Optional[str] = Field(DEFAULT_SOCIETY_ID)

class AssetUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    install_date: Optional[date] = None
    next_service_due: Optional[date] = None

class MaintenanceLogCreate(BaseModel):
    serviced_at: date = Field(default_factory=date.today)
    notes: str = Field(..., min_length=3, example="Routine inspection, oil and filter replacement.")
    next_due_override: Optional[date] = Field(None, example="2026-12-15")
    society_id: Optional[str] = Field(DEFAULT_SOCIETY_ID)

@router.get("/")
async def list_assets(society_id: str = Query(DEFAULT_SOCIETY_ID)):
    """
    List all society assets (generators, lifts, water pumps, CCTV, etc.)
    with calculated days until next service due.
    """
    assets = db_service.get_assets(society_id=society_id)
    today = date.today()
    
    enriched = []
    for a in assets:
        next_due_str = a.get("next_service_due")
        days_until_due = None
        status_label = "operational"

        if next_due_str:
            try:
                # Handle YYYY-MM-DD or ISO timestamp
                d_val = datetime.strptime(str(next_due_str)[:10], "%Y-%m-%d").date()
                delta = (d_val - today).days
                days_until_due = delta
                if delta < 0:
                    status_label = "overdue"
                elif delta <= 14:
                    status_label = "due_soon"
                else:
                    status_label = "operational"
            except Exception:
                pass

        enriched.append({
            **a,
            "days_until_due": days_until_due,
            "health_status": status_label
        })

    return {"assets": enriched}

@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_asset(payload: AssetCreate):
    """
    Register a new physical community asset in the directory.
    """
    asset_data = {
        "society_id": payload.society_id or DEFAULT_SOCIETY_ID,
        "name": payload.name.strip(),
        "category": payload.category.strip() if payload.category else "General Infrastructure",
        "install_date": payload.install_date.isoformat() if payload.install_date else None,
        "next_service_due": payload.next_service_due.isoformat() if payload.next_service_due else None,
    }
    created = db_service.create_asset(asset_data)
    if not created:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create asset in database."
        )
    return {"status": "success", "asset": created}

@router.patch("/{asset_id}")
async def update_asset(asset_id: str, payload: AssetUpdate):
    """
    Update asset name, category, or service schedule dates.
    """
    update_data = {}
    if payload.name is not None:
        update_data["name"] = payload.name.strip()
    if payload.category is not None:
        update_data["category"] = payload.category.strip()
    if payload.install_date is not None:
        update_data["install_date"] = payload.install_date.isoformat()
    if payload.next_service_due is not None:
        update_data["next_service_due"] = payload.next_service_due.isoformat()

    if not update_data:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No fields provided to update.")

    updated = db_service.update_asset(asset_id, update_data)
    if not updated:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Asset {asset_id} not found or update failed."
        )
    return {"status": "success", "asset": updated}

@router.delete("/{asset_id}")
async def delete_asset(asset_id: str):
    """
    Delete an asset and its associated maintenance records.
    """
    success = db_service.delete_asset(asset_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Failed to delete asset {asset_id}."
        )
    return {"status": "success", "deleted_id": asset_id}

@router.get("/{asset_id}/maintenance-logs")
async def list_maintenance_logs(asset_id: str):
    """
    Retrieve chronological service history logs for a specific asset.
    """
    logs = db_service.get_maintenance_logs(asset_id=asset_id)
    return {"logs": logs}

@router.post("/{asset_id}/maintenance-logs", status_code=status.HTTP_201_CREATED)
async def log_maintenance(asset_id: str, payload: MaintenanceLogCreate):
    """
    Record a new service event for an asset and automatically update its next service due date.
    """
    log_data = {
        "society_id": payload.society_id or DEFAULT_SOCIETY_ID,
        "asset_id": asset_id,
        "serviced_at": payload.serviced_at.isoformat(),
        "notes": payload.notes.strip(),
        "next_due_override": payload.next_due_override.isoformat() if payload.next_due_override else None
    }
    created = db_service.create_maintenance_log(log_data)
    if not created:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to record maintenance log in database."
        )
    return {"status": "success", "log": created}
