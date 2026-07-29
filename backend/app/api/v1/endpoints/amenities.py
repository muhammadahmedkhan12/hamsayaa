from fastapi import APIRouter

router = APIRouter()

@router.get("/")
async def list_amenities():
    return {"amenities": []}
