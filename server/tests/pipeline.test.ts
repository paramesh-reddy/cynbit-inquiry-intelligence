import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import express from 'express';

// Point DB_PATH to an isolated temporary SQLite file before importing DB/server modules
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cynbit-test-'));
process.env.DB_PATH = path.join(tmpDir, 'test_inquiries.db');
process.env.OPENAI_API_KEY = '';

const { apiRouter } = await import('../routes/api.ts');
const { getDb } = await import('../db.ts');
const { validateInquiryInput, preprocessInquiry } = await import('../services/preprocessor.ts');
const { knowledgeRetriever } = await import('../services/knowledgeRetriever.ts');
const { scoreLeadDeterministically } = await import('../services/leadScorer.ts');

const app = express();
app.use(express.json());
app.use('/api', apiRouter);

let server: ReturnType<typeof app.listen>;
let baseUrl = '';

test.before(async () => {
  getDb();
  await new Promise<void>((resolve) => {
    server = app.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      if (addr && typeof addr !== 'string') {
        baseUrl = `http://127.0.0.1:${addr.port}`;
      }
      resolve();
    });
  });
});

test.after(async () => {
  if (server) {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('Input validation rejects invalid email and short description', () => {
  const res = validateInquiryInput({
    client_name: 'A',
    client_email: 'not-an-email',
    company: '',
    project_description: 'Too short',
  });
  assert.equal(res.valid, false);
  assert.ok(res.errors.length >= 3);
});

test('Knowledge base TF-IDF retrieval ranks AI Voice Agent for clinic inquiry', () => {
  const matches = knowledgeRetriever.retrieve(
    'We need an AI voice assistant for inbound patient phone calls and CRM booking',
    3
  );
  assert.equal(matches.length, 3);
  assert.equal(matches[0].id, 'kb-ai-voice');
  assert.ok(matches[0].similarity_score > 0.2);
});

test('Deterministic lead scorer assigns High priority for urgent enterprise inquiry and Low for exploratory', () => {
  const highPre = preprocessInquiry({
    client_name: 'Arjun Mehta',
    client_email: 'arjun@medibridge.in',
    company: 'MediBridge Health',
    industry: 'Healthcare',
    budget_range: '$25,000 - $40,000',
    timeline: 'Urgent (Within 3 weeks)',
    project_description:
      'We handle 600 inbound calls daily across 14 diagnostic centers and need an AI voice agent integrated with HubSpot CRM and WhatsApp within 3 weeks.',
  });
  const kbHigh = knowledgeRetriever.retrieve(highPre.normalized_text, 3);
  const highScore = scoreLeadDeterministically(highPre, kbHigh);
  assert.equal(highScore.priority_label, 'High');
  assert.ok(highScore.priority_score >= 70);
  assert.equal(highScore.score_breakdown.length, 5);

  const lowPre = preprocessInquiry({
    client_name: 'Sam',
    client_email: 'sam@gmail.com',
    company: 'Test',
    industry: 'Other',
    budget_range: 'Undisclosed / Exploring',
    timeline: 'Flexible (Exploratory)',
    project_description: 'Just exploring general website ideas for next year maybe.',
  });
  const kbLow = knowledgeRetriever.retrieve(lowPre.normalized_text, 3);
  const lowScore = scoreLeadDeterministically(lowPre, kbLow);
  assert.equal(lowScore.priority_label, 'Low');
  assert.ok(lowScore.priority_score < 40);
});

test('End-to-end API workflow: create inquiry -> fallback mode -> proposal -> human email approval -> CSV export -> delete', async () => {
  // 1. Health check
  const healthRes = await fetch(`${baseUrl}/api/health`);
  assert.equal(healthRes.status, 200);
  const healthJson = await healthRes.json();
  assert.equal(healthJson.active_processing_mode, 'deterministic_fallback');

  // 2. API validation error (400)
  const badRes = await fetch(`${baseUrl}/api/inquiries`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_name: 'X', client_email: 'bad' }),
  });
  assert.equal(badRes.status, 400);

  // 3. Create inquiry (201)
  const createRes = await fetch(`${baseUrl}/api/inquiries`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_name: 'Rohan Kulkarni',
      client_email: 'rohan@finflowops.io',
      company: 'FinFlow Ops',
      industry: 'FinTech',
      budget_range: '$15,000 - $25,000',
      timeline: 'Urgent (Within 4 weeks)',
      project_description:
        'Our finance team manually extracts data from 300+ vendor GST invoice PDFs into our ERP each week and needs an autonomous LLM automation pipeline with human review.',
    }),
  });
  assert.equal(createRes.status, 201);
  const created = await createRes.json();

  assert.equal(created.processing_mode, 'deterministic_fallback');
  assert.equal(created.analysis.service_category, 'AI Automation');
  assert.equal(created.analysis.priority_label, 'High');
  assert.ok(created.proposal.preliminary_disclaimer.includes('not an official Cynbit'));
  assert.equal(created.email_draft.approval_status, 'pending_review');

  // 4. Approve email draft via human gate
  const approveRes = await fetch(`${baseUrl}/api/inquiries/${created.id}/email`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      approval_status: 'approved',
      reviewer_notes: 'Verified scope and approved.',
    }),
  });
  assert.equal(approveRes.status, 200);
  const approved = await approveRes.json();
  assert.equal(approved.email_draft.approval_status, 'approved');
  assert.equal(approved.status, 'approved');

  // 5. CSV export
  const csvRes = await fetch(`${baseUrl}/api/inquiries/${created.id}/export/csv`);
  assert.equal(csvRes.status, 200);
  const csvBody = await csvRes.text();
  assert.ok(csvBody.includes('FinFlow Ops'));

  // 6. 404 on unknown inquiry
  const notFoundRes = await fetch(`${baseUrl}/api/inquiries/99999`);
  assert.equal(notFoundRes.status, 404);

  // 7. Delete inquiry
  const delRes = await fetch(`${baseUrl}/api/inquiries/${created.id}`, {
    method: 'DELETE',
  });
  assert.equal(delRes.status, 200);
});
