import csv
import io
import json
from typing import Optional
from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from .config import settings
from .database import Base, engine, get_db, SessionLocal
from .models import Inquiry, utc_now_iso
from .schemas import (
    ClassificationOverride,
    EmailDraftUpdate,
    InquiryCreate,
    ProposalUpdate,
    QuickParseRequest,
)
from .services.crud import create_and_process_inquiry, list_inquiries_filtered, serialize_inquiry
from .services.inquiry_processor import parse_raw_inquiry_text
from .services.knowledge_retriever import knowledge_retriever

Base.metadata.create_all(bind=engine)

app = FastAPI(title=settings.PROJECT_NAME, version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def seed_on_startup() -> None:
    db = SessionLocal()
    try:
        if db.query(Inquiry).count() == 0 and settings.SAMPLE_INQUIRIES_PATH.exists():
            with open(settings.SAMPLE_INQUIRIES_PATH, "r", encoding="utf-8") as f:
                samples = json.load(f)
            for item in reversed(samples):
                create_and_process_inquiry(db, InquiryCreate(**item))
    finally:
        db.close()


@app.get("/api/health")
def health():
    return {
        "status": "ok",
        "openai_configured": settings.openai_configured,
        "openai_model": settings.OPENAI_MODEL,
        "active_processing_mode": "openai_llm" if settings.openai_configured else "deterministic_fallback",
    }


@app.get("/api/dashboard/metrics")
def dashboard_metrics(db: Session = Depends(get_db)):
    all_items = list_inquiries_filtered(db)
    total = len(all_items)
    high = sum(1 for i in all_items if i["analysis"] and i["analysis"]["priority_label"] == "High")
    med = sum(1 for i in all_items if i["analysis"] and i["analysis"]["priority_label"] == "Medium")
    low = sum(1 for i in all_items if i["analysis"] and i["analysis"]["priority_label"] == "Low")
    approved = sum(1 for i in all_items if i["email_draft"] and i["email_draft"]["approval_status"] == "approved")
    pending = total - approved
    avg_score = round(sum(i["analysis"]["priority_score"] for i in all_items if i["analysis"]) / total) if total else 0

    cat_counts = {}
    for i in all_items:
        cat = i["analysis"]["service_category"] if i["analysis"] else "Other"
        cat_counts[cat] = cat_counts.get(cat, 0) + 1

    cat_dist = [
        {"category": c, "count": cnt, "percentage": round((cnt / total) * 100) if total else 0}
        for c, cnt in sorted(cat_counts.items(), key=lambda x: x[1], reverse=True)
    ]

    return {
        "total_inquiries": total,
        "high_priority_count": high,
        "medium_priority_count": med,
        "low_priority_count": low,
        "pending_approvals_count": pending,
        "approved_responses_count": approved,
        "average_priority_score": avg_score,
        "category_distribution": cat_dist,
        "recent_inquiries": all_items[:6],
        "active_processing_mode": "openai_llm" if settings.openai_configured else "deterministic_fallback",
        "openai_configured": settings.openai_configured,
    }


@app.get("/api/inquiries")
def list_inquiries(
    q: Optional[str] = Query(default=None),
    priority: Optional[str] = Query(default=None),
    category: Optional[str] = Query(default=None),
    approval: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
):
    items = list_inquiries_filtered(db, q=q, priority=priority, category=category, approval=approval)
    return {"items": items, "total": len(items)}


@app.post("/api/inquiries", status_code=201)
def create_inquiry(payload: InquiryCreate, db: Session = Depends(get_db)):
    inquiry = create_and_process_inquiry(db, payload)
    return serialize_inquiry(inquiry)


@app.post("/api/inquiries/quick-parse", status_code=201)
def quick_parse_inquiry(payload: QuickParseRequest, db: Session = Depends(get_db)):
    parsed = InquiryCreate(**parse_raw_inquiry_text(payload.raw_text))
    if payload.preview_only:
        return {"parsed": parsed.model_dump()}
    inquiry = create_and_process_inquiry(db, parsed)
    return serialize_inquiry(inquiry)


@app.get("/api/inquiries/{inquiry_id}")
def get_inquiry(inquiry_id: int, db: Session = Depends(get_db)):
    inquiry = db.query(Inquiry).filter(Inquiry.id == inquiry_id).first()
    if not inquiry:
        raise HTTPException(status_code=404, detail="Inquiry not found")
    return serialize_inquiry(inquiry)


@app.patch("/api/inquiries/{inquiry_id}/classification")
def override_classification(inquiry_id: int, payload: ClassificationOverride, db: Session = Depends(get_db)):
    inquiry = db.query(Inquiry).filter(Inquiry.id == inquiry_id).first()
    if not inquiry or not inquiry.analysis:
        raise HTTPException(status_code=404, detail="Inquiry not found")
    if payload.service_category:
        inquiry.analysis.service_category = payload.service_category
    if payload.priority_label:
        inquiry.analysis.priority_label = payload.priority_label
    inquiry.updated_at = utc_now_iso()
    db.commit()
    db.refresh(inquiry)
    return serialize_inquiry(inquiry)


@app.patch("/api/inquiries/{inquiry_id}/proposal")
def update_proposal(inquiry_id: int, payload: ProposalUpdate, db: Session = Depends(get_db)):
    inquiry = db.query(Inquiry).filter(Inquiry.id == inquiry_id).first()
    if not inquiry or not inquiry.proposal:
        raise HTTPException(status_code=404, detail="Proposal not found")
    for field, val in payload.model_dump(exclude_none=True).items():
        setattr(inquiry.proposal, field, val)
    inquiry.proposal.updated_at = utc_now_iso()
    db.commit()
    db.refresh(inquiry)
    return serialize_inquiry(inquiry)


@app.patch("/api/inquiries/{inquiry_id}/email")
def update_email(inquiry_id: int, payload: EmailDraftUpdate, db: Session = Depends(get_db)):
    inquiry = db.query(Inquiry).filter(Inquiry.id == inquiry_id).first()
    if not inquiry or not inquiry.email_draft:
        raise HTTPException(status_code=404, detail="Email draft not found")
    for field, val in payload.model_dump(exclude_none=True).items():
        setattr(inquiry.email_draft, field, val)
    if payload.approval_status == "approved":
        inquiry.email_draft.approved_at = utc_now_iso()
        inquiry.email_draft.approved_by = payload.approved_by or "BDM Reviewer"
        inquiry.status = "approved"
    inquiry.email_draft.updated_at = utc_now_iso()
    db.commit()
    db.refresh(inquiry)
    return serialize_inquiry(inquiry)


@app.delete("/api/inquiries/{inquiry_id}")
def delete_inquiry(inquiry_id: int, db: Session = Depends(get_db)):
    inquiry = db.query(Inquiry).filter(Inquiry.id == inquiry_id).first()
    if not inquiry:
        raise HTTPException(status_code=404, detail="Inquiry not found")
    db.delete(inquiry)
    db.commit()
    return {"deleted": True, "id": inquiry_id}


@app.get("/api/inquiries/{inquiry_id}/export/csv")
def export_inquiry_csv(inquiry_id: int, db: Session = Depends(get_db)):
    inquiry = db.query(Inquiry).filter(Inquiry.id == inquiry_id).first()
    if not inquiry:
        raise HTTPException(status_code=404, detail="Inquiry not found")
    data = serialize_inquiry(inquiry)
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["ID", "Client", "Company", "Category", "Priority", "Score", "Mode"])
    writer.writerow([
        data["id"],
        data["client_name"],
        data["company"],
        data["analysis"]["service_category"] if data["analysis"] else "",
        data["analysis"]["priority_label"] if data["analysis"] else "",
        data["analysis"]["priority_score"] if data["analysis"] else "",
        data["processing_mode"],
    ])
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="cynbit-inquiry-{inquiry_id}.csv"'},
    )


@app.get("/api/knowledge-base")
def get_kb(q: Optional[str] = Query(default=None)):
    matches = knowledge_retriever.retrieve(q, top_k=5) if q else []
    return {"items": knowledge_retriever.items, "matches": matches, "query": q or ""}
