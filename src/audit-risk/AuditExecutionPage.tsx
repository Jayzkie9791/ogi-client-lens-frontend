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
import { AuditExecutionField as ExecutionField, AuditExecutionProjection, AuditExecutionSection as ExecutionSection, displayCode } from "./auditRiskTypes";
import { AuditRiskNavigation } from "./AuditRiskNavigation";

type Drafts = Readonly<Record<string, Readonly<Record<string, unknown>>>>;
interface SaveAttempt { readonly key: string; readonly command: SaveAuditResponseCommand; }
interface CompletionAttempt { readonly key: string; readonly auditId: string; }
type SaveFailure = "VALIDATION" | "STALE" | "IDEMPOTENCY" | "LIFECYCLE" | "AMBIGUOUS";
type CompletionFailure = "CONFLICT" | "AMBIGUOUS";

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
    onError: (error) => {
      const failure = classifySaveFailure(error);
      setSaveFailure(failure);
      if (failure !== "AMBIGUOUS") setSaveAttempt(null);
      if (failure === "STALE" || failure === "LIFECYCLE") void query.refetch();
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
  if (query.isError) return <AuditReadError detail error={query.error} onRetry={() => void query.refetch()} />;
  if (!query.data) return <AuditState title="Audit execution unavailable.">The service did not return authoritative execution state.</AuditState>;

  const execution = query.data;
  const editable = execution.audit.audit_status === "IN_PROGRESS" && canSubmit;
  const anySavePending = saveMutation.isPending;
  const completionAllowed = execution.audit.audit_status === "IN_PROGRESS" && canComplete && execution.completion_eligible && !anySavePending && saveAttempt === null;

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
    <main aria-labelledby="audit-execution-heading" className="space-y-5">
      <AuditRiskNavigation />
      <Link className="text-sm font-semibold text-primary-blue hover:underline" to={routes.auditDetailPath(execution.audit.id)}>← Back to Audit detail</Link>
      <header>
        <p className="text-xs font-semibold uppercase tracking-wide text-primary-blue">Audit &amp; Risk · Execution</p>
        <h1 className="mt-2 text-2xl font-semibold text-text-primary" id="audit-execution-heading">{execution.audit.business_identifier}</h1>
        <p className="mt-2 text-sm text-text-muted">Immutable template v{execution.definition.version} · {editable ? "Editable execution" : "Read-only execution"}</p>
      </header>

      <Surface>
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Context label="Status" value={displayCode(execution.audit.audit_status)} />
          <Context label="Template" value={`${execution.audit.template.name} · v${execution.definition.version}`} />
          <Context label="Facility" value={`${execution.audit.facility.name} · ${execution.audit.facility.business_identifier}`} />
          <Context label="Client" value={`${execution.audit.client.name} · ${execution.audit.client.business_identifier}`} />
        </dl>
      </Surface>

      <CompletenessSummary execution={execution} />

      {saveFailure ? <SaveFailureNotice failure={saveFailure} pending={saveMutation.isPending} onRetry={retrySave} /> : null}
      {savedSection ? <p className="text-sm font-semibold text-success" role="status">Section {savedSection} saved authoritatively.</p> : null}

      {execution.definition.schema.sections.map((section) => (
        <form aria-labelledby={`section-${section.section_code}`} className="space-y-4" key={section.section_code} onSubmit={(event) => submitSection(event, section)}>
          <Surface>
            <div className="space-y-4">
              <header>
                <h2 className="text-lg font-semibold text-text-primary" id={`section-${section.section_code}`}>{section.title}</h2>
                {section.description ? <p className="mt-1 text-sm text-text-muted">{section.description}</p> : null}
              </header>
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
              {editable ? <Button disabled={anySavePending || saveAttempt !== null} type="submit">Save {section.title}</Button> : null}
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

function AuditField({ disabled, execution, field, onChange, value }: { disabled: boolean; execution: AuditExecutionProjection; field: ExecutionField; onChange: (value: unknown) => void; value: unknown }) {
  const label = `${field.label}${field.required ? " (required)" : ""}`;
  if (field.edit_authority === "SYSTEM_READ_ONLY" || field.response_kind === "NONE") return <ReadOnlyField execution={execution} field={field} />;
  if (field.response_kind === "BOOLEAN") return <label className="block text-sm font-semibold text-text-primary">{label}<select className="mt-1 block min-h-10 w-full rounded-component border border-border bg-surface px-3" disabled={disabled} onChange={(event) => onChange(event.currentTarget.value === "" ? undefined : event.currentTarget.value === "true")} value={typeof value === "boolean" ? String(value) : ""}><option value="">Not answered</option><option value="true">Yes</option><option value="false">No</option></select></label>;
  if (field.response_kind === "TEXT") return <label className="block text-sm font-semibold text-text-primary">{label}{field.type === "textarea" ? <textarea className="mt-1 block min-h-24 w-full rounded-component border border-border p-3" disabled={disabled} onChange={(event) => onChange(event.currentTarget.value)} placeholder={field.placeholder} value={typeof value === "string" ? value : ""} /> : <input className="mt-1 block min-h-10 w-full rounded-component border border-border px-3" disabled={disabled} onChange={(event) => onChange(event.currentTarget.value)} placeholder={field.placeholder} type="text" value={typeof value === "string" ? value : ""} />}</label>;
  if (field.response_kind === "SELECT") return <label className="block text-sm font-semibold text-text-primary">{label}<select className="mt-1 block min-h-10 w-full rounded-component border border-border bg-surface px-3" disabled={disabled} onChange={(event) => onChange(event.currentTarget.value || undefined)} value={typeof value === "string" ? value : ""}><option value="">Select an option</option>{field.options?.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>;
  if (field.response_kind === "DATE") return <label className="block text-sm font-semibold text-text-primary">{label}<input className="mt-1 block min-h-10 w-full rounded-component border border-border px-3" disabled={disabled} onChange={(event) => onChange(event.currentTarget.value || undefined)} type="date" value={typeof value === "string" ? value : ""} /></label>;
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
  return <Surface><section aria-labelledby="audit-completeness-heading"><h2 className="font-semibold text-text-primary" id="audit-completeness-heading">Backend completeness</h2><p className="mt-1 text-sm text-text-muted">{execution.completeness.is_complete ? "The backend reports all required user responses complete." : `${execution.completeness.incomplete.length} required response${execution.completeness.incomplete.length === 1 ? " is" : "s are"} incomplete.`}</p>{execution.completeness.incomplete.length ? <ul aria-label="Incomplete Audit responses" className="mt-2 list-disc pl-5 text-sm text-text-muted">{execution.completeness.incomplete.map((item) => <li key={`${item.section_code}:${item.field_id}`}>{item.section_code} · {item.field_id}</li>)}</ul> : null}</section></Surface>;
}

function FindingSummary({ canViewFinding, execution }: { canViewFinding: boolean; execution: AuditExecutionProjection }) {
  return <Surface><section aria-labelledby="execution-findings-heading"><h2 className="font-semibold text-text-primary" id="execution-findings-heading">Authoritative Findings</h2>{execution.findings.length === 0 ? <p className="mt-1 text-sm text-text-muted">No proven Finding occurrences are projected.</p> : <ul aria-label="Audit execution Findings" className="mt-3 space-y-3">{execution.findings.map((finding) => <li className="rounded-component border border-border p-3" key={finding.id}><p className="font-semibold text-text-primary">{canViewFinding ? <Link className="text-primary-blue hover:underline" to={routes.auditFindingDetailPath(finding.id)}>{finding.business_identifier}</Link> : finding.business_identifier}</p><p className="text-sm text-text-muted">Current source condition: {displayCode(finding.source_condition)}</p><p className="text-sm text-text-muted">Governance status: {finding.is_resolved ? "Resolved" : "Unresolved"}</p><p className="text-xs text-text-muted">Source: {finding.source_section_code} · {finding.source_field_id}</p></li>)}</ul>}</section></Surface>;
}

function CompletionPanel({ allowed, canComplete, execution, failure, onComplete, onRetry, pending }: { allowed: boolean; canComplete: boolean; execution: AuditExecutionProjection; failure: CompletionFailure | null; onComplete: () => void; onRetry: () => void; pending: boolean }) {
  return <Surface><section aria-labelledby="audit-completion-heading"><h2 className="font-semibold text-text-primary" id="audit-completion-heading">Audit completion</h2>{execution.audit.audit_status !== "IN_PROGRESS" ? <p className="mt-1 text-sm text-text-muted">This Audit is complete or otherwise read-only.</p> : !canComplete ? <p className="mt-1 text-sm text-text-muted">You do not have Audit completion authority.</p> : !execution.completion_eligible ? <p className="mt-1 text-sm text-text-muted">The backend reports this Audit is not eligible for completion.</p> : null}{failure ? <p className="mt-2 text-sm text-danger" role="alert">{failure === "AMBIGUOUS" ? "The completion outcome is uncertain. The exact completion intent was retained." : "Completion conflicted with authoritative Audit state. The execution state is being reconciled."}</p> : null}<div className="mt-3 flex gap-3">{allowed ? <Button disabled={pending} onClick={onComplete} type="button">Complete Audit</Button> : null}{failure === "AMBIGUOUS" ? <Button disabled={pending} onClick={onRetry} type="button" variant="secondary">Retry same completion</Button> : null}{pending ? <span className="self-center text-sm text-text-muted" role="status">Completing Audit…</span> : null}</div></section></Surface>;
}

function SaveFailureNotice({ failure, onRetry, pending }: { failure: SaveFailure; onRetry: () => void; pending: boolean }) {
  const messages: Record<SaveFailure, string> = { VALIDATION: "The backend rejected this section response. Review the section values.", STALE: "This section changed authoritatively. Review the refreshed state before creating a new save intent.", IDEMPOTENCY: "The reconciliation key conflicts with a different command. Create a new save intent.", LIFECYCLE: "The Audit lifecycle no longer permits this response. The execution state is being reconciled.", AMBIGUOUS: "The save outcome is uncertain. The exact section command, version, and key were retained." };
  return <div className="rounded-component border border-border bg-elevated p-3 text-sm" role="alert"><p className="font-semibold text-text-primary">{messages[failure]}</p>{failure === "AMBIGUOUS" ? <Button disabled={pending} onClick={onRetry} type="button" variant="secondary">Retry same section save</Button> : null}</div>;
}

function hydrateDrafts(execution: AuditExecutionProjection): Drafts { return Object.fromEntries(execution.definition.schema.sections.map((section) => [section.section_code, execution.responses.find((item) => item.section_code === section.section_code)?.response_payload ?? {}])); }
function responsePayload(section: ExecutionSection, draft: Readonly<Record<string, unknown>>) { return Object.fromEntries(section.fields.filter((field) => field.edit_authority === "USER_RESPONSE" && field.response_kind !== "NONE" && draft[field.field_id] !== undefined).map((field) => [field.field_id, draft[field.field_id]])); }
function classifySaveFailure(error: unknown): SaveFailure { if (!isApiError(error) || error.status >= 500 || error.status === 0) return "AMBIGUOUS"; if (error.status === 422) return "VALIDATION"; if (error.code === "AUDIT_RESPONSE_STALE_VERSION") return "STALE"; if (error.code === "AUDIT_RESPONSE_IDEMPOTENCY_CONFLICT") return "IDEMPOTENCY"; if (error.code === "AUDIT_RESPONSE_LIFECYCLE_CONFLICT") return "LIFECYCLE"; return "AMBIGUOUS"; }
function isDefinitive(error: unknown) { return isApiError(error) && error.status > 0 && error.status < 500; }
