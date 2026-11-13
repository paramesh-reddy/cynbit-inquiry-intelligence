import json
from typing import Dict, List
from openai import OpenAI
from ..config import settings
from .ai_classifier import classify_deterministically
from .inquiry_processor import PreprocessedInquiry
from .requirement_extractor import extract_requirements_deterministically

PRELIMINARY_DISCLAIMER = (
    "Preliminary AI-assisted suggestion for internal discovery only — "
    "not an official Cynbit Technologies commercial quotation or binding timeline."
)


def generate_proposal_and_analysis(
    inquiry: PreprocessedInquiry,
    kb_matches: List[dict],
    kb_items: List[dict],
    lead_score: Dict,
    reviewer_name: str = "Ananya Verma",
    reviewer_role: str = "Business Development & Solutions Lead",
    company_signature: str = "Cynbit Technologies · Jaipur, India · cynbit.in",
    force_deterministic: bool = False,
) -> Dict:
    top_kb = next((i for i in kb_items if kb_matches and i["id"] == kb_matches[0]["id"]), kb_items[0] if kb_items else None)

    if not force_deterministic and settings.openai_configured:
        try:
            client = OpenAI(api_key=settings.OPENAI_API_KEY)
            kb_ctx = "\n".join(
                f"{idx+1}. {m['title']} ({m['service_category']}, sim={m['similarity_score']}): {m['summary']}"
                for idx, m in enumerate(kb_matches)
            )
            resp = client.chat.completions.create(
                model=settings.OPENAI_MODEL,
                temperature=0.2,
                response_format={"type": "json_object"},
                messages=[
                    {
                        "role": "system",
                        "content": (
                            "You are a Principal AI Solutions Architect at Cynbit Technologies (cynbit.in). "
                            "Analyze the inquiry strictly using provided text and Cynbit KB context. "
                            "Return JSON with keys: service_category, secondary_category, confidence_score, "
                            "client_problem, business_objectives, expected_features, technical_requirements, "
                            "recommended_cynbit_service, solution_architecture, proposal, email_draft."
                        ),
                    },
                    {
                        "role": "user",
                        "content": (
                            f"Client: {inquiry.client_name} | Company: {inquiry.company} | Industry: {inquiry.industry}\n"
                            f"Budget: {inquiry.budget_range} | Timeline: {inquiry.timeline}\n"
                            f"Deterministic Score: {lead_score['priority_score']}/100 ({lead_score['priority_label']})\n"
                            f"Description: {inquiry.normalized_text}\n\n"
                            f"Cynbit KB Matches:\n{kb_ctx}\n\n"
                            f"Sign email as:\n{reviewer_name}\n{reviewer_role}\n{company_signature}"
                        ),
                    },
                ],
            )
            content = resp.choices[0].message.content
            if content:
                parsed = json.loads(content)
                proposal = parsed.get("proposal", {})
                proposal["preliminary_disclaimer"] = PRELIMINARY_DISCLAIMER
                return {
                    "processing_mode": "openai_llm",
                    "llm_provider": f"OpenAI ({settings.OPENAI_MODEL})",
                    "service_category": parsed.get("service_category", "AI Automation"),
                    "secondary_category": parsed.get("secondary_category"),
                    "confidence_score": float(parsed.get("confidence_score", 0.85)),
                    "client_problem": parsed.get("client_problem", inquiry.normalized_text),
                    "business_objectives": parsed.get("business_objectives", []),
                    "expected_features": parsed.get("expected_features", []),
                    "technical_requirements": parsed.get("technical_requirements", []),
                    "recommended_cynbit_service": parsed.get("recommended_cynbit_service", top_kb["title"] if top_kb else "AI Automation"),
                    "solution_architecture": parsed.get("solution_architecture", {}),
                    "proposal": proposal,
                    "email_draft": parsed.get("email_draft", {}),
                    "processing_notes": f"Structured JSON synthesis completed via OpenAI {settings.OPENAI_MODEL}.",
                }
        except Exception as exc:
            fallback_note = f"OpenAI fallback triggered cleanly ({exc})."
    else:
        fallback_note = (
            "Processed in Deterministic Fallback Mode as requested."
            if force_deterministic
            else "OPENAI_API_KEY not configured; processed via transparent Deterministic Fallback + TF-IDF Engine."
        )

    primary, secondary, confidence = classify_deterministically(inquiry.normalized_text, kb_matches)
    req_data = extract_requirements_deterministically(inquiry, primary, top_kb, lead_score["urgency_level"])
    integrations = inquiry.extracted_integrations or ["REST Webhook APIs", "PostgreSQL Persistence"]
    tech_stack = list(dict.fromkeys((top_kb.get("typical_stack", []) if top_kb else ["Python", "FastAPI", "React", "PostgreSQL"]) + inquiry.extracted_integrations))[:7]

    complexity = "High" if (lead_score["priority_score"] >= 75 or len(inquiry.extracted_integrations) >= 2) else ("Medium" if lead_score["priority_score"] >= 45 else "Low")
    est_timeline = "6 - 10 weeks (Phased Delivery)" if complexity == "High" else ("4 - 6 weeks" if complexity == "Medium" else "2 - 4 weeks")

    proposal = {
        "title": f"Preliminary Technical Proposal: {inquiry.company} — {primary}",
        "problem_statement": req_data["client_problem"],
        "proposed_solution": f"Cynbit Technologies recommends a modular {primary} architecture leveraging {top_kb['title'] if top_kb else 'our engineering stack'} to address {inquiry.company}'s objectives with human review gates.",
        "recommended_technologies": tech_stack,
        "implementation_phases": [
            {
                "phase": "Phase 1: Discovery & Architecture Blueprint",
                "duration": "Week 1",
                "deliverables": [
                    f"Workflow audit for {inquiry.company}'s {inquiry.industry} operations",
                    f"Integration specification for {', '.join(integrations[:3])}",
                ],
            },
            {
                "phase": "Phase 2: Core Engine & Integration Build",
                "duration": "Weeks 2 - 6" if complexity == "High" else "Weeks 2 - 4",
                "deliverables": [
                    f"Implementation of {req_data['expected_features'][0] if req_data['expected_features'] else 'core pipeline'}",
                    "API endpoints, validation safeguards, and fallback handling",
                ],
            },
            {
                "phase": "Phase 3: UAT, Hardening & Production Rollout",
                "duration": "Weeks 7 - 9" if complexity == "High" else "Final Week",
                "deliverables": [
                    "Automated testing and UAT verification",
                    "Observability dashboards and team handover",
                ],
            },
        ],
        "estimated_complexity": complexity,
        "estimated_timeline": est_timeline,
        "preliminary_disclaimer": PRELIMINARY_DISCLAIMER,
    }

    return {
        "processing_mode": "deterministic_fallback",
        "llm_provider": "Deterministic Rule + TF-IDF Engine",
        "service_category": primary,
        "secondary_category": secondary,
        "confidence_score": confidence,
        **req_data,
        "recommended_cynbit_service": top_kb["title"] if top_kb else primary,
        "proposal": proposal,
        "processing_notes": fallback_note,
    }
