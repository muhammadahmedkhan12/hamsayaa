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

    # COMPLAINTS & TICKETS
    def get_complaints(self, society_id: str, status: str | None = None):
        if not self.client:
            return []
        query = self.client.table("complaints").select("*, residents(name, unit_number, building)").eq("society_id", society_id)
        if status and status != "All":
            query = query.eq("status", status)
        else:
            query = query.neq("status", "flagged_irrelevant")
        res = query.order("created_at", desc=True).execute()
        return res.data

    def update_complaint_status(self, complaint_id: str, status: str):
        if not self.client:
            return None
        res = self.client.table("complaints").update({"status": status}).eq("id", complaint_id).execute()
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

    # VEHICLE LOGS & PASSES
    def get_vehicle_logs(self, society_id: str):
        if not self.client:
            return []
        res = self.client.table("vehicle_logs").select("*").eq("society_id", society_id).order("entry_time", desc=True).execute()
        return res.data

    def get_visitor_passes(self, society_id: str):
        if not self.client:
            return []
        res = self.client.table("visitor_passes").select("*, residents(name, unit_number, building)").eq("society_id", society_id).execute()
        return res.data

    def get_unregistered_overstays(self, society_id: str):
        if not self.client:
            return []
        res = self.client.table("vehicle_logs").select("*").eq("society_id", society_id).eq("is_flagged_overstay", True).execute()
        return res.data

    # DASHBOARD AGGREGATED METRICS
    def get_dashboard_summary(self, society_id: str):
        if not self.client:
            return {
                "open_tickets_count": 5,
                "needs_human_review_count": 1,
                "overdue_dues_total": 145000,
                "overdue_count": 8,
                "active_passes_count": 8,
                "flagged_overstays_count": 2,
            }

        complaints = self.get_complaints(society_id)
        open_tickets = [c for c in complaints if c.get("status") in ["open", "in_progress", "needs_human_review"]]
        human_review = [c for c in complaints if c.get("status") == "needs_human_review"]

        invoices = self.get_invoices(society_id)
        overdue_invs = [i for i in invoices if i.get("status") == "overdue"]
        overdue_total = sum(i.get("total_amount", 0) for i in overdue_invs)

        passes = self.get_visitor_passes(society_id)
        overstays = self.get_unregistered_overstays(society_id)

        return {
            "open_tickets_count": len(open_tickets),
            "needs_human_review_count": len(human_review),
            "overdue_dues_total": overdue_total,
            "overdue_count": len(overdue_invs),
            "active_passes_count": len(passes),
            "flagged_overstays_count": len(overstays),
            "recent_complaints": complaints[:5],
            "vehicle_logs": self.get_vehicle_logs(society_id)[:5]
        }

    # POLLS & VOTING
    def get_polls(self, society_id: str):
        if not self.client:
            return []
        polls_res = self.client.table("polls").select("*").eq("society_id", society_id).order("created_at", desc=True).execute()
        polls_list = polls_res.data
        if not polls_list:
            return []
        
        for p in polls_list:
            votes_res = self.client.table("poll_votes").select("selected_option").eq("poll_id", p["id"]).execute()
            votes = votes_res.data or []
            p["total_votes"] = len(votes)
            
            # Options format might be list or dictionary/JSON
            opts = p.get("options") or []
            counts = {opt: 0 for opt in opts}
            for v in votes:
                opt = v.get("selected_option")
                if opt in counts:
                    counts[opt] += 1
            p["votes"] = counts
            
        return polls_list

    def create_poll(self, poll_data: dict):
        if not self.client:
            return None
        res = self.client.table("polls").insert(poll_data).execute()
        return res.data[0] if res.data else None

    def cast_vote(self, poll_id: str, resident_id: str, selected_option: str):
        if not self.client:
            return None
        res = self.client.table("poll_votes").upsert(
            {
                "poll_id": poll_id,
                "resident_id": resident_id,
                "selected_option": selected_option
            },
            on_conflict="poll_id,resident_id"
        ).execute()
        return res.data[0] if res.data else None

    def close_poll(self, poll_id: str):
        if not self.client:
            return None
        res = self.client.table("polls").update({"is_closed": True}).eq("id", poll_id).execute()
        return res.data[0] if res.data else None

    # VOICE NOTES & MEDIA STORAGE
    def upload_voice_note(self, audio_bytes: bytes, filename: str) -> str | None:
        """
        Uploads raw audio binary bytes to Supabase Storage bucket 'society-voice-notes'
        and returns the public access URL for playback on the dashboard.
        """
        if not self.client or not audio_bytes:
            return None
        bucket_name = "society-voice-notes"
        try:
            try:
                self.client.storage.create_bucket(bucket_name, options={"public": True})
            except Exception:
                pass

            storage_path = f"voice_notes/{filename}"
            self.client.storage.from_(bucket_name).upload(
                file=audio_bytes,
                path=storage_path,
                file_options={"content-type": "audio/ogg", "upsert": "true"}
            )
            public_url = self.client.storage.from_(bucket_name).get_public_url(storage_path)
            logger.info(f"Uploaded voice note to Supabase Storage: {public_url}")
            return public_url
        except Exception as e:
            logger.error(f"Error uploading voice note to Supabase storage: {e}")
            return None

db_service = DatabaseService()
