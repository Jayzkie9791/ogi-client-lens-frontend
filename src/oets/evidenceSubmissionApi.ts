import { apiRequest } from "../api/client";
import { isOetsFieldAuthorityPresentation } from "./definitionGuards";
import { OetsEvidencePayload, OetsFieldAuthorityPresentation, OetsFieldValue } from "./types";
import { isOetsContextRepeatableGroups, OetsContextCandidate, OetsContextFieldPolicy, OetsContextRepeatableGroup } from "./contextApi";

export interface OperationalEvidenceCreateRequest {
  template_code: string;
  template_version_id: string;
  checksum: string;
  client_id: string;
  facility_id?: string;
  payload: {
    sections: OetsEvidencePayload["sections"];
  };
  correlation_id?: string;
  context?: { requirement_code: string; selected_id: string };
}

export interface OperationalEvidenceDraftCreateRequest extends OperationalEvidenceCreateRequest {
  idempotency_key: string;
}

export interface OperationalEvidenceTemplateProvenance {
  template_id: string;
  template_code: string;
  template_version: string;
  template_registry_id: string;
  template_version_id: string;
  schema_version: string;
  document_number?: unknown;
  document_revision?: unknown;
  checksum: string;
}

export type OperationalEvidenceRecordScopeKind =
  | "CLIENT_SCOPED"
  | "TRAINING_SCOPED";

export interface OperationalEvidenceTrainingDraftContext {
  id: string;
  operational_evidence_record_id: string;
  training_enrollment_id: string;
  training_session_id: string | null;
  created_by_user_id: string | null;
  created_at: string;
  enrollment: {
    id: string;
    program_code: string;
    client_id: string | null;
    training_session_id: string | null;
    trainee: {
      id: string;
      student_number: string | null;
      full_name: string;
      email: string | null;
    };
    client: {
      id: string;
      organization_name: string;
      status: string;
    } | null;
    training_session: {
      id: string;
      training_title: string;
      training_start_date: string;
      training_end_date: string | null;
      facility_id: string | null;
      facility: {
        id: string;
        facility_name: string;
        client_id: string;
        operational_status: string;
      } | null;
      instructor_staff_member: {
        id: string;
        full_name: string;
        instructor_registry_identity: {
          instructor_number: string;
          status: string;
        } | null;
      } | null;
    } | null;
  };
}

export interface OperationalEvidenceRecord {
  id: string;
  predecessor_evidence_record_id?: string | null;
  correction_successor_id?: string | null;
  template_provenance: OperationalEvidenceTemplateProvenance;
  client_id: string | null;
  facility_id: string | null;
  lifecycle_state: string;
  payload: {
    sections: OetsEvidencePayload["sections"];
  };
  payload_checksum: string;
  created_by_user_id: string;
  submitted_by_user_id: string;
  created_at: string;
  submitted_at: string;
  updated_at: string;
  scope_kind?: OperationalEvidenceRecordScopeKind;
  training_context?: OperationalEvidenceTrainingDraftContext | null;
  context?: OperationalEvidenceExistingContext | null;
  creation_resolution?: OetsDraftCreationResolution;
  presentation?: {
    template_name: string;
    client_name: string | null;
    facility_name: string | null;
    subject: {
      kind: "CERTIFICATION_HOLDER" | "TRAINEE";
      display_name: string;
      reference_number: string | null;
      secondary_reference: string | null;
    } | null;
  } | null;
}

export interface OetsDraftCreationResolution {
  outcome: "CREATED_NEW" | "REUSED_EXISTING_CONTEXT_RECORD" | "IDEMPOTENT_REPLAY";
  requested_template_version: string;
  returned_template_version: string;
  version_relation: "CURRENT_VERSION_CREATED" | "CURRENT_VERSION_REUSED" | "HISTORICAL_VERSION_REUSED";
  duplicate_policy: "ONE_LIVE_RECORD_PER_SUBJECT" | "ONE_ACTIVE_DRAFT_PER_SUBJECT" | "ONE_EVIDENCE_LINEAGE_PER_SUBJECT" | null;
  context_kind: string | null;
  context_label: string | null;
  user_message_code: "NEW_DRAFT_CREATED" | "EXISTING_RECORD_REUSED" | "HISTORICAL_RECORD_REUSED" | "IDEMPOTENT_COMMAND_REPLAYED";
}

export interface OperationalEvidenceRecordDetail extends OperationalEvidenceRecord {
  field_authority: OetsFieldAuthorityPresentation;
}

export interface OperationalEvidenceExistingContext {
  requirement_code: string;
  context_kind: string;
  selected_id: string;
  summary: OetsContextCandidate;
  field_policy: Record<string, OetsContextFieldPolicy>;
  authoritative_values: Record<string, OetsFieldValue>;
  repeatable_groups?: OetsContextRepeatableGroup[];
  snapshot_provenance: "EVIDENCE_BINDING_AND_PAYLOAD";
}

export interface OperationalEvidenceTransitionRequest {
  transition_trigger: string;
  correlation_id?: string;
}

export interface OperationalEvidenceDraftPayloadUpdateRequest {
  payload: {
    sections: OetsEvidencePayload["sections"];
  };
  correlation_id?: string;
}

export interface OperationalEvidenceDraftDiscardRequest {
  expected_payload_checksum: string;
  idempotency_key: string;
  correlation_id?: string;
}

export function createOperationalEvidenceRecord(
  request: OperationalEvidenceCreateRequest
) {
  return apiRequest<OperationalEvidenceRecord>(
    "/api/v1/operational-evidence/records",
    {
      method: "POST",
      body: request,
      validate: isOperationalEvidenceRecord
    }
  );
}

export function createOperationalEvidenceDraft(request: OperationalEvidenceDraftCreateRequest) {
  return apiRequest<OperationalEvidenceRecord>(
    "/api/v1/operational-evidence/records/drafts",
    { method: "POST", body: request, validate: isOperationalEvidenceRecord }
  );
}

export function updateDraftOperationalEvidencePayload(
  recordId: string,
  request: OperationalEvidenceDraftPayloadUpdateRequest
) {
  return apiRequest<OperationalEvidenceRecord>(
    `/api/v1/operational-evidence/records/${encodeURIComponent(
      recordId
    )}/payload`,
    {
      method: "PATCH",
      body: {
        ...request,
        payload: {
          sections: request.payload.sections
        }
      },
      validate: isOperationalEvidenceRecord
    }
  );
}

export function transitionOperationalEvidenceRecord(
  recordId: string,
  request: OperationalEvidenceTransitionRequest
) {
  return apiRequest<OperationalEvidenceRecord>(
    `/api/v1/operational-evidence/records/${encodeURIComponent(
      recordId
    )}/transitions`,
    {
      method: "POST",
      body: request,
      validate: isOperationalEvidenceRecord
    }
  );
}

export function discardOperationalEvidenceDraft(
  recordId: string,
  request: OperationalEvidenceDraftDiscardRequest
) {
  return apiRequest<OperationalEvidenceRecord>(
    `/api/v1/operational-evidence/records/${encodeURIComponent(recordId)}/discard`,
    { method: "POST", body: request, validate: isOperationalEvidenceRecord }
  );
}

export function createOperationalEvidenceCorrectionDraft(recordId: string) {
  return apiRequest<OperationalEvidenceRecord>(
    `/api/v1/operational-evidence/records/${encodeURIComponent(recordId)}/correction-draft`,
    {
      method: "POST",
      body: { idempotency_key: crypto.randomUUID() },
      validate: isOperationalEvidenceRecord
    }
  );
}

export function createOperationalEvidenceRevisionDraft(recordId: string) {
  return apiRequest<OperationalEvidenceRecord>(
    `/api/v1/operational-evidence/records/${encodeURIComponent(recordId)}/revision-draft`,
    { method: "POST", body: { idempotency_key: crypto.randomUUID() }, validate: isOperationalEvidenceRecord }
  );
}

export function getOperationalEvidenceRecord(recordId: string) {
  return apiRequest<OperationalEvidenceRecordDetail>(
    `/api/v1/operational-evidence/records/${encodeURIComponent(recordId)}`,
    {
      validate: isOperationalEvidenceRecordDetail
    }
  );
}

function isOperationalEvidenceRecordDetail(value: unknown): value is OperationalEvidenceRecordDetail {
  return isOperationalEvidenceRecord(value) &&
    isRecord(value) &&
    isOetsFieldAuthorityPresentation(value.field_authority);
}

function isOperationalEvidenceRecord(
  value: unknown
): value is OperationalEvidenceRecord {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    (value.predecessor_evidence_record_id === undefined || typeof value.predecessor_evidence_record_id === "string" || value.predecessor_evidence_record_id === null) &&
    (value.correction_successor_id === undefined || typeof value.correction_successor_id === "string" || value.correction_successor_id === null) &&
    isRecord(value.template_provenance) &&
    typeof value.template_provenance.template_version_id === "string" &&
    typeof value.template_provenance.checksum === "string" &&
    (typeof value.client_id === "string" || value.client_id === null) &&
    (typeof value.facility_id === "string" || value.facility_id === null) &&
    typeof value.lifecycle_state === "string" &&
    isRecord(value.payload) &&
    isRecord(value.payload.sections) &&
    typeof value.payload_checksum === "string" &&
    typeof value.created_by_user_id === "string" &&
    typeof value.submitted_by_user_id === "string" &&
    typeof value.created_at === "string" &&
    typeof value.submitted_at === "string" &&
    typeof value.updated_at === "string" &&
    (value.scope_kind === undefined || isOperationalEvidenceScopeKind(value.scope_kind)) &&
    (value.training_context === undefined ||
      value.training_context === null ||
      isOperationalEvidenceTrainingDraftContext(value.training_context)) &&
    (value.context === undefined || value.context === null || isOperationalEvidenceExistingContext(value.context))
    && (value.creation_resolution === undefined || isOetsDraftCreationResolution(value.creation_resolution))
    && (value.presentation === undefined || value.presentation === null || isOperationalEvidencePresentation(value.presentation))
  );
}

function isOperationalEvidencePresentation(value: unknown) {
  if (!isRecord(value)) return false;
  const subject = value.subject;
  return typeof value.template_name === "string" &&
    (value.client_name === null || typeof value.client_name === "string") &&
    (value.facility_name === null || typeof value.facility_name === "string") &&
    (subject === null || (
      isRecord(subject) &&
      (subject.kind === "CERTIFICATION_HOLDER" || subject.kind === "TRAINEE") &&
      typeof subject.display_name === "string" &&
      (subject.reference_number === null || typeof subject.reference_number === "string") &&
      (subject.secondary_reference === null || typeof subject.secondary_reference === "string")
    ));
}

function isOetsDraftCreationResolution(value: unknown): value is OetsDraftCreationResolution {
  if (!isRecord(value)) return false;
  return ["CREATED_NEW", "REUSED_EXISTING_CONTEXT_RECORD", "IDEMPOTENT_REPLAY"].includes(String(value.outcome)) &&
    typeof value.requested_template_version === "string" &&
    typeof value.returned_template_version === "string" &&
    ["CURRENT_VERSION_CREATED", "CURRENT_VERSION_REUSED", "HISTORICAL_VERSION_REUSED"].includes(String(value.version_relation)) &&
    (value.duplicate_policy === null || ["ONE_LIVE_RECORD_PER_SUBJECT", "ONE_ACTIVE_DRAFT_PER_SUBJECT", "ONE_EVIDENCE_LINEAGE_PER_SUBJECT"].includes(String(value.duplicate_policy))) &&
    (value.context_kind === null || typeof value.context_kind === "string") &&
    (value.context_label === null || typeof value.context_label === "string") &&
    ["NEW_DRAFT_CREATED", "EXISTING_RECORD_REUSED", "HISTORICAL_RECORD_REUSED", "IDEMPOTENT_COMMAND_REPLAYED"].includes(String(value.user_message_code));
}

function isOperationalEvidenceExistingContext(value: unknown): value is OperationalEvidenceExistingContext {
  return isRecord(value) &&
    typeof value.requirement_code === "string" &&
    typeof value.context_kind === "string" &&
    typeof value.selected_id === "string" &&
    isContextCandidate(value.summary) &&
    isRecord(value.field_policy) &&
    Object.values(value.field_policy).every((entry) => entry === "OPERATOR_EDITABLE" || entry === "READ_ONLY_DERIVED" || entry === "UNAVAILABLE_POST_ISSUANCE") &&
    isRecord(value.authoritative_values) &&
    Object.values(value.authoritative_values).every(isOetsFieldValue) &&
    (value.repeatable_groups === undefined || isOetsContextRepeatableGroups(value.repeatable_groups)) &&
    value.snapshot_provenance === "EVIDENCE_BINDING_AND_PAYLOAD";
}

function isContextCandidate(value: unknown): value is OetsContextCandidate {
  return isRecord(value) && typeof value.id === "string" && typeof value.primary_label === "string" && typeof value.secondary_label === "string" && typeof value.context_kind === "string" && (value.holder_kind === undefined || value.holder_kind === "TRAINEE" || value.holder_kind === "STAFF_MEMBER" || value.holder_kind === "TRAINING_ENROLLMENT");
}

function isOetsFieldValue(value: unknown) {
  return value === null || typeof value === "string" || typeof value === "boolean" || (typeof value === "number" && Number.isFinite(value)) || (Array.isArray(value) && value.every((entry) => typeof entry === "string"));
}

function isOperationalEvidenceScopeKind(
  value: unknown
): value is OperationalEvidenceRecordScopeKind {
  return value === "CLIENT_SCOPED" || value === "TRAINING_SCOPED";
}

function isOperationalEvidenceTrainingDraftContext(
  value: unknown
): value is OperationalEvidenceTrainingDraftContext {
  if (!isRecord(value) || !isRecord(value.enrollment)) {
    return false;
  }

  const enrollment = value.enrollment;

  return (
    typeof value.id === "string" &&
    typeof value.operational_evidence_record_id === "string" &&
    typeof value.training_enrollment_id === "string" &&
    (typeof value.training_session_id === "string" || value.training_session_id === null) &&
    (typeof value.created_by_user_id === "string" || value.created_by_user_id === null) &&
    typeof value.created_at === "string" &&
    typeof enrollment.id === "string" &&
    typeof enrollment.program_code === "string" &&
    (typeof enrollment.client_id === "string" || enrollment.client_id === null) &&
    (typeof enrollment.training_session_id === "string" || enrollment.training_session_id === null) &&
    isRecord(enrollment.trainee) &&
    typeof enrollment.trainee.id === "string" &&
    (typeof enrollment.trainee.student_number === "string" ||
      enrollment.trainee.student_number === null) &&
    typeof enrollment.trainee.full_name === "string" &&
    (typeof enrollment.trainee.email === "string" || enrollment.trainee.email === null) &&
    (enrollment.client === null ||
      (isRecord(enrollment.client) &&
        typeof enrollment.client.id === "string" &&
        typeof enrollment.client.organization_name === "string" &&
        typeof enrollment.client.status === "string")) &&
    (enrollment.training_session === null ||
      (isRecord(enrollment.training_session) &&
        typeof enrollment.training_session.id === "string" &&
        typeof enrollment.training_session.training_title === "string" &&
        typeof enrollment.training_session.training_start_date === "string" &&
        (typeof enrollment.training_session.training_end_date === "string" ||
          enrollment.training_session.training_end_date === null) &&
        (typeof enrollment.training_session.facility_id === "string" ||
          enrollment.training_session.facility_id === null) &&
        (enrollment.training_session.instructor_staff_member === null ||
          (isRecord(enrollment.training_session.instructor_staff_member) &&
            typeof enrollment.training_session.instructor_staff_member.id === "string" &&
            typeof enrollment.training_session.instructor_staff_member.full_name === "string" &&
            (enrollment.training_session.instructor_staff_member.instructor_registry_identity === null ||
              (isRecord(enrollment.training_session.instructor_staff_member.instructor_registry_identity) &&
                typeof enrollment.training_session.instructor_staff_member.instructor_registry_identity.instructor_number === "string" &&
                typeof enrollment.training_session.instructor_staff_member.instructor_registry_identity.status === "string")))) &&
        (enrollment.training_session.facility === null ||
          (isRecord(enrollment.training_session.facility) &&
            typeof enrollment.training_session.facility.id === "string" &&
            typeof enrollment.training_session.facility.facility_name === "string" &&
            typeof enrollment.training_session.facility.client_id === "string" &&
            typeof enrollment.training_session.facility.operational_status === "string"))))
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
