import { jsPDF } from 'jspdf';
import type { InquiryRecord } from '../types';

export function exportInquiryProposalPdf(inquiry: InquiryRecord): void {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 44;
  const maxWidth = pageWidth - margin * 2;
  let y = 52;

  const ensureSpace = (needed: number) => {
    if (y + needed > pageHeight - 50) {
      doc.addPage();
      y = 50;
    }
  };

  const addHeading = (text: string, size = 12) => {
    ensureSpace(26);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(size);
    doc.setTextColor(15, 23, 42);
    doc.text(text, margin, y);
    y += size + 8;
  };

  const addBody = (text: string, size = 10, color: [number, number, number] = [51, 65, 85]) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(size);
    doc.setTextColor(color[0], color[1], color[2]);
    const lines = doc.splitTextToSize(text, maxWidth) as string[];
    for (const line of lines) {
      ensureSpace(15);
      doc.text(line, margin, y);
      y += 14;
    }
    y += 4;
  };

  // Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(15, 23, 42);
  doc.text('Cynbit Technologies — Client Inquiry Analysis & Proposal', margin, y);
  y += 20;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text(
    `Inquiry #${inquiry.id}  |  Generated ${new Date().toLocaleDateString()}  |  Mode: ${inquiry.llm_provider}`,
    margin,
    y
  );
  y += 14;

  doc.setDrawColor(226, 232, 240);
  doc.line(margin, y, pageWidth - margin, y);
  y += 18;

  // Client Summary
  addHeading('1. Client & Lead Summary', 12);
  addBody(
    `Client: ${inquiry.client_name} (${inquiry.client_email})\nCompany: ${inquiry.company}  |  Industry: ${inquiry.industry}\nBudget: ${inquiry.budget_range}  |  Timeline: ${inquiry.timeline}`
  );

  if (inquiry.analysis) {
    addBody(
      `Classified Service: ${inquiry.analysis.service_category} (Confidence ${(
        inquiry.analysis.confidence_score * 100
      ).toFixed(0)}%)\nLead Priority: ${inquiry.analysis.priority_label} (${
        inquiry.analysis.priority_score
      }/100)\nRationale: ${inquiry.analysis.score_explanation}`
    );
  }

  // Proposal
  if (inquiry.proposal) {
    addHeading('2. Preliminary Technical Proposal', 12);
    addBody(inquiry.proposal.title, 11, [15, 23, 42]);
    addBody(`Disclaimer: ${inquiry.proposal.preliminary_disclaimer}`, 9, [180, 83, 9]);

    addHeading('Problem Statement', 10);
    addBody(inquiry.proposal.problem_statement);

    addHeading('Proposed Solution', 10);
    addBody(inquiry.proposal.proposed_solution);

    addHeading('Recommended Technology Stack', 10);
    addBody(inquiry.proposal.recommended_technologies.join(', '));

    addHeading('Implementation Phases', 10);
    for (const phase of inquiry.proposal.implementation_phases) {
      addBody(`${phase.phase} (${phase.duration})`, 10, [15, 23, 42]);
      for (const d of phase.deliverables) {
        addBody(`  - ${d}`, 9.5);
      }
    }

    addBody(
      `Estimated Complexity: ${inquiry.proposal.estimated_complexity}  |  Estimated Timeline: ${inquiry.proposal.estimated_timeline}`
    );
  }

  doc.save(`cynbit-proposal-${inquiry.company.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${inquiry.id}.pdf`);
}
