import { apiRequest } from "../api/client";
import { OperationalEvidenceRecord } from "./evidenceSubmissionApi";

export type GovernanceReviewClaimStatus = "ACTIVE" | "RELEASED" | "COMPLETED";
export type GovernanceQueueClaimFilter = "UNCLAIMED" | "CLAIMED" | "ANY";

export interface GovernanceReviewClaim {
  id: string;
  evidence_record_id: string;
  template_version_id: string;
  governance_authority_code: string;
  lifecycle_state: string;
  transition_trigger: string;
  claim_status: GovernanceReviewClaimStatus;
  claimed_by_user_id: string;
  claimed_at: string;
  released_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface GovernanceQueueItem {
  evidence_record: OperationalEvidenceRecord;
  governance_authority_code: string;
  lifecycle_state: string;
  transition_trigger: string;
  target_state: string;
  active_claim: GovernanceReviewClaim | null;
}

export interface GovernanceQueueFilter {
  governance_authority_code?: string;
  lifecycle_state?: string;
  client_id?: string;
  facility_id?: string;
  claim_status?: GovernanceQueueClaimFilter;
}

export interface ClaimGovernanceReviewRequest {
  evidence_record_id: string;
  governance_authority_code: string;
  transition_trigger: string;
  correlation_id?: string;
}

export interface GovernanceReviewActionRequest {
  correlation_id?: string;
}

export function listGovernanceQueue(filter: GovernanceQueueFilter = {}) {
  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(filter)) {
    if (value) {
      search.set(key, value);
    }
  }

  const suffix = search.size > 0 ? `?${search.toString()}` : "";

  return apiRequest<GovernanceQueueItem[]>(
    `/api/v1/operational-evidence/governance/queue${suffix}`,
    {
      validate: isGovernanceQueueItems
    }
  );
}

export function claimGovernanceReview(request: ClaimGovernanceReviewRequest) {
  return apiRequest<GovernanceReviewClaim>(
    "/api/v1/operational-evidence/governance/review-claims",
    {
      method: "POST",
      body: request,
      validate: isGovernanceReviewClaim
    }
  );
}

export function releaseGovernanceReviewClaim(
  claimId: string,
  request: GovernanceReviewActionRequest = {}
) {
  return apiRequest<GovernanceReviewClaim>(
    `/api/v1/operational-evidence/governance/review-claims/${encodeURIComponent(
      claimId
    )}/release`,
    {
      method: "POST",
      body: request,
      validate: isGovernanceReviewClaim
    }
  );
}

export function transitionClaimedGovernanceReview(
  claimId: string,
  request: GovernanceReviewActionRequest = {}
) {
  return apiRequest<OperationalEvidenceRecord>(
    `/api/v1/operational-evidence/governance/review-claims/${encodeURIComponent(
      claimId
    )}/transitions`,
    {
      method: "POST",
      body: request,
      validate: isOperationalEvidenceRecord
    }
  );
}

function isGovernanceQueueItems(value: unknown): value is GovernanceQueueItem[] {
  return Array.isArray(value) && value.every(isGovernanceQueueItem);
}

function isGovernanceQueueItem(value: unknown): value is GovernanceQueueItem {
  return (
    isRecord(value) &&
    isOperationalEvidenceRecord(value.evidence_record) &&
    typeof value.governance_authority_code === "string" &&
    typeof value.lifecycle_state === "string" &&
    typeof value.transition_trigger === "string" &&
    typeof value.target_state === "string" &&
    (value.active_claim === null || isGovernanceReviewClaim(value.active_claim))
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
    isClaimStatus(value.claim_status) &&
    typeof value.claimed_by_user_id === "string" &&
    typeof value.claimed_at === "string" &&
    (typeof value.released_at === "string" || value.released_at === null) &&
    (typeof value.completed_at === "string" || value.completed_at === null) &&
    typeof value.created_at === "string" &&
    typeof value.updated_at === "string"
  );
}

function isClaimStatus(value: unknown): value is GovernanceReviewClaimStatus {
  return value === "ACTIVE" || value === "RELEASED" || value === "COMPLETED";
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
