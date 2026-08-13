import { apiRequest } from "../api/client";

export const registrationClientStatuses = [
  "ACTIVE",
  "INACTIVE",
  "SUSPENDED"
] as const;

export type RegistrationClientStatus =
  (typeof registrationClientStatuses)[number];

export interface RegistrationClient {
  id: string;
  organization_name: string;
  contact_email?: string | null;
  contact_phone?: string | null;
  status: RegistrationClientStatus;
  address?: string | null;
  country?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}

export interface RegistrationClientListResponse {
  clients: RegistrationClient[];
}

export interface RegistrationClientMutationRequest {
  organization_name?: string;
  contact_email?: string | null;
  contact_phone?: string | null;
  status?: RegistrationClientStatus;
  address?: string | null;
  country?: string | null;
  notes?: string | null;
}

export interface CreateRegistrationClientRequest
  extends RegistrationClientMutationRequest {
  organization_name: string;
}

export type UpdateRegistrationClientRequest = RegistrationClientMutationRequest;

export function listRegistrationClients() {
  return apiRequest<RegistrationClientListResponse>(
    "/api/v1/registration/clients",
    {
      validate: isRegistrationClientListResponse
    }
  );
}

export function getRegistrationClient(clientId: string) {
  return apiRequest<RegistrationClient>(
    `/api/v1/registration/clients/${encodeURIComponent(clientId)}`,
    {
      validate: isRegistrationClient
    }
  );
}

export function createRegistrationClient(
  request: CreateRegistrationClientRequest
) {
  return apiRequest<RegistrationClient>("/api/v1/registration/clients", {
    method: "POST",
    body: request,
    validate: isRegistrationClient
  });
}

export function updateRegistrationClient(
  clientId: string,
  request: UpdateRegistrationClientRequest
) {
  return apiRequest<RegistrationClient>(
    `/api/v1/registration/clients/${encodeURIComponent(clientId)}`,
    {
      method: "PATCH",
      body: request,
      validate: isRegistrationClient
    }
  );
}

function isRegistrationClientListResponse(
  value: unknown
): value is RegistrationClientListResponse {
  return (
    isRecord(value) &&
    Array.isArray(value.clients) &&
    value.clients.every(isRegistrationClient)
  );
}

function isRegistrationClient(value: unknown): value is RegistrationClient {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.organization_name === "string" &&
    isNullableString(value.contact_email) &&
    isNullableString(value.contact_phone) &&
    isRegistrationClientStatus(value.status) &&
    isNullableString(value.address) &&
    isNullableString(value.country) &&
    isNullableString(value.notes) &&
    typeof value.created_at === "string" &&
    typeof value.updated_at === "string" &&
    isNullableString(value.deleted_at)
  );
}

function isRegistrationClientStatus(
  value: unknown
): value is RegistrationClientStatus {
  return (
    typeof value === "string" &&
    registrationClientStatuses.includes(value as RegistrationClientStatus)
  );
}

function isNullableString(value: unknown) {
  return value === undefined || value === null || typeof value === "string";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}