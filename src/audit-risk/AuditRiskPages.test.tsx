import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { configureApiAuth } from "../api/client";
import { AppProviders } from "../app/providers/AppProviders";
import { appRoutes } from "../app/router";
import { routes } from "../app/routePaths";
import { getRefreshTokenStorageKey } from "../auth/storage";

const auditId = "00000000-0000-4000-8000-000000000101";
const session = {
  id: "00000000-0000-4000-8000-000000000001",
  email: "viewer@example.test",
  username: null,
  fullName: "Audit Viewer",
  status: "ACTIVE",
  clientId: "00000000-0000-4000-8000-000000000401",
  facilityScopeMode: "CLIENT_WIDE",
  facilityIds: [],
  roles: ["Audit Viewer"],
  permissions: ["view_audit"]
};
const audit = {
  id: auditId,
  business_identifier: "AUDIT-2026-000001",
  audit_status: "IN_PROGRESS",
  started_at: "2026-08-30T01:00:00.000Z",
  completed_at: null,
  template: { id: "00000000-0000-4000-8000-000000000201", name: "Full Safety Audit", type: "FULL_SAFETY_AUDIT", version: 2 },
  facility: { id: "00000000-0000-4000-8000-000000000301", business_identifier: "FACILITY-2026-000001", name: "North Pool" },
  client: { id: "00000000-0000-4000-8000-000000000401", business_identifier: "CLIENT-2026-000001", name: "North Aquatics" },
  auditor: null
};

beforeEach(() => {
  window.sessionStorage.clear();
  window.sessionStorage.setItem(getRefreshTokenStorageKey(), "refresh-token");
});

afterEach(() => {
  configureApiAuth(null);
  vi.unstubAllGlobals();
  window.sessionStorage.clear();
});

describe("Audit workspace read paths", () => {
  it("renders scoped Audit context and uses only the status filter for a view-only actor", async () => {
    const user = userEvent.setup();
    const { calls } = mockRoutes([
      ...authRoutes(),
      route("/api/v1/audits", { audits: [audit] }),
      route("/api/v1/audits?status=APPROVED", { audits: [] })
    ]);
    renderRoute(routes.auditRisk);

    const list = await screen.findByRole("list", { name: "Scoped Audits" });
    expect(within(list).getByRole("link", { name: "AUDIT-2026-000001" })).toHaveAttribute("href", routes.auditDetailPath(auditId));
    expect(within(list).getByText("North Pool · North Aquatics")).toBeInTheDocument();
    expect(within(list).getByText(/Full Safety Audit · Full Safety Audit · v2/)).toBeInTheDocument();

    await user.selectOptions(screen.getByRole("combobox", { name: "Audit status" }), "APPROVED");
    expect(await screen.findByRole("heading", { name: "No Audits are available." })).toBeInTheDocument();
    expect(calls).toContain("/api/v1/audits?status=APPROVED");
    expect(calls.some((path) => path.includes("audit-templates") || path.includes("eligible-facilities"))).toBe(false);
    expect(screen.queryByRole("button", { name: "Start Audit" })).not.toBeInTheDocument();
  });

  it("opens governed selectors only for an actor with view_audit and create_audit", async () => {
    const user = userEvent.setup();
    const mutationSession = { ...session, permissions: ["view_audit", "create_audit"] };
    const { calls } = mockRoutes([
      ...authRoutes(mutationSession),
      route("/api/v1/audits", { audits: [] }),
      route("/api/v1/audits/eligible-facilities", { facilities: [{ ...audit.facility, operational_status: "ACTIVE", client: audit.client }] }),
      route("/api/v1/audit-templates", [{ ...audit.template, description: null, is_active: true }])
    ]);
    renderRoute(routes.auditRisk);

    const startButton = await screen.findByRole("button", { name: "Start Audit" });
    expect(calls).not.toContain("/api/v1/audits/eligible-facilities");
    expect(calls).not.toContain("/api/v1/audit-templates");
    await user.click(startButton);
    const form = await screen.findByRole("form", { name: "Start Audit" });
    expect(await within(form).findByRole("option", { name: /North Pool · FACILITY-2026-000001 · North Aquatics/ })).toBeInTheDocument();
    expect(calls).toContain("/api/v1/audits/eligible-facilities");
    expect(calls).toContain("/api/v1/audit-templates");
  });

  it("shows the loading and empty states safely", async () => {
    let resolveAudits: ((response: Response) => void) | undefined;
    mockRoutes([
      ...authRoutes(),
      { url: "/api/v1/audits", response: () => new Promise<Response>((resolve) => { resolveAudits = resolve; }) }
    ]);
    renderRoute(routes.auditRisk);
    expect(await screen.findByRole("heading", { name: "Loading Audits." })).toBeInTheDocument();
    resolveAudits?.(jsonResponse({ audits: [] }));
    expect(await screen.findByRole("heading", { name: "No Audits are available." })).toBeInTheDocument();
  });

  it("shows a safe list failure with a retry affordance", async () => {
    const { calls } = mockRoutes([...authRoutes(), { url: "/api/v1/audits", status: 500, body: { message: "database detail" } }]);
    renderRoute(routes.auditRisk);
    expect(await screen.findByRole("heading", { name: "Audit records could not be loaded." })).toBeInTheDocument();
    expect(screen.queryByText("database detail")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(calls.filter((path) => path === "/api/v1/audits")).toHaveLength(2);
  });

  it("loads UUID detail independently on a direct deep link and renders nullable context", async () => {
    const { calls } = mockRoutes([...authRoutes(), route(`/api/v1/audits/${auditId}`, audit)]);
    renderRoute(routes.auditDetailPath(auditId));

    expect(await screen.findByRole("heading", { name: "AUDIT-2026-000001" })).toBeInTheDocument();
    expect(screen.getByText("North Aquatics · CLIENT-2026-000001")).toBeInTheDocument();
    expect(screen.getByText("North Pool · FACILITY-2026-000001")).toBeInTheDocument();
    expect(screen.getByText("Not assigned")).toBeInTheDocument();
    expect(screen.getByText("Not completed")).toBeInTheDocument();
    expect(calls).not.toContain("/api/v1/audits");
    expect(calls).toContain(`/api/v1/audits/${auditId}`);
  });

  it.each([
    [403, "You are not authorized to view Audits."],
    [404, "Audit unavailable."]
  ] as const)("renders a safe %s detail state", async (status, heading) => {
    mockRoutes([...authRoutes(), { url: `/api/v1/audits/${auditId}`, status, body: { message: "sensitive backend detail" } }]);
    renderRoute(routes.auditDetailPath(auditId));
    expect(await screen.findByRole("heading", { name: heading })).toBeInTheDocument();
    expect(screen.queryByText("sensitive backend detail")).not.toBeInTheDocument();
  });

  it("fails closed on malformed Audit detail", async () => {
    mockRoutes([...authRoutes(), route(`/api/v1/audits/${auditId}`, { ...audit, client: null })]);
    renderRoute(routes.auditDetailPath(auditId));
    expect(await screen.findByRole("heading", { name: "Audit data could not be safely displayed." })).toBeInTheDocument();
    expect(screen.queryByText("North Pool")).not.toBeInTheDocument();
  });

  it("does not fetch Audit data without view_audit", async () => {
    const { calls } = mockRoutes(authRoutes({ ...session, permissions: ["create_audit"] }));
    renderRoute(routes.auditRisk);
    expect(await screen.findByRole("heading", { name: "You are not authorized to view Audits." })).toBeInTheDocument();
    expect(calls).toEqual(["/api/v1/auth/refresh", "/api/v1/auth/me"]);
  });
});

interface MockRoute { url: string; method?: string; status?: number; body?: unknown; response?: () => Promise<Response> }

function route(url: string, body: unknown): MockRoute { return { url, body }; }

function authRoutes(authSession = session): MockRoute[] {
  return [
    { method: "POST", url: "/api/v1/auth/refresh", body: { accessToken: "access-token" } },
    { url: "/api/v1/auth/me", body: authSession }
  ];
}

function mockRoutes(routesToMock: MockRoute[]) {
  const calls: string[] = [];
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = semanticPath(input);
    const method = init?.method ?? "GET";
    calls.push(url);
    const match = routesToMock.find((candidate) => candidate.url === url && (candidate.method ?? "GET") === method);
    if (!match) throw new Error(`Unexpected fetch call: ${method} ${url}`);
    if (match.response) return match.response();
    return jsonResponse(match.body, match.status ?? 200);
  }));
  return { calls };
}

function renderRoute(initialPath: string) {
  const router = createMemoryRouter(appRoutes, { initialEntries: [initialPath] });
  return render(<AppProviders><RouterProvider router={router} /></AppProviders>);
}

function semanticPath(input: RequestInfo | URL) {
  const value = String(input);
  if (!value.startsWith("http")) return value;
  const url = new URL(value);
  return `${url.pathname}${url.search}`;
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}
