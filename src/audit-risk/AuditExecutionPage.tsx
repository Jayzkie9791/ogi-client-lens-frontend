import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FormEvent, ReactNode, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { isApiError } from "../api/errors";
import { routes } from "../app/routePaths";
import { useCan } from "../auth/useCan";
import { Button } from "../ui/components/Button";
import { Surface } from "../ui/components/Surface";
import { auditFindingQueryKeys, auditQueryKeys, completeAudit, getAuditExecution, saveAuditResponse, SaveAuditResponseCommand } from "./auditRiskApi";
import { AuditReadError, AuditState, Context } from "./AuditRiskWorkspacePage";
import { AuditExecutionField as ExecutionField, AuditExecutionProjection, AuditExecutionSection as ExecutionSection, displayCode, formatDateTime } from "./auditRiskTypes";
import { AuditRiskNavigation } from "./AuditRiskNavigation";
import { AuditRiskActionPanel, AuditRiskMetadataGrid, AuditRiskPageHeader, AuditRiskStatusBadge } from "./AuditRiskUi";

type Drafts = Readonly<Record<string, Readonly<Record<string, unknown>>>>;
interface SaveAttempt { readonly key: string; readonly command: SaveAuditResponseCommand; }
interface CompletionAttempt { readonly key: string; readonly auditId: string; }
type SaveFailure = "VALIDATION" | "STALE" | "IDEMPOTENCY" | "LIFECYCLE" | "AMBIGUOUS";
type CompletionFailure = "CONFLICT" | "AMBIGUOUS";
type StaleReconciliation = "IDLE" | "PENDING" | "FAILED";

export function AuditExecutionPage() {
  const { auditId } = useParams();
  const canView = useCan("view_audit");
  const canSubmit = useCan("submit_audit_response");
  const canComplete = useCan("complete_audit");
  const canViewFinding = useCan("view_finding");
  const queryClient = useQueryClient();
  const [drafts, setDrafts] = useState<Drafts>({});
  const [saveAttempt, setSaveAttempt] = useState<SaveAttempt | null>(null);
  const [saveFailure, setSaveFailure] = useState<SaveFailure | null>(null);
  const [staleReconciliation, setStaleReconciliation] = useState<StaleReconciliation>("IDLE");
  const [savedSection, setSavedSection] = useState<string | null>(null);
  const [completionAttempt, setCompletionAttempt] = useState<CompletionAttempt | null>(null);
  const [completionFailure, setCompletionFailure] = useState<CompletionFailure | null>(null);
  const initializedAuditId = useRef<string | null>(null);

  const query = useQuery({
    queryKey: auditQueryKeys.execution(auditId ?? ""),
    queryFn: () => getAuditExecution(auditId ?? ""),
    enabled: canView && Boolean(auditId),
    retry: false
  });

  useEffect(() => {
    if (!query.data || initializedAuditId.current === query.data.audit.id) return;
    initializedAuditId.current = query.data.audit.id;
    setDrafts(hydrateDrafts(query.data));
    setSaveAttempt(null);
    setSaveFailure(null);
    setStaleReconciliation("IDLE");
    setCompletionAttempt(null);
    setCompletionFailure(null);
  }, [query.data]);

  const saveMutation = useMutation({
    mutationFn: (attempt: SaveAttempt) => saveAuditResponse(attempt.command, attempt.key),
    onSuccess: (result, attempt) => {
      setSaveAttempt(null);
      setSaveFailure(null);
      setSavedSection(attempt.command.sectionCode);
      setDrafts((current) => ({ ...current, [attempt.command.sectionCode]: result.response.response_payload }));
      queryClient.setQueryData<AuditExecutionProjection>(auditQueryKeys.execution(attempt.command.auditId), (current) => current ? {
        ...current,
        responses: [...current.responses.filter((item) => item.section_code !== result.response.section_code), result.response],
        completeness: result.completeness
      } : current);
      void queryClient.invalidateQueries({ queryKey: auditQueryKeys.execution(attempt.command.auditId) });
    },
    onError: async (error) => {
      const failure = classifySaveFailure(error);
      setSaveFailure(failure);
      if (failure !== "AMBIGUOUS") setSaveAttempt(null);
      if (failure === "STALE") {
        await reconcileStaleResponse();
      } else if (failure === "LIFECYCLE") {
        void query.refetch();
      }
    }
  });

  const completionMutation = useMutation({
    mutationFn: (attempt: CompletionAttempt) => completeAudit(attempt.auditId, attempt.key),
    onSuccess: (_result, attempt) => {
      setCompletionAttempt(null);
      setCompletionFailure(null);
      void queryClient.invalidateQueries({ queryKey: auditQueryKeys.execution(attempt.auditId) });
      void queryClient.invalidateQueries({ queryKey: auditQueryKeys.detail(attempt.auditId) });
      void queryClient.invalidateQueries({ queryKey: auditQueryKeys.lists });
      void queryClient.invalidateQueries({ queryKey: auditFindingQueryKeys.all });
    },
    onError: (error) => {
      const failure: CompletionFailure = isDefinitive(error) ? "CONFLICT" : "AMBIGUOUS";
      setCompletionFailure(failure);
      if (failure === "CONFLICT") {
        setCompletionAttempt(null);
        void query.refetch();
      }
    }
  });

  if (!canView) return <AuditState title="You are not authorized to view Audit execution.">Your current session does not include Audit viewing authority.</AuditState>;
  if (!auditId) return <AuditState title="Audit execution unavailable.">No Audit UUID was provided.</AuditState>;
  if (query.isLoading) return <AuditState role="status" title="Loading Audit execution.">Loading the authoritative execution state.</AuditState>;
  if (query.isError && !query.data) return <AuditReadError detail error={query.error} onRetry={() => void query.refetch()} />;
  if (!query.data) return <AuditState title="Audit execution unavailable.">The service did not return authoritative execution state.</AuditState>;

  const execution = query.data;
  const responseWritable = execution.audit.audit_status === "IN_PROGRESS" && canSubmit;
  const editable = responseWritable && staleReconciliation === "IDLE";
  const anySavePending = saveMutation.isPending;
  const completionAllowed = execution.audit.audit_status === "IN_PROGRESS" && canComplete && execution.completion_eligible && !anySavePending && saveAttempt === null && staleReconciliation === "IDLE";

  function submitSection(event: FormEvent<HTMLFormElement>, section: ExecutionSection) {
    event.preventDefault();
    if (!editable || anySavePending || saveAttempt) return;
    const existing = execution.responses.find((item) => item.section_code === section.section_code);
    const command: SaveAuditResponseCommand = {
      auditId: execution.audit.id,
      templateId: execution.definition.template_id,
      sectionCode: section.section_code,
      expectedVersion: existing?.version ?? null,
      responsePayload: responsePayload(section, drafts[section.section_code] ?? {})
    };
    const attempt = { key: crypto.randomUUID(), command };
    setSavedSection(null);
    setSaveFailure(null);
    setSaveAttempt(attempt);
    saveMutation.mutate(attempt);
  }

  function retrySave() {
    if (!saveAttempt || saveMutation.isPending) return;
    setSaveFailure(null);
    saveMutation.mutate(saveAttempt);
  }

  async function reconcileStaleResponse() {
    setStaleReconciliation("PENDING");
    const refreshed = await query.refetch();
    if (!refreshed.isSuccess || !refreshed.data) {
      setStaleReconciliation("FAILED");
      return;
    }
    setDrafts(hydrateDrafts(refreshed.data));
    setStaleReconciliation("IDLE");
  }

  function beginCompletion() {
    if (!completionAllowed || completionMutation.isPending) return;
    const attempt = { key: crypto.randomUUID(), auditId: execution.audit.id };
    setCompletionAttempt(attempt);
    setCompletionFailure(null);
    completionMutation.mutate(attempt);
  }

  function retryCompletion() {
    if (!completionAttempt || completionMutation.isPending) return;
    setCompletionFailure(null);
    completionMutation.mutate(completionAttempt);
  }

  return (
    <main aria-labelledby="audit-execution-heading" className="space-y-5 rounded-panel bg-[#EEF3F9] p-3 sm:p-4">
      <AuditRiskNavigation />
      <Link className="text-sm font-semibold text-primary-blue hover:underline" to={routes.auditDetailPath(execution.audit.id)}>← Back to Audit detail</Link>
      <AuditRiskPageHeader eyebrow="Audit & Risk · Execution" headingId="audit-execution-heading" status={<AuditRiskStatusBadge value={execution.audit.audit_status} />} summary={`Immutable template v${execution.definition.version} · ${editable ? "Editable execution" : "Read-only execution"}`} title={execution.audit.business_identifier} />

      <Surface className="border-blue-100 bg-blue-50/60 shadow-none">
        <AuditRiskMetadataGrid className="lg:grid-cols-4">
          <Context label="Template" value={`${execution.audit.template.name} · v${execution.definition.version}`} />
          <Context label="Facility" value={`${execution.audit.facility.name} · ${execution.audit.facility.business_identifier}`} />
          <Context label="Client" value={`${execution.audit.client.name} · ${execution.audit.client.business_identifier}`} />
          {execution.audit.completed_at ? <Context label="Completed by" value={execution.audit.completed_by?.name ?? "Historical actor unavailable"} /> : null}
          {execution.audit.completed_at ? <Context label="Completed at" value={formatDateTime(execution.audit.completed_at)} /> : null}
        </AuditRiskMetadataGrid>
      </Surface>

      <CompletenessSummary execution={execution} />

      {saveFailure ? <SaveFailureNotice failure={saveFailure} pending={saveMutation.isPending || staleReconciliation === "PENDING"} reconciliation={staleReconciliation} onReconcile={() => void reconcileStaleResponse()} onRetry={retrySave} /> : null}
      {savedSection ? <p className="text-sm font-semibold text-success" role="status">Section {savedSection} saved authoritatively.</p> : null}

      {execution.definition.schema.sections.map((section) => (
        <form aria-labelledby={`section-${section.section_code}`} key={section.section_code} onSubmit={(event) => submitSection(event, section)}>
          <Surface className="overflow-hidden border-[#CFDCEB] bg-white p-0 shadow-[0_2px_8px_rgba(15,45,95,0.06)]">
              <header className="relative border-b border-blue-100 bg-blue-50 px-5 py-4 before:absolute before:inset-y-0 before:left-0 before:w-1 before:bg-accent-red">
                <h2 className="text-lg font-semibold text-primary-navy" id={`section-${section.section_code}`}>{section.title}</h2>
                {section.description ? <p className="mt-1 text-sm text-text-muted">{section.description}</p> : null}
              </header>
            <div className="space-y-6 p-5">
              <ResponseAccountability execution={execution} section={section} />
              {section.fields.map((field) => (
                <AuditField
                  disabled={!editable || anySavePending || saveAttempt !== null}
                  execution={execution}
                  field={field}
                  key={field.field_id}
                  value={drafts[section.section_code]?.[field.field_id]}
                  onChange={(value) => setDrafts((current) => ({ ...current, [section.section_code]: { ...(current[section.section_code] ?? {}), [field.field_id]: value } }))}
                />
              ))}
              {responseWritable ? <div className="border-t border-border pt-4"><Button disabled={!editable || anySavePending || saveAttempt !== null} type="submit">Save {section.title}</Button></div> : null}
              {saveMutation.isPending && saveAttempt?.command.sectionCode === section.section_code ? <span className="ml-3 text-sm text-text-muted" role="status">Saving section…</span> : null}
            </div>
          </Surface>
        </form>
      ))}

      <FindingSummary canViewFinding={canViewFinding} execution={execution} />
      <CompletionPanel
        allowed={completionAllowed}
        canComplete={canComplete}
        execution={execution}
        failure={completionFailure}
        pending={completionMutation.isPending}
        onComplete={beginCompletion}
        onRetry={retryCompletion}
      />
    </main>
  );
}

function ResponseAccountability({ execution, section }: { execution: AuditExecutionProjection; section: ExecutionSection }) {
  const response = execution.responses.find((item) => item.section_code === section.section_code);
  if (!response) return null;
  return <dl aria-label={`${section.title} authoritative submission`} className="grid gap-3 rounded-component border border-blue-100 bg-blue-50/50 p-3 sm:grid-cols-2"><Context label="Submitted by" value={response.submitted_by.name} /><Context label="Submitted at" value={formatDateTime(response.submitted_at)} /></dl>;
}

function AuditField({ disabled, execution, field, onChange, value }: { disabled: boolean; execution: AuditExecutionProjection; field: ExecutionField; onChange: (value: unknown) => void; value: unknown }) {
  const label = `${field.label}${field.required ? " (required)" : ""}`;
  if (field.edit_authority === "SYSTEM_READ_ONLY" || field.response_kind === "NONE") return <ReadOnlyField execution={execution} field={field} />;
  const controlClass = "mt-2 block min-h-11 w-full rounded-component border border-blue-200 bg-blue-50/30 px-3 text-text-primary outline-none hover:border-primary-blue focus:bg-white focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-not-allowed disabled:border-border disabled:bg-elevated";
  if (field.response_kind === "BOOLEAN") return <label className="block text-sm font-semibold text-primary-navy">{label}<select className={controlClass} disabled={disabled} onChange={(event) => onChange(event.currentTarget.value === "" ? undefined : event.currentTarget.value === "true")} value={typeof value === "boolean" ? String(value) : ""}><option value="">Not answered</option><option value="true">Yes</option><option value="false">No</option></select></label>;
  if (field.response_kind === "TEXT") return <label className="block text-sm font-semibold text-primary-navy">{label}{field.type === "textarea" ? <textarea className={`${controlClass} min-h-24 p-3`} disabled={disabled} onChange={(event) => onChange(event.currentTarget.value)} placeholder={field.placeholder} value={typeof value === "string" ? value : ""} /> : <input className={controlClass} disabled={disabled} onChange={(event) => onChange(event.currentTarget.value)} placeholder={field.placeholder} type="text" value={typeof value === "string" ? value : ""} />}</label>;
  if (field.response_kind === "SELECT") return <label className="block text-sm font-semibold text-primary-navy">{label}<select className={controlClass} disabled={disabled} onChange={(event) => onChange(event.currentTarget.value || undefined)} value={typeof value === "string" ? value : ""}><option value="">Select an option</option>{field.options?.map((option) => <option key={option} value={option}>{displayCode(option)}</option>)}</select></label>;
  if (field.response_kind === "DATE") return <label className="block text-sm font-semibold text-primary-navy">{label}<input className={controlClass} disabled={disabled} onChange={(event) => onChange(event.currentTarget.value || undefined)} type="date" value={typeof value === "string" ? value : ""} /></label>;
  return <label className="flex items-start gap-3 text-sm font-semibold text-text-primary"><input checked={value === true} className="mt-1" disabled={disabled} onChange={(event) => onChange(event.currentTarget.checked ? true : undefined)} type="checkbox" /><span>{label}<span className="mt-1 block font-normal text-text-muted">I explicitly acknowledge this Audit sign-off as the authenticated user.</span></span></label>;
}

function ReadOnlyField({ execution, field }: { execution: AuditExecutionProjection; field: ExecutionField }) {
  let content: ReactNode = "System-managed field. No user response is accepted.";
  if (field.type === "risk_matrix") content = <>Deferred Risk Matrix context: {field.risk_categories?.join(", ")}. No likelihood, consequence, score, or ORI value is calculated here.</>;
  if (field.type === "findings_workspace") content = <>{execution.findings.length} authoritative Finding occurrence{execution.findings.length === 1 ? "" : "s"} currently projected.</>;
  if (field.type === "corrective_action_workspace") content = "Corrective Action relationships are governed outside Audit execution.";
  if (field.type === "percentage") content = "System-derived percentage; no authoritative value is supplied by this execution projection.";
  return <section aria-label={`${field.label} read-only field`} className="rounded-component border border-border bg-elevated p-3"><h3 className="text-sm font-semibold text-text-primary">{field.label} · Read only</h3><p className="mt-1 text-sm text-text-muted">{content}</p>{field.source_required && !field.required ? <p className="mt-1 text-xs text-text-muted">Historically marked required; not a current user-response obligation.</p> : null}</section>;
}

function CompletenessSummary({ execution }: { execution: AuditExecutionProjection }) {
  return <Surface className="border-[#CFDCEB]"><section aria-labelledby="audit-completeness-heading"><h2 className="font-semibold text-primary-navy" id="audit-completeness-heading">Backend completeness</h2><p className="mt-1 text-sm text-text-muted">{execution.completeness.is_complete ? "The backend reports all required user responses complete." : `${execution.completeness.incomplete.length} required response${execution.completeness.incomplete.length === 1 ? " is" : "s are"} incomplete.`}</p>{execution.completeness.incomplete.length ? <ul aria-label="Incomplete Audit responses" className="mt-3 space-y-2 text-sm">{execution.completeness.incomplete.map((item) => { const reference = completenessReference(execution, item.section_code, item.field_id); return <li className="rounded-component border border-border bg-canvas px-3 py-2" key={`${item.section_code}:${item.field_id}`}><span className="font-semibold text-text-primary">{reference.label}</span><span className="mt-1 block break-words text-xs text-text-muted">Reference: {item.section_code} · {item.field_id}</span></li>; })}</ul> : null}</section></Surface>;
}

function FindingSummary({ canViewFinding, execution }: { canViewFinding: boolean; execution: AuditExecutionProjection }) {
  return <Surface className="border-[#CFDCEB]"><section aria-labelledby="execution-findings-heading"><h2 className="font-semibold text-primary-navy" id="execution-findings-heading">Authoritative Findings</h2>{execution.findings.length === 0 ? <p className="mt-1 text-sm text-text-muted">No proven Finding occurrences are projected.</p> : <ul aria-label="Audit execution Findings" className="mt-3 space-y-3">{execution.findings.map((finding) => { const source = completenessReference(execution, finding.source_section_code, finding.source_field_id); return <li className="rounded-component border border-border bg-canvas p-3" key={finding.id}><div className="flex flex-wrap items-start justify-between gap-2"><p className="break-words font-semibold text-primary-navy">{canViewFinding ? <Link className="text-primary-blue hover:underline" to={routes.auditFindingDetailPath(finding.id)}>{finding.business_identifier}</Link> : finding.business_identifier}</p><AuditRiskStatusBadge value={finding.is_resolved ? "RESOLVED" : "UNRESOLVED"} /></div><p className="mt-2 text-sm text-text-muted">Current source condition: {displayCode(finding.source_condition)}</p><p className="mt-1 text-sm text-text-primary">Source: {source.label}</p><p className="mt-1 break-words text-xs text-text-muted">Reference: {finding.source_section_code} · {finding.source_field_id}</p></li>; })}</ul>}</section></Surface>;
}

function CompletionPanel({ allowed, canComplete, execution, failure, onComplete, onRetry, pending }: { allowed: boolean; canComplete: boolean; execution: AuditExecutionProjection; failure: CompletionFailure | null; onComplete: () => void; onRetry: () => void; pending: boolean }) {
  return <Surface className="border-[#CFDCEB]"><section aria-labelledby="audit-completion-heading"><h2 className="font-semibold text-primary-navy" id="audit-completion-heading">Audit completion</h2><div className="mt-3"><AuditRiskActionPanel>{execution.audit.audit_status !== "IN_PROGRESS" ? <p className="text-sm text-text-muted">This Audit is complete or otherwise read-only.</p> : !canComplete ? <p className="text-sm text-text-muted">You do not have Audit completion authority.</p> : !execution.completion_eligible ? <p className="text-sm text-text-muted">The backend reports this Audit is not eligible for completion.</p> : null}{failure ? <p className="mt-2 text-sm text-state-error" role="alert">{failure === "AMBIGUOUS" ? "The completion outcome is uncertain. The exact completion intent was retained." : "Completion conflicted with authoritative Audit state. The execution state is being reconciled."}</p> : null}<div className="mt-3 flex flex-wrap gap-3">{allowed ? <Button disabled={pending} onClick={onComplete} type="button">Complete Audit</Button> : null}{failure === "AMBIGUOUS" ? <Button disabled={pending} onClick={onRetry} type="button" variant="secondary">Retry same completion</Button> : null}{pending ? <span className="self-center text-sm text-text-muted" role="status">Completing Audit…</span> : null}</div></AuditRiskActionPanel></div></section></Surface>;
}

function completenessReference(execution: AuditExecutionProjection, sectionCode: string, fieldId: string) {
  const section = execution.definition.schema.sections.find((item) => item.section_code === sectionCode);
  const field = section?.fields.find((item) => item.field_id === fieldId);
  return { label: section && field ? `${section.title} · ${field.label}` : "Unresolved required Audit response" };
}

function SaveFailureNotice({ failure, onReconcile, onRetry, pending, reconciliation }: { failure: SaveFailure; onReconcile: () => void; onRetry: () => void; pending: boolean; reconciliation: StaleReconciliation }) {
  const messages: Record<SaveFailure, string> = { VALIDATION: "The backend rejected this section response. Review the section values.", STALE: "This section changed authoritatively. Review the refreshed state before creating a new save intent.", IDEMPOTENCY: "The reconciliation key conflicts with a different command. Create a new save intent.", LIFECYCLE: "The Audit lifecycle no longer permits this response. The execution state is being reconciled.", AMBIGUOUS: "The save outcome is uncertain. The exact section command, version, and key were retained." };
  const message = failure === "STALE" && reconciliation === "PENDING" ? "The Audit changed on the server. Reloading the latest responses before editing can continue." : failure === "STALE" && reconciliation === "FAILED" ? "The Audit changed on the server, but the latest responses could not be reloaded. Retry before continuing." : messages[failure];
  return <div className="rounded-component border border-border bg-elevated p-3 text-sm" role="alert"><p className="font-semibold text-text-primary">{message}</p>{failure === "AMBIGUOUS" ? <Button disabled={pending} onClick={onRetry} type="button" variant="secondary">Retry same section save</Button> : null}{failure === "STALE" && reconciliation === "FAILED" ? <Button disabled={pending} onClick={onReconcile} type="button" variant="secondary">Retry Audit reload</Button> : null}</div>;
}

function hydrateDrafts(execution: AuditExecutionProjection): Drafts { return Object.fromEntries(execution.definition.schema.sections.map((section) => [section.section_code, execution.responses.find((item) => item.section_code === section.section_code)?.response_payload ?? {}])); }
function responsePayload(section: ExecutionSection, draft: Readonly<Record<string, unknown>>) { return Object.fromEntries(section.fields.filter((field) => field.edit_authority === "USER_RESPONSE" && field.response_kind !== "NONE" && draft[field.field_id] !== undefined).map((field) => [field.field_id, draft[field.field_id]])); }
function classifySaveFailure(error: unknown): SaveFailure { if (!isApiError(error) || error.status >= 500 || error.status === 0) return "AMBIGUOUS"; if (error.status === 422) return "VALIDATION"; if (error.code === "AUDIT_RESPONSE_STALE_VERSION") return "STALE"; if (error.code === "AUDIT_RESPONSE_IDEMPOTENCY_CONFLICT") return "IDEMPOTENCY"; if (error.code === "AUDIT_RESPONSE_LIFECYCLE_CONFLICT") return "LIFECYCLE"; return "AMBIGUOUS"; }
function isDefinitive(error: unknown) { return isApiError(error) && error.status > 0 && error.status < 500; }
