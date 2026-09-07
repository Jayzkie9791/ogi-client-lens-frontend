import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { routes } from "../app/routePaths";
import { isApiError } from "../api/errors";
import { useCan } from "../auth/useCan";
import { Button } from "../ui/components/Button";
import { Surface } from "../ui/components/Surface";
import { auditQueryKeys, listAudits } from "./auditRiskApi";
import { AuditReadProjection, AuditStatus, auditStatuses, displayCode, formatDateTime } from "./auditRiskTypes";
import { AuditStartPanel } from "./AuditStartPanel";
import { AuditRiskNavigation } from "./AuditRiskNavigation";
import { AuditRiskPageHeader, AuditRiskRecordCard, AuditRiskRecordCollection, AuditRiskStatusBadge } from "./AuditRiskUi";

export function AuditRiskWorkspacePage() {
  const canView = useCan("view_audit");
  const canCreate = useCan("create_audit");
  const [startOpen, setStartOpen] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedStatus = searchParams.get("status");
  const status = auditStatuses.includes(requestedStatus as AuditStatus)
    ? (requestedStatus as AuditStatus)
    : undefined;
  const filters = status ? { status } : {};
  const auditsQuery = useQuery({
    queryKey: auditQueryKeys.list(filters),
    queryFn: () => listAudits(filters),
    enabled: canView,
    retry: false
  });

  if (!canView) {
    return <AuditState title="You are not authorized to view Audits.">Your current session does not include Audit viewing authority.</AuditState>;
  }

  return (
    <section aria-labelledby="audit-workspace-heading" className="space-y-4">
      <AuditRiskNavigation />
      <AuditRiskPageHeader
          actions={canCreate && !startOpen ? <Button onClick={() => setStartOpen(true)} type="button">Start Audit</Button> : null}
          eyebrow="Audit & Risk"
          headingId="audit-workspace-heading"
          summary="Review scoped Audit records and their governed operational context. Risk projections and Audit execution are not part of this workspace slice."
          title="Audits"
      />

      {canCreate && startOpen ? <AuditStartPanel onClose={() => setStartOpen(false)} /> : null}

      <Surface className="border-[#C9D7E8] bg-[#DDE8F4] shadow-none">
        <label className="block max-w-sm text-sm font-semibold text-primary-navy">
          <span className="block">Audit status</span>
          <select
            className="mt-2 min-h-11 w-full rounded-component border border-blue-200 bg-white px-3 text-text-primary outline-none hover:border-primary-blue focus-visible:ring-2 focus-visible:ring-focus"
            onChange={(event) => {
              const next = event.currentTarget.value;
              setSearchParams(next ? { status: next } : {}, { replace: true });
            }}
            value={status ?? ""}
          >
            <option value="">All statuses</option>
            {auditStatuses.map((value) => <option key={value} value={value}>{displayCode(value)}</option>)}
          </select>
        </label>
      </Surface>

      {auditsQuery.isLoading ? (
        <AuditState role="status" title="Loading Audits.">Please wait.</AuditState>
      ) : auditsQuery.isError ? (
        <AuditReadError error={auditsQuery.error} onRetry={() => void auditsQuery.refetch()} />
      ) : !auditsQuery.data || auditsQuery.data.audits.length === 0 ? (
        <AuditState title="No Audits are available.">No Audit records matched your current status filter and authority.</AuditState>
      ) : (
        <AuditList audits={auditsQuery.data.audits} />
      )}
    </section>
  );
}

function AuditList({ audits }: { audits: readonly AuditReadProjection[] }) {
  return (
    <AuditRiskRecordCollection label="Scoped Audits">
        {audits.map((audit) => (
          <li key={audit.id}>
            <AuditRiskRecordCard labelledBy={`audit-${audit.id}`}>
              <div className="space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="break-words text-lg font-semibold text-primary-navy" id={`audit-${audit.id}`}>
                    <Link className="text-primary-blue underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus" to={routes.auditDetailPath(audit.id)}>{audit.business_identifier}</Link>
                  </h2>
                  <p className="mt-1 font-semibold text-text-primary">{audit.facility.name}</p>
                  <p className="text-sm text-text-muted">{audit.client.name}</p>
                </div>
                <AuditRiskStatusBadge value={audit.audit_status} />
              </div>
              <dl className="grid gap-x-6 gap-y-3 border-t border-border pt-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
                <Context label="Template" value={`${audit.template.name} · ${displayCode(audit.template.type)} · v${audit.template.version}`} />
                <Context label="Facility reference" value={audit.facility.business_identifier} />
                <Context label="Started" value={formatDateTime(audit.started_at)} />
                <Context label="Completed" value={audit.completed_at ? formatDateTime(audit.completed_at) : "Not completed"} />
              </dl>
              </div>
            </AuditRiskRecordCard>
          </li>
        ))}
    </AuditRiskRecordCollection>
  );
}

export function AuditReadError({ error, onRetry, detail = false }: { error: unknown; onRetry: () => void; detail?: boolean }) {
  const unauthorized = isApiError(error) && error.status === 403;
  const unavailable = detail && isApiError(error) && error.status === 404;
  const malformed = isApiError(error) && error.code === "MALFORMED_RESPONSE";
  const title = unauthorized
    ? "You are not authorized to view Audits."
    : unavailable
      ? "Audit unavailable."
      : malformed
        ? "Audit data could not be safely displayed."
        : "Audit records could not be loaded.";
  return (
    <AuditState title={title}>
      <p>{unavailable ? "The Audit does not exist or is outside your authorized scope." : "No partial Audit context has been displayed."}</p>
      {!unauthorized && !unavailable ? <Button onClick={onRetry} type="button">Try again</Button> : null}
    </AuditState>
  );
}

export function AuditState({ title, children, role }: { title: string; children: ReactNode; role?: "status" | "alert" }) {
  return <Surface className="border-[#CFDCEB]" role={role}><h2 className="text-base font-semibold text-primary-navy">{title}</h2><div className="mt-2 space-y-3 text-sm leading-6 text-text-muted">{children}</div></Surface>;
}

export function Context({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0"><dt className="text-xs font-semibold uppercase tracking-wide text-primary-blue">{label}</dt><dd className="mt-1 break-words text-text-primary">{value}</dd></div>;
}
