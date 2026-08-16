import { apiBlobRequest, apiRequest } from "../api/client";

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

export interface CredentialsCertificationProgramProjection {
  program_code: string;
  certification_level: string;
  display_name: string;
  qualification_label: string;
  validity_period: {
    unit: "YEAR";
    value: 1;
  };
  teaching_authority_levels: string[];
  certificate_eligible: boolean;
  certificate_template_family_code: string;
  certificate_template_variant_code: null;
}

export interface CredentialsCertificationProjection {
  id: string;
  certification_level: string;
  program?: CredentialsCertificationProgramProjection;
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
  program?: CredentialsCertificationProgramProjection;
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

export interface CredentialIssuanceResponse {
  id: string;
  source_certification_id: string;
  staff_member_id: string;
  client_id: string;
  source_authorization_id: string | null;
  source_evidence_record_id: string | null;
  issued_by_user_id: string;
  credential_program_code_snapshot: string;
  certification_level_snapshot: string;
  program_display_name_snapshot: string;
  qualification_label_snapshot: string;
  required_training_hours: number;
  certificate_display: CredentialCertificateDisplayConfiguration;
  validity_period: {
    unit: "YEAR";
    value: 1;
  };
  certificate_template_code_snapshot: string;
  certificate_template_version_snapshot: string;
  certificate_template_variant_code_snapshot: string | null;
  holder_name_snapshot: string;
  certification_number_snapshot: string;
  issue_date_snapshot: string;
  expiry_date_snapshot: string;
  completion_date_snapshot: string | null;
  training_location_snapshot: string | null;
  instructor_snapshot: string | null;
  training_center_snapshot: string | null;
  certification_status_at_issuance: CredentialsCertificationStatus;
  issuing_organization_snapshot: string;
  supporting_evidence_refs: unknown[];
  issued_at: string;
}

export interface CredentialCertificateDisplayItem {
  key: string;
  label: string;
  source_section:
    | "KEY_SKILLS_AND_TRAINING"
    | "HOLDER_IS_QUALIFIED_TO"
    | "TRAINING_STANDARD"
    | "CERTIFICATION_SCOPE";
}

export interface CredentialCertificateDisplayConfiguration {
  qualification_title: string;
  skills: CredentialCertificateDisplayItem[];
  qualified_to: CredentialCertificateDisplayItem[];
  training_standards: CredentialCertificateDisplayItem[];
  scope_limitations: CredentialCertificateDisplayItem[];
  source_authority_refs: string[];
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

export function getCredentialIssuance(issuanceId: string) {
  return apiRequest<CredentialIssuanceResponse>(
    `/api/v1/credentials/issuances/${encodeURIComponent(issuanceId)}`,
    {
      validate: isCredentialIssuanceResponse
    }
  );
}

export function getCredentialIssuanceCertificate(issuanceId: string) {
  return apiBlobRequest(
    `/api/v1/credentials/issuances/${encodeURIComponent(issuanceId)}/certificate`
  );
}

export function getDevPreviewCredentialIssuance(level: string) {
  const searchParams = new URLSearchParams({ level });

  return apiRequest<CredentialIssuanceResponse>(
    `/api/v1/credentials/issuances/dev-preview?${searchParams.toString()}`,
    {
      validate: isCredentialIssuanceResponse
    }
  );
}

export function getDevPreviewCredentialCertificate(level: string) {
  const searchParams = new URLSearchParams({ level });

  return apiBlobRequest(
    `/api/v1/credentials/issuances/dev-preview/certificate?${searchParams.toString()}`
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

export function isCredentialIssuanceResponse(
  value: unknown
): value is CredentialIssuanceResponse {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.source_certification_id === "string" &&
    typeof value.staff_member_id === "string" &&
    typeof value.client_id === "string" &&
    isNullableString(value.source_authorization_id) &&
    isNullableString(value.source_evidence_record_id) &&
    typeof value.issued_by_user_id === "string" &&
    typeof value.credential_program_code_snapshot === "string" &&
    typeof value.certification_level_snapshot === "string" &&
    typeof value.program_display_name_snapshot === "string" &&
    typeof value.qualification_label_snapshot === "string" &&
    typeof value.required_training_hours === "number" &&
    isCredentialCertificateDisplayConfiguration(value.certificate_display) &&
    isRecord(value.validity_period) &&
    value.validity_period.unit === "YEAR" &&
    value.validity_period.value === 1 &&
    typeof value.certificate_template_code_snapshot === "string" &&
    typeof value.certificate_template_version_snapshot === "string" &&
    isNullableString(value.certificate_template_variant_code_snapshot) &&
    typeof value.holder_name_snapshot === "string" &&
    typeof value.certification_number_snapshot === "string" &&
    typeof value.issue_date_snapshot === "string" &&
    typeof value.expiry_date_snapshot === "string" &&
    isNullableString(value.completion_date_snapshot) &&
    isNullableString(value.training_location_snapshot) &&
    isNullableString(value.instructor_snapshot) &&
    isNullableString(value.training_center_snapshot) &&
    isCredentialsCertificationStatus(value.certification_status_at_issuance) &&
    typeof value.issuing_organization_snapshot === "string" &&
    Array.isArray(value.supporting_evidence_refs) &&
    typeof value.issued_at === "string"
  );
}

function isCredentialCertificateDisplayConfiguration(
  value: unknown
): value is CredentialCertificateDisplayConfiguration {
  return (
    isRecord(value) &&
    typeof value.qualification_title === "string" &&
    Array.isArray(value.skills) &&
    value.skills.every(isCredentialCertificateDisplayItem) &&
    Array.isArray(value.qualified_to) &&
    value.qualified_to.every(isCredentialCertificateDisplayItem) &&
    Array.isArray(value.training_standards) &&
    value.training_standards.every(isCredentialCertificateDisplayItem) &&
    Array.isArray(value.scope_limitations) &&
    value.scope_limitations.every(isCredentialCertificateDisplayItem) &&
    Array.isArray(value.source_authority_refs) &&
    value.source_authority_refs.every((item) => typeof item === "string")
  );
}

function isCredentialCertificateDisplayItem(
  value: unknown
): value is CredentialCertificateDisplayItem {
  return (
    isRecord(value) &&
    typeof value.key === "string" &&
    typeof value.label === "string" &&
    (value.source_section === "KEY_SKILLS_AND_TRAINING" ||
      value.source_section === "HOLDER_IS_QUALIFIED_TO" ||
      value.source_section === "TRAINING_STANDARD" ||
      value.source_section === "CERTIFICATION_SCOPE")
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
    (value.program === undefined ||
      isCredentialsCertificationProgramProjection(value.program)) &&
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

function isCredentialsCertificationProgramProjection(
  value: unknown
): value is CredentialsCertificationProgramProjection {
  return (
    isRecord(value) &&
    typeof value.program_code === "string" &&
    typeof value.certification_level === "string" &&
    typeof value.display_name === "string" &&
    typeof value.qualification_label === "string" &&
    isRecord(value.validity_period) &&
    value.validity_period.unit === "YEAR" &&
    value.validity_period.value === 1 &&
    Array.isArray(value.teaching_authority_levels) &&
    value.teaching_authority_levels.every((item) => typeof item === "string") &&
    typeof value.certificate_eligible === "boolean" &&
    typeof value.certificate_template_family_code === "string" &&
    value.certificate_template_variant_code === null
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
    (value.program === undefined ||
      isCredentialsCertificationProgramProjection(value.program)) &&
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

function isCredentialsCertificationStatus(
  value: unknown
): value is CredentialsCertificationStatus {
  return (
    typeof value === "string" &&
    credentialsCertificationStatuses.includes(
      value as CredentialsCertificationStatus
    )
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
