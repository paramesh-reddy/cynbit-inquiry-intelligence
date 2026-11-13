import type {
  KnowledgeMatch,
  PreprocessedInquiry,
  PriorityLevel,
  ScoreFactor,
  UrgencyLevel,
} from '../types.ts';

export interface LeadScoreResult {
  priority_score: number;
  priority_label: PriorityLevel;
  urgency_level: UrgencyLevel;
  score_breakdown: ScoreFactor[];
  score_explanation: string;
}

export function scoreLeadDeterministically(
  inquiry: PreprocessedInquiry,
  kbMatches: KnowledgeMatch[],
  highThreshold = 70,
  mediumThreshold = 40
): LeadScoreResult {
  const breakdown: ScoreFactor[] = [];

  // 1. Budget Alignment (0 - 25 pts)
  let budgetPoints = 6;
  let budgetReason = 'Budget is undisclosed or exploratory.';
  const estBudget = inquiry.estimated_budget_usd;
  if (estBudget !== null) {
    if (estBudget >= 20000) {
      budgetPoints = 25;
      budgetReason = `Strong enterprise budget signal (~$${estBudget.toLocaleString()}).`;
    } else if (estBudget >= 10000) {
      budgetPoints = 20;
      budgetReason = `Healthy mid-market project budget (~$${estBudget.toLocaleString()}).`;
    } else if (estBudget >= 5000) {
      budgetPoints = 14;
      budgetReason = `Moderate SMB project budget (~$${estBudget.toLocaleString()}).`;
    } else {
      budgetPoints = 8;
      budgetReason = `Compact starter budget (~$${estBudget.toLocaleString()}).`;
    }
  }
  breakdown.push({
    factor: 'Budget Alignment',
    points: budgetPoints,
    max_points: 25,
    reason: budgetReason,
  });

  // 2. Timeline & Urgency (0 - 25 pts)
  let timelinePoints = 6;
  let timelineReason = 'Timeline is exploratory with no immediate deadline.';
  let urgencyLevel: UrgencyLevel = 'Low';

  const weeks = inquiry.timeline_weeks;
  const hasUrgencyWords = inquiry.urgency_signals.length > 0;

  if ((weeks !== null && weeks <= 4) || hasUrgencyWords) {
    timelinePoints = weeks !== null && weeks <= 4 ? 25 : 21;
    urgencyLevel = 'High';
    timelineReason = hasUrgencyWords
      ? `Explicit urgency signals detected (${inquiry.urgency_signals.slice(0, 3).join(', ')}).`
      : `Immediate delivery target (~${weeks} weeks).`;
  } else if (weeks !== null && weeks <= 10) {
    timelinePoints = 17;
    urgencyLevel = 'Medium';
    timelineReason = `Active near-term implementation window (~${weeks} weeks).`;
  } else if (weeks !== null && weeks <= 16) {
    timelinePoints = 11;
    urgencyLevel = 'Medium';
    timelineReason = `Planned quarterly delivery horizon (~${weeks} weeks).`;
  }
  breakdown.push({
    factor: 'Timeline & Urgency',
    points: timelinePoints,
    max_points: 25,
    reason: timelineReason,
  });

  // 3. Requirement Clarity & Technical Depth (0 - 20 pts)
  let clarityPoints = 4;
  if (inquiry.word_count >= 45) clarityPoints += 6;
  else if (inquiry.word_count >= 25) clarityPoints += 4;
  else clarityPoints += 2;

  if (inquiry.extracted_integrations.length >= 2) clarityPoints += 5;
  else if (inquiry.extracted_integrations.length === 1) clarityPoints += 3;

  if (inquiry.extracted_metrics.length >= 1) clarityPoints += 5;

  clarityPoints = Math.min(20, clarityPoints);
  const clarityParts: string[] = [`${inquiry.word_count} words`];
  if (inquiry.extracted_metrics.length > 0) {
    clarityParts.push(`quantified scale (${inquiry.extracted_metrics[0]})`);
  }
  if (inquiry.extracted_integrations.length > 0) {
    clarityParts.push(`system targets (${inquiry.extracted_integrations.slice(0, 3).join(', ')})`);
  }
  breakdown.push({
    factor: 'Requirement Clarity',
    points: clarityPoints,
    max_points: 20,
    reason: `Specification includes ${clarityParts.join(', ')}.`,
  });

  // 4. Cynbit Capability Fit via KB Similarity (0 - 20 pts)
  const topMatch = kbMatches[0];
  const sim = topMatch ? topMatch.similarity_score : 0;
  let fitPoints = 8;
  if (sim >= 0.35) fitPoints = 20;
  else if (sim >= 0.22) fitPoints = 16;
  else if (sim >= 0.12) fitPoints = 12;

  breakdown.push({
    factor: 'Cynbit Capability Fit',
    points: fitPoints,
    max_points: 20,
    reason: topMatch
      ? `Strongest knowledge match: ${topMatch.title} (similarity ${sim.toFixed(2)}).`
      : 'General capability evaluation required.',
  });

  // 5. Organization & Contact Completeness (0 - 10 pts)
  let completenessPoints = 4;
  if (inquiry.has_corporate_email) completenessPoints += 3;
  if (inquiry.company.length >= 3 && inquiry.industry !== 'Other') completenessPoints += 3;
  completenessPoints = Math.min(10, completenessPoints);
  breakdown.push({
    factor: 'Contact & Org Profile',
    points: completenessPoints,
    max_points: 10,
    reason: inquiry.has_corporate_email
      ? `Verified corporate domain email and specified ${inquiry.industry} context.`
      : `Valid contact details provided; non-corporate email domain.`,
  });

  const totalScore = Math.min(
    100,
    breakdown.reduce((sum, item) => sum + item.points, 0)
  );

  let priorityLabel: PriorityLevel = 'Low';
  if (totalScore >= highThreshold) {
    priorityLabel = 'High';
  } else if (totalScore >= mediumThreshold) {
    priorityLabel = 'Medium';
  }

  const topReasons = breakdown
    .slice()
    .sort((a, b) => b.points / b.max_points - a.points / a.max_points)
    .slice(0, 2)
    .map((f) => `${f.factor} (${f.points}/${f.max_points})`);

  const score_explanation = `Scored ${totalScore}/100 (${priorityLabel} Priority) under transparent deterministic rules. Primary drivers: ${topReasons.join(' and ')}.`;

  return {
    priority_score: totalScore,
    priority_label: priorityLabel,
    urgency_level: urgencyLevel,
    score_breakdown: breakdown,
    score_explanation,
  };
}
