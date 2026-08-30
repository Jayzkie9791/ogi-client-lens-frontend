import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { routes } from "../app/routePaths";
import { isApiError } from "../api/errors";
import { useCan } from "../auth/useCan";
import { Button } from "../ui/components/Button";
import { Surface } from "../ui/components/Surface";
import { auditQueryKeys, listAudits } from "./auditRiskApi";
import { AuditReadProjection, AuditStatus, auditStatuses, displayCode, formatDateTime } from "./auditRiskTypes";

export function AuditRiskWorkspacePage() {
  const canView = useCan("view_audit");
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
      <header>
        <p className="text-xs font-semibold uppercase tracking-wide text-primary-blue">Audit &amp; Risk</p>
        <h1 className="mt-2 text-2xl font-semibold text-text-primary" id="audit-workspace-heading">Audits</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-text-muted">Review scoped Audit records and their governed operational context. Risk projections and Audit actions are not part of this workspace slice.</p>
      </header>

      <Surface>
        <label className="block max-w-sm text-sm font-semibold text-text-primary">
          Audit status
          <select
            className="mt-1 min-h-10 w-full rounded-component border border-border bg-surface px-3 text-text-primary"
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
    <Surface>
      <ul aria-label="Scoped Audits" className="divide-y divide-border">
        {audits.map((audit) => (
          <li className="py-4 first:pt-0 last:pb-0" key={audit.id}>
            <article aria-labelledby={`audit-${audit.id}`} className="space-y-2">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-semibold text-text-primary" id={`audit-${audit.id}`}>
                    <Link className="text-primary-blue underline-offset-2 hover:underline" to={routes.auditDetailPath(audit.id)}>{audit.business_identifier}</Link>
                  </h2>
                  <p className="text-sm text-text-muted">{audit.facility.name} · {audit.client.name}</p>
                </div>
                <span className="rounded-component border border-border px-2 py-1 text-xs font-semibold text-text-primary">{displayCode(audit.audit_status)}</span>
              </div>
              <dl className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
                <Context label="Template" value={`${audit.template.name} · ${displayCode(audit.template.type)} · v${audit.template.version}`} />
                <Context label="Facility reference" value={audit.facility.business_identifier} />
                <Context label="Started" value={formatDateTime(audit.started_at)} />
                <Context label="Completed" value={audit.completed_at ? formatDateTime(audit.completed_at) : "Not completed"} />
              </dl>
            </article>
          </li>
        ))}
      </ul>
    </Surface>
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
  return <Surface role={role}><h2 className="text-base font-semibold text-text-primary">{title}</h2><div className="mt-2 space-y-3 text-sm leading-6 text-text-muted">{children}</div></Surface>;
}

export function Context({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-xs font-semibold uppercase tracking-wide text-text-muted">{label}</dt><dd className="mt-1 text-text-primary">{value}</dd></div>;
}
