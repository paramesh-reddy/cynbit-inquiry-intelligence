export type ServiceCategory =
  | 'AI/ML'
  | 'AI Automation'
  | 'Full-Stack Development'
  | 'CRM Automation'
  | 'Cloud Infrastructure'
  | 'Digital Marketing'
  | 'Other';

export type PriorityLevel = 'High' | 'Medium' | 'Low';
export type UrgencyLevel = 'High' | 'Medium' | 'Low';
export type ApprovalStatus = 'pending_review' | 'approved' | 'needs_revision';
export type ProcessingMode = 'openai_llm' | 'deterministic_fallback';

export interface KnowledgeItem {
  id: string;
  title: string;
  service_category: ServiceCategory;
  offering_type: string;
  source_url: string;
  summary: string;
  capabilities: string[];
  typical_stack: string[];
  ideal_for: string;
}

export interface KnowledgeMatch {
  id: string;
  title: string;
  service_category: ServiceCategory;
  offering_type: string;
  source_url: string;
  similarity_score: number;
  matched_terms: string[];
  summary: string;
}

export interface ScoreFactor {
  factor: string;
  points: number;
  max_points: number;
  reason: string;
}

export interface SolutionArchitecture {
  overview: string;
  components: string[];
  integrations: string[];
  deployment_notes: string;
}

export interface ImplementationPhase {
  phase: string;
  duration: string;
  deliverables: string[];
}

export interface InquiryAnalysis {
  inquiry_id: number;
  service_category: ServiceCategory;
  secondary_category: ServiceCategory | null;
  confidence_score: number;
  client_problem: string;
  business_objectives: string[];
  expected_features: string[];
  technical_requirements: string[];
  urgency_level: UrgencyLevel;
  priority_label: PriorityLevel;
  priority_score: number;
  score_breakdown: ScoreFactor[];
  score_explanation: string;
  recommended_cynbit_service: string;
  matched_kb_items: KnowledgeMatch[];
  solution_architecture: SolutionArchitecture;
  processing_notes: string;
}

export interface Proposal {
  id: number;
  inquiry_id: number;
  title: string;
  problem_statement: string;
  proposed_solution: string;
  recommended_technologies: string[];
  implementation_phases: ImplementationPhase[];
  estimated_complexity: 'Low' | 'Medium' | 'High';
  estimated_timeline: string;
  preliminary_disclaimer: string;
  created_at: string;
  updated_at: string;
}

export interface EmailDraft {
  id: number;
  inquiry_id: number;
  recipient_email: string;
  recipient_name: string;
  subject: string;
  body: string;
  approval_status: ApprovalStatus;
  reviewer_notes: string;
  approved_by: string | null;
  approved_at: string | null;
  updated_at: string;
}

export interface InquiryRecord {
  id: number;
  client_name: string;
  client_email: string;
  company: string;
  industry: string;
  budget_range: string;
  timeline: string;
  project_description: string;
  status: string;
  processing_mode: ProcessingMode;
  llm_provider: string;
  created_at: string;
  updated_at: string;
  analysis?: InquiryAnalysis;
  proposal?: Proposal;
  email_draft?: EmailDraft;
}

export interface DashboardMetrics {
  total_inquiries: number;
  high_priority_count: number;
  medium_priority_count: number;
  low_priority_count: number;
  pending_approvals_count: number;
  approved_responses_count: number;
  average_priority_score: number;
  category_distribution: Array<{ category: string; count: number; percentage: number }>;
  recent_inquiries: InquiryRecord[];
  active_processing_mode: ProcessingMode;
  openai_configured: boolean;
}

export interface AppSettings {
  reviewer_name: string;
  reviewer_role: string;
  company_signature: string;
  preferred_ai_mode: 'auto' | 'deterministic';
  high_priority_threshold: number;
  medium_priority_threshold: number;
}

export interface SettingsResponse {
  settings: AppSettings;
  environment: {
    openai_configured: boolean;
    openai_model: string;
    active_processing_mode: ProcessingMode;
    database_engine: string;
  };
}
