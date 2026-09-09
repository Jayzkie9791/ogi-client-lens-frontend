import { apiRequest } from "../api/client";
import { isRegistrationPersonnel, RegistrationPersonnel } from "./registrationPersonnelApi";

export interface LinkableUser {
  id: string;
  email: string | null;
  username: string | null;
  full_name: string;
  status: "ACTIVE";
  personnel_link_available: true;
}

export interface OgiOperationalAuthorization {
  id: string;
  personnel_id: string;
  client_id: string;
  scope_mode: "CLIENT_WIDE" | "EXPLICIT_FACILITIES";
  status: string;
  valid_from: string;
  valid_until: string | null;
  reason: string | null;
  facility_grants: Array<{ authorization_id: string; facility_id: string; created_at: string }>;
  lifecycle_events: Array<{ id: string; event_type: string; effective_at: string; reason: string }>;
}

export interface CreateOgiPersonnelRequest {
  user_id: string;
  full_name: string;
  email: string | null;
  phone_number: string | null;
  employment_status: string;
  hire_date: string | null;
  notes: string | null;
}

export interface GrantOgiOperationalAuthorizationRequest {
  client_id: string;
  scope_mode: "CLIENT_WIDE" | "EXPLICIT_FACILITIES";
  facility_ids: string[];
  valid_from: string;
  valid_until: string | null;
  reason: string;
}

export function listLinkablePersonnelUsers() {
  return apiRequest<{ users: LinkableUser[] }>("/api/v1/registration/personnel/linkable-users", {
    validate: isLinkableUsersResponse
  });
}

export function createOgiPersonnel(request: CreateOgiPersonnelRequest, idempotencyKey: string) {
  return apiRequest<{ personnel: RegistrationPersonnel; replayed: boolean }>("/api/v1/registration/personnel/ogi", {
    method: "POST",
    body: request,
    headers: { "idempotency-key": idempotencyKey },
    validate: isOgiPersonnelResponse
  });
}

export function listOgiOperationalAuthorizations(personnelId: string) {
  return apiRequest<{ authorizations: OgiOperationalAuthorization[] }>(
    `/api/v1/registration/personnel/${encodeURIComponent(personnelId)}/operational-authorizations`,
    { validate: isAuthorizationListResponse }
  );
}

export function grantOgiOperationalAuthorization(personnelId: string, request: GrantOgiOperationalAuthorizationRequest, idempotencyKey: string) {
  return apiRequest<{ authorization: OgiOperationalAuthorization; replayed: boolean }>(
    `/api/v1/registration/personnel/${encodeURIComponent(personnelId)}/operational-authorizations`,
    { method: "POST", body: request, headers: { "idempotency-key": idempotencyKey }, validate: isAuthorizationResponse }
  );
}

export function closeOgiOperationalAuthorization(personnelId: string, authorizationId: string, action: "end" | "revoke", request: { reason: string; effective_at: string }, idempotencyKey: string) {
  return apiRequest<{ event: unknown; replayed: boolean }>(
    `/api/v1/registration/personnel/${encodeURIComponent(personnelId)}/operational-authorizations/${encodeURIComponent(authorizationId)}/${action}`,
    { method: "POST", body: request, headers: { "idempotency-key": idempotencyKey }, validate: isEventResponse }
  );
}

function isLinkableUsersResponse(value: unknown): value is { users: LinkableUser[] } {
  return isRecord(value) && Array.isArray(value.users) && value.users.every((user) => isRecord(user) && typeof user.id === "string" && typeof user.full_name === "string" && user.status === "ACTIVE" && user.personnel_link_available === true && isNullableString(user.email) && isNullableString(user.username));
}

function isOgiPersonnelResponse(value: unknown): value is { personnel: RegistrationPersonnel; replayed: boolean } {
  return isRecord(value) && isRegistrationPersonnel(value.personnel) && value.personnel.client_id === null && value.personnel.organizational_affiliation === "OGI" && typeof value.replayed === "boolean";
}

function isAuthorizationListResponse(value: unknown): value is { authorizations: OgiOperationalAuthorization[] } {
  return isRecord(value) && Array.isArray(value.authorizations) && value.authorizations.every(isAuthorization);
}

function isAuthorizationResponse(value: unknown): value is { authorization: OgiOperationalAuthorization; replayed: boolean } {
  return isRecord(value) && isAuthorization(value.authorization) && typeof value.replayed === "boolean";
}

function isAuthorization(value: unknown): value is OgiOperationalAuthorization {
  return isRecord(value) && typeof value.id === "string" && typeof value.personnel_id === "string" && typeof value.client_id === "string" && (value.scope_mode === "CLIENT_WIDE" || value.scope_mode === "EXPLICIT_FACILITIES") && typeof value.status === "string" && typeof value.valid_from === "string" && isNullableString(value.valid_until) && isNullableString(value.reason) && Array.isArray(value.facility_grants) && Array.isArray(value.lifecycle_events);
}

function isEventResponse(value: unknown): value is { event: unknown; replayed: boolean } {
  return isRecord(value) && isRecord(value.event) && typeof value.replayed === "boolean";
}

function isNullableString(value: unknown) { return value === null || typeof value === "string"; }
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
