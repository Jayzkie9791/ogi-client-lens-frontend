import { apiRequest } from "../api/client";

export const trainingProgramOptions = [
  {
    program_code: "GUARDIAN_RESPONDER",
    certification_level: "L1",
    display_name: "Guardian Responder"
  },
  {
    program_code: "POOL_GUARDIAN",
    certification_level: "L2",
    display_name: "Pool Guardian"
  },
  {
    program_code: "OPEN_WATER_GUARDIAN",
    certification_level: "L3",
    display_name: "Open Water Guardian"
  },
  {
    program_code: "RESCUE_TECHNICIAN",
    certification_level: "L4",
    display_name: "Rescue Technician"
  },
  {
    program_code: "ASSISTANT_GUARDIAN_INSTRUCTOR",
    certification_level: "L5",
    display_name: "Assistant Guardian Instructor"
  },
  {
    program_code: "GUARDIAN_INSTRUCTOR",
    certification_level: "L6",
    display_name: "Guardian Instructor"
  },
  {
    program_code: "MASTER_GUARDIAN_INSTRUCTOR",
    certification_level: "L7",
    display_name: "Master Guardian Instructor"
  }
] as const;

export type TrainingProgramCode =
  (typeof trainingProgramOptions)[number]["program_code"];

export interface TrainingTraineeStaffMemberSummary {
  readonly id: string;
  readonly client_id: string;
  readonly full_name: string;
  readonly email: string | null;
}

export interface TrainingTraineeStaffMemberLink {
  readonly id: string;
  readonly trainee_id: string;
  readonly staff_member_id: string;
  readonly created_at: string;
  readonly ended_at: string | null;
  readonly staff_member: TrainingTraineeStaffMemberSummary;
}

export interface TrainingTrainee {
  readonly id: string;
  readonly student_number: string | null;
  readonly full_name: string;
  readonly email: string | null;
  readonly phone_number: string | null;
  readonly notes: string | null;
  readonly created_at: string;
  readonly updated_at: string;
  readonly deleted_at: string | null;
  readonly staff_member_links: readonly TrainingTraineeStaffMemberLink[];
}

export interface TrainingTraineeListResponse {
  readonly trainees: readonly TrainingTrainee[];
}

export interface CreateTrainingTraineeRequest {
  readonly full_name: string;
  readonly email?: string | null;
  readonly phone_number?: string | null;
  readonly notes?: string | null;
}

export interface CreateTrainingTraineeStaffMemberLinkRequest {
  readonly staff_member_id: string;
}

export interface TrainingEnrollmentProgramSummary {
  readonly program_code: TrainingProgramCode;
  readonly certification_level: string;
  readonly display_name: string;
  readonly qualification_label: string;
  readonly required_training_hours: number;
  readonly minimum_age: number;
}

export interface TrainingEnrollmentClientSummary {
  readonly id: string;
  readonly organization_name: string;
  readonly status: string;
}

export interface TrainingEnrollmentSessionSummary {
  readonly id: string;
  readonly training_title: string;
  readonly training_start_date: string;
  readonly training_end_date: string | null;
  readonly facility_id: string | null;
}

export interface TrainingSessionFacilitySummary {
  readonly id: string;
  readonly client_id: string;
  readonly facility_name: string;
  readonly operational_status: string;
}

export interface TrainingSessionInstructorStaffMemberSummary {
  readonly id: string;
  readonly client_id: string;
  readonly full_name: string;
  readonly email: string | null;
}

export interface TrainingSessionInstructorQualificationSummary {
  readonly id: string;
  readonly business_identifier: string;
  readonly certification_level: "L6" | "L7";
  readonly certification_status: string;
  readonly issue_date: string;
  readonly expiry_date: string;
}

export interface TrainingSession {
  readonly id: string;
  readonly business_identifier: string;
  readonly training_title: string;
  readonly operational_skill: string;
  readonly training_start_date: string;
  readonly training_end_date: string | null;
  readonly duration_minutes: number | null;
  readonly facility_id: string | null;
  readonly instructor_name: string | null;
  readonly instructor_license_number: string | null;
  readonly instructor_staff_member_id: string | null;
  readonly instructor_qualification_certification_id: string | null;
  readonly conducted_by_user_id: string | null;
  readonly training_notes: string | null;
  readonly created_at: string;
  readonly updated_at: string;
  readonly facility: TrainingSessionFacilitySummary | null;
  readonly instructor_staff_member:
    | TrainingSessionInstructorStaffMemberSummary
    | null;
  readonly instructor_qualification_certification:
    | TrainingSessionInstructorQualificationSummary
    | null;
}

export interface TrainingSessionListResponse {
  readonly sessions: readonly TrainingSession[];
}

export const trainingOperationalSkills = [
  "RESCUE_SKILLS",
  "CPR_AED",
  "FIRST_AID",
  "SPINAL_MANAGEMENT",
  "SCANNING_SURVEILLANCE",
  "EAP",
  "OPEN_WATER_NAVIGATION",
  "SURF_OPERATIONS",
  "WATER_ENTRY_APPROACH",
  "VICTIM_EXTRACTION",
  "COMMUNICATION_COMMAND",
  "RIP_CURRENT_MANAGEMENT",
  "BOARD_RESCUE",
  "TECHNICAL_RESCUE"
] as const;

export type TrainingOperationalSkill =
  (typeof trainingOperationalSkills)[number];

export interface CreateTrainingSessionRequest {
  readonly training_title: string;
  readonly operational_skill: TrainingOperationalSkill;
  readonly training_start_date: string;
  readonly training_end_date?: string | null;
  readonly duration_minutes?: number | null;
  readonly facility_id?: string | null;
  readonly instructor_staff_member_id?: string | null;
  readonly instructor_qualification_certification_id?: string | null;
  readonly training_notes?: string | null;
}

export interface TrainingEnrollment {
  readonly id: string;
  readonly trainee_id: string;
  readonly program_code: TrainingProgramCode;
  readonly program: TrainingEnrollmentProgramSummary;
  readonly client_id: string | null;
  readonly training_session_id: string | null;
  readonly enrolled_at: string;
  readonly notes: string | null;
  readonly created_at: string;
  readonly updated_at: string;
  readonly deleted_at: string | null;
  readonly trainee: {
    readonly id: string;
    readonly student_number: string | null;
    readonly full_name: string;
    readonly email: string | null;
  };
  readonly client: TrainingEnrollmentClientSummary | null;
  readonly training_session: TrainingEnrollmentSessionSummary | null;
}

export type TrainingEvidenceDraftTemplateCode =
  | "OGI_F023_OPERATIONAL_SKILLS_ASSESSMENT"
  | "OGI_F024_OPERATIONAL_KNOWLEDGE_ASSESSMENT_RECORD"
  | "OGI_F025_OPERATIONAL_READINESS_EVALUATION";

export type TrainingEvidenceWorkspaceSlotKey =
  | "SKILLS"
  | "KNOWLEDGE"
  | "READINESS";

export interface TrainingContextualEvidenceMetadata {
  readonly evidence_record_id: string;
  readonly template_code: TrainingEvidenceDraftTemplateCode;
  readonly template_name: string | null;
  readonly document_number: string | null;
  readonly lifecycle_state: string;
  readonly client_id: string | null;
  readonly facility_id: string | null;
  readonly training_enrollment_id: string;
  readonly training_session_id: string | null;
  readonly submitted_at: string | null;
  readonly created_at: string;
  readonly updated_at: string;
}

export interface TrainingEvidenceLinkSummary {
  readonly id: string;
  readonly training_enrollment_id: string;
  readonly operational_evidence_record_id: string;
  readonly evidence_purpose:
    | "SKILLS_ASSESSMENT"
    | "KNOWLEDGE_ASSESSMENT"
    | "READINESS";
  readonly created_by_user_id: string | null;
  readonly linked_at: string;
  readonly evidence: {
    readonly evidence_record_id: string;
    readonly template_code: string;
    readonly template_name: string | null;
    readonly document_number: string | null;
    readonly lifecycle_state: string;
    readonly client_id: string | null;
    readonly facility_id: string | null;
    readonly submitted_at: string | null;
    readonly created_at: string;
  };
}

export interface TrainingAssessmentResultSummary {
  readonly id: string;
  readonly assessment_type: "SKILLS" | "KNOWLEDGE";
  readonly result_status: string;
  readonly score: number;
  readonly remediation_required: boolean;
  readonly reassessment_required: boolean;
  readonly recorded_at: string;
  readonly recorded_by_user_id: string | null;
  readonly evidence_link_id: string;
}

export interface TrainingReadinessDecisionSummary {
  readonly id: string;
  readonly readiness_outcome: string;
  readonly remediation_required: boolean;
  readonly certification_review_required: boolean;
  readonly decided_at: string;
  readonly decided_by_user_id: string | null;
  readonly readiness_evidence_link_id: string;
}

export interface TrainingEvidenceWorkspaceRecord {
  readonly evidence: TrainingContextualEvidenceMetadata;
  readonly evidence_link: TrainingEvidenceLinkSummary | null;
  readonly assessment_result: TrainingAssessmentResultSummary | null;
  readonly readiness_decision: TrainingReadinessDecisionSummary | null;
}

export interface TrainingEvidenceWorkspaceSlot {
  readonly slot: TrainingEvidenceWorkspaceSlotKey;
  readonly evidence_purpose:
    | "SKILLS_ASSESSMENT"
    | "KNOWLEDGE_ASSESSMENT"
    | "READINESS";
  readonly template_code: TrainingEvidenceDraftTemplateCode;
  readonly document_number: "OGI F-023" | "OGI F-024" | "OGI F-025";
  readonly active_draft: TrainingEvidenceWorkspaceRecord | null;
  readonly history: readonly TrainingEvidenceWorkspaceRecord[];
  readonly can_create_draft: boolean;
}

export interface TrainingEvidenceWorkspace {
  readonly enrollment: TrainingEnrollment;
  readonly slots: readonly TrainingEvidenceWorkspaceSlot[];
}

export interface CreateTrainingEvidenceDraftRequest {
  readonly template_code: TrainingEvidenceDraftTemplateCode;
}

export interface TrainingEvidenceDraft {
  readonly evidence_record_id: string;
  readonly template_code: TrainingEvidenceDraftTemplateCode;
  readonly template_version_id: string;
  readonly template_version: string;
  readonly schema_version: string;
  readonly client_id: string | null;
  readonly facility_id: string | null;
  readonly lifecycle_state: string;
  readonly payload_checksum: string;
  readonly scope_kind: "TRAINING_SCOPED";
  readonly created_at: string;
  readonly submitted_at: string | null;
  readonly updated_at: string;
}

export interface TrainingAttendanceEvidenceMetadata {
  readonly evidence_record_id: string;
  readonly template_code: "OGI_F022_COURSE_ATTENDANCE_VERIFICATION_RECORD";
  readonly template_name: string | null;
  readonly document_number: string | null;
  readonly lifecycle_state: string;
  readonly client_id: string | null;
  readonly facility_id: string | null;
  readonly submitted_at: string | null;
  readonly created_at: string;
}

export interface TrainingAttendanceEvidenceLinkSummary {
  readonly id: string;
  readonly training_enrollment_id: string;
  readonly operational_evidence_record_id: string;
  readonly evidence_purpose: "ATTENDANCE";
  readonly created_by_user_id: string | null;
  readonly linked_at: string;
  readonly evidence: TrainingAttendanceEvidenceMetadata;
}

export interface TrainingAttendanceEligibleEnrollment {
  readonly enrollment: TrainingEnrollment;
  readonly attendance_linked_record_ids: readonly string[];
}

export interface TrainingAttendanceEvidenceRecord {
  readonly evidence: TrainingAttendanceEvidenceMetadata;
  readonly roster: readonly TrainingEnrollment[];
  readonly linked_enrollment_ids: readonly string[];
  readonly roster_count: number;
  readonly linked_count: number;
  readonly can_link: boolean;
}

export interface TrainingAttendanceEvidenceWorkspace {
  readonly session: TrainingSession;
  readonly eligible_enrollments: readonly TrainingAttendanceEligibleEnrollment[];
  readonly active_draft: TrainingAttendanceEvidenceRecord | null;
  readonly history: readonly TrainingAttendanceEvidenceRecord[];
  readonly can_create_draft: boolean;
}

export interface CreateTrainingAttendanceEvidenceDraftRequest {
  readonly enrollment_ids: readonly string[];
}

export interface TrainingAttendanceEvidenceDraft {
  readonly evidence_record_id: string;
  readonly template_code: "OGI_F022_COURSE_ATTENDANCE_VERIFICATION_RECORD";
  readonly template_version_id: string;
  readonly template_version: string;
  readonly schema_version: string;
  readonly client_id: string | null;
  readonly facility_id: string | null;
  readonly lifecycle_state: string;
  readonly payload_checksum: string;
  readonly scope_kind: "TRAINING_SCOPED";
  readonly created_at: string;
  readonly submitted_at: string | null;
  readonly updated_at: string;
}

export interface TrainingAttendanceEvidenceLinkResponse {
  readonly evidence_links: readonly TrainingAttendanceEvidenceLinkSummary[];
}

export interface TrainingEnrollmentListResponse {
  readonly enrollments: readonly TrainingEnrollment[];
}

export interface CreateTrainingEnrollmentRequest {
  readonly program_code: TrainingProgramCode;
  readonly client_id?: string | null;
  readonly training_session_id?: string | null;
  readonly notes?: string | null;
}

export interface AssignTrainingEnrollmentSessionRequest {
  readonly training_session_id: string;
}

export function listTrainingTrainees() {
  return apiRequest<TrainingTraineeListResponse>("/api/v1/training/trainees", {
    validate: isTrainingTraineeListResponse
  });
}

export function getTrainingTrainee(traineeId: string) {
  return apiRequest<TrainingTrainee>(
    `/api/v1/training/trainees/${encodeURIComponent(traineeId)}`,
    {
      validate: isTrainingTrainee
    }
  );
}

export function createTrainingTrainee(request: CreateTrainingTraineeRequest) {
  return apiRequest<TrainingTrainee>("/api/v1/training/trainees", {
    method: "POST",
    body: request,
    validate: isTrainingTrainee
  });
}

export function linkTrainingTraineeStaffMember(
  traineeId: string,
  request: CreateTrainingTraineeStaffMemberLinkRequest
) {
  return apiRequest<TrainingTraineeStaffMemberLink>(
    `/api/v1/training/trainees/${encodeURIComponent(traineeId)}/staff-member-links`,
    {
      method: "POST",
      body: request,
      validate: isTrainingTraineeStaffMemberLink
    }
  );
}

export function listTrainingEnrollments(traineeId: string) {
  return apiRequest<TrainingEnrollmentListResponse>(
    `/api/v1/training/trainees/${encodeURIComponent(traineeId)}/enrollments`,
    {
      validate: isTrainingEnrollmentListResponse
    }
  );
}

export function createTrainingEnrollment(
  traineeId: string,
  request: CreateTrainingEnrollmentRequest
) {
  return apiRequest<TrainingEnrollment>(
    `/api/v1/training/trainees/${encodeURIComponent(traineeId)}/enrollments`,
    {
      method: "POST",
      body: request,
      validate: isTrainingEnrollment
    }
  );
}

export function listTrainingSessions() {
  return apiRequest<TrainingSessionListResponse>("/api/v1/training/sessions", {
    validate: isTrainingSessionListResponse
  });
}

export function createTrainingSession(
  request: CreateTrainingSessionRequest,
  idempotencyKey: string
) {
  return apiRequest<TrainingSession>("/api/v1/training/sessions", {
    method: "POST",
    body: request,
    headers: { "idempotency-key": idempotencyKey },
    validate: isTrainingSession
  });
}

export function assignTrainingEnrollmentSession(
  enrollmentId: string,
  request: AssignTrainingEnrollmentSessionRequest
) {
  return apiRequest<TrainingEnrollment>(
    `/api/v1/training/enrollments/${encodeURIComponent(enrollmentId)}/session-assignment`,
    {
      method: "POST",
      body: request,
      validate: isTrainingEnrollment
    }
  );
}

export function getTrainingEvidenceWorkspace(enrollmentId: string) {
  return apiRequest<TrainingEvidenceWorkspace>(
    `/api/v1/training/enrollments/${encodeURIComponent(enrollmentId)}/evidence-workspace`,
    {
      validate: isTrainingEvidenceWorkspace
    }
  );
}

export function createTrainingEvidenceDraft(
  enrollmentId: string,
  request: CreateTrainingEvidenceDraftRequest
) {
  return apiRequest<TrainingEvidenceDraft>(
    `/api/v1/training/enrollments/${encodeURIComponent(enrollmentId)}/evidence-drafts`,
    {
      method: "POST",
      body: request,
      validate: isTrainingEvidenceDraft
    }
  );
}

export function getTrainingAttendanceEvidenceWorkspace(
  trainingSessionId: string
) {
  return apiRequest<TrainingAttendanceEvidenceWorkspace>(
    `/api/v1/training/sessions/${encodeURIComponent(trainingSessionId)}/attendance-evidence-workspace`,
    {
      validate: isTrainingAttendanceEvidenceWorkspace
    }
  );
}

export function createTrainingAttendanceEvidenceDraft(
  trainingSessionId: string,
  request: CreateTrainingAttendanceEvidenceDraftRequest
) {
  return apiRequest<TrainingAttendanceEvidenceDraft>(
    `/api/v1/training/sessions/${encodeURIComponent(trainingSessionId)}/attendance-evidence-drafts`,
    {
      method: "POST",
      body: request,
      validate: isTrainingAttendanceEvidenceDraft
    }
  );
}

export function linkTrainingAttendanceEvidence(
  trainingSessionId: string,
  evidenceRecordId: string
) {
  return apiRequest<TrainingAttendanceEvidenceLinkResponse>(
    `/api/v1/training/sessions/${encodeURIComponent(trainingSessionId)}/attendance-evidence/${encodeURIComponent(evidenceRecordId)}/link`,
    {
      method: "POST",
      validate: isTrainingAttendanceEvidenceLinkResponse
    }
  );
}

function isTrainingTraineeListResponse(
  value: unknown
): value is TrainingTraineeListResponse {
  return (
    isRecord(value) &&
    Array.isArray(value.trainees) &&
    value.trainees.every(isTrainingTrainee)
  );
}

function isTrainingTrainee(value: unknown): value is TrainingTrainee {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    isNullableString(value.student_number) &&
    typeof value.full_name === "string" &&
    isNullableString(value.email) &&
    isNullableString(value.phone_number) &&
    isNullableString(value.notes) &&
    typeof value.created_at === "string" &&
    typeof value.updated_at === "string" &&
    isNullableString(value.deleted_at) &&
    Array.isArray(value.staff_member_links) &&
    value.staff_member_links.every(isTrainingTraineeStaffMemberLink)
  );
}

function isTrainingTraineeStaffMemberLink(
  value: unknown
): value is TrainingTraineeStaffMemberLink {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.trainee_id === "string" &&
    typeof value.staff_member_id === "string" &&
    typeof value.created_at === "string" &&
    isNullableString(value.ended_at) &&
    isTrainingTraineeStaffMemberSummary(value.staff_member)
  );
}

function isTrainingTraineeStaffMemberSummary(
  value: unknown
): value is TrainingTraineeStaffMemberSummary {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.client_id === "string" &&
    typeof value.full_name === "string" &&
    isNullableString(value.email)
  );
}

function isTrainingEnrollmentListResponse(
  value: unknown
): value is TrainingEnrollmentListResponse {
  return (
    isRecord(value) &&
    Array.isArray(value.enrollments) &&
    value.enrollments.every(isTrainingEnrollment)
  );
}

function isTrainingEnrollment(value: unknown): value is TrainingEnrollment {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.trainee_id === "string" &&
    isTrainingProgramCode(value.program_code) &&
    isTrainingEnrollmentProgramSummary(value.program) &&
    isNullableString(value.client_id) &&
    isNullableString(value.training_session_id) &&
    typeof value.enrolled_at === "string" &&
    isNullableString(value.notes) &&
    typeof value.created_at === "string" &&
    typeof value.updated_at === "string" &&
    isNullableString(value.deleted_at) &&
    isRecord(value.trainee) &&
    typeof value.trainee.id === "string" &&
    isNullableString(value.trainee.student_number) &&
    typeof value.trainee.full_name === "string" &&
    isNullableString(value.trainee.email) &&
    (value.client === null || isTrainingEnrollmentClientSummary(value.client)) &&
    (value.training_session === null ||
      isTrainingEnrollmentSessionSummary(value.training_session))
  );
}

function isTrainingEvidenceWorkspace(
  value: unknown
): value is TrainingEvidenceWorkspace {
  return (
    isRecord(value) &&
    isTrainingEnrollment(value.enrollment) &&
    Array.isArray(value.slots) &&
    value.slots.every(isTrainingEvidenceWorkspaceSlot)
  );
}

function isTrainingEvidenceWorkspaceSlot(
  value: unknown
): value is TrainingEvidenceWorkspaceSlot {
  return (
    isRecord(value) &&
    isTrainingEvidenceWorkspaceSlotKey(value.slot) &&
    isTrainingEvidencePurpose(value.evidence_purpose) &&
    isTrainingEvidenceDraftTemplateCode(value.template_code) &&
    typeof value.document_number === "string" &&
    (value.active_draft === null ||
      isTrainingEvidenceWorkspaceRecord(value.active_draft)) &&
    Array.isArray(value.history) &&
    value.history.every(isTrainingEvidenceWorkspaceRecord) &&
    typeof value.can_create_draft === "boolean"
  );
}

function isTrainingEvidenceWorkspaceRecord(
  value: unknown
): value is TrainingEvidenceWorkspaceRecord {
  return (
    isRecord(value) &&
    isTrainingContextualEvidenceMetadata(value.evidence) &&
    (value.evidence_link === null ||
      isTrainingEvidenceLinkSummary(value.evidence_link)) &&
    (value.assessment_result === null ||
      isTrainingAssessmentResultSummary(value.assessment_result)) &&
    (value.readiness_decision === null ||
      isTrainingReadinessDecisionSummary(value.readiness_decision))
  );
}

function isTrainingContextualEvidenceMetadata(
  value: unknown
): value is TrainingContextualEvidenceMetadata {
  return (
    isRecord(value) &&
    typeof value.evidence_record_id === "string" &&
    isTrainingEvidenceDraftTemplateCode(value.template_code) &&
    isNullableString(value.template_name) &&
    isNullableString(value.document_number) &&
    typeof value.lifecycle_state === "string" &&
    isNullableString(value.client_id) &&
    isNullableString(value.facility_id) &&
    typeof value.training_enrollment_id === "string" &&
    isNullableString(value.training_session_id) &&
    isNullableString(value.submitted_at) &&
    typeof value.created_at === "string" &&
    typeof value.updated_at === "string"
  );
}

function isTrainingEvidenceLinkSummary(
  value: unknown
): value is TrainingEvidenceLinkSummary {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.training_enrollment_id === "string" &&
    typeof value.operational_evidence_record_id === "string" &&
    isTrainingEvidencePurpose(value.evidence_purpose) &&
    isNullableString(value.created_by_user_id) &&
    typeof value.linked_at === "string" &&
    isRecord(value.evidence)
  );
}

function isTrainingAssessmentResultSummary(
  value: unknown
): value is TrainingAssessmentResultSummary {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    (value.assessment_type === "SKILLS" ||
      value.assessment_type === "KNOWLEDGE") &&
    typeof value.result_status === "string" &&
    typeof value.score === "number" &&
    typeof value.remediation_required === "boolean" &&
    typeof value.reassessment_required === "boolean" &&
    typeof value.recorded_at === "string" &&
    isNullableString(value.recorded_by_user_id) &&
    typeof value.evidence_link_id === "string"
  );
}

function isTrainingReadinessDecisionSummary(
  value: unknown
): value is TrainingReadinessDecisionSummary {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.readiness_outcome === "string" &&
    typeof value.remediation_required === "boolean" &&
    typeof value.certification_review_required === "boolean" &&
    typeof value.decided_at === "string" &&
    isNullableString(value.decided_by_user_id) &&
    typeof value.readiness_evidence_link_id === "string"
  );
}

function isTrainingEvidenceDraft(value: unknown): value is TrainingEvidenceDraft {
  return (
    isRecord(value) &&
    typeof value.evidence_record_id === "string" &&
    isTrainingEvidenceDraftTemplateCode(value.template_code) &&
    typeof value.template_version_id === "string" &&
    typeof value.template_version === "string" &&
    typeof value.schema_version === "string" &&
    isNullableString(value.client_id) &&
    isNullableString(value.facility_id) &&
    typeof value.lifecycle_state === "string" &&
    typeof value.payload_checksum === "string" &&
    value.scope_kind === "TRAINING_SCOPED" &&
    typeof value.created_at === "string" &&
    isNullableString(value.submitted_at) &&
    typeof value.updated_at === "string"
  );
}

function isTrainingAttendanceEvidenceWorkspace(
  value: unknown
): value is TrainingAttendanceEvidenceWorkspace {
  return (
    isRecord(value) &&
    isTrainingSession(value.session) &&
    Array.isArray(value.eligible_enrollments) &&
    value.eligible_enrollments.every(isTrainingAttendanceEligibleEnrollment) &&
    (value.active_draft === null ||
      isTrainingAttendanceEvidenceRecord(value.active_draft)) &&
    Array.isArray(value.history) &&
    value.history.every(isTrainingAttendanceEvidenceRecord) &&
    typeof value.can_create_draft === "boolean"
  );
}

function isTrainingAttendanceEligibleEnrollment(
  value: unknown
): value is TrainingAttendanceEligibleEnrollment {
  return (
    isRecord(value) &&
    isTrainingEnrollment(value.enrollment) &&
    Array.isArray(value.attendance_linked_record_ids) &&
    value.attendance_linked_record_ids.every(
      (recordId) => typeof recordId === "string"
    )
  );
}

function isTrainingAttendanceEvidenceRecord(
  value: unknown
): value is TrainingAttendanceEvidenceRecord {
  return (
    isRecord(value) &&
    isTrainingAttendanceEvidenceMetadata(value.evidence) &&
    Array.isArray(value.roster) &&
    value.roster.every(isTrainingEnrollment) &&
    Array.isArray(value.linked_enrollment_ids) &&
    value.linked_enrollment_ids.every(
      (enrollmentId) => typeof enrollmentId === "string"
    ) &&
    typeof value.roster_count === "number" &&
    typeof value.linked_count === "number" &&
    typeof value.can_link === "boolean"
  );
}

function isTrainingAttendanceEvidenceMetadata(
  value: unknown
): value is TrainingAttendanceEvidenceMetadata {
  return (
    isRecord(value) &&
    typeof value.evidence_record_id === "string" &&
    value.template_code === "OGI_F022_COURSE_ATTENDANCE_VERIFICATION_RECORD" &&
    isNullableString(value.template_name) &&
    isNullableString(value.document_number) &&
    typeof value.lifecycle_state === "string" &&
    isNullableString(value.client_id) &&
    isNullableString(value.facility_id) &&
    isNullableString(value.submitted_at) &&
    typeof value.created_at === "string"
  );
}

function isTrainingAttendanceEvidenceDraft(
  value: unknown
): value is TrainingAttendanceEvidenceDraft {
  return (
    isRecord(value) &&
    typeof value.evidence_record_id === "string" &&
    value.template_code === "OGI_F022_COURSE_ATTENDANCE_VERIFICATION_RECORD" &&
    typeof value.template_version_id === "string" &&
    typeof value.template_version === "string" &&
    typeof value.schema_version === "string" &&
    isNullableString(value.client_id) &&
    isNullableString(value.facility_id) &&
    typeof value.lifecycle_state === "string" &&
    typeof value.payload_checksum === "string" &&
    value.scope_kind === "TRAINING_SCOPED" &&
    typeof value.created_at === "string" &&
    isNullableString(value.submitted_at) &&
    typeof value.updated_at === "string"
  );
}

function isTrainingAttendanceEvidenceLinkResponse(
  value: unknown
): value is TrainingAttendanceEvidenceLinkResponse {
  return (
    isRecord(value) &&
    Array.isArray(value.evidence_links) &&
    value.evidence_links.every(isTrainingAttendanceEvidenceLinkSummary)
  );
}

function isTrainingAttendanceEvidenceLinkSummary(
  value: unknown
): value is TrainingAttendanceEvidenceLinkSummary {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.training_enrollment_id === "string" &&
    typeof value.operational_evidence_record_id === "string" &&
    value.evidence_purpose === "ATTENDANCE" &&
    isNullableString(value.created_by_user_id) &&
    typeof value.linked_at === "string" &&
    isTrainingAttendanceEvidenceMetadata(value.evidence)
  );
}

function isTrainingEnrollmentProgramSummary(
  value: unknown
): value is TrainingEnrollmentProgramSummary {
  return (
    isRecord(value) &&
    isTrainingProgramCode(value.program_code) &&
    typeof value.certification_level === "string" &&
    typeof value.display_name === "string" &&
    typeof value.qualification_label === "string" &&
    typeof value.required_training_hours === "number" &&
    typeof value.minimum_age === "number"
  );
}

function isTrainingEnrollmentClientSummary(
  value: unknown
): value is TrainingEnrollmentClientSummary {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.organization_name === "string" &&
    typeof value.status === "string"
  );
}

function isTrainingEnrollmentSessionSummary(
  value: unknown
): value is TrainingEnrollmentSessionSummary {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.training_title === "string" &&
    typeof value.training_start_date === "string" &&
    isNullableString(value.training_end_date) &&
    isNullableString(value.facility_id)
  );
}

function isTrainingSessionListResponse(
  value: unknown
): value is TrainingSessionListResponse {
  return (
    isRecord(value) &&
    Array.isArray(value.sessions) &&
    value.sessions.every(isTrainingSession)
  );
}

function isTrainingSession(value: unknown): value is TrainingSession {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.business_identifier === "string" &&
    typeof value.training_title === "string" &&
    typeof value.operational_skill === "string" &&
    typeof value.training_start_date === "string" &&
    isNullableString(value.training_end_date) &&
    (value.duration_minutes === null ||
      typeof value.duration_minutes === "number") &&
    isNullableString(value.facility_id) &&
    isNullableString(value.instructor_name) &&
    isNullableString(value.instructor_license_number) &&
    isNullableString(value.instructor_staff_member_id) &&
    isNullableString(value.instructor_qualification_certification_id) &&
    isNullableString(value.conducted_by_user_id) &&
    isNullableString(value.training_notes) &&
    typeof value.created_at === "string" &&
    typeof value.updated_at === "string" &&
    (value.facility === null || isTrainingSessionFacilitySummary(value.facility)) &&
    (value.instructor_staff_member === null ||
      isTrainingSessionInstructorStaffMemberSummary(value.instructor_staff_member)) &&
    (value.instructor_qualification_certification === null ||
      isTrainingSessionInstructorQualificationSummary(
        value.instructor_qualification_certification
      ))
  );
}

function isTrainingSessionInstructorQualificationSummary(
  value: unknown
): value is TrainingSessionInstructorQualificationSummary {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.business_identifier === "string" &&
    (value.certification_level === "L6" || value.certification_level === "L7") &&
    typeof value.certification_status === "string" &&
    typeof value.issue_date === "string" &&
    typeof value.expiry_date === "string"
  );
}

function isTrainingSessionFacilitySummary(
  value: unknown
): value is TrainingSessionFacilitySummary {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.client_id === "string" &&
    typeof value.facility_name === "string" &&
    typeof value.operational_status === "string"
  );
}

function isTrainingSessionInstructorStaffMemberSummary(
  value: unknown
): value is TrainingSessionInstructorStaffMemberSummary {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.client_id === "string" &&
    typeof value.full_name === "string" &&
    isNullableString(value.email)
  );
}

function isTrainingProgramCode(value: unknown): value is TrainingProgramCode {
  return (
    typeof value === "string" &&
    trainingProgramOptions.some((program) => program.program_code === value)
  );
}

function isTrainingEvidenceDraftTemplateCode(
  value: unknown
): value is TrainingEvidenceDraftTemplateCode {
  return (
    value === "OGI_F023_OPERATIONAL_SKILLS_ASSESSMENT" ||
    value === "OGI_F024_OPERATIONAL_KNOWLEDGE_ASSESSMENT_RECORD" ||
    value === "OGI_F025_OPERATIONAL_READINESS_EVALUATION"
  );
}

function isTrainingEvidenceWorkspaceSlotKey(
  value: unknown
): value is TrainingEvidenceWorkspaceSlotKey {
  return value === "SKILLS" || value === "KNOWLEDGE" || value === "READINESS";
}

function isTrainingEvidencePurpose(
  value: unknown
): value is TrainingEvidenceWorkspaceSlot["evidence_purpose"] {
  return (
    value === "SKILLS_ASSESSMENT" ||
    value === "KNOWLEDGE_ASSESSMENT" ||
    value === "READINESS"
  );
}

function isNullableString(value: unknown) {
  return value === undefined || value === null || typeof value === "string";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
