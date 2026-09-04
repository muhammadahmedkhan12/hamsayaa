# Hamsayaa — Multi-Agent & Developer Workspace Context (AGENTS.md)

Welcome to **Hamsayaa (ہمسایہ)**. This document serves as the single source of truth for all AI assistants (Antigravity/Gemini) and developers collaborating on this codebase. It documents our system architecture, design decisions, database schemas, active conventions, and operational workflows.

---

## 1. Project Overview & Business Context

- **What is Hamsayaa?** An AI-first, zero-install Property Management SaaS designed for gated residential communities and apartment complexes in Pakistan and emerging markets.
- **Business Model:** B2B / B2B2C SaaS.
  - **Paying Customer:** Society Management Committees, Real Estate Developers, Building Admin Offices.
  - **End Users:** Verified residents/tenants living in the residential society.
- **The Core Innovation (Zero-Install UX):**
  - Residents interact exclusively through **WhatsApp** (text & voice notes). No mobile app download required.
  - Society administrators manage operations, verify dues, and track tickets through a modern **React Web Dashboard**.

---

## 2. Technical Stack & Infrastructure

| Layer | Technology | Details |
|---|---|---|
| **Backend API** | **FastAPI** (Python 3.12 / Uvicorn) | Async REST API running on port `8000` (`app/main.py`). |
| **Frontend Dashboard** | **React 18 + Vite** | Single Page App running on port `3000` / `3001` (`frontend/`). |
| **AI LLM Engine** | **Google Gemini 2.0 Flash** (`gemini-2.0-flash`) | Intent parsing, conversation reasoning, multilingual understanding (English, Urdu, Roman Urdu). |
| **Audio Processing** | **Gemini Multimodal Audio** | Native binary transcription of WhatsApp voice notes (`.ogg` / `.opus`). |
| **Database** | **Supabase** (Managed PostgreSQL) | Relational database with Row Level Security (RLS) and PostgREST. |
| **Session Memory** | **Upstash Redis** (Serverless REST) | 24-hour sliding window chat history per resident (`chat_history:{phone}`). |
| **Object Storage** | **Supabase Storage** | Public bucket `society-voice-notes` for resident voice recordings. |
| **Local Tunneling** | **ngrok** | Exposes local FastAPI port 8000 to Meta WhatsApp Cloud API webhooks. |
| **Error Monitoring** | **Sentry SDK** | Backend observability and exception tracking. |

---

## 3. Architecture & Engine Pipelines

### A. LLM-First Messaging Architecture (`backend/app/services/gemini.py`)
Every inbound resident WhatsApp message follows a **Pure LLM-First pipeline**:
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
   - The engine cascades seamlessly through candidate models (`gemini-flash-latest` -> `gemini-3.6-flash` -> `gemini-3-flash-preview`).
   - ZERO hardcoded keyword or regex fallback arrays.
   - If (and only if) all candidate models fail due to API limits or outages, the system sends a transparent, polite service-busy notification with office intercom/helpline details instead of guessing or fabricating responses.
4. **Memory Persistence:** Both resident input and generated AI replies are saved back to Upstash Redis with an 86,400-second (24-hour) TTL via `_save_chat_history()`.

### B. Voice Note Processing Pipeline
1. Resident sends a WhatsApp voice note (`audio` or `voice` payload type).
2. `backend/app/api/v1/endpoints/whatsapp.py` extracts `media_id`.
3. `whatsapp_service.download_media(media_id)` downloads the binary `.ogg` audio from Meta Graph API.
4. `gemini_engine.transcribe_and_process_audio()`:
   - Passes raw audio binary to Gemini 2.0 Flash multimodal endpoint for instant English / Urdu / Roman Urdu transcription.
   - Uploads `.ogg` audio to Supabase Storage bucket (`society-voice-notes/`) via `db_service.upload_voice_note()`.
   - Stores the permanent `audio_url` on the complaint ticket.
   - Routes the transcribed text into `process_resident_message()` as a normal message.

### C. Complaint Resolution & WhatsApp Dispatch Pipeline
1. Society admin views active complaints in the React Dashboard (`Complaints.jsx`).
2. Admin clicks the green **"Mark Resolved"** button.
3. Frontend triggers `PATCH /api/v1/complaints/{id}` with `{"status": "resolved"}`.
4. Backend updates ticket status in Supabase and automatically calls `whatsapp_service.send_text_message()`.
5. The resident receives an immediate confirmation on WhatsApp:
   ```text
   ✅ *COMPLAINT RESOLVED*
   Hello [Name], great news! Your complaint has been resolved:
   • Ticket ID: TCK-XXXX
   • Category: [Category]
   • Issue: "[Description]"
   • Status: ✅ Resolved
   ```

---

## 4. Supabase Database Schema

### Core Tables:
1. **`residents`**:
   - `id` (UUID, PK), `society_id` (UUID), `building` (text), `unit_number` (text), `name` (text), `phone_number` (text, e.g. `+923316556622`), `cnic` (text), `is_owner` (bool), `is_tenant` (bool), `is_blocked` (bool).
2. **`complaints`**:
   - `id` (UUID, PK), `society_id` (UUID), `resident_id` (UUID, FK -> `residents.id`), `ticket_number` (text, e.g. `TCK-1042`), `category` (text), `description` (text), `status` (`open` | `in_progress` | `needs_human_review` | `resolved` | `flagged_irrelevant`), `audio_url` (text, nullable), `created_at` (timestamptz).
3. **`visitor_passes`**:
   - `id` (UUID, PK), `society_id` (UUID), `resident_id` (UUID, FK -> `residents.id`), `visitor_name` (text), `visitor_cnic` (text), `vehicle_plate` (text), `pass_code` (text, e.g. `LV-4821`), `valid_from` (timestamptz), `valid_until` (timestamptz).
4. **`invoices`**:
   - `id` (UUID, PK), `society_id` (UUID), `resident_id` (UUID, FK -> `residents.id`), `society_maintenance_fee` (numeric), `hamsayaa_saas_fee` (numeric), `utility_charges` (numeric), `total_amount` (numeric), `status` (`unpaid` | `paid` | `verified` | `overdue`), `due_date` (date), `receipt_url` (text, nullable).
5. **`polls` & `poll_votes`**:
   - Community surveys, single-choice voting enforcement per unit.

---

## 5. Development & Local Execution

### One-Click Scripts (Root Directory):
- **`start.bat`**: Automatically starts Backend (port 8000), Frontend (port 3000), and ngrok in separate windows using relative paths (`%~dp0`).
- **`stop.bat`**: Cleanly kills all running Python, Node, and ngrok processes.

### Environment Setup (`.env`):
All developers must copy `.env.example` to `backend/.env` and supply credentials:
- `WHATSAPP_*`: Meta Developer App credentials.
- `GEMINI_API_KEY`: Google AI Studio API key.
- `GEMINI_MODEL`: `gemini-2.0-flash` (or `gemini-2.5-flash`).
- `SUPABASE_*`: Shared project URL and Service Role Key (`sb_secret_...` or JWT).
- `UPSTASH_*`: Redis REST URL and Token.

### Meta WhatsApp Webhook Setup:
- **Callback URL:** `https://<YOUR-NGROK-DOMAIN>/api/v1/whatsapp/webhook`
- **Verify Token:** `hamsayaa_webhook_verify_token_secure`
- **Subscription Fields:** `messages`

---

## 6. Critical Rules for Agents & Developers

1. **WhatsApp Markdown Syntax:** WhatsApp does NOT render standard markdown headers (`#`) or double asterisks (`**`).
   - Use `*bold*` (single asterisk) and `_italic_` (single underscore).
   - Do not output markdown tables or blockquotes for WhatsApp responses.
2. **Never Fabricate Data:** AI must never invent a ticket ID, invoice amount, or bank account. If an action requires data, check Supabase first.
3. **Emergency Detection First:** Safety issues (fire, gas leaks, physical intruders) must immediately advise calling local emergency services before logging an emergency ticket.
4. **Phone Number Sanitization:** Always normalize phone numbers by stripping whitespace and dashes, formatting with leading `+` (e.g. `+923001234567`).
5. **Supabase Auto-Pause Awareness:** Free-tier Supabase databases auto-pause after 7 days of inactivity. If queries fail with `ConnectError: getaddrinfo failed` or 401, check the Supabase Dashboard and click "Resume Project".
