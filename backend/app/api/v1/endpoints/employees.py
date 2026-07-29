from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional

router = APIRouter()

class EmployeeCreate(BaseModel):
    name: str
    role: str
    contact_info: Optional[str] = None
    shift: Optional[str] = None

@router.get("/")
async def list_employees():
    return {"employees": []}

@router.post("/")
async def create_employee(employee: EmployeeCreate):
    return {"status": "success", "employee": employee.dict()}
