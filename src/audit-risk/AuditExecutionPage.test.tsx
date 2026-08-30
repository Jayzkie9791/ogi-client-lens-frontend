import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { configureApiAuth } from "../api/client";
import { AppProviders } from "../app/providers/AppProviders";
import { appRoutes } from "../app/router";
import { routes } from "../app/routePaths";
import { getRefreshTokenStorageKey } from "../auth/storage";
import { formatDateTime } from "./auditRiskTypes";

const auditId = "00000000-0000-4000-8000-000000000101";
const templateId = "00000000-0000-4000-8000-000000000201";
const findingId = "00000000-0000-4000-8000-000000000601";
const session = { id: "00000000-0000-4000-8000-000000000001", email: "auditor@example.test", username: null, fullName: "Audit User", status: "ACTIVE", clientId: "00000000-0000-4000-8000-000000000401", facilityScopeMode: "CLIENT_WIDE", facilityIds: [], roles: ["Auditor"], permissions: ["view_audit", "submit_audit_response", "complete_audit", "view_finding"] };

beforeEach(() => {
  window.sessionStorage.clear();
  window.sessionStorage.setItem(getRefreshTokenStorageKey(), "refresh-token");
});

afterEach(() => {
  configureApiAuth(null);
  vi.unstubAllGlobals();
  window.sessionStorage.clear();
});

describe("authoritative Audit execution workspace", () => {
  it("hydrates canonical values, renders every field by authority, and keeps governance distinct", async () => {
    mockRoutes([...authRoutes(), route(executionPath(), execution())]);
    renderExecution();

    expect(await screen.findByRole("heading", { name: "AUDIT-2026-000001" })).toBeInTheDocument();
    const form = screen.getByRole("form", { name: "Operational checks" });
    expect(within(form).getByRole("combobox", { name: "Boolean check (required)" })).toHaveValue("false");
    expect(within(form).getByRole("combobox", { name: "Compliance check" })).toHaveValue("true");
    expect(within(form).getByRole("textbox", { name: "Short note" })).toHaveValue("Persisted note");
    expect(within(form).getByRole("textbox", { name: "Long note" })).toHaveValue("");
    expect(within(form).getByRole("combobox", { name: "Choice (required)" })).toHaveValue("A");
    expect(within(form).getByLabelText("Audit date (required)")).toHaveValue("2026-08-30");
    expect(within(form).getByRole("checkbox", { name: /Acknowledgement/ })).toBeChecked();
    for (const label of ["Derived percentage read-only field", "Risk context read-only field", "Finding workspace read-only field", "Corrective workspace read-only field", "System choice read-only field"]) expect(within(form).getByRole("region", { name: label })).toBeInTheDocument();
    expect(screen.getByText("Current source condition: Passing")).toBeInTheDocument();
    expect(screen.getByText("Governance status: Unresolved")).toBeInTheDocument();
    const accountability = screen.getByLabelText("Operational checks authoritative submission");
    expect(within(accountability).getByText("Persisted Submitter")).toBeInTheDocument();
    expect(within(accountability).getByText(formatDateTime("2026-08-30T03:00:00.000Z"))).toBeInTheDocument();
    expect(within(accountability).queryByText("00000000-0000-4000-8000-000000000901")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "AUDIT-FINDING-2026-000001" })).toHaveAttribute("href", routes.auditFindingDetailPath(findingId));
  });

  it("loads safely through loading, concealed, server, and malformed states", async () => {
    let resolveExecution: (response: Response) => void = () => undefined;
    mockRoutes([...authRoutes(), { url: executionPath(), response: () => new Promise<Response>((resolve) => { resolveExecution = resolve; }) }]);
    renderExecution();
    expect(await screen.findByRole("heading", { name: "Loading Audit execution." })).toBeInTheDocument();
    resolveExecution(jsonResponse(execution()));
    expect(await screen.findByRole("heading", { name: "AUDIT-2026-000001" })).toBeInTheDocument();

    for (const [status, heading] of [[403, "You are not authorized to view Audits."], [404, "Audit unavailable."], [500, "Audit records could not be loaded."]] as const) {
      vi.unstubAllGlobals();
      configureApiAuth(null);
      mockRoutes([...authRoutes(), { url: executionPath(), status, body: { message: "sensitive detail" } }]);
      const view = renderExecution();
      expect(await screen.findByRole("heading", { name: heading })).toBeInTheDocument();
      expect(screen.queryByText("sensitive detail")).not.toBeInTheDocument();
      view.unmount();
    }

    vi.unstubAllGlobals();
    configureApiAuth(null);
    mockRoutes([...authRoutes(), route(executionPath(), { ...execution(), definition: { ...execution().definition, schema: { sections: [] } } })]);
    renderExecution();
    expect(await screen.findByRole("heading", { name: "Audit data could not be safely displayed." })).toBeInTheDocument();
  });

  it("saves explicitly with first-write null, blocks duplicate pending intent, and reconciles the server version", async () => {
    const user = userEvent.setup();
    let resolveSave: (response: Response) => void = () => undefined;
    const requests: { key: string | null; body: Record<string, unknown> }[] = [];
    const savedResult = responseResult(1, { boolean_check: false });
    let executionReads = 0;
    mockRoutes([
      ...authRoutes(), { url: executionPath(), response: () => { executionReads += 1; return Promise.resolve(jsonResponse(execution({ responses: executionReads === 1 ? [] : [savedResult.response] }))); } },
      { method: "POST", url: "/api/v1/audit-responses", response: (_input, init) => {
        requests.push({ key: new Headers(init?.headers).get("Idempotency-Key"), body: JSON.parse(String(init?.body)) as Record<string, unknown> });
        return new Promise<Response>((resolve) => { resolveSave = resolve; });
      } }
    ]);
    renderExecution();
    const form = await screen.findByRole("form", { name: "Operational checks" });
    await user.selectOptions(within(form).getByRole("combobox", { name: "Boolean check (required)" }), "false");
    await user.click(within(form).getByRole("button", { name: "Save Operational checks" }));
    expect(await within(form).findByRole("status")).toHaveTextContent("Saving section");
    await user.click(within(form).getByRole("button", { name: "Save Operational checks" }));
    expect(requests).toHaveLength(1);
    expect(requests[0].body).toMatchObject({ auditId, templateId, sectionCode: "OPERATIONS", expectedVersion: null });
    expect((requests[0].body.responsePayload as Record<string, unknown>).boolean_check).toBe(false);
    resolveSave(jsonResponse(savedResult));
    expect(await screen.findByText("Section OPERATIONS saved authoritatively.")).toBeInTheDocument();
    expect(await screen.findByText("Saved Response Actor")).toBeInTheDocument();
    expect(screen.getByText(formatDateTime(savedResult.response.submitted_at))).toBeInTheDocument();
  });

  it("retains the exact save intent and key for an explicit ambiguous retry", async () => {
    const user = userEvent.setup();
    const requests: { key: string | null; body: string }[] = [];
    let attempts = 0;
    mockRoutes([
      ...authRoutes(), route(executionPath(), execution()),
      { method: "POST", url: "/api/v1/audit-responses", response: (_input, init) => {
        requests.push({ key: new Headers(init?.headers).get("Idempotency-Key"), body: String(init?.body) });
        attempts += 1;
        return Promise.resolve(attempts === 1 ? jsonResponse({ message: "unknown" }, 500) : jsonResponse(responseResult(4, { text_note: "Draft" })));
      } }
    ]);
    renderExecution();
    const form = await screen.findByRole("form", { name: "Operational checks" });
    await user.type(within(form).getByRole("textbox", { name: "Short note" }), "Draft");
    await user.click(within(form).getByRole("button", { name: "Save Operational checks" }));
    expect(screen.queryByText("Saved Response Actor")).not.toBeInTheDocument();
    expect(screen.getByText("Persisted Submitter")).toBeInTheDocument();
    expect(JSON.parse(requests[0].body)).toMatchObject({ auditId, sectionCode: "OPERATIONS", expectedVersion: 3 });
    await user.click(await screen.findByRole("button", { name: "Retry same section save" }));
    expect(requests).toHaveLength(2);
    expect(requests[1]).toEqual(requests[0]);
  });

  it("renders truthful legacy completion accountability on a fresh execution deep link", async () => {
    const historical = execution({ status: "APPROVED" });
    mockRoutes([...authRoutes(), route(executionPath(), { ...historical, audit: { ...historical.audit, completed_by: null } })]);
    renderExecution();
    expect(await screen.findByText("Historical actor unavailable")).toBeInTheDocument();
    expect(screen.getByText(formatDateTime("2026-08-30T04:00:00.000Z"))).toBeInTheDocument();
  });

  it("uses backend completeness and an independent completion intent, then becomes read-only", async () => {
    const user = userEvent.setup();
    const completionKeys: (string | null)[] = [];
    let executionReads = 0;
    mockRoutes([
      ...authRoutes(), { url: executionPath(), response: () => { executionReads += 1; return Promise.resolve(jsonResponse(executionReads === 1 ? execution({ complete: true }) : execution({ complete: true, status: "APPROVED" }))); } },
      { method: "POST", url: `/api/v1/audits/${auditId}/complete`, response: (_input, init) => { completionKeys.push(new Headers(init?.headers).get("Idempotency-Key")); return Promise.resolve(jsonResponse({ audit: { ...audit(), audit_status: "APPROVED", completed_at: "2026-08-30T04:00:00.000Z", completed_by: { id: "00000000-0000-4000-8000-000000000902", name: "Completion Actor" } }, findings: execution().findings, replayed: false })); } }
    ]);
    renderExecution();
    await user.click(await screen.findByRole("button", { name: "Complete Audit" }));
    expect(completionKeys).toHaveLength(1);
    expect(await screen.findByText("This Audit is complete or otherwise read-only.")).toBeInTheDocument();
    expect(screen.getByText("Completion Actor")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Save/ })).not.toBeInTheDocument();
  });

  it("independently removes edit, complete, and Finding-link affordances", async () => {
    mockRoutes([...authRoutes({ ...session, permissions: ["view_audit"] }), route(executionPath(), execution({ complete: true }))]);
    renderExecution();
    expect(await screen.findByRole("heading", { name: "AUDIT-2026-000001" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Save/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Complete Audit" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "AUDIT-FINDING-2026-000001" })).not.toBeInTheDocument();
    expect(screen.queryByText("Completed by")).not.toBeInTheDocument();
    expect(screen.queryByText("Completed at")).not.toBeInTheDocument();
  });
});

interface MockRoute { url: string; method?: string; status?: number; body?: unknown; response?: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>; }
function executionPath() { return `/api/v1/audits/${auditId}/execution`; }
function route(url: string, body: unknown): MockRoute { return { url, body }; }
function authRoutes(authSession = session): MockRoute[] { return [{ method: "POST", url: "/api/v1/auth/refresh", body: { accessToken: "access-token" } }, { url: "/api/v1/auth/me", body: authSession }]; }
function mockRoutes(routesToMock: MockRoute[]) { vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => { const url = new URL(String(input), window.location.origin); const method = init?.method ?? "GET"; const match = routesToMock.find((candidate) => candidate.url === `${url.pathname}${url.search}` && (candidate.method ?? "GET") === method); if (!match) throw new Error(`Unexpected fetch call: ${method} ${url.pathname}${url.search}`); return match.response ? match.response(input, init) : jsonResponse(match.body, match.status ?? 200); })); }
function renderExecution() { const router = createMemoryRouter(appRoutes, { initialEntries: [routes.auditExecutionPath(auditId)] }); return render(<AppProviders><RouterProvider router={router} /></AppProviders>); }
function jsonResponse(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }); }

function audit() { return { id: auditId, business_identifier: "AUDIT-2026-000001", audit_status: "IN_PROGRESS", started_at: "2026-08-30T01:00:00.000Z", completed_at: null, completed_by: null, template: { id: templateId, name: "Full Safety Audit", type: "FULL_SAFETY_AUDIT", version: 2 }, facility: { id: "00000000-0000-4000-8000-000000000301", business_identifier: "FACILITY-2026-000001", name: "North Pool" }, client: { id: "00000000-0000-4000-8000-000000000401", business_identifier: "CLIENT-2026-000001", name: "North Aquatics" }, auditor: null }; }
function execution(overrides: { responses?: readonly unknown[]; complete?: boolean; status?: "IN_PROGRESS" | "APPROVED" } = {}) {
  const baseAudit = audit();
  const status = overrides.status ?? "IN_PROGRESS";
  return {
    audit: { ...baseAudit, audit_status: status, completed_at: status === "APPROVED" ? "2026-08-30T04:00:00.000Z" : null, completed_by: status === "APPROVED" ? { id: "00000000-0000-4000-8000-000000000902", name: "Completion Actor" } : null },
    definition: { template_id: templateId, version: 2, checksum: "a".repeat(64), schema: { sections: [{ section_code: "OPERATIONS", title: "Operational checks", fields: [
      { field_id: "boolean_check", label: "Boolean check", type: "boolean", required: true, source_required: true, edit_authority: "USER_RESPONSE", response_kind: "BOOLEAN" },
      { field_id: "compliance", label: "Compliance check", type: "compliance_check", required: false, source_required: false, edit_authority: "USER_RESPONSE", response_kind: "BOOLEAN" },
      { field_id: "text_note", label: "Short note", type: "text", required: false, source_required: false, edit_authority: "USER_RESPONSE", response_kind: "TEXT" },
      { field_id: "long_note", label: "Long note", type: "textarea", required: false, source_required: false, edit_authority: "USER_RESPONSE", response_kind: "TEXT" },
      { field_id: "choice", label: "Choice", type: "select", required: true, source_required: true, edit_authority: "USER_RESPONSE", response_kind: "SELECT", options: ["A", "B"] },
      { field_id: "date", label: "Audit date", type: "date", required: true, source_required: true, edit_authority: "USER_RESPONSE", response_kind: "DATE" },
      { field_id: "signature", label: "Acknowledgement", type: "signature", required: true, source_required: true, edit_authority: "USER_RESPONSE", response_kind: "ACKNOWLEDGEMENT_TRUE" },
      { field_id: "percentage", label: "Derived percentage", type: "percentage", required: false, source_required: false, edit_authority: "SYSTEM_READ_ONLY", response_kind: "NONE", system_generated: true },
      { field_id: "risk", label: "Risk context", type: "risk_matrix", required: false, source_required: true, edit_authority: "SYSTEM_READ_ONLY", response_kind: "NONE", risk_categories: ["Operational"], supports_justification: true },
      { field_id: "findings", label: "Finding workspace", type: "findings_workspace", required: false, source_required: false, edit_authority: "SYSTEM_READ_ONLY", response_kind: "NONE", severity: "HIGH" },
      { field_id: "actions", label: "Corrective workspace", type: "corrective_action_workspace", required: false, source_required: false, edit_authority: "SYSTEM_READ_ONLY", response_kind: "NONE", columns: ["Priority"] },
      { field_id: "system_choice", label: "System choice", type: "select", required: false, source_required: false, edit_authority: "SYSTEM_READ_ONLY", response_kind: "NONE", options: ["A"], system_generated: true }
    ] }] } },
    responses: overrides.responses ?? [canonicalResponse(3, { boolean_check: false, compliance: true, text_note: "Persisted note", choice: "A", date: "2026-08-30", signature: true })],
    findings: [{ id: findingId, business_identifier: "AUDIT-FINDING-2026-000001", is_resolved: false, source_section_code: "OPERATIONS", source_field_id: "boolean_check", source_condition: "PASSING" }],
    completeness: overrides.complete ? { is_complete: true, incomplete: [] } : { is_complete: false, incomplete: [{ section_code: "OPERATIONS", field_id: "long_note" }] },
    completion_eligible: Boolean(overrides.complete && status === "IN_PROGRESS"), legacy_history_excluded: true
  };
}
function canonicalResponse(version: number, payload: Record<string, unknown>) { return { id: "00000000-0000-4000-8000-000000000801", audit_id: auditId, template_id: templateId, section_code: "OPERATIONS", response_payload: payload, version, checksum: "b".repeat(64), submitted_by: { id: "00000000-0000-4000-8000-000000000901", name: "Persisted Submitter" }, submitted_at: "2026-08-30T03:00:00.000Z" }; }
function responseResult(version: number, payload: Record<string, unknown>) { return { response: { ...canonicalResponse(version, payload), submitted_by: { id: "00000000-0000-4000-8000-000000000903", name: "Saved Response Actor" } }, completeness: { is_complete: false, incomplete: [{ section_code: "OPERATIONS", field_id: "choice" }] } }; }
