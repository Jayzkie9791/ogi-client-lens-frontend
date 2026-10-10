import { apiRequest } from "../api/client";

export type OrdinaryPerformerSource = "ORDINARY_L4_OPERATIONAL_PERFORMER" | "EFFECTIVE_QA_ASSIGNMENT";
export interface OrdinaryPerformerCandidate {
  personnel_id: string; user_id: string; affiliation: "CLIENT" | "OGI"; display_name: string;
  business_identifier: string; qualification_certification_id: string; qualification_level: string;
  qualification_expires_at: string; scope_authority_kind: string; scope_authority_id: string;
  performer_source: OrdinaryPerformerSource; ordinary_qa_assignment_id: string | null;
}
export interface OrdinaryPerformerBinding {
  id: string; evidence_record_id: string; audit_occurrence_id: string; performer_source: OrdinaryPerformerSource;
  performer_personnel_id: string; performer_user_id: string; performer_name: string; business_identifier: string;
  qualification_level: string; qa_profile: string; ordinary_qa_assignment_id: string | null;
  facility_timezone: string; occurrence_local_date: string; source_occurrence_local_date: string | null;
  selected_by_user_id: string; selected_at: string; authority_checksum: string;
}
export interface OrdinaryPerformerCandidateResponse {
  evidence_record_id: string; qa_profile: string; facility_timezone: string; occurrence_local_date: string;
  source_occurrence_local_date: string | null; candidates: OrdinaryPerformerCandidate[];
}
export interface OrdinaryPerformerBindingResponse { state: "NO_PERFORMER_SELECTED" | "PERFORMER_SELECTED"; binding: OrdinaryPerformerBinding | null }

export const ordinaryPerformerBindingQueryKey = (recordId: string) => ["ordinary-performer-binding", recordId] as const;
export function getOrdinaryPerformerBinding(recordId: string) {
  return apiRequest<OrdinaryPerformerBindingResponse>(`/api/v1/operational-evidence/records/${recordId}/performer-binding`, { validate: isBindingResponse });
}
export function listOrdinaryPerformerCandidates(recordId: string, occurrenceDate: string) {
  return apiRequest<OrdinaryPerformerCandidateResponse>(`/api/v1/operational-evidence/records/${recordId}/performer-candidates?occurrence_local_date=${encodeURIComponent(occurrenceDate)}`, { validate: isCandidateResponse });
}
export function createOrdinaryPerformerBinding(recordId: string, candidate: OrdinaryPerformerCandidate, occurrenceDate: string) {
  return apiRequest<{ binding: OrdinaryPerformerBinding; replayed: boolean }>(`/api/v1/operational-evidence/records/${recordId}/performer-binding`, {
    method: "POST", headers: { "Idempotency-Key": crypto.randomUUID() }, body: {
      performer_personnel_id: candidate.personnel_id,
      qualification_certification_id: candidate.qualification_certification_id,
      performer_source: candidate.performer_source,
      ordinary_qa_assignment_id: candidate.ordinary_qa_assignment_id,
      occurrence_local_date: occurrenceDate
    }, validate: isCreateResponse
  });
}

function isObject(value: unknown): value is Record<string, unknown> { return Boolean(value) && typeof value === "object" && !Array.isArray(value); }
function isBinding(value: unknown): value is OrdinaryPerformerBinding { return isObject(value) && typeof value.id === "string" && typeof value.performer_user_id === "string" && typeof value.performer_name === "string" && typeof value.occurrence_local_date === "string" && (value.performer_source === "ORDINARY_L4_OPERATIONAL_PERFORMER" || value.performer_source === "EFFECTIVE_QA_ASSIGNMENT"); }
function isBindingResponse(value: unknown): value is OrdinaryPerformerBindingResponse { return isObject(value) && (value.state === "NO_PERFORMER_SELECTED" || value.state === "PERFORMER_SELECTED") && (value.binding === null || isBinding(value.binding)); }
function isCandidate(value: unknown): value is OrdinaryPerformerCandidate { return isObject(value) && typeof value.personnel_id === "string" && typeof value.user_id === "string" && typeof value.display_name === "string" && typeof value.qualification_certification_id === "string" && (value.performer_source === "ORDINARY_L4_OPERATIONAL_PERFORMER" || value.performer_source === "EFFECTIVE_QA_ASSIGNMENT"); }
function isCandidateResponse(value: unknown): value is OrdinaryPerformerCandidateResponse { return isObject(value) && typeof value.evidence_record_id === "string" && typeof value.facility_timezone === "string" && Array.isArray(value.candidates) && value.candidates.every(isCandidate); }
function isCreateResponse(value: unknown): value is { binding: OrdinaryPerformerBinding; replayed: boolean } { return isObject(value) && isBinding(value.binding) && typeof value.replayed === "boolean"; }
