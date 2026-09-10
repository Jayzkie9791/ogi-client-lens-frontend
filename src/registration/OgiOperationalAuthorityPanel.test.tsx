import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { OgiOperationalAuthorityPanel } from "./OgiOperationalAuthorityPanel";

const personnelId = "00000000-0000-4000-8000-000000300077";
const clientId = "00000000-0000-4000-8000-000000100001";
const facilityId = "00000000-0000-4000-8000-000000200001";

afterEach(() => vi.unstubAllGlobals());

describe("OGI Personnel operational authority", () => {
  it("fails closed with explicit guidance when required grant inputs are missing", async () => {
    const user = userEvent.setup();
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      calls.push({ url, init });
      if (url.includes("/operational-authorizations")) return response({ authorizations: [] });
      if (url.includes("/registration/clients")) return response({ clients: [] });
      if (url.includes("/registration/facilities")) return response({ facilities: [] });
      throw new Error(`Unexpected request: ${init?.method ?? "GET"} ${url}`);
    }));
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={queryClient}><OgiOperationalAuthorityPanel canManage personnelId={personnelId} /></QueryClientProvider>);

    const form = await screen.findByRole("form", { name: "Grant OGI operational scope" });
    await user.click(within(form).getByRole("button", { name: "Grant operational scope" }));

    expect(within(form).getByRole("alert")).toHaveTextContent("Complete the required fields: Client, Valid from, Business reason.");
    expect(calls.some((call) => call.init?.method === "POST")).toBe(false);
  });

  it("grants an exact client-wide scope through the governed idempotent API", async () => {
    const user = userEvent.setup();
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const rawUrl = String(input);
      const url = rawUrl.startsWith("http") ? new URL(rawUrl).pathname : rawUrl;
      calls.push({ url, init });
      if (url === `/api/v1/registration/personnel/${personnelId}/operational-authorizations` && (init?.method ?? "GET") === "GET") return response({ authorizations: [] });
      if (url === "/api/v1/registration/clients") return response({ clients: [{ id: clientId, organization_name: "Aurelia Grand", contact_email: null, contact_phone: null, status: "ACTIVE", address: null, country: null, notes: null, created_at: "2026-01-01T00:00:00.000Z", updated_at: "2026-01-01T00:00:00.000Z", deleted_at: null }] });
      if (url === "/api/v1/registration/facilities") return response({ facilities: [] });
      if (url === `/api/v1/registration/personnel/${personnelId}/operational-authorizations` && init?.method === "POST") return response({ authorization: { id: "00000000-0000-4000-8000-000000400001", personnel_id: personnelId, client_id: clientId, scope_mode: "CLIENT_WIDE", status: "ACTIVE", valid_from: "2026-10-01T00:00:00.000Z", valid_until: null, reason: "Training delivery", facility_grants: [], lifecycle_events: [] }, replayed: false }, 201);
      throw new Error(`Unexpected request: ${init?.method ?? "GET"} ${url}`);
    }));
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={queryClient}><OgiOperationalAuthorityPanel canManage personnelId={personnelId} /></QueryClientProvider>);

    const form = await screen.findByRole("form", { name: "Grant OGI operational scope" });
    await within(form).findByRole("option", { name: "Aurelia Grand" });
    await user.selectOptions(within(form).getByLabelText("Client"), clientId);
    await user.type(within(form).getByLabelText("Valid from"), "2026-10-01T08:00");
    await user.type(within(form).getByLabelText("Business reason"), "Training delivery");
    await user.click(within(form).getByRole("button", { name: "Grant operational scope" }));

    const call = calls.find((candidate) => candidate.init?.method === "POST");
    const body = JSON.parse(String(call?.init?.body)) as Record<string, unknown>;
    expect(body).toMatchObject({ client_id: clientId, scope_mode: "CLIENT_WIDE", facility_ids: [], valid_until: null, reason: "Training delivery" });
    expect(Number.isNaN(Date.parse(String(body.valid_from)))).toBe(false);
    expect(new Headers(call?.init?.headers).get("idempotency-key")).toEqual(expect.any(String));
  });

  it("selects an explicit Facility without retaining the React change event", async () => {
    const user = userEvent.setup();
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const rawUrl = String(input);
      const url = rawUrl.startsWith("http") ? `${new URL(rawUrl).pathname}${new URL(rawUrl).search}` : rawUrl;
      calls.push({ url, init });
      if (url === `/api/v1/registration/personnel/${personnelId}/operational-authorizations` && (init?.method ?? "GET") === "GET") return response({ authorizations: [] });
      if (url === "/api/v1/registration/clients") return response({ clients: [{ id: clientId, organization_name: "Sky Is The Limit", contact_email: null, contact_phone: null, status: "ACTIVE", address: null, country: null, notes: null, created_at: "2026-01-01T00:00:00.000Z", updated_at: "2026-01-01T00:00:00.000Z", deleted_at: null }] });
      if (url === `/api/v1/registration/facilities?clientId=${clientId}`) return response({ facilities: [{ id: facilityId, business_identifier: "FACILITY-2026-000001", client_id: clientId, facility_name: "Sky Ranch", facility_type: "TRAINING_CENTER", operational_status: "ACTIVE", address: null, country: null, timezone: "Asia/Manila", notes: null, created_at: "2026-01-01T00:00:00.000Z", updated_at: "2026-01-01T00:00:00.000Z", deleted_at: null }] });
      if (url === "/api/v1/registration/facilities") return response({ facilities: [{ id: facilityId, business_identifier: "FACILITY-2026-000001", client_id: clientId, facility_name: "Sky Ranch", facility_type: "TRAINING_CENTER", operational_status: "ACTIVE", address: null, country: null, timezone: "Asia/Manila", notes: null, created_at: "2026-01-01T00:00:00.000Z", updated_at: "2026-01-01T00:00:00.000Z", deleted_at: null }] });
      if (url === `/api/v1/registration/personnel/${personnelId}/operational-authorizations` && init?.method === "POST") return response({ authorization: { id: "00000000-0000-4000-8000-000000400002", personnel_id: personnelId, client_id: clientId, scope_mode: "EXPLICIT_FACILITIES", status: "ACTIVE", valid_from: "2026-10-01T00:00:00.000Z", valid_until: null, reason: "Sky Ranch delivery", facility_grants: [{ facility_id: facilityId }], lifecycle_events: [] }, replayed: false }, 201);
      throw new Error(`Unexpected request: ${init?.method ?? "GET"} ${url}`);
    }));
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={queryClient}><OgiOperationalAuthorityPanel canManage personnelId={personnelId} /></QueryClientProvider>);

    const form = await screen.findByRole("form", { name: "Grant OGI operational scope" });
    await within(form).findByRole("option", { name: "Sky Is The Limit" });
    await user.selectOptions(within(form).getByLabelText("Client"), clientId);
    await user.click(within(form).getByRole("radio", { name: "Selected Facilities" }));
    const facility = await within(form).findByRole("checkbox", { name: "Sky Ranch" });
    await user.click(facility);
    expect(facility).toBeChecked();
    await user.type(within(form).getByLabelText("Valid from"), "2026-10-01T08:00");
    await user.type(within(form).getByLabelText("Business reason"), "Sky Ranch delivery");
    await user.click(within(form).getByRole("button", { name: "Grant operational scope" }));

    const call = calls.find((candidate) => candidate.init?.method === "POST");
    expect(JSON.parse(String(call?.init?.body))).toMatchObject({
      client_id: clientId,
      scope_mode: "EXPLICIT_FACILITIES",
      facility_ids: [facilityId]
    });
    await waitFor(() => {
      expect(within(form).getByRole("radio", { name: "All facilities for selected Client" })).toBeChecked();
    });
    expect(within(form).queryByRole("checkbox", { name: "Sky Ranch" })).not.toBeInTheDocument();
  });
});

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}
