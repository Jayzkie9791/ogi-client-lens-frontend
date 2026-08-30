import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";

import { routes } from "../app/routePaths";
import { useCan } from "../auth/useCan";
import { Surface } from "../ui/components/Surface";
import { auditQueryKeys, getAudit } from "./auditRiskApi";
import { AuditReadError, AuditState, Context } from "./AuditRiskWorkspacePage";
import { displayCode, formatDateTime } from "./auditRiskTypes";
import { AuditRiskNavigation } from "./AuditRiskNavigation";

export function AuditDetailPage() {
  const canView = useCan("view_audit");
  const { auditId } = useParams();
  const query = useQuery({
    queryKey: auditQueryKeys.detail(auditId ?? ""),
    queryFn: () => getAudit(auditId ?? ""),
    enabled: canView && Boolean(auditId),
    retry: false
  });

  if (!canView) return <AuditState title="You are not authorized to view Audits.">Your current session does not include Audit viewing authority.</AuditState>;
  if (!auditId) return <AuditState title="Audit unavailable.">No Audit identifier was provided.</AuditState>;
  if (query.isLoading) return <AuditState role="status" title="Loading Audit detail.">Please wait.</AuditState>;
  if (query.isError) return <AuditReadError detail error={query.error} onRetry={() => void query.refetch()} />;
  if (!query.data) return <AuditState title="Audit unavailable.">The Audit service did not return authoritative detail.</AuditState>;

  const audit = query.data;
  return (
    <section aria-labelledby="audit-detail-heading" className="space-y-4">
      <AuditRiskNavigation />
      <Link className="text-sm font-semibold text-primary-blue hover:underline" to={routes.auditRisk}>← Back to Audits</Link>
      <header>
        <p className="text-xs font-semibold uppercase tracking-wide text-primary-blue">Audit &amp; Risk · Audit</p>
        <h1 className="mt-2 text-2xl font-semibold text-text-primary" id="audit-detail-heading">{audit.business_identifier}</h1>
        <p className="mt-2 text-sm text-text-muted">Governed Audit reference</p>
      </header>
      <Surface>
        <dl className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <Context label="Status" value={displayCode(audit.audit_status)} />
          <Context label="Client" value={`${audit.client.name} · ${audit.client.business_identifier}`} />
          <Context label="Facility" value={`${audit.facility.name} · ${audit.facility.business_identifier}`} />
          <Context label="Template" value={`${audit.template.name} · ${displayCode(audit.template.type)} · v${audit.template.version}`} />
          <Context label="Auditor" value={audit.auditor?.name ?? "Not assigned"} />
          <Context label="Started" value={formatDateTime(audit.started_at)} />
          {audit.completed_at ? <Context label="Completed by" value={audit.completed_by?.name ?? "Historical actor unavailable"} /> : null}
          {audit.completed_at ? <Context label="Completed at" value={formatDateTime(audit.completed_at)} /> : null}
        </dl>
      </Surface>
      <Surface>
        <h2 className="font-semibold text-text-primary">Audit execution</h2>
        <p className="mt-1 text-sm text-text-muted">Open the authoritative execution definition, persisted responses, completeness, and Finding context.</p>
        <Link className="mt-3 inline-block font-semibold text-primary-blue hover:underline" to={routes.auditExecutionPath(audit.id)}>
          {audit.audit_status === "IN_PROGRESS" ? "Open Audit execution" : "View Audit execution"}
        </Link>
      </Surface>
    </section>
  );
}
