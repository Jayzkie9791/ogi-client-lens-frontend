import { apiRequest } from "../api/client";
import { GovernanceReviewClaim } from "./governanceApi";
import { OperationalEvidenceRecord, OperationalEvidenceTemplateProvenance } from "./evidenceSubmissionApi";

export interface ReviewConclusionWorkflowContext {
  source_lifecycle_state: string;
  transition_trigger: string;
  target_lifecycle_state: string;
}

export interface ReviewConclusionQueryContext {
  reviewed_evidence_integrity_checksum: string;
  governing_template_version_id: string;
  reviewer_authority_code: string;
  source_lifecycle_state: string;
  transition_trigger: string;
  target_lifecycle_state: string;
}

export interface ReviewConclusion {
  id: string;
  reviewed_evidence_record_id: string;
  reviewed_evidence_integrity_checksum: string;
  governing_template: OperationalEvidenceTemplateProvenance;
  reviewer_actor_id: string;
  reviewer_authority_code: string;
  review_claim_id: string;
  workflow_context: ReviewConclusionWorkflowContext;
  rationale: string;
  predecessor_conclusion_id: string | null;
  revision_reason: string | null;
  correlation_id: string | null;
  created_at: string;
}

export interface ClaimedGovernanceReviewConclusionTransitionRequest {
  governance_authority_code: string;
  transition_trigger: string;
  rationale: string;
  predecessor_conclusion_id?: string;
  revision_reason?: string;
  correlation_id?: string;
}

export interface ClaimedGovernanceReviewConclusionTransitionResponse {
  conclusion: ReviewConclusion;
  evidence_record: OperationalEvidenceRecord;
  review_claim: GovernanceReviewClaim;
}

export interface ReviewConclusionHistoryResponse {
  conclusions: ReviewConclusion[];
}

export interface CurrentReviewConclusionResponse {
  conclusion: ReviewConclusion | null;
}

export function transitionClaimedGovernanceReviewWithConclusion(
  evidenceRecordId: string,
  claimId: string,
  request: ClaimedGovernanceReviewConclusionTransitionRequest
) {
  return apiRequest<ClaimedGovernanceReviewConclusionTransitionResponse>(
    `/api/v1/operational-evidence/records/${encodeURIComponent(
      evidenceRecordId
    )}/governance/review-claims/${encodeURIComponent(
      claimId
    )}/conclusions/transitions`,
    {
      method: "POST",
      body: request,
      validate: isClaimedGovernanceReviewConclusionTransitionResponse
    }
  );
}

export function getReviewConclusion(
  evidenceRecordId: string,
  conclusionId: string
) {
  return apiRequest<ReviewConclusion>(
    `/api/v1/operational-evidence/records/${encodeURIComponent(
      evidenceRecordId
    )}/review-conclusions/${encodeURIComponent(conclusionId)}`,
    {
      validate: isReviewConclusion
    }
  );
}

export function listReviewConclusionHistory(
  evidenceRecordId: string,
  context: ReviewConclusionQueryContext
) {
  return apiRequest<ReviewConclusionHistoryResponse>(
    `/api/v1/operational-evidence/records/${encodeURIComponent(
      evidenceRecordId
    )}/review-conclusions?${buildReviewConclusionQuery(context)}`,
    {
      validate: isReviewConclusionHistoryResponse
    }
  );
}

export function getCurrentReviewConclusion(
  evidenceRecordId: string,
  context: ReviewConclusionQueryContext
) {
  return apiRequest<CurrentReviewConclusionResponse>(
    `/api/v1/operational-evidence/records/${encodeURIComponent(
      evidenceRecordId
    )}/review-conclusions/current?${buildReviewConclusionQuery(context)}`,
    {
      validate: isCurrentReviewConclusionResponse
    }
  );
}

function buildReviewConclusionQuery(context: ReviewConclusionQueryContext) {
  return new URLSearchParams({
    reviewed_evidence_integrity_checksum:
      context.reviewed_evidence_integrity_checksum,
    governing_template_version_id: context.governing_template_version_id,
    reviewer_authority_code: context.reviewer_authority_code,
    source_lifecycle_state: context.source_lifecycle_state,
    transition_trigger: context.transition_trigger,
    target_lifecycle_state: context.target_lifecycle_state
  }).toString();
}

function isClaimedGovernanceReviewConclusionTransitionResponse(
  value: unknown
): value is ClaimedGovernanceReviewConclusionTransitionResponse {
  return (
    isRecord(value) &&
    isReviewConclusion(value.conclusion) &&
    isOperationalEvidenceRecord(value.evidence_record) &&
    isGovernanceReviewClaim(value.review_claim)
  );
}

function isReviewConclusionHistoryResponse(
  value: unknown
): value is ReviewConclusionHistoryResponse {
  return (
    isRecord(value) &&
    Array.isArray(value.conclusions) &&
    value.conclusions.every(isReviewConclusion)
  );
}

function isCurrentReviewConclusionResponse(
  value: unknown
): value is CurrentReviewConclusionResponse {
  return (
    isRecord(value) &&
    (value.conclusion === null || isReviewConclusion(value.conclusion))
  );
}

function isReviewConclusion(value: unknown): value is ReviewConclusion {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.reviewed_evidence_record_id === "string" &&
    typeof value.reviewed_evidence_integrity_checksum === "string" &&
    isTemplateProvenance(value.governing_template) &&
    typeof value.reviewer_actor_id === "string" &&
    typeof value.reviewer_authority_code === "string" &&
    typeof value.review_claim_id === "string" &&
    isWorkflowContext(value.workflow_context) &&
    typeof value.rationale === "string" &&
    (typeof value.predecessor_conclusion_id === "string" ||
      value.predecessor_conclusion_id === null) &&
    (typeof value.revision_reason === "string" ||
      value.revision_reason === null) &&
    (typeof value.correlation_id === "string" ||
      value.correlation_id === null) &&
    typeof value.created_at === "string"
  );
}

function isWorkflowContext(
  value: unknown
): value is ReviewConclusionWorkflowContext {
  return (
    isRecord(value) &&
    typeof value.source_lifecycle_state === "string" &&
    typeof value.transition_trigger === "string" &&
    typeof value.target_lifecycle_state === "string"
  );
}

function isTemplateProvenance(
  value: unknown
): value is OperationalEvidenceTemplateProvenance {
  return (
    isRecord(value) &&
    typeof value.template_id === "string" &&
    typeof value.template_code === "string" &&
    typeof value.template_version === "string" &&
    typeof value.template_registry_id === "string" &&
    typeof value.template_version_id === "string" &&
    typeof value.schema_version === "string" &&
    typeof value.checksum === "string"
  );
}

function isGovernanceReviewClaim(value: unknown): value is GovernanceReviewClaim {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.evidence_record_id === "string" &&
    typeof value.template_version_id === "string" &&
    typeof value.governance_authority_code === "string" &&
    typeof value.lifecycle_state === "string" &&
    typeof value.transition_trigger === "string" &&
    (value.claim_status === "ACTIVE" ||
      value.claim_status === "RELEASED" ||
      value.claim_status === "COMPLETED") &&
    typeof value.claimed_by_user_id === "string" &&
    typeof value.claimed_at === "string" &&
    (typeof value.released_at === "string" || value.released_at === null) &&
    (typeof value.completed_at === "string" || value.completed_at === null) &&
    typeof value.created_at === "string" &&
    typeof value.updated_at === "string"
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