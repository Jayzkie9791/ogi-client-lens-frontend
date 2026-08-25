import { apiRequest } from "../api/client";

export type AttestationSignerMode =
  | "AUTHENTICATED_SELF_ATTESTATION"
  | "RECORDED_EXTERNAL_ATTESTATION";

export type AttestationPurpose =
  | "CERTIFICATION"
  | "ACKNOWLEDGEMENT"
  | "WITNESS"
  | "TRANSFER_OF_CARE"
  | "REVIEW"
  | "APPROVAL"
  | "OTHER";

export interface EvidenceAttestation {
  id: string;
  evidence_record_id: string;
  template_version_id: string;
  template_code_snapshot: string;
  template_checksum: string;
  payload_checksum: string;
  signature_field_id: string;
  signature_field_code_snapshot: string;
  section_code_snapshot: string;
  section_instance_index: number | null;
  attestation_statement_snapshot: string;
  purpose: AttestationPurpose;
  signer_mode: AttestationSignerMode;
  subject_name_snapshot: string;
  external_subject_role_snapshot: string | null;
  actor_user_id: string;
  actor_display_name_snapshot: string;
  signer_user_id: string | null;
  signer_display_name_snapshot: string | null;
  client_id_snapshot: string | null;
  facility_id_snapshot: string | null;
  lifecycle_state_snapshot: string;
  signed_at: string;
  correlation_id: string | null;
  created_at: string;
  status: "CURRENT" | "STALE";
  assurance: AttestationSignerMode;
}

export interface CreateEvidenceAttestationRequest {
  expected_payload_checksum: string;
  expected_template_version_id: string;
  expected_template_checksum: string;
  signature_field_id: string;
  section_instance_index?: number | null;
  confirmed: true;
  signer_mode: AttestationSignerMode;
  external_subject_name?: string;
  external_subject_role?: string;
  idempotency_key: string;
  correlation_id?: string;
}

export function listEvidenceAttestations(evidenceRecordId: string) {
  return apiRequest<{ attestations: EvidenceAttestation[] }>(
    `/api/v1/operational-evidence/records/${encodeURIComponent(evidenceRecordId)}/attestations`,
    { validate: isAttestationList }
  );
}

export function createEvidenceAttestation(
  evidenceRecordId: string,
  request: CreateEvidenceAttestationRequest
) {
  return apiRequest<EvidenceAttestation>(
    `/api/v1/operational-evidence/records/${encodeURIComponent(evidenceRecordId)}/attestations`,
    { method: "POST", body: request, validate: isEvidenceAttestation }
  );
}

function isAttestationList(value: unknown): value is { attestations: EvidenceAttestation[] } {
  return isRecord(value) &&
    hasExactKeys(value, ["attestations"]) &&
    Array.isArray(value.attestations) &&
    value.attestations.every(isEvidenceAttestation);
}

function isEvidenceAttestation(value: unknown): value is EvidenceAttestation {
  return isRecord(value) &&
    hasExactKeys(value, evidenceAttestationProperties) &&
    typeof value.id === "string" &&
    typeof value.evidence_record_id === "string" &&
    typeof value.template_version_id === "string" &&
    typeof value.template_code_snapshot === "string" &&
    typeof value.template_checksum === "string" &&
    typeof value.payload_checksum === "string" &&
    typeof value.signature_field_id === "string" &&
    typeof value.signature_field_code_snapshot === "string" &&
    typeof value.section_code_snapshot === "string" &&
    isNullableNonnegativeInteger(value.section_instance_index) &&
    typeof value.attestation_statement_snapshot === "string" &&
    isPurpose(value.purpose) &&
    typeof value.subject_name_snapshot === "string" &&
    isNullableString(value.external_subject_role_snapshot) &&
    typeof value.actor_user_id === "string" &&
    typeof value.actor_display_name_snapshot === "string" &&
    isNullableString(value.signer_user_id) &&
    isNullableString(value.signer_display_name_snapshot) &&
    isNullableString(value.client_id_snapshot) &&
    isNullableString(value.facility_id_snapshot) &&
    typeof value.lifecycle_state_snapshot === "string" &&
    typeof value.signed_at === "string" &&
    isNullableString(value.correlation_id) &&
    typeof value.created_at === "string" &&
    (value.status === "CURRENT" || value.status === "STALE") &&
    isSignerMode(value.signer_mode) &&
    isSignerMode(value.assurance);
}

const evidenceAttestationProperties = [
  "id", "evidence_record_id", "template_version_id", "template_code_snapshot",
  "template_checksum", "payload_checksum", "signature_field_id",
  "signature_field_code_snapshot", "section_code_snapshot", "section_instance_index",
  "attestation_statement_snapshot", "purpose", "signer_mode", "subject_name_snapshot",
  "external_subject_role_snapshot", "actor_user_id", "actor_display_name_snapshot",
  "signer_user_id", "signer_display_name_snapshot", "client_id_snapshot",
  "facility_id_snapshot", "lifecycle_state_snapshot", "signed_at", "correlation_id",
  "created_at", "status", "assurance"
] as const;

function hasExactKeys(value: Record<string, unknown>, expected: readonly string[]) {
  const keys = Object.keys(value);
  return keys.length === expected.length && keys.every((key) => expected.includes(key));
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function isNullableNonnegativeInteger(value: unknown): value is number | null {
  return value === null || (Number.isInteger(value) && (value as number) >= 0);
}

function isSignerMode(value: unknown): value is AttestationSignerMode {
  return value === "AUTHENTICATED_SELF_ATTESTATION" || value === "RECORDED_EXTERNAL_ATTESTATION";
}

function isPurpose(value: unknown): value is AttestationPurpose {
  return [
    "CERTIFICATION", "ACKNOWLEDGEMENT", "WITNESS", "TRANSFER_OF_CARE",
    "REVIEW", "APPROVAL", "OTHER"
  ].includes(String(value));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
