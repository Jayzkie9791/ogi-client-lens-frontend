import { createContext } from "react";

import { AuthenticatedSession, AuthStatus, LoginRequest } from "./types";

export interface AuthContextValue {
  status: AuthStatus;
  session: AuthenticatedSession | null;
  errorMessage: string | null;
  login: (request: LoginRequest) => Promise<void>;
  logout: () => void;
  clearAuthError: () => void;
  refreshAccessToken: () => Promise<string | null>;
  canUsePermission: (permission: string) => boolean;
}

export const AuthContext = createContext<AuthContextValue | null>(null);
