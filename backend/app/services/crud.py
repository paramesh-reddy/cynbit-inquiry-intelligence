import json
from typing import List, Optional
from sqlalchemy.orm import Session
from ..models import EmailDraft, Inquiry, InquiryAnalysis, Proposal, utc_now_iso
from ..schemas import InquiryCreate
from .email_generator import build_email_draft
from .inquiry_processor import preprocess_inquiry
from .knowledge_retriever import knowledge_retriever
from .lead_scorer import score_lead_deterministically
from .proposal_generator import generate_proposal_and_analysis


def create_and_process_inquiry(db: Session, payload: InquiryCreate, force_deterministic: bool = False) -> Inquiry:
    preprocessed = preprocess_inquiry(payload)
    kb_matches = knowledge_retriever.retrieve(f"{preprocessed.industry} {preprocessed.normalized_text}", top_k=3)
    lead_score = score_lead_deterministically(preprocessed, kb_matches)
    output = generate_proposal_and_analysis(
        preprocessed,
        kb_matches,
        knowledge_retriever.items,
        lead_score,
        force_deterministic=force_deterministic,
    )
    email_data = output.get("email_draft") or build_email_draft(
        preprocessed,
        output["service_category"],
        output["recommended_cynbit_service"],
        output["expected_features"][0] if output["expected_features"] else "workflow automation",
    )

    now = utc_now_iso()
    inquiry = Inquiry(
        client_name=preprocessed.client_name,
        client_email=preprocessed.client_email,
        company=preprocessed.company,
        industry=preprocessed.industry,
        budget_range=preprocessed.budget_range,
        timeline=preprocessed.timeline,
        project_description=preprocessed.project_description,
        status="proposal_ready",
        processing_mode=output["processing_mode"],
        llm_provider=output["llm_provider"],
        created_at=now,
        updated_at=now,
    )
    db.add(inquiry)
    db.flush()

    analysis = InquiryAnalysis(
        inquiry_id=inquiry.id,
        service_category=output["service_category"],
        secondary_category=output.get("secondary_category"),
        confidence_score=output["confidence_score"],
        client_problem=output["client_problem"],
        business_objectives_json=json.dumps(output["business_objectives"]),
        expected_features_json=json.dumps(output["expected_features"]),
        technical_requirements_json=json.dumps(output["technical_requirements"]),
        urgency_level=lead_score["urgency_level"],
        priority_label=lead_score["priority_label"],
        priority_score=lead_score["priority_score"],
        score_breakdown_json=json.dumps(lead_score["score_breakdown"]),
        score_explanation=lead_score["score_explanation"],
        recommended_cynbit_service=output["recommended_cynbit_service"],
        matched_kb_items_json=json.dumps(kb_matches),
        solution_architecture_json=json.dumps(output["solution_architecture"]),
        processing_notes=output["processing_notes"],
    )
    db.add(analysis)

    prop_data = output["proposal"]
    proposal = Proposal(
        inquiry_id=inquiry.id,
        title=prop_data["title"],
        problem_statement=prop_data["problem_statement"],
        proposed_solution=prop_data["proposed_solution"],
        recommended_technologies_json=json.dumps(prop_data["recommended_technologies"]),
        implementation_phases_json=json.dumps(prop_data["implementation_phases"]),
        estimated_complexity=prop_data["estimated_complexity"],
        estimated_timeline=prop_data["estimated_timeline"],
        preliminary_disclaimer=prop_data["preliminary_disclaimer"],
        created_at=now,
        updated_at=now,
    )
    db.add(proposal)

    draft = EmailDraft(
        inquiry_id=inquiry.id,
        recipient_email=preprocessed.client_email,
        recipient_name=preprocessed.client_name,
        subject=email_data["subject"],
        body=email_data["body"],
        approval_status="pending_review",
        reviewer_notes="",
        updated_at=now,
    )
    db.add(draft)
    db.commit()
    db.refresh(inquiry)
    return inquiry


def serialize_inquiry(inquiry: Inquiry) -> dict:
    a = inquiry.analysis
    p = inquiry.proposal
    e = inquiry.email_draft
    return {
        "id": inquiry.id,
        "client_name": inquiry.client_name,
        "client_email": inquiry.client_email,
        "company": inquiry.company,
        "industry": inquiry.industry,
        "budget_range": inquiry.budget_range,
        "timeline": inquiry.timeline,
        "project_description": inquiry.project_description,
        "status": inquiry.status,
        "processing_mode": inquiry.processing_mode,
        "llm_provider": inquiry.llm_provider,
        "created_at": inquiry.created_at,
        "updated_at": inquiry.updated_at,
        "analysis": {
            "inquiry_id": a.inquiry_id,
            "service_category": a.service_category,
            "secondary_category": a.secondary_category,
            "confidence_score": a.confidence_score,
            "client_problem": a.client_problem,
            "business_objectives": json.loads(a.business_objectives_json),
            "expected_features": json.loads(a.expected_features_json),
            "technical_requirements": json.loads(a.technical_requirements_json),
            "urgency_level": a.urgency_level,
            "priority_label": a.priority_label,
            "priority_score": a.priority_score,
            "score_breakdown": json.loads(a.score_breakdown_json),
            "score_explanation": a.score_explanation,
            "recommended_cynbit_service": a.recommended_cynbit_service,
            "matched_kb_items": json.loads(a.matched_kb_items_json),
            "solution_architecture": json.loads(a.solution_architecture_json),
            "processing_notes": a.processing_notes,
        } if a else None,
        "proposal": {
            "id": p.id,
            "inquiry_id": p.inquiry_id,
            "title": p.title,
            "problem_statement": p.problem_statement,
            "proposed_solution": p.proposed_solution,
            "recommended_technologies": json.loads(p.recommended_technologies_json),
            "implementation_phases": json.loads(p.implementation_phases_json),
            "estimated_complexity": p.estimated_complexity,
            "estimated_timeline": p.estimated_timeline,
            "preliminary_disclaimer": p.preliminary_disclaimer,
            "created_at": p.created_at,
            "updated_at": p.updated_at,
        } if p else None,
        "email_draft": {
            "id": e.id,
            "inquiry_id": e.inquiry_id,
            "recipient_email": e.recipient_email,
            "recipient_name": e.recipient_name,
            "subject": e.subject,
            "body": e.body,
            "approval_status": e.approval_status,
            "reviewer_notes": e.reviewer_notes,
            "approved_by": e.approved_by,
            "approved_at": e.approved_at,
            "updated_at": e.updated_at,
        } if e else None,
    }


def list_inquiries_filtered(
    db: Session,
    q: Optional[str] = None,
    priority: Optional[str] = None,
    category: Optional[str] = None,
    approval: Optional[str] = None,
) -> List[dict]:
    rows = db.query(Inquiry).order_by(Inquiry.id.desc()).all()
    results = [serialize_inquiry(r) for r in rows]
    if q:
        ql = q.lower()
        results = [
            r for r in results
            if ql in r["client_name"].lower()
            or ql in r["company"].lower()
            or ql in r["project_description"].lower()
        ]
    if priority and priority != "All":
        results = [r for r in results if r["analysis"] and r["analysis"]["priority_label"] == priority]
    if category and category != "All":
        results = [r for r in results if r["analysis"] and r["analysis"]["service_category"] == category]
    if approval and approval != "All":
        results = [r for r in results if r["email_draft"] and r["email_draft"]["approval_status"] == approval]
    return results
