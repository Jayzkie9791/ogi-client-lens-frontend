import { apiRequest } from "../api/client";

export const registrationFacilityAssignmentStatuses = [
  "ACTIVE",
  "INACTIVE",
  "COMPLETED",
  "SUSPENDED"
] as const;

export type RegistrationFacilityAssignmentStatus =
  (typeof registrationFacilityAssignmentStatuses)[number];

export interface RegistrationFacilityAssignment {
  id: string;
  staff_member_id: string;
  facility_id: string;
  assignment_status: RegistrationFacilityAssignmentStatus;
  assigned_from: string;
  assigned_to: string | null;
  is_primary_assignment: boolean;
  notes?: string | null;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}

export interface RegistrationFacilityAssignmentListResponse {
  assignments: RegistrationFacilityAssignment[];
}

export interface CreateRegistrationFacilityAssignmentRequest {
  facility_id: string;
  assigned_from: string;
  is_primary_assignment?: boolean;
  notes?: string;
}

export interface EndRegistrationFacilityAssignmentRequest {
  assigned_to: string;
  notes?: string;
}

export function listRegistrationFacilityAssignments(staffMemberId: string) {
  return apiRequest<RegistrationFacilityAssignmentListResponse>(
    `/api/v1/registration/personnel/${encodeURIComponent(staffMemberId)}/facility-assignments`,
    {
      validate: isRegistrationFacilityAssignmentListResponse
    }
  );
}

export function createRegistrationFacilityAssignment(
  staffMemberId: string,
  request: CreateRegistrationFacilityAssignmentRequest
) {
  return apiRequest<RegistrationFacilityAssignment>(
    `/api/v1/registration/personnel/${encodeURIComponent(staffMemberId)}/facility-assignments`,
    {
      method: "POST",
      body: request,
      validate: isRegistrationFacilityAssignment
    }
  );
}

export function endRegistrationFacilityAssignment(
  staffMemberId: string,
  assignmentId: string,
  request: EndRegistrationFacilityAssignmentRequest
) {
  return apiRequest<RegistrationFacilityAssignment>(
    `/api/v1/registration/personnel/${encodeURIComponent(staffMemberId)}/facility-assignments/${encodeURIComponent(assignmentId)}/end`,
    {
      method: "POST",
      body: request,
      validate: isRegistrationFacilityAssignment
    }
  );
}

export function setPrimaryRegistrationFacilityAssignment(
  staffMemberId: string,
  assignmentId: string
) {
  return apiRequest<RegistrationFacilityAssignment>(
    `/api/v1/registration/personnel/${encodeURIComponent(staffMemberId)}/facility-assignments/${encodeURIComponent(assignmentId)}/primary`,
    {
      method: "POST",
      validate: isRegistrationFacilityAssignment
    }
  );
}

function isRegistrationFacilityAssignmentListResponse(
  value: unknown
): value is RegistrationFacilityAssignmentListResponse {
  return (
    isRecord(value) &&
    Array.isArray(value.assignments) &&
    value.assignments.every(isRegistrationFacilityAssignment)
  );
}

function isRegistrationFacilityAssignment(
  value: unknown
): value is RegistrationFacilityAssignment {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.staff_member_id === "string" &&
    typeof value.facility_id === "string" &&
    isRegistrationFacilityAssignmentStatus(value.assignment_status) &&
    typeof value.assigned_from === "string" &&
    isNullableString(value.assigned_to) &&
    typeof value.is_primary_assignment === "boolean" &&
    isNullableString(value.notes) &&
    typeof value.created_at === "string" &&
    typeof value.updated_at === "string" &&
    isNullableString(value.deleted_at)
  );
}

function isRegistrationFacilityAssignmentStatus(
  value: unknown
): value is RegistrationFacilityAssignmentStatus {
  return (
    typeof value === "string" &&
    registrationFacilityAssignmentStatuses.includes(
      value as RegistrationFacilityAssignmentStatus
    )
  );
}

function isNullableString(value: unknown) {
  return value === undefined || value === null || typeof value === "string";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
