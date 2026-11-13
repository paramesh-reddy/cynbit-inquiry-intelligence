import type { InquiryInput, PreprocessedInquiry } from '../types.ts';

const FREE_EMAIL_DOMAINS = new Set([
  'gmail.com',
  'yahoo.com',
  'hotmail.com',
  'outlook.com',
  'icloud.com',
  'proton.me',
  'protonmail.com',
]);

const KNOWN_INTEGRATIONS = [
  'HubSpot',
  'Salesforce',
  'Zoho',
  'Razorpay',
  'Stripe',
  'WhatsApp',
  'AWS',
  'GCP',
  'Azure',
  'PostgreSQL',
  'Docker',
  'Practo',
  'Google',
  'Meta',
  'LinkedIn',
  'ERP',
  'CRM',
  'Slack',
  'Shopify',
  'GST',
  'Prometheus',
];

const URGENCY_KEYWORDS = [
  'urgent',
  'immediately',
  'immediate',
  'asap',
  'critical',
  'outage',
  'outages',
  'losing',
  'missed',
  'misses',
  'flash sales',
  'peak',
  'deadline',
  'within 2 weeks',
  'within 3 weeks',
  'within 4 weeks',
  'this month',
];

export function validateInquiryInput(raw: Partial<InquiryInput>): {
  valid: boolean;
  errors: string[];
  sanitized?: InquiryInput;
} {
  const errors: string[] = [];

  const client_name = (raw.client_name || '').trim();
  const client_email = (raw.client_email || '').trim();
  const company = (raw.company || '').trim();
  const industry = (raw.industry || 'Technology').trim();
  const budget_range = (raw.budget_range || 'Undisclosed / Exploring').trim();
  const timeline = (raw.timeline || 'Flexible (Exploratory)').trim();
  const project_description = (raw.project_description || '').trim();

  if (client_name.length < 2) {
    errors.push('Client name must be at least 2 characters.');
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(client_email)) {
    errors.push('A valid client email address is required.');
  }
  if (company.length < 2) {
    errors.push('Company or organization name is required.');
  }
  if (project_description.length < 20) {
    errors.push('Project description must contain at least 20 characters for accurate analysis.');
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    errors: [],
    sanitized: {
      client_name,
      client_email,
      company,
      industry,
      budget_range,
      timeline,
      project_description,
    },
  };
}

export function parseBudgetEstimateUsd(budgetRange: string, description: string): number | null {
  const combined = `${budgetRange} ${description}`.replace(/,/g, '');
  const dollarMatches = Array.from(combined.matchAll(/\$?\s*(\d{3,6})\s*(k)?/gi));
  const values: number[] = [];

  for (const match of dollarMatches) {
    const rawNum = Number(match[1]);
    if (!Number.isFinite(rawNum)) continue;
    const isK = Boolean(match[2]);
    const val = isK ? rawNum * 1000 : rawNum;
    if (val >= 500 && val <= 1000000) {
      values.push(val);
    }
  }

  if (values.length === 0) {
    if (/undisclosed|exploring|tbd|not sure/i.test(budgetRange)) {
      return null;
    }
    return null;
  }

  return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
}

export function parseTimelineWeeks(timeline: string, description: string): number | null {
  const combined = `${timeline} ${description}`.toLowerCase();
  if (/immediate|asap|urgent/.test(combined)) {
    const weekMatch = combined.match(/(\d+)\s*week/);
    if (weekMatch) return Number(weekMatch[1]);
    return 3;
  }
  const weekMatch = combined.match(/(\d+)\s*(?:-\s*(\d+))?\s*week/);
  if (weekMatch) {
    const minW = Number(weekMatch[1]);
    const maxW = weekMatch[2] ? Number(weekMatch[2]) : minW;
    return Math.round((minW + maxW) / 2);
  }
  const monthMatch = combined.match(/(\d+)\s*(?:-\s*(\d+))?\s*month/);
  if (monthMatch) {
    const minM = Number(monthMatch[1]);
    const maxM = monthMatch[2] ? Number(monthMatch[2]) : minM;
    return Math.round(((minM + maxM) / 2) * 4);
  }
  if (/flexible|exploratory|no rush/.test(combined)) {
    return 24;
  }
  return null;
}

export function preprocessInquiry(input: InquiryInput): PreprocessedInquiry {
  const normalized_text = input.project_description.replace(/\s+/g, ' ').trim();
  const word_count = normalized_text.split(/\s+/).filter(Boolean).length;

  const extracted_integrations = KNOWN_INTEGRATIONS.filter((term) =>
    new RegExp(`\\b${term}\\b`, 'i').test(normalized_text)
  );

  const metricMatches = normalized_text.match(
    /\b\d[\d,]*\+?\s*(?:calls?|units?|centers?|clinics?|invoices?|pdfs?|days?|weeks?|months?|%|users?|leads?)\b/gi
  );
  const extracted_metrics = metricMatches ? Array.from(new Set(metricMatches)) : [];

  const combinedLower = `${input.timeline} ${normalized_text}`.toLowerCase();
  const urgency_signals = URGENCY_KEYWORDS.filter((kw) => combinedLower.includes(kw));

  const emailDomain = input.client_email.split('@')[1]?.toLowerCase() || '';
  const has_corporate_email = Boolean(emailDomain && !FREE_EMAIL_DOMAINS.has(emailDomain));

  return {
    ...input,
    normalized_text,
    word_count,
    extracted_integrations,
    extracted_metrics,
    urgency_signals,
    estimated_budget_usd: parseBudgetEstimateUsd(input.budget_range, normalized_text),
    timeline_weeks: parseTimelineWeeks(input.timeline, normalized_text),
    has_corporate_email,
  };
}

export function parseRawInquiryText(rawText: string): InquiryInput {
  const text = rawText.trim();

  const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  const client_email = emailMatch ? emailMatch[0] : 'prospect@company.com';

  const nameMatch =
    text.match(/(?:name|from|regards|thanks|sincerely)[:,\-\s]+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i) ||
    text.match(/^hi[,!\s]+i[' ]?m\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/im);
  const client_name = nameMatch ? nameMatch[1].trim() : 'Inbound Prospect';

  const companyMatch = text.match(/(?:company|at|from|organization)[:\s]+([A-Z][A-Za-z0-9&\s]{2,30})/i);
  const domainPart = client_email.split('@')[1]?.split('.')[0] || 'Client Org';
  const company = companyMatch
    ? companyMatch[1].split(/[.,\n]/)[0].trim()
    : domainPart.charAt(0).toUpperCase() + domainPart.slice(1);

  let budget_range = 'Undisclosed / Exploring';
  const budgetMatch = text.match(/\$\s*\d[\d,]*(?:\s*-\s*\$?\s*\d[\d,]*)?/);
  if (budgetMatch) {
    budget_range = budgetMatch[0].replace(/\s+/g, ' ').trim();
  }

  let timeline = '1 - 3 months';
  if (/urgent|asap|immediate|within\s+\d+\s+week/i.test(text)) {
    timeline = 'Urgent (Within 4 weeks)';
  } else if (/flexible|exploratory|next year/i.test(text)) {
    timeline = 'Flexible (Exploratory)';
  }

  let industry = 'Technology';
  if (/health|clinic|patient|diagnostic|hospital|medical/i.test(text)) industry = 'Healthcare';
  else if (/property|tenant|real estate|rental|lease/i.test(text)) industry = 'Real Estate / PropTech';
  else if (/fintech|invoice|accounting|erp|gst|bank|payment/i.test(text)) industry = 'FinTech';
  else if (/ecommerce|e-commerce|retail|store|d2c|shopify/i.test(text)) industry = 'E-Commerce & Retail';
  else if (/logistics|freight|supply chain|delivery/i.test(text)) industry = 'Logistics';
  else if (/student|bootcamp|education|edtech|internship/i.test(text)) industry = 'EdTech';

  return {
    client_name,
    client_email,
    company,
    industry,
    budget_range,
    timeline,
    project_description: text,
  };
}
