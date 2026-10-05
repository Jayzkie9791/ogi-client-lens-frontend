import { apiRequest } from "../api/client";

export type CanonicalAttestationRole = "ASSESSOR" | "REVIEWER";
export type CanonicalSeparationMode = "INDEPENDENT_REVIEW" | "FOUNDING_EXECUTIVE_OVERRIDE" | "LEGACY_INDEPENDENT_REVIEW" | null;

export interface CanonicalAttestation {
  id: string;
  evidenceRecordId: string;
  role: CanonicalAttestationRole;
  templateVersionId: string;
  templateCode: string;
  templateVersion: string;
  templateChecksum: string;
  payloadChecksum: string;
  signer: {
    userId: string;
    personnelId: string;
    name: string;
    businessIdentifier: string;
  };
  clientId: string | null;
  facilityId: string | null;
  signedAt: string;
  createdAt: string;
  status: "CURRENT" | "STALE";
  separation: {
    mode: CanonicalSeparationMode;
    overrideReason: string | null;
    overridePermission: string | null;
    overrideRole: string | null;
    overrideConfirmed: boolean;
    overrideAuthorityChecksum: string | null;
  };
}

export interface CreateCanonicalAttestationRequest {
  role: CanonicalAttestationRole;
  expected_payload_checksum: string;
  expected_template_version_id: string;
  expected_template_checksum: string;
  confirmed: true;
  separation_override?: true;
  separation_override_reason?: string;
  separation_override_confirmed?: true;
}

export interface CreateCanonicalAttestationResponse {
  attestation: CanonicalAttestation;
  replayed: boolean;
}

export const canonicalAttestationQueryKey = (evidenceRecordId: string) =>
  ["operational-evidence-canonical-attestations", evidenceRecordId] as const;

export function canonicalIdempotencyKey(
  evidenceRecordId: string,
  payloadChecksum: string,
  role: CanonicalAttestationRole,
  mode: "INDEPENDENT_REVIEW" | "FOUNDING_EXECUTIVE_OVERRIDE" = "INDEPENDENT_REVIEW"
) {
  return `cfac4s5:${evidenceRecordId}:${payloadChecksum}:${role}${mode === "FOUNDING_EXECUTIVE_OVERRIDE" ? ":OVERRIDE" : ""}`;
}

export function listCanonicalAttestations(evidenceRecordId: string) {
  return apiRequest<{ attestations: CanonicalAttestation[] }>(
    `/api/v1/operational-evidence/records/${encodeURIComponent(evidenceRecordId)}/canonical-attestations`,
    { validate: isCanonicalAttestationList }
  );
}

export function createCanonicalAttestation(
  evidenceRecordId: string,
  request: CreateCanonicalAttestationRequest,
  idempotencyKey: string
) {
  return apiRequest<CreateCanonicalAttestationResponse>(
    `/api/v1/operational-evidence/records/${encodeURIComponent(evidenceRecordId)}/canonical-attestations`,
    {
      method: "POST",
      body: request,
      headers: { "Idempotency-Key": idempotencyKey },
      validate: isCreateCanonicalAttestationResponse
    }
  );
}

function isCanonicalAttestationList(value: unknown): value is { attestations: CanonicalAttestation[] } {
  return isRecord(value) &&
    hasExactKeys(value, ["attestations"]) &&
    Array.isArray(value.attestations) &&
    value.attestations.every(isCanonicalAttestation);
}

function isCreateCanonicalAttestationResponse(value: unknown): value is CreateCanonicalAttestationResponse {
  return isRecord(value) &&
    hasExactKeys(value, ["attestation", "replayed"]) &&
    isCanonicalAttestation(value.attestation) &&
    typeof value.replayed === "boolean";
}

function isCanonicalAttestation(value: unknown): value is CanonicalAttestation {
  return isRecord(value) &&
    hasExactKeys(value, canonicalAttestationKeys) &&
    typeof value.id === "string" &&
    typeof value.evidenceRecordId === "string" &&
    (value.role === "ASSESSOR" || value.role === "REVIEWER") &&
    typeof value.templateVersionId === "string" &&
    typeof value.templateCode === "string" &&
    typeof value.templateVersion === "string" &&
    typeof value.templateChecksum === "string" &&
    typeof value.payloadChecksum === "string" &&
    isSigner(value.signer) &&
    isNullableString(value.clientId) &&
    isNullableString(value.facilityId) &&
    typeof value.signedAt === "string" &&
    typeof value.createdAt === "string" &&
    (value.status === "CURRENT" || value.status === "STALE") &&
    isSeparation(value.separation);
}

function isSigner(value: unknown): value is CanonicalAttestation["signer"] {
  return isRecord(value) &&
    hasExactKeys(value, ["userId", "personnelId", "name", "businessIdentifier"]) &&
    typeof value.userId === "string" &&
    typeof value.personnelId === "string" &&
    typeof value.name === "string" &&
    typeof value.businessIdentifier === "string";
}

const canonicalAttestationKeys = [
  "id", "evidenceRecordId", "role", "templateVersionId", "templateCode",
  "templateVersion", "templateChecksum", "payloadChecksum", "signer", "clientId",
  "facilityId", "signedAt", "createdAt", "status", "separation"
] as const;

function isSeparation(value:unknown):value is CanonicalAttestation["separation"]{
  return isRecord(value) && hasExactKeys(value,["mode","overrideReason","overridePermission","overrideRole","overrideConfirmed","overrideAuthorityChecksum"]) &&
    (value.mode===null||value.mode==="INDEPENDENT_REVIEW"||value.mode==="FOUNDING_EXECUTIVE_OVERRIDE"||value.mode==="LEGACY_INDEPENDENT_REVIEW") &&
    isNullableString(value.overrideReason) && isNullableString(value.overridePermission) && isNullableString(value.overrideRole) &&
    typeof value.overrideConfirmed==="boolean" && isNullableString(value.overrideAuthorityChecksum);
}

function hasExactKeys(value: Record<string, unknown>, expected: readonly string[]) {
  const keys = Object.keys(value);
  return keys.length === expected.length && keys.every((key) => expected.includes(key));
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
