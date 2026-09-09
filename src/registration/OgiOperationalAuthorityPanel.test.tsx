import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { OgiOperationalAuthorityPanel } from "./OgiOperationalAuthorityPanel";

const personnelId = "00000000-0000-4000-8000-000000300077";
const clientId = "00000000-0000-4000-8000-000000100001";

afterEach(() => vi.unstubAllGlobals());

describe("OGI Personnel operational authority", () => {
  it("grants an exact client-wide scope through the governed idempotent API", async () => {
    const user = userEvent.setup();
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const rawUrl = String(input);
      const url = rawUrl.startsWith("http") ? new URL(rawUrl).pathname : rawUrl;
      calls.push({ url, init });
      if (url === `/api/v1/registration/personnel/${personnelId}/operational-authorizations` && (init?.method ?? "GET") === "GET") return response({ authorizations: [] });
      if (url === "/api/v1/registration/clients") return response({ clients: [{ id: clientId, organization_name: "Aurelia Grand", contact_email: null, contact_phone: null, status: "ACTIVE", address: null, country: null, notes: null, created_at: "2026-01-01T00:00:00.000Z", updated_at: "2026-01-01T00:00:00.000Z", deleted_at: null }] });
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
});

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}
