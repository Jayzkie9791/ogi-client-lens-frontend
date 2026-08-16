import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { configureApiAuth } from "../../api/client";
import { AppProviders } from "../providers/AppProviders";
import { appRoutes } from "../router";
import { routes } from "../routePaths";
import { getRefreshTokenStorageKey } from "../../auth/storage";
import { AuthenticatedSession } from "../../auth/types";
import { RegistrationClient } from "../../registration/registrationClientApi";
import { RegistrationFacility } from "../../registration/registrationFacilityApi";

const operatorSession: AuthenticatedSession = {
  id: "00000000-0000-4000-8000-000000000001",
  email: "operator@ogiofficial.com",
  username: null,
  fullName: "OGI Operator",
  status: "ACTIVE",
  clientId: null,
  facilityScopeMode: null,
  facilityIds: [],
  roles: ["OGI_ADMIN"],
  permissions: ["create_user", "view_client", "view_facility"]
};

const unauthorizedSession: AuthenticatedSession = {
  ...operatorSession,
  permissions: ["view_client", "view_facility"]
};

const clientA: RegistrationClient = {
  id: "00000000-0000-4000-8000-000000100001",
  organization_name: "Ocean Guard International",
  contact_email: "admin@ogiofficial.com",
  contact_phone: "+63 900 000 0001",
  status: "ACTIVE",
  address: "Makati",
  country: "Philippines",
  notes: null,
  created_at: "2026-08-01T00:00:00.000Z",
  updated_at: "2026-08-02T00:00:00.000Z",
  deleted_at: null
};

const clientB: RegistrationClient = {
  ...clientA,
  id: "00000000-0000-4000-8000-000000100002",
  organization_name: "Bluewater Resorts"
};

const facilityA: RegistrationFacility = {
  id: "00000000-0000-4000-8000-000000200001",
  client_id: clientA.id,
  facility_name: "Makati Training Pool",
  facility_type: "POOL",
  operational_status: "ACTIVE",
  address: "Makati Avenue",
  country: "Philippines",
  timezone: "Asia/Manila",
  notes: null,
  created_at: "2026-08-05T00:00:00.000Z",
  updated_at: "2026-08-06T00:00:00.000Z",
  deleted_at: null
};

const facilityB: RegistrationFacility = {
  ...facilityA,
  id: "00000000-0000-4000-8000-000000200002",
  client_id: clientB.id,
  facility_name: "Bluewater Beach Zone",
  facility_type: "BEACH"
};

interface MockResponse {
  status: number;
  body?: unknown;
  statusText?: string;
  deferred?: Promise<unknown>;
}

interface MockRoute {
  method?: string;
  url: string;
  responses: MockResponse[];
}

function renderWithRoute(initialPath: string) {
  const router = createMemoryRouter(appRoutes, {
    initialEntries: [initialPath]
  });

  return render(
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>
  );
}

function mockFetchRoutes(routesToMock: MockRoute[]) {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = readRequestPath(input);
    const method = init?.method ?? "GET";
    const route = routesToMock.find(
      (candidate) => candidate.url === url && (candidate.method ?? "GET") === method
    );

    calls.push({ url, init });

    if (!route) {
      throw new Error(`Unexpected fetch call: ${method} ${url}`);
    }

    const next = route.responses.shift();

    if (!next) {
      throw new Error(`Unexpected fetch call count: ${method} ${url}`);
    }

    if (next.deferred) {
      await next.deferred;
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

  return { calls, fetchMock };
}

function readRequestPath(input: RequestInfo | URL) {
  const value = String(input);

  if (!value.startsWith("http")) {
    return value;
  }

  const url = new URL(value);

  return `${url.pathname}${url.search}`;
}

function authRoutes(session = operatorSession): MockRoute[] {
  return [
    {
      method: "POST",
      url: "/api/v1/auth/refresh",
      responses: [{ status: 200, body: { accessToken: "access-token" } }]
    },
    {
      method: "GET",
      url: "/api/v1/auth/me",
      responses: [{ status: 200, body: session }]
    }
  ];
}

function standardRoutes(overrides: MockRoute[] = []): MockRoute[] {
  return [
    ...authRoutes(),
    {
      url: "/api/v1/registration/clients",
      responses: [{ status: 200, body: { clients: [clientA, clientB] } }]
    },
    {
      url: `/api/v1/registration/facilities?clientId=${clientA.id}`,
      responses: [{ status: 200, body: { facilities: [facilityA] } }]
    },
    ...overrides
  ];
}

function provisionResponse(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "00000000-0000-4000-8000-000000900001",
    client_id: clientA.id,
    full_name: "Client POC",
    email: "poc@example.test",
    username: null,
    status: "ACTIVE",
    role_code: "CLIENT_ADMIN",
    facility_scope_mode: "EXPLICIT",
    explicit_facility_ids: [facilityA.id],
    created_at: "2026-08-16T00:00:00.000Z",
    ...overrides
  };
}

function requestBody(call: { init?: RequestInit }) {
  return JSON.parse(String(call.init?.body)) as Record<string, unknown>;
}

function findClientPocProvisioningRequest(calls: Array<{ url: string; init?: RequestInit }>) {
  const post = calls.find((call) => call.url === "/api/v1/admin/client-pocs");

  expect(post).toBeDefined();

  if (!post) {
    throw new Error("Expected Client POC provisioning request.");
  }

  return post;
}

async function fillRequiredFields(user: ReturnType<typeof userEvent.setup>) {
  const form = await screen.findByRole("form", { name: "Provision Client POC" });

  await user.type(within(form).getByLabelText("Full name"), "Client POC");
  await user.type(within(form).getByLabelText("Business email"), "poc@example.test");
  await user.type(within(form).getByLabelText("Initial password"), "InitialPass1!");

  return form;
}

beforeEach(() => {
  window.sessionStorage.clear();
  window.sessionStorage.setItem(getRefreshTokenStorageKey(), "refresh-token");
});

afterEach(() => {
  configureApiAuth(null);
  vi.unstubAllGlobals();
  window.sessionStorage.clear();
});

describe("Client POC provisioning frontend", () => {
  it("allows an authorized actor to reach the purpose-built workflow from Administration", async () => {
    const user = userEvent.setup();
    mockFetchRoutes(standardRoutes());

    renderWithRoute(routes.administration);

    await user.click(await screen.findByRole("link", { name: "Provision Client POC" }));

    expect(
      await screen.findByRole("heading", { name: "Provision Client POC" })
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Client")).toBeInTheDocument();
    expect(screen.queryByLabelText(/role/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/permission/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/account type/i)).not.toBeInTheDocument();
  });

  it("does not present provisioning without create_user", async () => {
    const { calls } = mockFetchRoutes(authRoutes(unauthorizedSession));

    renderWithRoute(routes.administrationClientPocs);

    expect(
      await screen.findByRole("heading", {
        name: "You are not authorized to provision Client POC accounts."
      })
    ).toBeInTheDocument();
    expect(calls.map((call) => call.url)).toEqual([
      "/api/v1/auth/refresh",
      "/api/v1/auth/me"
    ]);
  });

  it("uses Clients and selected-Client Facilities from existing registration APIs", async () => {
    const { calls } = mockFetchRoutes(standardRoutes());

    renderWithRoute(routes.administrationClientPocs);

    expect(await screen.findByText("Makati Training Pool")).toBeInTheDocument();
    expect(screen.getByLabelText("Client")).toHaveValue(clientA.id);
    expect(calls.map((call) => call.url)).toContain("/api/v1/registration/clients");
    expect(calls.map((call) => call.url)).toContain(
      `/api/v1/registration/facilities?clientId=${clientA.id}`
    );
  });

  it("defaults to EXPLICIT and blocks empty explicit Facility scope", async () => {
    const user = userEvent.setup();
    const { calls } = mockFetchRoutes(standardRoutes());

    renderWithRoute(routes.administrationClientPocs);

    const form = await fillRequiredFields(user);
    expect(within(form).getByLabelText("Specific Facilities")).toBeChecked();

    await user.click(within(form).getByRole("button", { name: "Provision Client POC" }));

    expect(
      await screen.findByText("Select at least one Facility for Specific Facilities scope.")
    ).toBeInTheDocument();
    expect(calls.some((call) => call.url === "/api/v1/admin/client-pocs")).toBe(false);
  });

  it("submits selected Facility IDs for EXPLICIT scope", async () => {
    const user = userEvent.setup();
    const { calls } = mockFetchRoutes([
      ...standardRoutes([
        {
          method: "POST",
          url: "/api/v1/admin/client-pocs",
          responses: [{ status: 201, body: provisionResponse() }]
        }
      ])
    ]);

    renderWithRoute(routes.administrationClientPocs);

    const form = await fillRequiredFields(user);
    await user.click(await screen.findByLabelText(/Makati Training Pool/));
    await user.click(within(form).getByRole("button", { name: "Provision Client POC" }));

    expect(
      await screen.findByText("Client POC account provisioned successfully.")
    ).toBeInTheDocument();
    expect(requestBody(findClientPocProvisioningRequest(calls))).toEqual({
      client_id: clientA.id,
      full_name: "Client POC",
      email: "poc@example.test",
      initial_password: "InitialPass1!",
      facility_scope: {
        mode: "EXPLICIT",
        facility_ids: [facilityA.id]
      }
    });
    expect(screen.queryByText("InitialPass1!")).not.toBeInTheDocument();
  });

  it("submits CLIENT_WIDE scope without Facility IDs", async () => {
    const user = userEvent.setup();
    const { calls } = mockFetchRoutes([
      ...standardRoutes([
        {
          method: "POST",
          url: "/api/v1/admin/client-pocs",
          responses: [
            {
              status: 201,
              body: provisionResponse({
                facility_scope_mode: "CLIENT_WIDE",
                explicit_facility_ids: []
              })
            }
          ]
        }
      ])
    ]);

    renderWithRoute(routes.administrationClientPocs);

    const form = await fillRequiredFields(user);
    await user.click(within(form).getByLabelText("Client-wide Access"));
    await user.click(within(form).getByRole("button", { name: "Provision Client POC" }));

    expect(
      await screen.findByText("Client POC account provisioned successfully.")
    ).toBeInTheDocument();
    expect(requestBody(findClientPocProvisioningRequest(calls)).facility_scope).toEqual({
      mode: "CLIENT_WIDE"
    });
  });

  it("clears stale Facility selections when Client changes", async () => {
    const user = userEvent.setup();
    mockFetchRoutes([
      ...standardRoutes([
        {
          url: `/api/v1/registration/facilities?clientId=${clientB.id}`,
          responses: [{ status: 200, body: { facilities: [facilityB] } }]
        }
      ])
    ]);

    renderWithRoute(routes.administrationClientPocs);

    await fillRequiredFields(user);
    await user.click(await screen.findByLabelText(/Makati Training Pool/));
    await user.selectOptions(screen.getByLabelText("Client"), clientB.id);

    expect(await screen.findByText("Bluewater Beach Zone")).toBeInTheDocument();
    expect(screen.queryByLabelText(/Makati Training Pool/)).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Provision Client POC" }));
    expect(
      await screen.findByText("Select at least one Facility for Specific Facilities scope.")
    ).toBeInTheDocument();
  });

  it("clears explicit selections when switching scope modes and requires fresh selection", async () => {
    const user = userEvent.setup();
    const { calls } = mockFetchRoutes(standardRoutes());

    renderWithRoute(routes.administrationClientPocs);

    const form = await fillRequiredFields(user);
    await user.click(await screen.findByLabelText(/Makati Training Pool/));
    await user.click(within(form).getByLabelText("Client-wide Access"));
    await user.click(within(form).getByLabelText("Specific Facilities"));
    await user.click(within(form).getByRole("button", { name: "Provision Client POC" }));

    expect(
      await screen.findByText("Select at least one Facility for Specific Facilities scope.")
    ).toBeInTheDocument();
    expect(calls.some((call) => call.url === "/api/v1/admin/client-pocs")).toBe(false);
  });

  it("prevents duplicate submission while provisioning is pending", async () => {
    const user = userEvent.setup();
    let resolveRequest: (value: unknown) => void = () => {};
    const pendingRequest = new Promise((resolve) => {
      resolveRequest = resolve;
    });
    const { calls } = mockFetchRoutes([
      ...standardRoutes([
        {
          method: "POST",
          url: "/api/v1/admin/client-pocs",
          responses: [
            {
              status: 201,
              body: provisionResponse(),
              deferred: pendingRequest
            }
          ]
        }
      ])
    ]);

    renderWithRoute(routes.administrationClientPocs);

    const form = await fillRequiredFields(user);
    await user.click(await screen.findByLabelText(/Makati Training Pool/));
    const submitButton = within(form).getByRole("button", {
      name: "Provision Client POC"
    });
    await user.click(submitButton);
    await user.click(submitButton);

    expect(
      calls.filter((call) => call.url === "/api/v1/admin/client-pocs")
    ).toHaveLength(1);
    resolveRequest(null);
    expect(
      await screen.findByText("Client POC account provisioned successfully.")
    ).toBeInTheDocument();
  });

  it.each([
    [
      400,
      "CLIENT_POC_MALFORMED_REQUEST",
      "Field initial_password must be at least 8 characters.",
      "Field initial_password must be at least 8 characters."
    ],
    [
      403,
      "CLIENT_POC_AUTHORIZATION_DENIED",
      "Missing required permission: create_user",
      "You are not authorized to provision Client POC accounts."
    ],
    [
      409,
      "CLIENT_POC_CONFLICT",
      "Client POC email already exists.",
      "A Client POC account already exists for that business email."
    ]
  ])(
    "presents safe backend error handling for %s %s",
    async (status, code, message, expectedMessage) => {
      const user = userEvent.setup();
      mockFetchRoutes([
        ...standardRoutes([
          {
            method: "POST",
            url: "/api/v1/admin/client-pocs",
            responses: [
              {
                status,
                body: { code, message, status }
              }
            ]
          }
        ])
      ]);

      renderWithRoute(routes.administrationClientPocs);

      const form = await fillRequiredFields(user);
      await user.click(await screen.findByLabelText(/Makati Training Pool/));
      await user.click(within(form).getByRole("button", { name: "Provision Client POC" }));

      expect(await screen.findByText(expectedMessage)).toBeInTheDocument();
    }
  );
});
