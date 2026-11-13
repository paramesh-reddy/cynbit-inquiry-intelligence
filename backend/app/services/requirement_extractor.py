import re
from typing import Dict, List
from .inquiry_processor import PreprocessedInquiry


def extract_requirements_deterministically(
    inquiry: PreprocessedInquiry,
    primary_category: str,
    top_kb: dict | None,
    urgency_level: str,
) -> Dict:
    sentences = [
        s.strip()
        for s in re.split(r"(?<=[.!?])\s+", inquiry.normalized_text)
        if len(s.strip()) > 10
    ]
    client_problem = (
        " ".join(sentences[:2])
        if sentences
        else f"{inquiry.company} requires {primary_category} engineering to modernize manual workflows."
    )

    lower = inquiry.normalized_text.lower()
    features: List[str] = []
    if "voice" in lower or "call" in lower:
        features.append("Conversational inbound voice intake with multi-language intent routing")
    if "book" in lower or "slot" in lower or "appointment" in lower:
        features.append("Automated slot booking and scheduling integration")
    if "escalat" in lower or "human" in lower:
        features.append("Human-in-the-loop escalation and review queue")
    if "dashboard" in lower or "analytics" in lower or "report" in lower:
        features.append("Executive operational analytics and reporting dashboard")
    if "invoice" in lower or "pdf" in lower or "document" in lower:
        features.append("Automated PDF/document parsing, field extraction, and validation")
    if "review" in lower or "sentiment" in lower:
        features.append("Multi-platform review ingestion, sentiment analysis, and response drafting")
    if "rent" in lower or "tenant" in lower or "lease" in lower:
        features.append("Tenant lifecycle tracking, automated invoicing, and maintenance workflows")
    if "crm" in lower or "lead" in lower or "follow-up" in lower:
        features.append("Automated lead capture, scoring rules, and multi-channel follow-up sequences")
    if "autoscale" in lower or "docker" in lower or "ci/cd" in lower or "aws" in lower:
        features.append("Containerized autoscaling infrastructure with zero-downtime CI/CD")
    if "seo" in lower or "schema" in lower or "web vitals" in lower:
        features.append("Technical SEO remediation, Schema.org markup, and Core Web Vitals optimization")

    if len(features) < 3 and top_kb:
        for cap in top_kb.get("capabilities", []):
            if len(features) < 4 and cap not in features:
                features.append(cap)

    integrations = inquiry.extracted_integrations or ["REST Webhook APIs", "PostgreSQL Persistence"]
    objectives = [
        f"Address core operational bottleneck for {inquiry.company} in {inquiry.industry}",
        (
            f"Support target workload scale ({', '.join(inquiry.extracted_metrics)})"
            if inquiry.extracted_metrics
            else f"Improve operational turnaround within {inquiry.timeline}"
        ),
        f"Align delivery with Cynbit's {top_kb['title'] if top_kb else primary_category} practice",
    ]
    technical_requirements = [
        f"Primary architecture aligned with {primary_category}",
        f"External system connectivity: {', '.join(integrations)}",
        "Input validation, structured audit logging, and role-based access control",
        (
            "Rapid phased rollout prioritizing critical-path automation first"
            if urgency_level == "High"
            else "Modular staged implementation with production observability"
        ),
    ]

    solution_architecture = {
        "overview": f"Modular {primary_category} solution anchored on {top_kb['title'] if top_kb else 'Cynbit Engineering'}, combining an API-first backend, deterministic validation rules, and human-reviewed operational controls.",
        "components": [
            "API Gateway & Input Validation Layer (FastAPI / Pydantic)",
            f"Core {primary_category} Processing & Orchestration Engine",
            "Relational Data Store (PostgreSQL) with Audit Trail",
            "React + TypeScript Operational Review & Analytics Workspace",
        ],
        "integrations": integrations,
        "deployment_notes": "Containerized deployment suitable for AWS/GCP/Render with environment-isolated secrets and health checks.",
    }

    return {
        "client_problem": client_problem,
        "business_objectives": objectives,
        "expected_features": features,
        "technical_requirements": technical_requirements,
        "solution_architecture": solution_architecture,
    }
