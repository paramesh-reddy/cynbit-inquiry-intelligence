from typing import Dict, List, Optional, Tuple

CATEGORY_RULES = [
    ("AI Automation", ["invoice", "invoices", "pdf", "erp", "document extraction", "workflow automation", "autonomous agent", "llm", "triage", "human-in-the-loop"], 1.2),
    ("AI/ML", ["voice agent", "inbound calls", "phone inquiries", "hindi", "speech", "sentiment", "review intelligence", "revio", "nlp", "machine learning", "ai assistant"], 1.2),
    ("Full-Stack Development", ["portal", "dashboard", "tenantease", "web app", "mobile app", "razorpay", "rental", "tenant", "saas", "full-stack", "landlord"], 1.1),
    ("CRM Automation", ["crm", "hubspot", "zoho", "salesforce", "lead scoring", "follow-up", "whatsapp", "pipeline", "nurturing", "spreadsheets"], 1.15),
    ("Cloud Infrastructure", ["aws", "gcp", "azure", "docker", "kubernetes", "autoscaling", "rds", "ci/cd", "prometheus", "outages", "monolithic"], 1.2),
    ("Digital Marketing", ["seo", "core web vitals", "organic traffic", "google shopping", "meta ads", "schema", "campaign", "search rankings", "d2c"], 1.15),
    ("Other", ["bootcamp", "internship", "bitelevate", "cynbit studio", "cohort", "mentorship", "partnership", "training"], 1.1),
]


def classify_deterministically(normalized_text: str, kb_matches: List[dict]) -> Tuple[str, Optional[str], float]:
    lower = normalized_text.lower()
    scores: Dict[str, float] = {}

    for cat, keywords, weight in CATEGORY_RULES:
        score = 0.0
        for kw in keywords:
            if kw in lower:
                score += (2.2 if " " in kw else 1.4) * weight
        scores[cat] = score

    if kb_matches:
        top_cat = kb_matches[0]["service_category"]
        scores[top_cat] = scores.get(top_cat, 0.0) + kb_matches[0]["similarity_score"] * 3.0

    ranked = sorted(scores.items(), key=lambda x: x[1], reverse=True)
    primary = ranked[0][0] if ranked and ranked[0][1] > 0 else (kb_matches[0]["service_category"] if kb_matches else "Other")
    secondary = ranked[1][0] if len(ranked) > 1 and ranked[1][1] >= 1.5 and ranked[1][0] != primary else None
    top_val = ranked[0][1] if ranked else 0.0
    confidence = round(min(0.95, max(0.55, 0.55 + top_val * 0.06)), 2)
    return primary, secondary, confidence
