from supabase import create_client, Client
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)

def get_supabase_client() -> Client | None:
    """
    Returns an initialized Supabase Client if URL and Key are configured.
    """
    if settings.SUPABASE_URL and (settings.SUPABASE_SECRET_KEY or settings.SUPABASE_PUBLISHABLE_KEY):
        key = settings.SUPABASE_SECRET_KEY or settings.SUPABASE_PUBLISHABLE_KEY
        try:
            return create_client(settings.SUPABASE_URL, key)
        except Exception as e:
            logger.error(f"Error initializing Supabase client: {e}")
            return None
    return None

supabase: Client | None = get_supabase_client()

class DatabaseService:
    def __init__(self, client: Client | None = None):
        self.client = client or supabase

    # RESIDENTS
    def get_residents(self, society_id: str, building: str | None = None):
        if not self.client:
            return []
        query = self.client.table("residents").select("*, registered_vehicles(*)").eq("society_id", society_id)
        if building and building != "All":
            query = query.eq("building", building)
        res = query.order("building").order("unit_number").execute()
        return res.data

    def create_resident(self, resident_data: dict):
        if not self.client:
            return None
        res = self.client.table("residents").insert(resident_data).execute()
        return res.data

    def toggle_resident_block(self, resident_id: str, is_blocked: bool):
        if not self.client:
            return None
        res = self.client.table("residents").update({"is_blocked": is_blocked}).eq("id", resident_id).execute()
        return res.data

    def bulk_upsert_residents(self, residents_list: list[dict]):
        if not self.client or not residents_list:
            return []
        res = self.client.table("residents").upsert(residents_list, on_conflict="society_id,building,unit_number,phone_number").execute()
        return res.data

    # INVOICES & DUES
    def get_invoices(self, society_id: str, status: str | None = None):
        if not self.client:
            return []
        query = self.client.table("invoices").select("*, residents(id, name, unit_number, building, phone_number)").eq("society_id", society_id)
        if status and status != "All":
            query = query.eq("status", status)
        res = query.order("created_at", desc=True).execute()
        return res.data

    def update_invoice(self, invoice_id: str, update_data: dict):
        if not self.client:
            return None
        res = self.client.table("invoices").update(update_data).eq("id", invoice_id).execute()
        return res.data

    def verify_invoice_receipt(self, invoice_id: str, verified_by: str | None = None):
        if not self.client:
            return None
        data = {
            "status": "verified",
            "verified_at": "now()",
        }
        if verified_by:
            data["verified_by"] = verified_by
        res = self.client.table("invoices").update(data).eq("id", invoice_id).execute()
        return res.data

    def generate_cycle_invoices(self, society_id: str, maintenance_fee: float, saas_fee: float, utility_charges: float, due_date: str, account_shown: str):
        if not self.client:
            return []
        residents = self.get_residents(society_id)
        new_invoices = []
        for r in residents:
            new_invoices.append({
                "society_id": society_id,
                "resident_id": r["id"],
                "society_maintenance_fee": maintenance_fee,
                "hamsayaa_saas_fee": saas_fee,
                "utility_charges": utility_charges,
                "due_date": due_date,
                "status": "unpaid",
                "account_shown": account_shown,
            })
        if new_invoices:
            res = self.client.table("invoices").insert(new_invoices).execute()
            return res.data
        return []

    # VEHICLES
    def get_unregistered_overstays(self, society_id: str):
        if not self.client:
            return []
        res = self.client.table("vehicle_logs").select("*").eq("society_id", society_id).eq("is_flagged_overstay", True).execute()
        return res.data

db_service = DatabaseService()
