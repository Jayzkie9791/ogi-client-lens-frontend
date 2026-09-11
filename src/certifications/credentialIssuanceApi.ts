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

export interface CredentialIssuancePreparationF048GovernanceCandidate {
  readonly source_evidence_record_id: string;
  readonly display_reference: string;
  readonly template_code: "OGI_F048_DIGITAL_CREDENTIAL_ISSUANCE_FORM";
  readonly template_version: string;
  readonly lifecycle_state: "GOVERNANCE_APPROVED";
  readonly review_status: "CURRENT_GOVERNANCE_APPROVED";
  readonly review_conclusion_id: string;
  readonly client_business_reference: string | null;
  readonly facility_business_reference: string | null;
  readonly completed_at: string;
  readonly already_bound: false;
  readonly consumed: false;
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
  readonly evidence_binding_candidates:
    readonly CredentialIssuancePreparationF048GovernanceCandidate[];
  readonly operational_authorization_options:
    readonly CredentialIssuancePreparationAuthorizationOption[];
  readonly existing_issuance: {
    readonly id: string;
    readonly source_certification_id: string;
    readonly issued_at: string;
    readonly certificate_template_code_snapshot: string;
  } | null;
  readonly missing_required_inputs: readonly string[];
  readonly remediation_actions: readonly CredentialIssuanceRemediationAction[];
  readonly limitations: readonly string[];
}

export type CredentialIssuanceRemediationClass = "NOT_APPLICABLE" | "SYSTEM_REPAIR_AVAILABLE" | "SYSTEM_RECALCULATION_AVAILABLE" | "GOVERNANCE_REMEDIATION_REQUIRED" | "OPERATIONAL_INPUT_REQUIRED" | "IMMUTABLE_CORRECTION_REQUIRED" | "NOT_REMEDIABLE" | "ALREADY_RESOLVED";
export interface CredentialIssuanceRemediationAction {
  readonly blocker_code: string;
  readonly authority_owner: "SYSTEM" | "TRAINING" | "CREDENTIAL_GOVERNANCE" | "CREDENTIAL_OPERATOR" | "CREDENTIAL_ISSUANCE";
  readonly remediation_class: CredentialIssuanceRemediationClass;
  readonly action_code: string | null;
  readonly action_available: boolean;
  readonly actor_can_act: boolean;
  readonly message: string;
  readonly business_reference: string | null;
}

export interface EvaluateCredentialIssuanceRequest {
  readonly certification_id: string;
  readonly source_evidence_record_id: string;
  readonly source_authorization_id?: string;
  readonly completion_date: string;
  readonly training_location: string;
  readonly instructor: string;
  readonly training_center: string;
}

export interface CredentialIssuanceEvaluationResponse {
  readonly preparation_status: "READY_FOR_REVIEW";
  readonly evaluation_id: string;
  readonly evaluation_checksum: string;
  readonly evaluated_at: string;
  readonly evaluated_by: { readonly id: string; readonly name: string };
  readonly derived_facts: { readonly holder_name: string; readonly program: Record<string, unknown>; readonly instructor_provenance: "TRAINING_SESSION" | "OPERATOR_INPUT"; readonly readiness_decision_id: string | null };
  readonly operator_inputs: { readonly completion_date: string; readonly training_location: string; readonly instructor: string; readonly training_center: string };
  readonly selected_evidence: { readonly binding_id: string; readonly evidence_record_id: string; readonly template_code: "OGI_F048_DIGITAL_CREDENTIAL_ISSUANCE_FORM" };
  readonly selected_authorization: { readonly id: string; readonly business_identifier: string | null } | null;
  readonly blockers: readonly string[];
  readonly warnings: readonly string[];
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

export function evaluateCredentialIssuance(payload: EvaluateCredentialIssuanceRequest) {
  return apiRequest<CredentialIssuanceEvaluationResponse>(
    "/api/v1/credentials/issuances/preparation/evaluations",
    { method: "POST", body: payload, validate: isCredentialIssuanceEvaluationResponse }
  );
}

export function confirmCredentialIssuance(evaluation: Pick<CredentialIssuanceEvaluationResponse, "evaluation_id" | "evaluation_checksum">, idempotencyKey: string) {
  return apiRequest<CredentialIssuanceResponse>(
    "/api/v1/credentials/issuances",
    {
      method: "POST",
      headers: { "idempotency-key": idempotencyKey },
      body: evaluation,
      validate: isCredentialIssuanceResponse
    }
  );
}

export interface CredentialEvidenceBindingReviewResponse {
  readonly review: { readonly id: string };
  readonly replayed: boolean;
}

export function requestCredentialEvidenceBindingReview(
  certificationId: string,
  sourceEvidenceRecordId: string,
  idempotencyKey: string
) {
  return apiRequest<CredentialEvidenceBindingReviewResponse>(
    "/api/v1/credentials/issuances/evidence-bindings/reviews",
    {
      method: "POST",
      headers: { "idempotency-key": idempotencyKey },
      body: {
        source_evidence_record_id: sourceEvidenceRecordId,
        certification_id: certificationId,
        action: "ESTABLISH"
      },
      validate: isCredentialEvidenceBindingReviewResponse
    }
  );
}

export function decideCredentialEvidenceBindingReview(
  reviewId: string,
  rationale: string,
  idempotencyKey: string
) {
  return apiRequest<CredentialEvidenceBindingReviewResponse>(
    `/api/v1/governed-reviews/${encodeURIComponent(reviewId)}/decision`,
    {
      method: "POST",
      body: { decision: "APPROVED", rationale, idempotencyKey },
      validate: isCredentialEvidenceBindingReviewResponse
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
    Array.isArray(value.evidence_binding_candidates) &&
    value.evidence_binding_candidates.every(isF048GovernanceCandidate) &&
    Array.isArray(value.operational_authorization_options) &&
    value.operational_authorization_options.every(isAuthorizationOption) &&
    (value.existing_issuance === null || isRecord(value.existing_issuance)) &&
    Array.isArray(value.missing_required_inputs) &&
    value.missing_required_inputs.every((item) => typeof item === "string") &&
    Array.isArray(value.remediation_actions) &&
    value.remediation_actions.every(isRemediationAction) &&
    Array.isArray(value.limitations) &&
    value.limitations.every((item) => typeof item === "string")
  );
}

function isF048GovernanceCandidate(
  value: unknown
): value is CredentialIssuancePreparationF048GovernanceCandidate {
  return (
    isRecord(value) &&
    isUuid(value.source_evidence_record_id) &&
    typeof value.display_reference === "string" && value.display_reference.trim().length > 0 &&
    value.template_code === "OGI_F048_DIGITAL_CREDENTIAL_ISSUANCE_FORM" &&
    typeof value.template_version === "string" && value.template_version.trim().length > 0 &&
    value.lifecycle_state === "GOVERNANCE_APPROVED" &&
    value.review_status === "CURRENT_GOVERNANCE_APPROVED" &&
    isUuid(value.review_conclusion_id) &&
    (value.client_business_reference === null || typeof value.client_business_reference === "string") &&
    (value.facility_business_reference === null || typeof value.facility_business_reference === "string") &&
    typeof value.completed_at === "string" && !Number.isNaN(Date.parse(value.completed_at)) &&
    value.already_bound === false &&
    value.consumed === false
  );
}

function isCredentialEvidenceBindingReviewResponse(
  value: unknown
): value is CredentialEvidenceBindingReviewResponse {
  return isRecord(value) && isRecord(value.review) &&
    isUuid(value.review.id) && typeof value.replayed === "boolean";
}

function isUuid(value: unknown): value is string {
  return typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function isRemediationAction(value: unknown): value is CredentialIssuanceRemediationAction {
  return isRecord(value) && typeof value.blocker_code === "string" && typeof value.authority_owner === "string" && typeof value.remediation_class === "string" && (value.action_code === null || typeof value.action_code === "string") && typeof value.action_available === "boolean" && typeof value.actor_can_act === "boolean" && typeof value.message === "string" && (value.business_reference === null || typeof value.business_reference === "string");
}

function isCredentialIssuanceEvaluationResponse(value: unknown): value is CredentialIssuanceEvaluationResponse {
  return isRecord(value) && value.preparation_status === "READY_FOR_REVIEW" && typeof value.evaluation_id === "string" && typeof value.evaluation_checksum === "string" && /^[0-9a-f]{64}$/i.test(value.evaluation_checksum) && typeof value.evaluated_at === "string" && isRecord(value.evaluated_by) && typeof value.evaluated_by.id === "string" && typeof value.evaluated_by.name === "string" && isRecord(value.derived_facts) && isRecord(value.operator_inputs) && isRecord(value.selected_evidence) && (value.selected_authorization === null || isRecord(value.selected_authorization)) && Array.isArray(value.blockers) && value.blockers.every((item) => typeof item === "string") && Array.isArray(value.warnings) && value.warnings.every((item) => typeof item === "string");
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
