# Hamsayaa — Multi-Agent & Developer Workspace Context (AGENTS.md)

Welcome to **Hamsayaa (ہمسایہ)**. This document serves as the single source of truth for all AI assistants (Antigravity/Gemini) and developers collaborating on this codebase. It documents our system architecture, design decisions, database schemas, active conventions, and operational workflows.

---

## 1. Project Overview & Business Context

- **What is Hamsayaa?** An AI-first, zero-install Property Management SaaS designed for gated residential communities and apartment complexes in Pakistan and emerging markets.
- **Business Model:** B2B / B2B2C SaaS.
  - **Paying Customer:** Society Management Committees, Real Estate Developers, Building Admin Offices.
  - **End Users:** Verified residents/tenants living in the residential society.
- **The Core Innovation (Zero-Install UX):**
  - Residents interact exclusively through **WhatsApp** (text, voice notes, and images/receipts). No mobile app download required.
  - Society administrators manage operations, verify dues, track tickets, and dispatch vouchers through a modern **React Web Dashboard**.
  - Zero resident exposure of B2B SaaS platform fees (residents only see direct society maintenance line items).

---

## 2. Technical Stack & Infrastructure

| Layer | Technology | Details |
|---|---|---|
| **Backend API** | **FastAPI** (Python 3.12 / Uvicorn) | Async REST API running on port `8000` (`app/main.py`). |
| **Frontend Dashboard** | **React 18 + Vite** | Single Page App running on port `3000` (`frontend/`). |
| **AI LLM Engine** | **Google Gemini 3.x** (`gemini-3.5-flash-lite`, `gemini-3.7-flash`, `gemini-3.6-flash`, `gemini-flash-latest`) | Multimodal intent reasoning, vision OCR, multilingual (English, Urdu, Roman Urdu). *Note: `gemini-2.0` and `2.5` are deprecated/retired.* |
| **Audio Processing** | **Gemini Multimodal Audio** | Native binary transcription of WhatsApp voice notes (`.ogg` / `.opus`). |
| **Vision & Image OCR** | **Gemini Multimodal Vision** | Native visual inspection of payment bank slips and maintenance damage photos. |
| **Database** | **Supabase** (Managed PostgreSQL) | Relational database with Row Level Security (RLS) and PostgREST. |
| **Session Memory & Cache** | **Upstash Redis** (Serverless REST) | 24-hr chat history, atomic webhook deduplication, delivery tracking, and payment audit trail. |
| **Object Storage** | **Supabase Storage** | Public buckets: `society-voice-notes` (audio recordings), `society-receipts` (payment slips & defect photos). |
| **Local Tunneling** | **ngrok** | Exposes local FastAPI port 8000 to Meta WhatsApp Cloud API webhooks. |
| **Error Monitoring** | **Sentry SDK** | Backend observability and exception tracking. |

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
4. `gemini_engine.process_image_message()` uses multimodal vision to classify and process:
   - **`payment_slip`:**
     - Gemini extracts transaction details (Amount, Transaction ID, Bank, Date).
     - Binary is uploaded to Supabase Storage (`society-receipts/`).
     - Image URL is linked to the resident's active invoice via `db_service.attach_invoice_receipt()`.
     - Advance payment handling: If sent before monthly vouchers are generated, creates an advance invoice (`get_or_create_advance_invoice()`) so the receipt is never lost.
     - Settled check: If resident is already marked paid/verified, clarifies balance is Rs. 0 without modifying records.
     - WhatsApp confirmation sent to resident stating receipt has been submitted for office verification.
   - **`maintenance_issue`:**
     - Binary is uploaded to Supabase Storage (`society-receipts/`).
     - A complaint ticket is created with category, description, and permanent `photo_url`.
   - **`irrelevant`:**
     - Politely guides resident back to society management topics.

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

---

## 4. Supabase Database Schema & Storage

### Core Tables:
1. **`residents`**:
   - `id` (UUID, PK), `society_id` (UUID), `building` (text), `unit_number` (text), `name` (text), `phone_number` (text, e.g. `+923316556622`), `cnic` (text), `is_owner` (bool), `is_tenant` (bool), `is_blocked` (bool).
2. **`complaints`**:
   - `id` (UUID, PK), `society_id` (UUID), `resident_id` (UUID, FK -> `residents.id`), `ticket_number` (text, e.g. `TCK-1042`), `category` (text), `description` (text), `status` (`open` | `in_progress` | `needs_human_review` | `resolved` | `flagged_irrelevant`), `audio_url` (text, nullable), `created_at` (timestamptz).
3. **`visitor_passes`**:
   - `id` (UUID, PK), `society_id` (UUID), `resident_id` (UUID, FK -> `residents.id`), `visitor_name` (text), `visitor_cnic` (text), `vehicle_plate` (text), `pass_code` (text, e.g. `LV-4821`), `valid_from` (timestamptz), `valid_until` (timestamptz).
4. **`invoices`**:
   - `id` (UUID, PK), `society_id` (UUID), `resident_id` (UUID, FK -> `residents.id`), `society_maintenance_fee` (numeric), `hamsayaa_saas_fee` (numeric), `utility_charges` (numeric), `total_amount` (numeric), `status` (`unpaid` | `paid` | `verified` | `overdue`), `due_date` (date), `receipt_image_url` (text, nullable), `account_shown` (text, nullable), `verified_by` (text, nullable), `verified_at` (timestamptz, nullable).
5. **`polls` & `poll_votes`**:
   - Community surveys, single-choice voting enforcement per unit.
6. **`employees`**, **`assets`**, **`maintenance_logs`**, **`amenities`**, **`vehicle_logs`**.

### Storage Buckets:
- `society-voice-notes`: Public bucket for resident voice recordings (`.ogg` / `.opus`).
- `society-receipts`: Public bucket for payment slip screenshots and maintenance defect photos.

### Redis Keys (Upstash):
- `chat_history:{phone}`: 24-hr sliding window chat turns per resident.
- `processed_wamid:{msg_id}`: 24-hr idempotency deduplication for inbound WhatsApp webhooks.
- `whatsapp_delivery:{invoice_id}`: 30-day delivery status (`delivered`, `failed`, `pending`) and error details.
- `payment_audit:{invoice_id}`: 365-day collector accountability record (`collector`, `method`, `collected_at`).

---

## 5. Development & Local Execution

### One-Click Scripts (Root Directory):
- **`start.bat`**: Automatically starts Backend (port 8000), Frontend (port 3000), and ngrok in separate windows using relative paths (`%~dp0`).
- **`stop.bat`**: Cleanly kills all running Python, Node, and ngrok processes.

### Local Environment Setup:
- Template: `.env.example` at root and `backend/.env.example`.
- Collaborators must copy `.env.example` to `backend/.env` and supply shared team credentials.
- `backend/.env` is strictly gitignored (0 secrets committed).

### Meta WhatsApp Webhook Setup (Local Dev):
- **Callback URL:** `https://<YOUR-NGROK-DOMAIN>/api/v1/whatsapp/webhook`
- **Verify Token:** `hamsayaa_webhook_verify_token_secure`
- **Subscription Fields:** `messages`

---

## 6. Production Cloud Deployments

### Backend Deployment (Railway):
- **Service Type:** Dockerfile container running on Debian slim with Python 3.12 (`backend/Dockerfile`).
- **Root Directory Setting:** `backend`
- **Port Strategy:** `socat` bridges container ports `8000` and `8080` simultaneously, ensuring zero 502 routing errors regardless of whether Railway proxy routes to 8000 or 8080.
- **Environment Variables:** Set in Railway service **Variables** tab (use **Raw Editor** to paste from `backend/.env`).
- **Public Domain:** `https://hamsayaa-production.up.railway.app`
  - Health endpoint: `/api/v1/health`
  - Swagger docs: `/docs`
  - WhatsApp webhook: `/api/v1/whatsapp/webhook`

### Frontend Deployment (Vercel):
- **Framework Preset:** Vite (React 18 SPA).
- **Root Directory Setting:** `frontend`
- **SPA Routing & API Proxy:** Configured via [`frontend/vercel.json`](frontend/vercel.json):
  - Rewrites all `/api/(.*)` requests to `https://hamsayaa-production.up.railway.app/api/$1` (zero CORS issues).
  - Rewrites all other routes `/(.*)` to `/index.html` (prevents 404s on browser reload).
- **Environment Variables:** None required on Vercel (optional `VITE_API_URL` supported via [`frontend/src/services/api.js`](frontend/src/services/api.js)).
- **Security Rule:** NEVER import `.env` into Vercel. Database and AI API keys are backend-only.

---

## 7. Critical Rules for Agents & Developers

1. **WhatsApp Markdown Syntax:** WhatsApp does NOT render standard markdown headers (`#`) or double asterisks (`**`).
   - Use `*bold*` (single asterisk) and `_italic_` (single underscore).
   - Do not output markdown tables or blockquotes for WhatsApp responses.
2. **Never Fabricate Data:** AI must never invent a ticket ID, invoice amount, or bank account. If an action requires data, check Supabase first.
3. **Emergency Detection First:** Safety issues (fire, gas leaks, physical intruders) must immediately advise calling local emergency services before logging an emergency ticket.
4. **Phone Number Sanitization:** Always normalize phone numbers by stripping whitespace and dashes, formatting with leading `+` (e.g. `+923001234567`).
5. **Supabase Auto-Pause Awareness:** Free-tier Supabase databases auto-pause after 7 days of inactivity. If queries fail with `ConnectError: getaddrinfo failed` or 401, check the Supabase Dashboard and click "Resume Project".
6. **Zero Resident Exposure of Platform Fees:** `hamsayaa_saas_fee` is strictly a B2B SaaS platform fee paid by the society management office. Never display SaaS platform fees to residents on WhatsApp or in their invoices view.
7. **Idempotent Broadcasts:** Never re-dispatch vouchers to residents whose delivery status is already marked `delivered` in Redis. Always provide isolated retry or resend options for failed units.
8. **Git & Secret Hygiene:** Never commit `.env` or API credentials to git. All secret scanning must pass clean before pushes to `main`.
9. **Single Source of Truth:** Keep `AGENTS.md` updated whenever backend routes, database columns, or deployment infrastructure change. Collaborators using Antigravity / Gemini rely on this file as the authoritative architecture specification.
