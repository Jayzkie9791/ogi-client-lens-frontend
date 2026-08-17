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

export interface TrainingEnrollmentListResponse {
  readonly enrollments: readonly TrainingEnrollment[];
}

export interface CreateTrainingEnrollmentRequest {
  readonly program_code: TrainingProgramCode;
  readonly client_id?: string | null;
  readonly notes?: string | null;
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

function isTrainingProgramCode(value: unknown): value is TrainingProgramCode {
  return (
    typeof value === "string" &&
    trainingProgramOptions.some((program) => program.program_code === value)
  );
}

function isNullableString(value: unknown) {
  return value === undefined || value === null || typeof value === "string";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
