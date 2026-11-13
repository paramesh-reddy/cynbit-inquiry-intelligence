import fs from 'node:fs';
import { config, isOpenAIConfigured } from '../config.ts';
import {
  getDb,
  getInquiryById,
  getSettings,
  insertProcessedInquiry,
  replaceInquiryAnalysis,
  updateEmailDraft,
} from '../db.ts';
import type { InquiryInput, InquiryRecord } from '../types.ts';
import { runAIPipeline } from './aiPipeline.ts';
import { knowledgeRetriever } from './knowledgeRetriever.ts';
import { scoreLeadDeterministically } from './leadScorer.ts';
import { preprocessInquiry, validateInquiryInput } from './preprocessor.ts';

export async function processNewInquiry(rawInput: Partial<InquiryInput>): Promise<{
  ok: boolean;
  errors?: string[];
  inquiry?: InquiryRecord;
}> {
  const validation = validateInquiryInput(rawInput);
  if (!validation.valid || !validation.sanitized) {
    return { ok: false, errors: validation.errors };
  }

  const sanitized = validation.sanitized;
  const preprocessed = preprocessInquiry(sanitized);
  const settings = getSettings();

  const kbMatches = knowledgeRetriever.retrieve(
    `${preprocessed.industry} ${preprocessed.normalized_text}`,
    3
  );

  const leadScore = scoreLeadDeterministically(
    preprocessed,
    kbMatches,
    settings.high_priority_threshold,
    settings.medium_priority_threshold
  );

  const aiOutput = await runAIPipeline(
    preprocessed,
    kbMatches,
    knowledgeRetriever.getAllItems(),
    leadScore,
    settings
  );

  const record = insertProcessedInquiry(sanitized, aiOutput, leadScore, kbMatches);
  return { ok: true, inquiry: record };
}

export async function reanalyzeExistingInquiry(inquiryId: number): Promise<InquiryRecord | null> {
  const existing = getInquiryById(inquiryId);
  if (!existing) return null;

  const input: InquiryInput = {
    client_name: existing.client_name,
    client_email: existing.client_email,
    company: existing.company,
    industry: existing.industry,
    budget_range: existing.budget_range,
    timeline: existing.timeline,
    project_description: existing.project_description,
  };

  const preprocessed = preprocessInquiry(input);
  const settings = getSettings();
  const kbMatches = knowledgeRetriever.retrieve(
    `${preprocessed.industry} ${preprocessed.normalized_text}`,
    3
  );
  const leadScore = scoreLeadDeterministically(
    preprocessed,
    kbMatches,
    settings.high_priority_threshold,
    settings.medium_priority_threshold
  );
  const aiOutput = await runAIPipeline(
    preprocessed,
    kbMatches,
    knowledgeRetriever.getAllItems(),
    leadScore,
    settings
  );

  return replaceInquiryAnalysis(inquiryId, aiOutput, leadScore, kbMatches);
}

export async function seedDatabaseIfEmpty(): Promise<void> {
  const db = getDb();
  const row = db.prepare('SELECT COUNT(*) as count FROM inquiries').get() as { count: number };
  if (row.count > 0) return;

  if (!fs.existsSync(config.sampleInquiriesPath)) return;
  const raw = fs.readFileSync(config.sampleInquiriesPath, 'utf-8');
  const samples = JSON.parse(raw) as InquiryInput[];

  // Seed sequentially in reverse so most urgent samples appear smoothly in recent list
  for (let i = samples.length - 1; i >= 0; i--) {
    const result = await processNewInquiry(samples[i]);
    // Approve two sample responses so dashboard shows realistic pending + approved state
    if (result.ok && result.inquiry && (i === 1 || i === 4)) {
      updateEmailDraft(result.inquiry.id, {
        approval_status: 'approved',
        reviewer_notes: 'Reviewed technical scope and approved for BDM outreach.',
      });
    }
  }
}

export function getActiveProcessingMode(): 'openai_llm' | 'deterministic_fallback' {
  const settings = getSettings();
  if (settings.preferred_ai_mode === 'deterministic' || !isOpenAIConfigured()) {
    return 'deterministic_fallback';
  }
  return 'openai_llm';
}
