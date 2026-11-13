import { ArrowUpRight, Plus } from 'lucide-react';
import type { DashboardMetrics, InquiryRecord } from '../types';
import { ApprovalText, PriorityText } from './PriorityText';

interface DashboardViewProps {
  metrics: DashboardMetrics | null;
  loading: boolean;
  onSelectInquiry: (id: number) => void;
  onNavigate: (view: 'new-inquiry' | 'inquiries') => void;
}

export function DashboardView({
  metrics,
  loading,
  onSelectInquiry,
  onNavigate,
}: DashboardViewProps) {
  if (loading && !metrics) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 border border-slate-200 rounded-xl bg-white divide-y sm:divide-y-0 sm:divide-x divide-slate-200">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="p-6 space-y-2 animate-pulse">
              <div className="h-3.5 w-24 bg-slate-200 rounded" />
              <div className="h-7 w-16 bg-slate-200 rounded" />
            </div>
          ))}
        </div>
        <div className="h-64 bg-white border border-slate-200 rounded-xl animate-pulse" />
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-10 text-center">
        <h2 className="text-base font-semibold text-slate-900">Unable to load dashboard metrics</h2>
        <p className="text-sm text-slate-500 mt-1">
          Verify the backend server is running and refresh the view.
        </p>
      </div>
    );
  }

  const total = metrics.total_inquiries;
  const highPct = total > 0 ? Math.round((metrics.high_priority_count / total) * 100) : 0;
  const medPct = total > 0 ? Math.round((metrics.medium_priority_count / total) * 100) : 0;
  const lowPct = total > 0 ? Math.max(0, 100 - highPct - medPct) : 0;

  return (
    <div className="space-y-8">
      {/* KPI Strip — single clean container with hairline dividers */}
      <section
        aria-label="Key Metrics"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 bg-white border border-slate-200 rounded-xl divide-y sm:divide-y-0 sm:divide-x divide-slate-200"
      >
        <div className="p-6">
          <div className="text-xs font-medium text-slate-500">Total Inquiries</div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-3xl font-semibold tracking-tight text-slate-900 font-mono-nums">
              {metrics.total_inquiries}
            </span>
            <span className="text-xs text-slate-500 font-mono-nums">
              Avg {metrics.average_priority_score}/100
            </span>
          </div>
        </div>

        <div className="p-6">
          <div className="text-xs font-medium text-slate-500">High-Priority Leads</div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-3xl font-semibold tracking-tight text-emerald-700 font-mono-nums">
              {metrics.high_priority_count}
            </span>
            <span className="text-xs text-slate-500 font-mono-nums">{highPct}% of pipeline</span>
          </div>
        </div>

        <div className="p-6">
          <div className="text-xs font-medium text-slate-500">Medium &amp; Low Leads</div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-3xl font-semibold tracking-tight text-slate-900 font-mono-nums">
              {metrics.medium_priority_count + metrics.low_priority_count}
            </span>
            <span className="text-xs text-slate-500 font-mono-nums">
              {metrics.medium_priority_count} Med · {metrics.low_priority_count} Low
            </span>
          </div>
        </div>

        <div className="p-6">
          <div className="text-xs font-medium text-slate-500">Pending Email Review</div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-3xl font-semibold tracking-tight text-amber-700 font-mono-nums">
              {metrics.pending_approvals_count}
            </span>
            <span className="text-xs text-slate-500 font-mono-nums">
              {metrics.approved_responses_count} Approved
            </span>
          </div>
        </div>
      </section>

      {/* Distribution Analytics — 2 balanced columns */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Service Category Distribution */}
        <section className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-4 pb-4 border-b border-slate-100">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  Service Category Distribution
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Classified across Cynbit engineering and product practices
                </p>
              </div>
              <span className="text-xs text-slate-500 font-mono-nums">
                {metrics.category_distribution.length} active tracks
              </span>
            </div>

            {metrics.category_distribution.length === 0 ? (
              <div className="py-12 text-center text-sm text-slate-500">
                No inquiries analyzed yet. Submit an inquiry to view category distribution.
              </div>
            ) : (
              <div className="mt-5 space-y-4">
                {metrics.category_distribution.map((item) => (
                  <div key={item.category} className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-slate-800">{item.category}</span>
                      <span className="text-xs text-slate-500 font-mono-nums">
                        {item.count} {item.count === 1 ? 'inquiry' : 'inquiries'} · {item.percentage}%
                      </span>
                    </div>
                    <div className="h-2 w-full bg-slate-100 rounded-sm overflow-hidden">
                      <div
                        className="h-full bg-blue-700 rounded-sm transition-all duration-300"
                        style={{ width: `${Math.max(item.percentage, 4)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Priority & Processing Engine Summary */}
        <section className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between">
          <div className="space-y-6">
            <div className="pb-4 border-b border-slate-100">
              <h2 className="text-base font-semibold text-slate-900">Lead Priority Breakdown</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Transparent 100-point deterministic scoring tiers
              </p>
            </div>

            {/* Segmented proportion bar */}
            <div>
              <div className="h-3 w-full bg-slate-100 rounded-sm overflow-hidden flex">
                {highPct > 0 && (
                  <div
                    className="h-full bg-emerald-600"
                    style={{ width: `${highPct}%` }}
                    title={`High Priority: ${highPct}%`}
                  />
                )}
                {medPct > 0 && (
                  <div
                    className="h-full bg-amber-500"
                    style={{ width: `${medPct}%` }}
                    title={`Medium Priority: ${medPct}%`}
                  />
                )}
                {lowPct > 0 && (
                  <div
                    className="h-full bg-slate-400"
                    style={{ width: `${lowPct}%` }}
                    title={`Low Priority: ${lowPct}%`}
                  />
                )}
              </div>

              <div className="mt-4 divide-y divide-slate-100 text-sm">
                <div className="py-2.5 flex items-center justify-between">
                  <span className="text-slate-700 font-medium">High Priority (70–100 pts)</span>
                  <span className="font-mono-nums text-emerald-700 font-medium">
                    {metrics.high_priority_count} ({highPct}%)
                  </span>
                </div>
                <div className="py-2.5 flex items-center justify-between">
                  <span className="text-slate-700 font-medium">Medium Priority (40–69 pts)</span>
                  <span className="font-mono-nums text-amber-700 font-medium">
                    {metrics.medium_priority_count} ({medPct}%)
                  </span>
                </div>
                <div className="py-2.5 flex items-center justify-between">
                  <span className="text-slate-700 font-medium">Low Priority (0–39 pts)</span>
                  <span className="font-mono-nums text-slate-600 font-medium">
                    {metrics.low_priority_count} ({lowPct}%)
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>
              Engine:{' '}
              <strong className="text-slate-800 font-medium">
                {metrics.active_processing_mode === 'openai_llm'
                  ? 'OpenAI GPT-4o-mini'
                  : 'Deterministic Fallback + TF-IDF'}
              </strong>
            </span>
            <button
              type="button"
              onClick={() => onNavigate('new-inquiry')}
              className="inline-flex items-center gap-1 text-blue-700 hover:text-blue-800 font-medium whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Analyze Inquiry</span>
            </button>
          </div>
        </section>
      </div>

      {/* Recent Inquiries Table */}
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Recent Client Inquiries</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Select any record to inspect scoring rationale, proposal draft, and email approval
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('inquiries')}
            className="text-xs font-medium text-blue-700 hover:text-blue-800 inline-flex items-center gap-1 whitespace-nowrap shrink-0"
          >
            <span>View All Inquiries</span>
            <ArrowUpRight className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        </div>

        {metrics.recent_inquiries.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-sm text-slate-600">No inquiries in database yet.</p>
            <button
              type="button"
              onClick={() => onNavigate('new-inquiry')}
              className="mt-4 px-4 py-2 text-xs font-medium bg-blue-700 text-white rounded-lg hover:bg-blue-800 transition-colors"
            >
              Submit First Inquiry
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-medium text-slate-500">
                  <th className="py-2.5 px-6">Client &amp; Organization</th>
                  <th className="py-2.5 px-4">Service Category</th>
                  <th className="py-2.5 px-4">Lead Priority</th>
                  <th className="py-2.5 px-4">Budget &amp; Timeline</th>
                  <th className="py-2.5 px-4">Email Gate</th>
                  <th className="py-2.5 px-6 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {metrics.recent_inquiries.map((inq: InquiryRecord) => (
                  <tr
                    key={inq.id}
                    onClick={() => onSelectInquiry(inq.id)}
                    className="hover:bg-slate-50/90 cursor-pointer transition-colors"
                  >
                    <td className="py-3 px-6">
                      <div className="font-medium text-slate-900">{inq.company}</div>
                      <div className="text-xs text-slate-500">
                        {inq.client_name} · {inq.industry}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-slate-700 whitespace-nowrap">
                      {inq.analysis?.service_category || 'Pending'}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      {inq.analysis ? (
                        <PriorityText
                          priority={inq.analysis.priority_label}
                          score={inq.analysis.priority_score}
                        />
                      ) : (
                        <span className="text-xs text-slate-400">Pending</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <div className="text-xs text-slate-800 font-mono-nums">{inq.budget_range}</div>
                      <div className="text-xs text-slate-500">{inq.timeline}</div>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      {inq.email_draft && <ApprovalText status={inq.email_draft.approval_status} />}
                    </td>
                    <td className="py-3 px-6 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectInquiry(inq.id);
                        }}
                        className="text-xs font-medium text-blue-700 hover:text-blue-900"
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
