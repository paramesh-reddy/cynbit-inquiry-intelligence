import OpenAI from 'openai';
import { config, isOpenAIConfigured } from '../config.ts';
import type {
  AppSettings,
  ImplementationPhase,
  KnowledgeItem,
  KnowledgeMatch,
  PreprocessedInquiry,
  ProcessingMode,
  ServiceCategory,
  SolutionArchitecture,
} from '../types.ts';
import type { LeadScoreResult } from './leadScorer.ts';

export interface AIPipelineOutput {
  processing_mode: ProcessingMode;
  llm_provider: string;
  service_category: ServiceCategory;
  secondary_category: ServiceCategory | null;
  confidence_score: number;
  client_problem: string;
  business_objectives: string[];
  expected_features: string[];
  technical_requirements: string[];
  recommended_cynbit_service: string;
  solution_architecture: SolutionArchitecture;
  proposal: {
    title: string;
    problem_statement: string;
    proposed_solution: string;
    recommended_technologies: string[];
    implementation_phases: ImplementationPhase[];
    estimated_complexity: 'Low' | 'Medium' | 'High';
    estimated_timeline: string;
    preliminary_disclaimer: string;
  };
  email_draft: {
    subject: string;
    body: string;
  };
  processing_notes: string;
}

const CATEGORY_KEYWORDS: Array<{ category: ServiceCategory; keywords: string[]; weight: number }> = [
  {
    category: 'AI Automation',
    keywords: ['invoice', 'invoices', 'pdf', 'erp', 'document extraction', 'workflow automation', 'autonomous agent', 'llm', 'triage', 'validation agent', 'human-in-the-loop'],
    weight: 1.2,
  },
  {
    category: 'AI/ML',
    keywords: ['voice agent', 'inbound calls', 'phone inquiries', 'hindi', 'speech', 'sentiment', 'review intelligence', 'revio', 'nlp', 'machine learning', 'ai voice', 'ai assistant'],
    weight: 1.2,
  },
  {
    category: 'Full-Stack Development',
    keywords: ['portal', 'dashboard', 'tenantease', 'web app', 'mobile app', 'razorpay', 'rental', 'tenant', 'saas', 'full-stack', 'custom platform', 'landlord'],
    weight: 1.1,
  },
  {
    category: 'CRM Automation',
    keywords: ['crm', 'hubspot', 'zoho', 'salesforce', 'lead scoring', 'follow-up', 'whatsapp', 'pipeline', 'nurturing', 'sales reps', 'spreadsheets'],
    weight: 1.15,
  },
  {
    category: 'Cloud Infrastructure',
    keywords: ['aws', 'gcp', 'azure', 'docker', 'kubernetes', 'autoscaling', 'rds', 'ci/cd', 'prometheus', 'outages', 'monolithic', 'vm', 'infrastructure'],
    weight: 1.2,
  },
  {
    category: 'Digital Marketing',
    keywords: ['seo', 'core web vitals', 'organic traffic', 'google shopping', 'meta ads', 'schema', 'campaign', 'search rankings', 'd2c'],
    weight: 1.15,
  },
  {
    category: 'Other',
    keywords: ['bootcamp', 'internship', 'bitelevate', 'cynbit studio', 'cohort', 'mentorship', 'partnership', 'training'],
    weight: 1.1,
  },
];

const PRELIMINARY_DISCLAIMER =
  'Preliminary AI-assisted suggestion for internal discovery only — not an official Cynbit Technologies commercial quotation or binding timeline.';

function classifyDeterministically(
  inquiry: PreprocessedInquiry,
  kbMatches: KnowledgeMatch[]
): {
  primary: ServiceCategory;
  secondary: ServiceCategory | null;
  confidence: number;
} {
  const lower = inquiry.normalized_text.toLowerCase();
  const scores = new Map<ServiceCategory, number>();

  for (const rule of CATEGORY_KEYWORDS) {
    let score = 0;
    for (const kw of rule.keywords) {
      if (lower.includes(kw)) {
        score += kw.includes(' ') ? 2.2 * rule.weight : 1.4 * rule.weight;
      }
    }
    scores.set(rule.category, score);
  }

  // Blend KB top match score as a gentle prior
  if (kbMatches[0]) {
    const prev = scores.get(kbMatches[0].service_category) || 0;
    scores.set(kbMatches[0].service_category, prev + kbMatches[0].similarity_score * 3.0);
  }

  const ranked = Array.from(scores.entries()).sort((a, b) => b[1] - a[1]);
  const primary = ranked[0] && ranked[0][1] > 0 ? ranked[0][0] : kbMatches[0]?.service_category || 'Other';
  const secondary = ranked[1] && ranked[1][1] >= 1.5 && ranked[1][0] !== primary ? ranked[1][0] : null;
  const topVal = ranked[0]?.[1] || 0;
  const confidence = Number(Math.min(0.95, Math.max(0.55, 0.55 + topVal * 0.06)).toFixed(2));

  return { primary, secondary, confidence };
}

function buildDeterministicOutput(
  inquiry: PreprocessedInquiry,
  kbMatches: KnowledgeMatch[],
  kbItems: KnowledgeItem[],
  leadScore: LeadScoreResult,
  settings: AppSettings,
  fallbackReason: string
): AIPipelineOutput {
  const classification = classifyDeterministically(inquiry, kbMatches);
  const topKb = kbItems.find((item) => item.id === kbMatches[0]?.id) || kbItems[0];

  const sentences = inquiry.normalized_text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 10);

  const client_problem =
    sentences.slice(0, 2).join(' ') ||
    `${inquiry.company} requires specialized ${classification.primary} engineering to modernize manual operational workflows.`;

  const featureCandidates: string[] = [];
  const lower = inquiry.normalized_text.toLowerCase();

  if (lower.includes('voice') || lower.includes('call')) {
    featureCandidates.push('Conversational inbound voice intake with multi-language intent routing');
  }
  if (lower.includes('book') || lower.includes('slot') || lower.includes('appointment')) {
    featureCandidates.push('Automated slot booking and scheduling integration');
  }
  if (lower.includes('escalat') || lower.includes('human')) {
    featureCandidates.push('Human-in-the-loop escalation and review queue');
  }
  if (lower.includes('dashboard') || lower.includes('analytics') || lower.includes('report')) {
    featureCandidates.push('Executive operational analytics and reporting dashboard');
  }
  if (lower.includes('invoice') || lower.includes('pdf') || lower.includes('document')) {
    featureCandidates.push('Automated PDF/document parsing, field extraction, and anomaly validation');
  }
  if (lower.includes('review') || lower.includes('sentiment')) {
    featureCandidates.push('Multi-platform review ingestion, sentiment scoring, and response drafting');
  }
  if (lower.includes('rent') || lower.includes('tenant') || lower.includes('lease')) {
    featureCandidates.push('Tenant lifecycle tracking, automated rent invoicing, and maintenance ticketing');
  }
  if (lower.includes('crm') || lower.includes('lead') || lower.includes('follow-up')) {
    featureCandidates.push('Automated lead capture, scoring rules, and multi-channel nurture sequences');
  }
  if (lower.includes('autoscale') || lower.includes('docker') || lower.includes('ci/cd') || lower.includes('aws')) {
    featureCandidates.push('Containerized autoscaling infrastructure with zero-downtime CI/CD');
  }
  if (lower.includes('seo') || lower.includes('schema') || lower.includes('web vitals')) {
    featureCandidates.push('Technical SEO remediation, Schema.org markup, and Core Web Vitals optimization');
  }
  if (featureCandidates.length < 3 && topKb) {
    for (const cap of topKb.capabilities) {
      if (featureCandidates.length < 4 && !featureCandidates.includes(cap)) {
        featureCandidates.push(cap);
      }
    }
  }

  const business_objectives = [
    `Address core operational bottleneck for ${inquiry.company} in ${inquiry.industry}`,
    inquiry.extracted_metrics.length > 0
      ? `Support target workload scale (${inquiry.extracted_metrics.join(', ')})`
      : `Improve turnaround efficiency within ${inquiry.timeline}`,
    `Align delivery with Cynbit's ${topKb?.title || classification.primary} practice`,
  ];

  const integrationsText =
    inquiry.extracted_integrations.length > 0
      ? inquiry.extracted_integrations
      : ['REST Webhook APIs', 'PostgreSQL Persistence'];

  const technical_requirements = [
    `Primary architecture aligned with ${classification.primary}`,
    `External system connectivity: ${integrationsText.join(', ')}`,
    'Input validation, structured audit logging, and role-based access control',
    leadScore.urgency_level === 'High'
      ? 'Rapid phased rollout prioritizing critical-path automation first'
      : 'Modular staged implementation with production observability',
  ];

  const recommendedTech = Array.from(
    new Set([
      ...(topKb?.typical_stack || ['Python', 'FastAPI', 'React', 'PostgreSQL']),
      ...inquiry.extracted_integrations,
    ])
  ).slice(0, 7);

  const complexity: 'Low' | 'Medium' | 'High' =
    leadScore.priority_score >= 75 || inquiry.extracted_integrations.length >= 2
      ? 'High'
      : leadScore.priority_score >= 45
      ? 'Medium'
      : 'Low';

  const estimatedTimeline =
    complexity === 'High' ? '6 - 10 weeks (Phased Delivery)' : complexity === 'Medium' ? '4 - 6 weeks' : '2 - 4 weeks';

  const solution_architecture: SolutionArchitecture = {
    overview: `Modular ${classification.primary} solution anchored on ${topKb?.title || 'Cynbit Core Engineering'}, combining an API-first backend, deterministic business validation rules, and human-reviewed operational controls.`,
    components: [
      'API Gateway & Input Validation Layer (FastAPI / Pydantic)',
      `Core ${classification.primary} Processing & Orchestration Engine`,
      'Relational Data Store (PostgreSQL) with Audit Trail',
      'React + TypeScript Operational Review & Analytics Workspace',
    ],
    integrations: integrationsText,
    deployment_notes:
      'Containerized deployment suitable for AWS/GCP/Render with environment-isolated secrets and automated health checks.',
  };

  const implementation_phases: ImplementationPhase[] = [
    {
      phase: 'Phase 1: Discovery & Architecture Blueprint',
      duration: 'Week 1',
      deliverables: [
        `Workflow audit for ${inquiry.company}'s current ${inquiry.industry} operations`,
        `Integration specification for ${integrationsText.slice(0, 3).join(', ')}`,
        'Data schema and acceptance criteria sign-off',
      ],
    },
    {
      phase: 'Phase 2: Core Engine & Integration Build',
      duration: complexity === 'High' ? 'Weeks 2 - 6' : 'Weeks 2 - 4',
      deliverables: [
        `Implementation of ${featureCandidates[0] || 'core automation pipeline'}`,
        'API endpoints, validation safeguards, and fallback handling',
        'Staging environment with sample data verification',
      ],
    },
    {
      phase: 'Phase 3: UAT, Hardening & Production Rollout',
      duration: complexity === 'High' ? 'Weeks 7 - 9' : 'Final Week',
      deliverables: [
        'End-to-end automated & user acceptance testing',
        'Monitoring dashboards, documentation, and team handover',
      ],
    },
  ];

  const emailSubject = `Next steps on ${inquiry.company}'s ${classification.primary} initiative — Cynbit Technologies`;
  const emailBody = `Hi ${inquiry.client_name},

Thank you for reaching out to Cynbit Technologies regarding ${inquiry.company}'s upcoming ${classification.primary.toLowerCase()} initiative.

We reviewed your requirements around ${featureCandidates[0]?.toLowerCase() || 'streamlining your operational workflows'}${
    inquiry.extracted_integrations.length > 0
      ? ` and integrating with ${inquiry.extracted_integrations.slice(0, 3).join(', ')}`
      : ''
  }. This aligns closely with our ${topKb?.title || classification.primary} capabilities.

To make our initial discovery conversation productive, we would love to walk through:
1. Your current operational volume and edge-case escalation rules
2. Integration access requirements for ${integrationsText.slice(0, 2).join(' and ')}
3. A phased rollout plan targeting your ${inquiry.timeline} timeline

Would you be available for a 25-minute technical scoping call this week? Please share two time slots that work best for your team.

Best regards,
${settings.reviewer_name}
${settings.reviewer_role}
${settings.company_signature}`;

  return {
    processing_mode: 'deterministic_fallback',
    llm_provider: 'Deterministic Rule + TF-IDF Engine',
    service_category: classification.primary,
    secondary_category: classification.secondary,
    confidence_score: classification.confidence,
    client_problem,
    business_objectives,
    expected_features: featureCandidates,
    technical_requirements,
    recommended_cynbit_service: topKb?.title || classification.primary,
    solution_architecture,
    proposal: {
      title: `Preliminary Technical Proposal: ${inquiry.company} — ${classification.primary}`,
      problem_statement: client_problem,
      proposed_solution: `Cynbit Technologies recommends a modular ${classification.primary} architecture leveraging ${
        topKb?.title || 'our engineering stack'
      } to address ${inquiry.company}'s objectives while preserving human oversight on critical decisions.`,
      recommended_technologies: recommendedTech,
      implementation_phases,
      estimated_complexity: complexity,
      estimated_timeline: estimatedTimeline,
      preliminary_disclaimer: PRELIMINARY_DISCLAIMER,
    },
    email_draft: {
      subject: emailSubject,
      body: emailBody,
    },
    processing_notes: fallbackReason,
  };
}

export async function runAIPipeline(
  inquiry: PreprocessedInquiry,
  kbMatches: KnowledgeMatch[],
  kbItems: KnowledgeItem[],
  leadScore: LeadScoreResult,
  settings: AppSettings
): Promise<AIPipelineOutput> {
  const shouldUseOpenAI =
    settings.preferred_ai_mode !== 'deterministic' && isOpenAIConfigured();

  if (!shouldUseOpenAI) {
    const reason =
      settings.preferred_ai_mode === 'deterministic'
        ? 'Processed in Deterministic Fallback Mode as configured in Workspace Settings.'
        : 'OPENAI_API_KEY not configured; processed via transparent Deterministic Fallback + TF-IDF Engine.';
    return buildDeterministicOutput(inquiry, kbMatches, kbItems, leadScore, settings, reason);
  }

  try {
    const client = new OpenAI({ apiKey: config.openaiApiKey });
    const kbContext = kbMatches
      .map(
        (m, idx) =>
          `${idx + 1}. ${m.title} (${m.service_category}, similarity=${m.similarity_score}): ${m.summary}`
      )
      .join('\n');

    const systemPrompt = `You are a Principal AI Solutions Architect at Cynbit Technologies (cynbit.in).
Analyze the incoming client inquiry strictly using the provided client text and Cynbit Public Knowledge Base context.
Never invent private customer metrics or non-public company guarantees.
Return valid JSON matching this exact schema:
{
  "service_category": "AI/ML" | "AI Automation" | "Full-Stack Development" | "CRM Automation" | "Cloud Infrastructure" | "Digital Marketing" | "Other",
  "secondary_category": string | null,
  "confidence_score": number (0.0 to 1.0),
  "client_problem": string,
  "business_objectives": string[],
  "expected_features": string[],
  "technical_requirements": string[],
  "recommended_cynbit_service": string,
  "solution_architecture": {
    "overview": string,
    "components": string[],
    "integrations": string[],
    "deployment_notes": string
  },
  "proposal": {
    "title": string,
    "problem_statement": string,
    "proposed_solution": string,
    "recommended_technologies": string[],
    "implementation_phases": [{ "phase": string, "duration": string, "deliverables": string[] }],
    "estimated_complexity": "Low" | "Medium" | "High",
    "estimated_timeline": string
  },
  "email_draft": {
    "subject": string,
    "body": string
  }
}`;

    const userPrompt = `Client Name: ${inquiry.client_name}
Company: ${inquiry.company}
Industry: ${inquiry.industry}
Budget Range: ${inquiry.budget_range}
Timeline: ${inquiry.timeline}
Deterministic Lead Score: ${leadScore.priority_score}/100 (${leadScore.priority_label})
Project Description: ${inquiry.normalized_text}

Retrieved Cynbit Knowledge Base Matches:
${kbContext}

Sign the email draft as:
${settings.reviewer_name}
${settings.reviewer_role}
${settings.company_signature}`;

    const response = await client.chat.completions.create({
      model: config.openaiModel,
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('Empty response received from OpenAI API.');
    }

    const parsed = JSON.parse(content);
    const validCategories: ServiceCategory[] = [
      'AI/ML',
      'AI Automation',
      'Full-Stack Development',
      'CRM Automation',
      'Cloud Infrastructure',
      'Digital Marketing',
      'Other',
    ];
    const primaryCat = validCategories.includes(parsed.service_category)
      ? (parsed.service_category as ServiceCategory)
      : classifyDeterministically(inquiry, kbMatches).primary;

    return {
      processing_mode: 'openai_llm',
      llm_provider: `OpenAI (${config.openaiModel})`,
      service_category: primaryCat,
      secondary_category: validCategories.includes(parsed.secondary_category)
        ? parsed.secondary_category
        : null,
      confidence_score: Number(parsed.confidence_score) || 0.85,
      client_problem: parsed.client_problem || inquiry.normalized_text,
      business_objectives: Array.isArray(parsed.business_objectives) ? parsed.business_objectives : [],
      expected_features: Array.isArray(parsed.expected_features) ? parsed.expected_features : [],
      technical_requirements: Array.isArray(parsed.technical_requirements)
        ? parsed.technical_requirements
        : [],
      recommended_cynbit_service:
        parsed.recommended_cynbit_service || kbMatches[0]?.title || primaryCat,
      solution_architecture: parsed.solution_architecture || {
        overview: 'Modular cloud-ready architecture',
        components: [],
        integrations: inquiry.extracted_integrations,
        deployment_notes: 'Standard containerized deployment',
      },
      proposal: {
        title: parsed.proposal?.title || `Preliminary Proposal: ${inquiry.company}`,
        problem_statement: parsed.proposal?.problem_statement || parsed.client_problem,
        proposed_solution: parsed.proposal?.proposed_solution || '',
        recommended_technologies: Array.isArray(parsed.proposal?.recommended_technologies)
          ? parsed.proposal.recommended_technologies
          : [],
        implementation_phases: Array.isArray(parsed.proposal?.implementation_phases)
          ? parsed.proposal.implementation_phases
          : [],
        estimated_complexity: ['Low', 'Medium', 'High'].includes(
          parsed.proposal?.estimated_complexity
        )
          ? parsed.proposal.estimated_complexity
          : 'Medium',
        estimated_timeline: parsed.proposal?.estimated_timeline || inquiry.timeline,
        preliminary_disclaimer: PRELIMINARY_DISCLAIMER,
      },
      email_draft: {
        subject: parsed.email_draft?.subject || `Regarding your inquiry — Cynbit Technologies`,
        body: parsed.email_draft?.body || '',
      },
      processing_notes: `Structured JSON synthesis completed via OpenAI ${config.openaiModel} with Cynbit KB context injection.`,
    };
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : 'Unknown OpenAI error';
    return buildDeterministicOutput(
      inquiry,
      kbMatches,
      kbItems,
      leadScore,
      settings,
      `OpenAI invocation fell back cleanly to Deterministic Engine (${errMsg}).`
    );
  }
}
