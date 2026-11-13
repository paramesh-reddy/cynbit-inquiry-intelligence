import { useState } from 'react';
import { FileText, Loader2, Sparkles } from 'lucide-react';
import { api } from '../api';
import type { InquiryRecord } from '../types';

interface NewInquiryViewProps {
  onCreated: (inquiry: InquiryRecord) => void;
}

const PRESETS = [
  {
    label: 'Healthcare AI Voice Agent',
    data: {
      client_name: 'Dr. Kavita Deshmukh',
      client_email: 'kavita@apexdiagnostics.in',
      company: 'Apex Diagnostics',
      industry: 'Healthcare',
      budget_range: '$20,000 - $35,000',
      timeline: 'Urgent (Within 4 weeks)',
      project_description:
        'We manage 18 pathology labs and handle 800+ daily patient calls for test bookings and home sample pickups. Looking for a bilingual Hindi/English AI voice agent integrated with our CRM and WhatsApp notifications, plus human escalation for urgent queries.',
    },
  },
  {
    label: 'CRM & WhatsApp Funnel',
    data: {
      client_name: 'Nikhil Bansal',
      client_email: 'nikhil@urbanbrickrealty.com',
      company: 'UrbanBrick Realty',
      industry: 'Real Estate / PropTech',
      budget_range: '$10,000 - $18,000',
      timeline: '1 - 2 months',
      project_description:
        'Our sales team receives 400 inbound property leads weekly across Meta Ads and website forms. Leads sit uncontacted in Google Sheets. We need HubSpot CRM automation, lead scoring, automated WhatsApp follow-up sequences, and conversion tracking.',
    },
  },
  {
    label: 'AWS Cloud & Autoscaling',
    data: {
      client_name: 'Marcus Vance',
      client_email: 'mvance@kinetixcommerce.io',
      company: 'Kinetix Commerce',
      industry: 'E-Commerce',
      budget_range: '$15,000 - $25,000',
      timeline: 'Immediate (3 weeks)',
      project_description:
        'Our checkout API crashes during peak promotional drops. Looking for AWS ECS Docker containerization, RDS PostgreSQL read replicas, automated GitHub Actions CI/CD, and Prometheus alerting.',
    },
  },
];

export function NewInquiryView({ onCreated }: NewInquiryViewProps) {
  const [intakeMode, setIntakeMode] = useState<'form' | 'raw'>('form');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    client_name: '',
    client_email: '',
    company: '',
    industry: 'SaaS / Technology',
    budget_range: '$10,000 - $25,000',
    timeline: '1 - 3 months',
    project_description: '',
  });

  const [rawText, setRawText] = useState('');

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const created = await api.createInquiry(form);
      onCreated(created);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to analyze inquiry');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitRaw = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const created = (await api.quickParseInquiry(rawText, false)) as InquiryRecord;
      onCreated(created);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse and analyze raw text');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl space-y-6">
      {/* Mode Switch & Presets */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="inline-flex items-center p-1 bg-slate-200/70 rounded-lg">
          <button
            type="button"
            onClick={() => setIntakeMode('form')}
            className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              intakeMode === 'form'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Structured Intake Form
          </button>
          <button
            type="button"
            onClick={() => setIntakeMode('raw')}
            className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              intakeMode === 'raw'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Paste Raw Inquiry Text
          </button>
        </div>

        {intakeMode === 'form' && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-500">Load sample:</span>
            {PRESETS.map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => {
                  setForm(preset.data);
                  setError(null);
                }}
                className="px-2.5 py-1 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50 transition-colors whitespace-nowrap"
              >
                {preset.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {error && (
        <div
          role="alert"
          className="p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800"
        >
          {error}
        </div>
      )}

      {intakeMode === 'form' ? (
        <form
          onSubmit={handleSubmitForm}
          className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-6"
        >
          <div className="pb-4 border-b border-slate-100">
            <h2 className="text-lg font-semibold text-slate-900">Client Inquiry Intake</h2>
            <p className="text-sm text-slate-500 mt-1">
              Runs input validation, TF-IDF Cynbit knowledge retrieval, deterministic lead scoring,
              proposal drafting, and human-gated email generation.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label htmlFor="client_name" className="block text-xs font-medium text-slate-700 mb-1.5">
                Client Full Name
              </label>
              <input
                id="client_name"
                type="text"
                required
                value={form.client_name}
                onChange={(e) => setForm({ ...form, client_name: e.target.value })}
                placeholder="e.g. Arjun Mehta"
                className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700/20 focus:border-blue-700"
              />
            </div>

            <div>
              <label htmlFor="client_email" className="block text-xs font-medium text-slate-700 mb-1.5">
                Work Email Address
              </label>
              <input
                id="client_email"
                type="email"
                required
                value={form.client_email}
                onChange={(e) => setForm({ ...form, client_email: e.target.value })}
                placeholder="name@company.com"
                className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700/20 focus:border-blue-700"
              />
            </div>

            <div>
              <label htmlFor="company" className="block text-xs font-medium text-slate-700 mb-1.5">
                Company / Organization
              </label>
              <input
                id="company"
                type="text"
                required
                value={form.company}
                onChange={(e) => setForm({ ...form, company: e.target.value })}
                placeholder="e.g. MediBridge Diagnostics"
                className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700/20 focus:border-blue-700"
              />
            </div>

            <div>
              <label htmlFor="industry" className="block text-xs font-medium text-slate-700 mb-1.5">
                Industry Vertical
              </label>
              <select
                id="industry"
                value={form.industry}
                onChange={(e) => setForm({ ...form, industry: e.target.value })}
                className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-700/20 focus:border-blue-700"
              >
                <option>SaaS / Technology</option>
                <option>Healthcare</option>
                <option>Real Estate / PropTech</option>
                <option>FinTech</option>
                <option>E-Commerce &amp; Retail</option>
                <option>Logistics &amp; Supply Chain</option>
                <option>EdTech / Non-Profit</option>
                <option>Other</option>
              </select>
            </div>

            <div>
              <label htmlFor="budget_range" className="block text-xs font-medium text-slate-700 mb-1.5">
                Estimated Budget Range
              </label>
              <select
                id="budget_range"
                value={form.budget_range}
                onChange={(e) => setForm({ ...form, budget_range: e.target.value })}
                className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-700/20 focus:border-blue-700"
              >
                <option>$25,000 - $50,000</option>
                <option>$15,000 - $30,000</option>
                <option>$10,000 - $25,000</option>
                <option>$5,000 - $10,000</option>
                <option>$2,000 - $5,000</option>
                <option>Undisclosed / Exploring</option>
              </select>
            </div>

            <div>
              <label htmlFor="timeline" className="block text-xs font-medium text-slate-700 mb-1.5">
                Target Timeline
              </label>
              <select
                id="timeline"
                value={form.timeline}
                onChange={(e) => setForm({ ...form, timeline: e.target.value })}
                className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-700/20 focus:border-blue-700"
              >
                <option>Urgent (Within 4 weeks)</option>
                <option>1 - 2 months</option>
                <option>1 - 3 months</option>
                <option>3 - 6 months</option>
                <option>Flexible (Exploratory)</option>
              </select>
            </div>
          </div>

          <div>
            <label
              htmlFor="project_description"
              className="block text-xs font-medium text-slate-700 mb-1.5"
            >
              Project Description &amp; Requirements
            </label>
            <textarea
              id="project_description"
              rows={5}
              required
              minLength={20}
              value={form.project_description}
              onChange={(e) => setForm({ ...form, project_description: e.target.value })}
              placeholder="Describe business challenges, expected integrations (CRM, ERP, WhatsApp, AWS), volume metrics, and target deliverables..."
              className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700/20 focus:border-blue-700"
            />
            <div className="mt-1.5 flex justify-between text-xs text-slate-500">
              <span>Minimum 20 characters required</span>
              <span className="font-mono-nums">{form.project_description.length} characters</span>
            </div>
          </div>

          <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-100">
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-blue-700 rounded-lg hover:bg-blue-800 disabled:opacity-60 transition-colors"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                  <span>Running Analysis Pipeline...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" aria-hidden="true" />
                  <span>Analyze &amp; Generate Proposal</span>
                </>
              )}
            </button>
          </div>
        </form>
      ) : (
        <form
          onSubmit={handleSubmitRaw}
          className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-5"
        >
          <div className="pb-4 border-b border-slate-100">
            <h2 className="text-lg font-semibold text-slate-900">Raw Inquiry Text Parser</h2>
            <p className="text-sm text-slate-500 mt-1">
              Paste an unstructured client email, contact form message, or LinkedIn DM. The
              preprocessor extracts contact metadata, budget signals, and runs the full analysis
              pipeline.
            </p>
          </div>

          <div>
            <label htmlFor="raw_text" className="block text-xs font-medium text-slate-700 mb-1.5">
              Unstructured Inquiry Text
            </label>
            <textarea
              id="raw_text"
              rows={8}
              required
              minLength={20}
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder={`Example:\nHi Cynbit team,\nFrom: Rohan Kulkarni (rohan.k@finflowops.io)\nCompany: FinFlow Ops\nWe process 300+ vendor invoices weekly and need an automated LLM PDF extraction pipeline integrated with our ERP within 4 weeks. Budget is around $18,000.`}
              className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700/20 focus:border-blue-700"
            />
          </div>

          <div className="pt-2 flex items-center justify-between border-t border-slate-100">
            <button
              type="button"
              onClick={() =>
                setRawText(
                  'Hi Cynbit team,\nFrom: Meera Joshi (meera@clearledger.in)\nCompany: ClearLedger Systems\nWe need an automated GST invoice parsing agent with human review queue and Zoho Books integration urgently within 3 weeks. Budget $15,000.'
                )
              }
              className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900"
            >
              <FileText className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Insert Example Email</span>
            </button>

            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-blue-700 rounded-lg hover:bg-blue-800 disabled:opacity-60 transition-colors"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                  <span>Parsing &amp; Analyzing...</span>
                </>
              ) : (
                <span>Parse &amp; Run Pipeline</span>
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
