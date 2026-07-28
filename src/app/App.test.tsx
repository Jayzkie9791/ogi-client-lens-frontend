import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { afterEach, beforeEach, expect, vi } from "vitest";

import { apiRequest, configureApiAuth } from "../api/client";
import { isAuthenticatedSession } from "../auth/guards";
import { getRefreshTokenStorageKey } from "../auth/storage";
import { AppProviders } from "./providers/AppProviders";
import { appRoutes } from "./router";
import { routes } from "./routePaths";

const session = {
  id: "user-1",
  email: "operator@example.test",
  fullName: "Operator One",
  status: "ACTIVE",
  clientId: "00000000-0000-4000-8000-000000000101",
  facilityIds: ["00000000-0000-4000-8000-000000000201"],
  roles: ["Operator"],
  permissions: ["view_operational_evidence"]
};

interface MockResponse {
  status: number;
  body?: unknown;
  statusText?: string;
}

function renderWithRoute(initialPath: string) {
  const testRouter = createMemoryRouter(appRoutes, {
    initialEntries: [initialPath]
  });

  return render(
    <AppProviders>
      <RouterProvider router={testRouter} />
    </AppProviders>
  );
}

function mockFetchQueue(responses: MockResponse[]) {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const next = responses.shift();

    calls.push({
      url: readRequestPath(input),
      init
    });

    if (!next) {
      throw new Error(`Unexpected fetch call: ${String(input)}`);
    }

    return new Response(
      next.body === undefined ? null : JSON.stringify(next.body),
      {
        status: next.status,
        statusText: next.statusText,
        headers: {
          "Content-Type": "application/json"
        }
      }
    );
  });

  vi.stubGlobal("fetch", fetchMock);

  return {
    calls,
    fetchMock
  };
}

function readRequestPath(input: RequestInfo | URL) {
  const value = String(input);

  if (!value.startsWith("http")) {
    return value;
  }

  const url = new URL(value);

  return `${url.pathname}${url.search}`;
}

function authHeaders(calls: Array<{ init?: RequestInit }>) {
  return calls.map(({ init }) => {
    const headers = new Headers(init?.headers);

    return headers.get("Authorization");
  });
}

beforeEach(() => {
  window.sessionStorage.clear();
});

afterEach(() => {
  configureApiAuth(null);
  vi.unstubAllGlobals();
  window.sessionStorage.clear();
});

describe("Client Lens authentication foundation", () => {
  it("redirects an unauthenticated user to login without flashing protected content", async () => {
    renderWithRoute(routes.workbench);

    expect(
      screen.queryByRole("heading", { name: "Operational Governance Workbench" })
    ).not.toBeInTheDocument();
    expect(
      await screen.findByRole("heading", { name: "Sign in to Client Lens" })
    ).toBeInTheDocument();
  });

  it("renders the application shell and brand treatment", () => {
    window.sessionStorage.setItem(getRefreshTokenStorageKey(), "refresh-token");
    mockFetchQueue([
      { status: 200, body: { accessToken: "access-token" } },
      { status: 200, body: session }
    ]);

    renderWithRoute(routes.workbench);

    return expect(
      screen.findByRole("img", { name: "Client Lens by OGI Ltd." })
    ).resolves.toHaveAttribute("src", "/brand/client-lens-logo.png");
  });

  it("renders the primary navigation and permission-aware Phase 0 placeholder", async () => {
    window.sessionStorage.setItem(getRefreshTokenStorageKey(), "refresh-token");
    mockFetchQueue([
      { status: 200, body: { accessToken: "access-token" } },
      { status: 200, body: session }
    ]);
    renderWithRoute(routes.workbench);

    expect(
      await screen.findByRole("navigation", { name: "Primary navigation" })
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Workbench" })).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Operational Evidence/i })
    ).toHaveAttribute("aria-disabled", "true");
  });

  it("hides permission-gated navigation when /me lacks permission", async () => {
    window.sessionStorage.setItem(getRefreshTokenStorageKey(), "refresh-token");
    mockFetchQueue([
      { status: 200, body: { accessToken: "access-token" } },
      { status: 200, body: { ...session, permissions: [] } }
    ]);
    renderWithRoute(routes.workbench);

    expect(
      await screen.findByRole("heading", { name: "Operational Governance Workbench" })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /Operational Evidence/i })
    ).not.toBeInTheDocument();
  });

  it("logs in, stores only the refresh token, loads /me, and reaches workbench", async () => {
    const user = userEvent.setup();
    const { calls } = mockFetchQueue([
      {
        status: 200,
        body: {
          accessToken: "login-access-token",
          refreshToken: "login-refresh-token",
          user: {
            id: "user-1",
            email: "operator@example.test",
            fullName: "Operator One",
            status: "ACTIVE"
          }
        }
      },
      { status: 200, body: session }
    ]);

    renderWithRoute(routes.login);

    await user.type(screen.getByLabelText("Email"), "operator@example.test");
    await user.type(screen.getByLabelText("Password"), "correct-password");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(
      await screen.findByRole("heading", { name: "Operational Governance Workbench" })
    ).toBeInTheDocument();
    expect(window.sessionStorage.getItem(getRefreshTokenStorageKey())).toBe(
      "login-refresh-token"
    );
    expect(window.sessionStorage.getItem("accessToken")).toBeNull();
    expect(calls.map(({ url }) => url)).toEqual([
      "/api/v1/auth/login",
      "/api/v1/auth/me"
    ]);
  });

  it("restores a stored refresh token by refreshing and loading /me", async () => {
    window.sessionStorage.setItem(getRefreshTokenStorageKey(), "stored-refresh");
    const { calls } = mockFetchQueue([
      { status: 200, body: { accessToken: "restored-access" } },
      { status: 200, body: session }
    ]);

    renderWithRoute(routes.workbench);

    expect(
      await screen.findByText("Operator One")
    ).toBeInTheDocument();
    expect(calls.map(({ url }) => url)).toEqual([
      "/api/v1/auth/refresh",
      "/api/v1/auth/me"
    ]);
  });

  it("clears a stored refresh token when bootstrap refresh fails", async () => {
    window.sessionStorage.setItem(getRefreshTokenStorageKey(), "expired-refresh");
    mockFetchQueue([{ status: 401, body: { message: "Unauthorized" } }]);

    renderWithRoute(routes.workbench);

    expect(
      await screen.findByRole("heading", { name: "Sign in to Client Lens" })
    ).toBeInTheDocument();
    expect(window.sessionStorage.getItem(getRefreshTokenStorageKey())).toBeNull();
  });

  it("reactively refreshes once on 401 and retries the original request once", async () => {
    window.sessionStorage.setItem(getRefreshTokenStorageKey(), "refresh-token");
    let accessToken: string | null = "expired-access-token";
    const { calls } = mockFetchQueue([
      { status: 401, body: { message: "Expired" } },
      { status: 200, body: { accessToken: "new-access-token" } },
      { status: 200, body: session }
    ]);
    configureApiAuth({
      getAccessToken: () => accessToken,
      refreshAccessToken: async () => {
        const response = await import("../auth/authApi").then((module) =>
          module.refresh({ refreshToken: "refresh-token" })
        );

        accessToken = response.accessToken;
        return response.accessToken;
      },
      onAuthFailure: () => {
        accessToken = null;
        window.sessionStorage.removeItem(getRefreshTokenStorageKey());
      }
    });

    const result = await apiRequest("/api/v1/auth/me", {
      validate: isAuthenticatedSession
    });

    expect(result.email).toBe("operator@example.test");
    expect(calls.map(({ url }) => url)).toEqual([
      "/api/v1/auth/me",
      "/api/v1/auth/refresh",
      "/api/v1/auth/me"
    ]);
    expect(authHeaders(calls)).toEqual([
      "Bearer expired-access-token",
      null,
      "Bearer new-access-token"
    ]);
  });

  it("shares one refresh request across concurrent 401 responses", async () => {
    window.sessionStorage.setItem(getRefreshTokenStorageKey(), "refresh-token");
    let accessToken: string | null = "expired-access-token";
    const { calls } = mockFetchQueue([
      { status: 401, body: { message: "Expired" } },
      { status: 401, body: { message: "Expired" } },
      { status: 200, body: { accessToken: "shared-access-token" } },
      { status: 200, body: session },
      { status: 200, body: session }
    ]);
    configureApiAuth({
      getAccessToken: () => accessToken,
      refreshAccessToken: async () => {
        const response = await import("../auth/authApi").then((module) =>
          module.refresh({ refreshToken: "refresh-token" })
        );

        accessToken = response.accessToken;
        return response.accessToken;
      },
      onAuthFailure: () => {
        accessToken = null;
      }
    });

    const [first, second] = await Promise.all([
      apiRequest("/api/v1/auth/me", { validate: isAuthenticatedSession }),
      apiRequest("/api/v1/auth/me", { validate: isAuthenticatedSession })
    ]);

    expect(first.id).toBe("user-1");
    expect(second.id).toBe("user-1");
    expect(calls.filter(({ url }) => url === "/api/v1/auth/refresh")).toHaveLength(1);
  });

  it("does not refresh on 403", async () => {
    window.sessionStorage.setItem(getRefreshTokenStorageKey(), "refresh-token");
    configureApiAuth({
      getAccessToken: () => "access-token",
      refreshAccessToken: async () => {
        throw new Error("Refresh should not be called for 403.");
      },
      onAuthFailure: () => undefined
    });
    const { calls } = mockFetchQueue([
      {
        status: 403,
        statusText: "Forbidden",
        body: { error: { code: "FORBIDDEN", message: "Forbidden" } }
      }
    ]);

    await expect(
      apiRequest("/api/v1/auth/me", { validate: isAuthenticatedSession })
    ).rejects.toMatchObject({ status: 403 });
    expect(calls.map(({ url }) => url)).toEqual(["/api/v1/auth/me"]);
  });

  it("local logout clears sessionStorage and authenticated state", async () => {
    const user = userEvent.setup();
    window.sessionStorage.setItem(getRefreshTokenStorageKey(), "refresh-token");
    mockFetchQueue([
      { status: 200, body: { accessToken: "access-token" } },
      { status: 200, body: session }
    ]);
    renderWithRoute(routes.workbench);

    await user.click(await screen.findByRole("button", { name: "Log out" }));

    expect(window.sessionStorage.getItem(getRefreshTokenStorageKey())).toBeNull();
    expect(
      await screen.findByRole("heading", { name: "Sign in to Client Lens" })
    ).toBeInTheDocument();
  });

  it("redirects login route when already authenticated", async () => {
    window.sessionStorage.setItem(getRefreshTokenStorageKey(), "refresh-token");
    mockFetchQueue([
      { status: 200, body: { accessToken: "access-token" } },
      { status: 200, body: session }
    ]);

    renderWithRoute(routes.login);

    expect(
      await screen.findByRole("heading", { name: "Operational Governance Workbench" })
    ).toBeInTheDocument();
  });

  it("fails safely when login response is malformed", async () => {
    const user = userEvent.setup();
    mockFetchQueue([{ status: 200, body: { accessToken: "missing-refresh" } }]);

    renderWithRoute(routes.login);

    await user.type(screen.getByLabelText("Email"), "operator@example.test");
    await user.type(screen.getByLabelText("Password"), "correct-password");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(
      await screen.findByText("The server returned an unexpected response.")
    ).toBeInTheDocument();
    expect(window.sessionStorage.getItem(getRefreshTokenStorageKey())).toBeNull();
  });

  it("validates login form input visibly", async () => {
    const user = userEvent.setup();
    renderWithRoute(routes.login);

    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(screen.getByText("Enter your email and password.")).toBeInTheDocument();
  });

  it("keeps unimplemented navigation placeholders on the current route", async () => {
    const user = userEvent.setup();
    window.sessionStorage.setItem(getRefreshTokenStorageKey(), "refresh-token");
    mockFetchQueue([
      { status: 200, body: { accessToken: "access-token" } },
      { status: 200, body: session }
    ]);
    renderWithRoute(routes.workbench);

    await user.click(
      await screen.findByRole("link", { name: /Operational Evidence/i })
    );

    expect(
      screen.getByRole("heading", { name: "Operational Governance Workbench" })
    ).toBeInTheDocument();
  });

  it("renders a safe not-found experience for unknown authenticated routes", async () => {
    window.sessionStorage.setItem(getRefreshTokenStorageKey(), "refresh-token");
    mockFetchQueue([
      { status: 200, body: { accessToken: "access-token" } },
      { status: 200, body: session }
    ]);
    renderWithRoute("/unknown-route");

    expect(
      await screen.findByRole("heading", {
        name: "This workspace page is not available."
      })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: "Client Lens by OGI Ltd." })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Return to workbench" })
    ).toHaveAttribute("href", routes.workbench);
  });
});
