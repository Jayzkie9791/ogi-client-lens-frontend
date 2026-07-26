import {
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import { useQueryClient } from "@tanstack/react-query";

import { configureApiAuth } from "../api/client";
import { isApiError } from "../api/errors";

import {
  AuthContext,
  AuthContextValue
} from "./AuthContext";
import {
  getCurrentSession,
  login as loginRequest,
  refresh as refreshRequest
} from "./authApi";
import {
  clearStoredRefreshToken,
  readStoredRefreshToken,
  storeRefreshToken
} from "./storage";
import { AuthenticatedSession, AuthStatus, LoginRequest } from "./types";

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const queryClient = useQueryClient();
  const accessTokenRef = useRef<string | null>(null);
  const [status, setStatus] = useState<AuthStatus>("bootstrapping");
  const [session, setSession] = useState<AuthenticatedSession | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const clearSession = useCallback((message?: string | null) => {
    accessTokenRef.current = null;
    clearStoredRefreshToken();
    setSession(null);
    setStatus("unauthenticated");
    setErrorMessage(message ?? null);
    queryClient.clear();
  }, [queryClient]);

  const refreshAccessToken = useCallback(async () => {
    const refreshToken = readStoredRefreshToken();

    if (!refreshToken) {
      return null;
    }

    try {
      const response = await refreshRequest({ refreshToken });

      accessTokenRef.current = response.accessToken;
      return response.accessToken;
    } catch {
      clearSession("Your session has expired. Please sign in again.");
      return null;
    }
  }, [clearSession]);

  useEffect(() => {
    configureApiAuth({
      getAccessToken: () => accessTokenRef.current,
      refreshAccessToken,
      onAuthFailure: () =>
        clearSession("Your session has expired. Please sign in again.")
    });

    return () => configureApiAuth(null);
  }, [clearSession, refreshAccessToken]);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      const refreshToken = readStoredRefreshToken();

      if (!refreshToken) {
        if (!cancelled) {
          setStatus("unauthenticated");
        }
        return;
      }

      const refreshedToken = await refreshAccessToken();

      if (!refreshedToken) {
        return;
      }

      try {
        const currentSession = await getCurrentSession();

        if (!cancelled) {
          setSession(currentSession);
          setStatus("authenticated");
          setErrorMessage(null);
        }
      } catch {
        if (!cancelled) {
          clearSession("Your session could not be restored. Please sign in again.");
        }
      }
    }

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, [clearSession, refreshAccessToken]);

  const login = useCallback(async (request: LoginRequest) => {
    setErrorMessage(null);
    const loginResponse = await loginRequest(request);

    accessTokenRef.current = loginResponse.accessToken;
    storeRefreshToken(loginResponse.refreshToken);

    try {
      const currentSession = await getCurrentSession();

      setSession(currentSession);
      setStatus("authenticated");
    } catch (error) {
      clearSession(
        isApiError(error)
          ? error.message
          : "Your session could not be established. Please try again."
      );
      throw error;
    }
  }, [clearSession]);

  const logout = useCallback(() => {
    clearSession(null);
  }, [clearSession]);

  const clearAuthError = useCallback(() => {
    setErrorMessage(null);
  }, []);

  const canUsePermission = useCallback(
    (permission: string) => {
      return session?.permissions.includes(permission) ?? false;
    },
    [session]
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      session,
      errorMessage,
      login,
      logout,
      clearAuthError,
      refreshAccessToken,
      canUsePermission
    }),
    [
      status,
      session,
      errorMessage,
      login,
      logout,
      clearAuthError,
      refreshAccessToken,
      canUsePermission
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
