from typing import List, Literal, Optional
from pydantic import BaseModel, Field, field_validator
import re

ServiceCategory = Literal[
    "AI/ML",
    "AI Automation",
    "Full-Stack Development",
    "CRM Automation",
    "Cloud Infrastructure",
    "Digital Marketing",
    "Other",
]

PriorityLevel = Literal["High", "Medium", "Low"]
ApprovalStatus = Literal["pending_review", "approved", "needs_revision"]


class InquiryCreate(BaseModel):
    client_name: str = Field(..., min_length=2, max_length=120)
    client_email: str = Field(..., min_length=5, max_length=180)
    company: str = Field(..., min_length=2, max_length=160)
    industry: str = Field(default="Technology", min_length=2, max_length=120)
    budget_range: str = Field(default="Undisclosed / Exploring", max_length=120)
    timeline: str = Field(default="Flexible (Exploratory)", max_length=120)
    project_description: str = Field(..., min_length=20, max_length=6000)

    @field_validator("client_email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        cleaned = value.strip()
        if not re.match(r"^[^\s@]+@[^\s@]+\.[^\s@]+$", cleaned):
            raise ValueError("Invalid client email address")
        return cleaned


class QuickParseRequest(BaseModel):
    raw_text: str = Field(..., min_length=20, max_length=8000)
    preview_only: bool = False


class ClassificationOverride(BaseModel):
    service_category: Optional[ServiceCategory] = None
    priority_label: Optional[PriorityLevel] = None


class ProposalUpdate(BaseModel):
    title: Optional[str] = None
    problem_statement: Optional[str] = None
    proposed_solution: Optional[str] = None
    estimated_complexity: Optional[Literal["Low", "Medium", "High"]] = None
    estimated_timeline: Optional[str] = None


class EmailDraftUpdate(BaseModel):
    subject: Optional[str] = None
    body: Optional[str] = None
    approval_status: Optional[ApprovalStatus] = None
    reviewer_notes: Optional[str] = None
    approved_by: Optional[str] = None


class ScoreFactorSchema(BaseModel):
    factor: str
    points: int
    max_points: int
    reason: str


class SettingsUpdate(BaseModel):
    reviewer_name: Optional[str] = None
    reviewer_role: Optional[str] = None
    company_signature: Optional[str] = None
    preferred_ai_mode: Optional[Literal["auto", "deterministic"]] = None
    high_priority_threshold: Optional[int] = Field(default=None, ge=50, le=95)
    medium_priority_threshold: Optional[int] = Field(default=None, ge=15, le=65)
