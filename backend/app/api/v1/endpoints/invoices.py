from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel, Field
from typing import Optional
from datetime import date, datetime, timezone
import json
import logging

from app.db.supabase import db_service
from app.services.whatsapp import whatsapp_service
from app.api.v1.endpoints.whatsapp import redis_client

logger = logging.getLogger(__name__)

router = APIRouter()

DEFAULT_SOCIETY_ID = "a1b2c3d4-e5f6-7890-abcd-111111111111"

class InvoiceGenerateRequest(BaseModel):
    society_maintenance_fee: Optional[float] = None
    guard_fee: float = Field(default=2500.0, example=2500.0)
    sweeper_fee: float = Field(default=1000.0, example=1000.0)
    water_fee: float = Field(default=1500.0, example=1500.0)
    generator_fee: float = Field(default=1000.0, example=1000.0)
    misc_fee: float = Field(default=500.0, example=500.0)
    due_date: str = Field(..., example="2026-09-15")
    account_shown: str = Field(default="Meezan Bank - A/C 01020304050607 - Lakeview Maint Account")
    send_whatsapp: bool = Field(default=True)

class InvoiceUpdateRequest(BaseModel):
    society_maintenance_fee: Optional[float] = None
    due_date: Optional[str] = None
    status: Optional[str] = None
    account_shown: Optional[str] = None

class ReceiptVerifyRequest(BaseModel):
    verified_by: Optional[str] = None

class MarkPaidRequest(BaseModel):
    collected_by: Optional[str] = Field(default="Building Admin", example="Tariq (Treasurer)")
    payment_method: Optional[str] = Field(default="Cash", example="Cash")
    notes: Optional[str] = None



def get_delivery_status(invoice_id: str) -> dict:
    if not redis_client:
        return {"status": "pending"}
    try:
        raw = redis_client.get(f"whatsapp_delivery:{invoice_id}")
        if raw:
            if isinstance(raw, str):
                return json.loads(raw)
            elif isinstance(raw, dict):
                return raw
    except Exception as e:
        logger.debug(f"Redis get delivery error: {e}")
    return {"status": "pending"}


def set_delivery_status(invoice_id: str, status: str, error: str = None):
    if not redis_client:
        return
    try:
        payload = {
            "status": status,
            "timestamp": date.today().isoformat(),
            "error": error
        }
        redis_client.set(f"whatsapp_delivery:{invoice_id}", json.dumps(payload), ex=30 * 86400)
    except Exception as e:
        logger.debug(f"Redis set delivery error: {e}")


def set_payment_audit(invoice_id: str, collector: str, method: str = "Cash", timestamp: str = None):
    if not redis_client:
        return
    try:
        payload = {
            "collector": collector,
            "method": method,
            "collected_at": timestamp or datetime.now(timezone.utc).isoformat()
        }
        redis_client.set(f"payment_audit:{invoice_id}", json.dumps(payload), ex=365 * 86400)
    except Exception as e:
        logger.debug(f"Redis set payment audit error: {e}")


def get_payment_audit(invoice_id: str) -> dict:
    if not redis_client:
        return {}
    try:
        raw = redis_client.get(f"payment_audit:{invoice_id}")
        if raw:
            if isinstance(raw, str):
                return json.loads(raw)
            elif isinstance(raw, dict):
                return raw
    except Exception as e:
        logger.debug(f"Redis get payment audit error: {e}")
    return {}


@router.get("/")
async def list_invoices(
    society_id: str = Query(DEFAULT_SOCIETY_ID),
    status: Optional[str] = Query(None)
):
    """
    List resident cumulative invoices for a society with WhatsApp delivery status and payment audit trail.
    Uses batched Redis mget to avoid N+1 network roundtrips.
    """
    invoices = db_service.get_invoices(society_id=society_id, status=status)
    if not invoices:
        return {"invoices": []}

    inv_ids = [inv["id"] for inv in invoices if "id" in inv]
    
    delivery_map = {}
    audit_map = {}

    if redis_client and inv_ids:
        try:
            delivery_keys = [f"whatsapp_delivery:{iid}" for iid in inv_ids]
            raw_deliveries = redis_client.mget(*delivery_keys)
            if raw_deliveries:
                for iid, raw in zip(inv_ids, raw_deliveries):
                    if raw:
                        try:
                            delivery_map[iid] = json.loads(raw) if isinstance(raw, str) else raw
                        except Exception:
                            delivery_map[iid] = {"status": "pending"}
        except Exception as e:
            logger.debug(f"Redis mget delivery error: {e}")

        try:
            audit_keys = [f"payment_audit:{iid}" for iid in inv_ids]
            raw_audits = redis_client.mget(*audit_keys)
            if raw_audits:
                for iid, raw in zip(inv_ids, raw_audits):
                    if raw:
                        try:
                            audit_map[iid] = json.loads(raw) if isinstance(raw, str) else raw
                        except Exception:
                            audit_map[iid] = {}
        except Exception as e:
            logger.debug(f"Redis mget payment audit error: {e}")

    for inv in invoices:
        iid = inv.get("id")
        inv["whatsapp_delivery"] = delivery_map.get(iid, {"status": "pending"})
        audit = audit_map.get(iid, {})
        if audit:
            inv["payment_audit"] = audit
            inv["verified_by"] = audit.get("collector")
            inv["verified_at"] = audit.get("collected_at")
    return {"invoices": invoices}



@router.post("/generate")
async def generate_cycle_invoices(
    payload: InvoiceGenerateRequest,
    society_id: str = Query(DEFAULT_SOCIETY_ID)
):
    """
    Generate standard monthly cycle maintenance vouchers for all active units in a society
    and broadcast itemized notifications to residents via WhatsApp with idempotency.
    """
    # Calculate total maintenance fee from service line items if not directly supplied
    total_fee = payload.society_maintenance_fee
    if total_fee is None:
        total_fee = (
            payload.guard_fee +
            payload.sweeper_fee +
            payload.water_fee +
            payload.generator_fee +
            payload.misc_fee
        )

    result = db_service.generate_cycle_invoices(
        society_id=society_id,
        maintenance_fee=total_fee,
        saas_fee=0.0,
        utility_charges=0.0,
        due_date=payload.due_date,
        account_shown=payload.account_shown
    )

    whatsapp_sent = 0
    whatsapp_already_delivered = 0
    whatsapp_failed = 0
    failed_details = []

    if payload.send_whatsapp:
        # Map invoice object by resident ID from the generation result
        inv_by_resident = {inv["resident_id"]: inv for inv in result if "resident_id" in inv}
        residents = db_service.get_residents(society_id)
        
        for r in residents:
            r_id = r.get("id")
            phone = r.get("phone_number")
            inv_obj = inv_by_resident.get(r_id)
            if not phone or not inv_obj:
                continue
            inv_id = inv_obj.get("id")

            # Idempotency check: Has this resident already received this cycle's voucher?
            delivery = get_delivery_status(inv_id)
            if delivery.get("status") == "delivered":
                whatsapp_already_delivered += 1
                continue

            name = r.get("name", "Resident")
            building = r.get("building", "Block")
            unit = r.get("unit_number", "")

            # Check if resident already paid or submitted receipt before voucher notification
            inv_status = inv_obj.get("status", "unpaid")
            has_receipt = bool(inv_obj.get("receipt_image_url"))

            if inv_status in ["paid", "verified"]:
                # Already settled in advance
                voucher_msg = (
                    f"🧾 *MONTHLY MAINTENANCE VOUCHER*\n"
                    f"Hello *{name}* ({building} - Unit {unit}),\n\n"
                    f"Your society maintenance voucher for this month has been issued (Rs. {total_fee:,.0f}).\n\n"
                    f"✅ *STATUS: PAID / SETTLED*\n"
                    f"Our records show your maintenance for this cycle was already received & settled in advance. Thank you!"
                )
            elif has_receipt:
                # Receipt already submitted in advance before notification
                voucher_msg = (
                    f"🧾 *MONTHLY MAINTENANCE VOUCHER*\n"
                    f"Hello *{name}* ({building} - Unit {unit}),\n\n"
                    f"Your society maintenance voucher for this month has been issued:\n\n"
                    f"• *TOTAL AMOUNT:* Rs. {total_fee:,.0f}\n"
                    f"• *DUE DATE:* {payload.due_date}\n\n"
                    f"📌 *STATUS: PAYMENT SLIP UNDER VERIFICATION*\n"
                    f"We have already received your advance payment screenshot. The management office is currently verifying it. No further payment action is required from you."
                )
            else:
                voucher_msg = (
                    f"🧾 *MONTHLY MAINTENANCE VOUCHER*\n"
                    f"Hello *{name}* ({building} - Unit {unit}),\n\n"
                    f"Your society maintenance voucher for this month has been issued:\n\n"
                    f"• 🛡️ Guard & Security: Rs. {payload.guard_fee:,.0f}\n"
                    f"• 🧹 Sweeper & Sanitation: Rs. {payload.sweeper_fee:,.0f}\n"
                    f"• 🚰 Water Supply: Rs. {payload.water_fee:,.0f}\n"
                    f"• ⚡ Generator Backup: Rs. {payload.generator_fee:,.0f}\n"
                    f"• 🔧 Common Maintenance: Rs. {payload.misc_fee:,.0f}\n"
                    f"━━━━━━━━━━━━━━━━━━━━\n"
                    f"*TOTAL DUE:* *Rs. {total_fee:,.0f}*\n"
                    f"*DUE DATE:* {payload.due_date}\n\n"
                    f"*Society Bank Account:*\n"
                    f"{payload.account_shown}\n\n"
                    f"_Please reply here with a photo/screenshot of your payment receipt once transferred._"
                )

            try:
                dispatch_res = await whatsapp_service.send_text_message(phone, voucher_msg)
                if dispatch_res.get("status") != "error":
                    whatsapp_sent += 1
                    set_delivery_status(inv_id, "delivered")
                else:
                    err_msg = dispatch_res.get("response") or dispatch_res.get("message") or "Meta dispatch error"
                    whatsapp_failed += 1
                    set_delivery_status(inv_id, "failed", err_msg)
                    failed_details.append({"invoice_id": inv_id, "name": name, "phone": phone, "error": err_msg})
            except Exception as e:
                err_str = str(e)
                logger.warning(f"Failed to dispatch voucher to {phone}: {e}")
                whatsapp_failed += 1
                set_delivery_status(inv_id, "failed", err_str)
                failed_details.append({"invoice_id": inv_id, "name": name, "phone": phone, "error": err_str})

    return {
        "status": "success",
        "message": f"Monthly vouchers issued for {len(result)} units. WhatsApp: {whatsapp_sent} sent, {whatsapp_already_delivered} already delivered, {whatsapp_failed} failed.",
        "total_maintenance_fee": total_fee,
        "units_count": len(result),
        "whatsapp_sent_count": whatsapp_sent,
        "whatsapp_already_delivered_count": whatsapp_already_delivered,
        "whatsapp_failed_count": whatsapp_failed,
        "failed_details": failed_details,
        "breakdown": {
            "guard_fee": payload.guard_fee,
            "sweeper_fee": payload.sweeper_fee,
            "water_fee": payload.water_fee,
            "generator_fee": payload.generator_fee,
            "misc_fee": payload.misc_fee
        },
        "data": result
    }


@router.post("/retry-failed")
async def retry_failed_vouchers(
    payload: InvoiceGenerateRequest,
    society_id: str = Query(DEFAULT_SOCIETY_ID)
):
    """
    Retry WhatsApp dispatch ONLY for vouchers that previously failed delivery.
    Already-delivered residents are strictly skipped.
    """
    invoices = db_service.get_invoices(society_id=society_id)
    residents = db_service.get_residents(society_id)
    resident_map = {r["id"]: r for r in residents}

    total_fee = payload.society_maintenance_fee
    if total_fee is None:
        total_fee = (
            payload.guard_fee +
            payload.sweeper_fee +
            payload.water_fee +
            payload.generator_fee +
            payload.misc_fee
        )

    retried_count = 0
    still_failed_count = 0

    for inv in invoices:
        inv_id = inv["id"]
        delivery = get_delivery_status(inv_id)
        if delivery.get("status") != "failed":
            continue  # Skip delivered and pending

        r = resident_map.get(inv.get("resident_id")) or inv.get("residents") or {}
        phone = r.get("phone_number")
        if not phone:
            continue

        name = r.get("name", "Resident")
        building = r.get("building", "Block")
        unit = r.get("unit_number", "")

        voucher_msg = (
            f"🧾 *MONTHLY MAINTENANCE VOUCHER*\n"
            f"Hello *{name}* ({building} - Unit {unit}),\n\n"
            f"Your society maintenance voucher for this month has been issued:\n\n"
            f"• 🛡️ Guard & Security: Rs. {payload.guard_fee:,.0f}\n"
            f"• 🧹 Sweeper & Sanitation: Rs. {payload.sweeper_fee:,.0f}\n"
            f"• 🚰 Water Supply: Rs. {payload.water_fee:,.0f}\n"
            f"• ⚡ Generator Backup: Rs. {payload.generator_fee:,.0f}\n"
            f"• 🔧 Common Maintenance: Rs. {payload.misc_fee:,.0f}\n"
            f"━━━━━━━━━━━━━━━━━━━━\n"
            f"*TOTAL DUE:* *Rs. {total_fee:,.0f}*\n"
            f"*DUE DATE:* {payload.due_date}\n\n"
            f"*Society Bank Account:*\n"
            f"{payload.account_shown}\n\n"
            f"_Please reply here with a photo/screenshot of your payment receipt once transferred._"
        )

        try:
            dispatch_res = await whatsapp_service.send_text_message(phone, voucher_msg)
            if dispatch_res.get("status") != "error":
                retried_count += 1
                set_delivery_status(inv_id, "delivered")
            else:
                err_msg = dispatch_res.get("response") or dispatch_res.get("message") or "Meta dispatch error"
                still_failed_count += 1
                set_delivery_status(inv_id, "failed", err_msg)
        except Exception as e:
            still_failed_count += 1
            set_delivery_status(inv_id, "failed", str(e))

    return {
        "status": "success",
        "message": f"Retry complete: {retried_count} successfully delivered, {still_failed_count} still failed.",
        "retried_count": retried_count,
        "still_failed_count": still_failed_count
    }


@router.post("/{invoice_id}/resend")
async def resend_single_voucher(
    invoice_id: str,
    society_id: str = Query(DEFAULT_SOCIETY_ID)
):
    """
    Resend WhatsApp voucher to a single resident directly from the dashboard table.
    """
    invoices = db_service.get_invoices(society_id=society_id)
    target_inv = next((inv for inv in invoices if inv["id"] == invoice_id), None)
    if not target_inv:
        raise HTTPException(status_code=404, detail="Invoice not found")

    r = target_inv.get("residents") or {}
    phone = r.get("phone_number")
    if not phone:
        raise HTTPException(status_code=400, detail="Resident does not have a valid phone number")

    name = r.get("name", "Resident")
    building = r.get("building", "Block")
    unit = r.get("unit_number", "")
    total = target_inv.get("total_amount") or target_inv.get("society_maintenance_fee") or 0.0
    due_date = target_inv.get("due_date", "")
    account_shown = target_inv.get("account_shown") or "Meezan Bank - Society Account"

    voucher_msg = (
        f"🧾 *MONTHLY MAINTENANCE VOUCHER*\n"
        f"Hello *{name}* ({building} - Unit {unit}),\n\n"
        f"Your society maintenance voucher for this month:\n\n"
        f"━━━━━━━━━━━━━━━━━━━━\n"
        f"*TOTAL DUE:* *Rs. {total:,.0f}*\n"
        f"*DUE DATE:* {due_date}\n\n"
        f"*Society Bank Account:*\n"
        f"{account_shown}\n\n"
        f"_Please reply here with a photo/screenshot of your payment receipt once transferred._"
    )

    try:
        dispatch_res = await whatsapp_service.send_text_message(phone, voucher_msg)
        if dispatch_res.get("status") != "error":
            set_delivery_status(invoice_id, "delivered")
            return {
                "status": "success",
                "message": f"Voucher successfully resent to {name} ({phone})",
                "delivery": {"status": "delivered"}
            }
        else:
            err_msg = dispatch_res.get("response") or dispatch_res.get("message") or "Meta dispatch error"
            set_delivery_status(invoice_id, "failed", err_msg)
            return {
                "status": "error",
                "message": f"Delivery failed: {err_msg}",
                "delivery": {"status": "failed", "error": err_msg}
            }
    except Exception as e:
        set_delivery_status(invoice_id, "failed", str(e))
        return {
            "status": "error",
            "message": f"Delivery exception: {str(e)}",
            "delivery": {"status": "failed", "error": str(e)}
        }


@router.patch("/{invoice_id}")
async def edit_invoice(invoice_id: str, payload: InvoiceUpdateRequest):
    """
    Admin edit capability for resident invoices.
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
    collector = payload.verified_by or "Building Admin"
    now_iso = datetime.now(timezone.utc).isoformat()

    result = db_service.update_invoice(invoice_id, {
        "status": "verified",
        "verified_at": "now()",
    })
    set_payment_audit(invoice_id, collector=collector, method="WhatsApp Slip", timestamp=now_iso)

    return {
        "status": "success",
        "invoice_id": invoice_id,
        "message": "Payment receipt successfully verified",
        "collected_by": collector,
        "verified_at": now_iso,
        "data": result
    }

@router.patch("/{invoice_id}/pay")
async def mark_invoice_as_paid(invoice_id: str, payload: Optional[MarkPaidRequest] = None):
    """
    Mark resident invoice as paid directly (cash/cheque collected at society office)
    with collector accountability and timestamp.
    """
    collector = payload.collected_by if (payload and payload.collected_by) else "Building Admin"
    method = payload.payment_method if (payload and payload.payment_method) else "Cash"
    now_iso = datetime.now(timezone.utc).isoformat()

    update_data = {
        "status": "paid",
        "verified_at": "now()",
    }
    result = db_service.update_invoice(invoice_id, update_data)
    set_payment_audit(invoice_id, collector=collector, method=method, timestamp=now_iso)

    return {
        "status": "success",
        "invoice_id": invoice_id,
        "message": f"Invoice marked as paid by {collector}",
        "collected_by": collector,
        "payment_method": method,
        "verified_at": now_iso,
        "data": result
    }




