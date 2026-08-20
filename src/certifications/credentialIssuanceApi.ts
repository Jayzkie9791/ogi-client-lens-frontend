import { apiRequest } from "../api/client";
import {
  CredentialIssuanceResponse,
  isCredentialIssuanceResponse
} from "../credentials/credentialsApi";

export interface CredentialIssuanceListResponse {
  readonly issuances: readonly CredentialIssuanceResponse[];
}

export type CredentialIssuancePreparationStatus =
  | "READY_FOR_REVIEW"
  | "REQUIRES_INPUT"
  | "ALREADY_ISSUED"
  | "BLOCKED";

export type CredentialIssuancePreparationFieldStatus =
  | "DERIVED"
  | "SELECTABLE"
  | "REQUIRES_INPUT"
  | "UNAVAILABLE";

export interface CredentialIssuancePreparationField<T = string> {
  readonly value: T | null;
  readonly provenance_status: CredentialIssuancePreparationFieldStatus;
  readonly source: string | null;
  readonly message: string | null;
}

export interface CredentialIssuancePreparationF048EvidenceCandidate {
  readonly operational_evidence_record_id: string;
  readonly template_code: "OGI_F048_DIGITAL_CREDENTIAL_ISSUANCE_FORM";
  readonly template_version_id: string;
  readonly template_name: string;
  readonly document_number: string;
  readonly lifecycle_state: "GOVERNANCE_APPROVED";
  readonly client_id: string;
  readonly facility_id: string | null;
  readonly payload_checksum: string;
  readonly created_at: string;
  readonly submitted_at: string | null;
}

export interface CredentialIssuancePreparationAuthorizationOption {
  readonly id: string;
  readonly staff_member_id: string;
  readonly certification_id: string | null;
  readonly authorization_number: string;
  readonly authorization_level: string;
  readonly authorization_status: string;
  readonly issue_date: string;
  readonly expiry_date: string;
  readonly renewal_date: string | null;
}

export interface CredentialIssuancePreparationResponse {
  readonly preparation_status: CredentialIssuancePreparationStatus;
  readonly certification: {
    readonly id: string;
    readonly certification_number: CredentialIssuancePreparationField;
    readonly certification_level: CredentialIssuancePreparationField;
    readonly certification_status: CredentialIssuancePreparationField;
    readonly issue_date: CredentialIssuancePreparationField;
    readonly expiry_date: CredentialIssuancePreparationField;
    readonly program: {
      readonly program_code: string;
      readonly display_name: string;
      readonly qualification_label: string;
    } | null;
  };
  readonly subject: {
    readonly holder_name: CredentialIssuancePreparationField;
    readonly student_number: CredentialIssuancePreparationField;
    readonly trainee: {
      readonly id: string;
      readonly full_name: string;
      readonly student_number: string | null;
    } | null;
    readonly staff_member: {
      readonly id: string;
      readonly full_name: string;
      readonly client_id: string;
    } | null;
    readonly client: {
      readonly id: string;
      readonly organization_name: string;
    } | null;
  };
  readonly training: {
    readonly readiness_decision: {
      readonly id: string;
      readonly training_enrollment_id: string;
      readonly readiness_outcome: string;
      readonly decided_at: string;
    } | null;
    readonly enrollment: {
      readonly id: string;
      readonly trainee_id: string;
      readonly program_code: string;
      readonly client_id: string | null;
      readonly training_session_id: string | null;
      readonly enrolled_at: string;
    } | null;
    readonly session: {
      readonly id: string;
      readonly training_title: string;
      readonly training_start_date: string;
      readonly training_end_date: string | null;
      readonly instructor_name: string | null;
      readonly instructor_license_number: string | null;
      readonly facility: {
        readonly id: string;
        readonly client_id: string;
        readonly facility_name: string;
      } | null;
    } | null;
    readonly completion_date: CredentialIssuancePreparationField;
    readonly training_location: CredentialIssuancePreparationField;
    readonly instructor: CredentialIssuancePreparationField;
    readonly training_center: CredentialIssuancePreparationField;
  };
  readonly eligible_f048_evidence:
    readonly CredentialIssuancePreparationF048EvidenceCandidate[];
  readonly operational_authorization_options:
    readonly CredentialIssuancePreparationAuthorizationOption[];
  readonly existing_issuance: {
    readonly id: string;
    readonly source_certification_id: string;
    readonly issued_at: string;
    readonly certificate_template_code_snapshot: string;
  } | null;
  readonly missing_required_inputs: readonly string[];
  readonly limitations: readonly string[];
}

export interface IssueCredentialRequest {
  readonly certification_id: string;
  readonly source_evidence_record_id: string;
  readonly source_authorization_id?: string;
  readonly completion_date: string;
  readonly training_location: string;
  readonly instructor: string;
  readonly training_center: string;
}

export function listCredentialIssuancesByCertification(certificationId: string) {
  const searchParams = new URLSearchParams({ certificationId });

  return apiRequest<CredentialIssuanceListResponse>(
    `/api/v1/credentials/issuances?${searchParams.toString()}`,
    {
      validate: isCredentialIssuanceListResponse
    }
  );
}

export function getCredentialIssuancePreparation(certificationId: string) {
  const searchParams = new URLSearchParams({ certificationId });

  return apiRequest<CredentialIssuancePreparationResponse>(
    `/api/v1/credentials/issuances/preparation?${searchParams.toString()}`,
    {
      validate: isCredentialIssuancePreparationResponse
    }
  );
}

export function issueCredential(payload: IssueCredentialRequest) {
  return apiRequest<CredentialIssuanceResponse>(
    "/api/v1/credentials/issuances",
    {
      method: "POST",
      body: payload,
      validate: isCredentialIssuanceResponse
    }
  );
}

function isCredentialIssuancePreparationResponse(
  value: unknown
): value is CredentialIssuancePreparationResponse {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isPreparationStatus(value.preparation_status) &&
    isRecord(value.certification) &&
    isPreparationField(value.certification.certification_number) &&
    isPreparationField(value.certification.certification_level) &&
    isPreparationField(value.certification.certification_status) &&
    isPreparationField(value.certification.issue_date) &&
    isPreparationField(value.certification.expiry_date) &&
    (value.certification.program === null ||
      (isRecord(value.certification.program) &&
        typeof value.certification.program.program_code === "string" &&
        typeof value.certification.program.display_name === "string" &&
        typeof value.certification.program.qualification_label === "string")) &&
    isRecord(value.subject) &&
    isPreparationField(value.subject.holder_name) &&
    isPreparationField(value.subject.student_number) &&
    isRecord(value.training) &&
    isPreparationField(value.training.completion_date) &&
    isPreparationField(value.training.training_location) &&
    isPreparationField(value.training.instructor) &&
    isPreparationField(value.training.training_center) &&
    Array.isArray(value.eligible_f048_evidence) &&
    value.eligible_f048_evidence.every(isF048Candidate) &&
    Array.isArray(value.operational_authorization_options) &&
    value.operational_authorization_options.every(isAuthorizationOption) &&
    (value.existing_issuance === null || isRecord(value.existing_issuance)) &&
    Array.isArray(value.missing_required_inputs) &&
    value.missing_required_inputs.every((item) => typeof item === "string") &&
    Array.isArray(value.limitations) &&
    value.limitations.every((item) => typeof item === "string")
  );
}

function isPreparationStatus(value: unknown): value is CredentialIssuancePreparationStatus {
  return (
    value === "READY_FOR_REVIEW" ||
    value === "REQUIRES_INPUT" ||
    value === "ALREADY_ISSUED" ||
    value === "BLOCKED"
  );
}

function isPreparationField(
  value: unknown
): value is CredentialIssuancePreparationField {
  return (
    isRecord(value) &&
    (value.value === null || typeof value.value === "string") &&
    isPreparationFieldStatus(value.provenance_status) &&
    (value.source === null || typeof value.source === "string") &&
    (value.message === null || typeof value.message === "string")
  );
}

function isPreparationFieldStatus(
  value: unknown
): value is CredentialIssuancePreparationFieldStatus {
  return (
    value === "DERIVED" ||
    value === "SELECTABLE" ||
    value === "REQUIRES_INPUT" ||
    value === "UNAVAILABLE"
  );
}

function isF048Candidate(
  value: unknown
): value is CredentialIssuancePreparationF048EvidenceCandidate {
  return (
    isRecord(value) &&
    typeof value.operational_evidence_record_id === "string" &&
    value.template_code === "OGI_F048_DIGITAL_CREDENTIAL_ISSUANCE_FORM" &&
    typeof value.template_version_id === "string" &&
    typeof value.template_name === "string" &&
    typeof value.document_number === "string" &&
    value.lifecycle_state === "GOVERNANCE_APPROVED" &&
    typeof value.client_id === "string" &&
    (value.facility_id === null || typeof value.facility_id === "string") &&
    typeof value.payload_checksum === "string" &&
    typeof value.created_at === "string" &&
    (value.submitted_at === null || typeof value.submitted_at === "string")
  );
}

function isAuthorizationOption(
  value: unknown
): value is CredentialIssuancePreparationAuthorizationOption {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.staff_member_id === "string" &&
    (value.certification_id === null ||
      typeof value.certification_id === "string") &&
    typeof value.authorization_number === "string" &&
    typeof value.authorization_level === "string" &&
    typeof value.authorization_status === "string" &&
    typeof value.issue_date === "string" &&
    typeof value.expiry_date === "string" &&
    (value.renewal_date === null || typeof value.renewal_date === "string")
  );
}

function isCredentialIssuanceListResponse(
  value: unknown
): value is CredentialIssuanceListResponse {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Array.isArray((value as { readonly issuances?: unknown }).issuances) &&
    (value as { readonly issuances: readonly unknown[] }).issuances.every(
      isCredentialIssuanceResponse
    )
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
