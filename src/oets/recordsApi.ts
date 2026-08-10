import { apiRequest } from "../api/client";

export type OperationalEvidenceRecordSortField =
  | "created_at"
  | "submitted_at"
  | "template_code"
  | "lifecycle_state";

export type OperationalEvidenceRecordSortDirection = "asc" | "desc";

export interface OperationalEvidenceRecordsFilters {
  lifecycle_state?: string;
  template_code?: string;
  submitted_from?: string;
  submitted_to?: string;
  sort_by?: OperationalEvidenceRecordSortField;
  sort_direction?: OperationalEvidenceRecordSortDirection;
  limit?: number;
  offset?: number;
}

export interface OperationalEvidenceRecordSummary {
  evidence_record_id: string;
  template_registry_id: string;
  template_version_id: string;
  template_code: string;
  template_version: string;
  schema_version: string;
  client_id: string;
  facility_id: string | null;
  lifecycle_state: string;
  payload_checksum: string;
  created_by_user_id: string | null;
  submitted_by_user_id: string | null;
  created_at: string;
  submitted_at: string;
  updated_at: string;
}

export interface OperationalEvidencePagination {
  limit: number;
  offset: number;
  count: number;
  total_count: number;
}

export interface OperationalEvidenceRecordsListResponse {
  records: OperationalEvidenceRecordSummary[];
  pagination: OperationalEvidencePagination;
}

export function listOperationalEvidenceRecords(
  filters: OperationalEvidenceRecordsFilters = {}
) {
  return apiRequest<OperationalEvidenceRecordsListResponse>(
    buildOperationalEvidenceRecordsPath(filters),
    {
      validate: isOperationalEvidenceRecordsListResponse
    }
  );
}

function buildOperationalEvidenceRecordsPath(
  filters: OperationalEvidenceRecordsFilters
) {
  const searchParams = new URLSearchParams();

  setStringParam(searchParams, "lifecycle_state", filters.lifecycle_state);
  setStringParam(searchParams, "template_code", filters.template_code);
  setStringParam(searchParams, "submitted_from", filters.submitted_from);
  setStringParam(searchParams, "submitted_to", filters.submitted_to);
  setStringParam(searchParams, "sort_by", filters.sort_by);
  setStringParam(searchParams, "sort_direction", filters.sort_direction);

  if (filters.limit !== undefined) {
    searchParams.set("limit", String(filters.limit));
  }

  if (filters.offset !== undefined) {
    searchParams.set("offset", String(filters.offset));
  }

  const query = searchParams.toString();

  return `/api/v1/operational-evidence/records${query ? `?${query}` : ""}`;
}

function setStringParam(
  searchParams: URLSearchParams,
  key: string,
  value: string | undefined
) {
  if (value) {
    searchParams.set(key, value);
  }
}

function isOperationalEvidenceRecordsListResponse(
  value: unknown
): value is OperationalEvidenceRecordsListResponse {
  return (
    isRecord(value) &&
    Array.isArray(value.records) &&
    value.records.every(isOperationalEvidenceRecordSummary) &&
    isOperationalEvidencePagination(value.pagination)
  );
}

function isOperationalEvidenceRecordSummary(
  value: unknown
): value is OperationalEvidenceRecordSummary {
  return (
    isRecord(value) &&
    typeof value.evidence_record_id === "string" &&
    typeof value.template_registry_id === "string" &&
    typeof value.template_version_id === "string" &&
    typeof value.template_code === "string" &&
    typeof value.template_version === "string" &&
    typeof value.schema_version === "string" &&
    typeof value.client_id === "string" &&
    (typeof value.facility_id === "string" || value.facility_id === null) &&
    typeof value.lifecycle_state === "string" &&
    typeof value.payload_checksum === "string" &&
    (typeof value.created_by_user_id === "string" ||
      value.created_by_user_id === null) &&
    (typeof value.submitted_by_user_id === "string" ||
      value.submitted_by_user_id === null) &&
    typeof value.created_at === "string" &&
    typeof value.submitted_at === "string" &&
    typeof value.updated_at === "string"
  );
}

function isOperationalEvidencePagination(
  value: unknown
): value is OperationalEvidencePagination {
  return (
    isRecord(value) &&
    typeof value.limit === "number" &&
    typeof value.offset === "number" &&
    typeof value.count === "number" &&
    typeof value.total_count === "number"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
