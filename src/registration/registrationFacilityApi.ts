import { apiRequest } from "../api/client";

export const registrationFacilityTypes = [
  "POOL",
  "BEACH",
  "WATERPARK",
  "OPEN_WATER",
  "ATTRACTION",
  "TRAINING_CENTER"
] as const;

export type RegistrationFacilityType =
  (typeof registrationFacilityTypes)[number];

export const registrationFacilityOperationalStatuses = [
  "ACTIVE",
  "INACTIVE",
  "UNDER_MAINTENANCE",
  "PENDING_APPROVAL",
  "SUSPENDED"
] as const;

export type RegistrationFacilityOperationalStatus =
  (typeof registrationFacilityOperationalStatuses)[number];

export interface RegistrationFacility {
  id: string;
  client_id: string;
  facility_name: string;
  facility_type: RegistrationFacilityType;
  operational_status: RegistrationFacilityOperationalStatus;
  address?: string | null;
  country?: string | null;
  timezone?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}

export interface RegistrationFacilityListResponse {
  facilities: RegistrationFacility[];
}

export interface RegistrationFacilityListFilters {
  clientId?: string;
}

export interface RegistrationFacilityMutationRequest {
  facility_name?: string;
  facility_type?: RegistrationFacilityType;
  operational_status?: RegistrationFacilityOperationalStatus;
  address?: string | null;
  country?: string | null;
  timezone?: string | null;
  notes?: string | null;
}

export interface CreateRegistrationFacilityRequest
  extends RegistrationFacilityMutationRequest {
  client_id: string;
  facility_name: string;
  facility_type: RegistrationFacilityType;
}

export type UpdateRegistrationFacilityRequest = RegistrationFacilityMutationRequest;

export function listRegistrationFacilities(
  filters: RegistrationFacilityListFilters = {}
) {
  return apiRequest<RegistrationFacilityListResponse>(
    buildRegistrationFacilitiesPath(filters),
    {
      validate: isRegistrationFacilityListResponse
    }
  );
}

export function getRegistrationFacility(facilityId: string) {
  return apiRequest<RegistrationFacility>(
    `/api/v1/registration/facilities/${encodeURIComponent(facilityId)}`,
    {
      validate: isRegistrationFacility
    }
  );
}

export function createRegistrationFacility(
  request: CreateRegistrationFacilityRequest
) {
  return apiRequest<RegistrationFacility>("/api/v1/registration/facilities", {
    method: "POST",
    body: request,
    validate: isRegistrationFacility
  });
}

export function updateRegistrationFacility(
  facilityId: string,
  request: UpdateRegistrationFacilityRequest
) {
  return apiRequest<RegistrationFacility>(
    `/api/v1/registration/facilities/${encodeURIComponent(facilityId)}`,
    {
      method: "PATCH",
      body: request,
      validate: isRegistrationFacility
    }
  );
}

function buildRegistrationFacilitiesPath(
  filters: RegistrationFacilityListFilters
) {
  const searchParams = new URLSearchParams();

  if (filters.clientId) {
    searchParams.set("clientId", filters.clientId);
  }

  const query = searchParams.toString();

  return `/api/v1/registration/facilities${query ? `?${query}` : ""}`;
}

function isRegistrationFacilityListResponse(
  value: unknown
): value is RegistrationFacilityListResponse {
  return (
    isRecord(value) &&
    Array.isArray(value.facilities) &&
    value.facilities.every(isRegistrationFacility)
  );
}

function isRegistrationFacility(value: unknown): value is RegistrationFacility {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.client_id === "string" &&
    typeof value.facility_name === "string" &&
    isRegistrationFacilityType(value.facility_type) &&
    isRegistrationFacilityOperationalStatus(value.operational_status) &&
    isNullableString(value.address) &&
    isNullableString(value.country) &&
    isNullableString(value.timezone) &&
    isNullableString(value.notes) &&
    typeof value.created_at === "string" &&
    typeof value.updated_at === "string" &&
    isNullableString(value.deleted_at)
  );
}

function isRegistrationFacilityType(
  value: unknown
): value is RegistrationFacilityType {
  return (
    typeof value === "string" &&
    registrationFacilityTypes.includes(value as RegistrationFacilityType)
  );
}

function isRegistrationFacilityOperationalStatus(
  value: unknown
): value is RegistrationFacilityOperationalStatus {
  return (
    typeof value === "string" &&
    registrationFacilityOperationalStatuses.includes(
      value as RegistrationFacilityOperationalStatus
    )
  );
}

function isNullableString(value: unknown) {
  return value === undefined || value === null || typeof value === "string";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}