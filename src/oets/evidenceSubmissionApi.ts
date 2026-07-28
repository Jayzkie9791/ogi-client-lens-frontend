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

export interface OperationalEvidenceRecord {
  id: string;
  template_provenance: OperationalEvidenceTemplateProvenance;
  client_id: string;
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
}

export interface OperationalEvidenceTransitionRequest {
  transition_trigger: string;
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
    typeof value.client_id === "string" &&
    (typeof value.facility_id === "string" || value.facility_id === null) &&
    typeof value.lifecycle_state === "string" &&
    isRecord(value.payload) &&
    isRecord(value.payload.sections) &&
    typeof value.payload_checksum === "string" &&
    typeof value.created_by_user_id === "string" &&
    typeof value.submitted_by_user_id === "string" &&
    typeof value.created_at === "string" &&
    typeof value.submitted_at === "string" &&
    typeof value.updated_at === "string"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
