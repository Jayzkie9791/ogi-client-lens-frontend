import { render, screen, within } from "@testing-library/react";
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
import { RegistrationPersonnel } from "./registrationPersonnelApi";

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
    "view_staff_member",
    "create_staff_member",
    "update_staff_member",
    "deactivate_staff_member",
    "view_facility_assignment"
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
  operational_status: "ACTIVE",
  address: null,
  country: "United States",
  timezone: "America/New_York",
  notes: null,
  created_at: "2026-08-07T00:00:00.000Z",
  updated_at: "2026-08-08T00:00:00.000Z",
  deleted_at: null
};

const staffA: RegistrationPersonnel = {
  id: "00000000-0000-4000-8000-000000300001",
  client_id: clientA.id,
  user_id: null,
  full_name: "Ana Santos",
  email: "ana.santos@example.test",
  phone_number: "+63 900 000 3001",
  employment_status: "ACTIVE",
  hire_date: "2026-01-15",
  notes: "Lead trainer",
  created_at: "2026-08-09T00:00:00.000Z",
  updated_at: "2026-08-10T00:00:00.000Z",
  deleted_at: null
};

const staffB: RegistrationPersonnel = {
  id: "00000000-0000-4000-8000-000000300002",
  client_id: clientB.id,
  user_id: "00000000-0000-4000-8000-000000000099",
  full_name: "Jamie Brooks",
  email: null,
  phone_number: null,
  employment_status: "SEASONAL",
  hire_date: null,
  notes: null,
  created_at: "2026-08-11T00:00:00.000Z",
  updated_at: "2026-08-12T00:00:00.000Z",
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
    {
      url: "/api/v1/registration/facilities",
      responses: [{ status: 200, body: { facilities: [facilityA, facilityB] } }]
    },
    ...overrides,
    {
      url: "/api/v1/registration/personnel",
      responses: [{ status: 200, body: { personnel: [staffA, staffB] } }]
    },
    {
      url: `/api/v1/registration/personnel/${staffA.id}`,
      responses: [{ status: 200, body: staffA }]
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

describe("Registration Personnel frontend", () => {
  it("renders the Personnel route and exposes all implemented Registration routes", async () => {
    const user = userEvent.setup();
    const { calls } = mockFetchRoutes(standardRoutes());

    renderWithRoute(routes.workbench);

    await user.click(await screen.findByRole("button", { name: "Menu" }));
    await user.click(screen.getByRole("link", { name: "Registration" }));

    expect(
      await screen.findByRole("heading", { name: "Clients / Organizations" })
    ).toBeInTheDocument();

    await user.click(screen.getByRole("link", { name: "Personnel" }));

    expect(await screen.findByRole("heading", { name: "Personnel" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Clients" })).toHaveAttribute(
      "href",
      routes.registrationClients
    );
    expect(screen.getByRole("link", { name: "Facilities" })).toHaveAttribute(
      "href",
      routes.registrationFacilities
    );
    expect(screen.getByRole("link", { name: "Personnel" })).toHaveAttribute(
      "href",
      routes.registrationPersonnel
    );
    expect(screen.getByRole("link", { name: "Personnel" })).toHaveAttribute(
      "aria-current",
      "page"
    );
    expect(await screen.findByText("Ana Santos")).toBeInTheDocument();
    expect(screen.getByText("Jamie Brooks")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Register Personnel" })).toBeInTheDocument();
    expect(screen.queryByRole("form", { name: "Create Personnel" })).not.toBeInTheDocument();
    expect(
      within(screen.getByRole("list", { name: "Personnel records" })).queryByText(staffA.id)
    ).not.toBeInTheDocument();
    expect(calls.some((call) => call.url.includes("/registration/credentials"))).toBe(false);
  });

  it("uses only supported Personnel filter query parameters", async () => {
    const user = userEvent.setup();
    const { calls } = mockFetchRoutes(standardRoutes([
      {
        url: `/api/v1/registration/facilities?clientId=${clientB.id}`,
        responses: [{ status: 200, body: { facilities: [facilityB] } }]
      },
      {
        url: `/api/v1/registration/personnel?clientId=${clientB.id}`,
        responses: [{ status: 200, body: { personnel: [staffB] } }]
      },
      {
        url: `/api/v1/registration/personnel?clientId=${clientB.id}&facilityId=${facilityB.id}`,
        responses: [{ status: 200, body: { personnel: [staffB] } }]
      },
      {
        url: `/api/v1/registration/personnel?clientId=${clientB.id}&facilityId=${facilityB.id}&status=SEASONAL`,
        responses: [{ status: 200, body: { personnel: [staffB] } }]
      },
      {
        url: `/api/v1/registration/personnel/${staffB.id}`,
        responses: [{ status: 200, body: staffB }]
      }
    ]));

    renderWithRoute(routes.registrationPersonnel);

    await screen.findByRole("heading", { name: "Personnel" });
    expect(screen.getByRole("link", { name: "Personnel" })).toHaveAttribute(
      "aria-current",
      "page"
    );
    const clientFilter = screen.getByLabelText("Client filter");
    await within(clientFilter).findByRole("option", { name: "Bluewater Resorts" });
    await user.selectOptions(clientFilter, clientB.id);
    expect(await screen.findByText("Jamie Brooks")).toBeInTheDocument();

    const facilityFilter = screen.getByLabelText("Facility filter");
    await within(facilityFilter).findByRole("option", { name: "Bluewater Beach Zone" });
    await user.selectOptions(facilityFilter, facilityB.id);

    await user.selectOptions(screen.getByLabelText("Employment status filter"), "SEASONAL");

    expect(calls.map(({ url }) => url)).toContain(
      `/api/v1/registration/personnel?clientId=${clientB.id}`
    );
    expect(calls.map(({ url }) => url)).toContain(
      `/api/v1/registration/personnel?clientId=${clientB.id}&facilityId=${facilityB.id}`
    );
    expect(calls.map(({ url }) => url)).toContain(
      `/api/v1/registration/personnel?clientId=${clientB.id}&facilityId=${facilityB.id}&status=SEASONAL`
    );
  });

  it("opens explicit Register Personnel mode with the active Client filter preselected", async () => {
    const user = userEvent.setup();
    const { calls } = mockFetchRoutes(standardRoutes([
      {
        url: `/api/v1/registration/facilities?clientId=${clientB.id}`,
        responses: [{ status: 200, body: { facilities: [facilityB] } }]
      },
      {
        url: `/api/v1/registration/personnel?clientId=${clientB.id}`,
        responses: [{ status: 200, body: { personnel: [staffB] } }]
      },
      {
        url: `/api/v1/registration/personnel/${staffB.id}`,
        responses: [{ status: 200, body: staffB }]
      }
    ]));

    renderWithRoute(routes.registrationPersonnel);

    const clientFilter = await screen.findByLabelText("Client filter");
    await within(clientFilter).findByRole("option", { name: "Bluewater Resorts" });
    await user.selectOptions(clientFilter, clientB.id);
    await screen.findByText("Jamie Brooks");
    await user.click(screen.getByRole("button", { name: "Register Personnel" }));

    const createForm = await screen.findByRole("form", { name: "Create Personnel" });

    expect(within(createForm).getByLabelText("Client")).toHaveValue(clientB.id);
    expect(screen.getByLabelText("Client filter")).toHaveValue(clientB.id);
    expect(
      calls.some(
        (call) =>
          call.url === "/api/v1/registration/personnel" && call.init?.method === "POST"
      )
    ).toBe(false);
  });

  it("cancels Register Personnel mode without mutation and restores the prior selection", async () => {
    const user = userEvent.setup();
    const { calls } = mockFetchRoutes(standardRoutes([
      {
        url: `/api/v1/registration/personnel/${staffB.id}`,
        responses: [{ status: 200, body: staffB }]
      }
    ]));

    renderWithRoute(routes.registrationPersonnel);

    await user.click(await screen.findByRole("button", { name: /Jamie Brooks/ }));
    await screen.findByDisplayValue("Jamie Brooks");
    await user.click(screen.getByRole("button", { name: "Register Personnel" }));
    await user.type(
      within(await screen.findByRole("form", { name: "Create Personnel" })).getByLabelText(
        "Full name"
      ),
      "Canceled Personnel"
    );
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(await screen.findByDisplayValue("Jamie Brooks")).toBeInTheDocument();
    expect(screen.queryByRole("form", { name: "Create Personnel" })).not.toBeInTheDocument();
    expect(
      calls.some(
        (call) =>
          call.url === "/api/v1/registration/personnel" && call.init?.method === "POST"
      )
    ).toBe(false);
  });

  it("renders Overview by default, switches to Facilities, and resets to Overview on Personnel change", async () => {
    const user = userEvent.setup();
    mockFetchRoutes(standardRoutes([
      {
        url: `/api/v1/registration/personnel/${staffB.id}`,
        responses: [{ status: 200, body: staffB }]
      },
      {
        url: `/api/v1/registration/personnel/${staffA.id}/facility-assignments`,
        responses: [{ status: 200, body: { assignments: [] } }]
      },
      {
        url: `/api/v1/registration/facilities?clientId=${staffA.client_id}`,
        responses: [{ status: 200, body: { facilities: [facilityA] } }]
      }
    ]));

    renderWithRoute(routes.registrationPersonnel);

    expect(await screen.findByRole("tab", { name: "Overview" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    expect(screen.getByRole("tab", { name: "Facilities" })).toBeInTheDocument();
    expect(await screen.findByDisplayValue("Ana Santos")).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Facilities" }));

    expect(await screen.findByRole("heading", { name: "Facility Assignments" })).toBeInTheDocument();
    expect(screen.getByText("Track where this person works.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Jamie Brooks/ }));

    expect(await screen.findByDisplayValue("Jamie Brooks")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Overview" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
  });

  it("hides the Facilities secondary tab without Facility Assignment view permission", async () => {
    const sessionWithoutAssignments: AuthenticatedSession = {
      ...baseSession,
      permissions: baseSession.permissions.filter(
        (permission) => permission !== "view_facility_assignment"
      )
    };
    const { calls } = mockFetchRoutes([
      ...authRoutes(sessionWithoutAssignments),
      {
        url: "/api/v1/registration/clients",
        responses: [{ status: 200, body: { clients: [clientA, clientB] } }]
      },
      {
        url: "/api/v1/registration/facilities",
        responses: [{ status: 200, body: { facilities: [facilityA, facilityB] } }]
      },
      {
        url: "/api/v1/registration/personnel",
        responses: [{ status: 200, body: { personnel: [staffA, staffB] } }]
      },
      {
        url: `/api/v1/registration/personnel/${staffA.id}`,
        responses: [{ status: 200, body: staffA }]
      }
    ]);

    renderWithRoute(routes.registrationPersonnel);

    expect(await screen.findByRole("tab", { name: "Overview" })).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "Facilities" })).not.toBeInTheDocument();
    expect(calls.some((call) => call.url.includes("facility-assignments"))).toBe(false);
  });

  it("creates Personnel without user, credential, or facility-assignment mutations", async () => {
    const user = userEvent.setup();
    const createdStaffMember: RegistrationPersonnel = {
      ...staffA,
      id: "00000000-0000-4000-8000-000000300003",
      client_id: clientB.id,
      full_name: "Morgan Lee",
      email: "morgan.lee@example.test",
      phone_number: "+1 555 0100",
      employment_status: "SEASONAL",
      hire_date: "2026-06-01",
      notes: "Summer operations"
    };
    const { calls } = mockFetchRoutes(standardRoutes([
      {
        url: "/api/v1/registration/personnel",
        responses: [
          { status: 200, body: { personnel: [staffA, staffB] } },
          { status: 200, body: { personnel: [createdStaffMember, staffA, staffB] } }
        ]
      },
      {
        method: "POST",
        url: "/api/v1/registration/personnel",
        responses: [{ status: 201, body: createdStaffMember }]
      },
      {
        url: `/api/v1/registration/personnel/${createdStaffMember.id}`,
        responses: [{ status: 200, body: createdStaffMember }]
      }
    ]));

    renderWithRoute(routes.registrationPersonnel);

    await user.click(await screen.findByRole("button", { name: "Register Personnel" }));
    const createForm = await screen.findByRole("form", { name: "Create Personnel" });
    await within(createForm).findByRole("option", { name: "Bluewater Resorts" });
    await user.selectOptions(within(createForm).getByLabelText("Client"), clientB.id);
    await user.type(within(createForm).getByLabelText("Full name"), "Morgan Lee");
    await user.type(within(createForm).getByLabelText("Email"), "morgan.lee@example.test");
    await user.type(within(createForm).getByLabelText("Phone"), "+1 555 0100");
    await user.selectOptions(within(createForm).getByLabelText("Employment status"), "SEASONAL");
    await user.type(within(createForm).getByLabelText("Hire date"), "2026-06-01");
    await user.type(within(createForm).getByLabelText("Notes"), "Summer operations");
    await user.click(within(createForm).getByRole("button", { name: "Create Personnel" }));

    expect(await screen.findByText("Personnel record created successfully.")).toBeInTheDocument();
    expect(screen.queryByRole("form", { name: "Create Personnel" })).not.toBeInTheDocument();
    expect(await screen.findByDisplayValue("Morgan Lee")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Overview" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    const createCall = calls.find(
      (call) => call.url === "/api/v1/registration/personnel" && call.init?.method === "POST"
    );
    const body = JSON.parse(String(createCall?.init?.body)) as Record<string, unknown>;

    expect(body).toEqual({
      client_id: clientB.id,
      full_name: "Morgan Lee",
      email: "morgan.lee@example.test",
      phone_number: "+1 555 0100",
      employment_status: "SEASONAL",
      hire_date: "2026-06-01",
      notes: "Summer operations"
    });
    expect(body.user_id).toBeUndefined();
    expect(body.facility_id).toBeUndefined();
    expect(body.position).toBeUndefined();
    expect(body.job_title).toBeUndefined();
    expect(calls.some((call) => call.url.includes("facility_staff_assignments"))).toBe(false);
    expect(calls.some((call) => call.url.includes("credentials"))).toBe(false);
    expect(calls.some((call) => call.url.includes("users"))).toBe(false);
  });

  it("prevents invalid create submission before required Personnel fields are supplied", async () => {
    const user = userEvent.setup();
    mockFetchRoutes(standardRoutes());

    renderWithRoute(routes.registrationPersonnel);

    await user.click(await screen.findByRole("button", { name: "Register Personnel" }));
    const createForm = await screen.findByRole("form", { name: "Create Personnel" });

    expect(
      within(createForm).getByRole("button", { name: "Create Personnel" })
    ).toBeDisabled();
  });

  it("updates writable Personnel fields without sending client_id, user_id, or unsupported fields", async () => {
    const user = userEvent.setup();
    const updatedStaffMember: RegistrationPersonnel = {
      ...staffA,
      full_name: "Ana Santos Updated",
      employment_status: "SUSPENDED",
      notes: "Temporary suspension"
    };
    const { calls } = mockFetchRoutes(standardRoutes([
      {
        method: "PATCH",
        url: `/api/v1/registration/personnel/${staffA.id}`,
        responses: [{ status: 200, body: updatedStaffMember }]
      }
    ]));

    renderWithRoute(routes.registrationPersonnel);

    const editForm = await screen.findByRole("form", { name: "Save Personnel" });
    await user.clear(within(editForm).getByLabelText("Full name"));
    await user.type(within(editForm).getByLabelText("Full name"), "Ana Santos Updated");
    await user.selectOptions(
      within(editForm).getByLabelText("Employment status"),
      "SUSPENDED"
    );
    await user.clear(within(editForm).getByLabelText("Notes"));
    await user.type(within(editForm).getByLabelText("Notes"), "Temporary suspension");
    await user.click(within(editForm).getByRole("button", { name: "Save Personnel" }));

    expect(await screen.findByText("Personnel record updated successfully.")).toBeInTheDocument();
    const updateCall = calls.find(
      (call) =>
        call.url === `/api/v1/registration/personnel/${staffA.id}` &&
        call.init?.method === "PATCH" &&
        String(call.init?.body).includes("Ana Santos Updated")
    );
    const body = JSON.parse(String(updateCall?.init?.body)) as Record<string, unknown>;

    expect(updateCall).toBeDefined();
    expect(body).toMatchObject({
      full_name: "Ana Santos Updated",
      employment_status: "SUSPENDED",
      notes: "Temporary suspension"
    });
    expect(body.client_id).toBeUndefined();
    expect(body.user_id).toBeUndefined();
    expect(body.position).toBeUndefined();
    expect(body.job_title).toBeUndefined();
    expect(body.created_at).toBeUndefined();
    expect(body.updated_at).toBeUndefined();
    expect(screen.queryByLabelText("User ID")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Position")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Job title")).not.toBeInTheDocument();
  });

  it("deactivates Personnel through PATCH employment_status INACTIVE and never DELETE", async () => {
    const user = userEvent.setup();
    const inactiveStaffMember: RegistrationPersonnel = {
      ...staffA,
      employment_status: "INACTIVE"
    };
    const { calls } = mockFetchRoutes(standardRoutes([
      {
        method: "PATCH",
        url: `/api/v1/registration/personnel/${staffA.id}`,
        responses: [{ status: 200, body: inactiveStaffMember }]
      }
    ]));

    renderWithRoute(routes.registrationPersonnel);

    await user.click(await screen.findByRole("button", { name: "Deactivate Personnel" }));

    expect(await screen.findByText("Personnel record updated successfully.")).toBeInTheDocument();
    const deactivateCall = calls.find(
      (call) =>
        call.url === `/api/v1/registration/personnel/${staffA.id}` &&
        call.init?.method === "PATCH" &&
        String(call.init?.body) === JSON.stringify({ employment_status: "INACTIVE" })
    );

    expect(deactivateCall).toBeDefined();
    expect(calls.some((call) => call.init?.method === "DELETE")).toBe(false);
  });

  it("renders loading, empty, and authorization states for Personnel list retrieval", async () => {
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
        url: "/api/v1/registration/personnel",
        responses: [{ status: 200, body: { personnel: [] } }]
      }
    ]);

    renderWithRoute(routes.registrationPersonnel);

    expect(await screen.findByText("Loading Personnel records.")).toBeInTheDocument();
    expect(
      await screen.findByRole("heading", {
        name: "No Personnel match the current filters."
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
        responses: [{ status: 200, body: { facilities: [facilityA] } }]
      },
      {
        url: "/api/v1/registration/personnel",
        responses: [
          {
            status: 403,
            body: { error: { code: "FORBIDDEN", message: "Forbidden" } }
          }
        ]
      }
    ]);

    renderWithRoute(routes.registrationPersonnel);

    expect(
      await screen.findByRole("heading", {
        name: "Personnel registration is not available with your current authorization."
      })
    ).toBeInTheDocument();
  });

  it("surfaces Personnel API errors without exposing unrelated capabilities", async () => {
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
        url: "/api/v1/registration/personnel",
        responses: [{ status: 200, body: { personnel: [staffA] } }]
      },
      {
        url: `/api/v1/registration/personnel/${staffA.id}`,
        responses: [{ status: 404, body: { error: { code: "NOT_FOUND", message: "Not found" } } }]
      },
      {
        method: "POST",
        url: "/api/v1/registration/personnel",
        responses: [
          {
            status: 409,
            body: {
              error: {
                code: "REGISTRATION_PERSONNEL_CONFLICT",
                message: "Personnel record already exists."
              }
            }
          }
        ]
      }
    ]);

    renderWithRoute(routes.registrationPersonnel);

    await user.click(await screen.findByRole("button", { name: "Register Personnel" }));
    const createForm = await screen.findByRole("form", { name: "Create Personnel" });
    await user.type(within(createForm).getByLabelText("Full name"), "Ana Santos");
    await user.click(within(createForm).getByRole("button", { name: "Create Personnel" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Personnel record already exists."
    );
    expect(screen.queryByRole("button", { name: /create credential/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /issue credential/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /revoke credential/i })).not.toBeInTheDocument();
    expect(screen.queryByText("Operational Evidence")).not.toBeInTheDocument();
    expect(screen.queryByText("Risk Assessment")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Facility assignment")).not.toBeInTheDocument();
  });

  it("routes personnel-only users to Personnel without requiring Client or Facility access", async () => {
    const personnelOnlySession = {
      ...baseSession,
      clientId: clientA.id,
      permissions: ["view_staff_member", "create_staff_member"]
    };
    const user = userEvent.setup();
    const { calls } = mockFetchRoutes([
      ...authRoutes(personnelOnlySession),
      {
        url: "/api/v1/registration/personnel",
        responses: [{ status: 200, body: { personnel: [staffA] } }]
      },
      {
        url: `/api/v1/registration/personnel/${staffA.id}`,
        responses: [{ status: 200, body: staffA }]
      }
    ]);

    renderWithRoute(routes.workbench);

    await user.click(await screen.findByRole("button", { name: "Menu" }));
    await user.click(screen.getByRole("link", { name: "Registration" }));

    expect(await screen.findByRole("heading", { name: "Personnel" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Clients" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Facilities" })).not.toBeInTheDocument();
    expect(calls.some((call) => call.url === "/api/v1/registration/clients")).toBe(false);
    expect(calls.some((call) => call.url === "/api/v1/registration/facilities")).toBe(false);
  });
});
