import { apiRequest } from "../api/client";
import { OetsEvidencePayload } from "./types";

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
    } | null;
  };
}

export interface OperationalEvidenceRecord {
  id: string;
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

export function getOperationalEvidenceRecord(recordId: string) {
  return apiRequest<OperationalEvidenceRecord>(
    `/api/v1/operational-evidence/records/${encodeURIComponent(recordId)}`,
    {
      validate: isOperationalEvidenceRecord
    }
  );
}

function isOperationalEvidenceRecord(
  value: unknown
): value is OperationalEvidenceRecord {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
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
      isOperationalEvidenceTrainingDraftContext(value.training_context))
  );
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
