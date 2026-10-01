import { apiRequest } from "../api/client";
import { isOetsFieldAuthorityPresentation } from "./definitionGuards";
import type { OetsFieldAuthorityPresentation } from "./types";

export type OetsContextFieldPolicy = "OPERATOR_EDITABLE" | "READ_ONLY_DERIVED" | "UNAVAILABLE_POST_ISSUANCE";
export type OetsContextDuplicatePolicy = "IDEMPOTENCY_ONLY" | "ONE_LIVE_RECORD_PER_SUBJECT" | "ONE_ACTIVE_DRAFT_PER_SUBJECT" | "ONE_EVIDENCE_LINEAGE_PER_SUBJECT" | "ALLOW_MULTIPLE";
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
  repeatable_groups?: OetsContextRepeatableGroup[];
  field_authority: OetsFieldAuthorityPresentation;
}

export type OetsContextRecordResolution =
  | { resolution: "NOT_APPLICABLE"; duplicate_policy: null | OetsContextDuplicatePolicy }
  | { resolution: "NO_EXISTING_RECORD"; duplicate_policy: OetsContextDuplicatePolicy }
  | {
      resolution: "EXISTING_RECORD";
      duplicate_policy: OetsContextDuplicatePolicy;
      record: {
        evidence_record_id: string;
        lifecycle_state: string;
        template_version: string;
        version_relation: "CURRENT_VERSION" | "HISTORICAL_VERSION";
        access_action: "CONTINUE_DRAFT" | "VIEW_RECORD";
      };
    };

export interface OetsContextRepeatableSection { section_code: string; instances: Record<string, string | number | boolean | string[] | null>[]; }
export interface OetsContextRepeatableGroup { group_code: string; cardinality: "FIXED"; instance_count: number; max_instances: number; sections: OetsContextRepeatableSection[]; }

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

export function resolveOetsExistingContextRecord(input: ContextAuthorityInput & {
  clientId: string;
  requirementCode: string;
  selectedId: string;
}) {
  return apiRequest<OetsContextRecordResolution>(
    `/api/v1/operational-evidence/templates/${encodeURIComponent(input.templateCode)}/context-record-resolution`,
    {
      method: "POST",
      body: {
        template_version_id: input.templateVersionId,
        checksum: input.checksum,
        client_id: input.clientId,
        facility_id: input.facilityId ?? null,
        context: {
          requirement_code: input.requirementCode,
          selected_id: input.selectedId
        }
      },
      validate: isContextRecordResolution
    }
  );
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
function isResolved(value: unknown): value is OetsResolvedContext { return object(value) && typeof value.requirement_code === "string" && typeof value.selected_id === "string" && isCandidate(value.summary) && object(value.field_policy) && Object.values(value.field_policy).every((entry) => entry === "OPERATOR_EDITABLE" || entry === "READ_ONLY_DERIVED" || entry === "UNAVAILABLE_POST_ISSUANCE") && object(value.authoritative_values) && Object.values(value.authoritative_values).every(isAuthoritativeValue) && Array.isArray(value.required_fields) && value.required_fields.every((entry) => typeof entry === "string") && (value.repeatable_groups === undefined || isOetsContextRepeatableGroups(value.repeatable_groups)) && isOetsFieldAuthorityPresentation(value.field_authority); }
function isContextRecordResolution(value: unknown): value is OetsContextRecordResolution {
  if (!object(value) || !["NOT_APPLICABLE", "NO_EXISTING_RECORD", "EXISTING_RECORD"].includes(String(value.resolution)) || !isDuplicatePolicyOrNull(value.duplicate_policy)) return false;
  if (value.resolution !== "EXISTING_RECORD") return !("record" in value);
  const record = value.record;
  return object(record) && typeof record.evidence_record_id === "string" && typeof record.lifecycle_state === "string" && typeof record.template_version === "string" && (record.version_relation === "CURRENT_VERSION" || record.version_relation === "HISTORICAL_VERSION") && (record.access_action === "CONTINUE_DRAFT" || record.access_action === "VIEW_RECORD");
}
function isDuplicatePolicyOrNull(value: unknown): value is OetsContextDuplicatePolicy | null { return value === null || isDuplicatePolicy(value); }
export function isOetsContextRepeatableGroups(value: unknown): value is OetsContextRepeatableGroup[] {
  if (!Array.isArray(value)) return false;
  const groups = new Set<string>(), sections = new Set<string>(); let total = 0;
  return value.every((group) => {
    if (!object(group) || typeof group.group_code !== "string" || !/^[A-Z0-9_.-]+$/.test(group.group_code) || groups.has(group.group_code) || group.cardinality !== "FIXED" || !Number.isInteger(group.instance_count) || (group.instance_count as number) < 1 || !Number.isInteger(group.max_instances) || (group.max_instances as number) < (group.instance_count as number) || (group.max_instances as number) > 100 || !Array.isArray(group.sections) || group.sections.length < 1) return false;
    groups.add(group.group_code); total += group.instance_count as number; if (total > 200) return false;
    return group.sections.every((section) => {
      if (!object(section) || typeof section.section_code !== "string" || !/^[A-Z0-9_.-]+$/.test(section.section_code) || sections.has(section.section_code) || !Array.isArray(section.instances) || section.instances.length !== group.instance_count) return false;
      sections.add(section.section_code);
      return section.instances.every((instance) => object(instance) && Object.values(instance).every(isAuthoritativeValue));
    });
  });
}
function isAuthoritativeValue(value: unknown): value is string | number | boolean | string[] | null { return value === null || typeof value === "string" || typeof value === "boolean" || (typeof value === "number" && Number.isFinite(value)) || (Array.isArray(value) && value.every((entry) => typeof entry === "string")); }
function isDuplicatePolicy(value: unknown): value is OetsContextDuplicatePolicy { return value === "IDEMPOTENCY_ONLY" || value === "ONE_LIVE_RECORD_PER_SUBJECT" || value === "ONE_ACTIVE_DRAFT_PER_SUBJECT" || value === "ONE_EVIDENCE_LINEAGE_PER_SUBJECT" || value === "ALLOW_MULTIPLE"; }
function isSuccessorPolicy(value: unknown): value is OetsContextSuccessorPolicy { return value === "CLONE_IMMUTABLE_CONTEXT" || value === "REQUIRE_RESELECTION" || value === "FORBID_CONTEXTUAL_SUCCESSOR"; }
