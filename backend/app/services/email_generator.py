from typing import Dict
from .inquiry_processor import PreprocessedInquiry


def build_email_draft(
    inquiry: PreprocessedInquiry,
    primary_category: str,
    recommended_service: str,
    first_feature: str,
    reviewer_name: str = "Ananya Verma",
    reviewer_role: str = "Business Development & Solutions Lead",
    company_signature: str = "Cynbit Technologies · Jaipur, India · cynbit.in",
) -> Dict[str, str]:
    integrations = inquiry.extracted_integrations or ["your existing systems"]
    subject = f"Next steps on {inquiry.company}'s {primary_category} initiative — Cynbit Technologies"
    body = (
        f"Hi {inquiry.client_name},\n\n"
        f"Thank you for reaching out to Cynbit Technologies regarding {inquiry.company}'s upcoming "
        f"{primary_category.lower()} initiative.\n\n"
        f"We reviewed your requirements around {first_feature.lower()}. "
        f"This aligns closely with our {recommended_service} practice.\n\n"
        f"To make our initial discovery conversation productive, we would love to discuss:\n"
        f"1. Your current operational volume and edge-case escalation rules\n"
        f"2. Integration access requirements for {', '.join(integrations[:2])}\n"
        f"3. A phased rollout plan targeting your {inquiry.timeline} timeline\n\n"
        f"Would you be available for a 25-minute technical scoping call this week?\n\n"
        f"Best regards,\n{reviewer_name}\n{reviewer_role}\n{company_signature}"
    )
    return {"subject": subject, "body": body}
