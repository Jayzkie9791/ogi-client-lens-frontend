import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { configureApiAuth } from "../api/client";
import { AppProviders } from "../app/providers/AppProviders";
import { appRoutes } from "../app/router";
import { routes } from "../app/routePaths";
import { getRefreshTokenStorageKey } from "../auth/storage";

const findingId = "00000000-0000-4000-8000-000000000601";
const auditId = "00000000-0000-4000-8000-000000000101";
const session = {
  id: "00000000-0000-4000-8000-000000000001", email: "viewer@example.test", username: null,
  fullName: "Finding Viewer", status: "ACTIVE", clientId: "00000000-0000-4000-8000-000000000401",
  facilityScopeMode: "CLIENT_WIDE", facilityIds: [], roles: ["Finding Viewer"], permissions: ["view_finding"]
};
const finding = {
  id: findingId, business_identifier: "AUDIT-FINDING-2026-000001",
  audit: { id: auditId, business_identifier: "AUDIT-2026-000001" },
  facility: { id: "00000000-0000-4000-8000-000000000301", business_identifier: "FACILITY-2026-000001", name: "North Pool" },
  client: { id: "00000000-0000-4000-8000-000000000401", business_identifier: "CLIENT-2026-000001", name: "North Aquatics" },
  category: "OPERATIONS", severity: "HIGH", title: "Missing inspection record",
  description: "The current inspection record was unavailable.", recommendation: null, is_resolved: false,
  identified_at: "2026-08-30T02:00:00.000Z", resolved_at: null,
  remediation: [{ id: "00000000-0000-4000-8000-000000000701", business_identifier: "CA-2026-000001", status: "OPEN" }]
};

beforeEach(() => {
  window.sessionStorage.clear();
  window.sessionStorage.setItem(getRefreshTokenStorageKey(), "refresh-token");
});
afterEach(() => { configureApiAuth(null); vi.unstubAllGlobals(); window.sessionStorage.clear(); });

describe("Audit Finding read workspace", () => {
  it("renders deterministic loading and empty list states", async () => {
    const findingsResponse = deferredResponse();
    const { calls } = mockRoutesWithResponse([
      ...authRoutes(),
      { url: "/api/v1/audit-findings", response: () => findingsResponse.promise }
    ]);
    renderRoute(routes.auditFindings);
    expect(await screen.findByRole("heading", { name: "Loading Audit Findings." })).toBeInTheDocument();
    await waitFor(() => expect(calls).toContain("/api/v1/audit-findings"));
    findingsResponse.resolve(jsonResponse({ findings: [] }));
    expect(await screen.findByRole("heading", { name: "No Audit Findings are available." })).toBeInTheDocument();
  });

  it("gives a view_finding-only actor an independent list without an Audit cross-link", async () => {
    const { calls } = mockRoutes([...authRoutes(), route("/api/v1/audit-findings", { findings: [finding] })]);
    renderRoute(routes.auditFindings);

    const list = await screen.findByRole("list", { name: "Scoped Audit Findings" });
    expect(within(list).getByRole("link", { name: finding.business_identifier })).toHaveAttribute("href", routes.auditFindingDetailPath(findingId));
    expect(within(list).getByText(finding.audit.business_identifier)).not.toHaveRole("link");
    expect(screen.queryByRole("link", { name: "Audits" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Findings" })).toBeInTheDocument();
    expect(calls.some((path) => path.startsWith("/api/v1/audits"))).toBe(false);
  });

  it("applies only severity and resolution filters with semantic URLs", async () => {
    const user = userEvent.setup();
    const { calls } = mockRoutes([
      ...authRoutes(), route("/api/v1/audit-findings", { findings: [finding] }),
      route("/api/v1/audit-findings?severity=HIGH", { findings: [finding] }),
      route("/api/v1/audit-findings?severity=HIGH&resolved=false", { findings: [] })
    ]);
    renderRoute(routes.auditFindings);
    await screen.findByRole("list", { name: "Scoped Audit Findings" });
    await user.selectOptions(screen.getByRole("combobox", { name: "Severity" }), "HIGH");
    await user.selectOptions(screen.getByRole("combobox", { name: "Resolution" }), "false");
    expect(await screen.findByRole("heading", { name: "No Audit Findings are available." })).toBeInTheDocument();
    expect(calls).toContain("/api/v1/audit-findings?severity=HIGH&resolved=false");
  });

  it("loads UUID detail independently and keeps remediation reference-only", async () => {
    const { calls } = mockRoutes([...authRoutes(), route(`/api/v1/audit-findings/${findingId}`, finding)]);
    renderRoute(routes.auditFindingDetailPath(findingId));
    expect(await screen.findByRole("heading", { name: finding.business_identifier })).toBeInTheDocument();
    expect(screen.getByText("North Aquatics · CLIENT-2026-000001")).toBeInTheDocument();
    expect(screen.getByText("No recommendation recorded")).toBeInTheDocument();
    const remediation = screen.getByRole("list", { name: "Read-only remediation relationships" });
    expect(within(remediation).getByText("CA-2026-000001")).toBeInTheDocument();
    expect(within(remediation).queryByRole("link")).not.toBeInTheDocument();
    expect(within(remediation).queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getByText(finding.audit.business_identifier)).not.toHaveRole("link");
    expect(calls).toEqual(["/api/v1/auth/refresh", "/api/v1/auth/me", `/api/v1/audit-findings/${findingId}`]);
  });

  it("permission-composes the parent Audit cross-link independently", async () => {
    mockRoutes([...authRoutes({ ...session, permissions: ["view_finding", "view_audit"] }), route(`/api/v1/audit-findings/${findingId}`, finding)]);
    renderRoute(routes.auditFindingDetailPath(findingId));
    expect(await screen.findByRole("link", { name: finding.audit.business_identifier })).toHaveAttribute("href", routes.auditDetailPath(auditId));
  });

  it.each([[403, "You are not authorized to view Audit Findings."], [404, "Audit Finding unavailable."], [500, "Audit Findings could not be loaded."]] as const)("renders a safe %s detail state", async (status, heading) => {
    mockRoutes([...authRoutes(), { url: `/api/v1/audit-findings/${findingId}`, status, body: { message: "sensitive detail" } }]);
    renderRoute(routes.auditFindingDetailPath(findingId));
    expect(await screen.findByRole("heading", { name: heading })).toBeInTheDocument();
    expect(screen.queryByText("sensitive detail")).not.toBeInTheDocument();
  });

  it("fails closed on malformed detail", async () => {
    mockRoutes([...authRoutes(), route(`/api/v1/audit-findings/${findingId}`, { ...finding, facility: null })]);
    renderRoute(routes.auditFindingDetailPath(findingId));
    expect(await screen.findByRole("heading", { name: "Finding data could not be safely displayed." })).toBeInTheDocument();
    expect(screen.queryByText("North Aquatics")).not.toBeInTheDocument();
  });

  it("does not fetch Findings for a view_audit-only actor", async () => {
    const { calls } = mockRoutes(authRoutes({ ...session, permissions: ["view_audit"] }));
    renderRoute(routes.auditFindings);
    expect(await screen.findByRole("heading", { name: "You are not authorized to view Audit Findings." })).toBeInTheDocument();
    expect(calls).toEqual(["/api/v1/auth/refresh", "/api/v1/auth/me"]);
  });
});

interface MockRoute { url: string; method?: string; status?: number; body?: unknown }
interface DeferredMockRoute extends MockRoute { response?: () => Promise<Response> }
function route(url: string, body: unknown): MockRoute { return { url, body }; }
function authRoutes(authSession = session): MockRoute[] { return [{ method: "POST", url: "/api/v1/auth/refresh", body: { accessToken: "access-token" } }, { url: "/api/v1/auth/me", body: authSession }]; }
function mockRoutes(routesToMock: MockRoute[]) {
  const calls: string[] = [];
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = semanticPath(input); const method = init?.method ?? "GET"; calls.push(url);
    const match = routesToMock.find((candidate) => candidate.url === url && (candidate.method ?? "GET") === method);
    if (!match) throw new Error(`Unexpected fetch call: ${method} ${url}`);
    return jsonResponse(match.body, match.status ?? 200);
  }));
  return { calls };
}
function mockRoutesWithResponse(routesToMock: DeferredMockRoute[]) {
  const calls: string[] = [];
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = semanticPath(input); const method = init?.method ?? "GET";
    calls.push(url);
    const match = routesToMock.find((candidate) => candidate.url === url && (candidate.method ?? "GET") === method);
    if (!match) throw new Error(`Unexpected fetch call: ${method} ${url}`);
    return match.response ? match.response() : jsonResponse(match.body, match.status ?? 200);
  }));
  return { calls };
}
function deferredResponse() {
  const control: { resolve?: (response: Response) => void } = {};
  const promise = new Promise<Response>((resolve) => { control.resolve = resolve; });
  if (!control.resolve) throw new Error("Deferred response was not initialized.");
  return { promise, resolve: control.resolve };
}
function renderRoute(initialPath: string) { const router = createMemoryRouter(appRoutes, { initialEntries: [initialPath] }); return render(<AppProviders><RouterProvider router={router} /></AppProviders>); }
function semanticPath(input: RequestInfo | URL) { const value = String(input); if (!value.startsWith("http")) return value; const url = new URL(value); return `${url.pathname}${url.search}`; }
function jsonResponse(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }); }
