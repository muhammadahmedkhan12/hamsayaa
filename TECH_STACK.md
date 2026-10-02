# HamSayaa (ہمسایہ) — Technical Architecture & Technology Stack

> **Hackathon Presentation Guide:** Comprehensive technical documentation covering system architecture, technology selection rationale, data flow pipelines, and technical specifications for judges and reviewers.

---

## 1. Executive Technical Summary

HamSayaa is an **AI-First, Zero-Install Property Management SaaS** built to solve community administration and dues collection in emerging markets (starting with Pakistan). 

Unlike legacy systems that demand resident mobile app downloads (which suffer from <15% adoption), HamSayaa implements an **asymmetric architecture**:
1. **End-Residents:** Zero apps, zero logins — 100% conversational interaction over **WhatsApp** (text, voice notes, and payment slip photos).
2. **Society Management:** A high-productivity **React 18 Single Page Application (SPA)** dashboard for treasurers, managers, and security personnel.
3. **Core Engine:** A high-throughput **FastAPI async backend** backed by **Google Gemini Multimodal AI**, **Supabase (Managed PostgreSQL)**, and **Upstash Redis (Serverless REST)**.

---

## 2. System Architecture Diagram

```mermaid
flowchart TD
    subgraph Clients["Access Layer"]
        R[Resident Phone\nWhatsApp App]
        A[Admin Browser\nReact 18 + Vite]
    end

    subgraph Gateways["Ingress & Edge"]
        META[Meta WhatsApp Cloud API\nGraph API v21.0 Webhooks]
        VERCEL[Vercel Edge Proxy\nSPA & /api/* Rewrite]
    end

    subgraph Backend["Core Compute (Railway Container)"]
        FASTAPI[FastAPI Backend Engine\nPython 3.12 / Uvicorn]
        DEDUP[Atomic Deduplication & Auth Gate\nHMAC-SHA256 & Redis SETNX]
        ROUTER[Intent & Action Dispatcher]
    end

    subgraph AI["Cognitive Layer"]
        GEMINI[Google Gemini 3.x Multimodal\nText + Audio Binary + Vision OCR]
        CASCADE[Automated Model Fallback Cascade\n3.5-flash-lite ➔ 3.7-flash ➔ flash-latest]
    end

    subgraph Data["Persistence & State"]
        REDIS[(Upstash Redis REST)\n24h Memory • Dedup • Idempotency • FIFO]
        PG[(Supabase PostgreSQL)\n11 Relational Tables • RLS Policies]
        STORAGE[(Supabase Object Storage)\nsociety-receipts • society-voice-notes]
    end

    R <-->|Inbound / Outbound| META
    META -->|POST Webhook| DEDUP
    A <-->|HTTPS REST| VERCEL
    VERCEL --> FASTAPI

    DEDUP --> FASTAPI
    FASTAPI --> ROUTER
    ROUTER <--> GEMINI
    GEMINI -.-> CASCADE
    ROUTER <--> REDIS
    ROUTER <--> PG
    ROUTER <--> STORAGE
    FASTAPI -->|Outbound Send API| META
```

---

## 3. Technology Stack Deep Dive

### 3.1 AI & Cognitive Processing (Google Gemini)

| Specification | Implementation Details |
|---|---|
| **Primary Models** | `gemini-flash-latest`, `gemini-3.5-flash-lite`, `gemini-3.7-flash` |
| **Cascade Strategy** | Automated fallback cascade: `3.5-flash-lite` ➔ `3.7-flash` ➔ `3.6-flash` ➔ `gemini-flash-latest`. Eliminates downtime if one model experiences quota pressure. |
| **Multilingual NLU** | Zero-shot intent recognition across **English**, **Urdu (اردو)**, and **Roman Urdu** (*"Mera pani ka masla solve hogya hai"*, *"Bill kitna banta hai?"*). |
| **Binary Audio Transcription** | Direct multimodal ingestion of raw WhatsApp voice notes (`.ogg` / `.opus`). Gemini transcribes dialectal Roman Urdu/Urdu directly without external STT engines. |
| **Computer Vision & OCR** | 4-stage document verification pipeline for bank payment screenshots: extracts bank name, transaction ID, beneficiary title, timestamp, and amount. |
| **Security & Tamper Detection** | Vision-based fraud inspection flags manipulated digits, cut-and-paste transaction receipts, or mismatched beneficiary accounts before logging dues. |

---

### 3.2 Backend API & Execution Engine

| Component | Technology | Rationale & Technical Role |
|---|---|---|
| **Framework** | **FastAPI (Python 3.12)** | Asynchronous REST framework utilizing ASGI (Uvicorn). Native Python async event loop handles concurrent Meta webhooks without blocking. |
| **Data Validation** | **Pydantic v2** | High-speed Rust-core serialization and request validation for incoming Meta webhooks, payment payloads, and settings schemas. |
| **Authentication** | **JWT (HS256) + Bcrypt** | Stateless JSON Web Tokens (`PyJWT`) with salted password hashing (`passlib[bcrypt]`) for society administrative staff. |
| **Webhook Security** | **HMAC-SHA256 Signature Verification** | Validates `X-Hub-Signature-256` on every incoming WhatsApp payload using Meta App Secret to prevent spoofing. |
| **Observability** | **Sentry SDK** | Real-time backend exception capture, performance tracing, and alert monitoring. |

---

### 3.3 State, Memory & Cache Layer (Upstash Redis)

*Why Redis?* Relational databases are inefficient for high-frequency webhook deduplication and conversational sliding windows. Upstash provides serverless REST Redis with sub-millisecond execution.

1. **Atomic Deduplication (`processed_wamid:{id}`):**
   - Meta Cloud API frequently retries webhook delivery upon network variance.
   - Atomic `SETNX` with a **24-hour TTL (86,400s)** immediately drops retransmitted messages at the gateway before LLM token consumption.
2. **Contextual Chat Memory (`chat_history:{society_id}:{phone}`):**
   - Stores the last 6 conversational turns in a sliding Redis list.
   - Provides Gemini with conversational continuity (e.g., resident following up on an earlier ticket).
3. **Transaction ID & Image Hash Dedup:**
   - `receipt_hash:{sha256}`: Prevents the same screenshot from being uploaded twice.
   - `receipt_txid:{society_id}:{txid}`: Rejects recycled bank transfer reference numbers across the entire society.
4. **FIFO Debt & Partial Payments Ledger:**
   - Tracks incremental payments (`partial_payments:{inv_id}`) and outstanding arrears balances dynamically.

---

### 3.4 Relational Database & Storage (Supabase / PostgreSQL)

| Component | Specification | Description |
|---|---|---|
| **Engine** | **PostgreSQL 15+** | Relational integrity, ACID compliance, and relational foreign-key indexing. |
| **Access Layer** | **PostgREST + Supabase Python SDK** | Low-latency querying with parameterized inputs preventing SQL injection. |
| **Security** | **Row Level Security (RLS)** | Multi-tenant isolation ensuring queries are compartmentalized per `society_id`. |
| **Blob Storage** | **Supabase Storage (S3-compatible)** | Dedicated public buckets: <br>• `society-receipts` (Bank transfer slips & damage photos)<br>• `society-voice-notes` (WhatsApp audio files) |

#### Core Relational Schema:
- `societies`: Multi-tenant registry and baseline settings.
- `residents`: Unit number, building block, phone number, CNIC, and lease classification.
- `invoices`: Multi-cycle billing records, arrears balance, payable amounts, and status.
- `complaints`: Maintenance tickets, category tags, voice note link, photo link, resolution timestamp.
- `polls`: Community surveys, options JSON, and 1-vote-per-unit constraints.
- `vehicles` & `vehicle_logs`: Access control records, plate numbers, and duration tracking.
- `employees`, `assets`, `amenities`: Society personnel rosters, equipment schedules, and facility bookings.
- `admins`: Authorized committee user accounts and role-based permissions.

---

### 3.5 Frontend Web Dashboard (React 18 + Vite)

| Tool | Usage & Choice Rationale |
|---|---|
| **Core Framework** | **React 18 (SPA)** with functional components and React Hooks. |
| **Build Tooling** | **Vite 5** — sub-second Hot Module Replacement (HMR) and optimized Rollup tree-shaking. |
| **Styling & Design** | **Tailwind CSS 3** with custom design tokens (Navy, Slate, Emerald palette) matching high-density SaaS interfaces. |
| **Component Icons** | **Lucide React** — lightweight, tree-shakable SVG icon set. |
| **Data Resilience** | **Zero-Fail Fallback Pattern:** The client API service (`api.js`) automatically falls back to local structured datasets if the backend is temporarily unreachable, preventing broken demo states during judging. |
| **Navigation** | **React Router DOM v6** with protected route guards and session recovery. |

---

### 3.6 Communication & Messaging Gateway (Meta Cloud API)

- **API Version:** Meta WhatsApp Business Graph API **v21.0**.
- **Inbound:** Webhook notifications for message events (`text`, `audio`, `image`, `interactive`).
- **Outbound:** Direct transmission of structured templates, maintenance notifications, and monthly itemized vouchers.
- **Delivery Auditing:** Real-time webhook message status tracking (`sent` ➔ `delivered` ➔ `read` ➔ `failed`).

---

### 3.7 Deployment, Infrastructure & DevOps

```
GitHub Repository (main)
   ├───> Railway (Automated Docker build ➔ Debian Slim ➔ FastAPI Backend :8000)
   └───> Vercel  (Vite Build ➔ Edge CDN Distribution ➔ /api/* Reverse Proxy)
```

- **Production Backend:** Hosted on **Railway** via containerized Dockerfile (`python:3.12-slim`). Uses `socat` for reliable port forwarding and process monitoring.
- **Production Frontend:** Hosted on **Vercel** with CDN caching and automatic HTTPS. A custom `vercel.json` rewrites `/api/:path*` to the Railway backend instance, eliminating CORS configuration complexity in production.
- **Local Development:** Automated by Windows one-click scripts (`start.bat` / `stop.bat`) orchestrating FastAPI, Vite dev server, and **ngrok** tunnel.

---

## 4. Key Engineering Innovations & Solutions

### A. Zero-Install Resident UX
- Conventional society portals force tenants to download an app, remember passwords, and understand complex navigation.
- HamSayaa requires **no setup by the resident**. If a phone number is registered in the database, the resident can immediately text the society's official number to query dues, lodge complaints, or receive vouchers.

### B. Multi-Cycle Arrears & FIFO Ledger
- If a resident misses month 1 (PKR 5,000) and month 2 arrives (PKR 5,000), the engine dynamically rolls forward the unpaid balance into an `arrears` ledger.
- The WhatsApp voucher generated shows an itemized statement:
  ```text
  • Current Maintenance Fee:  PKR 5,000
  • Carried Arrears:          PKR 5,000
  • Total Payable:            PKR 10,000
  ```
- Payments are credited on a **First-In, First-Out (FIFO)** basis, guaranteeing historical invoices are cleared chronologically.

### C. 4-Stage Multimodal Receipt Verification
1. **Hash Dedup:** SHA-256 binary hash check stops identical file submissions before calling AI APIs.
2. **AI Vision Extraction:** Gemini analyzes the image to classify whether it is a payment slip or unrelated photo, extracting TxID and amount.
3. **Transaction Dedup:** Global Redis lookup across all society transactions prevents re-use of valid bank slips.
4. **Beneficiary Matching:** Verifies that the recipient title on the slip matches the society's designated bank account (flagging payments made to wrong accounts).

---

## 5. Summary Cheat Sheet for Judges

| Question | Hackathon Answer |
|---|---|
| **Why not build a Flutter/React Native mobile app?** | App store downloads kill adoption in emerging markets (especially across domestic staff and senior citizens). WhatsApp already has 90%+ daily active penetration. |
| **Why Gemini over OpenAI/Claude?** | Gemini natively accepts multimodal audio binaries (`.ogg`/`.opus`) and images in one unified pipeline with unmatched speed and cost-efficiency on Flash models. |
| **How do you handle LLM hallucinations?** | Gemini operates as a structured action dispatcher returning deterministic JSON schemas (`create_complaint`, `reply`, `issue_visitor_pass`). Business logic and financial updates remain strictly inside Python and SQL. |
| **What happens if Meta Cloud API retries a webhook?** | Upstash Redis executes an atomic `SETNX` lock on the message ID (`wamid`) within 2ms, discarding duplicate webhook events before compute is spent. |
| **How is multi-tenancy maintained?** | Database tables are indexed and protected via `society_id` foreign keys and PostgreSQL Row Level Security (RLS). |

---

*Authored for the HamSayaa Hackathon Presentation & Technical Review.*
