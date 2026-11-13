from typing import Dict, List
from .inquiry_processor import PreprocessedInquiry


def score_lead_deterministically(
    inquiry: PreprocessedInquiry,
    kb_matches: List[dict],
    high_threshold: int = 70,
    medium_threshold: int = 40,
) -> Dict:
    breakdown: List[dict] = []

    # 1. Budget Alignment (0 - 25)
    budget_pts = 6
    budget_reason = "Budget is undisclosed or exploratory."
    est = inquiry.estimated_budget_usd
    if est is not None:
        if est >= 20000:
            budget_pts = 25
            budget_reason = f"Strong enterprise budget signal (~${est:,})."
        elif est >= 10000:
            budget_pts = 20
            budget_reason = f"Healthy mid-market project budget (~${est:,})."
        elif est >= 5000:
            budget_pts = 14
            budget_reason = f"Moderate SMB project budget (~${est:,})."
        else:
            budget_pts = 8
            budget_reason = f"Compact starter budget (~${est:,})."
    breakdown.append({
        "factor": "Budget Alignment",
        "points": budget_pts,
        "max_points": 25,
        "reason": budget_reason,
    })

    # 2. Timeline & Urgency (0 - 25)
    timeline_pts = 6
    timeline_reason = "Timeline is exploratory with no immediate deadline."
    urgency_level = "Low"
    weeks = inquiry.timeline_weeks
    has_urgency = len(inquiry.urgency_signals) > 0

    if (weeks is not None and weeks <= 4) or has_urgency:
        timeline_pts = 25 if (weeks is not None and weeks <= 4) else 21
        urgency_level = "High"
        timeline_reason = (
            f"Explicit urgency signals detected ({', '.join(inquiry.urgency_signals[:3])})."
            if has_urgency
            else f"Immediate delivery target (~{weeks} weeks)."
        )
    elif weeks is not None and weeks <= 10:
        timeline_pts = 17
        urgency_level = "Medium"
        timeline_reason = f"Active near-term implementation window (~{weeks} weeks)."
    elif weeks is not None and weeks <= 16:
        timeline_pts = 11
        urgency_level = "Medium"
        timeline_reason = f"Planned quarterly delivery horizon (~{weeks} weeks)."

    breakdown.append({
        "factor": "Timeline & Urgency",
        "points": timeline_pts,
        "max_points": 25,
        "reason": timeline_reason,
    })

    # 3. Requirement Clarity (0 - 20)
    clarity_pts = 4
    if inquiry.word_count >= 45:
        clarity_pts += 6
    elif inquiry.word_count >= 25:
        clarity_pts += 4
    else:
        clarity_pts += 2
    if len(inquiry.extracted_integrations) >= 2:
        clarity_pts += 5
    elif len(inquiry.extracted_integrations) == 1:
        clarity_pts += 3
    if len(inquiry.extracted_metrics) >= 1:
        clarity_pts += 5
    clarity_pts = min(20, clarity_pts)

    breakdown.append({
        "factor": "Requirement Clarity",
        "points": clarity_pts,
        "max_points": 20,
        "reason": f"Specification includes {inquiry.word_count} words and {len(inquiry.extracted_integrations)} named system targets.",
    })

    # 4. Cynbit Capability Fit (0 - 20)
    top_match = kb_matches[0] if kb_matches else None
    sim = top_match["similarity_score"] if top_match else 0.0
    fit_pts = 8
    if sim >= 0.35:
        fit_pts = 20
    elif sim >= 0.22:
        fit_pts = 16
    elif sim >= 0.12:
        fit_pts = 12

    breakdown.append({
        "factor": "Cynbit Capability Fit",
        "points": fit_pts,
        "max_points": 20,
        "reason": (
            f"Strongest knowledge match: {top_match['title']} (similarity {sim:.2f})."
            if top_match
            else "General capability evaluation required."
        ),
    })

    # 5. Organization & Contact Completeness (0 - 10)
    comp_pts = 4
    if inquiry.has_corporate_email:
        comp_pts += 3
    if len(inquiry.company) >= 3 and inquiry.industry != "Other":
        comp_pts += 3
    comp_pts = min(10, comp_pts)

    breakdown.append({
        "factor": "Contact & Org Profile",
        "points": comp_pts,
        "max_points": 10,
        "reason": (
            f"Verified corporate domain email and specified {inquiry.industry} context."
            if inquiry.has_corporate_email
            else "Valid contact details provided; non-corporate email domain."
        ),
    })

    total_score = min(100, sum(item["points"] for item in breakdown))
    if total_score >= high_threshold:
        label = "High"
    elif total_score >= medium_threshold:
        label = "Medium"
    else:
        label = "Low"

    top_drivers = sorted(breakdown, key=lambda x: x["points"] / x["max_points"], reverse=True)[:2]
    driver_str = " and ".join(f"{d['factor']} ({d['points']}/{d['max_points']})" for d in top_drivers)

    return {
        "priority_score": total_score,
        "priority_label": label,
        "urgency_level": urgency_level,
        "score_breakdown": breakdown,
        "score_explanation": f"Scored {total_score}/100 ({label} Priority) under deterministic rules. Primary drivers: {driver_str}.",
    }
