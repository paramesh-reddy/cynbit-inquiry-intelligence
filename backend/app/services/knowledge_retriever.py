import json
import math
import re
from pathlib import Path
from typing import Dict, List, Tuple
from ..config import settings

STOP_WORDS = {
    "the", "and", "for", "with", "that", "this", "from", "into", "your", "our",
    "are", "was", "were", "will", "have", "has", "can", "need", "want", "using",
    "build", "system", "platform", "solution", "solutions", "across", "over",
}


def tokenize(text: str) -> List[str]:
    cleaned = re.sub(r"[^a-z0-9\s]", " ", text.lower())
    return [t for t in cleaned.split() if len(t) > 2 and t not in STOP_WORDS]


class KnowledgeRetriever:
    def __init__(self, kb_path: Path = settings.KB_PATH):
        self.kb_path = kb_path
        self.items: List[dict] = []
        self.idf: Dict[str, float] = {}
        self.doc_vectors: Dict[str, Dict[str, float]] = {}
        self.load()

    def load(self) -> None:
        with open(self.kb_path, "r", encoding="utf-8") as f:
            self.items = json.load(f)
        self._build_index()

    def _build_index(self) -> None:
        doc_tokens: Dict[str, List[str]] = {}
        doc_freq: Dict[str, int] = {}

        for item in self.items:
            combined = " ".join([
                item["title"],
                item["title"],
                item["service_category"],
                item["summary"],
                " ".join(item.get("capabilities", [])),
                " ".join(item.get("typical_stack", [])),
                item.get("ideal_for", ""),
            ])
            tokens = tokenize(combined)
            doc_tokens[item["id"]] = tokens
            for term in set(tokens):
                doc_freq[term] = doc_freq.get(term, 0) + 1

        total_docs = len(self.items) or 1
        self.idf = {
            term: math.log((total_docs + 1) / (df + 1)) + 1.0
            for term, df in doc_freq.items()
        }
        self.doc_vectors = {
            item["id"]: self._tf_idf(doc_tokens[item["id"]]) for item in self.items
        }

    def _tf_idf(self, tokens: List[str]) -> Dict[str, float]:
        counts: Dict[str, int] = {}
        for t in tokens:
            counts[t] = counts.get(t, 0) + 1
        length = len(tokens) or 1
        return {
            term: (cnt / length) * self.idf.get(term, 1.0)
            for term, cnt in counts.items()
        }

    @staticmethod
    def _cosine(vec_a: Dict[str, float], vec_b: Dict[str, float]) -> Tuple[float, List[str]]:
        dot = 0.0
        mag_a = 0.0
        mag_b = 0.0
        matched: List[str] = []
        for term, val_a in vec_a.items():
            mag_a += val_a * val_a
            if term in vec_b:
                dot += val_a * vec_b[term]
                matched.append(term)
        for val_b in vec_b.values():
            mag_b += val_b * val_b
        if mag_a == 0 or mag_b == 0:
            return 0.0, []
        return dot / (math.sqrt(mag_a) * math.sqrt(mag_b)), list(dict.fromkeys(matched))[:6]

    def retrieve(self, query_text: str, top_k: int = 3) -> List[dict]:
        query_vec = self._tf_idf(tokenize(query_text))
        scored = []
        for item in self.items:
            sim, terms = self._cosine(query_vec, self.doc_vectors.get(item["id"], {}))
            scored.append({
                "id": item["id"],
                "title": item["title"],
                "service_category": item["service_category"],
                "offering_type": item["offering_type"],
                "source_url": item["source_url"],
                "similarity_score": round(min(0.99, sim * 1.45), 2),
                "matched_terms": terms,
                "summary": item["summary"],
            })
        scored.sort(key=lambda x: x["similarity_score"], reverse=True)
        return scored[:top_k]


knowledge_retriever = KnowledgeRetriever()
