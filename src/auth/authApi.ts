import { apiRequest } from "../api/client";

import {
  isAuthenticatedSession,
  isLoginResponse,
  isRefreshResponse
} from "./guards";
import {
  AuthenticatedSession,
  LoginRequest,
  LoginResponse,
  RefreshRequest,
  RefreshResponse
} from "./types";
import type { PasswordResetConfirmResponse, PasswordResetRequestResponse } from "./types";

export function login(request: LoginRequest): Promise<LoginResponse> {
  return apiRequest("/api/v1/auth/login", {
    method: "POST",
    body: request,
    auth: false,
    validate: isLoginResponse
  });
}

export function refresh(request: RefreshRequest): Promise<RefreshResponse> {
  return apiRequest("/api/v1/auth/refresh", {
    method: "POST",
    body: request,
    auth: false,
    validate: isRefreshResponse
  });
}

export function getCurrentSession(): Promise<AuthenticatedSession> {
  return apiRequest("/api/v1/auth/me", {
    validate: isAuthenticatedSession
  });
}

export function requestPasswordReset(identifier: string): Promise<PasswordResetRequestResponse> {
  return apiRequest("/api/v1/auth/password-reset/request", { method: "POST", body: { identifier }, auth: false, validate: (value): value is PasswordResetRequestResponse => typeof value === "object" && value !== null && (value as { accepted?: unknown }).accepted === true });
}

export function confirmPasswordReset(token: string, newPassword: string): Promise<PasswordResetConfirmResponse> {
  return apiRequest("/api/v1/auth/password-reset/confirm", { method: "POST", body: { token, newPassword }, auth: false, validate: (value): value is PasswordResetConfirmResponse => typeof value === "object" && value !== null && (value as { reset?: unknown }).reset === true });
}
