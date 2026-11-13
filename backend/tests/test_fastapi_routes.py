import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.app.database import Base, get_db
from backend.app.main import app

TEST_DB_URL = "sqlite:///./test_fastapi_suite.db"
engine = create_engine(TEST_DB_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db


@pytest.fixture(autouse=True)
def setup_db():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


client = TestClient(app)


def test_health_and_validation_error():
    res = client.get("/api/health")
    assert res.status_code == 200
    assert res.json()["status"] == "ok"

    bad = client.post("/api/inquiries", json={"client_name": "A", "client_email": "bad"})
    assert bad.status_code == 422


def test_full_inquiry_lifecycle():
    create_res = client.post(
        "/api/inquiries",
        json={
            "client_name": "Priya Nair",
            "client_email": "priya@nexprop.com",
            "company": "NexProp Ventures",
            "industry": "Real Estate / PropTech",
            "budget_range": "$25,000 - $50,000",
            "timeline": "1 - 3 months",
            "project_description": "We manage 1,200 rental units and need a custom TenantEase-like portal with Razorpay rent invoicing and maintenance ticketing.",
        },
    )
    assert create_res.status_code == 201
    data = create_res.json()
    assert data["analysis"]["service_category"] == "Full-Stack Development"
    assert data["email_draft"]["approval_status"] == "pending_review"

    approve_res = client.patch(
        f"/api/inquiries/{data['id']}/email",
        json={"approval_status": "approved", "reviewer_notes": "Ready for BDM send."},
    )
    assert approve_res.status_code == 200
    assert approve_res.json()["email_draft"]["approval_status"] == "approved"
