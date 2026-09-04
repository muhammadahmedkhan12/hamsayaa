from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel, Field
from typing import Optional
from app.db.supabase import db_service

router = APIRouter()

DEFAULT_SOCIETY_ID = "a1b2c3d4-e5f6-7890-abcd-111111111111"

class EmployeeCreate(BaseModel):
    name: str = Field(..., min_length=2, example="Mohammad Aslam")
    role: str = Field(..., example="Gate Security Guard")
    contact_info: Optional[str] = Field(None, example="+92 300 1234567")
    shift: Optional[str] = Field("Morning (08:00 - 16:00)", example="Morning (08:00 - 16:00)")
    society_id: Optional[str] = Field(DEFAULT_SOCIETY_ID)

class EmployeeUpdate(BaseModel):
    name: Optional[str] = None
    role: Optional[str] = None
    contact_info: Optional[str] = None
    shift: Optional[str] = None

@router.get("/")
async def list_employees(society_id: str = Query(DEFAULT_SOCIETY_ID)):
    """
    List all staff and non-login personnel (guards, supervisors, technicians) for a society.
    """
    employees = db_service.get_employees(society_id=society_id)
    return {"employees": employees}

@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_employee(payload: EmployeeCreate):
    """
    Create a new employee directory record.
    Security policy note: Employees have no login access or bot permissions.
    """
    emp_data = {
        "society_id": payload.society_id or DEFAULT_SOCIETY_ID,
        "name": payload.name.strip(),
        "role": payload.role.strip(),
        "contact_info": payload.contact_info.strip() if payload.contact_info else None,
        "shift": payload.shift.strip() if payload.shift else "Morning (08:00 - 16:00)"
    }
    created = db_service.create_employee(emp_data)
    if not created:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create employee record in database."
        )
    return {"status": "success", "employee": created}

@router.patch("/{employee_id}")
async def update_employee(employee_id: str, payload: EmployeeUpdate):
    """
    Update an existing employee's role, contact information, or shift assignment.
    """
    update_data = {k: v.strip() if isinstance(v, str) else v for k, v in payload.dict().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No fields provided to update.")
    
    updated = db_service.update_employee(employee_id, update_data)
    if not updated:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Employee {employee_id} not found or update failed."
        )
    return {"status": "success", "employee": updated}

@router.delete("/{employee_id}")
async def delete_employee(employee_id: str):
    """
    Remove an employee record from the directory.
    """
    success = db_service.delete_employee(employee_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Failed to delete employee {employee_id}."
        )
    return {"status": "success", "deleted_id": employee_id}
