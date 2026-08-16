import { apiRequest } from "../api/client";

export interface AdministrationUserSummary {
  readonly id: string;
  readonly email: string | null;
  readonly username: string | null;
  readonly full_name: string;
  readonly status: string;
  readonly created_at: string;
}

export type AdministrationUsersResponse = readonly AdministrationUserSummary[];

export function listAdministrationUsers(): Promise<AdministrationUsersResponse> {
  return apiRequest("/api/v1/auth/users", {
    validate: isAdministrationUsersResponse
  });
}

function isAdministrationUsersResponse(
  value: unknown
): value is AdministrationUsersResponse {
  return Array.isArray(value) && value.every(isAdministrationUserSummary);
}

function isAdministrationUserSummary(
  value: unknown
): value is AdministrationUserSummary {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === "string" &&
    isNullableString(value.email) &&
    isNullableString(value.username) &&
    typeof value.full_name === "string" &&
    typeof value.status === "string" &&
    typeof value.created_at === "string"
  );
}

function isNullableString(value: unknown): value is string | null {
  return typeof value === "string" || value === null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
