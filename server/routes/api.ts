import { Router } from 'express';
import { config, isOpenAIConfigured } from '../config.ts';
import {
  deleteInquiry,
  getDashboardMetrics,
  getInquiryById,
  getSettings,
  listInquiries,
  saveSettings,
  updateEmailDraft,
  updateInquiryClassification,
  updateProposal,
} from '../db.ts';
import { knowledgeRetriever } from '../services/knowledgeRetriever.ts';
import {
  getActiveProcessingMode,
  processNewInquiry,
  reanalyzeExistingInquiry,
} from '../services/pipelineOrchestrator.ts';
import { parseRawInquiryText } from '../services/preprocessor.ts';
import type { ApprovalStatus, PriorityLevel, ServiceCategory } from '../types.ts';

export const apiRouter = Router();

apiRouter.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    openai_configured: isOpenAIConfigured(),
    openai_model: config.openaiModel,
    active_processing_mode: getActiveProcessingMode(),
    timestamp: new Date().toISOString(),
  });
});

apiRouter.get('/dashboard/metrics', (_req, res) => {
  const metrics = getDashboardMetrics(isOpenAIConfigured(), getActiveProcessingMode());
  res.json(metrics);
});

apiRouter.get('/inquiries', (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q : undefined;
  const priority = typeof req.query.priority === 'string' ? req.query.priority : undefined;
  const category = typeof req.query.category === 'string' ? req.query.category : undefined;
  const approval = typeof req.query.approval === 'string' ? req.query.approval : undefined;

  const items = listInquiries({ q, priority, category, approval });
  res.json({ items, total: items.length });
});

apiRouter.post('/inquiries', async (req, res) => {
  try {
    const result = await processNewInquiry(req.body || {});
    if (!result.ok) {
      return res.status(400).json({
        error: 'Validation failed',
        details: result.errors,
      });
    }
    return res.status(201).json(result.inquiry);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to process inquiry';
    return res.status(500).json({ error: message });
  }
});

apiRouter.post('/inquiries/quick-parse', async (req, res) => {
  try {
    const rawText = typeof req.body?.raw_text === 'string' ? req.body.raw_text.trim() : '';
    if (rawText.length < 20) {
      return res.status(400).json({
        error: 'Validation failed',
        details: ['Raw inquiry text must contain at least 20 characters.'],
      });
    }

    const parsedInput = parseRawInquiryText(rawText);
    if (req.body?.preview_only) {
      return res.json({ parsed: parsedInput });
    }

    const result = await processNewInquiry(parsedInput);
    if (!result.ok) {
      return res.status(400).json({ error: 'Validation failed', details: result.errors });
    }
    return res.status(201).json(result.inquiry);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to parse raw inquiry';
    return res.status(500).json({ error: message });
  }
});

apiRouter.get('/inquiries/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'Invalid inquiry ID' });
  }
  const inquiry = getInquiryById(id);
  if (!inquiry) {
    return res.status(404).json({ error: 'Inquiry not found' });
  }
  return res.json(inquiry);
});

apiRouter.post('/inquiries/:id/reanalyze', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'Invalid inquiry ID' });
  }
  const updated = await reanalyzeExistingInquiry(id);
  if (!updated) {
    return res.status(404).json({ error: 'Inquiry not found' });
  }
  return res.json(updated);
});

apiRouter.patch('/inquiries/:id/classification', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'Invalid inquiry ID' });
  }
  const service_category = req.body?.service_category as ServiceCategory | undefined;
  const priority_label = req.body?.priority_label as PriorityLevel | undefined;

  const updated = updateInquiryClassification(id, { service_category, priority_label });
  if (!updated) {
    return res.status(404).json({ error: 'Inquiry not found' });
  }
  return res.json(updated);
});

apiRouter.patch('/inquiries/:id/proposal', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'Invalid inquiry ID' });
  }
  const updated = updateProposal(id, {
    title: req.body?.title,
    problem_statement: req.body?.problem_statement,
    proposed_solution: req.body?.proposed_solution,
    estimated_complexity: req.body?.estimated_complexity,
    estimated_timeline: req.body?.estimated_timeline,
  });
  if (!updated) {
    return res.status(404).json({ error: 'Proposal not found' });
  }
  return res.json(updated);
});

apiRouter.patch('/inquiries/:id/email', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'Invalid inquiry ID' });
  }
  const approval_status = req.body?.approval_status as ApprovalStatus | undefined;
  if (
    approval_status &&
    !['pending_review', 'approved', 'needs_revision'].includes(approval_status)
  ) {
    return res.status(400).json({ error: 'Invalid approval_status value' });
  }

  const updated = updateEmailDraft(id, {
    subject: req.body?.subject,
    body: req.body?.body,
    approval_status,
    reviewer_notes: req.body?.reviewer_notes,
    approved_by: req.body?.approved_by,
  });
  if (!updated) {
    return res.status(404).json({ error: 'Email draft not found' });
  }
  return res.json(updated);
});

apiRouter.delete('/inquiries/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'Invalid inquiry ID' });
  }
  const ok = deleteInquiry(id);
  if (!ok) {
    return res.status(404).json({ error: 'Inquiry not found' });
  }
  return res.json({ deleted: true, id });
});

function escapeCsvCell(val: unknown): string {
  const str = String(val ?? '');
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

apiRouter.get('/inquiries/:id/export/csv', (req, res) => {
  const id = Number(req.params.id);
  const inquiry = getInquiryById(id);
  if (!inquiry) {
    return res.status(404).json({ error: 'Inquiry not found' });
  }

  const headers = [
    'Inquiry ID',
    'Client Name',
    'Client Email',
    'Company',
    'Industry',
    'Budget Range',
    'Timeline',
    'Service Category',
    'Priority Label',
    'Priority Score',
    'Urgency Level',
    'Recommended Cynbit Service',
    'Processing Mode',
    'Proposal Title',
    'Estimated Complexity',
    'Estimated Timeline',
    'Email Approval Status',
    'Created At',
  ];

  const row = [
    inquiry.id,
    inquiry.client_name,
    inquiry.client_email,
    inquiry.company,
    inquiry.industry,
    inquiry.budget_range,
    inquiry.timeline,
    inquiry.analysis?.service_category || '',
    inquiry.analysis?.priority_label || '',
    inquiry.analysis?.priority_score ?? '',
    inquiry.analysis?.urgency_level || '',
    inquiry.analysis?.recommended_cynbit_service || '',
    inquiry.processing_mode,
    inquiry.proposal?.title || '',
    inquiry.proposal?.estimated_complexity || '',
    inquiry.proposal?.estimated_timeline || '',
    inquiry.email_draft?.approval_status || '',
    inquiry.created_at,
  ];

  const csvContent = `${headers.map(escapeCsvCell).join(',')}\n${row.map(escapeCsvCell).join(',')}\n`;
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="cynbit-inquiry-${inquiry.id}.csv"`
  );
  return res.send(csvContent);
});

apiRouter.get('/inquiries-export/csv', (_req, res) => {
  const all = listInquiries();
  const headers = [
    'ID',
    'Client Name',
    'Email',
    'Company',
    'Industry',
    'Budget',
    'Timeline',
    'Category',
    'Priority',
    'Score',
    'Recommended Service',
    'Approval Status',
    'Mode',
    'Created At',
  ];
  const lines = [headers.map(escapeCsvCell).join(',')];
  for (const inq of all) {
    lines.push(
      [
        inq.id,
        inq.client_name,
        inq.client_email,
        inq.company,
        inq.industry,
        inq.budget_range,
        inq.timeline,
        inq.analysis?.service_category || '',
        inq.analysis?.priority_label || '',
        inq.analysis?.priority_score ?? '',
        inq.analysis?.recommended_cynbit_service || '',
        inq.email_draft?.approval_status || '',
        inq.processing_mode,
        inq.created_at,
      ]
        .map(escapeCsvCell)
        .join(',')
    );
  }
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="cynbit-inquiries-export.csv"');
  return res.send(lines.join('\n'));
});

apiRouter.get('/knowledge-base', (req, res) => {
  const query = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  const items = knowledgeRetriever.getAllItems();
  const matches = query ? knowledgeRetriever.retrieve(query, 5) : [];
  res.json({ items, matches, query });
});

apiRouter.get('/settings', (_req, res) => {
  const settings = getSettings();
  res.json({
    settings,
    environment: {
      openai_configured: isOpenAIConfigured(),
      openai_model: config.openaiModel,
      active_processing_mode: getActiveProcessingMode(),
      database_engine: 'SQLite (Portable to PostgreSQL via SQLAlchemy/Python Backend)',
    },
  });
});

apiRouter.patch('/settings', (req, res) => {
  const body = req.body || {};
  const high = Number(body.high_priority_threshold);
  const med = Number(body.medium_priority_threshold);

  if (Number.isFinite(high) && Number.isFinite(med) && med >= high) {
    return res.status(400).json({
      error: 'High priority threshold must be strictly greater than medium priority threshold.',
    });
  }

  const updated = saveSettings({
    reviewer_name: typeof body.reviewer_name === 'string' ? body.reviewer_name.trim() : undefined,
    reviewer_role: typeof body.reviewer_role === 'string' ? body.reviewer_role.trim() : undefined,
    company_signature:
      typeof body.company_signature === 'string' ? body.company_signature.trim() : undefined,
    preferred_ai_mode:
      body.preferred_ai_mode === 'auto' || body.preferred_ai_mode === 'deterministic'
        ? body.preferred_ai_mode
        : undefined,
    high_priority_threshold: Number.isFinite(high) ? high : undefined,
    medium_priority_threshold: Number.isFinite(med) ? med : undefined,
  });

  return res.json({
    settings: updated,
    environment: {
      openai_configured: isOpenAIConfigured(),
      openai_model: config.openaiModel,
      active_processing_mode: getActiveProcessingMode(),
      database_engine: 'SQLite (Portable to PostgreSQL via SQLAlchemy/Python Backend)',
    },
  });
});
