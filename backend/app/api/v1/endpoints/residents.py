from fastapi import APIRouter, UploadFile, File, HTTPException, status
from pydantic import BaseModel

router = APIRouter()

class BlockToggleRequest(BaseModel):
    is_blocked: bool

@router.get("/")
async def list_residents():
    return {"residents": []}

@router.patch("/{resident_id}/toggle-block")
async def toggle_block_resident(resident_id: str, payload: BlockToggleRequest):
    """
    Manually toggle account suspension for a resident.
    """
    return {
        "status": "success",
        "resident_id": resident_id,
        "is_blocked": payload.is_blocked,
        "message": f"Resident account block status updated to {payload.is_blocked}"
    }

@router.post("/bulk-import")
async def bulk_import_residents(file: UploadFile = File(...)):
    """
    Bulk import resident roster and registered vehicles via Excel / CSV.
    """
    if not file.filename.endswith(('.xlsx', '.xls', '.csv')):
        raise HTTPException(status_code=400, detail="Invalid file type. Upload Excel or CSV.")
    return {"status": "success", "filename": file.filename, "records_processed": 0}
