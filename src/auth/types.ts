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

export interface PasswordResetRequestResponse { accepted: true }
export interface PasswordResetConfirmResponse { reset: true }
export interface PersonnelAccountActivationRequest {
  token: string;
  client_employee_number: string;
  new_password: string;
  confirm_password: string;
}
export interface PersonnelAccountActivationResponse { activated: true }
export type PersonnelRegistrationActivationRequest = PersonnelAccountActivationRequest;
export type PersonnelRegistrationActivationResponse = PersonnelAccountActivationResponse;
export interface ClientPocInvitationActivationRequest {
  token: string;
  email: string;
  new_password: string;
  confirm_password: string;
}
export type ClientPocInvitationActivationResponse = PersonnelAccountActivationResponse;

export interface AuthenticatedSession {
  id: string;
  email: string | null;
  username: string | null;
  fullName: string;
  status: string;
  clientId: string | null;
  facilityScopeMode: "EXPLICIT" | "CLIENT_WIDE" | null;
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
