from fastapi import APIRouter, UploadFile, File

router = APIRouter()

@router.get("/logs")
async def list_vehicle_logs():
    return {"logs": []}

@router.get("/overstays")
async def list_overstays():
    """
    Returns unregistered vehicles flagged for overstay.
    """
    return {"overstays": []}

@router.post("/logs/bulk-import")
async def bulk_import_vehicle_logs(file: UploadFile = File(...)):
    """
    Import gate vehicle entrance logs via Excel file.
    """
    return {"status": "success", "filename": file.filename, "records_processed": 0}
