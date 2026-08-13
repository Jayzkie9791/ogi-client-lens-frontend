import { apiRequest } from "../api/client";

export const credentialsEmploymentStatuses = [
  "ACTIVE",
  "INACTIVE",
  "SUSPENDED",
  "TERMINATED",
  "SEASONAL"
] as const;

export const credentialsCertificationStatuses = [
  "PENDING",
  "ACTIVE",
  "EXPIRED",
  "SUSPENDED",
  "REVOKED"
] as const;

export type CredentialsEmploymentStatus =
  (typeof credentialsEmploymentStatuses)[number];

export type CredentialsCertificationStatus =
  (typeof credentialsCertificationStatuses)[number];

export type CredentialsQualificationSource =
  | "CERTIFICATION"
  | "CERTIFICATION_ENDORSEMENT"
  | "OPERATIONAL_AUTHORIZATION";

export interface CredentialsClientProjection {
  id: string;
  organization_name: string;
}

export interface CredentialsFacilityProjection {
  id: string;
  facility_name: string;
  assignment_status: string;
  is_primary_assignment: boolean;
}

export interface CredentialsQualificationProjection {
  source_type: CredentialsQualificationSource;
  source_id: string;
  label: string;
  status: string;
  issue_date: string | null;
  expiry_date: string | null;
}

export interface CredentialsPersonnelProjection {
  id: string;
  full_name: string;
  hire_date: string | null;
  employment_status: CredentialsEmploymentStatus;
  client: CredentialsClientProjection;
  facilities: CredentialsFacilityProjection[];
  qualifications: CredentialsQualificationProjection[];
}

export interface CredentialsCertificationEndorsementProjection {
  endorsement: string;
  created_at: string;
}

export interface CredentialsCertificationProjection {
  id: string;
  certification_level: string;
  certification_number: string;
  certification_status: string;
  issue_date: string;
  expiry_date: string;
  medical_clearance_provided: boolean;
  fitness_standard_achieved: boolean;
  training_hours_completed: number | null;
  written_exam_score: number | null;
  endorsements: CredentialsCertificationEndorsementProjection[];
}

export interface CredentialsOperationalAuthorizationProjection {
  id: string;
  authorization_number: string;
  authorization_level: string;
  authorization_status: string;
  issue_date: string;
  expiry_date: string;
  renewal_date: string | null;
  certification_id: string | null;
  previous_authorization_id: string | null;
}

export interface CredentialsPersonnelDetailProjection
  extends CredentialsPersonnelProjection {
  email: string | null;
  phone_number: string | null;
  notes: string | null;
  certifications: CredentialsCertificationProjection[];
  operational_authorizations: CredentialsOperationalAuthorizationProjection[];
}

export interface CredentialsListResponse {
  personnel: CredentialsPersonnelProjection[];
}

export interface CredentialsListFilters {
  clientId?: string;
  facilityId?: string;
  employmentStatus?: CredentialsEmploymentStatus;
  certificationStatus?: CredentialsCertificationStatus;
}

export function listCredentials(filters: CredentialsListFilters = {}) {
  return apiRequest<CredentialsListResponse>(buildCredentialsPath(filters), {
    validate: isCredentialsListResponse
  });
}

export function getPersonnelCredentials(staffMemberId: string) {
  return apiRequest<CredentialsPersonnelDetailProjection>(
    `/api/v1/credentials/personnel/${encodeURIComponent(staffMemberId)}`,
    {
      validate: isCredentialsPersonnelDetailProjection
    }
  );
}

function buildCredentialsPath(filters: CredentialsListFilters) {
  const searchParams = new URLSearchParams();

  if (filters.clientId) {
    searchParams.set("clientId", filters.clientId);
  }

  if (filters.facilityId) {
    searchParams.set("facilityId", filters.facilityId);
  }

  if (filters.employmentStatus) {
    searchParams.set("employmentStatus", filters.employmentStatus);
  }

  if (filters.certificationStatus) {
    searchParams.set("certificationStatus", filters.certificationStatus);
  }

  const query = searchParams.toString();

  return `/api/v1/credentials${query ? `?${query}` : ""}`;
}

function isCredentialsListResponse(
  value: unknown
): value is CredentialsListResponse {
  return (
    isRecord(value) &&
    Array.isArray(value.personnel) &&
    value.personnel.every(isCredentialsPersonnelProjection)
  );
}

function isCredentialsPersonnelDetailProjection(
  value: unknown
): value is CredentialsPersonnelDetailProjection {
  if (!isRecord(value) || !isCredentialsPersonnelProjection(value)) {
    return false;
  }

  return (
    isNullableString(value.email) &&
    isNullableString(value.phone_number) &&
    isNullableString(value.notes) &&
    Array.isArray(value.certifications) &&
    value.certifications.every(isCredentialsCertificationProjection) &&
    Array.isArray(value.operational_authorizations) &&
    value.operational_authorizations.every(
      isCredentialsOperationalAuthorizationProjection
    )
  );
}

function isCredentialsPersonnelProjection(
  value: unknown
): value is CredentialsPersonnelProjection {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.full_name === "string" &&
    isNullableString(value.hire_date) &&
    isCredentialsEmploymentStatus(value.employment_status) &&
    isCredentialsClientProjection(value.client) &&
    Array.isArray(value.facilities) &&
    value.facilities.every(isCredentialsFacilityProjection) &&
    Array.isArray(value.qualifications) &&
    value.qualifications.every(isCredentialsQualificationProjection)
  );
}

function isCredentialsClientProjection(
  value: unknown
): value is CredentialsClientProjection {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.organization_name === "string"
  );
}

function isCredentialsFacilityProjection(
  value: unknown
): value is CredentialsFacilityProjection {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.facility_name === "string" &&
    typeof value.assignment_status === "string" &&
    typeof value.is_primary_assignment === "boolean"
  );
}

function isCredentialsQualificationProjection(
  value: unknown
): value is CredentialsQualificationProjection {
  return (
    isRecord(value) &&
    isCredentialsQualificationSource(value.source_type) &&
    typeof value.source_id === "string" &&
    typeof value.label === "string" &&
    typeof value.status === "string" &&
    isNullableString(value.issue_date) &&
    isNullableString(value.expiry_date)
  );
}

function isCredentialsCertificationProjection(
  value: unknown
): value is CredentialsCertificationProjection {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.certification_level === "string" &&
    typeof value.certification_number === "string" &&
    typeof value.certification_status === "string" &&
    typeof value.issue_date === "string" &&
    typeof value.expiry_date === "string" &&
    typeof value.medical_clearance_provided === "boolean" &&
    typeof value.fitness_standard_achieved === "boolean" &&
    isNullableNumber(value.training_hours_completed) &&
    isNullableNumber(value.written_exam_score) &&
    Array.isArray(value.endorsements) &&
    value.endorsements.every(isCredentialsCertificationEndorsementProjection)
  );
}

function isCredentialsCertificationEndorsementProjection(
  value: unknown
): value is CredentialsCertificationEndorsementProjection {
  return (
    isRecord(value) &&
    typeof value.endorsement === "string" &&
    typeof value.created_at === "string"
  );
}

function isCredentialsOperationalAuthorizationProjection(
  value: unknown
): value is CredentialsOperationalAuthorizationProjection {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.authorization_number === "string" &&
    typeof value.authorization_level === "string" &&
    typeof value.authorization_status === "string" &&
    typeof value.issue_date === "string" &&
    typeof value.expiry_date === "string" &&
    isNullableString(value.renewal_date) &&
    isNullableString(value.certification_id) &&
    isNullableString(value.previous_authorization_id)
  );
}

function isCredentialsEmploymentStatus(
  value: unknown
): value is CredentialsEmploymentStatus {
  return (
    typeof value === "string" &&
    credentialsEmploymentStatuses.includes(value as CredentialsEmploymentStatus)
  );
}

function isCredentialsQualificationSource(
  value: unknown
): value is CredentialsQualificationSource {
  return (
    value === "CERTIFICATION" ||
    value === "CERTIFICATION_ENDORSEMENT" ||
    value === "OPERATIONAL_AUTHORIZATION"
  );
}

function isNullableString(value: unknown) {
  return value === null || typeof value === "string";
}

function isNullableNumber(value: unknown) {
  return value === null || typeof value === "number";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
