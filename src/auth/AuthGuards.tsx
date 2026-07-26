import { Navigate, Outlet, useLocation } from "react-router-dom";

import { routes } from "../app/routePaths";

import { useAuth } from "./useAuth";

export function RequireAuth() {
  const auth = useAuth();
  const location = useLocation();

  if (auth.status === "bootstrapping") {
    return (
      <main className="min-h-screen bg-canvas px-4 py-8 text-text-primary">
        <p role="status" className="text-sm text-text-muted">
          Starting Client Lens...
        </p>
      </main>
    );
  }

  if (auth.status !== "authenticated") {
    return (
      <Navigate
        replace
        state={{ from: location.pathname }}
        to={routes.login}
      />
    );
  }

  return <Outlet />;
}

export function PublicOnlyRoute() {
  const auth = useAuth();
  const location = useLocation();
  const destination = readDestination(location.state);

  if (auth.status === "bootstrapping") {
    return (
      <main className="min-h-screen bg-canvas px-4 py-8 text-text-primary">
        <p role="status" className="text-sm text-text-muted">
          Starting Client Lens...
        </p>
      </main>
    );
  }

  if (auth.status === "authenticated") {
    return <Navigate replace to={destination ?? routes.workbench} />;
  }

  return <Outlet />;
}

function readDestination(state: unknown) {
  if (!state || typeof state !== "object" || !("from" in state)) {
    return null;
  }

  const value = (state as { from?: unknown }).from;

  return typeof value === "string" && value.startsWith("/") ? value : null;
}
