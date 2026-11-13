import fs from 'node:fs';
import { config } from '../config.ts';
import type { KnowledgeItem, KnowledgeMatch } from '../types.ts';

const STOP_WORDS = new Set([
  'the', 'and', 'for', 'with', 'that', 'this', 'from', 'into', 'your', 'our',
  'are', 'was', 'were', 'will', 'have', 'has', 'can', 'need', 'want', 'using',
  'build', 'system', 'platform', 'solution', 'solutions', 'across', 'over',
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 2 && !STOP_WORDS.has(token));
}

export class KnowledgeRetriever {
  private items: KnowledgeItem[] = [];
  private docTokens: Map<string, string[]> = new Map();
  private idf: Map<string, number> = new Map();
  private docVectors: Map<string, Map<string, number>> = new Map();

  constructor() {
    this.loadKnowledgeBase();
  }

  public loadKnowledgeBase(): void {
    const raw = fs.readFileSync(config.kbPath, 'utf-8');
    this.items = JSON.parse(raw) as KnowledgeItem[];
    this.buildIndex();
  }

  public getAllItems(): KnowledgeItem[] {
    return this.items;
  }

  private buildIndex(): void {
    this.docTokens.clear();
    this.idf.clear();
    this.docVectors.clear();

    const docFreq = new Map<string, number>();

    for (const item of this.items) {
      const combined = [
        item.title,
        item.title, // boost title weight
        item.service_category,
        item.summary,
        item.capabilities.join(' '),
        item.typical_stack.join(' '),
        item.ideal_for,
      ].join(' ');

      const tokens = tokenize(combined);
      this.docTokens.set(item.id, tokens);

      const uniqueTerms = new Set(tokens);
      for (const term of uniqueTerms) {
        docFreq.set(term, (docFreq.get(term) || 0) + 1);
      }
    }

    const totalDocs = this.items.length || 1;
    for (const [term, df] of docFreq.entries()) {
      this.idf.set(term, Math.log((totalDocs + 1) / (df + 1)) + 1);
    }

    for (const item of this.items) {
      const tokens = this.docTokens.get(item.id) || [];
      this.docVectors.set(item.id, this.computeTfIdfVector(tokens));
    }
  }

  private computeTfIdfVector(tokens: string[]): Map<string, number> {
    const tf = new Map<string, number>();
    for (const token of tokens) {
      tf.set(token, (tf.get(token) || 0) + 1);
    }
    const vec = new Map<string, number>();
    const len = tokens.length || 1;
    for (const [term, count] of tf.entries()) {
      const idfVal = this.idf.get(term) || 1.0;
      vec.set(term, (count / len) * idfVal);
    }
    return vec;
  }

  private cosineSimilarity(vecA: Map<string, number>, vecB: Map<string, number>): {
    score: number;
    matchedTerms: string[];
  } {
    let dot = 0;
    let magA = 0;
    let magB = 0;
    const matchedTerms: string[] = [];

    for (const [term, valA] of vecA.entries()) {
      magA += valA * valA;
      const valB = vecB.get(term);
      if (valB !== undefined) {
        dot += valA * valB;
        matchedTerms.push(term);
      }
    }
    for (const valB of vecB.values()) {
      magB += valB * valB;
    }

    if (magA === 0 || magB === 0) {
      return { score: 0, matchedTerms: [] };
    }

    return {
      score: dot / (Math.sqrt(magA) * Math.sqrt(magB)),
      matchedTerms: Array.from(new Set(matchedTerms)).slice(0, 6),
    };
  }

  public retrieve(queryText: string, topK = 3): KnowledgeMatch[] {
    const queryTokens = tokenize(queryText);
    const queryVec = this.computeTfIdfVector(queryTokens);

    const scored: KnowledgeMatch[] = this.items.map((item) => {
      const docVec = this.docVectors.get(item.id) || new Map<string, number>();
      const { score, matchedTerms } = this.cosineSimilarity(queryVec, docVec);
      return {
        id: item.id,
        title: item.title,
        service_category: item.service_category,
        offering_type: item.offering_type,
        source_url: item.source_url,
        similarity_score: Number(Math.min(0.99, score * 1.45).toFixed(2)),
        matched_terms: matchedTerms,
        summary: item.summary,
      };
    });

    return scored
      .sort((a, b) => b.similarity_score - a.similarity_score)
      .slice(0, topK);
  }
}

export const knowledgeRetriever = new KnowledgeRetriever();
