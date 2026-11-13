import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Copy,
  Download,
  FileDown,
  RefreshCw,
  Save,
  ShieldAlert,
} from 'lucide-react';
import { api } from '../api';
import type { ApprovalStatus, InquiryRecord, PriorityLevel, ServiceCategory } from '../types';
import { exportInquiryProposalPdf } from '../utils/pdfExport';
import { ApprovalText, PriorityText } from './PriorityText';

interface InquiryDetailViewProps {
  inquiryId: number;
  onBack: () => void;
  onUpdated: () => void;
}

const SERVICE_CATEGORIES: ServiceCategory[] = [
  'AI/ML',
  'AI Automation',
  'Full-Stack Development',
  'CRM Automation',
  'Cloud Infrastructure',
  'Digital Marketing',
  'Other',
];

export function InquiryDetailView({
  inquiryId,
  onBack,
  onUpdated,
}: InquiryDetailViewProps) {
  const [inquiry, setInquiry] = useState<InquiryRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'analysis' | 'proposal' | 'email' | 'brief'>(
    'analysis'
  );
  const [reanalyzing, setReanalyzing] = useState(false);
  const [savingMsg, setSavingMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Proposal editor state
  const [propTitle, setPropTitle] = useState('');
  const [propProblem, setPropProblem] = useState('');
  const [propSolution, setPropSolution] = useState('');
  const [propComplexity, setPropComplexity] = useState<'Low' | 'Medium' | 'High'>('Medium');
  const [propTimeline, setPropTimeline] = useState('');

  // Email editor state
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [reviewerNotes, setReviewerNotes] = useState('');

  const syncLocalEditors = (rec: InquiryRecord) => {
    if (rec.proposal) {
      setPropTitle(rec.proposal.title);
      setPropProblem(rec.proposal.problem_statement);
      setPropSolution(rec.proposal.proposed_solution);
      setPropComplexity(rec.proposal.estimated_complexity);
      setPropTimeline(rec.proposal.estimated_timeline);
    }
    if (rec.email_draft) {
      setEmailSubject(rec.email_draft.subject);
      setEmailBody(rec.email_draft.body);
      setReviewerNotes(rec.email_draft.reviewer_notes || '');
    }
  };

  const load = async () => {
    setLoading(true);
    try {
      const rec = await api.getInquiry(inquiryId);
      setInquiry(rec);
      syncLocalEditors(rec);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [inquiryId]);

  const showNotice = (msg: string) => {
    setSavingMsg(msg);
    setTimeout(() => setSavingMsg(null), 3000);
  };

  const handleReanalyze = async () => {
    setReanalyzing(true);
    try {
      const updated = await api.reanalyzeInquiry(inquiryId);
      setInquiry(updated);
      syncLocalEditors(updated);
      onUpdated();
      showNotice('Pipeline re-executed and analysis updated.');
    } finally {
      setReanalyzing(false);
    }
  };

  const handleOverrideClassification = async (
    service_category: ServiceCategory,
    priority_label: PriorityLevel
  ) => {
    const updated = await api.updateClassification(inquiryId, {
      service_category,
      priority_label,
    });
    setInquiry(updated);
    onUpdated();
    showNotice('Human classification override saved.');
  };

  const handleSaveProposal = async () => {
    const updated = await api.updateProposal(inquiryId, {
      title: propTitle,
      problem_statement: propProblem,
      proposed_solution: propSolution,
      estimated_complexity: propComplexity,
      estimated_timeline: propTimeline,
    });
    setInquiry(updated);
    onUpdated();
    showNotice('Proposal draft edits saved.');
  };

  const handleUpdateEmail = async (approval_status?: ApprovalStatus) => {
    const updated = await api.updateEmailDraft(inquiryId, {
      subject: emailSubject,
      body: emailBody,
      reviewer_notes: reviewerNotes,
      approval_status,
    });
    setInquiry(updated);
    onUpdated();
    showNotice(
      approval_status === 'approved'
        ? 'Email draft approved by human reviewer.'
        : approval_status === 'needs_revision'
        ? 'Email draft marked as needing revision.'
        : 'Email draft changes saved.'
    );
  };

  const handleCopyEmail = async () => {
    await navigator.clipboard.writeText(`Subject: ${emailSubject}\n\n${emailBody}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-24 bg-white border border-slate-200 rounded-xl animate-pulse" />
        <div className="h-96 bg-white border border-slate-200 rounded-xl animate-pulse" />
      </div>
    );
  }

  if (!inquiry) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-8 text-center">
        <p className="text-sm text-slate-600">Inquiry not found.</p>
        <button
          type="button"
          onClick={onBack}
          className="mt-4 px-4 py-2 text-xs font-medium bg-slate-900 text-white rounded-lg"
        >
          Return to Inquiries
        </button>
      </div>
    );
  }

  const analysis = inquiry.analysis;

  return (
    <div className="space-y-6">
      {/* Top Action & Summary Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Back to Inquiries</span>
          </button>

          <div className="flex flex-wrap items-center gap-2.5">
            {savingMsg && (
              <span className="text-xs font-medium text-emerald-700 mr-2">{savingMsg}</span>
            )}
            <button
              type="button"
              onClick={handleReanalyze}
              disabled={reanalyzing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 whitespace-nowrap"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${reanalyzing ? 'animate-spin' : ''}`}
                aria-hidden="true"
              />
              <span>{reanalyzing ? 'Re-analyzing...' : 'Re-run Pipeline'}</span>
            </button>

            <a
              href={api.getCsvExportUrl(inquiry.id)}
              download
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Export CSV</span>
            </a>

            <button
              type="button"
              onClick={() => exportInquiryProposalPdf(inquiry)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium text-white bg-blue-700 rounded-lg hover:bg-blue-800 whitespace-nowrap"
            >
              <FileDown className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Export PDF</span>
            </button>
          </div>
        </div>

        <div className="pt-2 border-t border-slate-100 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span className="font-mono-nums">Inquiry #{inquiry.id}</span>
              <span aria-hidden="true">·</span>
              <span>{inquiry.industry}</span>
              <span aria-hidden="true">·</span>
              <span>{inquiry.llm_provider}</span>
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900 mt-1">
              {inquiry.company}
            </h1>
            <p className="text-sm text-slate-600 mt-0.5">
              {inquiry.client_name} · {inquiry.client_email} · Budget:{' '}
              <span className="font-mono-nums text-slate-800">{inquiry.budget_range}</span> ·
              Timeline: {inquiry.timeline}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-6 shrink-0">
            {analysis && (
              <div>
                <div className="text-xs text-slate-500">Lead Priority</div>
                <div className="mt-1">
                  <PriorityText
                    priority={analysis.priority_label}
                    score={analysis.priority_score}
                  />
                </div>
              </div>
            )}
            {inquiry.email_draft && (
              <div>
                <div className="text-xs text-slate-500">Response Gate</div>
                <div className="mt-1">
                  <ApprovalText status={inquiry.email_draft.approval_status} />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Workspace Section Tabs */}
        <div className="pt-2 flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg w-fit">
          {[
            { id: 'analysis', label: 'AI Analysis & Scoring' },
            { id: 'proposal', label: 'Proposal Draft' },
            { id: 'email', label: 'Email Approval' },
            { id: 'brief', label: 'Client Brief' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* TAB 1: Analysis & Lead Scoring */}
      {activeTab === 'analysis' && analysis && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 space-y-6">
            <div className="pb-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  Requirement &amp; Solution Analysis
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">{analysis.processing_notes}</p>
              </div>
              <span className="text-xs font-mono-nums text-slate-600">
                Confidence {(analysis.confidence_score * 100).toFixed(0)}%
              </span>
            </div>

            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Identified Client Problem
              </h3>
              <p className="text-sm text-slate-800 leading-relaxed">{analysis.client_problem}</p>
            </div>

            <div className="pt-4 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                  Expected Features
                </h3>
                <ul className="space-y-1.5 text-sm text-slate-700 list-disc pl-4">
                  {analysis.expected_features.map((feat, i) => (
                    <li key={i}>{feat}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                  Technical Requirements
                </h3>
                <ul className="space-y-1.5 text-sm text-slate-700 list-disc pl-4">
                  {analysis.technical_requirements.map((req, i) => (
                    <li key={i}>{req}</li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 space-y-3">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Suggested Solution Architecture
              </h3>
              <p className="text-sm text-slate-800">{analysis.solution_architecture.overview}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                <div>
                  <div className="text-xs font-medium text-slate-600 mb-1">System Components</div>
                  <ul className="space-y-1 text-xs text-slate-600 list-disc pl-4">
                    {analysis.solution_architecture.components.map((c, idx) => (
                      <li key={idx}>{c}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <div className="text-xs font-medium text-slate-600 mb-1">
                    Target Integrations &amp; Deployment
                  </div>
                  <p className="text-xs text-slate-600">
                    {analysis.solution_architecture.integrations.join(', ')}
                  </p>
                  <p className="text-xs text-slate-500 mt-1.5">
                    {analysis.solution_architecture.deployment_notes}
                  </p>
                </div>
              </div>
            </div>

            {/* Human Classification Review */}
            <div className="pt-4 border-t border-slate-100">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                Human Classification Review (Override AI Suggestion)
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-slate-600 mb-1">Service Category</label>
                  <select
                    value={analysis.service_category}
                    onChange={(e) =>
                      handleOverrideClassification(
                        e.target.value as ServiceCategory,
                        analysis.priority_label
                      )
                    }
                    className="w-full px-3 py-2 text-xs font-medium border border-slate-300 rounded-lg bg-white"
                  >
                    {SERVICE_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-600 mb-1">Lead Priority</label>
                  <select
                    value={analysis.priority_label}
                    onChange={(e) =>
                      handleOverrideClassification(
                        analysis.service_category,
                        e.target.value as PriorityLevel
                      )
                    }
                    className="w-full px-3 py-2 text-xs font-medium border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Transparent Scoring + Matched KB */}
          <div className="lg:col-span-5 space-y-6">
            <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
              <div className="pb-3 border-b border-slate-100 flex items-baseline justify-between">
                <h2 className="text-base font-semibold text-slate-900">
                  Transparent Priority Scoring
                </h2>
                <span className="font-mono-nums text-lg font-semibold text-slate-900">
                  {analysis.priority_score}/100
                </span>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">{analysis.score_explanation}</p>

              <div className="space-y-3.5 pt-1">
                {analysis.score_breakdown.map((factor) => {
                  const pct = Math.round((factor.points / factor.max_points) * 100);
                  return (
                    <div key={factor.factor} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-slate-800">{factor.factor}</span>
                        <span className="font-mono-nums text-slate-600">
                          {factor.points} / {factor.max_points} pts
                        </span>
                      </div>
                      <div className="h-1.5 w-full bg-slate-100 rounded-sm overflow-hidden">
                        <div className="h-full bg-blue-700" style={{ width: `${pct}%` }} />
                      </div>
                      <p className="text-xs text-slate-500">{factor.reason}</p>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
              <div className="pb-3 border-b border-slate-100">
                <h2 className="text-base font-semibold text-slate-900">
                  Matched Cynbit Knowledge Base
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  TF-IDF cosine similarity retrieval from cynbit.in public offerings
                </p>
              </div>

              <div className="divide-y divide-slate-100">
                {analysis.matched_kb_items.map((kb) => (
                  <div key={kb.id} className="py-3 first:pt-0 last:pb-0 space-y-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-sm font-medium text-slate-900">{kb.title}</span>
                      <span className="text-xs font-mono-nums text-blue-700 shrink-0">
                        {kb.similarity_score.toFixed(2)} sim
                      </span>
                    </div>
                    <div className="text-xs text-slate-500">
                      {kb.offering_type} · {kb.service_category}
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">{kb.summary}</p>
                    {kb.matched_terms.length > 0 && (
                      <div className="text-xs text-slate-500 pt-0.5">
                        Matched terms: {kb.matched_terms.join(', ')}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      )}

      {/* TAB 2: Proposal Preview & Editor */}
      {activeTab === 'proposal' && inquiry.proposal && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-6">
          <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900">
            <strong>Preliminary Estimate Notice:</strong> {inquiry.proposal.preliminary_disclaimer}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <div className="lg:col-span-2">
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Proposal Title
              </label>
              <input
                type="text"
                value={propTitle}
                onChange={(e) => setPropTitle(e.target.value)}
                className="w-full px-3.5 py-2 text-sm font-medium border border-slate-300 rounded-lg"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Complexity</label>
                <select
                  value={propComplexity}
                  onChange={(e) =>
                    setPropComplexity(e.target.value as 'Low' | 'Medium' | 'High')
                  }
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                >
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Est. Timeline</label>
                <input
                  type="text"
                  value={propTimeline}
                  onChange={(e) => setPropTimeline(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Problem Statement
              </label>
              <textarea
                rows={4}
                value={propProblem}
                onChange={(e) => setPropProblem(e.target.value)}
                className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Proposed Cynbit Solution
              </label>
              <textarea
                rows={4}
                value={propSolution}
                onChange={(e) => setPropSolution(e.target.value)}
                className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 space-y-4">
            <div>
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Recommended Technology Stack
              </h3>
              <p className="text-sm text-slate-800 mt-1">
                {inquiry.proposal.recommended_technologies.join(' · ')}
              </p>
            </div>

            <div>
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                Implementation Phases
              </h3>
              <div className="divide-y divide-slate-200 border border-slate-200 rounded-lg">
                {inquiry.proposal.implementation_phases.map((phase, i) => (
                  <div key={i} className="p-4 flex flex-col sm:flex-row sm:items-start gap-4">
                    <div className="sm:w-56 shrink-0">
                      <div className="text-sm font-medium text-slate-900">{phase.phase}</div>
                      <div className="text-xs text-slate-500 font-mono-nums mt-0.5">
                        {phase.duration}
                      </div>
                    </div>
                    <ul className="text-xs text-slate-700 space-y-1 list-disc pl-4">
                      {phase.deliverables.map((d, j) => (
                        <li key={j}>{d}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => exportInquiryProposalPdf(inquiry)}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
            >
              <FileDown className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Download PDF</span>
            </button>
            <button
              type="button"
              onClick={handleSaveProposal}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-blue-700 rounded-lg hover:bg-blue-800"
            >
              <Save className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Save Proposal Edits</span>
            </button>
          </div>
        </div>
      )}

      {/* TAB 3: Email Response Editor & Human Approval Gate */}
      {activeTab === 'email' && inquiry.email_draft && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Client Response Draft &amp; Human Approval Gate
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Automated sending is disabled by design. A human reviewer must inspect and approve
                before outreach.
              </p>
            </div>
            <ApprovalText status={inquiry.email_draft.approval_status} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-slate-600">
            <div>
              Recipient:{' '}
              <strong className="text-slate-900">
                {inquiry.email_draft.recipient_name} &lt;{inquiry.email_draft.recipient_email}&gt;
              </strong>
            </div>
            <div className="sm:text-right font-mono-nums">
              {inquiry.email_draft.approved_at
                ? `Approved by ${inquiry.email_draft.approved_by} on ${new Date(
                    inquiry.email_draft.approved_at
                  ).toLocaleString()}`
                : 'Awaiting human sign-off'}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Email Subject</label>
            <input
              type="text"
              value={emailSubject}
              onChange={(e) => setEmailSubject(e.target.value)}
              className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Email Body</label>
            <textarea
              rows={11}
              value={emailBody}
              onChange={(e) => setEmailBody(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm leading-relaxed border border-slate-300 rounded-lg font-sans"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Internal Reviewer Notes
            </label>
            <input
              type="text"
              value={reviewerNotes}
              onChange={(e) => setReviewerNotes(e.target.value)}
              placeholder="Optional notes for sales/delivery team..."
              className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-lg"
            />
          </div>

          <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={handleCopyEmail}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-700" aria-hidden="true" />
                  <span>Copied to Clipboard</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Copy Draft</span>
                </>
              )}
            </button>

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={() => handleUpdateEmail()}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
              >
                <Save className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Save Draft</span>
              </button>

              <button
                type="button"
                onClick={() => handleUpdateEmail('needs_revision')}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-amber-800 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100"
              >
                <ShieldAlert className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Flag Revision</span>
              </button>

              <button
                type="button"
                onClick={() => handleUpdateEmail('approved')}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-emerald-700 rounded-lg hover:bg-emerald-800"
              >
                <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Approve Response</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: Original Brief */}
      {activeTab === 'brief' && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-4">
          <h2 className="text-base font-semibold text-slate-900">Original Submitted Brief</h2>
          <dl className="grid grid-cols-1 sm:grid-cols-3 gap-4 py-4 border-y border-slate-100 text-sm">
            <div>
              <dt className="text-xs text-slate-500">Client Name</dt>
              <dd className="font-medium text-slate-900 mt-0.5">{inquiry.client_name}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Email</dt>
              <dd className="font-medium text-slate-900 mt-0.5">{inquiry.client_email}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Submitted At</dt>
              <dd className="font-mono-nums text-slate-900 mt-0.5">
                {new Date(inquiry.created_at).toLocaleString()}
              </dd>
            </div>
          </dl>
          <div>
            <div className="text-xs text-slate-500 mb-2">Verbatim Project Description</div>
            <p className="text-sm text-slate-800 leading-relaxed whitespace-pre-wrap">
              {inquiry.project_description}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
