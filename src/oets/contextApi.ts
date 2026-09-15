import { apiRequest } from "../api/client";

export type OetsContextFieldPolicy = "OPERATOR_EDITABLE" | "READ_ONLY_DERIVED" | "UNAVAILABLE_POST_ISSUANCE";
export type OetsContextDuplicatePolicy = "IDEMPOTENCY_ONLY" | "ONE_LIVE_RECORD_PER_SUBJECT" | "ALLOW_MULTIPLE";
export type OetsContextSuccessorPolicy = "CLONE_IMMUTABLE_CONTEXT" | "REQUIRE_RESELECTION" | "FORBID_CONTEXTUAL_SUCCESSOR";

export interface OetsContextRequirement {
  required: boolean;
  requirement_code: string | null;
  selection_mode: "EXPLICIT" | null;
  presentation: OetsContextPresentation | null;
  duplicate_policy: OetsContextDuplicatePolicy | null;
  successor_policy: OetsContextSuccessorPolicy | null;
}

export interface OetsContextPresentation { label: string; help_text: string; candidate_singular: string; candidate_plural: string; }

export interface OetsContextCandidate {
  id: string;
  primary_label: string;
  secondary_label: string;
  context_kind: string;
  holder_kind?: "TRAINEE" | "STAFF_MEMBER" | "TRAINING_ENROLLMENT";
}

export interface OetsContextCandidatePage { candidates: OetsContextCandidate[]; count: number; next_cursor: string | null; selection_mode: "EXPLICIT"; }

export interface OetsResolvedContext {
  requirement_code: string;
  selected_id: string;
  summary: OetsContextCandidate;
  field_policy: Record<string, OetsContextFieldPolicy>;
  authoritative_values: Record<string, string | number | boolean | string[] | null>;
  required_fields: string[];
}

interface ContextAuthorityInput { templateCode: string; templateVersionId: string; checksum: string; clientId?: string | null; facilityId?: string | null; candidateQuery?: string; limit?: number; cursor?: string; }

function query(input: ContextAuthorityInput) {
  const value = new URLSearchParams({ template_version_id: input.templateVersionId, checksum: input.checksum });
  if (input.clientId) value.set("client_id", input.clientId);
  if (input.facilityId) value.set("facility_id", input.facilityId);
  if (input.candidateQuery) value.set("q", input.candidateQuery);
  if (input.limit !== undefined) value.set("limit", String(input.limit));
  if (input.cursor) value.set("cursor", input.cursor);
  return value.toString();
}

export function getOetsContextRequirement(input: ContextAuthorityInput) {
  return apiRequest<OetsContextRequirement>(`/api/v1/operational-evidence/templates/${encodeURIComponent(input.templateCode)}/context-requirement?${query(input)}`, { validate: isRequirement });
}

export function getOetsContextCandidates(input: ContextAuthorityInput & { clientId: string }) {
  return apiRequest<OetsContextCandidatePage>(`/api/v1/operational-evidence/templates/${encodeURIComponent(input.templateCode)}/context-candidates?${query(input)}`, { validate: isCandidates });
}

export function resolveOetsContext(input: ContextAuthorityInput & { clientId: string; selectedId: string }) {
  return apiRequest<OetsResolvedContext>(`/api/v1/operational-evidence/templates/${encodeURIComponent(input.templateCode)}/context-candidates/${encodeURIComponent(input.selectedId)}?${query(input)}`, { validate: isResolved });
}

function object(value: unknown): value is Record<string, unknown> { return value !== null && typeof value === "object" && !Array.isArray(value); }
function isRequirement(value: unknown): value is OetsContextRequirement {
  if (!object(value) || typeof value.required !== "boolean") return false;
  if (value.required) {
    return typeof value.requirement_code === "string" && value.selection_mode === "EXPLICIT" && isPresentation(value.presentation) && isDuplicatePolicy(value.duplicate_policy) && isSuccessorPolicy(value.successor_policy);
  }
  return value.requirement_code === null && value.selection_mode === null && value.presentation === null && value.duplicate_policy === null && value.successor_policy === null;
}
function isPresentation(value: unknown): value is OetsContextPresentation { return object(value) && typeof value.label === "string" && typeof value.help_text === "string" && typeof value.candidate_singular === "string" && typeof value.candidate_plural === "string"; }
function isCandidate(value: unknown): value is OetsContextCandidate { return object(value) && typeof value.id === "string" && typeof value.primary_label === "string" && typeof value.secondary_label === "string" && (typeof value.context_kind === "string" || value.holder_kind === "TRAINEE" || value.holder_kind === "STAFF_MEMBER" || value.holder_kind === "TRAINING_ENROLLMENT"); }
function isCandidates(value: unknown): value is OetsContextCandidatePage { return object(value) && Array.isArray(value.candidates) && value.candidates.every(isCandidate) && Number.isInteger(value.count) && (value.count as number) >= 0 && (value.next_cursor === null || typeof value.next_cursor === "string") && value.selection_mode === "EXPLICIT"; }
function isResolved(value: unknown): value is OetsResolvedContext { return object(value) && typeof value.requirement_code === "string" && typeof value.selected_id === "string" && isCandidate(value.summary) && object(value.field_policy) && Object.values(value.field_policy).every((entry) => entry === "OPERATOR_EDITABLE" || entry === "READ_ONLY_DERIVED" || entry === "UNAVAILABLE_POST_ISSUANCE") && object(value.authoritative_values) && Object.values(value.authoritative_values).every(isAuthoritativeValue) && Array.isArray(value.required_fields) && value.required_fields.every((entry) => typeof entry === "string"); }
function isAuthoritativeValue(value: unknown): value is string | number | boolean | string[] | null { return value === null || typeof value === "string" || typeof value === "boolean" || (typeof value === "number" && Number.isFinite(value)) || (Array.isArray(value) && value.every((entry) => typeof entry === "string")); }
function isDuplicatePolicy(value: unknown): value is OetsContextDuplicatePolicy { return value === "IDEMPOTENCY_ONLY" || value === "ONE_LIVE_RECORD_PER_SUBJECT" || value === "ALLOW_MULTIPLE"; }
function isSuccessorPolicy(value: unknown): value is OetsContextSuccessorPolicy { return value === "CLONE_IMMUTABLE_CONTEXT" || value === "REQUIRE_RESELECTION" || value === "FORBID_CONTEXTUAL_SUCCESSOR"; }
