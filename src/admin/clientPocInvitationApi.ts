import { apiRequest } from "../api/client";

export type ClientPocInvitationStatus = "ISSUED" | "REVOKED" | "CONSUMED" | "EXPIRED";
export type ClientPocInvitationScope =
  | { mode: "CLIENT_WIDE"; facility_ids: [] }
  | { mode: "EXPLICIT"; facility_ids: string[] };

export interface ClientPocInvitation {
  id: string;
  invitation_type: "CLIENT_POC";
  client_id: string;
  full_name: string;
  email: string;
  facility_scope: ClientPocInvitationScope;
  status: ClientPocInvitationStatus;
  issued_by_user_id: string;
  issued_at: string;
  expires_at: string;
  consumed_at: string | null;
  revoked_at: string | null;
  integrity_checksum: string;
}

export interface IssueClientPocInvitationRequest {
  client_id: string;
  full_name: string;
  email: string;
  facility_scope: { mode: "CLIENT_WIDE" } | { mode: "EXPLICIT"; facility_ids: string[] };
}

export interface IssueClientPocInvitationResult {
  invitation: ClientPocInvitation;
  activation_token: string | null;
  idempotent_replay: boolean;
}

export function issueClientPocInvitation(request: IssueClientPocInvitationRequest, idempotencyKey: string) {
  return apiRequest<IssueClientPocInvitationResult>("/api/v1/admin/account-registration-invitations/client-poc", {
    method: "POST", headers: { "Idempotency-Key": idempotencyKey }, body: request, validate: isIssueResult
  });
}

export function listClientPocInvitations() {
  return apiRequest<{ invitations: ClientPocInvitation[] }>("/api/v1/admin/account-registration-invitations/client-poc", { validate: isList });
}

export function revokeClientPocInvitation(invitationId: string) {
  return apiRequest<{ unchanged: boolean }>(`/api/v1/admin/account-registration-invitations/client-poc/${encodeURIComponent(invitationId)}/revoke`, {
    method: "POST", validate: (value): value is { unchanged: boolean } => record(value) && typeof value.unchanged === "boolean"
  });
}

function record(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
function nullableString(value: unknown) { return value === null || typeof value === "string"; }
function isScope(value: unknown): value is ClientPocInvitationScope { return record(value) && (value.mode === "CLIENT_WIDE" || value.mode === "EXPLICIT") && Array.isArray(value.facility_ids) && value.facility_ids.every(item => typeof item === "string"); }
function isInvitation(value: unknown): value is ClientPocInvitation { return record(value) && typeof value.id === "string" && value.invitation_type === "CLIENT_POC" && typeof value.client_id === "string" && typeof value.full_name === "string" && typeof value.email === "string" && isScope(value.facility_scope) && ["ISSUED", "REVOKED", "CONSUMED", "EXPIRED"].includes(String(value.status)) && typeof value.issued_by_user_id === "string" && typeof value.issued_at === "string" && typeof value.expires_at === "string" && nullableString(value.consumed_at) && nullableString(value.revoked_at) && typeof value.integrity_checksum === "string"; }
function isIssueResult(value: unknown): value is IssueClientPocInvitationResult { return record(value) && isInvitation(value.invitation) && nullableString(value.activation_token) && typeof value.idempotent_replay === "boolean"; }
function isList(value: unknown): value is { invitations: ClientPocInvitation[] } { return record(value) && Array.isArray(value.invitations) && value.invitations.every(isInvitation); }
