import fs from 'node:fs';
import path from 'node:path';
// @ts-ignore Node 22 built-in SQLite module
import { DatabaseSync } from 'node:sqlite';
import { config } from './config.ts';
import type {
  AppSettings,
  ApprovalStatus,
  DashboardMetrics,
  EmailDraft,
  InquiryAnalysis,
  InquiryInput,
  InquiryRecord,
  InquiryStatus,
  PriorityLevel,
  ProcessingMode,
  Proposal,
  ServiceCategory,
} from './types.ts';
import type { AIPipelineOutput } from './services/aiPipeline.ts';
import type { LeadScoreResult } from './services/leadScorer.ts';
import type { KnowledgeMatch } from './types.ts';

let dbInstance: DatabaseSync | null = null;

export const DEFAULT_SETTINGS: AppSettings = {
  reviewer_name: 'Ananya Verma',
  reviewer_role: 'Business Development & Solutions Lead',
  company_signature: 'Cynbit Technologies · Jaipur, India · cynbit.in',
  preferred_ai_mode: 'auto',
  high_priority_threshold: 70,
  medium_priority_threshold: 40,
};

export function getDb(): DatabaseSync {
  if (dbInstance) return dbInstance;

  const dbDir = path.dirname(config.dbPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  const db = new DatabaseSync(config.dbPath);
  db.exec(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS inquiries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_name TEXT NOT NULL,
      client_email TEXT NOT NULL,
      company TEXT NOT NULL,
      industry TEXT NOT NULL,
      budget_range TEXT NOT NULL,
      timeline TEXT NOT NULL,
      project_description TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'proposal_ready',
      processing_mode TEXT NOT NULL,
      llm_provider TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS inquiry_analyses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      inquiry_id INTEGER NOT NULL UNIQUE,
      service_category TEXT NOT NULL,
      secondary_category TEXT,
      confidence_score REAL NOT NULL,
      client_problem TEXT NOT NULL,
      business_objectives_json TEXT NOT NULL,
      expected_features_json TEXT NOT NULL,
      technical_requirements_json TEXT NOT NULL,
      urgency_level TEXT NOT NULL,
      priority_label TEXT NOT NULL,
      priority_score INTEGER NOT NULL,
      score_breakdown_json TEXT NOT NULL,
      score_explanation TEXT NOT NULL,
      recommended_cynbit_service TEXT NOT NULL,
      matched_kb_items_json TEXT NOT NULL,
      solution_architecture_json TEXT NOT NULL,
      processing_notes TEXT NOT NULL,
      FOREIGN KEY (inquiry_id) REFERENCES inquiries(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS proposals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      inquiry_id INTEGER NOT NULL UNIQUE,
      title TEXT NOT NULL,
      problem_statement TEXT NOT NULL,
      proposed_solution TEXT NOT NULL,
      recommended_technologies_json TEXT NOT NULL,
      implementation_phases_json TEXT NOT NULL,
      estimated_complexity TEXT NOT NULL,
      estimated_timeline TEXT NOT NULL,
      preliminary_disclaimer TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (inquiry_id) REFERENCES inquiries(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS email_drafts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      inquiry_id INTEGER NOT NULL UNIQUE,
      recipient_email TEXT NOT NULL,
      recipient_name TEXT NOT NULL,
      subject TEXT NOT NULL,
      body TEXT NOT NULL,
      approval_status TEXT NOT NULL DEFAULT 'pending_review',
      reviewer_notes TEXT NOT NULL DEFAULT '',
      approved_by TEXT,
      approved_at TEXT,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (inquiry_id) REFERENCES inquiries(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  dbInstance = db;
  return db;
}

export function getSettings(): AppSettings {
  const db = getDb();
  const rows = db.prepare('SELECT key, value FROM app_settings').all() as Array<{
    key: string;
    value: string;
  }>;
  if (rows.length === 0) {
    saveSettings(DEFAULT_SETTINGS);
    return DEFAULT_SETTINGS;
  }
  const map = new Map(rows.map((r) => [r.key, r.value]));
  return {
    reviewer_name: map.get('reviewer_name') || DEFAULT_SETTINGS.reviewer_name,
    reviewer_role: map.get('reviewer_role') || DEFAULT_SETTINGS.reviewer_role,
    company_signature: map.get('company_signature') || DEFAULT_SETTINGS.company_signature,
    preferred_ai_mode:
      (map.get('preferred_ai_mode') as 'auto' | 'deterministic') || DEFAULT_SETTINGS.preferred_ai_mode,
    high_priority_threshold: Number(
      map.get('high_priority_threshold') || DEFAULT_SETTINGS.high_priority_threshold
    ),
    medium_priority_threshold: Number(
      map.get('medium_priority_threshold') || DEFAULT_SETTINGS.medium_priority_threshold
    ),
  };
}

export function saveSettings(partial: Partial<AppSettings>): AppSettings {
  const db = getDb();
  const countRow = db
    .prepare('SELECT COUNT(*) as c FROM app_settings')
    .get() as { c: number } | undefined;
  const current =
    (countRow?.c ?? 0) > 0
      ? getSettings()
      : DEFAULT_SETTINGS;
  const merged: AppSettings = { ...current, ...partial };
  const upsert = db.prepare(
    'INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  );
  upsert.run('reviewer_name', merged.reviewer_name);
  upsert.run('reviewer_role', merged.reviewer_role);
  upsert.run('company_signature', merged.company_signature);
  upsert.run('preferred_ai_mode', merged.preferred_ai_mode);
  upsert.run('high_priority_threshold', String(merged.high_priority_threshold));
  upsert.run('medium_priority_threshold', String(merged.medium_priority_threshold));
  return merged;
}

export function insertProcessedInquiry(
  input: InquiryInput,
  aiOutput: AIPipelineOutput,
  leadScore: LeadScoreResult,
  kbMatches: KnowledgeMatch[]
): InquiryRecord {
  const db = getDb();
  const now = new Date().toISOString();

  const insertInq = db.prepare(`
    INSERT INTO inquiries (
      client_name, client_email, company, industry, budget_range, timeline,
      project_description, status, processing_mode, llm_provider, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const res = insertInq.run(
    input.client_name,
    input.client_email,
    input.company,
    input.industry,
    input.budget_range,
    input.timeline,
    input.project_description,
    'proposal_ready',
    aiOutput.processing_mode,
    aiOutput.llm_provider,
    now,
    now
  );

  const inquiryId = Number(res.lastInsertRowid);

  db.prepare(`
    INSERT INTO inquiry_analyses (
      inquiry_id, service_category, secondary_category, confidence_score,
      client_problem, business_objectives_json, expected_features_json,
      technical_requirements_json, urgency_level, priority_label, priority_score,
      score_breakdown_json, score_explanation, recommended_cynbit_service,
      matched_kb_items_json, solution_architecture_json, processing_notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    inquiryId,
    aiOutput.service_category,
    aiOutput.secondary_category,
    aiOutput.confidence_score,
    aiOutput.client_problem,
    JSON.stringify(aiOutput.business_objectives),
    JSON.stringify(aiOutput.expected_features),
    JSON.stringify(aiOutput.technical_requirements),
    leadScore.urgency_level,
    leadScore.priority_label,
    leadScore.priority_score,
    JSON.stringify(leadScore.score_breakdown),
    leadScore.score_explanation,
    aiOutput.recommended_cynbit_service,
    JSON.stringify(kbMatches),
    JSON.stringify(aiOutput.solution_architecture),
    aiOutput.processing_notes
  );

  db.prepare(`
    INSERT INTO proposals (
      inquiry_id, title, problem_statement, proposed_solution,
      recommended_technologies_json, implementation_phases_json,
      estimated_complexity, estimated_timeline, preliminary_disclaimer,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    inquiryId,
    aiOutput.proposal.title,
    aiOutput.proposal.problem_statement,
    aiOutput.proposal.proposed_solution,
    JSON.stringify(aiOutput.proposal.recommended_technologies),
    JSON.stringify(aiOutput.proposal.implementation_phases),
    aiOutput.proposal.estimated_complexity,
    aiOutput.proposal.estimated_timeline,
    aiOutput.proposal.preliminary_disclaimer,
    now,
    now
  );

  db.prepare(`
    INSERT INTO email_drafts (
      inquiry_id, recipient_email, recipient_name, subject, body,
      approval_status, reviewer_notes, approved_by, approved_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, 'pending_review', '', NULL, NULL, ?)
  `).run(
    inquiryId,
    input.client_email,
    input.client_name,
    aiOutput.email_draft.subject,
    aiOutput.email_draft.body,
    now
  );

  return getInquiryById(inquiryId)!;
}

export function replaceInquiryAnalysis(
  inquiryId: number,
  aiOutput: AIPipelineOutput,
  leadScore: LeadScoreResult,
  kbMatches: KnowledgeMatch[]
): InquiryRecord {
  const db = getDb();
  const now = new Date().toISOString();

  db.prepare(`
    UPDATE inquiries
    SET processing_mode = ?, llm_provider = ?, status = 'proposal_ready', updated_at = ?
    WHERE id = ?
  `).run(aiOutput.processing_mode, aiOutput.llm_provider, now, inquiryId);

  db.prepare(`
    UPDATE inquiry_analyses
    SET service_category = ?, secondary_category = ?, confidence_score = ?,
        client_problem = ?, business_objectives_json = ?, expected_features_json = ?,
        technical_requirements_json = ?, urgency_level = ?, priority_label = ?,
        priority_score = ?, score_breakdown_json = ?, score_explanation = ?,
        recommended_cynbit_service = ?, matched_kb_items_json = ?,
        solution_architecture_json = ?, processing_notes = ?
    WHERE inquiry_id = ?
  `).run(
    aiOutput.service_category,
    aiOutput.secondary_category,
    aiOutput.confidence_score,
    aiOutput.client_problem,
    JSON.stringify(aiOutput.business_objectives),
    JSON.stringify(aiOutput.expected_features),
    JSON.stringify(aiOutput.technical_requirements),
    leadScore.urgency_level,
    leadScore.priority_label,
    leadScore.priority_score,
    JSON.stringify(leadScore.score_breakdown),
    leadScore.score_explanation,
    aiOutput.recommended_cynbit_service,
    JSON.stringify(kbMatches),
    JSON.stringify(aiOutput.solution_architecture),
    aiOutput.processing_notes,
    inquiryId
  );

  db.prepare(`
    UPDATE proposals
    SET title = ?, problem_statement = ?, proposed_solution = ?,
        recommended_technologies_json = ?, implementation_phases_json = ?,
        estimated_complexity = ?, estimated_timeline = ?, updated_at = ?
    WHERE inquiry_id = ?
  `).run(
    aiOutput.proposal.title,
    aiOutput.proposal.problem_statement,
    aiOutput.proposal.proposed_solution,
    JSON.stringify(aiOutput.proposal.recommended_technologies),
    JSON.stringify(aiOutput.proposal.implementation_phases),
    aiOutput.proposal.estimated_complexity,
    aiOutput.proposal.estimated_timeline,
    now,
    inquiryId
  );

  db.prepare(`
    UPDATE email_drafts
    SET subject = ?, body = ?, approval_status = 'pending_review',
        approved_by = NULL, approved_at = NULL, updated_at = ?
    WHERE inquiry_id = ?
  `).run(aiOutput.email_draft.subject, aiOutput.email_draft.body, now, inquiryId);

  return getInquiryById(inquiryId)!;
}

function hydrateInquiry(row: Record<string, any>): InquiryRecord {
  const analysisRow = getDb()
    .prepare('SELECT * FROM inquiry_analyses WHERE inquiry_id = ?')
    .get(row.id) as Record<string, any> | undefined;

  const proposalRow = getDb()
    .prepare('SELECT * FROM proposals WHERE inquiry_id = ?')
    .get(row.id) as Record<string, any> | undefined;

  const emailRow = getDb()
    .prepare('SELECT * FROM email_drafts WHERE inquiry_id = ?')
    .get(row.id) as Record<string, any> | undefined;

  const analysis: InquiryAnalysis | undefined = analysisRow
    ? {
        inquiry_id: analysisRow.inquiry_id,
        service_category: analysisRow.service_category,
        secondary_category: analysisRow.secondary_category,
        confidence_score: analysisRow.confidence_score,
        client_problem: analysisRow.client_problem,
        business_objectives: JSON.parse(analysisRow.business_objectives_json),
        expected_features: JSON.parse(analysisRow.expected_features_json),
        technical_requirements: JSON.parse(analysisRow.technical_requirements_json),
        urgency_level: analysisRow.urgency_level,
        priority_label: analysisRow.priority_label,
        priority_score: analysisRow.priority_score,
        score_breakdown: JSON.parse(analysisRow.score_breakdown_json),
        score_explanation: analysisRow.score_explanation,
        recommended_cynbit_service: analysisRow.recommended_cynbit_service,
        matched_kb_items: JSON.parse(analysisRow.matched_kb_items_json),
        solution_architecture: JSON.parse(analysisRow.solution_architecture_json),
        processing_notes: analysisRow.processing_notes,
      }
    : undefined;

  const proposal: Proposal | undefined = proposalRow
    ? {
        id: proposalRow.id,
        inquiry_id: proposalRow.inquiry_id,
        title: proposalRow.title,
        problem_statement: proposalRow.problem_statement,
        proposed_solution: proposalRow.proposed_solution,
        recommended_technologies: JSON.parse(proposalRow.recommended_technologies_json),
        implementation_phases: JSON.parse(proposalRow.implementation_phases_json),
        estimated_complexity: proposalRow.estimated_complexity,
        estimated_timeline: proposalRow.estimated_timeline,
        preliminary_disclaimer: proposalRow.preliminary_disclaimer,
        created_at: proposalRow.created_at,
        updated_at: proposalRow.updated_at,
      }
    : undefined;

  const email_draft: EmailDraft | undefined = emailRow
    ? {
        id: emailRow.id,
        inquiry_id: emailRow.inquiry_id,
        recipient_email: emailRow.recipient_email,
        recipient_name: emailRow.recipient_name,
        subject: emailRow.subject,
        body: emailRow.body,
        approval_status: emailRow.approval_status,
        reviewer_notes: emailRow.reviewer_notes,
        approved_by: emailRow.approved_by,
        approved_at: emailRow.approved_at,
        updated_at: emailRow.updated_at,
      }
    : undefined;

  return {
    id: row.id,
    client_name: row.client_name,
    client_email: row.client_email,
    company: row.company,
    industry: row.industry,
    budget_range: row.budget_range,
    timeline: row.timeline,
    project_description: row.project_description,
    status: row.status as InquiryStatus,
    processing_mode: row.processing_mode as ProcessingMode,
    llm_provider: row.llm_provider,
    created_at: row.created_at,
    updated_at: row.updated_at,
    analysis,
    proposal,
    email_draft,
  };
}

export function listInquiries(filters?: {
  q?: string;
  priority?: string;
  category?: string;
  approval?: string;
}): InquiryRecord[] {
  const db = getDb();
  const rows = db
    .prepare('SELECT * FROM inquiries ORDER BY id DESC')
    .all() as Array<Record<string, any>>;

  let records = rows.map(hydrateInquiry);

  if (filters?.q) {
    const q = filters.q.toLowerCase();
    records = records.filter(
      (r) =>
        r.client_name.toLowerCase().includes(q) ||
        r.company.toLowerCase().includes(q) ||
        r.industry.toLowerCase().includes(q) ||
        r.project_description.toLowerCase().includes(q) ||
        (r.analysis?.service_category.toLowerCase().includes(q) ?? false)
    );
  }
  if (filters?.priority && filters.priority !== 'All') {
    records = records.filter((r) => r.analysis?.priority_label === filters.priority);
  }
  if (filters?.category && filters.category !== 'All') {
    records = records.filter((r) => r.analysis?.service_category === filters.category);
  }
  if (filters?.approval && filters.approval !== 'All') {
    records = records.filter((r) => r.email_draft?.approval_status === filters.approval);
  }

  return records;
}

export function getInquiryById(id: number): InquiryRecord | null {
  const row = getDb().prepare('SELECT * FROM inquiries WHERE id = ?').get(id) as
    | Record<string, any>
    | undefined;
  return row ? hydrateInquiry(row) : null;
}

export function updateInquiryClassification(
  inquiryId: number,
  updates: { service_category?: ServiceCategory; priority_label?: PriorityLevel }
): InquiryRecord | null {
  const db = getDb();
  const existing = getInquiryById(inquiryId);
  if (!existing || !existing.analysis) return null;

  const now = new Date().toISOString();
  db.prepare(`
    UPDATE inquiry_analyses
    SET service_category = ?, priority_label = ?
    WHERE inquiry_id = ?
  `).run(
    updates.service_category || existing.analysis.service_category,
    updates.priority_label || existing.analysis.priority_label,
    inquiryId
  );
  db.prepare('UPDATE inquiries SET updated_at = ? WHERE id = ?').run(now, inquiryId);

  return getInquiryById(inquiryId);
}

export function updateProposal(
  inquiryId: number,
  updates: Partial<{
    title: string;
    problem_statement: string;
    proposed_solution: string;
    estimated_complexity: 'Low' | 'Medium' | 'High';
    estimated_timeline: string;
  }>
): InquiryRecord | null {
  const db = getDb();
  const existing = getInquiryById(inquiryId);
  if (!existing || !existing.proposal) return null;

  const now = new Date().toISOString();
  db.prepare(`
    UPDATE proposals
    SET title = ?, problem_statement = ?, proposed_solution = ?,
        estimated_complexity = ?, estimated_timeline = ?, updated_at = ?
    WHERE inquiry_id = ?
  `).run(
    updates.title ?? existing.proposal.title,
    updates.problem_statement ?? existing.proposal.problem_statement,
    updates.proposed_solution ?? existing.proposal.proposed_solution,
    updates.estimated_complexity ?? existing.proposal.estimated_complexity,
    updates.estimated_timeline ?? existing.proposal.estimated_timeline,
    now,
    inquiryId
  );

  return getInquiryById(inquiryId);
}

export function updateEmailDraft(
  inquiryId: number,
  updates: {
    subject?: string;
    body?: string;
    approval_status?: ApprovalStatus;
    reviewer_notes?: string;
    approved_by?: string;
  }
): InquiryRecord | null {
  const db = getDb();
  const existing = getInquiryById(inquiryId);
  if (!existing || !existing.email_draft) return null;

  const now = new Date().toISOString();
  const nextStatus = updates.approval_status ?? existing.email_draft.approval_status;
  const approvedAt = nextStatus === 'approved' ? now : existing.email_draft.approved_at;
  const approvedBy =
    nextStatus === 'approved'
      ? updates.approved_by || getSettings().reviewer_name
      : existing.email_draft.approved_by;

  db.prepare(`
    UPDATE email_drafts
    SET subject = ?, body = ?, approval_status = ?, reviewer_notes = ?,
        approved_by = ?, approved_at = ?, updated_at = ?
    WHERE inquiry_id = ?
  `).run(
    updates.subject ?? existing.email_draft.subject,
    updates.body ?? existing.email_draft.body,
    nextStatus,
    updates.reviewer_notes ?? existing.email_draft.reviewer_notes,
    approvedBy,
    approvedAt,
    now,
    inquiryId
  );

  if (nextStatus === 'approved') {
    db.prepare(`UPDATE inquiries SET status = 'approved', updated_at = ? WHERE id = ?`).run(
      now,
      inquiryId
    );
  }

  return getInquiryById(inquiryId);
}

export function deleteInquiry(inquiryId: number): boolean {
  const res = getDb().prepare('DELETE FROM inquiries WHERE id = ?').run(inquiryId);
  return res.changes > 0;
}

export function getDashboardMetrics(
  openaiConfigured: boolean,
  activeMode: ProcessingMode
): DashboardMetrics {
  const all = listInquiries();
  const total = all.length;

  let high = 0;
  let medium = 0;
  let low = 0;
  let pending = 0;
  let approved = 0;
  let scoreSum = 0;
  const categoryCounts = new Map<string, number>();

  for (const item of all) {
    const priority = item.analysis?.priority_label || 'Low';
    if (priority === 'High') high += 1;
    else if (priority === 'Medium') medium += 1;
    else low += 1;

    scoreSum += item.analysis?.priority_score || 0;

    if (item.email_draft?.approval_status === 'approved') approved += 1;
    else pending += 1;

    const cat = item.analysis?.service_category || 'Other';
    categoryCounts.set(cat, (categoryCounts.get(cat) || 0) + 1);
  }

  const category_distribution = Array.from(categoryCounts.entries())
    .map(([category, count]) => ({
      category,
      count,
      percentage: total > 0 ? Math.round((count / total) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count);

  return {
    total_inquiries: total,
    high_priority_count: high,
    medium_priority_count: medium,
    low_priority_count: low,
    pending_approvals_count: pending,
    approved_responses_count: approved,
    average_priority_score: total > 0 ? Math.round(scoreSum / total) : 0,
    category_distribution,
    recent_inquiries: all.slice(0, 6),
    active_processing_mode: activeMode,
    openai_configured: openaiConfigured,
  };
}
