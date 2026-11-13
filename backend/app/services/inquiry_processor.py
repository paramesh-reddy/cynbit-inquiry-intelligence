import re
from dataclasses import dataclass
from typing import TYPE_CHECKING, Any, List, Optional

if TYPE_CHECKING:
    from ..schemas import InquiryCreate

FREE_EMAIL_DOMAINS = {
    "gmail.com",
    "yahoo.com",
    "hotmail.com",
    "outlook.com",
    "icloud.com",
    "proton.me",
    "protonmail.com",
}

KNOWN_INTEGRATIONS = [
    "HubSpot", "Salesforce", "Zoho", "Razorpay", "Stripe", "WhatsApp",
    "AWS", "GCP", "Azure", "PostgreSQL", "Docker", "Practo", "Google",
    "Meta", "LinkedIn", "ERP", "CRM", "Slack", "Shopify", "GST", "Prometheus",
]

URGENCY_KEYWORDS = [
    "urgent", "immediately", "immediate", "asap", "critical", "outage",
    "outages", "losing", "missed", "misses", "flash sales", "peak",
    "deadline", "within 2 weeks", "within 3 weeks", "within 4 weeks", "this month",
]


@dataclass
class PreprocessedInquiry:
    client_name: str
    client_email: str
    company: str
    industry: str
    budget_range: str
    timeline: str
    project_description: str
    normalized_text: str
    word_count: int
    extracted_integrations: List[str]
    extracted_metrics: List[str]
    urgency_signals: List[str]
    estimated_budget_usd: Optional[int]
    timeline_weeks: Optional[int]
    has_corporate_email: bool


def parse_budget_estimate_usd(budget_range: str, description: str) -> Optional[int]:
    combined = f"{budget_range} {description}".replace(",", "")
    matches = re.findall(r"\$?\s*(\d{3,6})\s*(k)?", combined, flags=re.IGNORECASE)
    values: List[int] = []
    for num_str, k_flag in matches:
        num = int(num_str)
        val = num * 1000 if k_flag else num
        if 500 <= val <= 1_000_000:
            values.append(val)
    if not values:
        return None
    return round(sum(values) / len(values))


def parse_timeline_weeks(timeline: str, description: str) -> Optional[int]:
    combined = f"{timeline} {description}".lower()
    if any(w in combined for w in ("immediate", "asap", "urgent")):
        m = re.search(r"(\d+)\s*week", combined)
        return int(m.group(1)) if m else 3
    week_match = re.search(r"(\d+)\s*(?:-\s*(\d+))?\s*week", combined)
    if week_match:
        min_w = int(week_match.group(1))
        max_w = int(week_match.group(2)) if week_match.group(2) else min_w
        return round((min_w + max_w) / 2)
    month_match = re.search(r"(\d+)\s*(?:-\s*(\d+))?\s*month", combined)
    if month_match:
        min_m = int(month_match.group(1))
        max_m = int(month_match.group(2)) if month_match.group(2) else min_m
        return round(((min_m + max_m) / 2) * 4)
    if any(w in combined for w in ("flexible", "exploratory", "no rush")):
        return 24
    return None


def preprocess_inquiry(data: Any) -> PreprocessedInquiry:
    get_val = lambda k: data[k] if isinstance(data, dict) else getattr(data, k)
    project_description = get_val("project_description")
    client_email = get_val("client_email")
    timeline = get_val("timeline")
    budget_range = get_val("budget_range")
    client_name = get_val("client_name")
    company = get_val("company")
    industry = get_val("industry")

    normalized = re.sub(r"\s+", " ", project_description).strip()
    words = [w for w in normalized.split(" ") if w]

    extracted_integrations = [
        term for term in KNOWN_INTEGRATIONS if re.search(rf"\b{re.escape(term)}\b", normalized, re.IGNORECASE)
    ]
    extracted_metrics = list(
        dict.fromkeys(
            re.findall(
                r"\b\d[\d,]*\+?\s*(?:calls?|units?|centers?|clinics?|invoices?|pdfs?|days?|weeks?|months?|%|users?|leads?)\b",
                normalized,
                flags=re.IGNORECASE,
            )
        )
    )
    combined_lower = f"{timeline} {normalized}".lower()
    urgency_signals = [kw for kw in URGENCY_KEYWORDS if kw in combined_lower]

    domain = client_email.split("@")[-1].lower()
    has_corp = bool(domain and domain not in FREE_EMAIL_DOMAINS)

    return PreprocessedInquiry(
        client_name=client_name.strip(),
        client_email=client_email.strip(),
        company=company.strip(),
        industry=industry.strip(),
        budget_range=budget_range.strip(),
        timeline=timeline.strip(),
        project_description=project_description.strip(),
        normalized_text=normalized,
        word_count=len(words),
        extracted_integrations=extracted_integrations,
        extracted_metrics=extracted_metrics,
        urgency_signals=urgency_signals,
        estimated_budget_usd=parse_budget_estimate_usd(budget_range, normalized),
        timeline_weeks=parse_timeline_weeks(timeline, normalized),
        has_corporate_email=has_corp,
    )


def parse_raw_inquiry_text(raw_text: str) -> dict:
    text = raw_text.strip()
    email_match = re.search(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}", text)
    email = email_match.group(0) if email_match else "prospect@company.com"

    name_match = re.search(r"(?:name|from|regards|thanks)[:,\-\s]+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)", text, re.IGNORECASE)
    client_name = name_match.group(1).strip() if name_match else "Inbound Prospect"

    company_match = re.search(r"(?:company|organization)[:\s]+([A-Z][A-Za-z0-9&\s]{2,30})", text, re.IGNORECASE)
    domain_root = email.split("@")[-1].split(".")[0].capitalize()
    company = company_match.group(1).split("\n")[0].split(".")[0].strip() if company_match else domain_root

    budget_match = re.search(r"\$\s*\d[\d,]*(?:\s*-\s*\$?\s*\d[\d,]*)?", text)
    budget_range = re.sub(r"\s+", " ", budget_match.group(0)).strip() if budget_match else "Undisclosed / Exploring"

    timeline = "1 - 3 months"
    if re.search(r"urgent|asap|immediate|within\s+\d+\s+week", text, re.IGNORECASE):
        timeline = "Urgent (Within 4 weeks)"
    elif re.search(r"flexible|exploratory", text, re.IGNORECASE):
        timeline = "Flexible (Exploratory)"

    industry = "Technology"
    if re.search(r"health|clinic|patient|diagnostic", text, re.IGNORECASE):
        industry = "Healthcare"
    elif re.search(r"property|tenant|real estate|rental", text, re.IGNORECASE):
        industry = "Real Estate / PropTech"
    elif re.search(r"fintech|invoice|accounting|erp|gst", text, re.IGNORECASE):
        industry = "FinTech"

    return {
        "client_name": client_name,
        "client_email": email,
        "company": company,
        "industry": industry,
        "budget_range": budget_range,
        "timeline": timeline,
        "project_description": text,
    }
