import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { configureApiAuth } from "../api/client";
import { routes } from "../app/routePaths";
import { AuditStartPanel } from "./AuditStartPanel";
import { auditQueryKeys } from "./auditRiskApi";

const auditId = "00000000-0000-4000-8000-000000000101";
const templateId = "00000000-0000-4000-8000-000000000201";
const facilityId = "00000000-0000-4000-8000-000000000301";
const audit = {
  id: auditId,
  business_identifier: "AUDIT-2026-000001",
  audit_status: "IN_PROGRESS",
  started_at: "2026-08-30T01:00:00.000Z",
  completed_at: null,
  completed_by: null,
  template: { id: templateId, name: "Full Safety Audit", type: "FULL_SAFETY_AUDIT", version: 2 },
  facility: { id: facilityId, business_identifier: "FACILITY-2026-000001", name: "North Pool" },
  client: { id: "00000000-0000-4000-8000-000000000401", business_identifier: "CLIENT-2026-000001", name: "North Aquatics" },
  auditor: null
};
const facilities = { facilities: [{ ...audit.facility, operational_status: "ACTIVE", client: audit.client }] };
const templates = [{ ...audit.template, description: "Annual review", is_active: true }];

afterEach(() => {
  configureApiAuth(null);
  vi.unstubAllGlobals();
});

describe("governed Audit start intent", () => {
  it("allows cancellation only before the first submission", async () => {
    mockAuditStartFetch([], () => Promise.resolve(jsonResponse(audit, 201)));
    const onClose = vi.fn();
    renderPanel(createQueryClient(), onClose);
    const form = await readyForm();
    await userEvent.click(within(form).getByRole("button", { name: "Cancel" }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it.each([201, 200])("treats %s as authoritative success, blocks duplicate pending submit, and reconciles caches", async (status) => {
    let resolveStart: ((response: Response) => void) | undefined;
    const requests: CapturedRequest[] = [];
    const queryClient = createQueryClient();
    queryClient.setQueryData(auditQueryKeys.list({}), { audits: [] });
    mockAuditStartFetch(requests, () => new Promise<Response>((resolve) => { resolveStart = resolve; }));
    renderPanel(queryClient);
    const user = userEvent.setup();
    const form = await readyForm();

    await user.selectOptions(within(form).getByRole("combobox", { name: "Eligible Facility" }), facilityId);
    await user.selectOptions(within(form).getByRole("combobox", { name: "Audit template" }), templateId);
    fireEvent.submit(form);
    fireEvent.submit(form);

    expect(await within(form).findByText("Starting Audit…")).toBeInTheDocument();
    expect(within(form).getByRole("combobox", { name: "Eligible Facility" })).toBeDisabled();
    expect(requests.filter((request) => request.path === "/api/v1/audits/start")).toHaveLength(1);

    resolveStart?.(jsonResponse(audit, status));
    expect(await screen.findByText("Audit detail reached")).toBeInTheDocument();
    expect(queryClient.getQueryData(auditQueryKeys.detail(auditId))).toEqual(audit);
    expect(queryClient.getQueryState(auditQueryKeys.list({}))?.isInvalidated).toBe(true);
  });

  it("retains the exact key and command for explicit retry after an ambiguous failure", async () => {
    const requests: CapturedRequest[] = [];
    let startCount = 0;
    mockAuditStartFetch(requests, () => {
      startCount += 1;
      return startCount === 1 ? Promise.reject(new TypeError("network dropped")) : Promise.resolve(jsonResponse(audit, 200));
    });
    renderPanel(createQueryClient());
    const user = userEvent.setup();
    const form = await readyForm();
    await selectCommand(user, form);
    await user.click(within(form).getByRole("button", { name: "Start Audit" }));

    expect(await within(form).findByRole("heading", { name: "The Audit start outcome is uncertain." })).toBeInTheDocument();
    expect(within(form).queryByRole("button", { name: "Cancel" })).not.toBeInTheDocument();
    expect(within(form).getByRole("combobox", { name: "Eligible Facility" })).toBeDisabled();
    await user.click(within(form).getByRole("button", { name: "Retry same command" }));
    expect(await screen.findByText("Audit detail reached")).toBeInTheDocument();

    const starts = requests.filter((request) => request.path === "/api/v1/audits/start");
    expect(starts).toHaveLength(2);
    expect(starts[1]?.key).toBe(starts[0]?.key);
    expect(starts[1]?.body).toEqual(starts[0]?.body);
  });

  it("does not retry a 409 and requires a new key before command edits", async () => {
    const requests: CapturedRequest[] = [];
    mockAuditStartFetch(requests, () => Promise.resolve(errorResponse(409, "sensitive conflict")));
    renderPanel(createQueryClient());
    const user = userEvent.setup();
    const form = await readyForm();
    await selectCommand(user, form);
    await user.click(within(form).getByRole("button", { name: "Start Audit" }));

    expect(await within(form).findByRole("heading", { name: "This Audit intent conflicts with a previously submitted command." })).toBeInTheDocument();
    expect(within(form).queryByText("sensitive conflict")).not.toBeInTheDocument();
    expect(within(form).queryByRole("button", { name: "Retry same command" })).not.toBeInTheDocument();
    await user.click(within(form).getByRole("button", { name: "Start new intent" }));
    expect(within(form).getByRole("combobox", { name: "Eligible Facility" })).toBeEnabled();
    await user.click(within(form).getByRole("button", { name: "Start Audit" }));
    await waitFor(() => expect(requests.filter((request) => request.path === "/api/v1/audits/start")).toHaveLength(2));
    const starts = requests.filter((request) => request.path === "/api/v1/audits/start");
    expect(starts[1]?.key).not.toBe(starts[0]?.key);
  });

  it.each([
    [400, "The Audit command was rejected as invalid."],
    [422, "The Audit command was rejected as invalid."],
    [403, "You are not authorized to start this Audit."],
    [404, "The selected Facility or template is unavailable."]
  ] as const)("maps definitive %s without exposing backend detail", async (status, message) => {
    mockAuditStartFetch([], () => Promise.resolve(errorResponse(status, "sensitive backend detail")));
    renderPanel(createQueryClient());
    const user = userEvent.setup();
    const form = await readyForm();
    await selectCommand(user, form);
    await user.click(within(form).getByRole("button", { name: "Start Audit" }));
    expect(await within(form).findByRole("heading", { name: message })).toBeInTheDocument();
    expect(within(form).queryByText("sensitive backend detail")).not.toBeInTheDocument();
    expect(within(form).getByRole("button", { name: "Start new intent" })).toBeInTheDocument();
  });

  it("retains the frozen attempt after an ambiguous 5xx", async () => {
    mockAuditStartFetch([], () => Promise.resolve(errorResponse(500, "database trace")));
    renderPanel(createQueryClient());
    const user = userEvent.setup();
    const form = await readyForm();
    await selectCommand(user, form);
    await user.click(within(form).getByRole("button", { name: "Start Audit" }));
    expect(await within(form).findByRole("heading", { name: "The Audit start outcome is uncertain." })).toBeInTheDocument();
    expect(within(form).queryByText("database trace")).not.toBeInTheDocument();
    expect(within(form).getByRole("button", { name: "Retry same command" })).toBeInTheDocument();
    expect(within(form).queryByRole("button", { name: "Start new intent" })).not.toBeInTheDocument();
  });

  it("renders human selector labels and blocks submit for empty or failed discovery", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const path = semanticPath(input);
      if (path === "/api/v1/audits/eligible-facilities") return jsonResponse({ facilities: [] });
      if (path === "/api/v1/audit-templates") return errorResponse(403, "sensitive permission detail");
      throw new Error(`Unexpected request: ${path}`);
    }));
    renderPanel(createQueryClient());
    const form = screen.getByRole("form", { name: "Start Audit" });

    expect(await within(form).findByText("No eligible facilities are available.")).toBeInTheDocument();
    expect(await within(form).findByText("You are not authorized to discover audit templates.")).toBeInTheDocument();
    expect(within(form).queryByText("sensitive permission detail")).not.toBeInTheDocument();
    expect(within(form).getByRole("button", { name: "Start Audit" })).toBeDisabled();
  });
});

interface CapturedRequest { path: string; key: string | null; body: unknown }

function mockAuditStartFetch(requests: CapturedRequest[], startResponse: () => Promise<Response>) {
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = semanticPath(input);
    if (path === "/api/v1/audits/eligible-facilities") return jsonResponse(facilities);
    if (path === "/api/v1/audit-templates") return jsonResponse(templates);
    if (path === "/api/v1/audits/start") {
      const headers = new Headers(init?.headers);
      requests.push({ path, key: headers.get("Idempotency-Key"), body: JSON.parse(String(init?.body)) });
      return startResponse();
    }
    throw new Error(`Unexpected request: ${path}`);
  }));
}

async function readyForm() {
  const form = screen.getByRole("form", { name: "Start Audit" });
  expect(await within(form).findByRole("option", { name: /North Pool · FACILITY-2026-000001 · North Aquatics/ })).toBeInTheDocument();
  expect(await within(form).findByRole("option", { name: /Full Safety Audit · Full Safety Audit · v2/ })).toBeInTheDocument();
  return form;
}

async function selectCommand(user: ReturnType<typeof userEvent.setup>, form: HTMLElement) {
  await user.selectOptions(within(form).getByRole("combobox", { name: "Eligible Facility" }), facilityId);
  await user.selectOptions(within(form).getByRole("combobox", { name: "Audit template" }), templateId);
}

function renderPanel(queryClient: QueryClient, onClose = () => undefined) {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[routes.auditRisk]}>
        <Routes>
          <Route path={routes.auditRisk} element={<AuditStartPanel onClose={onClose} />} />
          <Route path={routes.auditDetail} element={<div>Audit detail reached</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

function createQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
}

function semanticPath(input: RequestInfo | URL) {
  const url = new URL(String(input), window.location.origin);
  return `${url.pathname}${url.search}`;
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function errorResponse(status: number, message: string) {
  return new Response(JSON.stringify({ message }), { status, headers: { "Content-Type": "application/json" } });
}
