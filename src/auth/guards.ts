import {
  AuthenticatedSession,
  LoginResponse,
  RefreshResponse
} from "./types";

export function isLoginResponse(value: unknown): value is LoginResponse {
  if (!isRecord(value) || !isRecord(value.user)) {
    return false;
  }

  return (
    typeof value.accessToken === "string" &&
    value.accessToken.length > 0 &&
    typeof value.refreshToken === "string" &&
    value.refreshToken.length > 0 &&
    typeof value.user.id === "string" &&
    typeof value.user.email === "string" &&
    typeof value.user.fullName === "string" &&
    typeof value.user.status === "string"
  );
}

export function isRefreshResponse(value: unknown): value is RefreshResponse {
  return (
    isRecord(value) &&
    typeof value.accessToken === "string" &&
    value.accessToken.length > 0
  );
}

export function isAuthenticatedSession(
  value: unknown
): value is AuthenticatedSession {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.email === "string" &&
    typeof value.fullName === "string" &&
    typeof value.status === "string" &&
    (typeof value.clientId === "string" || value.clientId === null) &&
    isStringArray(value.facilityIds) &&
    isStringArray(value.roles) &&
    isStringArray(value.permissions)
  );
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
