# Hamsayaa — Multi-Agent & Developer Workspace Context (AGENTS.md)

Welcome to **Hamsayaa (ہمسایہ)**. This document serves as the single source of truth for all AI assistants (Antigravity/Gemini) and developers collaborating on this codebase. It documents our system architecture, design decisions, database schemas, active conventions, and operational workflows.

---

## 1. Project Overview & Business Context

- **What is Hamsayaa?** An AI-first, zero-install Property Management SaaS designed for gated residential communities and apartment complexes in Pakistan and emerging markets.
- **Business Model:** B2B / B2B2C SaaS.
  - **Paying Customer:** Society Management Committees (RWA), Real Estate Developers, Building Admin Offices.
  - **End Users:** Verified residents/tenants living in the residential society.
- **The Core Innovation (Zero-Install UX):**
  - Residents interact exclusively through **WhatsApp** (text, voice notes, and images/receipts). No mobile app download, login, or registration portal is required for residents.
  - Society administrators manage operations, verify dues, track tickets, dispatch notices, and configure vouchers through a modern **React Web Dashboard**.
  - **Zero Resident Exposure Policy:** `hamsayaa_saas_fee` is strictly a B2B SaaS platform fee paid by the society office. Residents must NEVER see SaaS platform fees on WhatsApp, in invoices, or in bill breakdowns. Residents only see direct society maintenance line items (Guard, Sweeper, Water, Generator, etc.).

---

## 2. Technical Stack & Infrastructure Matrix

| Layer | Technology | Details |
|---|---|---|
| **Backend API** | **FastAPI** (Python 3.12 / Uvicorn) | Async REST API running on port `8000` (`backend/app/main.py`). |
| **Frontend Dashboard** | **React 18 + Vite** | Single Page App running on port `3000` (`frontend/`). |
| **AI LLM Engine** | **Google Gemini 3.x** (`gemini-3.5-flash-lite`, `gemini-3.7-flash`, `gemini-3.6-flash`, `gemini-flash-latest`) | Multimodal intent reasoning, vision OCR, multilingual (English, Urdu, Roman Urdu). *Note: `gemini-2.0` and `2.5` are deprecated/retired.* |
| **Audio Processing** | **Gemini Multimodal Audio** | Native binary transcription of WhatsApp voice notes (`.ogg` / `.opus`). |
| **Vision & Image OCR** | **Gemini Multimodal Vision** | Native visual inspection of payment bank slips and maintenance damage photos. |
| **Database** | **Supabase** (Managed PostgreSQL) | Relational database with Row Level Security (RLS) and PostgREST. |
| **Session Memory & Cache** | **Upstash Redis** (Serverless REST) | 24-hr chat history, atomic webhook deduplication, delivery tracking, and payment audit trail. |
| **Object Storage** | **Supabase Storage** | Public buckets: `society-voice-notes` (audio recordings), `society-receipts` (payment slips & defect photos). |
| **Local Tunneling** | **ngrok** | Exposes local FastAPI port 8000 to Meta WhatsApp Cloud API webhooks. |
| **Messaging Channel** | **Meta WhatsApp Cloud API** (Graph API v21.0) | Inbound webhooks and outbound messaging to verified residents. |
| **Error Monitoring** | **Sentry SDK** | Backend observability and exception tracking. |
| **Production Cloud** | **Railway (Backend) + Vercel (Frontend)** | Continuous deployment via GitHub `main` branch. |

---

## 2.1 Complete Repository Directory Map

```
hamsayaa/
├── AGENTS.md                                 # Single source of truth context file (this file)
├── README.md                                 # Project overview & quickstart
├── start.bat                                 # Windows one-click launcher (Backend + Frontend + ngrok)
├── stop.bat                                  # Windows one-click shutdown (kills Python, Node, ngrok)
│
├── backend/                                  # FastAPI Backend Application
│   ├── Dockerfile                            # Production Debian slim Docker container with socat
│   ├── requirements.txt                      # Python dependencies
│   ├── .env.example                          # Template for environment variables
│   ├── .env                                  # Local secrets (gitignored, 0 secrets in repo)
│   └── app/
│       ├── main.py                           # FastAPI initialization, CORS, Sentry, router inclusion
│       ├── core/
│       │   └── config.py                     # Pydantic Settings class reading from .env
│       ├── db/
│       │   └── supabase.py                   # Supabase client & DatabaseService CRUD wrapper
│       ├── services/
│       │   ├── gemini.py                     # LLM engine, cascade, system prompt, vision & audio processing
│       │   └── whatsapp.py                   # Meta WhatsApp Graph API client (send text, download media)
│       └── api/v1/
│           ├── router.py                     # Aggregates all v1 endpoint routers
│           └── endpoints/
│               ├── whatsapp.py               # Inbound Meta webhook (GET verify, POST message processing)
│               ├── test_whatsapp.py          # Interactive simulation sandbox for resident messaging
│               ├── residents.py              # Resident CRUD, Excel import, WhatsApp broadcast notifications
│               ├── invoices.py               # Voucher settings, generation, mark paid, verify receipt, resend
│               ├── complaints.py             # Tickets list, status updates, WhatsApp resolution alerts
│               ├── vehicles.py               # Vehicle registration & entry/exit logs
│               ├── polls.py                  # Community polls & 1-vote-per-unit enforcement
│               ├── employees.py              # Staff roster, shifts, duty statuses
│               ├── assets.py                 # Society machinery & maintenance schedule logs
│               ├── amenities.py              # Facilities list, statuses, booking schedules
│               └── settings.py               # Society profile & bank account settings
│
└── frontend/                                 # React 18 + Vite Frontend Application
    ├── package.json                          # Dependencies & build scripts
    ├── vite.config.js                        # Vite bundler configuration
    ├── vercel.json                           # Vercel proxy rewrite config (/api/* -> Railway)
    ├── index.html                            # HTML entry point with Favicon
    └── src/
        ├── main.jsx                          # React DOM initialization
        ├── App.jsx                           # Route definitions & layout wrapper
        ├── index.css                         # Tailwind directives, animations (ticker, scroll, pills)
        ├── components/
        │   ├── Navbar.jsx                    # Top navigation bar with society switcher & status badge
        │   └── Sidebar.jsx                   # Left drawer navigation links with active indicators
        ├── services/
        │   ├── api.js                        # API client functions with resilient fallbacks to mock data
        │   └── mockData.js                   # Local offline dataset for seamless demo resilience
        └── pages/
            ├── Dashboard.jsx                 # Summary metrics, animated count-ups, subtext circular ticker
            ├── Complaints.jsx                # Ticket management, damage photo inspection, voice audio player
            ├── Invoices.jsx                  # Finance vouchers, bank cross-check card, mark paid modal
            ├── Residents.jsx                 # Occupancy roster, WhatsApp broadcast modal, deduplication
            ├── GatePasses.jsx                # Visitor passes, pass codes, vehicle plates
            ├── Vehicles.jsx                  # Registered vehicles & access control logs
            ├── Employees.jsx                 # Staff roster, active shifts, salaries
            ├── Assets.jsx                    # Society machinery assets & routine maintenance logs
            ├── Amenities.jsx                 # Facilities directory, booking slots, statuses
            ├── Polls.jsx                     # Community surveys with percentage breakdown
            └── Settings.jsx                  # Society profile, bank credentials, default invoice settings
```

---

## 2.2 Environment Variables Reference (`backend/.env`)

| Variable Name | Required | Example / Default Value | Purpose |
|---|---|---|---|
| `PROJECT_NAME` | No | `Hamsayaa Backend Webhook Engine` | Display name in OpenAPI / Swagger docs. |
| `API_V1_STR` | No | `/api/v1` | Root prefix for all API endpoints. |
| `WHATSAPP_APP_ID` | Yes | `123456789012345` | Meta Developer App ID. |
| `WHATSAPP_APP_SECRET` | Yes | `a1b2c3d4e5f6...` | Meta Developer App Secret. |
| `WHATSAPP_ACCESS_TOKEN` | Yes | `EAAx...` (System User Token) | Permanent Meta Graph API token for sending messages. |
| `WHATSAPP_PHONE_NUMBER_ID`| Yes | `1229806946879920` | Meta Cloud API Phone Number ID. |
| `WHATSAPP_VERIFY_TOKEN` | Yes | `hamsayaa_webhook_verify_token_secure` | Token used by Meta to verify webhook callback URL. |
| `GEMINI_API_KEY` | Yes | `AIzaSy...` | Google AI Studio API Key for Gemini 3.x models. |
| `GEMINI_MODEL` | No | `gemini-flash-latest` | Primary baseline model (cascades automatically). |
| `SUPABASE_URL` | Yes | `https://xyzproject.supabase.co` | Supabase project URL. |
| `SUPABASE_PUBLISHABLE_KEY`| Yes | `eyJ...` (Anon/Public key) | Client-side PostgREST key. |
| `SUPABASE_SECRET_KEY` | Yes | `eyJ...` (Service Role key) | Backend admin key bypassing RLS for server operations. |
| `UPSTASH_REDIS_REST_URL` | Yes | `https://apn1-xyz-12345.upstash.io` | Upstash serverless Redis REST URL. |
| `UPSTASH_REDIS_REST_TOKEN`| Yes | `AXr...` | Upstash Redis authentication token. |
| `SENTRY_DSN` | No | `https://...` | Sentry exception logging DSN. |
| `SOCIETY_PAYMENT_ACCOUNT_DETAILS` | No | `Meezan Bank - Title: Gulshan Heights - Acc: 0101...` | Society maintenance account default. |

---

## 3. Architecture & Engine Pipelines

### A. Atomic Webhook Deduplication (`backend/app/api/v1/endpoints/whatsapp.py`)
To prevent duplicate processing caused by Meta Cloud API retries or rapid retransmissions:
1. Meta webhook delivers inbound message with a unique `wamid` (`message.id`).
2. An atomic Upstash Redis `SETNX` (`processed_wamid:{msg_id}`) with 24-hour TTL (86,400s) checks if the message was already received.
3. If the key already exists, the duplicate is dropped immediately at the gateway before hitting any LLM or database logic.

### B. LLM-First Messaging Architecture (`backend/app/services/gemini.py`)
Every inbound resident WhatsApp text message follows a **Pure LLM-First pipeline**:
1. **Context Hydration:** Inbound message triggers `process_resident_message()`. The engine fetches:
   - Upstash Redis conversation history (last 6 turns).
   - Resident profile metadata (name, unit number, building).
   - Active complaint tickets from Supabase DB.
   - Live invoice / dues breakdown.
   - Active polls & society amenities directory.
2. **Primary Flow (Gemini Structured Action Dispatch):**
   - The compiled context is passed to Gemini with `HAMSAYAA_SYSTEM_PROMPT` and structured JSON action schema.
   - Gemini autonomously determines the intent and returns a structured action:
     - `reply`: For inquiries, dues, amenities, status checks, off-topic boundaries, general questions.
     - `create_complaint`: Only when an explicit new maintenance issue is reported.
     - `close_complaints`: Resolves specific tickets or sets `close_all=true` to resolve all active tickets.
     - `issue_visitor_pass`: Logs visitor details and generates gate pass.
     - `cast_poll_vote`: Records community poll vote.
3. **Multi-Model Cascade & Outage Handling:**
   - Active cascade: `gemini-3.5-flash-lite` -> `gemini-3.7-flash` -> `gemini-3.6-flash` -> `gemini-flash-latest` -> `gemini-3-flash-preview`.
   - ZERO hardcoded keyword or regex fallback arrays.
   - If all candidate models fail due to API limits or outages, the system sends a transparent service-busy notice with society helpline details.
4. **Memory Persistence:** Both resident input and generated AI replies are saved back to Upstash Redis with a 24-hour TTL via `_save_chat_history()`.

### C. Multimodal Image & Payment Slip Pipeline
1. Resident sends an image via WhatsApp (bank transfer screenshot, ATM receipt, or photo of maintenance damage).
2. `whatsapp.py` webhook extracts `media_id`, `caption`, and `mime_type`.
3. `whatsapp_service.download_media(media_id)` downloads the binary image from Meta Graph API.
4. `gemini_engine.process_image_message()` processes the image through a **4-Stage Security & Reconciliation Pipeline**:
   - **Stage 0: Image Binary Hash Deduplication (`receipt_hash:{sha256}`):**
     - Computes SHA-256 hash of the image bytes before calling Gemini.
     - If the exact screenshot was previously received, rejects instantly with duplicate warning (saving API tokens).
   - **Stage 1: Multimodal Vision & Fraud Detection:**
     - Gemini classifies `payment_slip` vs `maintenance_issue` vs `irrelevant`.
     - Inspects visual authenticity (`is_fraudulent_or_tampered`). Flagged altered screenshots trigger a red **`⚠️ Flagged Slip`** badge on dashboard and immediate WhatsApp notice.
   - **Stage 2: Transaction Reference (TxID) Deduplication (`receipt_txid:{society_id}:{txid}`):**
     - Extracts alphanumeric reference / TxID. If already logged in Redis, rejects duplicate submission.
   - **Stage 3: Destination Beneficiary Account Validation:**
     - Compares detected recipient title / account against the official society maintenance account configured in the invoice (`account_shown`).
     - If transferred to an unrelated third party (`is_account_match: false`), alerts resident that dues were not credited to the society account.
   - **Stage 4: Amount Validation & Partial Payment Lifecycle:**
     - **Partial Payments:** If paid amount is less than total due (e.g. Rs. 3,500 of Rs. 6,500 due):
       - Appends payment details to Redis `partial_payments:{inv_id}` and updates `payment_audit:{inv_id}` with `is_partial: true` and `remaining_balance`.
       - WhatsApp informs resident of partial credit and remaining due, advising they can share the remaining slip whenever they complete payment.
     - **Final Clearance:** When the remaining receipt is shared (e.g. Rs. 3,000), total payments are aggregated, remaining balance clears to Rs. 0, and resident receives full clearance notice.
     - **Single Full Payment:** Immediately attached to invoice and submitted for admin verification.
   - **Admin Reconciliation Experience (`Invoices.jsx`):**
     - Receipt modal displays a dedicated **Society Bank Statement Cross-Check Card** with TxID, Amount, Date, Bank / Channel, Matched Beneficiary, and linked partial slips.
     - Clicking **"Approve & Mark Verified"** marks dues verified in Supabase and automatically dispatches a WhatsApp approval receipt to the resident.
   - **`maintenance_issue`:**
     - Binary uploaded to Supabase Storage (`society-voice-notes/`).
     - A complaint ticket is created with category, description, and permanent `photo_url`.
   - **`irrelevant` (Wrong Image Sent):**
     - Sends an **Unrecognized Image** notice explicitly informing the resident that the image does not match a payment slip or maintenance issue, and prompts them with clear instructions on what to upload.

### D. Voice Note Processing Pipeline
1. Resident sends a WhatsApp voice note (`audio` or `voice` payload type).
2. `whatsapp.py` extracts `media_id` and downloads the `.ogg` audio binary.
3. `gemini_engine.transcribe_and_process_audio()`:
   - Passes raw audio to Gemini multimodal endpoint for instant English / Urdu / Roman Urdu transcription.
   - Uploads `.ogg` to Supabase Storage (`society-voice-notes/`).
   - Routes transcribed text through `process_resident_message()`.
   - Resulting complaint ticket stores clean transcribed text in `description` (displaying as normal plain text on the dashboard) and stores the audio link in `photo_url`.

### E. Complaint Resolution & Notification Pipeline
1. Society admin views active complaints in React Dashboard (`Complaints.jsx`).
2. Admin clicks **"Mark Resolved"**.
3. Frontend triggers `PATCH /api/v1/complaints/{id}` with `{"status": "resolved"}`.
4. Backend updates ticket status in Supabase and automatically calls `whatsapp_service.send_text_message()`.
5. Resident receives an immediate WhatsApp confirmation with Ticket ID, Category, and Description.
6. Alternatively, if a resident texts saying their issue is fixed, Gemini's `close_complaints` action resolves the ticket directly and confirms via WhatsApp.

### F. Finance & Maintenance Vouchers Lifecycle (`backend/app/api/v1/endpoints/invoices.py` & `frontend/src/pages/Invoices.jsx`)
1. **Itemized Services Breakdown:** Single standard voucher template configured per society (Guard, Sweeper, Water, Generator, Misc).
2. **Separated Workflows:**
   - **"Edit Voucher"**: Opens settings modal to configure fees, due date, and society bank account. Clicking "Save Voucher Settings" persists settings locally without dispatching messages.
   - **"Send Vouchers"**: Dedicated broadcast action. Displays preview modal (total payable, target units, WhatsApp toggle). Updates database records and dispatches WhatsApp messages with itemized line items.
3. **Idempotency & Delivery Tracking:**
   - Each invoice delivery is tracked in Upstash Redis (`whatsapp_delivery:{invoice_id}`).
   - Existing delivered vouchers are skipped to prevent duplicate blasts.
   - Failed deliveries trigger a dedicated amber bar with **"Retry Failed (X)"** and per-row **"Resend"** buttons.
4. **Payment Accountability & Audit Trail:**
   - Clicking **"Mark Paid"** opens a modal recording **Collector Name** (e.g. `Tariq (Treasurer)`), **Payment Method** (`Cash`, `Bank / Raast`, `Cheque`), and timestamp.
   - Audit trail stored in Redis (`payment_audit:{invoice_id}`) with 365-day TTL and displayed in the portal.
5. **Dashboard-Matching Shimmer Skeleton:**
   - During loading, renders `animate-pulse bg-slate-200 rounded` skeleton components (sync badge, metric cards, filter tabs, table rows) matching `Dashboard.jsx`.
   - Top toolbar includes a manual **Refresh** button (`<RefreshCw />`).

### G. Resident WhatsApp Announcements & Broadcast Pipeline (`backend/app/api/v1/endpoints/residents.py` & `frontend/src/pages/Residents.jsx`)
1. **Official WhatsApp Broadcast Dispatch (`POST /api/v1/residents/broadcast-notification`):**
   - Dispatches official society announcements directly to verified residents' WhatsApp accounts.
   - Automatically prefixes announcements with category-specific emojis (`🚰` Water, `⚡` Power/Generator, `🛡️` Security, `🧹` Sanitation/Fumigation, `🛠️` Repairs, `📢` General Notices).
   - Strictly enforces WhatsApp single asterisk `*bold*` and single underscore `_italic_` markdown styling.
2. **Granular 3-Way Recipient Scope & Dropdown Filtering:**
   - **Whole Society:** Dispatches to all unique apartments across the entire society.
   - **Single Building:** Dispatches to all unique apartments within a chosen block (e.g. `Block A`, `Block B`, `Block C`).
   - **Single Apartment:** Dispatches to one specific apartment selected via a 2-tier Building & Unit dropdown (`Unit 101 — Name (Phone)`).
3. **Strict 1-Message-per-Apartment Deduplication Policy:**
   - Where multiple contacts are registered for a single unit (e.g. owner and tenant, or family members), the system sorts by `(not is_owner, not is_tenant)`.
   - Prioritizes the registered property owner or active tenant as the primary contact.
   - Deduplicates strictly by `(building, unit_number)` to guarantee zero duplicate alerts per household.
4. **Resilient Modal UX Architecture:**
   - Uses `max-h-[90vh] flex flex-col overflow-hidden my-auto` with pinned header and pinned footer (`shrink-0`).
   - Inner form body scrolls independently (`flex-1 overflow-y-auto`) to guarantee zero top/bottom viewport cut-off on laptop or small screens.
   - Features quick preset pills, live recipient count badges, and an interactive **`[Hide Preview / Show Preview]`** collapsible WhatsApp mobile chat bubble.
5. **Redis Broadcast Audit Trail (`GET /api/v1/residents/broadcast-history`):**
   - Each broadcast is logged to Redis key `broadcast_history:{society_id}` (capped at last 50 entries) recording timestamp, scope, target count, sent count, and failure details.

---

## 4. Supabase Database Schema & Storage

The database is hosted on **Supabase Managed PostgreSQL**. The default development/testing society UUID is `d3b07384-d113-4c4e-9c8e-aa98350d1234`. Foreign key relationships cascade or restrict as detailed below.

### 4.1 Relational Database Schemas (12 Tables)

#### 1. `societies`
Stores metadata and global settings for each residential community or housing development.
- `id` (`UUID`, Primary Key, default: `gen_random_uuid()`)
- `name` (`TEXT`, Not Null) — e.g. "Gulshan Heights Executive Residences"
- `address` (`TEXT`, Nullable) — Full physical street address
- `bank_name` (`TEXT`, Nullable) — Default collection bank (e.g. "Meezan Bank Limited")
- `bank_account_title` (`TEXT`, Nullable) — Title of official account (e.g. "Gulshan Heights Society Maintenance")
- `bank_account_number` (`TEXT`, Nullable) — Account number (e.g. "01020304050607")
- `bank_iban` (`TEXT`, Nullable) — IBAN (e.g. "PK42MEZN0001020304050607")
- `emergency_contact` (`TEXT`, Nullable) — Society security gate intercom or emergency mobile
- `default_maintenance_fee` (`NUMERIC`, Default: `6500.00`) — Standard monthly maintenance due
- `default_saas_fee` (`NUMERIC`, Default: `500.00`) — Platform software charge (B2B only, hidden from residents)
- `default_utility_fee` (`NUMERIC`, Default: `0.00`) — Standard utility surcharge (water/generator/etc.)
- `created_at` (`TIMESTAMPTZ`, Default: `now()`)

#### 2. `residents`
Roster of verified residents living in society apartments or villas.
- `id` (`UUID`, Primary Key, default: `gen_random_uuid()`)
- `society_id` (`UUID`, Foreign Key -> `societies.id`, Not Null)
- `building` (`TEXT`, Not Null) — Building or block name (e.g. "Block A", "Block B", "Tower 1")
- `unit_number` (`TEXT`, Not Null) — Apartment or house number (e.g. "101", "204", "Penthouse-3")
- `name` (`TEXT`, Not Null) — Full resident name
- `phone_number` (`TEXT`, Not Null) — Standardized international E.164 phone (e.g. `+923316556622`)
- `cnic` (`TEXT`, Nullable) — Resident National Identity Card number (e.g. `42101-1234567-1`)
- `is_owner` (`BOOLEAN`, Default: `true`) — Resident owns the property
- `is_tenant` (`BOOLEAN`, Default: `false`) — Resident is renting
- `is_blocked` (`BOOLEAN`, Default: `false`) — When true, WhatsApp bot refuses to process requests
- `created_at` (`TIMESTAMPTZ`, Default: `now()`)
*Unique Conflict Constraint:* `(society_id, building, unit_number, phone_number)` for idempotent upserts.

#### 3. `complaints`
Maintenance fault tickets logged autonomously by Gemini AI or created manually by staff.
- `id` (`UUID`, Primary Key, default: `gen_random_uuid()`)
- `society_id` (`UUID`, Foreign Key -> `societies.id`, Not Null)
- `resident_id` (`UUID`, Foreign Key -> `residents.id`, Not Null)
- `ticket_number` (`TEXT`, Unique, Not Null) — Sequential or random string (e.g. `TCK-1042`)
- `category` (`TEXT`, Not Null) — One of: `Water & Plumbing`, `Electrical & Power`, `Elevators & Lifts`, `Sanitation & Waste`, `Security & Parking`, `Emergency & Life Safety`, `General Maintenance & Repair`
- `description` (`TEXT`, Not Null) — Issue summary extracted from resident text or voice transcription
- `status` (`TEXT`, Not Null, Default: `open`) — Enum: `open`, `in_progress`, `needs_human_review`, `resolved`, `flagged_irrelevant`
- `photo_url` (`TEXT`, Nullable) — Permanent Supabase Storage URL for damage photo or voice `.ogg` audio
- `created_at` (`TIMESTAMPTZ`, Default: `now()`)

#### 4. `invoices`
Monthly maintenance billing records per resident unit.
- `id` (`UUID`, Primary Key, default: `gen_random_uuid()`)
- `society_id` (`UUID`, Foreign Key -> `societies.id`, Not Null)
- `resident_id` (`UUID`, Foreign Key -> `residents.id`, Not Null)
- `society_maintenance_fee` (`NUMERIC`, Not Null) — Direct society maintenance portion (Guard, Sweeper, etc.)
- `hamsayaa_saas_fee` (`NUMERIC`, Default: `0.00`) — B2B software platform fee (internal only)
- `utility_charges` (`NUMERIC`, Default: `0.00`) — Variable utility charges (generator diesel, water tanker)
- `total_amount` (`NUMERIC`, Generated / Not Null) — Sum of maintenance + utility charges
- `status` (`TEXT`, Not Null, Default: `unpaid`) — Enum: `unpaid`, `paid`, `verified`, `overdue`
- `due_date` (`DATE`, Not Null) — Payment deadline (e.g. `2026-09-15`)
- `receipt_image_url` (`TEXT`, Nullable) — Supabase Storage URL of uploaded bank slip / Raast screenshot
- `account_shown` (`TEXT`, Nullable) — Bank account details communicated to resident on voucher
- `verified_by` (`TEXT`, Nullable) — Name of committee member who confirmed bank statement credit
- `verified_at` (`TIMESTAMPTZ`, Nullable) — Timestamp when verification was finalized
- `created_at` (`TIMESTAMPTZ`, Default: `now()`)

#### 5. `visitor_passes`
Digital gate security passes for guest vehicular or pedestrian entry.
- `id` (`UUID`, Primary Key, default: `gen_random_uuid()`)
- `society_id` (`UUID`, Foreign Key -> `societies.id`, Not Null)
- `resident_id` (`UUID`, Foreign Key -> `residents.id`, Not Null)
- `visitor_name` (`TEXT`, Not Null) — Full name of arriving guest
- `visitor_cnic` (`TEXT`, Nullable) — CNIC number of visitor
- `vehicle_plate` (`TEXT`, Nullable) — Vehicle registration number (e.g. `ABC-123`)
- `pass_code` (`TEXT`, Unique, Not Null) — 6-character access voucher code (e.g. `LV-4821`)
- `valid_from` (`TIMESTAMPTZ`, Not Null) — Start of authorization window
- `valid_until` (`TIMESTAMPTZ`, Not Null) — Expiration timestamp
- `created_at` (`TIMESTAMPTZ`, Default: `now()`)

#### 6. `registered_vehicles`
Authorized resident vehicles permitted barrier-free entry.
- `id` (`UUID`, Primary Key, default: `gen_random_uuid()`)
- `society_id` (`UUID`, Foreign Key -> `societies.id`, Not Null)
- `resident_id` (`UUID`, Foreign Key -> `residents.id`, Not Null)
- `vehicle_plate` (`TEXT`, Not Null) — Standardized uppercase plate string (e.g. `LEE-1234`)
- `make_model` (`TEXT`, Nullable) — e.g. "Toyota Corolla White"
- `color` (`TEXT`, Nullable)
- `created_at` (`TIMESTAMPTZ`, Default: `now()`)

#### 7. `vehicle_logs`
Access barrier entry and exit records tracked at society gates.
- `id` (`UUID`, Primary Key, default: `gen_random_uuid()`)
- `society_id` (`UUID`, Foreign Key -> `societies.id`, Not Null)
- `vehicle_plate` (`TEXT`, Not Null) — Normalized vehicle license plate
- `entry_time` (`TIMESTAMPTZ`, Default: `now()`)
- `exit_time` (`TIMESTAMPTZ`, Nullable) — Recorded when vehicle departs
- `is_registered` (`BOOLEAN`, Default: `false`) — Whether plate matched `registered_vehicles`
- `is_flagged_overstay` (`BOOLEAN`, Default: `false`) — Flagged when visitor exceeds permitted stay
- `source` (`TEXT`, Default: `manual`) — `manual` (guard entry) or `anpr_camera` (automated license plate reader)

#### 8. `polls`
Community survey questions posted by society management.
- `id` (`UUID`, Primary Key, default: `gen_random_uuid()`)
- `society_id` (`UUID`, Foreign Key -> `societies.id`, Not Null)
- `question` / `title` (`TEXT`, Not Null) — Survey question
- `options` (`JSONB` / `TEXT[]`, Not Null) — List of choices (e.g. `["Option A", "Option B"]`)
- `is_closed` (`BOOLEAN`, Default: `false`) — Whether voting has ended
- `expires_at` (`TIMESTAMPTZ`, Nullable) — Scheduled cutoff time
- `created_at` (`TIMESTAMPTZ`, Default: `now()`)

#### 9. `poll_votes`
Individual resident votes submitted via WhatsApp or dashboard.
- `id` (`UUID`, Primary Key, default: `gen_random_uuid()`)
- `poll_id` (`UUID`, Foreign Key -> `polls.id`, Not Null)
- `resident_id` (`UUID`, Foreign Key -> `residents.id`, Not Null)
- `selected_option` (`TEXT`, Not Null) — Exact matching string from poll options
- `created_at` (`TIMESTAMPTZ`, Default: `now()`)
*Unique Constraint:* `(poll_id, resident_id)` enforces strict 1-vote-per-unit policy.

#### 10. `employees`
Society staff roster (guards, janitors, gardeners, electricians, facility managers).
- `id` (`UUID`, Primary Key, default: `gen_random_uuid()`)
- `society_id` (`UUID`, Foreign Key -> `societies.id`, Not Null)
- `name` (`TEXT`, Not Null) — Staff member name
- `role` (`TEXT`, Not Null) — Designation (e.g. "Head Security Guard", "Sweeper Supervisor")
- `phone` (`TEXT`, Nullable) — Contact phone
- `cnic` (`TEXT`, Nullable) — CNIC verification number
- `shift` (`TEXT`, Default: `Day (8 AM - 4 PM)`) — Shift timing
- `salary` (`NUMERIC`, Default: `0.00`) — Monthly salary figure
- `status` (`TEXT`, Default: `active`) — Enum: `active`, `on_leave`, `terminated`
- `created_at` (`TIMESTAMPTZ`, Default: `now()`)

#### 11. `assets`
Society physical infrastructure and machinery requiring scheduled preventive maintenance.
- `id` (`UUID`, Primary Key, default: `gen_random_uuid()`)
- `society_id` (`UUID`, Foreign Key -> `societies.id`, Not Null)
- `name` (`TEXT`, Not Null) — e.g. "Main Generator 250kVA Perkins", "Passenger Lift Tower A"
- `category` (`TEXT`, Not Null) — e.g. "Power & Electrical", "Elevators", "Water Pumps"
- `location` (`TEXT`, Nullable) — e.g. "Basement Plant Room"
- `status` (`TEXT`, Default: `operational`) — Enum: `operational`, `under_maintenance`, `offline`
- `last_serviced_at` (`DATE` / `TIMESTAMPTZ`, Nullable)
- `next_service_due` (`DATE` / `TIMESTAMPTZ`, Nullable)
- `created_at` (`TIMESTAMPTZ`, Default: `now()`)

#### 12. `maintenance_logs`
Service, repair, and expenditure logs tied to society assets.
- `id` (`UUID`, Primary Key, default: `gen_random_uuid()`)
- `asset_id` (`UUID`, Foreign Key -> `assets.id`, Not Null)
- `service_type` (`TEXT`, Not Null) — e.g. "Engine Oil & Filter Replacement", "Rope Inspection"
- `technician_vendor` (`TEXT`, Nullable) — Vendor or technician company name
- `cost` (`NUMERIC`, Default: `0.00`) — Service expenditure in PKR
- `serviced_at` (`TIMESTAMPTZ`, Default: `now()`)
- `notes` (`TEXT`, Nullable) — Technical observations
- `next_due_override` (`DATE` / `TIMESTAMPTZ`, Nullable) — Automatically updates asset `next_service_due`

#### 13. `amenities`
Shared society facilities and recreational areas.
- `id` (`UUID`, Primary Key, default: `gen_random_uuid()`)
- `society_id` (`UUID`, Foreign Key -> `societies.id`, Not Null)
- `name` (`TEXT`, Not Null) — e.g. "Community Hall", "Swimming Pool", "Gymnasium", "Tennis Court"
- `description` (`TEXT`, Nullable) — Facility rules and features
- `capacity` (`INTEGER`, Default: `50`) — Maximum person capacity
- `timings` (`TEXT`, Default: `6:00 AM - 10:00 PM`) — Standard operating hours
- `status` (`TEXT`, Default: `open`) — Enum: `open`, `closed`, `maintenance`
- `booking_required` (`BOOLEAN`, Default: `false`) — Whether advance reservation is mandatory

---

### 4.2 Supabase Storage Buckets & Policies

| Bucket Name | Access | Allowed Mime Types | Purpose |
|---|---|---|---|
| `society-voice-notes` | Public Read | `audio/ogg`, `audio/opus`, `audio/mpeg`, `image/jpeg`, `image/png` | Stores voice recordings sent by residents (`.ogg`) and maintenance defect photos. |
| `society-receipts` | Public Read | `image/jpeg`, `image/png`, `application/pdf` | Stores payment bank slips, Raast transfer screenshots, and ATM receipts. |

*Storage Policy:* All objects are assigned public read access so that dashboard web users and administrative reviewers can stream voice notes and inspect high-resolution receipts without pre-signed URL expiration issues.

---

### 4.3 Upstash Redis Comprehensive Key Registry

Upstash Serverless Redis is used for high-throughput state memory, rate deduplication, and ephemeral audit tracking.

| Key Pattern | Data Type | TTL (Seconds) | Purpose & Lifecycle |
|---|---|---|---|
| `chat_history:{clean_phone}` | `List` (JSON strings) | 86,400s (24h) | Sliding window of the last 6 conversation turns (`{"role": "user"|"assistant", "text": "..."}`). Expires after 24h of inactivity. |
| `processed_wamid:{msg_id}` | `String` (`"1"`) | 86,400s (24h) | Atomic `SETNX` gate for inbound WhatsApp message IDs (`wamid`). Prevents duplicate execution from Meta Cloud API retries. |
| `whatsapp_delivery:{invoice_id}` | `String` (JSON) | 2,592,000s (30d) | Delivery tracking record (`{"status": "delivered"|"failed", "timestamp": "...", "error": "..."}`). Enforces idempotent voucher broadcasting. |
| `payment_audit:{invoice_id}` | `String` (JSON) | 31,536,000s (365d) | Official payment audit record (`{"collector": "...", "method": "...", "amount_paid": ..., "reference_number": "...", "is_partial": bool, "partial_payments": [...]}`). |
| `receipt_hash:{sha256}` | `String` (JSON) | 15,552,000s (180d) | SHA-256 hash of image binary bytes. Rejects identical screenshots before calling Gemini API (token saver & fraud defense). |
| `receipt_txid:{society_id}:{clean_ref}` | `String` (JSON) | 15,552,000s (180d) | Alphanumeric transaction reference deduplication. Rejects reuse of identical bank transfer reference numbers across units. |
| `partial_payments:{invoice_id}` | `String` (JSON) | 31,536,000s (365d) | Cumulative list of partial payment transactions (`[{"amount": 3500, "ref": "...", "receipt_url": "...", "date": "..."}]`). |
| `broadcast_history:{society_id}` | `List` (JSON strings) | None (Capped 50) | Rolling audit log of the last 50 resident WhatsApp announcement broadcasts (`timestamp`, `title`, `scope`, `targets_count`, `sent_count`, `failed_count`). |

---

## 5. AI Concierge & Multimodal Reasoning Engine (`backend/app/services/gemini.py`)

### 5.1 Multi-Model Cascade Strategy
To eliminate downtime caused by Google AI Studio rate limits (`429 Too Many Requests`) or high-demand surges (`503 Service Unavailable`), the backend implements an autonomous multi-model fallback cascade:
1. `gemini-3.5-flash-lite` (Fastest, lowest latency baseline)
2. `gemini-3.7-flash` (Advanced reasoning fallback)
3. `gemini-3.6-flash` (High-availability intermediate fallback)
4. `gemini-flash-latest` (General release stable fallback)
5. `gemini-3-flash-preview` (Last resort candidate)

*Note:* Gemini `2.0` and `2.5` versions are retired and must never be referenced. If all candidate models fail during an outage, the engine gracefully catches the exception and returns a courteous service-busy notice with society office intercom details.

### 5.2 Structured Action Output Schema
For every text message, Gemini evaluates hydrated context (resident identity, live unpaid dues, active tickets, amenities, polls, and Upstash Redis chat turns) and outputs a strictly validated JSON payload:
```json
{
  "action": "reply | create_complaint | close_complaints | issue_visitor_pass | cast_poll_vote",
  "complaint_category": "Water & Plumbing | Electrical & Power | Elevators & Lifts | Sanitation & Waste | Security & Parking | Emergency & Life Safety | General Maintenance & Repair | null",
  "complaint_description": "Clear plain text summary of the issue or null",
  "close_all": false,
  "ticket_numbers": ["TCK-1042"],
  "visitor_name": "Hamza Ali",
  "visitor_cnic": "42101-9876543-1",
  "vehicle_plate": "ABC-123",
  "poll_id": "c3d4e5f6-1111-2222-3333-444455556666",
  "poll_option": "Option A",
  "reply_text": "Formatted WhatsApp text response"
}
```

### 5.3 4-Stage Multimodal Vision & Payment Security Pipeline
When an image is received via WhatsApp, it passes through four security layers:
- **Stage 0 (Binary Deduplication):** Computes SHA-256 hash of incoming image bytes. If found in `receipt_hash:{sha256}`, immediately rejects with a friendly duplicate notice.
- **Stage 1 (Vision Analysis & Fraud Inspection):** Gemini Multimodal inspects typography, alignment, and pixel artifacts. Sets `is_fraudulent_or_tampered: true` if an altered slip is detected, flagging the invoice on the dashboard.
- **Stage 2 (TxID Reference Deduplication):** Extracts the bank reference / Raast transaction ID. If found in `receipt_txid:{society_id}:{clean_ref}`, flags that the transaction ID was already credited elsewhere.
- **Stage 3 (Beneficiary Verification):** Compares recipient title / account against official society account (`account_shown`). If mismatched, alerts the resident that payment went to an unrelated account.
- **Stage 4 (Partial Payment & Final Clearance Lifecycle):**
  - If paid amount < balance due: Stores transaction in Redis `partial_payments:{inv_id}`, computes remaining balance, and informs resident of partial credit.
  - If remaining balance is cleared: Aggregates total payments, resets remaining balance to PKR 0, updates invoice to `paid`, and submits for committee verification.

### 5.4 Multimodal Audio Transcription
- Voice notes received in `.ogg` or `.opus` format are passed as raw binary bytes to Gemini Audio.
- The transcription prompt supports English, Urdu, and Roman Urdu.
- Audio binaries are uploaded to Supabase Storage (`society-voice-notes/`) and the public URL is saved in `complaints.photo_url`.
- Transcribed text is processed as a standard resident message, creating a clean complaint ticket with readable description on the dashboard.

---

## 6. Complete API Endpoints Directory

All backend routes are prefixed with `/api/v1`.

### 6.1 WhatsApp Webhooks & Testing (`/api/v1/whatsapp`)
- `GET /webhook`: Meta Graph API webhook handshake challenge. Validates `hub.verify_token` against `WHATSAPP_VERIFY_TOKEN` and echoes `hub.challenge`.
- `POST /webhook`: Inbound webhook receiver for all Meta WhatsApp events. Handles text, audio voice notes, and image receipts with atomic `SETNX` deduplication.
- `POST /simulate-message`: Testing sandbox endpoint. Simulates resident WhatsApp interaction with parameters `{"from_phone": "+923316556622", "message_body": "my kitchen tap is leaking", "media_url": null, "media_type": null}`.

### 6.2 Residents Management (`/api/v1/residents`)
- `GET /`: Lists all residents for a society (accepts optional `?building=Block+A` query param).
- `POST /`: Creates a new resident record.
- `POST /import-excel`: Multipart upload of `.xlsx` or `.csv` files for bulk resident importing.
- `POST /toggle-block/{resident_id}`: Toggles `is_blocked` flag to suspend WhatsApp bot access for non-compliant users.
- `POST /broadcast-notification`: Dispatches official WhatsApp announcements.
  - Body: `{"society_id": "...", "title": "Water Tank Cleaning", "message": "Water will be shut off...", "scope": "all" | "building" | "single_unit", "building": "Block A", "resident_id": "..."}`
  - Applies 1-message-per-apartment deduplication, prefixes category emojis, and logs to Redis `broadcast_history`.
- `GET /broadcast-history`: Returns the last 50 announcement records from Upstash Redis `broadcast_history:{society_id}`.

### 6.3 Finance & Invoices (`/api/v1/invoices`)
- `GET /`: Lists invoices with resident details (accepts optional `?status=unpaid` filter).
- `POST /settings`: Updates default monthly voucher settings (fees, due date, bank account title/number).
- `POST /send-vouchers`: Generates cycle invoices in Supabase and broadcasts WhatsApp voucher breakdowns with delivery tracking in Redis.
- `POST /mark-paid`: Records offline cash or bank transfer payment.
  - Body: `{"invoice_id": "...", "collector_name": "Tariq (Treasurer)", "payment_method": "Cash" | "Bank / Raast" | "Cheque"}`
  - Saves to Redis `payment_audit:{invoice_id}` and marks status `paid`.
- `POST /verify-receipt`: Marks invoice `verified` and dispatches official WhatsApp clearance receipt to resident.
- `POST /resend/{invoice_id}`: Resends voucher to an individual resident.
- `POST /retry-failed`: Retries dispatching all failed vouchers tracked in `whatsapp_delivery`.

### 6.4 Complaints & Tickets (`/api/v1/complaints`)
- `GET /`: Lists tickets with resident unit details (accepts optional `?status=open` filter).
- `PATCH /{complaint_id}`: Updates ticket status (`open`, `in_progress`, `needs_human_review`, `resolved`).
  - When status is updated to `resolved`, automatically sends a WhatsApp resolution notice to the resident.
- `POST /`: Creates a manual complaint ticket.

### 6.5 Vehicles & Access Control (`/api/v1/vehicles`)
- `GET /registered`: Lists registered resident vehicles with unit numbers.
- `GET /logs`: Returns barrier entry and exit history.
- `POST /logs`: Logs vehicle arrival. Auto-checks against `registered_vehicles` and flags unauthorized overstays.
- `PATCH /logs/{log_id}/exit`: Marks departure timestamp and clears overstay flag.

### 6.6 Polls & Voting (`/api/v1/polls`)
- `GET /`: Lists active and past community polls with aggregate vote counts and percentages.
- `POST /`: Creates a new community survey with multiple options.
- `POST /vote`: Submits a resident vote. Enforces 1-vote-per-unit policy via Supabase `poll_votes` unique constraint.
- `PATCH /{poll_id}/close`: Closes voting and locks poll results.

### 6.7 Employees, Assets, Amenities & Settings
- `/api/v1/employees`: Full CRUD (`GET`, `POST`, `PUT /{id}`, `DELETE /{id}`) for society staff roster.
- `/api/v1/assets`: Infrastructure CRUD plus `/api/v1/assets/{id}/logs` for service history and automatic `next_service_due` synchronization.
- `/api/v1/amenities`: Facility directory CRUD with booking availability tracking.
- `/api/v1/settings`: Society profile management and `GET /settings/dashboard-summary` for aggregated executive metrics.
- `GET /api/v1/health`: System health check endpoint.

---

## 7. Frontend UI Architecture & Design System

### 7.1 Tech Stack & Bundler
- **Framework:** React 18 SPA built with Vite 5.
- **Styling:** Tailwind CSS with custom plugins and brand color tokens (`indigo-600` primary, `slate-900` dark neutral).
- **Icons:** `lucide-react` modern feather icon set.

### 7.2 Custom Animations & Keyframes (`frontend/src/index.css`)
- **Circular Marquee Loop (`animate-circular-loop`):** Continuous smooth horizontal loop applied to metric card subtexts on Dashboard and Invoices tabs, allowing long descriptions to cycle seamlessly without clipping.
- **Shimmer Skeleton (`animate-pulse bg-slate-200 rounded`):** Rendered during initial data fetching across metric cards, filter pills, and table rows to eliminate jarring layout shifts.
- **Count-Up Number Animations:** Smooth eased numeric transitions for dashboard statistics.

### 7.3 Resilient Modal UX Architecture (Zero Cut-Off Standard)
To ensure modals never clip on smaller laptop viewports (1366x768) or when browser zoom is increased:
- Container must use: `max-h-[90vh] flex flex-col overflow-hidden my-auto`
- Header: `shrink-0 p-6 border-b` (pinned to top)
- Body: `flex-1 overflow-y-auto p-6 space-y-4` (scrolls independently)
- Footer: `shrink-0 p-4 bg-slate-50 border-t flex justify-end gap-3` (pinned to bottom)
- Interactive Elements: Collapsible previews (e.g. `[Hide Preview / Show Preview]` WhatsApp mobile chat bubble) must collapse by default or toggle cleanly without expanding modal bounds beyond the screen.

### 7.4 Offline Fallback & Demo Resilience (`frontend/src/services/api.js`)
All API calls are wrapped with try/catch logic that falls back to `mockData.js` if the backend is offline or Supabase is paused. This ensures the frontend dashboard can be demonstrated or tested offline with zero 500 crashes.

---

## 8. Local Development & Operational Workflows

### 8.1 One-Click Windows Scripts
- **`start.bat`**: Launches three dedicated terminal windows:
  1. FastAPI backend on `http://127.0.0.1:8000` via Uvicorn.
  2. Vite frontend on `http://localhost:3000`.
  3. ngrok tunnel routing public traffic to port 8000.
- **`stop.bat`**: Cleanly kills all running `python.exe`, `node.exe`, and `ngrok.exe` processes to release locked ports.

### 8.2 Manual Local Run Commands
```powershell
# Backend (from repository root)
cd backend
python -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload

# Frontend (from repository root)
cd frontend
npm install
npm run dev
```

### 8.3 Testing WhatsApp Locally Without Real Meta Webhooks
Use the simulation endpoint:
```powershell
curl -X POST http://127.0.0.1:8000/api/v1/whatsapp/simulate-message `
  -H "Content-Type: application/json" `
  -d '{"from_phone": "+923316556622", "message_body": "water is leaking in my bathroom", "media_url": null, "media_type": null}'
```

---

## 9. Production Cloud Deployments & DevOps

### 9.1 Backend on Railway
- **Dockerfile:** Based on Debian slim with Python 3.12 (`backend/Dockerfile`).
- **Dual-Port Bridging Strategy:** Container startup script runs `socat TCP-LISTEN:8080,fork TCP:127.0.0.1:8000 &` alongside Uvicorn on port 8000. This ensures zero `502 Bad Gateway` errors whether Railway's internal proxy routes incoming requests to port 8000 or 8080.
- **Environment Variables:** Transferred from `backend/.env` to Railway's Variables tab.

### 9.2 Frontend on Vercel
- **SPA Rewrite & Reverse Proxy (`frontend/vercel.json`):**
  - All `/api/(.*)` requests are proxied directly to `https://hamsayaa-production.up.railway.app/api/$1` (zero CORS issues).
  - All page routes `/(.*)` rewrite to `/index.html` to support React client-side routing on page refresh.

### 9.3 Supabase Auto-Pause Awareness
Free-tier Supabase projects automatically pause after 7 consecutive days of inactivity. If API queries fail with `getaddrinfo failed` or connection timeouts, visit the Supabase dashboard and click **"Resume Project"**.

---

## 10. The 10 Critical Commandments for Agents & Developers

1. **WhatsApp Markdown Syntax:** WhatsApp does NOT render standard markdown headers (`#`) or double asterisks (`**`). Use `*bold*` (single asterisk) and `_italic_` (single underscore). Never output tables or blockquotes for WhatsApp responses.
2. **Never Fabricate Data:** AI must never invent a ticket ID, invoice amount, or bank account. If an action requires data, check Supabase first.
3. **Emergency Detection First:** Safety issues (fire, gas leaks, physical intruders) must immediately advise calling local emergency services (1122 / 16 / 15) before logging an emergency ticket.
4. **Phone Number Sanitization:** Always normalize phone numbers by stripping whitespace and dashes, formatting with leading `+` (e.g. `+923001234567`).
5. **Zero Resident Exposure of Platform Fees:** `hamsayaa_saas_fee` is strictly a B2B SaaS platform fee paid by the society management office. Never display SaaS platform fees to residents on WhatsApp or in their invoices view.
6. **Strict 1-Message-per-Apartment Policy for Broadcasts:** When sending WhatsApp announcements or alerts to residents, always deduplicate recipients by `(building, unit_number)` and prioritize registered owners or tenants so only one primary contact receives the message per household. Avoid spamming multiple family members for the same unit.
7. **Idempotent Broadcasts:** Never re-dispatch vouchers to residents whose delivery status is already marked `delivered` in Redis. Always provide isolated retry or resend options for failed units.
8. **Resilient Modal Architecture:** Every modal must include `max-h-[90vh] flex flex-col my-auto`, a pinned header `shrink-0`, a scrollable body `flex-1 overflow-y-auto`, and a pinned footer `shrink-0 bg-slate-50 border-t` to prevent viewport clipping on small laptop screens.
9. **Git & Secret Hygiene:** Never commit `.env` or API credentials to git. All secret scanning must pass clean before pushes to `main`.
10. **Single Source of Truth:** Keep `AGENTS.md` updated whenever backend routes, database columns, or deployment infrastructure change. Collaborators using Antigravity / Gemini rely on this file as the authoritative architecture specification.
