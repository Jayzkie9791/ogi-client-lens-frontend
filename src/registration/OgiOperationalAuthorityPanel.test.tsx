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
  it("shows a diagnostic service message and does not misreport an empty history", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/operational-authorizations")) return response({ code: "INTERNAL_ERROR", message: "Database query failed." }, 500);
      if (url.includes("/feature-discovery/ogi-personnel-operational-authority/clients")) return response({ clients: [] });
      if (url.includes("/feature-discovery/ogi-personnel-operational-authority/facilities")) return response({ facilities: [] });
      throw new Error(`Unexpected request: ${url}`);
    }));
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={queryClient}><OgiOperationalAuthorityPanel canManage personnelId={personnelId} /></QueryClientProvider>);

    expect(await screen.findByRole("alert")).toHaveTextContent("authorization service or database is not ready");
    expect(screen.queryByText("No operational scope has been granted.")).not.toBeInTheDocument();
  });

  it("surfaces a governed grant conflict instead of replacing it with generic advice", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const rawUrl = String(input);
      const url = rawUrl.startsWith("http") ? new URL(rawUrl).pathname : rawUrl;
      if (url === `/api/v1/registration/personnel/${personnelId}/operational-authorizations` && (init?.method ?? "GET") === "GET") return response({ authorizations: [] });
      if (url === "/api/v1/feature-discovery/ogi-personnel-operational-authority/clients") return response({ clients: [{ id: clientId, organization_name: "Aurelia Grand", contact_email: null, contact_phone: null, status: "ACTIVE", address: null, country: null, notes: null, created_at: "2026-01-01T00:00:00.000Z", updated_at: "2026-01-01T00:00:00.000Z", deleted_at: null }] });
      if (url === "/api/v1/feature-discovery/ogi-personnel-operational-authority/facilities") return response({ facilities: [] });
      if (url === `/api/v1/registration/personnel/${personnelId}/operational-authorizations` && init?.method === "POST") return response({ code: "REGISTRATION_PERSONNEL_OPERATIONAL_AUTHORITY_CONFLICT", message: "An active operational authorization already exists for this Personnel and Client." }, 409);
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

    expect(await within(form).findByRole("alert")).toHaveTextContent("An active operational authorization already exists");
  });

  it("uses readable missing-name fallbacks and confines exact scope identifiers to technical details", async () => {
    const authorizationId = "00000000-0000-4000-8000-000000400099";
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const rawUrl = String(input);
      const url = rawUrl.startsWith("http") ? new URL(rawUrl).pathname : rawUrl;
      if (url === `/api/v1/registration/personnel/${personnelId}/operational-authorizations`) return response({authorizations:[{
        id:authorizationId,personnel_id:personnelId,client_id:clientId,scope_mode:"EXPLICIT_FACILITIES",status:"ACTIVE",
        valid_from:"2026-10-01T00:00:00.000Z",valid_until:null,reason:"Training delivery",
        facility_grants:[{facility_id:facilityId}],lifecycle_events:[]
      }]});
      if (url === "/api/v1/feature-discovery/ogi-personnel-operational-authority/clients") return response({clients:[]});
      if (url === "/api/v1/feature-discovery/ogi-personnel-operational-authority/facilities") return response({facilities:[]});
      throw new Error(`Unexpected GET ${url}`);
    }));
    const queryClient = new QueryClient({defaultOptions:{queries:{retry:false}}});
    render(<QueryClientProvider client={queryClient}><OgiOperationalAuthorityPanel canManage personnelId={personnelId}/></QueryClientProvider>);

    expect(await screen.findByText("Client name unavailable")).toBeInTheDocument();
    expect(screen.getByText("Facility name unavailable")).toBeInTheDocument();
    const technical = screen.getByText("Technical record details").closest("details");
    expect(technical).not.toHaveAttribute("open");
    expect(technical).toHaveTextContent(authorizationId);
    expect(technical).toHaveTextContent(clientId);
    expect(technical).toHaveTextContent(facilityId);
  });

  it("fails closed with explicit guidance when required grant inputs are missing", async () => {
    const user = userEvent.setup();
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      calls.push({ url, init });
      if (url.includes("/operational-authorizations")) return response({ authorizations: [] });
      if (url.includes("/feature-discovery/ogi-personnel-operational-authority/clients")) return response({ clients: [] });
      if (url.includes("/feature-discovery/ogi-personnel-operational-authority/facilities")) return response({ facilities: [] });
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
      if (url === "/api/v1/feature-discovery/ogi-personnel-operational-authority/clients") return response({ clients: [{ id: clientId, organization_name: "Aurelia Grand", contact_email: null, contact_phone: null, status: "ACTIVE", address: null, country: null, notes: null, created_at: "2026-01-01T00:00:00.000Z", updated_at: "2026-01-01T00:00:00.000Z", deleted_at: null }] });
      if (url === "/api/v1/feature-discovery/ogi-personnel-operational-authority/facilities") return response({ facilities: [] });
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
      if (url === "/api/v1/feature-discovery/ogi-personnel-operational-authority/clients") return response({ clients: [{ id: clientId, organization_name: "Sky Is The Limit", contact_email: null, contact_phone: null, status: "ACTIVE", address: null, country: null, notes: null, created_at: "2026-01-01T00:00:00.000Z", updated_at: "2026-01-01T00:00:00.000Z", deleted_at: null }] });
      if (url === `/api/v1/feature-discovery/ogi-personnel-operational-authority/facilities?clientId=${clientId}`) return response({ facilities: [{ id: facilityId, business_identifier: "FACILITY-2026-000001", client_id: clientId, facility_name: "Sky Ranch", facility_type: "TRAINING_CENTER", operational_status: "ACTIVE", address: null, country: null, timezone: "Asia/Manila", notes: null, created_at: "2026-01-01T00:00:00.000Z", updated_at: "2026-01-01T00:00:00.000Z", deleted_at: null }] });
      if (url === "/api/v1/feature-discovery/ogi-personnel-operational-authority/facilities") return response({ facilities: [{ id: facilityId, business_identifier: "FACILITY-2026-000001", client_id: clientId, facility_name: "Sky Ranch", facility_type: "TRAINING_CENTER", operational_status: "ACTIVE", address: null, country: null, timezone: "Asia/Manila", notes: null, created_at: "2026-01-01T00:00:00.000Z", updated_at: "2026-01-01T00:00:00.000Z", deleted_at: null }] });
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

  it("presents effective expiry and renews the exact frozen scope", async () => {
    const user = userEvent.setup();
    const authorizationId = "00000000-0000-4000-8000-000000400088";
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const rawUrl=String(input),url=rawUrl.startsWith("http")?new URL(rawUrl).pathname:rawUrl;calls.push({url,init});
      if(url===`/api/v1/registration/personnel/${personnelId}/operational-authorizations`&&(init?.method??"GET")==="GET")return response({authorizations:[{id:authorizationId,personnel_id:personnelId,client_id:clientId,scope_mode:"EXPLICIT_FACILITIES",status:"ACTIVE",valid_from:"2026-09-01T00:00:00.000Z",valid_until:"2026-09-02T00:00:00.000Z",reason:"Expired delivery",facility_grants:[{authorization_id:authorizationId,facility_id:facilityId,created_at:"2026-09-01T00:00:00.000Z"}],lifecycle_events:[]}]});
      if(url==="/api/v1/feature-discovery/ogi-personnel-operational-authority/clients")return response({clients:[{id:clientId,organization_name:"Aurelia Grand",contact_email:null,contact_phone:null,status:"ACTIVE",address:null,country:null,notes:null,created_at:"2026-01-01T00:00:00.000Z",updated_at:"2026-01-01T00:00:00.000Z",deleted_at:null}]});
      if(url==="/api/v1/feature-discovery/ogi-personnel-operational-authority/facilities")return response({facilities:[{id:facilityId,business_identifier:"FACILITY-1",client_id:clientId,facility_name:"Sky Ranch",facility_type:"TRAINING_CENTER",operational_status:"ACTIVE",address:null,country:null,timezone:"Asia/Manila",notes:null,created_at:"2026-01-01T00:00:00.000Z",updated_at:"2026-01-01T00:00:00.000Z",deleted_at:null}]});
      if(url.endsWith(`/${authorizationId}/renew`)&&init?.method==="POST")return response({authorization:{id:"00000000-0000-4000-8000-000000400089",personnel_id:personnelId,client_id:clientId,scope_mode:"EXPLICIT_FACILITIES",status:"ACTIVE",valid_from:new Date().toISOString(),valid_until:null,reason:"Continue delivery",supersedes_authorization_id:authorizationId,facility_grants:[{authorization_id:"00000000-0000-4000-8000-000000400089",facility_id:facilityId,created_at:new Date().toISOString()}],lifecycle_events:[]},replayed:false},201);
      throw new Error(`Unexpected request: ${init?.method??"GET"} ${url}`);
    }));
    const queryClient=new QueryClient({defaultOptions:{queries:{retry:false}}});render(<QueryClientProvider client={queryClient}><OgiOperationalAuthorityPanel canManage personnelId={personnelId}/></QueryClientProvider>);
    expect(await screen.findByText("Expired")).toBeInTheDocument();await user.click(screen.getByRole("button",{name:"Renew scope"}));
    const form=screen.getByRole("form",{name:"Renew OGI operational scope"});await user.type(within(form).getByLabelText("Business reason"),"Continue delivery");await user.click(within(form).getByRole("button",{name:"Confirm renewal"}));
    await waitFor(()=>expect(calls.some(call=>call.url.endsWith(`/${authorizationId}/renew`)&&call.init?.method==="POST")).toBe(true));
    const call=calls.find(item=>item.url.endsWith(`/${authorizationId}/renew`)&&item.init?.method==="POST");expect(JSON.parse(String(call?.init?.body))).toMatchObject({scope_mode:"EXPLICIT_FACILITIES",facility_ids:[facilityId],valid_until:null,reason:"Continue delivery"});
  });

  it("presents future-dated active storage as Scheduled without premature mutation actions", async () => {
    const future = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const rawUrl=String(input),url=rawUrl.startsWith("http")?new URL(rawUrl).pathname:rawUrl;
      if(url===`/api/v1/registration/personnel/${personnelId}/operational-authorizations`)return response({authorizations:[{id:"00000000-0000-4000-8000-000000400099",personnel_id:personnelId,client_id:clientId,scope_mode:"CLIENT_WIDE",status:"ACTIVE",valid_from:future,valid_until:null,reason:"Scheduled authority",facility_grants:[],lifecycle_events:[]}]});
      if(url==="/api/v1/feature-discovery/ogi-personnel-operational-authority/clients")return response({clients:[{id:clientId,organization_name:"Aurelia Grand",contact_email:null,contact_phone:null,status:"ACTIVE",address:null,country:null,notes:null,created_at:"2026-01-01T00:00:00.000Z",updated_at:"2026-01-01T00:00:00.000Z",deleted_at:null}]});
      if(url==="/api/v1/feature-discovery/ogi-personnel-operational-authority/facilities")return response({facilities:[]});
      throw new Error(`Unexpected request: ${url}`);
    }));
    const queryClient=new QueryClient({defaultOptions:{queries:{retry:false}}});render(<QueryClientProvider client={queryClient}><OgiOperationalAuthorityPanel canManage personnelId={personnelId}/></QueryClientProvider>);
    expect(await screen.findByText("Scheduled")).toBeInTheDocument();
    expect(screen.queryByRole("button",{name:"End scope"})).not.toBeInTheDocument();
    expect(screen.queryByRole("button",{name:"Revoke scope"})).not.toBeInTheDocument();
    expect(screen.queryByRole("button",{name:"Renew scope"})).not.toBeInTheDocument();
  });
});

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}
