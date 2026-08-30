import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FormEvent, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { isApiError } from "../api/errors";
import { routes } from "../app/routePaths";
import { Button } from "../ui/components/Button";
import { Surface } from "../ui/components/Surface";
import { auditQueryKeys, listAuditTemplates, listEligibleAuditFacilities, startAudit, StartAuditCommand } from "./auditRiskApi";
import { displayCode } from "./auditRiskTypes";

interface AuditStartPanelProps {
  readonly onClose: () => void;
}

interface FrozenAttempt {
  readonly key: string;
  readonly command: StartAuditCommand;
}

type FailureKind = "AMBIGUOUS" | "DEFINITIVE";

export function AuditStartPanel({ onClose }: AuditStartPanelProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [intentKey, setIntentKey] = useState(createIdempotencyKey);
  const [facilityId, setFacilityId] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [submittedAttempt, setSubmittedAttempt] = useState<FrozenAttempt | null>(null);
  const submittedAttemptRef = useRef<FrozenAttempt | null>(null);
  const requestPendingRef = useRef(false);
  const [failure, setFailure] = useState<{ kind: FailureKind; message: string } | null>(null);

  const facilitiesQuery = useQuery({
    queryKey: auditQueryKeys.eligibleFacilities,
    queryFn: listEligibleAuditFacilities,
    retry: false
  });
  const templatesQuery = useQuery({
    queryKey: auditQueryKeys.templates,
    queryFn: listAuditTemplates,
    retry: false
  });
  const mutation = useMutation({
    mutationFn: (attempt: FrozenAttempt) => startAudit(attempt.command, attempt.key),
    onSuccess: (audit) => {
      queryClient.setQueryData(auditQueryKeys.detail(audit.id), audit);
      void queryClient.invalidateQueries({ queryKey: auditQueryKeys.lists });
      navigate(routes.auditDetailPath(audit.id));
    },
    onError: (error) => setFailure(classifyStartFailure(error)),
    onSettled: () => {
      requestPendingRef.current = false;
    }
  });

  const facilities = facilitiesQuery.data?.facilities ?? [];
  const templates = templatesQuery.data ?? [];
  const frozen = submittedAttempt !== null;
  const canSubmit = facilityId !== "" && templateId !== "" && facilities.length > 0 && templates.length > 0 && !mutation.isPending;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit || submittedAttemptRef.current || requestPendingRef.current) return;
    const attempt = { key: intentKey, command: { templateId, facilityId } };
    submittedAttemptRef.current = attempt;
    requestPendingRef.current = true;
    setSubmittedAttempt(attempt);
    setFailure(null);
    mutation.mutate(attempt);
  }

  function retrySameCommand() {
    if (!submittedAttempt || requestPendingRef.current) return;
    requestPendingRef.current = true;
    setFailure(null);
    mutation.mutate(submittedAttempt);
  }

  function beginNewIntent() {
    if (failure?.kind !== "DEFINITIVE" || mutation.isPending) return;
    setIntentKey(createIdempotencyKey());
    submittedAttemptRef.current = null;
    setSubmittedAttempt(null);
    setFailure(null);
    mutation.reset();
  }

  return (
    <Surface aria-labelledby="start-audit-heading">
      <form aria-labelledby="start-audit-heading" className="space-y-4" onSubmit={submit}>
        <div>
          <h2 className="text-lg font-semibold text-text-primary" id="start-audit-heading">Start Audit</h2>
          <p className="mt-1 text-sm text-text-muted">Choose an eligible Facility and active Audit template. The server will assign the governed Audit reference.</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <SelectorField
            disabled={frozen || mutation.isPending || facilitiesQuery.isLoading || facilitiesQuery.isError || facilities.length === 0}
            label="Eligible Facility"
            state={selectorState(facilitiesQuery, facilities.length, "Facilities")}
            value={facilityId}
            onChange={setFacilityId}
            options={facilities.map((facility) => ({
              value: facility.id,
              label: `${facility.name} · ${facility.business_identifier} · ${facility.client.name}`
            }))}
          />
          <SelectorField
            disabled={frozen || mutation.isPending || templatesQuery.isLoading || templatesQuery.isError || templates.length === 0}
            label="Audit template"
            state={selectorState(templatesQuery, templates.length, "Audit templates")}
            value={templateId}
            onChange={setTemplateId}
            options={templates.map((template) => ({
              value: template.id,
              label: `${template.name} · ${displayCode(template.type)} · v${template.version}`
            }))}
          />
        </div>

        {failure ? (
          <div aria-live="polite" className="rounded-component border border-border bg-elevated p-3 text-sm text-text-primary" role="alert">
            <h3 className="font-semibold">{failure.message}</h3>
            <p className="mt-1 text-text-muted">{failure.kind === "AMBIGUOUS" ? "The exact command and reconciliation key have been retained." : "Start a new intent before changing the command."}</p>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-3">
          {!submittedAttempt ? <Button disabled={!canSubmit} type="submit">Start Audit</Button> : null}
          {failure?.kind === "AMBIGUOUS" ? <Button disabled={mutation.isPending} onClick={retrySameCommand} type="button">Retry same command</Button> : null}
          {failure?.kind === "DEFINITIVE" ? <Button onClick={beginNewIntent} type="button" variant="secondary">Start new intent</Button> : null}
          {!submittedAttempt ? <Button onClick={onClose} type="button" variant="secondary">Cancel</Button> : null}
          {mutation.isPending ? <span className="self-center text-sm text-text-muted" role="status">Starting Audit…</span> : null}
        </div>
      </form>
    </Surface>
  );
}

function SelectorField({ disabled, label, onChange, options, state, value }: {
  disabled: boolean;
  label: string;
  onChange: (value: string) => void;
  options: readonly { value: string; label: string }[];
  state: string | null;
  value: string;
}) {
  return (
    <div>
      <label className="block text-sm font-semibold text-text-primary">
        {label}
        <select className="mt-1 min-h-10 w-full rounded-component border border-border bg-surface px-3 text-text-primary" disabled={disabled} onChange={(event) => onChange(event.currentTarget.value)} value={value}>
          <option value="">Select {label.toLowerCase()}</option>
          {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </label>
      {state ? <p className="mt-1 text-sm text-text-muted" role="status">{state}</p> : null}
    </div>
  );
}

function selectorState(query: { isLoading: boolean; isError: boolean; error: unknown }, count: number, label: string) {
  if (query.isLoading) return `Loading ${label.toLowerCase()}.`;
  if (query.isError) {
    if (isApiError(query.error) && query.error.status === 403) return `You are not authorized to discover ${label.toLowerCase()}.`;
    if (isApiError(query.error) && query.error.code === "MALFORMED_RESPONSE") return `${label} could not be safely displayed.`;
    return `${label} could not be loaded.`;
  }
  if (count === 0) return `No eligible ${label.toLowerCase()} are available.`;
  return null;
}

function classifyStartFailure(error: unknown): { kind: FailureKind; message: string } {
  if (!isApiError(error) || error.status >= 500) return { kind: "AMBIGUOUS", message: "The Audit start outcome is uncertain." };
  if (error.status === 409) return { kind: "DEFINITIVE", message: "This Audit intent conflicts with a previously submitted command." };
  if (error.status === 400 || error.status === 422) return { kind: "DEFINITIVE", message: "The Audit command was rejected as invalid." };
  if (error.status === 403 || error.status === 401) return { kind: "DEFINITIVE", message: "You are not authorized to start this Audit." };
  if (error.status === 404) return { kind: "DEFINITIVE", message: "The selected Facility or template is unavailable." };
  return { kind: "AMBIGUOUS", message: "The Audit start outcome is uncertain." };
}

function createIdempotencyKey() {
  return crypto.randomUUID();
}
