export interface LoginRequest {
  identifier: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string | null;
    username: string | null;
    fullName: string;
    status: string;
  };
}

export interface RefreshRequest {
  refreshToken: string;
}

export interface RefreshResponse {
  accessToken: string;
}

export interface AuthenticatedSession {
  id: string;
  email: string | null;
  username: string | null;
  fullName: string;
  status: string;
  clientId: string | null;
  facilityIds: string[];
  roles: string[];
  permissions: string[];
}

export type AuthStatus = "bootstrapping" | "authenticated" | "unauthenticated";

export interface ApiErrorPayload {
  code: string;
  message: string;
  status: number;
  details?: unknown;
}
