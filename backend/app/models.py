from datetime import datetime, timezone
from sqlalchemy import Column, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship
from .database import Base


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class Inquiry(Base):
    __tablename__ = "inquiries"

    id = Column(Integer, primary_key=True, index=True)
    client_name = Column(String(120), nullable=False)
    client_email = Column(String(180), nullable=False, index=True)
    company = Column(String(160), nullable=False, index=True)
    industry = Column(String(120), nullable=False)
    budget_range = Column(String(120), nullable=False)
    timeline = Column(String(120), nullable=False)
    project_description = Column(Text, nullable=False)
    status = Column(String(40), nullable=False, default="proposal_ready")
    processing_mode = Column(String(50), nullable=False)
    llm_provider = Column(String(120), nullable=False)
    created_at = Column(String(64), nullable=False, default=utc_now_iso)
    updated_at = Column(String(64), nullable=False, default=utc_now_iso)

    analysis = relationship("InquiryAnalysis", back_populates="inquiry", uselist=False, cascade="all, delete-orphan")
    proposal = relationship("Proposal", back_populates="inquiry", uselist=False, cascade="all, delete-orphan")
    email_draft = relationship("EmailDraft", back_populates="inquiry", uselist=False, cascade="all, delete-orphan")


class InquiryAnalysis(Base):
    __tablename__ = "inquiry_analyses"

    id = Column(Integer, primary_key=True, index=True)
    inquiry_id = Column(Integer, ForeignKey("inquiries.id", ondelete="CASCADE"), unique=True, nullable=False)
    service_category = Column(String(80), nullable=False, index=True)
    secondary_category = Column(String(80), nullable=True)
    confidence_score = Column(Float, nullable=False)
    client_problem = Column(Text, nullable=False)
    business_objectives_json = Column(Text, nullable=False)
    expected_features_json = Column(Text, nullable=False)
    technical_requirements_json = Column(Text, nullable=False)
    urgency_level = Column(String(30), nullable=False)
    priority_label = Column(String(30), nullable=False, index=True)
    priority_score = Column(Integer, nullable=False)
    score_breakdown_json = Column(Text, nullable=False)
    score_explanation = Column(Text, nullable=False)
    recommended_cynbit_service = Column(String(180), nullable=False)
    matched_kb_items_json = Column(Text, nullable=False)
    solution_architecture_json = Column(Text, nullable=False)
    processing_notes = Column(Text, nullable=False)

    inquiry = relationship("Inquiry", back_populates="analysis")


class Proposal(Base):
    __tablename__ = "proposals"

    id = Column(Integer, primary_key=True, index=True)
    inquiry_id = Column(Integer, ForeignKey("inquiries.id", ondelete="CASCADE"), unique=True, nullable=False)
    title = Column(String(240), nullable=False)
    problem_statement = Column(Text, nullable=False)
    proposed_solution = Column(Text, nullable=False)
    recommended_technologies_json = Column(Text, nullable=False)
    implementation_phases_json = Column(Text, nullable=False)
    estimated_complexity = Column(String(30), nullable=False)
    estimated_timeline = Column(String(120), nullable=False)
    preliminary_disclaimer = Column(Text, nullable=False)
    created_at = Column(String(64), nullable=False, default=utc_now_iso)
    updated_at = Column(String(64), nullable=False, default=utc_now_iso)

    inquiry = relationship("Inquiry", back_populates="proposal")


class EmailDraft(Base):
    __tablename__ = "email_drafts"

    id = Column(Integer, primary_key=True, index=True)
    inquiry_id = Column(Integer, ForeignKey("inquiries.id", ondelete="CASCADE"), unique=True, nullable=False)
    recipient_email = Column(String(180), nullable=False)
    recipient_name = Column(String(120), nullable=False)
    subject = Column(String(240), nullable=False)
    body = Column(Text, nullable=False)
    approval_status = Column(String(40), nullable=False, default="pending_review")
    reviewer_notes = Column(Text, nullable=False, default="")
    approved_by = Column(String(120), nullable=True)
    approved_at = Column(String(64), nullable=True)
    updated_at = Column(String(64), nullable=False, default=utc_now_iso)

    inquiry = relationship("Inquiry", back_populates="email_draft")


class AppSetting(Base):
    __tablename__ = "app_settings"

    key = Column(String(80), primary_key=True)
    value = Column(Text, nullable=False)
