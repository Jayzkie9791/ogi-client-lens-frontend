import { apiBlobRequest, apiRequest } from "../api/client";

export type Interval = { starts_at: string; ends_at: string };
export type TrainingEventInput = { facility_id: string; topic_title: string;
  topic_description: string | null; related_category_code: string | null;
  starts_at: string; ends_at: string; conducting_user_id: string | null };
export type TrainingEventDraft = TrainingEventInput & { id: string; client_id: string;
  facility_timezone: string; revision: number; status: "DRAFT"; root_event_id: string | null;
  corrects_revision_id: string | null; verified_credit_minutes: 0 };
export type PendingTrainingEvent = { event_id: string; revision_id: string; revision_number: number;
  submitted_at: string; revision_checksum: string; topic_title: string; topic_description: string | null;
  related_category_code: string | null; starts_at: string; ends_at: string;
  approval_status: "PENDING"; verified_credit_minutes: 0 };
export type Participant = { staff_member_id: string; facility_assignment_id: string; intervals: Interval[] };
export type EventInput = { facility_id: string; topic_title: string; topic_description: string | null;
  related_category_code: string | null; starts_at: string; ends_at: string;
  conducting_user_id: string | null; participants: Participant[] };
export type Draft = EventInput & { id: string; revision: number; status: string; facility_timezone: string;
  root_event_id: string | null; corrects_revision_id: string | null };
export type ParticipantChoice = { staff_member_id: string; full_name: string; facility_assignment_id: string;
  duty_code: string | null; assigned_from: string; assigned_to: string | null };
export type EligibleParticipants = { facility_id: string; facility_timezone: string;
  has_more: boolean; participants: ParticipantChoice[] };
export type MonthlyTarget = { staff_member_id: string; full_name: string; determination_id: string | null;
  stored_review_status: string; current_inputs_revalidated: false };
export type MonthlyProgress = { applicability: string; required_minutes: number | null;
  verified_minutes: number; progress_status: string; determination: string };
export type MonthlyEvaluation = { determination: { id: string; integrity_checksum: string;
  applicability: string; required_minutes: number | null; verified_microseconds: string;
  calculated_outcome: string; assignment_references: unknown; credit_references: unknown };
  feedback: { version: number; feedback: string | null; observations: string | null;
  recommended_follow_up: string | null }; status: string; review: unknown | null };
export type ApprovedTrainingEvent = { event_id:string;revision_id:string;revision_number:number;
  revision_checksum:string;topic_title:string;topic_description:string|null;related_category_code:string|null;
  starts_at:string;ends_at:string;decision:"APPROVED";decided_at:string;participant_entry_available:true };
export type ParticipantClaimDraft = { id:string;event_id:string;event_revision_id:string;staff_member_id:string;
  facility_assignment_id:string;revision:number;status:"DRAFT";intervals:Interval[] };
export type ClaimEvidenceFile = { id:string;ordinal:number;original_file_name:string;detected_mime_type:string;
  file_size_bytes:number;content_sha256:string;storage_provider:"LOCAL_PRIVATE";lifecycle_state:"AVAILABLE";
  safety_status:"UNSCANNED";revision:number;safety_warning:string;download_available:boolean };
export type ClaimRevision = { id:string;claim_id:string;integrity_checksum:string;snapshot_payload:{
  evidence_manifest:{format_version:1;integrity_checksum:string;files:Array<{evidence_file_id:string;
    ordinal:number;original_file_name:string;detected_mime_type:string;file_size_bytes:number;
    content_sha256:string;safety_status:"UNSCANNED"}>}} };
export type ClaimHistoryItem={claim_id:string;claim_revision_id:string;revision_number:number;
  predecessor_revision_id:string|null;submitted_at:string;personnel:{staff_member_id:string;current_display_name:string};
  topic:{event_id:string;event_revision_id:string;title:string;description:string|null;related_category_code:string|null;
    completion_period_starts_at:string;completion_period_ends_at:string};attendance_intervals:Array<Interval&{recorded_minutes:number}>;
  evidence:{file_count:number;manifest_checksum:string;safety_status:"UNSCANNED"};review:{status:"PENDING_REVIEW"|"APPROVED"|"REJECTED"|"SUPERSEDED";
    review_note:string|null;reviewed_at:string|null;verifier_role_name:string|null};effective_verified_minutes:number;
  correction_draft_id:string|null;correction_available:boolean;claim_revision_checksum:string;event_revision_checksum:string};
export type ClaimReview={claim_id:string;claim_revision_id:string;review_status:"PENDING"|"APPROVED"|"REJECTED";
  effective_status:string;review:{review_note:string|null;reviewed_at:string;verifier_role_name:string}|null;
  credits:unknown[];verified_credit_minutes:number;expected_claim_revision_checksum:string;
  expected_event_revision_checksum:string;expected_evidence_manifest_checksum:string;
  snapshot:{event_id:string;event_revision_id:string;staff_member_id:string;facility_assignment_id:string;
    intervals:Interval[]};evidence_manifest:{integrity_checksum:string;files:unknown[]}};

const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const text = (value: unknown): value is string => typeof value === "string";
const draft = (value: unknown): value is Draft => record(value) && text(value.id) &&
  typeof value.revision === "number" && Array.isArray(value.participants) && text(value.status);
const claimDraft=(value:unknown):value is ParticipantClaimDraft=>record(value)&&text(value.id)&&
  text(value.event_id)&&text(value.event_revision_id)&&text(value.staff_member_id)&&
  text(value.facility_assignment_id)&&typeof value.revision==="number"&&value.status==="DRAFT"&&Array.isArray(value.intervals);
const evidenceFile=(value:unknown):value is ClaimEvidenceFile=>record(value)&&text(value.id)&&
  typeof value.ordinal==="number"&&text(value.original_file_name)&&text(value.detected_mime_type)&&
  typeof value.file_size_bytes==="number"&&text(value.content_sha256)&&value.storage_provider==="LOCAL_PRIVATE"&&
  value.lifecycle_state==="AVAILABLE"&&value.safety_status==="UNSCANNED"&&typeof value.revision==="number";
const trainingEventDraft=(value:unknown):value is TrainingEventDraft=>record(value)&&text(value.id)&&
  text(value.client_id)&&text(value.facility_id)&&text(value.facility_timezone)&&text(value.topic_title)&&
  text(value.starts_at)&&text(value.ends_at)&&typeof value.revision==="number"&&value.status==="DRAFT";
const pendingTrainingEvent=(value:unknown):value is PendingTrainingEvent=>record(value)&&text(value.event_id)&&
  text(value.revision_id)&&typeof value.revision_number==="number"&&text(value.revision_checksum)&&
  text(value.topic_title)&&text(value.starts_at)&&text(value.ends_at)&&value.approval_status==="PENDING";
const query = (path: string, values: Record<string, string>) =>
  `${path}?${new URLSearchParams(values).toString()}`;

export const inserviceApi = {
  facilities:()=>apiRequest<{has_more:boolean;facilities:Array<{id:string;facility_name:string;timezone:string|null}>}>(
    "/api/v1/inservice/facilities",{validate:(v):v is {has_more:boolean;facilities:Array<{id:string;facility_name:string;timezone:string|null}>}=>
      record(v)&&typeof v.has_more==="boolean"&&Array.isArray(v.facilities)&&v.facilities.every(item=>
        record(item)&&text(item.id)&&text(item.facility_name)&&(item.timezone===null||text(item.timezone)))}),
  proposalDrafts:(facility_id:string)=>apiRequest<{drafts:TrainingEventDraft[]}>(
    query("/api/v1/inservice-training-events/drafts",{facility_id}),{validate:(v):v is {drafts:TrainingEventDraft[]}=>
      record(v)&&Array.isArray(v.drafts)&&v.drafts.every(trainingEventDraft)}),
  createProposal:(body:TrainingEventInput,key:string)=>apiRequest<TrainingEventDraft>(
    "/api/v1/inservice-training-events/drafts",{method:"POST",body,headers:{"Idempotency-Key":key},validate:trainingEventDraft}),
  updateProposal:(id:string,expected_revision:number,draft:TrainingEventInput)=>apiRequest<TrainingEventDraft>(
    `/api/v1/inservice-training-events/drafts/${encodeURIComponent(id)}`,{method:"PUT",
      body:{expected_revision,draft},validate:trainingEventDraft}),
  abandonProposal:(id:string,expected_revision:number)=>apiRequest<Record<string,unknown>>(
    `/api/v1/inservice-training-events/drafts/${encodeURIComponent(id)}/abandon`,{method:"POST",
      body:{expected_revision},validate:record}),
  submitProposal:(id:string,expected_revision:number,key:string)=>apiRequest<Record<string,unknown>>(
    `/api/v1/inservice-training-events/drafts/${encodeURIComponent(id)}/submit`,{method:"POST",
      body:{expected_revision},headers:{"Idempotency-Key":key},validate:record}),
  eventApprovalQueue:(facility_id:string)=>apiRequest<{facility_id:string;events:PendingTrainingEvent[]}>(
    query("/api/v1/inservice-training-events/approval-queue",{facility_id}),{validate:(v):v is {facility_id:string;events:PendingTrainingEvent[]}=>
      record(v)&&text(v.facility_id)&&Array.isArray(v.events)&&v.events.every(pendingTrainingEvent)}),
  decideEvent:(eventId:string,revisionId:string,decision:"APPROVED"|"REJECTED",decision_note:string|null,
    expected_revision_checksum:string,key:string)=>apiRequest<Record<string,unknown>>(
      `/api/v1/inservice-training-events/${encodeURIComponent(eventId)}/revisions/${encodeURIComponent(revisionId)}/decision`,{
        method:"POST",body:{decision,decision_note,expected_revision_checksum},headers:{"Idempotency-Key":key},validate:record}),
  approvedEvents:(facility_id:string)=>apiRequest<{events:ApprovedTrainingEvent[]}>(
    query("/api/v1/inservice-training-events/approved",{facility_id}),{validate:(v):v is {events:ApprovedTrainingEvent[]}=>
      record(v)&&Array.isArray(v.events)&&v.events.every(event=>record(event)&&text(event.event_id)&&
        text(event.revision_id)&&text(event.topic_title)&&event.decision==="APPROVED")}),
  claimDrafts:(facility_id:string)=>apiRequest<{drafts:ParticipantClaimDraft[]}>(
    query("/api/v1/inservice-training-events/participant-claims/drafts",{facility_id}),
    {validate:(v):v is {drafts:ParticipantClaimDraft[]}=>record(v)&&Array.isArray(v.drafts)&&v.drafts.every(claimDraft)}),
  createClaim:(body:{event_id:string;event_revision_id:string;staff_member_id:string;
    facility_assignment_id:string;intervals:Interval[]},key:string)=>apiRequest<ParticipantClaimDraft>(
    "/api/v1/inservice-training-events/participant-claims/drafts",{method:"POST",body,
      headers:{"Idempotency-Key":key},validate:claimDraft}),
  readClaim:(id:string)=>apiRequest<ParticipantClaimDraft>(
    `/api/v1/inservice-training-events/participant-claims/drafts/${encodeURIComponent(id)}`,{validate:claimDraft}),
  updateClaim:(id:string,expected_revision:number,claim:{event_id:string;event_revision_id:string;
    staff_member_id:string;facility_assignment_id:string;intervals:Interval[]})=>apiRequest<ParticipantClaimDraft>(
    `/api/v1/inservice-training-events/participant-claims/drafts/${encodeURIComponent(id)}`,{method:"PUT",
      body:{expected_revision,claim},validate:claimDraft}),
  submitClaim:(id:string,expected_revision:number,key:string)=>apiRequest<ClaimRevision>(
    `/api/v1/inservice-training-events/participant-claims/drafts/${encodeURIComponent(id)}/submit`,{
      method:"POST",body:{expected_revision},headers:{"Idempotency-Key":key},validate:(v):v is ClaimRevision=>
        record(v)&&text(v.id)&&text(v.claim_id)&&text(v.integrity_checksum)&&record(v.snapshot_payload)&&
        record(v.snapshot_payload.evidence_manifest)&&Array.isArray(v.snapshot_payload.evidence_manifest.files)}),
  claimEvidence:(claimId:string)=>apiRequest<{files:ClaimEvidenceFile[]}>(
    `/api/v1/inservice-training-events/participant-claims/drafts/${encodeURIComponent(claimId)}/evidence`,{
      validate:(v):v is {files:ClaimEvidenceFile[]}=>record(v)&&Array.isArray(v.files)&&v.files.every(evidenceFile)}),
  uploadClaimEvidence:(claimId:string,file:File,key:string)=>{const body=new FormData();body.append("file",file);
    return apiRequest<ClaimEvidenceFile>(
      `/api/v1/inservice-training-events/participant-claims/drafts/${encodeURIComponent(claimId)}/evidence`,{
        method:"POST",body,headers:{"Idempotency-Key":key},validate:evidenceFile});},
  downloadClaimEvidence:(claimId:string,fileId:string)=>apiBlobRequest(
    `/api/v1/inservice-training-events/participant-claims/drafts/${encodeURIComponent(claimId)}/evidence/${encodeURIComponent(fileId)}/download`,
    {cache:"no-store"}),
  removeClaimEvidence:(claimId:string,fileId:string,expected_revision:number)=>apiRequest<Record<string,unknown>>(
    `/api/v1/inservice-training-events/participant-claims/drafts/${encodeURIComponent(claimId)}/evidence/${encodeURIComponent(fileId)}`,{
      method:"DELETE",body:{expected_revision},validate:record}),
  claimHistory:(facility_id:string)=>apiRequest<{facility_id:string;has_more:boolean;claims:ClaimHistoryItem[]}>(
    query("/api/v1/inservice-training-events/participant-claims/history",{facility_id}),{
      validate:(v):v is {facility_id:string;has_more:boolean;claims:ClaimHistoryItem[]}=>record(v)&&text(v.facility_id)&&
        typeof v.has_more==="boolean"&&Array.isArray(v.claims)}),
  claimReviewQueue:(facility_id:string)=>apiRequest<{facility_id:string;has_more:boolean;claims:ClaimReview[]}>(
    query("/api/v1/inservice-training-events/participant-claims/review-queue",{facility_id}),{
      validate:(v):v is {facility_id:string;has_more:boolean;claims:ClaimReview[]}=>record(v)&&text(v.facility_id)&&
        typeof v.has_more==="boolean"&&Array.isArray(v.claims)}),
  claimReview:(claimId:string,revisionId:string)=>apiRequest<ClaimReview>(
    `/api/v1/inservice-training-events/participant-claims/${encodeURIComponent(claimId)}/revisions/${encodeURIComponent(revisionId)}/review`,{
      validate:(v):v is ClaimReview=>record(v)&&text(v.claim_id)&&text(v.claim_revision_id)&&text(v.expected_claim_revision_checksum)}),
  decideClaim:(claimId:string,revisionId:string,decision:"APPROVED"|"REJECTED",review_note:string|null,
    reviewed:ClaimReview,key:string)=>apiRequest<ClaimReview>(
      `/api/v1/inservice-training-events/participant-claims/${encodeURIComponent(claimId)}/revisions/${encodeURIComponent(revisionId)}/decision`,{
        method:"POST",headers:{"Idempotency-Key":key},body:{decision,review_note,
          expected_claim_revision_checksum:reviewed.expected_claim_revision_checksum,
          expected_event_revision_checksum:reviewed.expected_event_revision_checksum,
          expected_evidence_manifest_checksum:reviewed.expected_evidence_manifest_checksum},
        validate:(v):v is ClaimReview=>record(v)&&text(v.claim_id)&&text(v.claim_revision_id)}),
  submittedEvidence:(claimId:string,revisionId:string)=>apiRequest<{manifest_checksum:string;files:ClaimEvidenceFile[]}>(
    `/api/v1/inservice-training-events/participant-claims/${encodeURIComponent(claimId)}/revisions/${encodeURIComponent(revisionId)}/evidence`,{
      validate:(v):v is {manifest_checksum:string;files:ClaimEvidenceFile[]}=>record(v)&&text(v.manifest_checksum)&&
        Array.isArray(v.files)&&v.files.every(evidenceFile)}),
  downloadSubmittedEvidence:(claimId:string,revisionId:string,fileId:string)=>apiBlobRequest(
    `/api/v1/inservice-training-events/participant-claims/${encodeURIComponent(claimId)}/revisions/${encodeURIComponent(revisionId)}/evidence/${encodeURIComponent(fileId)}/download`,{cache:"no-store"}),
  correctionClaim:(claimId:string,revisionId:string,key:string)=>apiRequest<ParticipantClaimDraft>(
    `/api/v1/inservice-training-events/participant-claims/${encodeURIComponent(claimId)}/revisions/${encodeURIComponent(revisionId)}/corrections/drafts`,{
      method:"POST",headers:{"Idempotency-Key":key},validate:claimDraft}),
  eligible: (facility_id: string, starts_at: string, ends_at: string) =>
    apiRequest<EligibleParticipants>(query("/api/v1/inservice/participants/eligible",
      { facility_id, starts_at, ends_at }), { validate: (v): v is EligibleParticipants =>
        record(v) && text(v.facility_id) && text(v.facility_timezone) &&
        typeof v.has_more === "boolean" && Array.isArray(v.participants) &&
        v.participants.every((p) => record(p) && text(p.staff_member_id) &&
          text(p.facility_assignment_id) && text(p.full_name)) }),
  drafts: (facility_id: string) => apiRequest<{ drafts: Draft[] }>(
    query("/api/v1/inservice/events/drafts", { facility_id }),
    { validate: (v): v is { drafts: Draft[] } => record(v) && Array.isArray(v.drafts) && v.drafts.every(draft) }),
  draft: (id: string) => apiRequest<Draft>(`/api/v1/inservice/events/drafts/${encodeURIComponent(id)}`, { validate: draft }),
  create: (body: EventInput, key: string) => apiRequest<Draft>("/api/v1/inservice/events/drafts", {
    method: "POST", body, headers: { "Idempotency-Key": key }, validate: draft }),
  update: (id: string, expected_revision: number, body: EventInput) => apiRequest<Draft>(
    `/api/v1/inservice/events/drafts/${encodeURIComponent(id)}`, {
      method: "PUT", body: { expected_revision, draft: body }, validate: draft }),
  submit: (id: string, expected_revision: number, key: string) => apiRequest<{ id: string }>(
    `/api/v1/inservice/events/drafts/${encodeURIComponent(id)}/submit`, {
      method: "POST", body: { expected_revision }, headers: { "Idempotency-Key": key },
      validate: (v): v is { id: string } => record(v) && text(v.id) }),
  targets: (facility_id: string, local_month: string) => apiRequest<{ targets: MonthlyTarget[]; has_more: boolean }>(
    query("/api/v1/inservice/monthly-evaluations/targets", { facility_id, local_month }), {
      validate: (v): v is { targets: MonthlyTarget[]; has_more: boolean } =>
        record(v) && typeof v.has_more === "boolean" && Array.isArray(v.targets) &&
        v.targets.every((t) => record(t) && text(t.staff_member_id) && text(t.full_name)) }),
  progress: (staff_member_id: string, facility_id: string, local_month: string) => apiRequest<MonthlyProgress>(
    query("/api/v1/inservice/monthly-progress", { staff_member_id, facility_id, local_month }), {
      validate: (v): v is MonthlyProgress => record(v) && text(v.applicability) &&
        typeof v.verified_minutes === "number" && text(v.progress_status) }),
  openMonth: (staff_member_id: string, facility_id: string, local_month: string) => apiRequest<MonthlyEvaluation>(
    "/api/v1/inservice/monthly-evaluations/open", { method: "POST", body: {
      staff_member_id, facility_id, local_month }, validate: isMonthlyEvaluation }),
  saveFeedback: (id: string, scope: { staff_member_id: string; facility_id: string; local_month: string },
    version: number, feedback: string, observations: string, recommended_follow_up: string) =>
    apiRequest<MonthlyEvaluation>(query(`/api/v1/inservice/monthly-evaluations/${encodeURIComponent(id)}/feedback`, scope), {
      method: "PUT", body: { expected_feedback_version: version, feedback, observations,
        recommended_follow_up }, validate: isMonthlyEvaluation }),
  finalizeMonth: (id: string, scope: { staff_member_id: string; facility_id: string; local_month: string },
    checksum: string, version: number, key: string) =>
    apiRequest<MonthlyEvaluation>(query(`/api/v1/inservice/monthly-evaluations/${encodeURIComponent(id)}/finalize`, scope), {
      method: "POST", headers: { "Idempotency-Key": key }, body: {
        expected_determination_checksum: checksum, expected_feedback_version: version,
        attestation_accepted: true }, validate: isMonthlyEvaluation })
};

function isMonthlyEvaluation(value: unknown): value is MonthlyEvaluation {
  return record(value) && record(value.determination) && text(value.determination.id) &&
    text(value.determination.integrity_checksum) && record(value.feedback) &&
    typeof value.feedback.version === "number" && text(value.status);
}
