import type { ReactNode } from "react";

import { Surface } from "../ui/components/Surface";
import { displayCode } from "./auditRiskTypes";

export function AuditRiskPageHeader({
  actions,
  eyebrow,
  headingId,
  summary,
  title,
  status
}: {
  actions?: ReactNode;
  eyebrow: string;
  headingId?: string;
  summary?: ReactNode;
  title: string;
  status?: ReactNode;
}) {
  return (
    <header className="relative flex flex-wrap items-start justify-between gap-4 border-l-4 border-l-accent-red pl-4">
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wide text-primary-blue">{eyebrow}</p>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="break-words text-2xl font-semibold text-primary-navy" id={headingId}>{title}</h1>
          {status}
        </div>
        {summary ? <div className="mt-2 max-w-3xl text-sm leading-6 text-text-muted">{summary}</div> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </header>
  );
}

type BadgeTone = "neutral" | "active" | "success" | "warning" | "attention";

export function AuditRiskStatusBadge({ value, tone }: { value: string; tone?: BadgeTone }) {
  const resolvedTone = tone ?? statusTone(value);
  const classes: Record<BadgeTone, string> = {
    neutral: "border-border bg-elevated text-text-primary",
    active: "border-blue-200 bg-blue-50 text-primary-blue",
    success: "border-green-200 bg-green-50 text-state-success",
    warning: "border-amber-200 bg-amber-50 text-amber-800",
    attention: "border-red-200 bg-red-50 text-state-error"
  };

  return (
    <span className={`inline-flex max-w-full rounded-full border px-2.5 py-1 text-xs font-semibold ${classes[resolvedTone]}`}>
      {displayCode(value)}
    </span>
  );
}

export function AuditRiskRecordCard({ children, labelledBy }: { children: ReactNode; labelledBy: string }) {
  return (
    <article
      aria-labelledby={labelledBy}
      className="rounded-panel border border-[#C9D7E8] bg-white p-5 shadow-[0_3px_10px_rgba(15,45,95,0.08)]"
    >
      {children}
    </article>
  );
}

export function AuditRiskRecordCollection({ children, label }: { children: ReactNode; label: string }) {
  return (
    <ul aria-label={label} className="space-y-6 rounded-panel bg-[#E8EEF6] p-3 sm:p-4">
      {children}
    </ul>
  );
}

export function AuditRiskMetadataGrid({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <dl className={`grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3 ${className}`}>{children}</dl>;
}

export function AuditRiskSectionCard({ children, heading, headingId, eyebrow }: { children: ReactNode; heading: string; headingId: string; eyebrow?: string }) {
  return (
    <Surface className="overflow-hidden border-[#CFDCEB] bg-white p-0 shadow-[0_2px_8px_rgba(15,45,95,0.06)]">
      <header className="relative border-b border-blue-100 bg-blue-50 px-5 py-4 before:absolute before:inset-y-0 before:left-0 before:w-1 before:bg-accent-red">
        {eyebrow ? <p className="text-xs font-semibold uppercase tracking-wide text-primary-blue">{eyebrow}</p> : null}
        <h2 className={`${eyebrow ? "mt-1 " : ""}text-lg font-semibold text-primary-navy`} id={headingId}>{heading}</h2>
      </header>
      <div className="p-5">{children}</div>
    </Surface>
  );
}

export function AuditRiskActionPanel({ children }: { children: ReactNode }) {
  return <div className="rounded-component border border-blue-200 bg-blue-50/60 p-4">{children}</div>;
}

function statusTone(value: string): BadgeTone {
  switch (value) {
    case "IN_PROGRESS":
    case "SUBMITTED":
    case "REVIEWED":
      return "active";
    case "APPROVED":
    case "RESOLVED":
      return "success";
    case "HIGH":
    case "MEDIUM":
    case "OPEN":
      return "warning";
    case "REJECTED":
    case "CRITICAL":
    case "UNRESOLVED":
      return "attention";
    default:
      return "neutral";
  }
}
