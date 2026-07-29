[Hamsayaa_TRD_v1.4.md](https://github.com/user-attachments/files/30503355/Hamsayaa_TRD_v1.4.md)
# Hamsayaa — Technical Requirements Document (TRD)

> **Document Version:** 1.4 (Final — all open items resolved)
> **Companion Document:** `Hamsayaa_PRD.md` v1.4

---

## 1. System Architecture & AI Stack

```
[ Resident (WhatsApp) ]
        │
        ▼
[ Meta WhatsApp Cloud API ]
        │
        ▼
[ Python (FastAPI) Webhook Engine ] ──► [ Gemini API Engine ]
        │                                (Context Guardrail,
        │                                 Intent Parsing)
        ▼
[ PostgreSQL / Supabase DB ] ◄────────► [ React Admin Dashboard ]
        │
        ▼
[ Celery + Redis (Background Jobs) ]
```

### 1.1 Technology Stack

* **Frontend Dashboard:** React.js, Tailwind CSS, Lucide Icons, Recharts.
* **Backend Webhook Engine:** Python (FastAPI).
* **Background Jobs / Scheduling:** Celery + Redis (required in Phase 1 for overstay checks and poll expiry).
* **Database & Auth (data layer):** PostgreSQL (Supabase / Managed Postgres) with Row-Level Security (RLS).
* **Auth (dashboard users):** Supabase Auth, single role (`admin`).
* **AI Model Engine:** Gemini API (`gemini-1.5-flash`) for context filtering, entity extraction, and message handling. Native audio input confirmed for Phase 2 voice-note transcription.
* **Messaging Gateway:** Meta WhatsApp Cloud API.
* **Storage Bucket:** AWS S3 / Supabase Storage (for receipt images, generated pass PDFs, expense records).

---

## 2. Database Schema & Multi-Tenancy Architecture

All operational tables carry `society_id` to enforce strict tenant isolation via database policies.

```sql
-- Societies (Tenants)
CREATE TABLE societies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    address TEXT NOT NULL,
    total_units INT NOT NULL,
    hamsayaa_per_unit_rate DECIMAL(10,2) DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Dashboard Users (Admin only)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    society_id UUID REFERENCES societies(id) ON DELETE CASCADE,
    email VARCHAR(255) UNIQUE NOT NULL,
    role VARCHAR(50) CHECK (role IN ('admin')) DEFAULT 'admin',
    auth_provider VARCHAR(50) DEFAULT 'supabase_auth',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Residents Table
CREATE TABLE residents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    society_id UUID REFERENCES societies(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    unit_number VARCHAR(50) NOT NULL,
    phone_number VARCHAR(20) UNIQUE NOT NULL,
    cnic VARCHAR(15),
    is_owner BOOLEAN DEFAULT TRUE,
    is_tenant BOOLEAN DEFAULT FALSE,
    is_blocked BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(society_id, unit_number, phone_number)
);

-- Registered Resident Vehicles
CREATE TABLE registered_vehicles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    society_id UUID REFERENCES societies(id) ON DELETE CASCADE,
    resident_id UUID REFERENCES residents(id) ON DELETE CASCADE,
    vehicle_plate VARCHAR(20) NOT NULL,
    vehicle_type VARCHAR(50) DEFAULT 'Car',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Dues & Cumulative Invoices (Resident-facing)
CREATE TABLE invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    society_id UUID REFERENCES societies(id) ON DELETE CASCADE,
    resident_id UUID REFERENCES residents(id) ON DELETE CASCADE,
    society_maintenance_fee DECIMAL(10,2) NOT NULL,
    hamsayaa_saas_fee DECIMAL(10,2) NOT NULL,
    utility_charges DECIMAL(10,2) DEFAULT 0.00,
    total_amount DECIMAL(10,2) GENERATED ALWAYS AS (society_maintenance_fee + hamsayaa_saas_fee + utility_charges) STORED,
    due_date DATE NOT NULL,
    status VARCHAR(20) CHECK (status IN ('unpaid', 'paid', 'overdue', 'verified')) DEFAULT 'unpaid',
    receipt_image_url TEXT,
    account_shown TEXT,
    verified_by UUID REFERENCES users(id),
    verified_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
-- NOTE: Resident invoices are editable by the Admin. Amount fields, due_date, and line items
-- may be updated directly. The `updated_at` field tracks modifications.

-- Society Bills (Hamsayaa charges to society)
CREATE TABLE society_bills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    society_id UUID REFERENCES societies(id) ON DELETE CASCADE,
    billing_period_start DATE NOT NULL,
    billing_period_end DATE NOT NULL,
    unit_count INT NOT NULL,
    per_unit_rate DECIMAL(10,2) NOT NULL,
    total_amount DECIMAL(10,2) GENERATED ALWAYS AS (unit_count * per_unit_rate) STORED,
    status VARCHAR(20) CHECK (status IN ('unpaid', 'paid', 'overdue')) DEFAULT 'unpaid',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
-- NOTE: This tracks Hamsayaa's monthly charge to the society (unit_count × per_unit_rate),
-- separate from resident-facing invoices. Hamsayaa bills the society directly.

-- Complaints & System Tickets
CREATE TABLE complaints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    society_id UUID REFERENCES societies(id) ON DELETE CASCADE,
    resident_id UUID REFERENCES residents(id) ON DELETE CASCADE,
    ticket_number VARCHAR(20) UNIQUE NOT NULL,
    category VARCHAR(50) NOT NULL,
    description TEXT NOT NULL,
    photo_url TEXT,
    status VARCHAR(30) CHECK (status IN ('open', 'in_progress', 'resolved', 'needs_human_review', 'flagged_irrelevant')) DEFAULT 'open',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    resolved_at TIMESTAMP WITH TIME ZONE
);

-- Visitor & Guest Passes
CREATE TABLE visitor_passes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    society_id UUID REFERENCES societies(id) ON DELETE CASCADE,
    resident_id UUID REFERENCES residents(id) ON DELETE CASCADE,
    visitor_name VARCHAR(255) NOT NULL,
    visitor_cnic VARCHAR(15) NOT NULL,
    vehicle_plate VARCHAR(20),
    pass_code VARCHAR(10) NOT NULL,
    valid_from TIMESTAMP WITH TIME ZONE NOT NULL,
    valid_until TIMESTAMP WITH TIME ZONE NOT NULL,
    pass_media_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
-- NOTE: `visitor_cnic` is automatically purged after 30 days via a scheduled background job.
-- `pass_code` is printed on the pass image for human visual verification only; there is no
-- gate-facing scanner or lookup interface.

-- Daily Vehicle Entry/Exit Logs
CREATE TABLE vehicle_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    society_id UUID REFERENCES societies(id) ON DELETE CASCADE,
    vehicle_plate VARCHAR(20) NOT NULL,
    entry_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    exit_time TIMESTAMP WITH TIME ZONE,
    source VARCHAR(20) CHECK (source IN ('manual', 'excel_import', 'camera')) DEFAULT 'manual',
    is_registered BOOLEAN DEFAULT FALSE,
    is_flagged_overstay BOOLEAN DEFAULT FALSE,
    resolved_by UUID REFERENCES users(id)
);

-- Society Polls & Voting
CREATE TABLE polls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    society_id UUID REFERENCES societies(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    options JSONB NOT NULL,
    expiry_timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    is_closed BOOLEAN DEFAULT FALSE,
    results_media_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE poll_votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    poll_id UUID REFERENCES polls(id) ON DELETE CASCADE,
    resident_id UUID REFERENCES residents(id) ON DELETE CASCADE,
    selected_option VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(poll_id, resident_id)
);

-- Society Expenses Ledger
CREATE TABLE expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    society_id UUID REFERENCES societies(id) ON DELETE CASCADE,
    amount DECIMAL(10,2) NOT NULL,
    vendor_name VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL,
    receipt_url TEXT,
    logged_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
-- NOTE: Society expense entries are append-only. No UPDATE/DELETE on amount, vendor_name,
-- category, or created_at once written. Corrections require a reversing/adjustment row.

-- Employee Directory
CREATE TABLE employees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    society_id UUID REFERENCES societies(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(100) NOT NULL,
    contact_info VARCHAR(255),
    shift VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Asset Directory + Maintenance Logs
CREATE TABLE assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    society_id UUID REFERENCES societies(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(100),
    install_date DATE,
    next_service_due DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE maintenance_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    society_id UUID REFERENCES societies(id) ON DELETE CASCADE,
    asset_id UUID REFERENCES assets(id) ON DELETE CASCADE,
    serviced_at DATE NOT NULL,
    notes TEXT,
    next_due_override DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Amenities (static info) + Bookings
CREATE TABLE amenities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    society_id UUID REFERENCES societies(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    timings VARCHAR(255),
    rules TEXT,
    capacity INT,
    is_bookable BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE amenity_bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    society_id UUID REFERENCES societies(id) ON DELETE CASCADE,
    amenity_id UUID REFERENCES amenities(id) ON DELETE CASCADE,
    resident_id UUID REFERENCES residents(id) ON DELETE CASCADE,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE NOT NULL,
    status VARCHAR(20) CHECK (status IN ('pending', 'confirmed', 'cancelled')) DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

---

## 3. Core System Logic & Workflows

### 3.1 AI Context Guardrail & Ticket Creation Pipeline (Gemini API)

1. WhatsApp Cloud API delivers inbound resident message payload to `/webhook/whatsapp`.
2. Server verifies `phone_number` against `residents` table and confirms `is_blocked == false`.
3. System sends message body and society metadata context to Gemini API (`gemini-1.5-flash`).
4. **Evaluation Logic:**
   - If message is off-topic, spam, or abusive: System returns JSON `{ "status": "flagged", "reason": "off_topic" }`. Server writes complaint entry with `status: flagged_irrelevant`, and sends polite rejection text back to user.
   - If message is valid complaint: Gemini extracts category, description. Server writes ticket with generated `ticket_number` and returns confirmation ID.
   - If query fails parsing **2 consecutive times**: System generates ticket with `status: needs_human_review`.

### 3.2 Pass Generation & Direct Delivery Pipeline

1. Resident requests guest entry pass via WhatsApp.
2. Webhook validates resident active status (`is_blocked == false`).
3. Payload with Visitor Name, Visitor CNIC, Vehicle Plate, and Expiry Window is passed to HTML/Puppeteer renderer.
4. Server generates compact pass PDF/image file (including human-readable `pass_code`), uploads to Storage Bucket, and retrieves `pass_media_url`.
5. Webhook sends WhatsApp media message containing the PDF/image link directly to the resident's WhatsApp number only.
6. **Gate verification:** Visitor shows the pass (on phone or printout) to the gatekeeper. The gatekeeper visually inspects the `pass_code`, visitor name, vehicle plate, and validity window. No scanning, no system lookup, no device access.

### 3.3 Overstay Detection & Vehicle Import Engine

1. **Bulk Vehicle Roster Import:** Admin uploads Excel (.xlsx/.csv) containing registered resident plates or daily entrance logs. Backend parses rows, runs deduplication, and batch-inserts into `registered_vehicles` or `vehicle_logs`.
2. **Overstay Check Job:** Celery background worker runs periodically checking `vehicle_logs` where `exit_time IS NULL`:
   - Checks if `vehicle_plate` exists in `registered_vehicles`. If found, mark `is_registered = true` and **stop** — registered vehicles are excluded from the overstay check entirely.
   - If unregistered, check `visitor_passes` for matching `vehicle_plate` where current time is within `valid_from` and `valid_until`.
   - If no valid pass exists (i.e., `valid_until` has passed): set `is_flagged_overstay = true` immediately (0-minute grace) and push alert to Admin Dashboard socket.

### 3.4 Manual Account Blocking Enforcement

1. Admin clicks "Block Account" on overdue invoice row in Admin Dashboard.
2. Server executes `UPDATE residents SET is_blocked = true WHERE id = :resident_id`.
3. Webhook checks `is_blocked` flag on every incoming event. If true, execution halts before LLM invocation, immediately returning static text: *"Your account is currently suspended due to pending dues. Please contact management or send payment proof to restore access."*

### 3.5 Poll Expiry & Automated Report Export

1. Celery cron job checks for active polls where `expiry_timestamp <= NOW()` and `is_closed == false`.
2. Query aggregates vote totals per option from `poll_votes`.
3. System compiles one shared static Excel/PDF summary file, uploads to Storage Bucket, and stores `results_media_url`.
4. Summary file is emailed to all `users` (admin role) for the society.
5. System sends WhatsApp message to each participating resident containing the shared results link/file, with their flat/unit number included in the message text.
6. DB updates `polls.is_closed = true`.

### 3.6 CNIC Auto-Purge Job

1. Celery scheduled job runs daily.
2. Deletes rows from `visitor_passes` where `created_at < NOW() - INTERVAL '30 days'`.
3. Alternatively, if audit retention is desired, the `visitor_cnic` column is set to `NULL` while preserving the rest of the pass record.

---

## 4. API Endpoints Specification

### 4.1 WhatsApp Webhook
- `POST /api/v1/whatsapp/webhook` — Receives inbound WhatsApp event notifications.
- `GET /api/v1/whatsapp/webhook` — Meta API verification endpoint.

### 4.2 Dashboard REST APIs
- `POST /api/v1/auth/login` — Admin authentication.
- `POST /api/v1/residents/bulk-import` — Upload Excel/CSV for resident & vehicle registration.
- `POST /api/v1/vehicles/logs/bulk-import` — Upload Excel file for daily gate entrance logs.
- `PATCH /api/v1/residents/:id/toggle-block` — Manually block/unblock resident WhatsApp access.
- `POST /api/v1/invoices/generate` — Create cumulative invoices for billing cycle.
- `PATCH /api/v1/invoices/:id` — Edit resident invoice (amounts, due date, line items).
- `POST /api/v1/society-bills/generate` — Create Hamsayaa's monthly charge to the society.
- `GET /api/v1/dashboard/metrics` — Aggregate counters for tickets, overstays, and collection status.
- `GET/POST /api/v1/employees` — Employee Directory CRUD.
- `GET/POST /api/v1/assets`, `POST /api/v1/assets/:id/maintenance-logs` — Asset directory + maintenance logging.
- `GET/POST /api/v1/amenities`, `POST /api/v1/amenities/:id/bookings` — Amenity info (Phase 1) and booking (Phase 2).

---

## 5. Security, Multi-Tenancy & Token Optimization

- **Multi-Tenant Isolation:** Supabase Row-Level Security (RLS) policies enforce that logged-in dashboard users can only access data where `society_id` matches their authenticated session.
- **Meta Webhook Signature Verification:** All inbound webhook requests calculate HMAC SHA-256 signatures using the Meta Application Secret to reject unauthorized payloads.
- **Token Minimization Strategy:** Passes, poll results, and blocked-account responses avoid LLM calls entirely using static templates and pre-compiled renderers, reserving Gemini API tokens strictly for intent parsing and context guardrails.
- **Financial ledger integrity:** Society `expenses` are append-only for amount/vendor/date fields once written; only status fields transition. Resident `invoices` are editable by the Admin.
- **Visitor CNIC handling:** Auto-purged after 30 days via scheduled job. Not exposed in default dashboard list views.
- **Dashboard auth:** Supabase Auth, single role (`admin`).

---

## 6. Build Sequencing & Implementation Phases

**Phase 1 — MVP Pilot Execution**
- Setup PostgreSQL schema, RLS policies, and FastAPI backend server.
- Setup Celery + Redis for background jobs (overstay checks, poll expiry, CNIC purge).
- Integrate Meta Cloud API webhook with Gemini API context guardrails.
- Build PDF/Image pass generation workflow (resident delivery only, human-readable pass_code).
- Build Dashboard modules: Bulk Excel imports (residents & vehicles), manual vehicle entry log form, overstay alert list, cumulative invoice manager with manual block toggle and editable invoices, Employee Directory CRUD, Asset Directory CRUD (no predictive alerts yet), Amenity info lookup (no booking).
- Build `society_bills` module for Hamsayaa's monthly society-level billing.

**Phase 2 — Post-Pilot Expansion**
- Camera/ANPR entrance feed webhook integration.
- Gemini voice-note transcription parsing (native audio input confirmed).
- Amenity booking conflict engine.
- Predictive asset maintenance alerts (AMC/service due-date nudges).
- Urdu/Roman Urdu multi-language parsing layer.

**Phase 3 — Scale Hardening & Platform Governance**
- Database read-replica deployment and additional Redis caching for high-frequency society lookups.
- Multi-region failover and queue workers hardened for peak invoice generation days.
- Advanced audit logging for regulatory reporting.
- Automated database archiving for old visitor passes and exit logs.

---

## 7. Environment & Infrastructure Checklist

### 7.1 Required Environment Variables

```
# Meta WhatsApp API Secrets

App ID: your_whatsapp_app_id
App Secret: your_whatsapp_app_secret
Access Token : your_whatsapp_access_token
Test Number: 
+1 (555) 137-2995

# Primary LLM Engine (Gemini)
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-1.5-flash

# Database Connection


SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_PUBLISHABLE_KEY=your_supabase_anon_key
SUPABASE_SECRET_KEY=your_supabase_service_role_key
SUPABASE_JWKS_URL=https://your-project-id.supabase.co/auth/v1/.well-known/jwks.json

# Background Jobs (Phase 1 — required)
redis-cli --tls -u redis://default:your_upstash_redis_rest_token@your-redis-instance.upstash.io:6379

UPSTASH_REDIS_REST_URL="https://your-redis-instance.upstash.io"
UPSTASH_REDIS_REST_TOKEN="your_upstash_redis_rest_token"

from upstash_redis import Redis

redis = Redis(url="https://your-redis-instance.upstash.io", token="your_upstash_redis_rest_token")

redis.set("foo", "bar")
value = redis.get("foo")

# Per-society configurable values (admin-editable, not hardcoded)
SOCIETY_PAYMENT_ACCOUNT_DETAILS=your_default_here

# Observability
sentry_sdk.init(
    dsn="https://your_sentry_dsn_key@o4511768020844544.ingest.us.sentry.io/4511768069472256",
    # Add data like request headers and IP for users,
    # see https://docs.sentry.io/platforms/python/data-management/data-collected/ for more info
    send_default_pii=True,
)
```
