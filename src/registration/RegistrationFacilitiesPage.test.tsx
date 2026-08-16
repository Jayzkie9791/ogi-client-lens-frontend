import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { configureApiAuth } from "../api/client";
import { routes } from "../app/routePaths";
import { AppProviders } from "../app/providers/AppProviders";
import { appRoutes } from "../app/router";
import { getRefreshTokenStorageKey } from "../auth/storage";
import { AuthenticatedSession } from "../auth/types";
import { RegistrationClient } from "./registrationClientApi";
import { RegistrationFacility } from "./registrationFacilityApi";

const baseSession: AuthenticatedSession = {
  id: "00000000-0000-4000-8000-000000000001",
  email: "operator@example.test",
  username: null,
  fullName: "Operator One",
  status: "ACTIVE",
  clientId: null,
  facilityScopeMode: null,
  facilityIds: [],
  roles: ["Registration"],
  permissions: [
    "view_client",
    "view_facility",
    "create_facility",
    "update_facility",
    "deactivate_facility"
  ]
};

const clientA: RegistrationClient = {
  id: "00000000-0000-4000-8000-000000100001",
  organization_name: "Ocean Guard International",
  contact_email: "admin@ogiofficial.com",
  contact_phone: "+63 900 000 0001",
  status: "ACTIVE",
  address: "Makati",
  country: "Philippines",
  notes: "Launch client",
  created_at: "2026-08-01T00:00:00.000Z",
  updated_at: "2026-08-02T00:00:00.000Z",
  deleted_at: null
};

const clientB: RegistrationClient = {
  id: "00000000-0000-4000-8000-000000100002",
  organization_name: "Bluewater Resorts",
  contact_email: null,
  contact_phone: null,
  status: "ACTIVE",
  address: null,
  country: "United States",
  notes: null,
  created_at: "2026-08-03T00:00:00.000Z",
  updated_at: "2026-08-04T00:00:00.000Z",
  deleted_at: null
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
  notes: "Primary training facility",
  created_at: "2026-08-05T00:00:00.000Z",
  updated_at: "2026-08-06T00:00:00.000Z",
  deleted_at: null
};

const facilityB: RegistrationFacility = {
  id: "00000000-0000-4000-8000-000000200002",
  client_id: clientB.id,
  facility_name: "Bluewater Beach Zone",
  facility_type: "BEACH",
  operational_status: "UNDER_MAINTENANCE",
  address: null,
  country: "United States",
  timezone: "America/New_York",
  notes: null,
  created_at: "2026-08-07T00:00:00.000Z",
  updated_at: "2026-08-08T00:00:00.000Z",
  deleted_at: null
};

interface MockResponse {
  status: number;
  body?: unknown;
  statusText?: string;
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

function authRoutes(session = baseSession): MockRoute[] {
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

function standardRoutes(overrides: MockRoute[] = []) {
  return [
    ...authRoutes(),
    {
      url: "/api/v1/registration/clients",
      responses: [{ status: 200, body: { clients: [clientA, clientB] } }]
    },
    ...overrides,
    {
      url: "/api/v1/registration/facilities",
      responses: [{ status: 200, body: { facilities: [facilityA, facilityB] } }]
    },
    {
      url: `/api/v1/registration/facilities/${facilityA.id}`,
      responses: [{ status: 200, body: facilityA }]
    }
  ];
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

describe("Registration Facilities frontend", () => {
  it("renders the Facility route and preserves the Clients route", async () => {
    const user = userEvent.setup();
    const { calls } = mockFetchRoutes(standardRoutes());

    renderWithRoute(routes.workbench);

    await user.click(await screen.findByRole("button", { name: "Menu" }));
    await user.click(screen.getByRole("link", { name: "Registration" }));

    expect(
      await screen.findByRole("heading", { name: "Clients / Organizations" })
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Facilities" })).toHaveAttribute(
      "href",
      routes.registrationFacilities
    );

    await user.click(screen.getByRole("link", { name: "Facilities" }));

    expect(await screen.findByRole("heading", { name: "Facilities" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Clients" })).toHaveAttribute(
      "href",
      routes.registrationClients
    );
    expect(screen.getByRole("link", { name: "Facilities" })).toHaveAttribute(
      "aria-current",
      "page"
    );
    expect(await screen.findByText("Makati Training Pool")).toBeInTheDocument();
    expect(screen.getByText("Bluewater Beach Zone")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Register Facility" })).toBeInTheDocument();
    expect(screen.queryByRole("form", { name: "Create Facility" })).not.toBeInTheDocument();
    expect(
      within(screen.getByRole("list", { name: "Facility records" })).queryByText(facilityA.id)
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Personnel")).not.toBeInTheDocument();
    expect(calls.some((call) => call.url.includes("/registration/personnel"))).toBe(false);
  });

  it("uses the Client filter as the approved clientId query parameter", async () => {
    const user = userEvent.setup();
    const { calls } = mockFetchRoutes([
      ...standardRoutes([
        {
          url: `/api/v1/registration/facilities?clientId=${clientB.id}`,
          responses: [{ status: 200, body: { facilities: [facilityB] } }]
        },
        {
          url: `/api/v1/registration/facilities/${facilityB.id}`,
          responses: [{ status: 200, body: facilityB }]
        }
      ])
    ]);

    renderWithRoute(routes.registrationFacilities);

    await screen.findByRole("heading", { name: "Facilities" });
    expect(screen.getByRole("link", { name: "Facilities" })).toHaveAttribute(
      "aria-current",
      "page"
    );
    const clientFilter = screen.getByLabelText("Client filter");
    await within(clientFilter).findByRole("option", { name: "Bluewater Resorts" });
    await user.selectOptions(clientFilter, clientB.id);

    expect(await screen.findByText("Bluewater Beach Zone")).toBeInTheDocument();
    expect(calls.map(({ url }) => url)).toContain(
      `/api/v1/registration/facilities?clientId=${clientB.id}`
    );
  });

  it("opens explicit Register Facility mode with the active Client filter preselected", async () => {
    const user = userEvent.setup();
    const { calls } = mockFetchRoutes([
      ...standardRoutes([
        {
          url: `/api/v1/registration/facilities?clientId=${clientB.id}`,
          responses: [{ status: 200, body: { facilities: [facilityB] } }]
        },
        {
          url: `/api/v1/registration/facilities/${facilityB.id}`,
          responses: [{ status: 200, body: facilityB }]
        }
      ])
    ]);

    renderWithRoute(routes.registrationFacilities);

    const clientFilter = await screen.findByLabelText("Client filter");
    await within(clientFilter).findByRole("option", { name: "Bluewater Resorts" });
    await user.selectOptions(clientFilter, clientB.id);
    await screen.findByText("Bluewater Beach Zone");
    await user.click(screen.getByRole("button", { name: "Register Facility" }));

    const createForm = await screen.findByRole("form", { name: "Create Facility" });

    expect(within(createForm).getByLabelText("Client")).toHaveValue(clientB.id);
    expect(screen.getByLabelText("Client filter")).toHaveValue(clientB.id);
    expect(
      calls.some(
        (call) =>
          call.url === "/api/v1/registration/facilities" && call.init?.method === "POST"
      )
    ).toBe(false);
  });

  it("cancels Register Facility mode without mutation and restores the prior selection", async () => {
    const user = userEvent.setup();
    const { calls } = mockFetchRoutes([
      ...authRoutes(),
      {
        url: "/api/v1/registration/clients",
        responses: [{ status: 200, body: { clients: [clientA, clientB] } }]
      },
      {
        url: "/api/v1/registration/facilities",
        responses: [{ status: 200, body: { facilities: [facilityA, facilityB] } }]
      },
      {
        url: `/api/v1/registration/facilities/${facilityA.id}`,
        responses: [{ status: 200, body: facilityA }]
      },
      {
        url: `/api/v1/registration/facilities/${facilityB.id}`,
        responses: [{ status: 200, body: facilityB }]
      }
    ]);

    renderWithRoute(routes.registrationFacilities);

    await user.click(await screen.findByRole("button", { name: /Bluewater Beach Zone/ }));
    await screen.findByDisplayValue("Bluewater Beach Zone");
    await user.click(screen.getByRole("button", { name: "Register Facility" }));
    await user.type(
      within(await screen.findByRole("form", { name: "Create Facility" })).getByLabelText(
        "Facility name"
      ),
      "Canceled facility"
    );
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(await screen.findByDisplayValue("Bluewater Beach Zone")).toBeInTheDocument();
    expect(screen.queryByRole("form", { name: "Create Facility" })).not.toBeInTheDocument();
    expect(
      calls.some(
        (call) =>
          call.url === "/api/v1/registration/facilities" && call.init?.method === "POST"
      )
    ).toBe(false);
  });

  it("creates a Facility with immutable Client ownership supplied in the POST payload", async () => {
    const user = userEvent.setup();
    const createdFacility: RegistrationFacility = {
      ...facilityA,
      id: "00000000-0000-4000-8000-000000200003",
      facility_name: "North Shore Waterpark",
      facility_type: "WATERPARK",
      client_id: clientB.id,
      country: "Canada",
      timezone: "America/Toronto"
    };
    const { calls } = mockFetchRoutes(standardRoutes([
      {
        url: "/api/v1/registration/facilities",
        responses: [
          { status: 200, body: { facilities: [facilityA, facilityB] } },
          { status: 200, body: { facilities: [createdFacility, facilityA, facilityB] } }
        ]
      },
      {
        method: "POST",
        url: "/api/v1/registration/facilities",
        responses: [{ status: 201, body: createdFacility }]
      },
      {
        url: `/api/v1/registration/facilities/${createdFacility.id}`,
        responses: [{ status: 200, body: createdFacility }]
      }
    ]));

    renderWithRoute(routes.registrationFacilities);

    await user.click(await screen.findByRole("button", { name: "Register Facility" }));
    const createForm = await screen.findByRole("form", { name: "Create Facility" });
    await within(createForm).findByRole("option", { name: "Bluewater Resorts" });
    await user.selectOptions(within(createForm).getByLabelText("Client"), clientB.id);
    await user.type(within(createForm).getByLabelText("Facility name"), "North Shore Waterpark");
    await user.selectOptions(within(createForm).getByLabelText("Facility type"), "WATERPARK");
    await user.type(within(createForm).getByLabelText("Country"), "Canada");
    await user.type(within(createForm).getByLabelText("Timezone"), "America/Toronto");
    await user.click(within(createForm).getByRole("button", { name: "Create Facility" }));

    expect(await screen.findByText("Facility created successfully.")).toBeInTheDocument();
    expect(screen.queryByRole("form", { name: "Create Facility" })).not.toBeInTheDocument();
    expect(await screen.findByDisplayValue("North Shore Waterpark")).toBeInTheDocument();
    const createCall = calls.find(
      (call) => call.url === "/api/v1/registration/facilities" && call.init?.method === "POST"
    );

    expect(createCall).toBeDefined();
    expect(JSON.parse(String(createCall?.init?.body))).toEqual({
      client_id: clientB.id,
      facility_name: "North Shore Waterpark",
      facility_type: "WATERPARK",
      operational_status: "ACTIVE",
      address: null,
      country: "Canada",
      timezone: "America/Toronto",
      notes: null
    });
  });

  it("prevents invalid create submission before required Facility fields are supplied", async () => {
    const user = userEvent.setup();
    mockFetchRoutes(standardRoutes());

    renderWithRoute(routes.registrationFacilities);

    await user.click(await screen.findByRole("button", { name: "Register Facility" }));
    const createForm = await screen.findByRole("form", { name: "Create Facility" });

    expect(
      within(createForm).getByRole("button", { name: "Create Facility" })
    ).toBeDisabled();
  });

  it("updates Facility writable fields without sending client_id or protected fields", async () => {
    const user = userEvent.setup();
    const updatedFacility: RegistrationFacility = {
      ...facilityA,
      facility_name: "Makati Training Pool Updated",
      operational_status: "PENDING_APPROVAL",
      notes: "Awaiting reapproval"
    };
    const { calls } = mockFetchRoutes(standardRoutes([
      {
        method: "PATCH",
        url: `/api/v1/registration/facilities/${facilityA.id}`,
        responses: [{ status: 200, body: updatedFacility }]
      }
    ]));

    renderWithRoute(routes.registrationFacilities);

    const editForm = await screen.findByRole("form", { name: "Save Facility" });
    await user.clear(within(editForm).getByLabelText("Facility name"));
    await user.type(within(editForm).getByLabelText("Facility name"), "Makati Training Pool Updated");
    await user.selectOptions(
      within(editForm).getByLabelText("Operational status"),
      "PENDING_APPROVAL"
    );
    await user.clear(within(editForm).getByLabelText("Notes"));
    await user.type(within(editForm).getByLabelText("Notes"), "Awaiting reapproval");
    await user.click(within(editForm).getByRole("button", { name: "Save Facility" }));

    expect(await screen.findByText("Facility updated successfully.")).toBeInTheDocument();
    const updateCall = calls.find(
      (call) =>
        call.url === `/api/v1/registration/facilities/${facilityA.id}` &&
        call.init?.method === "PATCH" &&
        String(call.init?.body).includes("Makati Training Pool Updated")
    );
    const body = JSON.parse(String(updateCall?.init?.body)) as Record<string, unknown>;

    expect(updateCall).toBeDefined();
    expect(body).toMatchObject({
      facility_name: "Makati Training Pool Updated",
      operational_status: "PENDING_APPROVAL",
      notes: "Awaiting reapproval"
    });
    expect(body.client_id).toBeUndefined();
    expect(body.id).toBeUndefined();
    expect(body.created_at).toBeUndefined();
    expect(body.updated_at).toBeUndefined();
  });

  it("allows an authorized edit-form transition to INACTIVE and reflects the persisted response", async () => {
    const user = userEvent.setup();
    const inactiveFacility: RegistrationFacility = {
      ...facilityA,
      operational_status: "INACTIVE",
      updated_at: "2026-08-09T00:00:00.000Z"
    };
    const { calls } = mockFetchRoutes([
      ...authRoutes(),
      {
        url: "/api/v1/registration/clients",
        responses: [{ status: 200, body: { clients: [clientA, clientB] } }]
      },
      {
        url: "/api/v1/registration/facilities",
        responses: [
          { status: 200, body: { facilities: [facilityA, facilityB] } },
          { status: 200, body: { facilities: [inactiveFacility, facilityB] } }
        ]
      },
      {
        url: `/api/v1/registration/facilities/${facilityA.id}`,
        responses: [{ status: 200, body: facilityA }]
      },
      {
        url: `/api/v1/registration/facilities/${facilityB.id}`,
        responses: [{ status: 200, body: facilityB }]
      },
      {
        method: "PATCH",
        url: `/api/v1/registration/facilities/${facilityA.id}`,
        responses: [{ status: 200, body: inactiveFacility }]
      }
    ]);

    renderWithRoute(routes.registrationFacilities);

    const editForm = await screen.findByRole("form", { name: "Save Facility" });
    await user.selectOptions(within(editForm).getByLabelText("Operational status"), "INACTIVE");
    await user.click(within(editForm).getByRole("button", { name: "Save Facility" }));

    expect(await screen.findByText("Facility updated successfully.")).toBeInTheDocument();
    const updateCall = calls.find(
      (call) =>
        call.url === `/api/v1/registration/facilities/${facilityA.id}` &&
        call.init?.method === "PATCH"
    );

    expect(updateCall).toBeDefined();
    expect(JSON.parse(String(updateCall?.init?.body))).toMatchObject({
      operational_status: "INACTIVE"
    });
    await waitFor(() =>
      expect(
        within(screen.getByRole("list", { name: "Facility records" })).getByText("Inactive")
      ).toBeInTheDocument()
    );
    expect(within(editForm).getByLabelText("Operational status")).toHaveValue("INACTIVE");
    expect(screen.queryByRole("button", { name: "Deactivate Facility" })).not.toBeInTheDocument();

    const bluewaterListItem = screen.getByRole("button", {
      name: /Bluewater Beach Zone/
    }).closest("li");
    const makatiListItem = screen.getByRole("button", {
      name: /Makati Training Pool/
    }).closest("li");

    if (!bluewaterListItem || !makatiListItem) {
      throw new Error("Expected Facility list items to render.");
    }

    await user.click(within(bluewaterListItem).getByRole("button", { name: /Bluewater Beach Zone/ }));
    await screen.findByDisplayValue("Bluewater Beach Zone");
    await user.click(within(makatiListItem).getByRole("button", { name: /Makati Training Pool/ }));

    expect(await screen.findByDisplayValue("Makati Training Pool")).toBeInTheDocument();
    expect(within(screen.getByRole("form", { name: "Save Facility" })).getByLabelText(
      "Operational status"
    )).toHaveValue("INACTIVE");
  });

  it("keeps ordinary Facility edits available but blocks status changes without deactivate authority", async () => {
    const user = userEvent.setup();
    const updateOnlySession: AuthenticatedSession = {
      ...baseSession,
      permissions: ["view_client", "view_facility", "update_facility"]
    };
    const updatedFacility: RegistrationFacility = {
      ...facilityA,
      facility_name: "Makati Training Pool Updated"
    };
    const { calls } = mockFetchRoutes([
      ...authRoutes(updateOnlySession),
      {
        url: "/api/v1/registration/clients",
        responses: [{ status: 200, body: { clients: [clientA, clientB] } }]
      },
      {
        url: "/api/v1/registration/facilities",
        responses: [
          { status: 200, body: { facilities: [facilityA] } },
          { status: 200, body: { facilities: [updatedFacility] } }
        ]
      },
      {
        url: `/api/v1/registration/facilities/${facilityA.id}`,
        responses: [{ status: 200, body: facilityA }]
      },
      {
        method: "PATCH",
        url: `/api/v1/registration/facilities/${facilityA.id}`,
        responses: [{ status: 200, body: updatedFacility }]
      }
    ]);

    renderWithRoute(routes.registrationFacilities);

    const editForm = await screen.findByRole("form", { name: "Save Facility" });
    const statusSelect = within(editForm).getByLabelText("Operational status");

    expect(statusSelect).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Deactivate Facility" })).not.toBeInTheDocument();

    await user.clear(within(editForm).getByLabelText("Facility name"));
    await user.type(within(editForm).getByLabelText("Facility name"), "Makati Training Pool Updated");
    await user.click(within(editForm).getByRole("button", { name: "Save Facility" }));

    expect(await screen.findByText("Facility updated successfully.")).toBeInTheDocument();
    const updateCall = calls.find(
      (call) =>
        call.url === `/api/v1/registration/facilities/${facilityA.id}` &&
        call.init?.method === "PATCH"
    );

    expect(updateCall).toBeDefined();
    expect(JSON.parse(String(updateCall?.init?.body))).toMatchObject({
      facility_name: "Makati Training Pool Updated",
      operational_status: "ACTIVE"
    });
  });

  it("deactivates a Facility through PATCH operational_status INACTIVE and never DELETE", async () => {
    const user = userEvent.setup();
    const inactiveFacility: RegistrationFacility = {
      ...facilityA,
      operational_status: "INACTIVE"
    };
    const { calls } = mockFetchRoutes(standardRoutes([
      {
        method: "PATCH",
        url: `/api/v1/registration/facilities/${facilityA.id}`,
        responses: [{ status: 200, body: inactiveFacility }]
      }
    ]));

    renderWithRoute(routes.registrationFacilities);

    await user.click(await screen.findByRole("button", { name: "Deactivate Facility" }));

    expect(await screen.findByText("Facility updated successfully.")).toBeInTheDocument();
    const deactivateCall = calls.find(
      (call) =>
        call.url === `/api/v1/registration/facilities/${facilityA.id}` &&
        call.init?.method === "PATCH" &&
        String(call.init?.body) === JSON.stringify({ operational_status: "INACTIVE" })
    );

    expect(deactivateCall).toBeDefined();
    expect(calls.some((call) => call.init?.method === "DELETE")).toBe(false);
  });

  it("renders loading, empty, and authorization states for Facility list retrieval", async () => {
    mockFetchRoutes([
      ...authRoutes(),
      {
        url: "/api/v1/registration/clients",
        responses: [{ status: 200, body: { clients: [clientA] } }]
      },
      {
        url: "/api/v1/registration/facilities",
        responses: [{ status: 200, body: { facilities: [] } }]
      }
    ]);

    renderWithRoute(routes.registrationFacilities);

    expect(await screen.findByText("Loading Facility records.")).toBeInTheDocument();
    expect(
      await screen.findByRole("heading", {
        name: "No Facilities registered."
      })
    ).toBeInTheDocument();

    vi.unstubAllGlobals();
    window.sessionStorage.clear();
    window.sessionStorage.setItem(getRefreshTokenStorageKey(), "refresh-token");
    mockFetchRoutes([
      ...authRoutes(),
      {
        url: "/api/v1/registration/clients",
        responses: [{ status: 200, body: { clients: [clientA] } }]
      },
      {
        url: "/api/v1/registration/facilities",
        responses: [
          {
            status: 403,
            body: { error: { code: "FORBIDDEN", message: "Forbidden" } }
          }
        ]
      }
    ]);

    renderWithRoute(routes.registrationFacilities);

    expect(
      await screen.findByRole("heading", {
        name: "Facility registration is not available with your current authorization."
      })
    ).toBeInTheDocument();
  });

  it("surfaces Facility detail and mutation API errors without exposing unrelated capabilities", async () => {
    const user = userEvent.setup();
    mockFetchRoutes([
      ...authRoutes(),
      {
        url: "/api/v1/registration/clients",
        responses: [{ status: 200, body: { clients: [clientA] } }]
      },
      {
        url: "/api/v1/registration/facilities",
        responses: [{ status: 200, body: { facilities: [facilityA] } }]
      },
      {
        url: `/api/v1/registration/facilities/${facilityA.id}`,
        responses: [{ status: 404, body: { error: { code: "NOT_FOUND", message: "Not found" } } }]
      },
      {
        method: "POST",
        url: "/api/v1/registration/facilities",
        responses: [
          {
            status: 409,
            body: {
              error: {
                code: "REGISTRATION_FACILITY_CONFLICT",
                message: "Facility already exists."
              }
            }
          }
        ]
      }
    ]);

    renderWithRoute(routes.registrationFacilities);

    await user.click(await screen.findByRole("button", { name: "Register Facility" }));
    const createForm = await screen.findByRole("form", { name: "Create Facility" });
    await user.type(within(createForm).getByLabelText("Facility name"), "Makati Training Pool");
    await user.click(within(createForm).getByRole("button", { name: "Create Facility" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Facility already exists.");
    expect(screen.queryByText("Personnel")).not.toBeInTheDocument();
    expect(screen.queryByText("Credentials")).not.toBeInTheDocument();
    expect(screen.queryByText("Operational Evidence")).not.toBeInTheDocument();
  });

  it("routes facility-only users to Facilities and does not require Client Registration access", async () => {
    const facilityOnlySession = {
      ...baseSession,
      clientId: clientA.id,
      permissions: ["view_facility", "create_facility"]
    };
    const user = userEvent.setup();
    const { calls } = mockFetchRoutes([
      ...authRoutes(facilityOnlySession),
      {
        url: "/api/v1/registration/facilities",
        responses: [{ status: 200, body: { facilities: [facilityA] } }]
      },
      {
        url: `/api/v1/registration/facilities/${facilityA.id}`,
        responses: [{ status: 200, body: facilityA }]
      }
    ]);

    renderWithRoute(routes.workbench);

    await user.click(await screen.findByRole("button", { name: "Menu" }));
    await user.click(screen.getByRole("link", { name: "Registration" }));

    expect(await screen.findByRole("heading", { name: "Facilities" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Clients" })).not.toBeInTheDocument();
    expect(calls.some((call) => call.url === "/api/v1/registration/clients")).toBe(false);
  });
});
