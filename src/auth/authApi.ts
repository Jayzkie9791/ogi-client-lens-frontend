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
