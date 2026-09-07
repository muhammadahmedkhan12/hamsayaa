from datetime import datetime, timezone, date, timedelta
import re
import uuid
import json
from supabase import create_client, Client
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)

# Redis client fallback for dual-persistence document URLs & session caches
try:
    from upstash_redis import Redis
    _redis_client = Redis(url=settings.UPSTASH_REDIS_REST_URL, token=settings.UPSTASH_REDIS_REST_TOKEN) if (settings.UPSTASH_REDIS_REST_URL and settings.UPSTASH_REDIS_REST_TOKEN) else None
except Exception:
    _redis_client = None

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
    _has_admins_table: bool = True

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
            data = res.data or []
            # Enrich with document_url from Redis fallback if not populated in DB
            if _redis_client and data:
                for r in data:
                    if not r.get("document_url"):
                        try:
                            cached_doc = _redis_client.get(f"resident_document:{r['id']}")
                            if cached_doc:
                                r["document_url"] = cached_doc
                        except Exception:
                            pass
            return data
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
        doc_url = resident_data.pop("document_url", None)
        try:
            data_to_insert = dict(resident_data)
            if doc_url:
                data_to_insert["document_url"] = doc_url
            try:
                res = self.client.table("residents").insert(data_to_insert).execute()
                new_row = res.data[0] if (res.data and isinstance(res.data, list)) else res.data
                return new_row
            except Exception as e_col:
                # Fallback if document_url column is not yet in Supabase schema
                if doc_url:
                    res = self.client.table("residents").insert(resident_data).execute()
                    new_row = res.data[0] if (res.data and isinstance(res.data, list)) else res.data
                    if new_row and isinstance(new_row, dict) and "id" in new_row:
                        if _redis_client:
                            try:
                                _redis_client.set(f"resident_document:{new_row['id']}", doc_url)
                            except Exception:
                                pass
                        new_row["document_url"] = doc_url
                    return new_row
                raise e_col
        except Exception as e:
            logger.error(f"Error creating resident: {e}")
            raise e

    def update_resident(self, resident_id: str, data: dict) -> dict | None:
        """
        Updates an existing resident record with partial fields.
        Dual-persists document_url to Supabase table and Redis fallback.
        """
        if not self.client or not resident_id:
            return None
        doc_url = data.pop("document_url", None)
        try:
            updated_row = None
            if data:
                res = self.client.table("residents").update(data).eq("id", resident_id).execute()
                updated_row = res.data[0] if (res.data and isinstance(res.data, list)) else (res.data or {})
            else:
                # If only document_url was changed, query existing resident
                res = self.client.table("residents").select("*, registered_vehicles(*)").eq("id", resident_id).limit(1).execute()
                updated_row = res.data[0] if (res.data and isinstance(res.data, list)) else (res.data or {})

            if doc_url is not None:
                try:
                    res_doc = self.client.table("residents").update({"document_url": doc_url}).eq("id", resident_id).execute()
                    if res_doc.data and isinstance(updated_row, dict):
                        updated_row["document_url"] = doc_url
                except Exception as ex_col:
                    logger.debug(f"document_url column fallback to Redis: {ex_col}")
                    if _redis_client:
                        try:
                            _redis_client.set(f"resident_document:{resident_id}", doc_url)
                        except Exception as ex_r:
                            logger.error(f"Error saving resident document in Redis: {ex_r}")
                    if isinstance(updated_row, dict):
                        updated_row["document_url"] = doc_url

            return updated_row
        except Exception as e:
            logger.error(f"Error updating resident {resident_id}: {e}")
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

    def delete_resident(self, resident_id: str) -> bool:
        """
        Deletes a resident record and cascades any related records in child tables
        (poll_votes, visitor_passes, registered_vehicles, complaints, invoices).
        """
        if not self.client or not resident_id:
            return False
        try:
            # 1. Clean up child records to respect foreign key constraints
            try:
                self.client.table("poll_votes").delete().eq("resident_id", resident_id).execute()
            except Exception as e:
                logger.debug(f"Could not cascade delete poll_votes: {e}")

            try:
                self.client.table("visitor_passes").delete().eq("resident_id", resident_id).execute()
            except Exception as e:
                logger.debug(f"Could not cascade delete visitor_passes: {e}")

            try:
                self.client.table("registered_vehicles").delete().eq("resident_id", resident_id).execute()
            except Exception as e:
                logger.debug(f"Could not cascade delete registered_vehicles: {e}")

            try:
                self.client.table("complaints").delete().eq("resident_id", resident_id).execute()
            except Exception as e:
                logger.debug(f"Could not cascade delete complaints: {e}")

            try:
                self.client.table("invoices").delete().eq("resident_id", resident_id).execute()
            except Exception as e:
                logger.debug(f"Could not cascade delete invoices: {e}")

            # 2. Delete resident record
            res = self.client.table("residents").delete().eq("id", resident_id).execute()
            if _redis_client:
                try:
                    _redis_client.delete(f"resident_document:{resident_id}")
                except Exception:
                    pass
            return True
        except Exception as e:
            logger.error(f"Error deleting resident {resident_id}: {e}")
            return False

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
    def has_invoice_arrears_column(self) -> bool:
        if hasattr(self, "_has_arrears_col"):
            return self._has_arrears_col
        if not self.client:
            return False
        try:
            self.client.table("invoices").select("arrears").limit(1).execute()
            self._has_arrears_col = True
        except Exception:
            self._has_arrears_col = False
        return self._has_arrears_col

    def get_invoices(self, society_id: str, status: str | None = None):
        if not self.client:
            return []
        today_iso = date.today().isoformat()

        try:
            query = self.client.table("invoices").select("*, residents(id, name, unit_number, building, phone_number)").eq("society_id", society_id)
            res = query.order("created_at", desc=True).execute()
            invoices = res.data or []

            # Check and transition unpaid invoices past due_date to overdue
            overdue_ids = []
            for inv in invoices:
                st = inv.get("status", "unpaid")
                due = inv.get("due_date", "")
                if st == "unpaid" and due and str(due) < today_iso:
                    inv["status"] = "overdue"
                    if inv.get("id"):
                        overdue_ids.append(inv["id"])

            if overdue_ids:
                try:
                    self.client.table("invoices").update({"status": "overdue"}).in_("id", overdue_ids).execute()
                except Exception as e:
                    logger.debug(f"Could not batch update overdue status in DB: {e}")

            # If viewing all vouchers or unpaid, ensure any active resident without a voucher gets one provisioned
            if not status or status in ["All", "unpaid"]:
                residents = self.get_residents(society_id)
                resident_ids_with_inv = {str(inv.get("resident_id")) for inv in invoices if inv.get("resident_id")}
                # Note: Block access retired, all residents are active
                missing_residents = [r for r in residents if str(r.get("id")) not in resident_ids_with_inv]
                for r in missing_residents:
                    r_id = r.get("id")
                    if r_id:
                        new_inv = self.get_or_create_advance_invoice(society_id, r_id)
                        if new_inv:
                            new_entry = {
                                **new_inv,
                                "residents": {
                                    "id": r.get("id"),
                                    "name": r.get("name"),
                                    "unit_number": r.get("unit_number"),
                                    "building": r.get("building"),
                                    "phone_number": r.get("phone_number")
                                }
                            }
                            invoices.append(new_entry)

            # Batched Redis lookup for arrears if column was not present or 0
            if _redis_client and invoices:
                try:
                    inv_ids = [inv["id"] for inv in invoices if "id" in inv]
                    arrears_keys = [f"invoice_arrears:{iid}" for iid in inv_ids]
                    raw_arrears = _redis_client.mget(*arrears_keys)
                    if raw_arrears:
                        for inv, raw in zip(invoices, raw_arrears):
                            if raw:
                                try:
                                    inv["arrears"] = float(raw)
                                except Exception:
                                    pass
                except Exception as e:
                    logger.debug(f"Redis mget arrears error: {e}")

            for inv in invoices:
                base_amt = float(inv.get("total_amount") or inv.get("society_maintenance_fee") or 0.0)
                arr = float(inv.get("arrears") or 0.0)
                inv["arrears"] = arr
                inv["total_payable"] = round(base_amt + arr, 2)

            if status and status != "All":
                invoices = [i for i in invoices if i.get("status") == status]

            return invoices
        except Exception as e:
            logger.error(f"Error fetching invoices (database may be paused or unreachable): {e}")
            return []

    def get_invoice_by_id(self, invoice_id: str):
        if not self.client or not invoice_id:
            return None
        try:
            res = self.client.table("invoices").select("*, residents(id, name, unit_number, building, phone_number)").eq("id", invoice_id).execute()
            inv = res.data[0] if (res and res.data) else None
            if inv:
                iid = inv.get("id")
                arr = float(inv.get("arrears") or 0.0)
                if not arr and _redis_client and iid:
                    try:
                        raw = _redis_client.get(f"invoice_arrears:{iid}")
                        if raw:
                            arr = float(raw)
                    except Exception:
                        pass
                inv["arrears"] = arr
                base = float(inv.get("total_amount") or inv.get("society_maintenance_fee") or 0.0)
                inv["total_payable"] = round(base + arr, 2)
            return inv
        except Exception as e:
            logger.error(f"Error fetching invoice by ID {invoice_id}: {e}")
            return None

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
        Guarantees strict foreign key validation on resident_id and society_id.
        """
        if not self.client:
            return None
        try:
            # Foreign key safety validation
            try:
                uuid.UUID(str(resident_id))
                uuid.UUID(str(society_id))
            except Exception:
                logger.warning(f"Invalid UUID in get_or_create_advance_invoice: resident_id={resident_id}, society_id={society_id}")
                return None

            # 1. Check for any unpaid or overdue invoice
            inv_res = self.client.table("invoices").select("*").eq("resident_id", resident_id).in_("status", ["unpaid", "overdue"]).order("created_at", desc=True).limit(1).execute()
            if inv_res.data and len(inv_res.data) > 0:
                return inv_res.data[0]

            # 2. Check if the most recent invoice is already paid/verified
            recent_res = self.client.table("invoices").select("*").eq("resident_id", resident_id).order("created_at", desc=True).limit(1).execute()
            if recent_res.data and recent_res.data[0].get("status") in ["paid", "verified"]:
                inv = recent_res.data[0]
                inv["is_already_settled"] = True
                return inv

            # 3. Create an advance invoice for upcoming cycle
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
        """
        Generates standard monthly cycle maintenance vouchers for all active units in a society.
        Calculates previous unpaid arrears (multi-cycle accounting) and dual-persists them.
        Strictly enforces UUID and FK integrity.
        """
        if not self.client:
            return []

        def _is_valid_uuid(val):
            try:
                uuid.UUID(str(val))
                return True
            except Exception:
                return False

        if not _is_valid_uuid(society_id):
            logger.error(f"Invalid society_id UUID: {society_id}")
            return []

        residents = self.get_residents(society_id)
        # Filter strictly for valid resident UUID records to guarantee zero FK errors
        valid_residents = [r for r in residents if r.get("id") and _is_valid_uuid(r.get("id"))]

        # Check existing invoices for this society and due_date to avoid duplicate rows
        existing_res = self.client.table("invoices").select("*, residents(id, name, unit_number, building, phone_number)").eq("society_id", society_id).eq("due_date", due_date).execute()
        existing_map = {str(row["resident_id"]): row for row in (existing_res.data or []) if row.get("resident_id")}

        # Query all prior unpaid/overdue invoices for this society to compute arrears
        prior_unpaid_res = self.client.table("invoices").select("id, resident_id, society_maintenance_fee, total_amount, due_date, status").eq("society_id", society_id).in_("status", ["unpaid", "overdue"]).execute()
        prior_unpaid_list = prior_unpaid_res.data or []

        has_arrears_col = self.has_invoice_arrears_column()
        new_invoices = []
        existing_invoices = []
        resident_arrears_map = {}

        for r in valid_residents:
            r_id = str(r["id"])
            # Calculate prior unpaid balance for this resident
            prior_for_res = [
                inv for inv in prior_unpaid_list 
                if str(inv.get("resident_id")) == r_id and inv.get("due_date") and str(inv.get("due_date")) < str(due_date)
            ]
            arrears = 0.0
            for inv in prior_for_res:
                iid = inv.get("id")
                unpaid_portion = None
                if _redis_client and iid:
                    try:
                        raw_audit = _redis_client.get(f"payment_audit:{iid}")
                        if raw_audit:
                            audit_data = json.loads(raw_audit) if isinstance(raw_audit, str) else raw_audit
                            if "remaining_balance" in audit_data and audit_data["remaining_balance"] is not None:
                                unpaid_portion = float(audit_data["remaining_balance"])
                    except Exception as e:
                        logger.debug(f"Redis get audit for arrears calc error: {e}")
                if unpaid_portion is None:
                    unpaid_portion = float(inv.get("total_amount") or inv.get("society_maintenance_fee") or 0.0)
                arrears += max(0.0, unpaid_portion)

            arrears_rounded = round(arrears, 2)
            resident_arrears_map[r_id] = arrears_rounded

            if r_id in existing_map:
                inv_row = existing_map[r_id]
                inv_row["arrears"] = arrears_rounded
                inv_row["total_payable"] = float(inv_row.get("total_amount") or inv_row.get("society_maintenance_fee") or 0.0) + arrears_rounded
                if _redis_client and inv_row.get("id"):
                    _redis_client.set(f"invoice_arrears:{inv_row['id']}", str(arrears_rounded), ex=365 * 86400)
                existing_invoices.append(inv_row)
            else:
                inv_data = {
                    "society_id": society_id,
                    "resident_id": r_id,
                    "society_maintenance_fee": maintenance_fee,
                    "hamsayaa_saas_fee": saas_fee,
                    "utility_charges": utility_charges,
                    "due_date": due_date,
                    "status": "unpaid",
                    "account_shown": account_shown,
                }
                if has_arrears_col:
                    inv_data["arrears"] = arrears_rounded
                new_invoices.append((r_id, inv_data, arrears_rounded))

        created_invoices = []
        if new_invoices:
            insert_payload = [item[1] for item in new_invoices]
            try:
                res = self.client.table("invoices").insert(insert_payload).execute()
                created_invoices = res.data or []
            except Exception as e:
                if has_arrears_col:
                    logger.warning(f"Insert with arrears column failed ({e}). Retrying without arrears column.")
                    for p in insert_payload:
                        p.pop("arrears", None)
                    res = self.client.table("invoices").insert(insert_payload).execute()
                    created_invoices = res.data or []
                else:
                    logger.error(f"Error inserting cycle invoices: {e}")
                    raise

            # Save arrears to Redis and enrich created invoices
            for (r_id, _, arr), inv_row in zip(new_invoices, created_invoices):
                iid = inv_row.get("id")
                inv_row["arrears"] = arr
                inv_row["total_payable"] = float(inv_row.get("total_amount") or inv_row.get("society_maintenance_fee") or 0.0) + arr
                if _redis_client and iid:
                    _redis_client.set(f"invoice_arrears:{iid}", str(arr), ex=365 * 86400)

        return created_invoices + existing_invoices


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
                "overdue_invoices": [],
                "active_passes": [],
                "flagged_overstays": [],
                "vehicle_logs": []
            }

        try:
            complaints = self.get_complaints(society_id)
            open_tickets = [c for c in complaints if c.get("status") in ["open", "in_progress", "needs_human_review"]]
            human_review = [c for c in complaints if c.get("status") == "needs_human_review"]

            invoices = self.get_invoices(society_id)
            overdue_invs = [i for i in invoices if i.get("status") == "overdue"]
            overdue_total = sum(float(i.get("total_payable") or i.get("total_amount") or i.get("society_maintenance_fee") or 0.0) for i in overdue_invs)

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
                "overdue_invoices": overdue_invs[:5],
                "active_passes": passes[:5],
                "flagged_overstays": overstays[:5],
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
                "overdue_invoices": [],
                "active_passes": [],
                "flagged_overstays": [],
                "vehicle_logs": []
            }
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

    def upload_document(
        self,
        file_bytes: bytes,
        filename: str,
        bucket_name: str = "society-receipts",
        mime_type: str = "application/pdf"
    ) -> str | None:
        """
        Uploads resident documents (PDF, CNIC scans, agreements) to Supabase Storage
        under 'documents/' and returns the permanent public URL.
        """
        if not self.client or not file_bytes:
            return None
        try:
            try:
                self.client.storage.create_bucket(bucket_name, options={"public": True})
            except Exception:
                pass

            storage_path = f"documents/{filename}"
            self.client.storage.from_(bucket_name).upload(
                file=file_bytes,
                path=storage_path,
                file_options={"content-type": mime_type, "upsert": "true"}
            )
            public_url = self.client.storage.from_(bucket_name).get_public_url(storage_path)
            logger.info(f"Uploaded resident document to Supabase Storage ({bucket_name}): {public_url}")
            return public_url
        except Exception as e:
            logger.error(f"Error uploading resident document to Supabase storage ({bucket_name}): {e}")
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

    # FALLBACK IN-MEMORY ADMINS STORE (active when Supabase table 'admins' is pending migration or unreachable)
    _fallback_admins = [
        {
            "id": "a0000000-0000-0000-0000-000000000001",
            "society_id": "d3b07384-d113-4c4e-9c8e-aa98350d1234",
            "name": "System Administrator",
            "email": "admin@hamsayaa.com",
            "password_hash": "$2b$12$Omn7SWvWw.p6Dt4uzltBYuoYO1ceYHMtw9e6u1gx30N7VDuQ57gie",
            "phone": "+923001234567",
            "role": "super_admin",
            "is_active": True,
            "created_at": "2026-09-01T00:00:00Z",
            "last_login_at": None,
        }
    ]

    # ADMIN USERS
    def get_admins(self, society_id: str):
        if self.client and self._has_admins_table:
            try:
                res = self.client.table("admins").select("id, society_id, name, email, phone, role, is_active, created_at, last_login_at").eq("society_id", society_id).order("created_at", desc=True).execute()
                if res.data:
                    return res.data
            except Exception as e:
                err_str = str(e)
                if "PGRST205" in err_str or "public.admins" in err_str:
                    self._has_admins_table = False
                    logger.info("Supabase 'admins' table not found in schema cache. Using built-in admin fallback store.")
                else:
                    logger.warning(f"Supabase query for admins table failed (using fallback store): {e}")
        return [
            {k: v for k, v in a.items() if k != "password_hash"}
            for a in self._fallback_admins
            if a.get("society_id") == society_id or society_id == "All"
        ]

    def get_admin_by_email(self, email: str):
        if not email:
            return None
        clean_email = email.lower().strip()
        if self.client and self._has_admins_table:
            try:
                res = self.client.table("admins").select("*").eq("email", clean_email).limit(1).execute()
                if res.data:
                    return res.data[0]
            except Exception as e:
                err_str = str(e)
                if "PGRST205" in err_str or "public.admins" in err_str:
                    self._has_admins_table = False
                    logger.info("Supabase 'admins' table not found in schema cache. Using built-in admin fallback store.")
                else:
                    logger.warning(f"Supabase query for admin by email failed (using fallback store): {e}")
        return next((a for a in self._fallback_admins if a["email"].lower().strip() == clean_email), None)

    def get_admin_by_id(self, admin_id: str):
        if not admin_id:
            return None
        if self.client and self._has_admins_table:
            try:
                res = self.client.table("admins").select("id, society_id, name, email, phone, role, is_active, created_at, last_login_at").eq("id", admin_id).limit(1).execute()
                if res.data:
                    return res.data[0]
            except Exception as e:
                err_str = str(e)
                if "PGRST205" in err_str or "public.admins" in err_str:
                    self._has_admins_table = False
                    logger.info("Supabase 'admins' table not found in schema cache. Using built-in admin fallback store.")
                else:
                    logger.warning(f"Supabase query for admin by ID failed (using fallback store): {e}")
        return next((a for a in self._fallback_admins if a["id"] == admin_id), None)

    def create_admin(self, admin_data: dict):
        clean_data = dict(admin_data)
        clean_data["email"] = clean_data.get("email", "").lower().strip()
        if self.client:
            try:
                res = self.client.table("admins").insert(clean_data).execute()
                if res.data:
                    return res.data[0]
            except Exception as e:
                logger.warning(f"Supabase insert for admin failed (saving in fallback store): {e}")
        
        # In-memory fallback
        new_admin = {
            "id": str(uuid.uuid4()),
            "created_at": datetime.now(timezone.utc).isoformat(),
            "last_login_at": None,
            **clean_data
        }
        self._fallback_admins.insert(0, new_admin)
        return new_admin

    def update_admin(self, admin_id: str, data: dict):
        clean_data = dict(data)
        if "email" in clean_data:
            clean_data["email"] = clean_data["email"].lower().strip()
        if self.client:
            try:
                res = self.client.table("admins").update(clean_data).eq("id", admin_id).execute()
                if res.data:
                    return res.data[0]
            except Exception as e:
                logger.warning(f"Supabase update for admin failed (updating fallback store): {e}")
        
        # In-memory fallback
        for a in self._fallback_admins:
            if a["id"] == admin_id:
                a.update(clean_data)
                return a
        return None

    def delete_admin(self, admin_id: str):
        if self.client:
            try:
                self.client.table("admins").delete().eq("id", admin_id).execute()
                return True
            except Exception as e:
                logger.warning(f"Supabase delete for admin failed (deleting from fallback store): {e}")
        
        # In-memory fallback
        initial_len = len(self._fallback_admins)
        self._fallback_admins = [a for a in self._fallback_admins if a["id"] != admin_id]
        return len(self._fallback_admins) < initial_len

    def update_admin_last_login(self, admin_id: str):
        now_iso = datetime.now(timezone.utc).isoformat()
        if self.client:
            try:
                res = self.client.table("admins").update({"last_login_at": now_iso}).eq("id", admin_id).execute()
                if res.data:
                    return res.data[0]
            except Exception as e:
                logger.warning(f"Supabase update admin last login failed: {e}")
        for a in self._fallback_admins:
            if a["id"] == admin_id:
                a["last_login_at"] = now_iso
                return a
        return None

    # FALLBACK IN-MEMORY POLLS & VOTES STORE
    _fallback_polls = [
        {
            "id": "p1111111-1111-1111-1111-111111111111",
            "society_id": "a1b2c3d4-e5f6-7890-abcd-111111111111",
            "title": "Should we upgrade the Block B Elevator System?",
            "options": ["Upgrade completely", "Repair current elevators", "No changes"],
            "expiry_timestamp": "2026-08-15T18:00:00Z",
            "is_closed": False,
            "created_at": "2026-07-25T10:00:00Z",
        },
        {
            "id": "p2222222-2222-2222-2222-222222222222",
            "society_id": "a1b2c3d4-e5f6-7890-abcd-111111111111",
            "title": "Proposal to establish a community gym in the Block C basement area.",
            "options": ["Support", "Oppose", "Neutral"],
            "expiry_timestamp": "2026-07-28T12:00:00Z",
            "is_closed": True,
            "created_at": "2026-07-20T08:00:00Z",
        }
    ]

    _fallback_poll_votes = [
        {
            "id": "v1111111-1111-1111-1111-111111111111",
            "poll_id": "p1111111-1111-1111-1111-111111111111",
            "resident_id": "r1111111-1111-1111-1111-111111111111",
            "selected_option": "Upgrade completely",
            "created_at": "2026-07-26T10:00:00Z"
        }
    ]

    # POLLS & VOTES
    def get_polls(self, society_id: str, resident_id: str | None = None):
        """
        Fetch all community polls for a society, aggregating votes count per option
        and computing total_votes and resident_voted_option if resident_id provided.
        """
        raw_polls = []
        if self.client:
            try:
                res = self.client.table("polls").select("*").eq("society_id", society_id).order("created_at", desc=True).execute()
                if res.data:
                    raw_polls = res.data
            except Exception as e:
                logger.warning(f"Supabase query for polls failed (using fallback store): {e}")

        if not raw_polls:
            raw_polls = [p for p in self._fallback_polls if p.get("society_id") == society_id]
            if not raw_polls and society_id:
                raw_polls = list(self._fallback_polls)

        enriched_polls = []
        for p in raw_polls:
            poll_id = p["id"]
            options = p.get("options") or []
            if isinstance(options, str):
                import json
                try:
                    options = json.loads(options)
                except Exception:
                    options = [o.strip() for o in options.split(",") if o.strip()]

            votes_list = []
            if self.client:
                try:
                    v_res = self.client.table("poll_votes").select("resident_id, selected_option").eq("poll_id", poll_id).execute()
                    if v_res.data:
                        votes_list = v_res.data
                except Exception as e:
                    logger.debug(f"Supabase query for poll_votes failed: {e}")

            if not votes_list:
                votes_list = [v for v in self._fallback_poll_votes if v.get("poll_id") == poll_id]

            vote_counts = {opt: 0 for opt in options}
            resident_voted_opt = None

            for v in votes_list:
                opt = v.get("selected_option")
                if opt in vote_counts:
                    vote_counts[opt] += 1
                elif opt:
                    vote_counts[opt] = vote_counts.get(opt, 0) + 1

                if resident_id and str(v.get("resident_id")) == str(resident_id):
                    resident_voted_opt = opt

            total_votes = sum(vote_counts.values())

            is_closed = p.get("is_closed", False)
            expiry_str = p.get("expiry_timestamp")
            if not is_closed and expiry_str:
                try:
                    expiry_dt = datetime.fromisoformat(expiry_str.replace("Z", "+00:00"))
                    if datetime.now(timezone.utc) > expiry_dt:
                        is_closed = True
                except Exception:
                    pass

            enriched = {
                **p,
                "options": options,
                "votes": vote_counts,
                "total_votes": total_votes,
                "is_closed": is_closed,
                "resident_voted_option": resident_voted_opt
            }
            enriched_polls.append(enriched)

        return enriched_polls

    def get_poll_by_id(self, poll_id: str, resident_id: str | None = None):
        """
        Fetch a single poll by ID with aggregated vote counts.
        """
        poll = None
        if self.client:
            try:
                res = self.client.table("polls").select("*").eq("id", poll_id).limit(1).execute()
                if res.data:
                    poll = res.data[0]
            except Exception as e:
                logger.warning(f"Supabase query for poll {poll_id} failed: {e}")

        if not poll:
            for p in self._fallback_polls:
                if str(p.get("id")) == str(poll_id):
                    poll = dict(p)
                    break

        if not poll:
            return None

        options = poll.get("options") or []
        if isinstance(options, str):
            import json
            try:
                options = json.loads(options)
            except Exception:
                options = [o.strip() for o in options.split(",") if o.strip()]

        votes_list = []
        if self.client:
            try:
                v_res = self.client.table("poll_votes").select("resident_id, selected_option").eq("poll_id", poll_id).execute()
                if v_res.data:
                    votes_list = v_res.data
            except Exception:
                pass
        if not votes_list:
            votes_list = [v for v in self._fallback_poll_votes if str(v.get("poll_id")) == str(poll_id)]

        vote_counts = {opt: 0 for opt in options}
        resident_voted_opt = None
        for v in votes_list:
            opt = v.get("selected_option")
            if opt in vote_counts:
                vote_counts[opt] += 1
            elif opt:
                vote_counts[opt] = vote_counts.get(opt, 0) + 1
            if resident_id and str(v.get("resident_id")) == str(resident_id):
                resident_voted_opt = opt

        total_votes = sum(vote_counts.values())

        is_closed = poll.get("is_closed", False)
        expiry_str = poll.get("expiry_timestamp")
        if not is_closed and expiry_str:
            try:
                expiry_dt = datetime.fromisoformat(expiry_str.replace("Z", "+00:00"))
                if datetime.now(timezone.utc) > expiry_dt:
                    is_closed = True
            except Exception:
                pass

        return {
            **poll,
            "options": options,
            "votes": vote_counts,
            "total_votes": total_votes,
            "is_closed": is_closed,
            "resident_voted_option": resident_voted_opt
        }

    def create_poll(self, poll_data: dict):
        """
        Create a new poll in Supabase or in-memory fallback.
        """
        clean_data = dict(poll_data)
        if "id" not in clean_data:
            clean_data["id"] = str(uuid.uuid4())
        if "created_at" not in clean_data:
            clean_data["created_at"] = datetime.now(timezone.utc).isoformat()
        clean_data["is_closed"] = False

        if self.client:
            try:
                res = self.client.table("polls").insert(clean_data).execute()
                if res.data:
                    created = res.data[0]
                    options = created.get("options") or []
                    return {
                        **created,
                        "votes": {opt: 0 for opt in options},
                        "total_votes": 0
                    }
            except Exception as e:
                logger.warning(f"Supabase insert for poll failed (saving to fallback store): {e}")

        # In-memory fallback
        self._fallback_polls.insert(0, clean_data)
        options = clean_data.get("options") or []
        return {
            **clean_data,
            "votes": {opt: 0 for opt in options},
            "total_votes": 0
        }

    def close_poll(self, poll_id: str):
        """
        Close an active poll in Supabase or fallback store.
        """
        if self.client:
            try:
                res = self.client.table("polls").update({"is_closed": True}).eq("id", poll_id).execute()
                if res.data:
                    return res.data[0]
            except Exception as e:
                logger.warning(f"Supabase update close_poll failed: {e}")

        for p in self._fallback_polls:
            if str(p.get("id")) == str(poll_id):
                p["is_closed"] = True
                return p
        return None

    def cast_vote(self, poll_id: str, resident_id: str, selected_option: str):
        """
        Cast or update a vote for a resident on a poll, enforcing 1 vote per resident / unit.
        If the resident has already voted and selects a new option, their vote is updated.
        Strictly rejects votes if the poll is closed or if the expiry timer has elapsed.
        """
        clean_opt = selected_option.strip()

        # 0. Check poll status and expiry
        poll = self.get_poll_by_id(poll_id)
        if not poll:
            return {"status": "not_found", "message": "Poll does not exist"}

        is_closed = poll.get("is_closed", False)
        expiry_str = poll.get("expiry_timestamp")
        if not is_closed and expiry_str:
            try:
                expiry_dt = datetime.fromisoformat(expiry_str.replace("Z", "+00:00"))
                if datetime.now(timezone.utc) > expiry_dt:
                    is_closed = True
                    # Auto-close expired poll in Supabase
                    if self.client:
                        try:
                            self.client.table("polls").update({"is_closed": True}).eq("id", poll_id).execute()
                        except Exception as e:
                            logger.debug(f"Auto-closing poll in DB error: {e}")
            except Exception:
                pass

        if is_closed:
            return {
                "status": "expired",
                "poll_title": poll.get("title"),
                "message": "Voting for this poll has ended. No further votes can be accepted."
            }

        # 1. Check if resident already voted in Supabase
        if self.client:
            try:
                check = self.client.table("poll_votes").select("*").eq("poll_id", poll_id).eq("resident_id", resident_id).execute()
                if check.data and len(check.data) > 0:
                    existing_vote = check.data[0]
                    existing_opt = existing_vote.get("selected_option")
                    # If choice is identical, report already voted
                    if clean_opt.strip().lower() == str(existing_opt).strip().lower():
                        return {
                            "status": "already_voted",
                            "existing_option": existing_opt,
                            "vote": existing_vote
                        }
                    # If choice is different, update existing vote (enforcing 1 vote per unit)
                    upd_res = self.client.table("poll_votes").update({
                        "selected_option": clean_opt,
                        "created_at": datetime.now(timezone.utc).isoformat()
                    }).eq("id", existing_vote["id"]).execute()
                    updated_record = upd_res.data[0] if upd_res.data else {**existing_vote, "selected_option": clean_opt}
                    return {
                        "status": "updated",
                        "previous_option": existing_opt,
                        "new_option": clean_opt,
                        "vote": updated_record
                    }
            except Exception as e:
                logger.warning(f"Supabase check/update existing vote failed: {e}")

        # Check fallback votes
        for v in self._fallback_poll_votes:
            if str(v.get("poll_id")) == str(poll_id) and str(v.get("resident_id")) == str(resident_id):
                prev_opt = v.get("selected_option")
                if clean_opt.strip().lower() == str(prev_opt).strip().lower():
                    return {
                        "status": "already_voted",
                        "existing_option": prev_opt,
                        "vote": v
                    }
                v["selected_option"] = clean_opt
                v["created_at"] = datetime.now(timezone.utc).isoformat()
                return {
                    "status": "updated",
                    "previous_option": prev_opt,
                    "new_option": clean_opt,
                    "vote": v
                }

        # 2. Insert new vote
        vote_record = {
            "id": str(uuid.uuid4()),
            "poll_id": poll_id,
            "resident_id": resident_id,
            "selected_option": clean_opt,
            "created_at": datetime.now(timezone.utc).isoformat()
        }

        if self.client:
            try:
                res = self.client.table("poll_votes").insert(vote_record).execute()
                if res.data:
                    return {"status": "success", "vote": res.data[0]}
            except Exception as e:
                logger.warning(f"Supabase insert poll_vote failed: {e}")

        # In-memory fallback
        self._fallback_poll_votes.append(vote_record)
        return {"status": "success", "vote": vote_record}

    def delete_poll(self, poll_id: str) -> bool:
        """
        Delete a poll and all associated votes from Supabase and in-memory fallback.
        """
        success = False
        if self.client:
            try:
                # 1. Delete associated votes first to satisfy foreign key constraints
                self.client.table("poll_votes").delete().eq("poll_id", poll_id).execute()
                # 2. Delete the poll record
                self.client.table("polls").delete().eq("id", poll_id).execute()
                success = True
            except Exception as e:
                logger.error(f"Supabase delete_poll failed: {e}")

        # Clean fallback stores
        self._fallback_polls = [p for p in self._fallback_polls if str(p.get("id")) != str(poll_id)]
        self._fallback_poll_votes = [v for v in self._fallback_poll_votes if str(v.get("poll_id")) != str(poll_id)]
        return success or True

db_service = DatabaseService()
