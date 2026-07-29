from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel, Field
from typing import Optional
from datetime import date
from app.db.supabase import db_service

router = APIRouter()

DEFAULT_SOCIETY_ID = "a1b2c3d4-e5f6-7890-abcd-111111111111"

class InvoiceGenerateRequest(BaseModel):
    society_maintenance_fee: float = Field(default=5000.0, example=5000.0)
    hamsayaa_saas_fee: float = Field(default=150.0, example=150.0)
    utility_charges: float = Field(default=1200.0, example=1200.0)
    due_date: str = Field(..., example="2026-08-15")
    account_shown: str = Field(default="Meezan Bank - A/C 01020304050607 - Lakeview Maint Account")

class InvoiceUpdateRequest(BaseModel):
    society_maintenance_fee: Optional[float] = None
    hamsayaa_saas_fee: Optional[float] = None
    utility_charges: Optional[float] = None
    due_date: Optional[str] = None
    status: Optional[str] = None
    account_shown: Optional[str] = None

class ReceiptVerifyRequest(BaseModel):
    verified_by: Optional[str] = None

@router.get("/")
async def list_invoices(
    society_id: str = Query(DEFAULT_SOCIETY_ID),
    status: Optional[str] = Query(None)
):
    """
    List resident cumulative invoices for a society.
    """
    invoices = db_service.get_invoices(society_id=society_id, status=status)
    return {"invoices": invoices}

@router.post("/generate")
async def generate_cycle_invoices(
    payload: InvoiceGenerateRequest,
    society_id: str = Query(DEFAULT_SOCIETY_ID)
):
    """
    Generate cumulative monthly cycle invoices for all active units in a society.
    """
    result = db_service.generate_cycle_invoices(
        society_id=society_id,
        maintenance_fee=payload.society_maintenance_fee,
        saas_fee=payload.hamsayaa_saas_fee,
        utility_charges=payload.utility_charges,
        due_date=payload.due_date,
        account_shown=payload.account_shown
    )
    return {
        "status": "success",
        "message": f"Cycle invoices generated with maintenance fee Rs. {payload.society_maintenance_fee} and Hamsayaa SaaS fee Rs. {payload.hamsayaa_saas_fee}",
        "data": result
    }

@router.patch("/{invoice_id}")
async def edit_invoice(invoice_id: str, payload: InvoiceUpdateRequest):
    """
    Admin edit capability for resident invoices (maintenance fee, Hamsayaa SaaS fee, utility charges, due date, account details).
    """
    update_data = payload.dict(exclude_unset=True)
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields provided for update")
        
    result = db_service.update_invoice(invoice_id, update_data)
    return {
        "status": "success",
        "invoice_id": invoice_id,
        "updated_fields": update_data,
        "data": result
    }

@router.patch("/{invoice_id}/verify")
async def verify_invoice_receipt(invoice_id: str, payload: ReceiptVerifyRequest):
    """
    Admin verification of resident payment receipt screenshot.
    """
    result = db_service.verify_invoice_receipt(invoice_id, payload.verified_by)
    return {
        "status": "success",
        "invoice_id": invoice_id,
        "message": "Payment receipt successfully verified",
        "data": result
    }
