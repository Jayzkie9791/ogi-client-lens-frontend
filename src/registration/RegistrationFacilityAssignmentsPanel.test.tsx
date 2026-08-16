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
import { RegistrationFacilityAssignment } from "./registrationFacilityAssignmentApi";
import { RegistrationPersonnel } from "./registrationPersonnelApi";

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
  client_id: clientA.id,
  facility_name: "Bluewater Beach Zone",
  facility_type: "BEACH",
  operational_status: "ACTIVE",
  address: null,
  country: "Philippines",
  timezone: "Asia/Manila",
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

const activePrimaryAssignment: RegistrationFacilityAssignment = {
  id: "00000000-0000-4000-8000-000000400001",
  staff_member_id: staffA.id,
  facility_id: facilityA.id,
  assignment_status: "ACTIVE",
  assigned_from: "2026-02-01",
  assigned_to: null,
  is_primary_assignment: true,
  notes: "Primary training placement",
  created_at: "2026-08-13T00:00:00.000Z",
  updated_at: "2026-08-14T00:00:00.000Z",
  deleted_at: null
};

const activeSecondaryAssignment: RegistrationFacilityAssignment = {
  id: "00000000-0000-4000-8000-000000400002",
  staff_member_id: staffA.id,
  facility_id: facilityB.id,
  assignment_status: "ACTIVE",
  assigned_from: "2026-03-01",
  assigned_to: null,
  is_primary_assignment: false,
  notes: null,
  created_at: "2026-08-15T00:00:00.000Z",
  updated_at: "2026-08-16T00:00:00.000Z",
  deleted_at: null
};

const completedAssignment: RegistrationFacilityAssignment = {
  id: "00000000-0000-4000-8000-000000400003",
  staff_member_id: staffA.id,
  facility_id: "00000000-0000-4000-8000-000000299999",
  assignment_status: "COMPLETED",
  assigned_from: "2026-01-01",
  assigned_to: "2026-01-31",
  is_primary_assignment: false,
  notes: "Historical placement",
  created_at: "2026-08-17T00:00:00.000Z",
  updated_at: "2026-08-18T00:00:00.000Z",
  deleted_at: null
};

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
    "deactivate_staff_member"
  ]
};

interface MockResponse {
  status: number;
  body?: unknown;
  statusText?: string;
  delay?: Promise<void>;
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
    const route =
      routesToMock.find(
        (candidate) =>
          candidate.url === url &&
          (candidate.method ?? "GET") === method &&
          candidate.responses.length > 0
      ) ??
      routesToMock.find(
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

    if (next.delay) {
      await next.delay;
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

function standardRoutesForSession(
  session: AuthenticatedSession,
  overrides: MockRoute[] = []
) {
  return [
    ...authRoutes(session),
    {
      url: "/api/v1/registration/clients",
      responses: repeatedResponses({ status: 200, body: { clients: [clientA] } })
    },
    {
      url: "/api/v1/registration/facilities",
      responses: repeatedResponses({ status: 200, body: { facilities: [facilityA, facilityB] } })
    },
    {
      url: "/api/v1/registration/personnel",
      responses: repeatedResponses({ status: 200, body: { personnel: [staffA] } })
    },
    {
      url: `/api/v1/registration/personnel/${staffA.id}`,
      responses: repeatedResponses({ status: 200, body: staffA })
    },
    ...overrides
  ];
}

function repeatedResponses(response: MockResponse, count = 6) {
  return Array.from({ length: count }, () => response);
}

function sessionWithFacilityAssignmentPermissions(extraPermissions: string[]) {
  return {
    ...baseSession,
    permissions: [...baseSession.permissions, ...extraPermissions]
  } satisfies AuthenticatedSession;
}

function assignmentRoutes(assignments: RegistrationFacilityAssignment[]) {
  return [
    {
      url: `/api/v1/registration/facilities?clientId=${clientA.id}`,
      responses: repeatedResponses({
        status: 200,
        body: { facilities: [facilityA, facilityB] }
      })
    },
    {
      url: `/api/v1/registration/personnel/${staffA.id}/facility-assignments`,
      responses: repeatedResponses({ status: 200, body: { assignments } })
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

describe("Registration Facility Assignment frontend", () => {
  it("hides Facility Assignment history without view_facility_assignment", async () => {
    const { calls } = mockFetchRoutes(standardRoutesForSession(baseSession));

    renderWithRoute(routes.registrationPersonnel);

    expect(await screen.findByText("Ana Santos")).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "Personnel Details" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Facility assignment")).not.toBeInTheDocument();
    expect(
      calls.some((call) => call.url.includes("facility-assignments"))
    ).toBe(false);
  });

  it("renders Facility Assignment history with Facility labels, fallback IDs, and multiple active assignments", async () => {
    const session = sessionWithFacilityAssignmentPermissions(["view_facility_assignment"]);
    mockFetchRoutes(standardRoutesForSession(session, assignmentRoutes([
      activePrimaryAssignment,
      activeSecondaryAssignment,
      completedAssignment
    ])));

    renderWithRoute(routes.registrationPersonnel);

    expect(await screen.findByRole("heading", { name: "Facility Assignments" })).toBeInTheDocument();
    expect(await screen.findByText("Makati Training Pool")).toBeInTheDocument();
    expect(await screen.findByLabelText("Facility Assignment Bluewater Beach Zone")).toBeInTheDocument();
    expect(screen.getByText(completedAssignment.facility_id)).toBeInTheDocument();
    expect(within(await screen.findByLabelText("Facility Assignment Makati Training Pool")).getByText("Active")).toBeInTheDocument();
    expect(within(await screen.findByLabelText("Facility Assignment Bluewater Beach Zone")).getByText("Active")).toBeInTheDocument();
    expect(screen.getByText("Completed")).toBeInTheDocument();
    expect(screen.getByText("2026-01-31")).toBeInTheDocument();
    expect(screen.getByText("Primary training placement")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add Facility Assignment" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Set Primary" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "End Assignment" })).not.toBeInTheDocument();
    expect(screen.queryByText("user_facility_access")).not.toBeInTheDocument();
    expect(screen.queryByText(/platform Facility authority/i)).not.toBeInTheDocument();
  });

  it("shows Add Facility Assignment only with create permission and sends the exact create contract", async () => {
    const user = userEvent.setup();
    let releaseCreateResponse: () => void = () => undefined;
    const createDelay = new Promise<void>((resolve) => {
      releaseCreateResponse = () => resolve();
    });
    const session = sessionWithFacilityAssignmentPermissions([
      "view_facility_assignment",
      "create_facility_assignment"
    ]);
    const createdAssignment: RegistrationFacilityAssignment = {
      ...activeSecondaryAssignment,
      id: "00000000-0000-4000-8000-000000400004",
      facility_id: facilityB.id,
      assigned_from: "2026-04-01",
      notes: "Weekend rotation"
    };
    const { calls } = mockFetchRoutes(standardRoutesForSession(session, [
      ...assignmentRoutes([activePrimaryAssignment]),
      {
        method: "POST",
        url: `/api/v1/registration/personnel/${staffA.id}/facility-assignments`,
        responses: [{ status: 201, body: createdAssignment, delay: createDelay }]
      }
    ]));

    renderWithRoute(routes.registrationPersonnel);

    const addForm = await screen.findByRole("form", {
      name: "Add Facility Assignment"
    });
    expect(within(addForm).getByLabelText("Primary assignment")).not.toBeChecked();
    await within(addForm).findByRole("option", { name: "Bluewater Beach Zone" });
    await user.selectOptions(within(addForm).getByLabelText("Facility"), facilityB.id);
    await user.type(within(addForm).getByLabelText("Assigned From"), "2026-04-01");
    await user.type(within(addForm).getByLabelText("Notes"), "Weekend rotation");
    await user.click(
      within(addForm).getByRole("button", { name: "Add Facility Assignment" })
    );

    expect(
      within(addForm).getByRole("button", { name: "Add Facility Assignment" })
    ).toBeDisabled();
    releaseCreateResponse();
    expect(await screen.findByText("Facility Assignment created successfully.")).toBeInTheDocument();

    const createCall = calls.find(
      (call) =>
        call.url ===
          `/api/v1/registration/personnel/${staffA.id}/facility-assignments` &&
        call.init?.method === "POST"
    );
    const body = JSON.parse(String(createCall?.init?.body)) as Record<string, unknown>;

    expect(body).toEqual({
      facility_id: facilityB.id,
      assigned_from: "2026-04-01",
      notes: "Weekend rotation"
    });
    expect(body.is_primary_assignment).toBeUndefined();
    expect(body.assigned_to).toBeUndefined();
    expect(body.client_id).toBeUndefined();
    expect(body.user_facility_access).toBeUndefined();
    await waitFor(() =>
      expect(
        calls.filter(
          (call) =>
            call.url ===
              `/api/v1/registration/personnel/${staffA.id}/facility-assignments` &&
            call.init?.method !== "POST"
        ).length
      ).toBeGreaterThanOrEqual(2)
    );
    await waitFor(() =>
      expect(
        calls.filter((call) => call.url === "/api/v1/registration/personnel").length
      ).toBeGreaterThanOrEqual(2)
    );
  });

  it("submits optional primary only when selected", async () => {
    const user = userEvent.setup();
    const session = sessionWithFacilityAssignmentPermissions([
      "view_facility_assignment",
      "create_facility_assignment"
    ]);
    const { calls } = mockFetchRoutes(standardRoutesForSession(session, [
      ...assignmentRoutes([]),
      {
        method: "POST",
        url: `/api/v1/registration/personnel/${staffA.id}/facility-assignments`,
        responses: [{ status: 201, body: activePrimaryAssignment }]
      }
    ]));

    renderWithRoute(routes.registrationPersonnel);

    const addForm = await screen.findByRole("form", {
      name: "Add Facility Assignment"
    });
    await within(addForm).findByRole("option", { name: "Makati Training Pool" });
    await user.selectOptions(within(addForm).getByLabelText("Facility"), facilityA.id);
    await user.type(within(addForm).getByLabelText("Assigned From"), "2026-02-01");
    await user.click(within(addForm).getByLabelText("Primary assignment"));
    await user.click(
      within(addForm).getByRole("button", { name: "Add Facility Assignment" })
    );

    const createCall = calls.find(
      (call) =>
        call.url ===
          `/api/v1/registration/personnel/${staffA.id}/facility-assignments` &&
        call.init?.method === "POST"
    );
    const body = JSON.parse(String(createCall?.init?.body)) as Record<string, unknown>;

    expect(body).toEqual({
      facility_id: facilityA.id,
      assigned_from: "2026-02-01",
      is_primary_assignment: true
    });
  });

  it("reconciles duplicate create conflicts with a safe 409 error", async () => {
    const user = userEvent.setup();
    const session = sessionWithFacilityAssignmentPermissions([
      "view_facility_assignment",
      "create_facility_assignment"
    ]);
    const { calls } = mockFetchRoutes(standardRoutesForSession(session, [
      ...assignmentRoutes([activePrimaryAssignment]),
      {
        method: "POST",
        url: `/api/v1/registration/personnel/${staffA.id}/facility-assignments`,
        responses: [
          {
            status: 409,
            body: {
              error: {
                code: "REGISTRATION_FACILITY_ASSIGNMENT_CONFLICT",
                message: "Raw duplicate message"
              }
            }
          }
        ]
      }
    ]));

    renderWithRoute(routes.registrationPersonnel);

    const addForm = await screen.findByRole("form", {
      name: "Add Facility Assignment"
    });
    await within(addForm).findByRole("option", { name: "Makati Training Pool" });
    await user.selectOptions(within(addForm).getByLabelText("Facility"), facilityA.id);
    await user.type(within(addForm).getByLabelText("Assigned From"), "2026-02-01");
    await user.click(
      within(addForm).getByRole("button", { name: "Add Facility Assignment" })
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Facility Assignment conflict detected. Assignment history has been refreshed."
    );
    expect(screen.queryByText("Raw duplicate message")).not.toBeInTheDocument();
    await waitFor(() =>
      expect(
        calls.filter(
          (call) =>
            call.url ===
              `/api/v1/registration/personnel/${staffA.id}/facility-assignments` &&
            call.init?.method !== "POST"
        ).length
      ).toBeGreaterThanOrEqual(2)
    );
  });

  it("sets primary only for active non-primary assignments", async () => {
    const user = userEvent.setup();
    const session = sessionWithFacilityAssignmentPermissions([
      "view_facility_assignment",
      "update_facility_assignment"
    ]);
    const { calls } = mockFetchRoutes(standardRoutesForSession(session, [
      ...assignmentRoutes([
        activePrimaryAssignment,
        activeSecondaryAssignment,
        completedAssignment
      ]),
      {
        method: "POST",
        url: `/api/v1/registration/personnel/${staffA.id}/facility-assignments/${activeSecondaryAssignment.id}/primary`,
        responses: [
          { status: 200, body: { ...activeSecondaryAssignment, is_primary_assignment: true } }
        ]
      }
    ]));

    renderWithRoute(routes.registrationPersonnel);

    const primaryRow = await screen.findByLabelText(
      "Facility Assignment Makati Training Pool"
    );
    const secondaryRow = await screen.findByLabelText(
      "Facility Assignment Bluewater Beach Zone"
    );
    const completedRow = await screen.findByLabelText(
      `Facility Assignment ${completedAssignment.facility_id}`
    );

    expect(within(primaryRow).getAllByText("Primary").length).toBeGreaterThan(0);
    expect(within(primaryRow).queryByRole("button", { name: "Set Primary" })).not.toBeInTheDocument();
    expect(within(secondaryRow).getByRole("button", { name: "Set Primary" })).toBeInTheDocument();
    expect(within(completedRow).queryByRole("button", { name: "Set Primary" })).not.toBeInTheDocument();

    await user.click(within(secondaryRow).getByRole("button", { name: "Set Primary" }));

    expect(await screen.findByText("Primary Facility Assignment updated.")).toBeInTheDocument();
    expect(
      calls.some(
        (call) =>
          call.url ===
            `/api/v1/registration/personnel/${staffA.id}/facility-assignments/${activeSecondaryAssignment.id}/primary` &&
          call.init?.method === "POST"
      )
    ).toBe(true);
  });

  it("ends only active assignments and preserves completed history", async () => {
    const user = userEvent.setup();
    const session = sessionWithFacilityAssignmentPermissions([
      "view_facility_assignment",
      "update_facility_assignment"
    ]);
    const endedAssignment: RegistrationFacilityAssignment = {
      ...activePrimaryAssignment,
      assignment_status: "COMPLETED",
      assigned_to: "2026-05-31"
    };
    const { calls } = mockFetchRoutes(standardRoutesForSession(session, [
      ...assignmentRoutes([activePrimaryAssignment, completedAssignment]),
      {
        method: "POST",
        url: `/api/v1/registration/personnel/${staffA.id}/facility-assignments/${activePrimaryAssignment.id}/end`,
        responses: [{ status: 200, body: endedAssignment }]
      }
    ]));

    renderWithRoute(routes.registrationPersonnel);

    const activeRow = await screen.findByLabelText("Facility Assignment Makati Training Pool");
    const completedRow = await screen.findByLabelText(
      `Facility Assignment ${completedAssignment.facility_id}`
    );

    expect(within(activeRow).getByRole("button", { name: "End Assignment" })).toBeInTheDocument();
    expect(within(completedRow).queryByRole("button", { name: "End Assignment" })).not.toBeInTheDocument();
    expect(within(completedRow).queryByRole("button", { name: "Set Primary" })).not.toBeInTheDocument();

    await user.click(within(activeRow).getByRole("button", { name: "End Assignment" }));
    const endForm = await screen.findByRole("form", {
      name: "End Assignment for Makati Training Pool"
    });
    await user.type(within(endForm).getByLabelText("Assigned To"), "2026-05-31");
    await user.type(within(endForm).getByLabelText("Notes"), "Rotation complete");
    await user.click(within(endForm).getByRole("button", { name: "End Assignment" }));

    expect(
      await screen.findByText("Facility Assignment ended. Assignment history is preserved.")
    ).toBeInTheDocument();
    const endCall = calls.find(
      (call) =>
        call.url ===
          `/api/v1/registration/personnel/${staffA.id}/facility-assignments/${activePrimaryAssignment.id}/end` &&
        call.init?.method === "POST"
    );
    const body = JSON.parse(String(endCall?.init?.body)) as Record<string, unknown>;

    expect(body).toEqual({
      assigned_to: "2026-05-31",
      notes: "Rotation complete"
    });
    expect(screen.queryByText("auto-select")).not.toBeInTheDocument();
    await waitFor(() =>
      expect(
        calls.filter((call) => call.url === "/api/v1/registration/personnel").length
      ).toBeGreaterThanOrEqual(2)
    );
  });

  it.each([
    [403, "You are not authorized to perform this Facility Assignment action."],
    [404, "The Personnel, Facility, or Assignment is unavailable with your current scope."],
    [500, "Facility Assignment request failed. Please try again."]
  ])("renders safe Facility Assignment errors for %i", async (status, expectedMessage) => {
    const user = userEvent.setup();
    const session = sessionWithFacilityAssignmentPermissions([
      "view_facility_assignment",
      "update_facility_assignment"
    ]);
    mockFetchRoutes(standardRoutesForSession(session, [
      ...assignmentRoutes([activeSecondaryAssignment]),
      {
        method: "POST",
        url: `/api/v1/registration/personnel/${staffA.id}/facility-assignments/${activeSecondaryAssignment.id}/primary`,
        responses: [
          {
            status,
            body: { error: { code: `HTTP_${status}`, message: "Internal detail" } }
          }
        ]
      }
    ]));

    renderWithRoute(routes.registrationPersonnel);

    const secondaryRow = await screen.findByLabelText(
      "Facility Assignment Bluewater Beach Zone"
    );
    await user.click(within(secondaryRow).getByRole("button", { name: "Set Primary" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(expectedMessage);
    expect(screen.queryByText("Internal detail")).not.toBeInTheDocument();
  });
});
