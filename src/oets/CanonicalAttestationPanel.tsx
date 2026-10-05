import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { isApiError } from "../api/errors";
import { Button } from "../ui/components/Button";
import { Surface } from "../ui/components/Surface";
import {
  CanonicalAttestation,
  CanonicalAttestationRole,
  canonicalIdempotencyKey,
  canonicalAttestationQueryKey,
  createCanonicalAttestation,
  listCanonicalAttestations
} from "./canonicalAttestationApi";
import { OperationalEvidenceRecord } from "./evidenceSubmissionApi";

interface CanonicalAttestationPanelProps {
  record: OperationalEvidenceRecord;
  currentUserId: string;
  canAttest: boolean;
  canReview: boolean;
  canOverrideSeparation: boolean;
  draftDirty: boolean;
  draftSavePending: boolean;
  onAttested?: (role: CanonicalAttestationRole) => void;
}

export function CanonicalAttestationPanel({
  record,
  currentUserId,
  canAttest,
  canReview,
  canOverrideSeparation,
  draftDirty,
  draftSavePending,
  onAttested
}: CanonicalAttestationPanelProps) {
  const queryClient = useQueryClient();
  const [confirmedRole, setConfirmedRole] = useState<CanonicalAttestationRole | null>(null);
  const [overrideEnabled,setOverrideEnabled]=useState(false);
  const [overrideReason,setOverrideReason]=useState("");
  const [overrideConfirmed,setOverrideConfirmed]=useState(false);
  const queryKey = canonicalAttestationQueryKey(record.id);
  const query = useQuery({
    enabled: canAttest || canReview,
    queryKey,
    queryFn: () => listCanonicalAttestations(record.id)
  });
  const mutation = useMutation({
    mutationFn: ({role,override}:{role:CanonicalAttestationRole;override:boolean}) => createCanonicalAttestation(
      record.id,
      {
        role,
        expected_payload_checksum: record.payload_checksum,
        expected_template_version_id: record.template_provenance.template_version_id,
        expected_template_checksum: record.template_provenance.checksum,
        confirmed: true,
        ...(override?{separation_override:true as const,separation_override_reason:overrideReason,separation_override_confirmed:true as const}:{})
      },
      canonicalIdempotencyKey(record.id, record.payload_checksum, role,override?"FOUNDING_EXECUTIVE_OVERRIDE":"INDEPENDENT_REVIEW")
    ),
    onSuccess(response,{role}) {
      setConfirmedRole(null);
      setOverrideEnabled(false);
      setOverrideReason("");
      setOverrideConfirmed(false);
      queryClient.setQueryData<{ attestations: CanonicalAttestation[] }>(queryKey, (current) => ({
        attestations: [
          ...(current?.attestations.filter((item) => item.id !== response.attestation.id) ?? []),
          response.attestation
        ]
      }));
      void queryClient.invalidateQueries({ queryKey });
      void queryClient.invalidateQueries({ queryKey:["canonical-review-queue"] });
      onAttested?.(role);
    }
  });

  if (!canAttest && !canReview) return null;

  const attestations = query.data?.attestations ?? [];
  const currentAssessor = attestations.find((item) => item.role === "ASSESSOR" && item.status === "CURRENT");
  const currentReviewer = attestations.find((item) => item.role === "REVIEWER" && item.status === "CURRENT");
  const draftReady = record.lifecycle_state === "DRAFT" && !draftDirty && !draftSavePending;
  const assessorEligible = canAttest && draftReady && !currentAssessor;
  const reviewerEligible = canReview && draftReady && Boolean(currentAssessor) &&
    currentAssessor?.signer.userId !== currentUserId && !currentReviewer;
  const overrideEligible=canReview&&canOverrideSeparation&&draftReady&&Boolean(currentAssessor)&&
    currentAssessor?.signer.userId===currentUserId&&!currentReviewer;

  return (
    <Surface aria-labelledby="canonical-attestation-heading" className="border-blue-200 bg-blue-50/30">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-primary-blue">Canonical assessment authority</p>
          <h3 className="mt-1 text-lg font-semibold text-primary-navy" id="canonical-attestation-heading">Assessor and Reviewer</h3>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-text-muted">
            The Assessor attests to this exact evidence payload. A different eligible person must then review the same payload.
          </p>
        </div>
        <span className="rounded-full border border-blue-200 bg-white px-3 py-1 text-xs font-semibold text-primary-navy">
          {currentReviewer ? "Review complete" : currentAssessor ? "Awaiting Reviewer" : "Awaiting Assessor"}
        </span>
      </div>

      {query.isLoading ? <p className="mt-4 text-sm text-text-muted" role="status">Loading canonical attestation history…</p> : null}
      {query.isError ? (
        <div className="mt-4 rounded-component border border-red-300 bg-red-50 p-3 text-sm text-red-800" role="alert">
          <p>{canonicalErrorMessage(query.error, "Canonical attestation history could not be loaded.")}</p>
          <Button className="mt-2" onClick={() => query.refetch()} variant="secondary">Retry</Button>
        </div>
      ) : null}

      {!query.isLoading && !query.isError ? (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <CanonicalRoleCard
            attestations={attestations.filter((item) => item.role === "ASSESSOR")}
            canAct={assessorEligible}
            confirmed={confirmedRole === "ASSESSOR"}
            disabledReason={assessorDisabledReason(record, currentAssessor, draftDirty, draftSavePending, canAttest)}
            label="Assessor"
            onConfirm={(confirmed) => setConfirmedRole(confirmed ? "ASSESSOR" : null)}
            onSubmit={() => mutation.mutate({role:"ASSESSOR",override:false})}
            pending={mutation.isPending && mutation.variables?.role === "ASSESSOR"}
          />
          <CanonicalRoleCard
            attestations={attestations.filter((item) => item.role === "REVIEWER")}
            canAct={reviewerEligible}
            confirmed={confirmedRole === "REVIEWER"}
            disabledReason={reviewerDisabledReason(record, currentAssessor, currentReviewer, currentUserId, draftDirty, draftSavePending, canReview)}
            label="Reviewer"
            onConfirm={(confirmed) => setConfirmedRole(confirmed ? "REVIEWER" : null)}
            onSubmit={() => mutation.mutate({role:"REVIEWER",override:false})}
            override={overrideEligible?{
              enabled:overrideEnabled,reason:overrideReason,confirmed:overrideConfirmed,
              onEnabledChange:(enabled)=>{setOverrideEnabled(enabled);setOverrideConfirmed(false);},
              onReasonChange:setOverrideReason,onConfirmedChange:setOverrideConfirmed,
              onSubmit:()=>mutation.mutate({role:"REVIEWER",override:true})
            }:undefined}
            pending={mutation.isPending && mutation.variables?.role === "REVIEWER"}
          />
        </div>
      ) : null}

      {mutation.isError ? (
        <p className="mt-4 rounded-component border border-red-300 bg-red-50 p-3 text-sm text-red-800" role="alert">
          {canonicalErrorMessage(mutation.error, "The canonical attestation could not be recorded. Reload the record and try again.")}
        </p>
      ) : null}

      <p className="mt-4 border-t border-blue-200 pt-3 text-xs leading-5 text-text-muted">
        Template-specific signatures shown inside the form are preserved as historical form attestations under their original labels. They are not converted into Assessor or Reviewer authority.
      </p>
    </Surface>
  );
}

function CanonicalRoleCard({
  attestations,
  canAct,
  confirmed,
  disabledReason,
  label,
  onConfirm,
  onSubmit,
  override,
  pending
}: {
  attestations: readonly CanonicalAttestation[];
  canAct: boolean;
  confirmed: boolean;
  disabledReason: string | null;
  label: "Assessor" | "Reviewer";
  onConfirm: (confirmed: boolean) => void;
  onSubmit: () => void;
  override?:{enabled:boolean;reason:string;confirmed:boolean;onEnabledChange:(enabled:boolean)=>void;onReasonChange:(reason:string)=>void;onConfirmedChange:(confirmed:boolean)=>void;onSubmit:()=>void};
  pending: boolean;
}) {
  const current = attestations.find((item) => item.status === "CURRENT");
  return (
    <section aria-label={`${label} attestation`} className="rounded-component border border-workspace-border bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <h4 className="font-semibold text-primary-navy">{label}</h4>
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${current ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-700"}`}>
          {current ? "Current" : "Not recorded"}
        </span>
      </div>
      {current ? <AttestationIdentity attestation={current} /> : <p className="mt-3 text-sm text-text-muted">No current {label.toLowerCase()} attestation for this payload.</p>}

      {canAct ? (
        <div className="mt-4 border-t border-workspace-border pt-3">
          <label className="flex items-start gap-2 text-sm text-text-primary">
            <input checked={confirmed} className="mt-1" onChange={(event) => onConfirm(event.target.checked)} type="checkbox" />
            <span>I confirm this role for the exact saved evidence payload shown here.</span>
          </label>
          <Button className="mt-3" disabled={!confirmed || pending} onClick={onSubmit}>
            {pending ? "Recording…" : `Attest as ${label}`}
          </Button>
        </div>
      ) : disabledReason ? <p className="mt-3 text-xs leading-5 text-text-muted">{disabledReason}</p> : null}

      {override ? (
        <div className="mt-4 rounded-component border border-amber-300 bg-amber-50 p-3">
          <p className="text-sm font-semibold text-amber-950">Founding executive override</p>
          <p className="mt-1 text-xs leading-5 text-amber-900">The normal rule requires a different Reviewer. Use this exception only when independent review is not operationally available. The record will permanently identify the same-person override.</p>
          <label className="mt-3 flex items-start gap-2 text-sm text-amber-950">
            <input checked={override.enabled} className="mt-1" onChange={(event)=>override.onEnabledChange(event.target.checked)} type="checkbox" />
            <span>Use founding executive separation override</span>
          </label>
          {override.enabled ? <div className="mt-3 space-y-3">
            <label className="block text-sm font-semibold text-text-primary">Operational reason
              <textarea aria-describedby="founding-override-reason-help" className="mt-1 min-h-24 w-full rounded-component border border-amber-400 bg-white px-3 py-2 font-normal" maxLength={1000} onChange={(event)=>override.onReasonChange(event.target.value)} value={override.reason} />
            </label>
            <p className="text-xs text-text-muted" id="founding-override-reason-help">Required, 20–1000 characters. This reason becomes immutable attestation history.</p>
            <label className="flex items-start gap-2 text-sm text-text-primary">
              <input checked={override.confirmed} className="mt-1" onChange={(event)=>override.onConfirmedChange(event.target.checked)} type="checkbox" />
              <span>I explicitly confirm that I am acting as both Assessor and Reviewer under the restricted founding executive exception.</span>
            </label>
            <Button disabled={pending||override.reason.trim().length<20||!override.confirmed} onClick={override.onSubmit} variant="secondary">{pending?"Recording override…":"Attest as Reviewer with Override"}</Button>
          </div>:null}
        </div>
      ):null}

      {attestations.length > 0 ? (
        <details className="mt-4 border-t border-workspace-border pt-3">
          <summary className="cursor-pointer text-sm font-semibold text-primary-blue">History ({attestations.length})</summary>
          <ol className="mt-3 space-y-3">
            {[...attestations].sort((a, b) => b.signedAt.localeCompare(a.signedAt)).map((item) => (
              <li className="rounded-component bg-elevated p-3 text-sm" key={item.id}>
                <div className="flex justify-between gap-2">
                  <strong>{item.signer.name}</strong>
                  <span className={item.status === "CURRENT" ? "text-green-700" : "text-amber-800"}>{item.status === "CURRENT" ? "Current" : "Historical · payload changed"}</span>
                </div>
                <p className="mt-1 text-xs text-text-muted">{item.signer.businessIdentifier} · {formatSignedAt(item.signedAt)}</p>
                <SeparationDisclosure attestation={item}/>
              </li>
            ))}
          </ol>
        </details>
      ) : null}
    </section>
  );
}

function AttestationIdentity({ attestation }: { attestation: CanonicalAttestation }) {
  return (
    <div className="mt-3 text-sm">
      <p className="font-semibold text-text-primary">{attestation.signer.name}</p>
      <p className="text-text-muted">{attestation.signer.businessIdentifier}</p>
      <p className="mt-1 text-xs text-text-muted">Signed {formatSignedAt(attestation.signedAt)}</p>
      <SeparationDisclosure attestation={attestation}/>
    </div>
  );
}

function SeparationDisclosure({attestation}:{attestation:CanonicalAttestation}){
  if(attestation.role!=="REVIEWER")return null;
  if(attestation.separation.mode==="FOUNDING_EXECUTIVE_OVERRIDE")return <div className="mt-2 rounded-component border border-amber-300 bg-amber-50 p-2 text-xs text-amber-950"><p className="font-semibold">Founding Executive Override · same-person assessment and review</p><p className="mt-1 whitespace-pre-wrap">Reason: {attestation.separation.overrideReason}</p></div>;
  return <p className="mt-2 text-xs font-medium text-teal-800">{attestation.separation.mode==="LEGACY_INDEPENDENT_REVIEW"?"Independent Reviewer · recorded before override metadata":"Independent Reviewer"}</p>;
}

function assessorDisabledReason(record: OperationalEvidenceRecord, current: CanonicalAttestation | undefined, dirty: boolean, saving: boolean, allowed: boolean) {
  if (!allowed) return "Your account does not have Assessor authority.";
  if (record.lifecycle_state !== "DRAFT") return "Canonical attestation is available only on an editable Draft.";
  if (dirty || saving) return "Save the Draft before attesting to its exact payload.";
  if (current) return "The current payload already has an Assessor attestation.";
  return null;
}

function reviewerDisabledReason(record: OperationalEvidenceRecord, assessor: CanonicalAttestation | undefined, reviewer: CanonicalAttestation | undefined, userId: string, dirty: boolean, saving: boolean, allowed: boolean) {
  if (!allowed) return "Your account does not have Reviewer authority.";
  if (record.lifecycle_state !== "DRAFT") return "Canonical review is available only on an editable Draft.";
  if (dirty || saving) return "Save the Draft before reviewing its exact payload.";
  if (!assessor) return "A current Assessor attestation is required first.";
  if (assessor.signer.userId === userId) return "Separation of duty requires a different eligible Reviewer.";
  if (reviewer) return "The current payload already has a Reviewer attestation.";
  return null;
}

function canonicalErrorMessage(error: unknown, fallback: string) {
  if (!isApiError(error)) return fallback;
  if (error.status === 404) return "Canonical attestation authority is unavailable for this record or account.";
  if (error.status === 409) return "The evidence or attestation authority changed. Reload the record before continuing.";
  return error.message || fallback;
}

function formatSignedAt(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}
