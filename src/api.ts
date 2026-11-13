import type {
  AppSettings,
  ApprovalStatus,
  DashboardMetrics,
  InquiryRecord,
  KnowledgeItem,
  KnowledgeMatch,
  PriorityLevel,
  ServiceCategory,
  SettingsResponse,
} from './types';

const BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(options?.headers || {}) },
    ...options,
  });

  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const data = await res.json();
      if (Array.isArray(data?.details) && data.details.length > 0) {
        message = data.details.join(' ');
      } else if (data?.error) {
        message = data.error;
      }
    } catch {
      // ignore json parse failure
    }
    throw new Error(message);
  }
  return res.json() as Promise<T>;
}

export const api = {
  getDashboardMetrics: () => request<DashboardMetrics>('/api/dashboard/metrics'),

  listInquiries: (params?: {
    q?: string;
    priority?: string;
    category?: string;
    approval?: string;
  }) => {
    const sp = new URLSearchParams();
    if (params?.q) sp.set('q', params.q);
    if (params?.priority && params.priority !== 'All') sp.set('priority', params.priority);
    if (params?.category && params.category !== 'All') sp.set('category', params.category);
    if (params?.approval && params.approval !== 'All') sp.set('approval', params.approval);
    const qs = sp.toString();
    return request<{ items: InquiryRecord[]; total: number }>(
      `/api/inquiries${qs ? `?${qs}` : ''}`
    );
  },

  getInquiry: (id: number) => request<InquiryRecord>(`/api/inquiries/${id}`),

  createInquiry: (payload: {
    client_name: string;
    client_email: string;
    company: string;
    industry: string;
    budget_range: string;
    timeline: string;
    project_description: string;
  }) =>
    request<InquiryRecord>('/api/inquiries', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  quickParseInquiry: (raw_text: string, preview_only = false) =>
    request<InquiryRecord | { parsed: Record<string, string> }>('/api/inquiries/quick-parse', {
      method: 'POST',
      body: JSON.stringify({ raw_text, preview_only }),
    }),

  reanalyzeInquiry: (id: number) =>
    request<InquiryRecord>(`/api/inquiries/${id}/reanalyze`, { method: 'POST' }),

  updateClassification: (
    id: number,
    payload: { service_category?: ServiceCategory; priority_label?: PriorityLevel }
  ) =>
    request<InquiryRecord>(`/api/inquiries/${id}/classification`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  updateProposal: (
    id: number,
    payload: Partial<{
      title: string;
      problem_statement: string;
      proposed_solution: string;
      estimated_complexity: 'Low' | 'Medium' | 'High';
      estimated_timeline: string;
    }>
  ) =>
    request<InquiryRecord>(`/api/inquiries/${id}/proposal`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  updateEmailDraft: (
    id: number,
    payload: {
      subject?: string;
      body?: string;
      approval_status?: ApprovalStatus;
      reviewer_notes?: string;
    }
  ) =>
    request<InquiryRecord>(`/api/inquiries/${id}/email`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  deleteInquiry: (id: number) =>
    request<{ deleted: boolean; id: number }>(`/api/inquiries/${id}`, {
      method: 'DELETE',
    }),

  getKnowledgeBase: (q?: string) =>
    request<{ items: KnowledgeItem[]; matches: KnowledgeMatch[]; query: string }>(
      `/api/knowledge-base${q ? `?q=${encodeURIComponent(q)}` : ''}`
    ),

  getSettings: () => request<SettingsResponse>('/api/settings'),

  updateSettings: (payload: Partial<AppSettings>) =>
    request<SettingsResponse>('/api/settings', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  getCsvExportUrl: (id?: number) =>
    id ? `${BASE}/api/inquiries/${id}/export/csv` : `${BASE}/api/inquiries-export/csv`,
};
