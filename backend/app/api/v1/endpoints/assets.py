from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional
from datetime import date

router = APIRouter()

class AssetCreate(BaseModel):
    name: str
    category: Optional[str] = None
    install_date: Optional[date] = None
    next_service_due: Optional[date] = None

@router.get("/")
async def list_assets():
    return {"assets": []}

@router.post("/")
async def create_asset(asset: AssetCreate):
    return {"status": "success", "asset": asset.dict()}
