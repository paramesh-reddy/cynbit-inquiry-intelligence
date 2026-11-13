import { useEffect, useState } from 'react';
import { Download, Search, Trash2 } from 'lucide-react';
import { api } from '../api';
import type { InquiryRecord } from '../types';
import { ApprovalText, PriorityText } from './PriorityText';

interface InquiriesListViewProps {
  onSelectInquiry: (id: number) => void;
  onRefreshMetrics: () => void;
}

export function InquiriesListView({
  onSelectInquiry,
  onRefreshMetrics,
}: InquiriesListViewProps) {
  const [items, setItems] = useState<InquiryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('All');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [approvalFilter, setApprovalFilter] = useState('All');
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.listInquiries({
        q: search,
        priority: priorityFilter,
        category: categoryFilter,
        approval: approvalFilter,
      });
      setItems(res.items);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      load();
    }, 150);
    return () => clearTimeout(timer);
  }, [search, priorityFilter, categoryFilter, approvalFilter]);

  const handleDelete = async (id: number) => {
    await api.deleteInquiry(id);
    setConfirmDeleteId(null);
    await load();
    onRefreshMetrics();
  };

  return (
    <div className="space-y-6">
      {/* Filter Toolbar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex flex-1 flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[220px] max-w-sm">
            <Search
              className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2"
              aria-hidden="true"
            />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search client, company, or requirements..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700/20 focus:border-blue-700"
            />
          </div>

          {/* Priority segmented filter */}
          <div className="inline-flex items-center p-1 bg-slate-100 rounded-lg">
            {['All', 'High', 'Medium', 'Low'].map((level) => (
              <button
                key={level}
                type="button"
                onClick={() => setPriorityFilter(level)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  priorityFilter === level
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {level}
              </button>
            ))}
          </div>

          <select
            aria-label="Filter by Service Category"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2 text-xs font-medium border border-slate-300 rounded-lg bg-white text-slate-700"
          >
            <option value="All">All Services</option>
            <option value="AI/ML">AI/ML</option>
            <option value="AI Automation">AI Automation</option>
            <option value="Full-Stack Development">Full-Stack Development</option>
            <option value="CRM Automation">CRM Automation</option>
            <option value="Cloud Infrastructure">Cloud Infrastructure</option>
            <option value="Digital Marketing">Digital Marketing</option>
            <option value="Other">Other</option>
          </select>

          <select
            aria-label="Filter by Email Approval"
            value={approvalFilter}
            onChange={(e) => setApprovalFilter(e.target.value)}
            className="px-3 py-2 text-xs font-medium border border-slate-300 rounded-lg bg-white text-slate-700"
          >
            <option value="All">All Approval States</option>
            <option value="pending_review">Pending Review</option>
            <option value="approved">Approved</option>
            <option value="needs_revision">Needs Revision</option>
          </select>
        </div>

        <a
          href={api.getCsvExportUrl()}
          download
          className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
        >
          <Download className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Export All CSV</span>
        </a>
      </div>

      {/* Results Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-6 py-3.5 border-b border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <span className="font-mono-nums">
            Showing {items.length} {items.length === 1 ? 'record' : 'records'}
          </span>
          <span>Click any row to view full analysis &amp; proposal</span>
        </div>

        {loading ? (
          <div className="p-8 space-y-3">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="h-10 bg-slate-100 rounded animate-pulse" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <p className="text-sm font-medium text-slate-800">No matching inquiries found</p>
            <p className="text-xs text-slate-500">
              Try clearing your search query or adjusting the priority/service filters.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-medium text-slate-500">
                  <th className="py-2.5 px-6">ID</th>
                  <th className="py-2.5 px-4">Company &amp; Contact</th>
                  <th className="py-2.5 px-4">Service Category</th>
                  <th className="py-2.5 px-4">Lead Priority</th>
                  <th className="py-2.5 px-4">Engine</th>
                  <th className="py-2.5 px-4">Email Gate</th>
                  <th className="py-2.5 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {items.map((inq) => (
                  <tr
                    key={inq.id}
                    onClick={() => onSelectInquiry(inq.id)}
                    className="hover:bg-slate-50 cursor-pointer transition-colors"
                  >
                    <td className="py-3 px-6 font-mono-nums text-xs text-slate-500">
                      #{inq.id}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-900">{inq.company}</div>
                      <div className="text-xs text-slate-500">
                        {inq.client_name} · {inq.client_email}
                      </div>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap text-slate-800">
                      <div>{inq.analysis?.service_category || 'Pending'}</div>
                      <div className="text-xs text-slate-500 truncate max-w-[200px]">
                        {inq.analysis?.recommended_cynbit_service}
                      </div>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      {inq.analysis && (
                        <PriorityText
                          priority={inq.analysis.priority_label}
                          score={inq.analysis.priority_score}
                        />
                      )}
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-600 whitespace-nowrap">
                      {inq.processing_mode === 'openai_llm'
                        ? 'OpenAI GPT-4o-mini'
                        : 'Deterministic Fallback'}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      {inq.email_draft && <ApprovalText status={inq.email_draft.approval_status} />}
                    </td>
                    <td
                      className="py-3 px-6 text-right whitespace-nowrap"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {confirmDeleteId === inq.id ? (
                        <span className="inline-flex items-center gap-2 text-xs">
                          <button
                            type="button"
                            onClick={() => handleDelete(inq.id)}
                            className="text-red-700 font-medium hover:underline"
                          >
                            Confirm
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="text-slate-500 hover:text-slate-800"
                          >
                            Cancel
                          </button>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => onSelectInquiry(inq.id)}
                            className="text-xs font-medium text-blue-700 hover:text-blue-900"
                          >
                            Open
                          </button>
                          <button
                            type="button"
                            aria-label={`Delete inquiry ${inq.id}`}
                            onClick={() => setConfirmDeleteId(inq.id)}
                            className="text-slate-400 hover:text-red-600 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                          </button>
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
