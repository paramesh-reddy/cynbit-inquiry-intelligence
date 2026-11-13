import json
import sys
import unittest
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(ROOT_DIR))

# Import pure Python modules directly so tests execute cleanly without external FastAPI wheels
from backend.app.services.ai_classifier import classify_deterministically  # noqa: E402
from backend.app.services.knowledge_retriever import KnowledgeRetriever  # noqa: E402
from backend.app.services.lead_scorer import score_lead_deterministically  # noqa: E402
from backend.app.services.inquiry_processor import PreprocessedInquiry  # noqa: E402
from backend.app.services.requirement_extractor import extract_requirements_deterministically  # noqa: E402
from backend.app.services.email_generator import build_email_draft  # noqa: E402


class TestCynbitPythonPipeline(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.kb = KnowledgeRetriever(ROOT_DIR / "sample_data" / "cynbit_knowledge_base.json")

    def test_kb_retrieval_matches_voice_agent(self) -> None:
        matches = self.kb.retrieve("bilingual AI voice agent for inbound clinic phone calls and CRM booking", top_k=3)
        self.assertEqual(len(matches), 3)
        self.assertEqual(matches[0]["id"], "kb-ai-voice")
        self.assertGreater(matches[0]["similarity_score"], 0.2)

    def test_classification_and_scoring_high_priority(self) -> None:
        text = (
            "We handle 600 inbound calls daily across 14 diagnostic centers and urgently need "
            "an AI voice agent integrated with CRM and WhatsApp within 4 weeks."
        )
        kb_matches = self.kb.retrieve(text, top_k=3)
        primary, _sec, conf = classify_deterministically(text, kb_matches)
        self.assertEqual(primary, "AI/ML")
        self.assertGreaterEqual(conf, 0.55)

        pre = PreprocessedInquiry(
            client_name="Arjun Mehta",
            client_email="arjun@medibridge.in",
            company="MediBridge Diagnostics",
            industry="Healthcare",
            budget_range="$20,000 - $35,000",
            timeline="Urgent (Within 4 weeks)",
            project_description=text,
            normalized_text=text,
            word_count=26,
            extracted_integrations=["CRM", "WhatsApp"],
            extracted_metrics=["600 inbound calls", "14 diagnostic centers"],
            urgency_signals=["urgent"],
            estimated_budget_usd=27500,
            timeline_weeks=4,
            has_corporate_email=True,
        )
        score = score_lead_deterministically(pre, kb_matches)
        self.assertEqual(score["priority_label"], "High")
        self.assertGreaterEqual(score["priority_score"], 70)
        self.assertEqual(len(score["score_breakdown"]), 5)

        reqs = extract_requirements_deterministically(pre, primary, self.kb.items[1], score["urgency_level"])
        self.assertTrue(len(reqs["expected_features"]) >= 2)

        email = build_email_draft(pre, primary, kb_matches[0]["title"], reqs["expected_features"][0])
        self.assertIn("MediBridge Diagnostics", email["subject"])
        self.assertIn("Arjun Mehta", email["body"])

    def test_sample_inquiries_schema_integrity(self) -> None:
        with open(ROOT_DIR / "sample_data" / "sample_inquiries.json", "r", encoding="utf-8") as f:
            samples = json.load(f)
        self.assertGreaterEqual(len(samples), 6)
        for item in samples:
            self.assertIn("client_name", item)
            self.assertIn("project_description", item)
            self.assertGreaterEqual(len(item["project_description"]), 20)


if __name__ == "__main__":
    unittest.main()
