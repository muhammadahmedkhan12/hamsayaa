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

    def get_invoices(self, society_id: str):
        if not self.client:
            return []
        res = self.client.table("invoices").select("*, residents(name, unit_number, building)").eq("society_id", society_id).execute()
        return res.data

    def get_unregistered_overstays(self, society_id: str):
        if not self.client:
            return []
        res = self.client.table("vehicle_logs").select("*").eq("society_id", society_id).eq("is_flagged_overstay", True).execute()
        return res.data

db_service = DatabaseService()
