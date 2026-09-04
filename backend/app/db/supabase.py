from datetime import datetime, timezone
import re
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
        try:
            query = self.client.table("residents").select("*, registered_vehicles(*)").eq("society_id", society_id)
            if building and building != "All":
                query = query.eq("building", building)
            res = query.order("building").order("unit_number").execute()
            return res.data or []
        except Exception as e:
            logger.error(f"Error fetching residents (database may be paused or unreachable): {e}")
            return []

    def get_resident_by_phone(self, phone: str):
        """
        Fast indexed resident lookup by phone number with fallback digit matching.
        """
        if not self.client or not phone:
            return None
        try:
            # 1. Clean digits and test standardized format
            clean_digits = re.sub(r"[^\d]", "", phone.strip())
            formatted = f"+{clean_digits}"
            res = self.client.table("residents").select("*").eq("phone_number", formatted).execute()
            if res.data and len(res.data) > 0:
                return res.data[0]
            # 2. Try without leading +
            res = self.client.table("residents").select("*").eq("phone_number", clean_digits).execute()
            if res.data and len(res.data) > 0:
                return res.data[0]
            return None
        except Exception as e:
            logger.error(f"Error looking up resident by phone: {e}")
            return None

    def create_resident(self, resident_data: dict):
        if not self.client:
            return None
        try:
            res = self.client.table("residents").insert(resident_data).execute()
            return res.data
        except Exception as e:
            logger.error(f"Error creating resident: {e}")
            return None

    def toggle_resident_block(self, resident_id: str, is_blocked: bool):
        if not self.client:
            return None
        try:
            res = self.client.table("residents").update({"is_blocked": is_blocked}).eq("id", resident_id).execute()
            return res.data
        except Exception as e:
            logger.error(f"Error toggling resident block: {e}")
            return None

    def bulk_upsert_residents(self, residents_list: list[dict]):
        if not self.client or not residents_list:
            return []
        try:
            res = self.client.table("residents").upsert(residents_list, on_conflict="society_id,building,unit_number,phone_number").execute()
            return res.data
        except Exception as e:
            logger.error(f"Error bulk upserting residents: {e}")
            return []

    # COMPLAINTS & TICKETS
    def get_complaints(self, society_id: str, status: str | None = None):
        if not self.client:
            return []
        try:
            query = self.client.table("complaints").select("*, residents(name, unit_number, building)").eq("society_id", society_id)
            if status and status != "All":
                query = query.eq("status", status)
            else:
                query = query.neq("status", "flagged_irrelevant")
            res = query.order("created_at", desc=True).execute()
            return res.data or []
        except Exception as e:
            logger.error(f"Error fetching complaints (database may be paused or unreachable): {e}")
            return []

    def update_complaint_status(self, complaint_id: str, status: str):
        if not self.client:
            return None
        try:
            res = self.client.table("complaints").update({"status": status}).eq("id", complaint_id).execute()
            return res.data
        except Exception as e:
            logger.error(f"Error updating complaint status: {e}")
            return None

    # INVOICES & DUES
    def get_invoices(self, society_id: str, status: str | None = None):
        if not self.client:
            return []
        try:
            query = self.client.table("invoices").select("*, residents(id, name, unit_number, building, phone_number)").eq("society_id", society_id)
            if status and status != "All":
                query = query.eq("status", status)
            res = query.order("created_at", desc=True).execute()
            return res.data or []
        except Exception as e:
            logger.error(f"Error fetching invoices (database may be paused or unreachable): {e}")
            return []

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

    def attach_invoice_receipt(self, invoice_id: str, receipt_url: str):
        if not self.client or not invoice_id or not receipt_url:
            return None
        try:
            res = self.client.table("invoices").update({
                "receipt_image_url": receipt_url
            }).eq("id", invoice_id).execute()
            return res.data[0] if res.data else None
        except Exception as e:
            logger.error(f"Error attaching receipt to invoice {invoice_id}: {e}")
            return None

    def get_or_create_advance_invoice(
        self,
        society_id: str,
        resident_id: str,
        default_fee: float = 6500.0,
        due_date: str | None = None,
        account_shown: str | None = None
    ) -> dict | None:
        """
        Finds the resident's active unpaid/overdue invoice.
        If none exists, creates an advance invoice for the upcoming cycle so the payment receipt can be attached.
        """
        if not self.client:
            return None
        try:
            # 1. Check for any unpaid or overdue invoice
            inv_res = self.client.table("invoices").select("*").eq("resident_id", resident_id).in_("status", ["unpaid", "overdue"]).order("created_at", desc=True).limit(1).execute()
            if inv_res.data and len(inv_res.data) > 0:
                return inv_res.data[0]

            # 2. Check if the most recent invoice is already paid/verified
            recent_res = self.client.table("invoices").select("*").eq("resident_id", resident_id).order("created_at", desc=True).limit(1).execute()
            if recent_res.data and recent_res.data[0].get("status") in ["paid", "verified"]:
                # Already settled - return it with a flag indicating settled
                inv = recent_res.data[0]
                inv["is_already_settled"] = True
                return inv

            # 3. Create an advance invoice for upcoming cycle
            from datetime import date, timedelta
            today = date.today()
            if not due_date:
                if today.day > 15:
                    next_month = (today.replace(day=1) + timedelta(days=32)).replace(day=15)
                    due_date = next_month.isoformat()
                else:
                    due_date = today.replace(day=15).isoformat()

            account = account_shown or "Meezan Bank - A/C 01020304050607 - Lakeview Maint Account"
            new_inv = {
                "society_id": society_id,
                "resident_id": resident_id,
                "society_maintenance_fee": default_fee,
                "hamsayaa_saas_fee": 0.0,
                "utility_charges": 0.0,
                "total_amount": default_fee,
                "due_date": due_date,
                "status": "unpaid",
                "account_shown": account
            }
            insert_res = self.client.table("invoices").insert(new_inv).execute()
            return insert_res.data[0] if insert_res.data else None
        except Exception as e:
            logger.error(f"Error in get_or_create_advance_invoice: {e}")
            return None

    def generate_cycle_invoices(self, society_id: str, maintenance_fee: float, saas_fee: float, utility_charges: float, due_date: str, account_shown: str):
        if not self.client:
            return []
        residents = self.get_residents(society_id)
        
        # Check existing invoices for this society and due_date to avoid duplicate rows
        existing_res = self.client.table("invoices").select("id, resident_id, due_date, status").eq("society_id", society_id).eq("due_date", due_date).execute()
        existing_map = {row["resident_id"]: row for row in (existing_res.data or [])}

        new_invoices = []
        existing_invoices = []
        for r in residents:
            r_id = r["id"]
            if r_id in existing_map:
                existing_invoices.append(existing_map[r_id])
            else:
                new_invoices.append({
                    "society_id": society_id,
                    "resident_id": r_id,
                    "society_maintenance_fee": maintenance_fee,
                    "hamsayaa_saas_fee": saas_fee,
                    "utility_charges": utility_charges,
                    "due_date": due_date,
                    "status": "unpaid",
                    "account_shown": account_shown,
                })
        if new_invoices:
            res = self.client.table("invoices").insert(new_invoices).execute()
            return (res.data or []) + existing_invoices
        return existing_invoices


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
                "open_tickets_count": 0,
                "needs_human_review_count": 0,
                "overdue_dues_total": 0,
                "overdue_count": 0,
                "active_passes_count": 0,
                "flagged_overstays_count": 0,
                "recent_complaints": [],
                "vehicle_logs": []
            }

        try:
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
        except Exception as e:
            logger.error(f"Error computing dashboard summary (database may be paused or unreachable): {e}")
            return {
                "open_tickets_count": 0,
                "needs_human_review_count": 0,
                "overdue_dues_total": 0,
                "overdue_count": 0,
                "active_passes_count": 0,
                "flagged_overstays_count": 0,
                "recent_complaints": [],
                "vehicle_logs": []
            }

    # POLLS & VOTING
    def get_polls(self, society_id: str, resident_id: str | None = None):
        if not self.client:
            return []
        try:
            polls_res = self.client.table("polls").select("*").eq("society_id", society_id).order("created_at", desc=True).execute()
            polls_list = polls_res.data or []
            if not polls_list:
                return []
            
            poll_ids = [p["id"] for p in polls_list]
            votes_res = self.client.table("poll_votes").select("poll_id, selected_option, resident_id").in_("poll_id", poll_ids).execute()
            all_votes = votes_res.data or []
            
            votes_by_poll = {}
            for v in all_votes:
                p_id = v.get("poll_id")
                if p_id not in votes_by_poll:
                    votes_by_poll[p_id] = []
                votes_by_poll[p_id].append(v)
            
            for p in polls_list:
                p_id = p["id"]
                p_votes = votes_by_poll.get(p_id, [])
                p["total_votes"] = len(p_votes)
                
                opts = p.get("options") or []
                counts = {opt: 0 for opt in opts}
                for v in p_votes:
                    opt = v.get("selected_option")
                    if opt in counts:
                        counts[opt] += 1
                    if resident_id and str(v.get("resident_id")) == str(resident_id):
                        p["resident_voted_option"] = opt
                p["votes"] = counts
                
            return polls_list
        except Exception as e:
            logger.error(f"Error fetching polls (database may be paused or unreachable): {e}")
            return []

    def create_poll(self, poll_data: dict):
        if not self.client:
            return None
        try:
            res = self.client.table("polls").insert(poll_data).execute()
            return res.data[0] if res.data else None
        except Exception as e:
            logger.error(f"Error creating poll: {e}")
            return None

    def cast_vote(self, poll_id: str, resident_id: str, selected_option: str):
        if not self.client:
            return None
        try:
            # Check if resident has already cast a vote for this poll
            existing = self.client.table("poll_votes").select("id, selected_option").eq("poll_id", poll_id).eq("resident_id", resident_id).execute()
            if existing.data and len(existing.data) > 0:
                return {
                    "status": "already_voted",
                    "existing_option": existing.data[0].get("selected_option")
                }
            
            res = self.client.table("poll_votes").insert({
                "poll_id": poll_id,
                "resident_id": resident_id,
                "selected_option": selected_option
            }).execute()
            return {
                "status": "success",
                "vote": res.data[0] if res.data else None
            }
        except Exception as e:
            logger.error(f"Error casting vote: {e}")
            return {"status": "error", "error": str(e)}

    def close_poll(self, poll_id: str):
        if not self.client:
            return None
        try:
            res = self.client.table("polls").update({"is_closed": True}).eq("id", poll_id).execute()
            return res.data[0] if res.data else None
        except Exception as e:
            logger.error(f"Error closing poll: {e}")
            return None

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

    def upload_image(
        self,
        image_bytes: bytes,
        filename: str,
        bucket_name: str = "society-receipts",
        mime_type: str = "image/jpeg"
    ) -> str | None:
        """
        Uploads image binary bytes (payment receipts or maintenance photos) to Supabase Storage
        and returns the permanent public URL.
        """
        if not self.client or not image_bytes:
            return None
        try:
            try:
                self.client.storage.create_bucket(bucket_name, options={"public": True})
            except Exception:
                pass

            storage_path = f"images/{filename}"
            self.client.storage.from_(bucket_name).upload(
                file=image_bytes,
                path=storage_path,
                file_options={"content-type": mime_type, "upsert": "true"}
            )
            public_url = self.client.storage.from_(bucket_name).get_public_url(storage_path)
            logger.info(f"Uploaded image to Supabase Storage ({bucket_name}): {public_url}")
            return public_url
        except Exception as e:
            logger.error(f"Error uploading image to Supabase storage ({bucket_name}): {e}")
            return None

    # EMPLOYEE DIRECTORY
    def get_employees(self, society_id: str):
        if not self.client:
            return []
        try:
            res = self.client.table("employees").select("*").eq("society_id", society_id).order("created_at", desc=True).execute()
            return res.data or []
        except Exception as e:
            logger.error(f"Error fetching employees: {e}")
            return []

    def create_employee(self, employee_data: dict):
        if not self.client:
            return None
        try:
            res = self.client.table("employees").insert(employee_data).execute()
            return res.data[0] if res.data else None
        except Exception as e:
            logger.error(f"Error creating employee: {e}")
            return None

    def update_employee(self, employee_id: str, employee_data: dict):
        if not self.client:
            return None
        try:
            res = self.client.table("employees").update(employee_data).eq("id", employee_id).execute()
            return res.data[0] if res.data else None
        except Exception as e:
            logger.error(f"Error updating employee {employee_id}: {e}")
            return None

    def delete_employee(self, employee_id: str):
        if not self.client:
            return False
        try:
            res = self.client.table("employees").delete().eq("id", employee_id).execute()
            return True
        except Exception as e:
            logger.error(f"Error deleting employee {employee_id}: {e}")
            return False

    # ASSETS & MAINTENANCE LOGS
    def get_assets(self, society_id: str):
        if not self.client:
            return []
        try:
            res = self.client.table("assets").select("*").eq("society_id", society_id).order("next_service_due", desc=False).execute()
            return res.data or []
        except Exception as e:
            logger.error(f"Error fetching assets: {e}")
            return []

    def create_asset(self, asset_data: dict):
        if not self.client:
            return None
        try:
            res = self.client.table("assets").insert(asset_data).execute()
            return res.data[0] if res.data else None
        except Exception as e:
            logger.error(f"Error creating asset: {e}")
            return None

    def update_asset(self, asset_id: str, asset_data: dict):
        if not self.client:
            return None
        try:
            res = self.client.table("assets").update(asset_data).eq("id", asset_id).execute()
            return res.data[0] if res.data else None
        except Exception as e:
            logger.error(f"Error updating asset {asset_id}: {e}")
            return None

    def delete_asset(self, asset_id: str):
        if not self.client:
            return False
        try:
            res = self.client.table("assets").delete().eq("id", asset_id).execute()
            return True
        except Exception as e:
            logger.error(f"Error deleting asset {asset_id}: {e}")
            return False

    def get_maintenance_logs(self, asset_id: str):
        if not self.client:
            return []
        try:
            res = self.client.table("maintenance_logs").select("*").eq("asset_id", asset_id).order("serviced_at", desc=True).execute()
            return res.data or []
        except Exception as e:
            logger.error(f"Error fetching maintenance logs for asset {asset_id}: {e}")
            return []

    def create_maintenance_log(self, log_data: dict):
        if not self.client:
            return None
        try:
            res = self.client.table("maintenance_logs").insert(log_data).execute()
            created_log = res.data[0] if res.data else None
            
            # If next_due_override was provided, update the asset's next_service_due date
            if created_log and log_data.get("next_due_override") and log_data.get("asset_id"):
                try:
                    self.client.table("assets").update({
                        "next_service_due": log_data.get("next_due_override")
                    }).eq("id", log_data.get("asset_id")).execute()
                except Exception as ex:
                    logger.error(f"Error syncing asset next_service_due: {ex}")

            return created_log
        except Exception as e:
            logger.error(f"Error creating maintenance log: {e}")
            return None

    # SOCIETY CONFIGURATION & SETTINGS
    def get_society(self, society_id: str):
        if not self.client:
            return None
        try:
            res = self.client.table("societies").select("*").eq("id", society_id).execute()
            return res.data[0] if res.data else None
        except Exception as e:
            logger.error(f"Error fetching society {society_id}: {e}")
            return None

    def update_society(self, society_id: str, data: dict):
        if not self.client:
            return None
        try:
            res = self.client.table("societies").update(data).eq("id", society_id).execute()
            return res.data[0] if res.data else None
        except Exception as e:
            logger.error(f"Error updating society {society_id}: {e}")
            return None

    # VEHICLES & GATE LOGS
    def get_registered_vehicles(self, society_id: str):
        if not self.client:
            return []
        try:
            res = self.client.table("registered_vehicles").select("*, residents(name, unit_number, building)").eq("society_id", society_id).execute()
            return res.data or []
        except Exception as e:
            logger.error(f"Error fetching registered vehicles: {e}")
            return []

    def get_vehicle_logs(self, society_id: str):
        if not self.client:
            return []
        try:
            res = self.client.table("vehicle_logs").select("*").eq("society_id", society_id).order("entry_time", desc=True).execute()
            return res.data or []
        except Exception as e:
            logger.error(f"Error fetching vehicle logs: {e}")
            return []

    def create_vehicle_log(self, log_data: dict):
        if not self.client:
            return None
        try:
            plate = log_data.get("vehicle_plate", "").strip().upper()
            society_id = log_data.get("society_id")

            # Check if plate is registered in society
            reg_res = self.client.table("registered_vehicles").select("*, residents(name, unit_number, building)").eq("society_id", society_id).ilike("vehicle_plate", plate).execute()
            is_reg = bool(reg_res.data and len(reg_res.data) > 0)
            
            insert_payload = {
                "society_id": society_id,
                "vehicle_plate": plate,
                "entry_time": log_data.get("entry_time") or datetime.now(timezone.utc).isoformat(),
                "source": log_data.get("source", "manual"),
                "is_registered": is_reg,
                "is_flagged_overstay": False if is_reg else log_data.get("is_flagged_overstay", False)
            }
            res = self.client.table("vehicle_logs").insert(insert_payload).execute()
            created_log = res.data[0] if res.data else None
            
            if created_log and is_reg:
                created_log["resident_info"] = reg_res.data[0].get("residents")

            return created_log
        except Exception as e:
            logger.error(f"Error creating vehicle log: {e}")
            return None

    def mark_vehicle_exit(self, log_id: str):
        if not self.client:
            return None
        try:
            exit_ts = datetime.now(timezone.utc).isoformat()
            res = self.client.table("vehicle_logs").update({
                "exit_time": exit_ts,
                "is_flagged_overstay": False
            }).eq("id", log_id).execute()
            return res.data[0] if res.data else None
        except Exception as e:
            logger.error(f"Error marking vehicle exit {log_id}: {e}")
            return None

    # AMENITIES & FACILITIES
    def get_amenities(self, society_id: str):
        if not self.client:
            return []
        try:
            res = self.client.table("amenities").select("*").eq("society_id", society_id).order("name", desc=False).execute()
            return res.data or []
        except Exception as e:
            logger.error(f"Error fetching amenities: {e}")
            return []

    def create_amenity(self, amenity_data: dict):
        if not self.client:
            return None
        try:
            res = self.client.table("amenities").insert(amenity_data).execute()
            return res.data[0] if res.data else None
        except Exception as e:
            logger.error(f"Error creating amenity: {e}")
            return None

    def update_amenity(self, amenity_id: str, data: dict):
        if not self.client:
            return None
        try:
            res = self.client.table("amenities").update(data).eq("id", amenity_id).execute()
            return res.data[0] if res.data else None
        except Exception as e:
            logger.error(f"Error updating amenity {amenity_id}: {e}")
            return None

    def delete_amenity(self, amenity_id: str):
        if not self.client:
            return False
        try:
            self.client.table("amenities").delete().eq("id", amenity_id).execute()
            return True
        except Exception as e:
            logger.error(f"Error deleting amenity {amenity_id}: {e}")
            return False

db_service = DatabaseService()
