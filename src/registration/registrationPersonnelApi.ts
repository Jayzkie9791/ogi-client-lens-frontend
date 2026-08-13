import { apiRequest } from "../api/client";

export const registrationPersonnelEmploymentStatuses = [
  "ACTIVE",
  "INACTIVE",
  "SUSPENDED",
  "TERMINATED",
  "SEASONAL"
] as const;

export type RegistrationPersonnelEmploymentStatus =
  (typeof registrationPersonnelEmploymentStatuses)[number];

export interface RegistrationPersonnel {
  id: string;
  client_id: string;
  user_id: string | null;
  full_name: string;
  email?: string | null;
  phone_number?: string | null;
  employment_status: RegistrationPersonnelEmploymentStatus;
  hire_date?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}

export interface RegistrationPersonnelListResponse {
  personnel: RegistrationPersonnel[];
}

export interface RegistrationPersonnelListFilters {
  clientId?: string;
  facilityId?: string;
  status?: RegistrationPersonnelEmploymentStatus;
}

export interface RegistrationPersonnelMutationRequest {
  full_name?: string;
  email?: string | null;
  phone_number?: string | null;
  employment_status?: RegistrationPersonnelEmploymentStatus;
  hire_date?: string | null;
  notes?: string | null;
}

export interface CreateRegistrationPersonnelRequest
  extends RegistrationPersonnelMutationRequest {
  client_id: string;
  full_name: string;
}

export type UpdateRegistrationPersonnelRequest =
  RegistrationPersonnelMutationRequest;

export function listRegistrationPersonnel(
  filters: RegistrationPersonnelListFilters = {}
) {
  return apiRequest<RegistrationPersonnelListResponse>(
    buildRegistrationPersonnelPath(filters),
    {
      validate: isRegistrationPersonnelListResponse
    }
  );
}

export function getRegistrationPersonnel(staffMemberId: string) {
  return apiRequest<RegistrationPersonnel>(
    `/api/v1/registration/personnel/${encodeURIComponent(staffMemberId)}`,
    {
      validate: isRegistrationPersonnel
    }
  );
}

export function createRegistrationPersonnel(
  request: CreateRegistrationPersonnelRequest
) {
  return apiRequest<RegistrationPersonnel>("/api/v1/registration/personnel", {
    method: "POST",
    body: request,
    validate: isRegistrationPersonnel
  });
}

export function updateRegistrationPersonnel(
  staffMemberId: string,
  request: UpdateRegistrationPersonnelRequest
) {
  return apiRequest<RegistrationPersonnel>(
    `/api/v1/registration/personnel/${encodeURIComponent(staffMemberId)}`,
    {
      method: "PATCH",
      body: request,
      validate: isRegistrationPersonnel
    }
  );
}

function buildRegistrationPersonnelPath(
  filters: RegistrationPersonnelListFilters
) {
  const searchParams = new URLSearchParams();

  if (filters.clientId) {
    searchParams.set("clientId", filters.clientId);
  }

  if (filters.facilityId) {
    searchParams.set("facilityId", filters.facilityId);
  }

  if (filters.status) {
    searchParams.set("status", filters.status);
  }

  const query = searchParams.toString();

  return `/api/v1/registration/personnel${query ? `?${query}` : ""}`;
}

function isRegistrationPersonnelListResponse(
  value: unknown
): value is RegistrationPersonnelListResponse {
  return (
    isRecord(value) &&
    Array.isArray(value.personnel) &&
    value.personnel.every(isRegistrationPersonnel)
  );
}

function isRegistrationPersonnel(value: unknown): value is RegistrationPersonnel {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.client_id === "string" &&
    isNullableString(value.user_id) &&
    typeof value.full_name === "string" &&
    isNullableString(value.email) &&
    isNullableString(value.phone_number) &&
    isRegistrationPersonnelEmploymentStatus(value.employment_status) &&
    isNullableString(value.hire_date) &&
    isNullableString(value.notes) &&
    typeof value.created_at === "string" &&
    typeof value.updated_at === "string" &&
    isNullableString(value.deleted_at)
  );
}

function isRegistrationPersonnelEmploymentStatus(
  value: unknown
): value is RegistrationPersonnelEmploymentStatus {
  return (
    typeof value === "string" &&
    registrationPersonnelEmploymentStatuses.includes(
      value as RegistrationPersonnelEmploymentStatus
    )
  );
}

function isNullableString(value: unknown) {
  return value === undefined || value === null || typeof value === "string";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
