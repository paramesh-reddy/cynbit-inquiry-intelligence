# Cynbit AI Client Inquiry Intelligence & Automation Agent

An end-to-end AI/ML Proof of Concept built for the **Cynbit Technologies AI/ML Engineer Intern Technical Assessment**.

This system automates client inquiry triage, classifies projects into Cynbit's service lines and proprietary SaaS offerings, scores lead priority using transparent deterministic rules, retrieves matching capabilities from a grounded Cynbit public knowledge base, generates preliminary proposals (exportable to PDF and CSV), and drafts personalized client emails guarded by a mandatory human-in-the-loop approval step.

---

## Key Capabilities

1. **Dual Client Inquiry Intake:** Structured form capture plus an unstructured raw email/text parser (`/api/inquiries/quick-parse`).
2. **Service Classification & Requirement Extraction:** Classifies into `AI/ML`, `AI Automation`, `Full-Stack Development`, `CRM Automation`, `Cloud Infrastructure`, `Digital Marketing`, and `Other`. Extracts client problems, business objectives, expected features, and technical requirements.
3. **Transparent Deterministic Lead Scoring (0–100):** Auditable 5-factor rubric (Budget Alignment, Timeline & Urgency, Requirement Clarity, Cynbit Capability Fit, Contact & Org Profile) producing `High`, `Medium`, and `Low` priority tiers with explicit point-by-point rationale.
4. **Grounded Cynbit Knowledge Base Retrieval:** TF-IDF cosine similarity retrieval over verified public information from `cynbit.in` (AI Agents, AI Voice Agents, Full-Stack Engineering, CRM Automation, Cloud Infrastructure, Technical SEO, Revio, TenantEase, Cynbit Studio & BitElevate).
5. **Dual Processing Modes (LLM + Zero-Key Fallback):**
   - **OpenAI Mode:** Uses `gpt-4o-mini` with structured JSON outputs when `OPENAI_API_KEY` is configured.
   - **Deterministic Fallback Mode:** Operates fully offline/without an API key using rule-based NLP + TF-IDF retrieval, transparently labeled as `Deterministic Rule + TF-IDF Engine`.
6. **Preliminary Proposal & Export:** Generates editable problem statements, recommended stack, phased timelines, complexity estimates (explicitly marked as preliminary estimates, not official Cynbit quotations), and supports **PDF** and **CSV** exports.
7. **Human-Gated Email Drafting:** Personalized reply drafts default to `pending_review` and are never sent automatically without explicit BDM approval.
8. **Interactive SaaS Dashboard & History:** Overview KPIs, category distribution, search/filterable inquiry history, live KB similarity tester, and workspace settings.

---

## Project Structure

```text
├── backend/                     # Production Python FastAPI + SQLAlchemy backend
│   ├── app/
│   │   ├── main.py              # FastAPI REST endpoints & startup seeding
│   │   ├── config.py            # Environment & CORS configuration
│   │   ├── database.py          # SQLAlchemy engine (SQLite local / PostgreSQL prod)
│   │   ├── models.py            # ORM tables (inquiries, analyses, proposals, email_drafts)
│   │   ├── schemas.py           # Pydantic v2 input/output validation
│   │   └── services/            # Modular pipeline services
│   │       ├── inquiry_processor.py
│   │       ├── knowledge_retriever.py
│   │       ├── lead_scorer.py
│   │       ├── ai_classifier.py
│   │       ├── requirement_extractor.py
│   │       ├── proposal_generator.py
│   │       ├── email_generator.py
│   │       └── crud.py
│   ├── tests/
│   │   ├── test_python_modules.py
│   │   └── test_fastapi_routes.py
│   ├── Dockerfile
│   ├── Procfile
│   └── requirements.txt
├── server/                      # Unified Node.js/Express + SQLite runtime (Port 3000)
│   ├── routes/api.ts
│   ├── services/
│   ├── tests/pipeline.test.ts
│   ├── config.ts
│   ├── db.ts
│   └── types.ts
├── src/                         # React 19 + TypeScript + Tailwind CSS frontend
│   ├── components/
│   ├── utils/pdfExport.ts
│   ├── api.ts
│   ├── types.ts
│   └── App.tsx
├── docs/
│   ├── AI_OPPORTUNITY_REPORT.md
│   └── TECHNICAL_APPROACH.md
├── sample_data/
│   ├── cynbit_knowledge_base.json
│   └── sample_inquiries.json
├── screenshots/
├── server.ts                    # Unified Express + Vite dev/prod server on port 3000
├── vercel.json                  # Vercel frontend deployment config
├── render.yaml                  # Render FastAPI + PostgreSQL blueprint
├── .env.example
└── package.json
```

---

## Local Setup & Startup Instructions

### 1. Environment Variables

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Optional: Set `OPENAI_API_KEY="sk-..."` to enable OpenAI `gpt-4o-mini` structured JSON synthesis. Leave blank to run in **Deterministic Fallback Mode**.

### 2. Option A — Unified Full-Stack Server (Recommended Local Quickstart)

Runs the React frontend, REST API, and persistent SQLite database together on `http://localhost:3000`:

```bash
npm install
npm run dev
```

### 3. Option B — Dedicated Python FastAPI Backend + Vite Frontend

**Start Python FastAPI Backend (`http://localhost:8000`):**

```bash
cd backend
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Interactive Swagger API documentation is available at `http://localhost:8000/docs`.

**Start React Frontend (`http://localhost:5173`):**

```bash
VITE_API_BASE_URL="http://localhost:8000" npm run dev
```

---

## Running Automated Tests

**Run Node.js / TypeScript API & Pipeline Integration Tests:**

```bash
npm test
```

**Run Python Module Unit Tests (Zero external dependencies required):**

```bash
python3 -m unittest discover -s backend/tests -p "test_python_modules.py"
```

**Run Full FastAPI Pytest Suite (inside Python venv with `requirements.txt` installed):**

```bash
pytest backend/tests/
```

---

## Key API Endpoints

- `GET /api/health` — System health and active AI processing mode
- `GET /api/dashboard/metrics` — Pipeline KPIs, priority counts, category breakdown
- `GET /api/inquiries?q=&priority=&category=&approval=` — Search & filter inquiries
- `POST /api/inquiries` — Validate, analyze, score, and persist new inquiry
- `POST /api/inquiries/quick-parse` — Extract fields from unstructured text & process
- `GET /api/inquiries/:id` — Retrieve full inquiry, analysis, proposal, and email draft
- `POST /api/inquiries/:id/reanalyze` — Re-run pipeline on an inquiry
- `PATCH /api/inquiries/:id/classification` — Human override for category/priority
- `PATCH /api/inquiries/:id/proposal` — Edit preliminary proposal fields
- `PATCH /api/inquiries/:id/email` — Edit email draft & apply human approval status
- `GET /api/inquiries/:id/export/csv` — Export inquiry analysis as CSV
- `GET /api/knowledge-base?q=` — Browse Cynbit KB and test TF-IDF similarity matching
- `GET / PATCH /api/settings` — Read and update reviewer identity & scoring thresholds

---

## Deployment Instructions

### Frontend on Vercel
1. Import the repository into Vercel using the included `vercel.json`.
2. Set `VITE_API_BASE_URL` in Vercel Environment Variables to your deployed backend URL (e.g. `https://cynbit-inquiry-intelligence-api.onrender.com`).
3. Build command: `npm run build` · Output directory: `dist`.

### Backend + PostgreSQL on Render
1. Deploy using the included `render.yaml` Blueprint (provisions a Python web service in `backend/` and a managed PostgreSQL database).
2. Add `OPENAI_API_KEY` and `ALLOWED_ORIGINS` (your Vercel URL) in Render Environment Variables.
3. SQLAlchemy automatically creates all tables and seeds sample data on startup.

---

## Assessment Deliverables Included

- `docs/AI_OPPORTUNITY_REPORT.md` — Company research, 6 AI/ML opportunities, comparison matrix, and selection justification.
- `docs/TECHNICAL_APPROACH.md` — 19-section engineering specification with Mermaid architecture diagram.
- Functional React + TypeScript + FastAPI + SQLite/PostgreSQL PoC with automated tests.
