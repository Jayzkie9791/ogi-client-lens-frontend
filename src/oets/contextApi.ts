import { apiRequest } from "../api/client";

export type OetsContextFieldPolicy = "OPERATOR_EDITABLE" | "READ_ONLY_DERIVED" | "UNAVAILABLE_POST_ISSUANCE";

export interface OetsContextRequirement {
  required: boolean;
  requirement_code: string | null;
  selection_mode: "EXPLICIT" | null;
}

export interface OetsContextCandidate {
  id: string;
  primary_label: string;
  secondary_label: string;
  holder_kind: "TRAINEE" | "STAFF_MEMBER";
}

export interface OetsResolvedContext {
  requirement_code: string;
  selected_id: string;
  summary: OetsContextCandidate;
  field_policy: Record<string, OetsContextFieldPolicy>;
  authoritative_values: Record<string, string | number>;
}

interface ContextAuthorityInput { templateCode: string; templateVersionId: string; checksum: string; clientId?: string | null; facilityId?: string | null; }

function query(input: ContextAuthorityInput) {
  const value = new URLSearchParams({ template_version_id: input.templateVersionId, checksum: input.checksum });
  if (input.clientId) value.set("client_id", input.clientId);
  if (input.facilityId) value.set("facility_id", input.facilityId);
  return value.toString();
}

export function getOetsContextRequirement(input: ContextAuthorityInput) {
  return apiRequest<OetsContextRequirement>(`/api/v1/operational-evidence/templates/${encodeURIComponent(input.templateCode)}/context-requirement?${query(input)}`, { validate: isRequirement });
}

export function getOetsContextCandidates(input: ContextAuthorityInput & { clientId: string }) {
  return apiRequest<{ candidates: OetsContextCandidate[]; count: number; selection_mode: "EXPLICIT" }>(`/api/v1/operational-evidence/templates/${encodeURIComponent(input.templateCode)}/context-candidates?${query(input)}`, { validate: isCandidates });
}

export function resolveOetsContext(input: ContextAuthorityInput & { clientId: string; selectedId: string }) {
  return apiRequest<OetsResolvedContext>(`/api/v1/operational-evidence/templates/${encodeURIComponent(input.templateCode)}/context-candidates/${encodeURIComponent(input.selectedId)}?${query(input)}`, { validate: isResolved });
}

function object(value: unknown): value is Record<string, unknown> { return value !== null && typeof value === "object" && !Array.isArray(value); }
function isRequirement(value: unknown): value is OetsContextRequirement { return object(value) && typeof value.required === "boolean" && (value.requirement_code === null || typeof value.requirement_code === "string") && (value.selection_mode === null || value.selection_mode === "EXPLICIT"); }
function isCandidate(value: unknown): value is OetsContextCandidate { return object(value) && typeof value.id === "string" && typeof value.primary_label === "string" && typeof value.secondary_label === "string" && (value.holder_kind === "TRAINEE" || value.holder_kind === "STAFF_MEMBER"); }
function isCandidates(value: unknown): value is { candidates: OetsContextCandidate[]; count: number; selection_mode: "EXPLICIT" } { return object(value) && Array.isArray(value.candidates) && value.candidates.every(isCandidate) && typeof value.count === "number" && value.selection_mode === "EXPLICIT"; }
function isResolved(value: unknown): value is OetsResolvedContext { return object(value) && typeof value.requirement_code === "string" && typeof value.selected_id === "string" && isCandidate(value.summary) && object(value.field_policy) && Object.values(value.field_policy).every((entry) => entry === "OPERATOR_EDITABLE" || entry === "READ_ONLY_DERIVED" || entry === "UNAVAILABLE_POST_ISSUANCE") && object(value.authoritative_values) && Object.values(value.authoritative_values).every(isAuthoritativeValue); }
function isAuthoritativeValue(value: unknown): value is string | number { return typeof value === "string" || (typeof value === "number" && Number.isFinite(value)); }
