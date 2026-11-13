import { AlertTriangle, CheckCircle2, Clock, ShieldAlert } from 'lucide-react';
import type { ApprovalStatus, PriorityLevel } from '../types';

export function PriorityText({
  priority,
  score,
}: {
  priority: PriorityLevel;
  score?: number;
}) {
  const styles: Record<PriorityLevel, string> = {
    High: 'text-emerald-700',
    Medium: 'text-amber-700',
    Low: 'text-slate-600',
  };

  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium whitespace-nowrap ${styles[priority]}`}>
      {priority === 'High' && <CheckCircle2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />}
      {priority === 'Medium' && <Clock className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />}
      {priority === 'Low' && <AlertTriangle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />}
      <span>{priority} Priority</span>
      {typeof score === 'number' && (
        <span className="font-mono-nums text-slate-500">({score}/100)</span>
      )}
    </span>
  );
}

export function ApprovalText({ status }: { status: ApprovalStatus }) {
  if (status === 'approved') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 whitespace-nowrap">
        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
        <span>Approved</span>
      </span>
    );
  }
  if (status === 'needs_revision') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-red-700 whitespace-nowrap">
        <ShieldAlert className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
        <span>Needs Revision</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700 whitespace-nowrap">
      <Clock className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
      <span>Pending Review</span>
    </span>
  );
}
