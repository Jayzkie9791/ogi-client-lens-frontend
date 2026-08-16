import { apiRequest } from "../api/client";
import { CertificationLevel, CertificationStatus, certificationLevels, certificationStatuses } from "./certificationsApi";

export interface CreateOperationalAuthorizationRequest {
  readonly authorization_number: string;
  readonly authorization_level: CertificationLevel;
  readonly authorization_status?: CertificationStatus;
  readonly issue_date: string;
  readonly expiry_date: string;
  readonly certification_id: string;
  readonly staff_member_id: string;
}

export interface RenewOperationalAuthorizationRequest {
  readonly authorization_number: string;
  readonly issue_date: string;
  readonly expiry_date: string;
}

export interface GovernOperationalAuthorizationRequest {
  readonly reason: string;
  readonly notes?: string;
}

export type OperationalAuthorizationCommand =
  | "renew"
  | "suspend"
  | "reinstate"
  | "revoke";

export interface OperationalAuthorizationCommandRecord {
  readonly id: string;
  readonly authorization_number: string;
  readonly authorization_level: CertificationLevel;
  readonly authorization_status: CertificationStatus;
  readonly issue_date: string;
  readonly expiry_date: string;
  readonly renewal_date: string | null;
  readonly upgrade_requested: boolean;
  readonly staff_member_id: string;
  readonly certification_id: string | null;
  readonly previous_authorization_id: string | null;
  readonly created_by_user_id: string | null;
}

interface OperationalAuthorizationCommandResponse {
  readonly success: true;
  readonly data: OperationalAuthorizationCommandRecord;
}

export function createOperationalAuthorization(
  payload: CreateOperationalAuthorizationRequest
) {
  return apiRequest<OperationalAuthorizationCommandResponse>(
    "/api/v1/operational-authorizations",
    {
      method: "POST",
      body: payload,
      validate: isOperationalAuthorizationCommandResponse
    }
  ).then((response) => response.data);
}

export function renewOperationalAuthorization(
  authorizationId: string,
  payload: RenewOperationalAuthorizationRequest
) {
  return postOperationalAuthorizationCommand(
    authorizationId,
    "renew",
    payload
  );
}

export function suspendOperationalAuthorization(
  authorizationId: string,
  payload: GovernOperationalAuthorizationRequest
) {
  return postOperationalAuthorizationCommand(
    authorizationId,
    "suspend",
    payload
  );
}

export function reinstateOperationalAuthorization(
  authorizationId: string,
  payload: GovernOperationalAuthorizationRequest
) {
  return postOperationalAuthorizationCommand(
    authorizationId,
    "reinstate",
    payload
  );
}

export function revokeOperationalAuthorization(
  authorizationId: string,
  payload: GovernOperationalAuthorizationRequest
) {
  return postOperationalAuthorizationCommand(
    authorizationId,
    "revoke",
    payload
  );
}

function postOperationalAuthorizationCommand(
  authorizationId: string,
  command: OperationalAuthorizationCommand,
  payload: RenewOperationalAuthorizationRequest | GovernOperationalAuthorizationRequest
) {
  return apiRequest<OperationalAuthorizationCommandResponse>(
    `/api/v1/operational-authorizations/${encodeURIComponent(authorizationId)}/${command}`,
    {
      method: "POST",
      body: payload,
      validate: isOperationalAuthorizationCommandResponse
    }
  ).then((response) => response.data);
}

function isOperationalAuthorizationCommandResponse(
  value: unknown
): value is OperationalAuthorizationCommandResponse {
  return (
    isRecord(value) &&
    value.success === true &&
    isOperationalAuthorizationCommandRecord(value.data)
  );
}

function isOperationalAuthorizationCommandRecord(
  value: unknown
): value is OperationalAuthorizationCommandRecord {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.authorization_number === "string" &&
    isCertificationLevel(value.authorization_level) &&
    isCertificationStatus(value.authorization_status) &&
    typeof value.issue_date === "string" &&
    typeof value.expiry_date === "string" &&
    isNullableString(value.renewal_date) &&
    typeof value.upgrade_requested === "boolean" &&
    typeof value.staff_member_id === "string" &&
    isNullableString(value.certification_id) &&
    isNullableString(value.previous_authorization_id) &&
    isNullableString(value.created_by_user_id)
  );
}

function isCertificationLevel(value: unknown): value is CertificationLevel {
  return (
    typeof value === "string" &&
    certificationLevels.includes(value as CertificationLevel)
  );
}

function isCertificationStatus(value: unknown): value is CertificationStatus {
  return (
    typeof value === "string" &&
    certificationStatuses.includes(value as CertificationStatus)
  );
}

function isNullableString(value: unknown) {
  return value === null || typeof value === "string";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}