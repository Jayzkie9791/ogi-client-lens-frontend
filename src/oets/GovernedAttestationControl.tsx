import { useEffect, useRef, useState } from "react";

import { Button } from "../ui/components/Button";
import {
  AttestationPurpose,
  AttestationSignerMode,
  CreateEvidenceAttestationRequest,
  EvidenceAttestation
} from "./attestationApi";
import { OetsField } from "./types";

export interface GovernedAttestationContext {
  evidenceRecordId: string;
  payloadChecksum: string;
  templateVersionId: string;
  templateChecksum: string;
  actorDisplayName: string;
}

export interface GovernedAttestationControlProps {
  field: OetsField;
  sectionInstanceIndex: number | null;
  context?: GovernedAttestationContext;
  attestations: readonly EvidenceAttestation[];
  readOnly: boolean;
  pending: boolean;
  errorMessage?: string | null;
  onAttest?: (request: CreateEvidenceAttestationRequest) => Promise<unknown>;
}

interface GovernedAttestationMetadata {
  statement: string;
  purpose: AttestationPurpose;
  permittedSignerModes: AttestationSignerMode[];
  sourceRoleLabel?: string;
  externalSubjectRole: "OPTIONAL" | "REQUIRED" | "NOT_PERMITTED";
}

export function GovernedAttestationControl({
  field,
  sectionInstanceIndex,
  context,
  attestations,
  readOnly,
  pending,
  errorMessage,
  onAttest
}: GovernedAttestationControlProps) {
  const metadata = readMetadata(field);
  const [mode, setMode] = useState<AttestationSignerMode>(
    metadata?.permittedSignerModes[0] ?? "AUTHENTICATED_SELF_ATTESTATION"
  );
  const [externalName, setExternalName] = useState("");
  const [externalRole, setExternalRole] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const idempotencyKey = useRef(crypto.randomUUID());
  useEffect(() => {
    idempotencyKey.current = crypto.randomUUID();
    setConfirmed(false);
  }, [context?.payloadChecksum]);
  const matching = attestations.filter(
    (item) =>
      item.signature_field_id === field.field_id &&
      item.section_instance_index === sectionInstanceIndex
  );
  const current = [...matching].reverse().find((item) => item.status === "CURRENT");

  if (!metadata) {
    return (
      <div className="rounded-component border border-border bg-elevated p-3 text-sm">
        <p className="font-semibold text-text-primary">{field.label}</p>
        <p className="mt-1 text-text-muted">
          Governed attestation metadata is not configured for this historical template field.
        </p>
      </div>
    );
  }

  return (
    <fieldset className="space-y-3 rounded-component border border-border bg-elevated p-4">
      <legend className="px-1 font-semibold text-text-primary">
        {field.label}{field.required ? " *" : ""}
      </legend>
      <div className="space-y-1 text-sm">
        <p className="font-semibold text-text-primary">Attestation statement</p>
        <p className="text-text-muted">{metadata.statement}</p>
        <p className="text-xs uppercase tracking-wide text-text-muted">
          Purpose: {displayPurpose(metadata.purpose)}
          {metadata.sourceRoleLabel ? ` · Source role: ${metadata.sourceRoleLabel}` : ""}
        </p>
      </div>

      {matching.length ? (
        <div className="space-y-2" aria-label={`${field.label} attestation history`}>
          {[...matching].reverse().map((item) => (
            <AttestationSnapshot item={item} key={item.id} />
          ))}
        </div>
      ) : (
        <p className="text-sm font-semibold text-state-error">
          No governed attestation has been recorded.
        </p>
      )}

      {!readOnly && !current && context && onAttest ? (
        <div className="space-y-3 border-t border-border pt-3">
          {metadata.permittedSignerModes.length > 1 ? (
            <label className="block text-sm font-semibold text-text-primary">
              Signer mode
              <select
                className="mt-1 w-full rounded-component border border-border bg-canvas px-3 py-2"
                onChange={(event) => setMode(event.target.value as AttestationSignerMode)}
                value={mode}
              >
                {metadata.permittedSignerModes.map((item) => (
                  <option key={item} value={item}>{displayMode(item)}</option>
                ))}
              </select>
            </label>
          ) : null}

          {mode === "AUTHENTICATED_SELF_ATTESTATION" ? (
            <p className="text-sm text-text-primary">
              Signing as <strong>{context.actorDisplayName}</strong> using the authenticated Client Lens session.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm font-semibold text-text-primary">
                External signer name
                <input
                  className="mt-1 w-full rounded-component border border-border bg-canvas px-3 py-2"
                  onChange={(event) => setExternalName(event.target.value)}
                  value={externalName}
                />
              </label>
              {metadata.externalSubjectRole !== "NOT_PERMITTED" ? (
                <label className="text-sm font-semibold text-text-primary">
                  External role/title{metadata.externalSubjectRole === "REQUIRED" ? " *" : ""}
                  <input
                    className="mt-1 w-full rounded-component border border-border bg-canvas px-3 py-2"
                    onChange={(event) => setExternalRole(event.target.value)}
                    value={externalRole}
                  />
                </label>
              ) : null}
              <p className="sm:col-span-2 text-sm text-text-muted">
                Recorded by <strong>{context.actorDisplayName}</strong>. The external subject is not represented as digitally authenticated.
              </p>
            </div>
          )}

          <label className="flex items-start gap-2 text-sm text-text-primary">
            <input
              checked={confirmed}
              className="mt-1"
              onChange={(event) => setConfirmed(event.target.checked)}
              type="checkbox"
            />
            <span>I have reviewed the exact evidence and deliberately accept the attestation statement above.</span>
          </label>
          {errorMessage ? <p className="text-sm font-semibold text-state-error" role="alert">{errorMessage}</p> : null}
          <Button
            disabled={pending || !confirmed || (mode === "RECORDED_EXTERNAL_ATTESTATION" && !externalName.trim())}
            onClick={() => void onAttest({
              expected_payload_checksum: context.payloadChecksum,
              expected_template_version_id: context.templateVersionId,
              expected_template_checksum: context.templateChecksum,
              signature_field_id: field.field_id,
              section_instance_index: sectionInstanceIndex,
              confirmed: true,
              signer_mode: mode,
              ...(mode === "RECORDED_EXTERNAL_ATTESTATION" ? {
                external_subject_name: externalName.trim(),
                ...(externalRole.trim() ? { external_subject_role: externalRole.trim() } : {})
              } : {}),
              idempotency_key: idempotencyKey.current,
              correlation_id: crypto.randomUUID()
            }).catch(() => undefined)}
          >
            {pending ? "Signing…" : "Sign & Attest"}
          </Button>
        </div>
      ) : null}
    </fieldset>
  );
}

function AttestationSnapshot({ item }: { item: EvidenceAttestation }) {
  const external = item.signer_mode === "RECORDED_EXTERNAL_ATTESTATION";
  return (
    <div className="rounded-component border border-border bg-canvas p-3 text-sm">
      <p className="font-semibold text-text-primary">
        {item.status === "CURRENT" ? "Current attestation" : "Stale historical attestation"}
      </p>
      <p className="mt-1 text-text-primary">
        {external ? "External signer" : "Authenticated signer"}: {item.subject_name_snapshot}
      </p>
      {item.external_subject_role_snapshot ? <p>External role: {item.external_subject_role_snapshot}</p> : null}
      {external ? <p>Recorded by: {item.actor_display_name_snapshot}</p> : null}
      <p>Assurance: {displayMode(item.assurance)}</p>
      <p>Signed: {new Date(item.signed_at).toLocaleString()}</p>
      <p className="mt-1 break-all text-xs text-text-muted">Attestation ID: {item.id}</p>
    </div>
  );
}

function readMetadata(field: OetsField): GovernedAttestationMetadata | null {
  const container = field.metadata?.governed_attestation;
  if (!isRecord(container) || typeof container.statement !== "string" || !isPurpose(container.purpose)) return null;
  if (!Array.isArray(container.permitted_signer_modes)) return null;
  const modes = container.permitted_signer_modes.filter(isMode);
  if (!modes.length || modes.length !== container.permitted_signer_modes.length) return null;
  const rolePolicy = container.external_subject_role ?? "NOT_PERMITTED";
  if (rolePolicy !== "OPTIONAL" && rolePolicy !== "REQUIRED" && rolePolicy !== "NOT_PERMITTED") return null;
  return {
    statement: container.statement,
    purpose: container.purpose,
    permittedSignerModes: modes,
    sourceRoleLabel: typeof container.source_role_label === "string" ? container.source_role_label : undefined,
    externalSubjectRole: rolePolicy
  };
}

function isMode(value: unknown): value is AttestationSignerMode {
  return value === "AUTHENTICATED_SELF_ATTESTATION" || value === "RECORDED_EXTERNAL_ATTESTATION";
}

function isPurpose(value: unknown): value is AttestationPurpose {
  return ["CERTIFICATION", "ACKNOWLEDGEMENT", "WITNESS", "TRANSFER_OF_CARE", "REVIEW", "APPROVAL", "OTHER"].includes(String(value));
}

function displayMode(mode: AttestationSignerMode) {
  return mode === "AUTHENTICATED_SELF_ATTESTATION" ? "Authenticated self-attestation" : "Recorded external attestation";
}

function displayPurpose(purpose: AttestationPurpose) {
  return purpose.toLowerCase().replaceAll("_", " ");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
