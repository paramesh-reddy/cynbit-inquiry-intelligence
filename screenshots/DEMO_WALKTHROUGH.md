# Demo & Verification Walkthrough

1. **Overview Dashboard**: Displays live KPI counts (`Total Inquiries`, `High-Priority Leads`, `Medium & Low Leads`, `Pending Email Review`), Service Category Distribution bars, Lead Priority Breakdown, and the Recent Client Inquiries table populated from SQLite.
2. **New Inquiry Intake (`New Inquiry`)**: Supports both Structured Form Intake (with 1-click sample presets) and Unstructured Raw Email Text Parsing. Submitting triggers the 12-stage pipeline and routes straight to the Inquiry Detail Workspace.
3. **Inquiry Detail Workspace (`Analysis & Scoring` / `Proposal Draft` / `Email Approval`)**:
   - Inspects the 5-factor deterministic priority score breakdown (`Budget Alignment`, `Timeline & Urgency`, `Requirement Clarity`, `Cynbit Capability Fit`, `Contact & Org Profile`).
   - Displays top-3 TF-IDF cosine matches from Cynbit's public knowledge base (`cynbit.in`).
   - Supports human overrides for service category and priority, editable preliminary proposals with PDF (`jsPDF`) and CSV export, and a strict Human-in-the-Loop approval gate before client outreach.
4. **Knowledge Base Explorer**: Allows testing live TF-IDF similarity queries against Cynbit's verified public services and proprietary SaaS suite (Revio, TenantEase, Cynbit Studio, BitElevate).
5. **Workspace Settings**: Configures BDM reviewer signature, preferred processing mode (`Auto` vs `Force Deterministic Fallback`), and lead priority thresholds.
