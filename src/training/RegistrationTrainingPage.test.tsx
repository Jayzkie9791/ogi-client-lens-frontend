import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { configureApiAuth } from "../api/client";
import { AppProviders } from "../app/providers/AppProviders";
import { appRoutes } from "../app/router";
import { routes } from "../app/routePaths";
import { getRefreshTokenStorageKey } from "../auth/storage";
import { AuthenticatedSession } from "../auth/types";
import { RegistrationClient } from "../registration/registrationClientApi";
import { RegistrationPersonnel } from "../registration/registrationPersonnelApi";
import {
  TrainingEnrollment,
  TrainingSession,
  TrainingTrainee
} from "./trainingApi";

const traineeAId = "00000000-0000-4000-8000-000000810001";
const traineeBId = "00000000-0000-4000-8000-000000810002";
const staffAId = "00000000-0000-4000-8000-000000820001";
const clientAId = "00000000-0000-4000-8000-000000830001";
const clientBId = "00000000-0000-4000-8000-000000830002";
const trainingSessionAId = "00000000-0000-4000-8000-000000860001";

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
    "view_training",
    "register_trainee",
    "link_training_staff_member",
    "create_training_enrollment",
    "assign_training_session"
  ]
};

const traineeA: TrainingTrainee = {
  id: traineeAId,
  student_number: null,
  full_name: "Jane Smith",
  email: "jane.smith@example.test",
  phone_number: "+63 900 000 1001",
  notes: "External trainee",
  created_at: "2026-08-17T01:00:00.000Z",
  updated_at: "2026-08-17T02:00:00.000Z",
  deleted_at: null,
  staff_member_links: []
};

const linkedTraineeA: TrainingTrainee = {
  ...traineeA,
  staff_member_links: [
    {
      id: "00000000-0000-4000-8000-000000840001",
      trainee_id: traineeAId,
      staff_member_id: staffAId,
      created_at: "2026-08-17T03:00:00.000Z",
      ended_at: null,
      staff_member: {
        id: staffAId,
        client_id: clientAId,
        full_name: "Ana Santos",
        email: "ana.santos@example.test"
      }
    }
  ]
};

const traineeB: TrainingTrainee = {
  id: traineeBId,
  student_number: "OGI-STU-2026-0002",
  full_name: "John Santos",
  email: null,
  phone_number: null,
  notes: null,
  created_at: "2026-08-18T01:00:00.000Z",
  updated_at: "2026-08-18T02:00:00.000Z",
  deleted_at: null,
  staff_member_links: []
};

const createdTrainee: TrainingTrainee = {
  id: "00000000-0000-4000-8000-000000810003",
  student_number: null,
  full_name: "New Trainee",
  email: "new.trainee@example.test",
  phone_number: null,
  notes: null,
  created_at: "2026-08-19T01:00:00.000Z",
  updated_at: "2026-08-19T01:00:00.000Z",
  deleted_at: null,
  staff_member_links: []
};

const clientA: RegistrationClient = {
  id: clientAId,
  organization_name: "Ocean Guard International",
  contact_email: "admin@ogiofficial.com",
  contact_phone: null,
  status: "ACTIVE",
  address: null,
  country: "Philippines",
  notes: null,
  created_at: "2026-08-01T00:00:00.000Z",
  updated_at: "2026-08-02T00:00:00.000Z",
  deleted_at: null
};

const clientB: RegistrationClient = {
  id: clientBId,
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

const staffA: RegistrationPersonnel = {
  id: staffAId,
  client_id: clientAId,
  user_id: null,
  full_name: "Ana Santos",
  email: "ana.santos@example.test",
  phone_number: "+63 900 000 2001",
  employment_status: "ACTIVE",
  hire_date: "2026-01-15",
  notes: null,
  created_at: "2026-08-09T00:00:00.000Z",
  updated_at: "2026-08-10T00:00:00.000Z",
  deleted_at: null
};

const staffB: RegistrationPersonnel = {
  id: "00000000-0000-4000-8000-000000820002",
  client_id: clientBId,
  user_id: null,
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

const enrollmentA: TrainingEnrollment = {
  id: "00000000-0000-4000-8000-000000850001",
  trainee_id: traineeAId,
  program_code: "OPEN_WATER_GUARDIAN",
  program: {
    program_code: "OPEN_WATER_GUARDIAN",
    certification_level: "L3",
    display_name: "Open Water Guardian",
    qualification_label: "Open Water Guardian",
    required_training_hours: 80,
    minimum_age: 18
  },
  client_id: clientAId,
  training_session_id: null,
  enrolled_at: "2026-08-17T04:00:00.000Z",
  notes: "Sponsored cohort",
  created_at: "2026-08-17T04:00:00.000Z",
  updated_at: "2026-08-17T04:00:00.000Z",
  deleted_at: null,
  trainee: {
    id: traineeAId,
    student_number: null,
    full_name: "Jane Smith",
    email: "jane.smith@example.test"
  },
  client: {
    id: clientAId,
    organization_name: "Ocean Guard International",
    status: "ACTIVE"
  },
  training_session: null
};

const trainingSessionA: TrainingSession = {
  id: trainingSessionAId,
  training_title: "Open Water Guardian Cohort A",
  operational_skill: "OPEN_WATER_RESCUE",
  training_start_date: "2026-08-22T08:00:00.000Z",
  training_end_date: "2026-08-22T16:00:00.000Z",
  duration_minutes: 480,
  facility_id: "00000000-0000-4000-8000-000000870001",
  instructor_name: "Braven Burrows",
  instructor_license_number: "OGI-INS-2026-0001",
  instructor_staff_member_id: null,
  training_notes: "Pool and open water practical block.",
  created_at: "2026-08-17T05:00:00.000Z",
  updated_at: "2026-08-17T05:00:00.000Z",
  facility: {
    id: "00000000-0000-4000-8000-000000870001",
    client_id: clientAId,
    facility_name: "Makati Training Pool",
    operational_status: "ACTIVE"
  },
  instructor_staff_member: null
};

const assignedEnrollmentA: TrainingEnrollment = {
  ...enrollmentA,
  training_session_id: trainingSessionAId,
  training_session: {
    id: trainingSessionAId,
    training_title: trainingSessionA.training_title,
    training_start_date: trainingSessionA.training_start_date,
    training_end_date: trainingSessionA.training_end_date,
    facility_id: trainingSessionA.facility_id
  }
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

  return { calls };
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

function standardRoutes(overrides: MockRoute[] = []): MockRoute[] {
  return [
    ...authRoutes(),
    ...overrides,
    {
      url: "/api/v1/training/trainees",
      responses: [{ status: 200, body: { trainees: [traineeA, traineeB] } }]
    },
    {
      url: `/api/v1/training/trainees/${traineeAId}`,
      responses: [{ status: 200, body: traineeA }]
    },
    {
      url: `/api/v1/training/trainees/${traineeAId}/enrollments`,
      responses: [{ status: 200, body: { enrollments: [enrollmentA] } }]
    }
  ];
}

beforeEach(() => {
  window.sessionStorage.clear();
  window.sessionStorage.setItem(getRefreshTokenStorageKey(), "refresh-token");
});

afterEach(() => {
  cleanup();
  configureApiAuth(null);
  vi.unstubAllGlobals();
  window.sessionStorage.clear();
});

describe("Registration Training frontend", () => {
  it("adds permission-gated Training navigation and loads the route", async () => {
    const user = userEvent.setup();
    const { calls } = mockFetchRoutes(standardRoutes());

    renderWithRoute(routes.workbench);

    await user.click(await screen.findByRole("button", { name: "Menu" }));
    await user.click(screen.getByRole("link", { name: "Registration" }));
    await user.click(await screen.findByRole("link", { name: "Training" }));

    expect(
      await screen.findByRole("heading", { name: "Training" })
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Training" })).toHaveAttribute(
      "aria-current",
      "page"
    );
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
    expect(calls.map(({ url }) => url)).toContain("/api/v1/auth/refresh");
    expect(calls.map(({ url }) => url)).toContain("/api/v1/auth/me");
    expect(calls.map(({ url }) => url)).toContain("/api/v1/training/trainees");
  });

  it("hides Training navigation without view_training and does not call Training endpoints", async () => {
    const { calls } = mockFetchRoutes(
      authRoutes({
        ...baseSession,
        permissions: ["view_client"]
      })
    );

    renderWithRoute(routes.registrationTraining);

    expect(
      await screen.findByText(
        "Your current session does not include Training registration authority."
      )
    ).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Training" })).not.toBeInTheDocument();
    expect(calls.map(({ url }) => url)).toEqual([
      "/api/v1/auth/refresh",
      "/api/v1/auth/me"
    ]);
  });

  it("renders Trainee list and detail with human identity before technical metadata", async () => {
    mockFetchRoutes(standardRoutes());

    renderWithRoute(routes.registrationTraining);

    expect(await screen.findByText("Jane Smith")).toBeInTheDocument();
    expect(screen.getByText("John Santos")).toBeInTheDocument();
    expect(screen.getByText("Student number pending")).toBeInTheDocument();
    expect(screen.getByText("OGI-STU-2026-0002")).toBeInTheDocument();

    const traineeList = screen.getByRole("list", { name: "Trainee records" });
    expect(within(traineeList).queryByText(traineeAId)).not.toBeInTheDocument();
    expect(await screen.findByText("Student number: Pending")).toBeInTheDocument();
    expect(screen.getAllByText("jane.smith@example.test").length).toBeGreaterThan(0);
    expect(screen.getByText("External trainee")).toBeInTheDocument();
  });

  it("creates a Trainee with the exact backend contract and selects the new Trainee", async () => {
    const user = userEvent.setup();
    const { calls } = mockFetchRoutes([
      ...authRoutes(),
      {
        url: "/api/v1/training/trainees",
        responses: [
          { status: 200, body: { trainees: [traineeA] } },
          { status: 200, body: { trainees: [traineeA, createdTrainee] } }
        ]
      },
      {
        url: `/api/v1/training/trainees/${traineeAId}`,
        responses: [{ status: 200, body: traineeA }]
      },
      {
        url: `/api/v1/training/trainees/${traineeAId}/enrollments`,
        responses: [{ status: 200, body: { enrollments: [] } }]
      },
      {
        method: "POST",
        url: "/api/v1/training/trainees",
        responses: [{ status: 201, body: createdTrainee }]
      },
      {
        url: `/api/v1/training/trainees/${createdTrainee.id}/enrollments`,
        responses: [{ status: 200, body: { enrollments: [] } }]
      }
    ]);

    renderWithRoute(routes.registrationTraining);

    await user.click(await screen.findByRole("button", { name: "Register Trainee" }));
    expect(screen.queryByLabelText(/Student Number/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/^Client$/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/StaffMember/i)).not.toBeInTheDocument();

    await user.type(screen.getByLabelText("Full name"), "New Trainee");
    await user.type(screen.getByLabelText("Email"), "new.trainee@example.test");
    await user.click(screen.getByRole("button", { name: "Create Trainee" }));

    await screen.findByText("Trainee registered successfully.");
    expect((await screen.findAllByText("New Trainee")).length).toBeGreaterThan(0);

    const createCall = calls.find(
      (call) => call.url === "/api/v1/training/trainees" && call.init?.method === "POST"
    );

    expect(JSON.parse(String(createCall?.init?.body))).toEqual({
      full_name: "New Trainee",
      email: "new.trainee@example.test",
      phone_number: null,
      notes: null
    });
  });

  it("cancels Trainee creation without mutation", async () => {
    const user = userEvent.setup();
    const { calls } = mockFetchRoutes(standardRoutes());

    renderWithRoute(routes.registrationTraining);

    await user.click(await screen.findByRole("button", { name: "Register Trainee" }));
    await user.type(screen.getByLabelText("Full name"), "Cancelled Trainee");
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("form", { name: "Create Trainee" })).not.toBeInTheDocument();
    expect(screen.getByText("Student number: Pending")).toBeInTheDocument();
    expect(
      calls.some(
        (call) =>
          call.url === "/api/v1/training/trainees" && call.init?.method === "POST"
      )
    ).toBe(false);
  });

  it("links Personnel by selected staff_member_id without manual UUID or name matching", async () => {
    const user = userEvent.setup();
    const { calls } = mockFetchRoutes([
      ...authRoutes(),
      {
        url: "/api/v1/training/trainees",
        responses: [{ status: 200, body: { trainees: [traineeA] } }]
      },
      {
        url: `/api/v1/training/trainees/${traineeAId}`,
        responses: [
          { status: 200, body: traineeA },
          { status: 200, body: linkedTraineeA }
        ]
      },
      {
        url: `/api/v1/training/trainees/${traineeAId}/enrollments`,
        responses: [{ status: 200, body: { enrollments: [] } }]
      },
      {
        url: "/api/v1/registration/personnel",
        responses: [{ status: 200, body: { personnel: [staffA, staffB] } }]
      },
      {
        method: "POST",
        url: `/api/v1/training/trainees/${traineeAId}/staff-member-links`,
        responses: [{ status: 201, body: linkedTraineeA.staff_member_links[0] }]
      }
    ]);

    renderWithRoute(routes.registrationTraining);

    await user.click(await screen.findByRole("button", { name: "Link Personnel" }));
    expect(screen.queryByLabelText(/uuid/i)).not.toBeInTheDocument();
    expect(screen.getByRole("option", { name: /Ana Santos/ })).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("Personnel record"), staffAId);
    await user.click(screen.getByRole("button", { name: "Save Personnel Link" }));

    await screen.findByText("Linked Personnel record successfully.");
    expect(await screen.findByText("Linked Personnel record")).toBeInTheDocument();
    expect(screen.getByText("Ana Santos")).toBeInTheDocument();

    const linkCall = calls.find((call) =>
      call.url.endsWith("/staff-member-links")
    );

    expect(JSON.parse(String(linkCall?.init?.body))).toEqual({
      staff_member_id: staffAId
    });
    expect(
      calls.some((call) => call.url.includes("facility-assignments"))
    ).toBe(false);
    expect(
      calls.some((call) => call.url.includes("user-facility-access"))
    ).toBe(false);
  });

  it("renders Enrollment list and creates Enrollment with program_code and optional client_id", async () => {
    const user = userEvent.setup();
    const { calls } = mockFetchRoutes([
      ...authRoutes(),
      {
        url: "/api/v1/training/trainees",
        responses: [{ status: 200, body: { trainees: [traineeA] } }]
      },
      {
        url: `/api/v1/training/trainees/${traineeAId}`,
        responses: [{ status: 200, body: traineeA }]
      },
      {
        url: `/api/v1/training/trainees/${traineeAId}/enrollments`,
        responses: [
          { status: 200, body: { enrollments: [enrollmentA] } },
          { status: 200, body: { enrollments: [enrollmentA] } }
        ]
      },
      {
        url: "/api/v1/registration/clients",
        responses: [{ status: 200, body: { clients: [clientA, clientB] } }]
      },
      {
        url: "/api/v1/training/sessions",
        responses: [{ status: 200, body: { sessions: [trainingSessionA] } }]
      },
      {
        method: "POST",
        url: `/api/v1/training/trainees/${traineeAId}/enrollments`,
        responses: [{ status: 201, body: assignedEnrollmentA }]
      }
    ]);

    renderWithRoute(routes.registrationTraining);

    expect(await screen.findByText("L3 - Open Water Guardian")).toBeInTheDocument();
    expect(screen.getByText("Ocean Guard International")).toBeInTheDocument();
    expect(screen.queryByText(/pass/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/fail/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/certification eligibility/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Add Enrollment" }));
    expect(screen.getByRole("option", { name: "L7 - Master Guardian Instructor" })).toBeInTheDocument();
    expect(screen.queryByLabelText(/Client UUID/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Session UUID/i)).not.toBeInTheDocument();
    expect(
      screen.getByLabelText("Training Session (optional)")
    ).toBeInTheDocument();
    expect(screen.queryByText(trainingSessionAId)).not.toBeInTheDocument();
    expect(
      screen.getByRole("option", {
        name: /Open Water Guardian Cohort A.*Braven Burrows.*Makati Training Pool/
      })
    ).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("Program"), "MASTER_GUARDIAN_INSTRUCTOR");
    await user.selectOptions(screen.getByLabelText("Sponsoring Client (optional)"), clientBId);
    await user.selectOptions(
      screen.getByLabelText("Training Session (optional)"),
      trainingSessionAId
    );
    await user.click(screen.getByRole("button", { name: "Save Enrollment" }));

    await screen.findByText("Training enrollment added successfully.");

    const enrollmentCall = calls.find(
      (call) =>
        call.url.endsWith("/enrollments") && call.init?.method === "POST"
    );

    expect(JSON.parse(String(enrollmentCall?.init?.body))).toEqual({
      program_code: "MASTER_GUARDIAN_INSTRUCTOR",
      client_id: clientBId,
      training_session_id: trainingSessionAId,
      notes: null
    });
    expect(calls.filter((call) => call.url.endsWith("/enrollments"))).toHaveLength(3);
    expect(calls.some((call) => call.url.includes("certifications"))).toBe(false);
    expect(calls.some((call) => call.url.includes("operational-evidence"))).toBe(false);
  });

  it("allows independent Enrollment with no Sponsoring Client and shows the empty state", async () => {
    const user = userEvent.setup();
    const { calls } = mockFetchRoutes([
      ...authRoutes(),
      {
        url: "/api/v1/training/trainees",
        responses: [{ status: 200, body: { trainees: [traineeA] } }]
      },
      {
        url: `/api/v1/training/trainees/${traineeAId}`,
        responses: [{ status: 200, body: traineeA }]
      },
      {
        url: `/api/v1/training/trainees/${traineeAId}/enrollments`,
        responses: [
          { status: 200, body: { enrollments: [] } },
          { status: 200, body: { enrollments: [] } }
        ]
      },
      {
        url: "/api/v1/registration/clients",
        responses: [{ status: 200, body: { clients: [clientA] } }]
      },
      {
        url: "/api/v1/training/sessions",
        responses: [{ status: 200, body: { sessions: [trainingSessionA] } }]
      },
      {
        method: "POST",
        url: `/api/v1/training/trainees/${traineeAId}/enrollments`,
        responses: [{ status: 201, body: { ...enrollmentA, client_id: null, client: null } }]
      }
    ]);

    renderWithRoute(routes.registrationTraining);

    expect(
      await screen.findByText("No training enrollments recorded.")
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Add Enrollment" }));
    await user.selectOptions(screen.getByLabelText("Program"), "GUARDIAN_RESPONDER");
    await user.click(screen.getByRole("button", { name: "Save Enrollment" }));

    const enrollmentCall = calls.find(
      (call) =>
        call.url.endsWith("/enrollments") && call.init?.method === "POST"
    );

    expect(JSON.parse(String(enrollmentCall?.init?.body))).toEqual({
      program_code: "GUARDIAN_RESPONDER",
      client_id: null,
      training_session_id: null,
      notes: null
    });
  });

  it("assigns an initial Training Session to an existing Enrollment through the governed action", async () => {
    const user = userEvent.setup();
    const { calls } = mockFetchRoutes([
      ...authRoutes(),
      {
        url: "/api/v1/training/trainees",
        responses: [{ status: 200, body: { trainees: [traineeA] } }]
      },
      {
        url: `/api/v1/training/trainees/${traineeAId}`,
        responses: [{ status: 200, body: traineeA }]
      },
      {
        url: `/api/v1/training/trainees/${traineeAId}/enrollments`,
        responses: [
          { status: 200, body: { enrollments: [enrollmentA] } },
          { status: 200, body: { enrollments: [assignedEnrollmentA] } }
        ]
      },
      {
        url: "/api/v1/training/sessions",
        responses: [{ status: 200, body: { sessions: [trainingSessionA] } }]
      },
      {
        method: "POST",
        url: `/api/v1/training/enrollments/${enrollmentA.id}/session-assignment`,
        responses: [{ status: 200, body: assignedEnrollmentA }]
      }
    ]);

    renderWithRoute(routes.registrationTraining);

    expect(await screen.findByText("L3 - Open Water Guardian")).toBeInTheDocument();
    expect(screen.getByText("None")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Assign Training Session" }));
    expect(screen.queryByLabelText(/Session UUID/i)).not.toBeInTheDocument();
    expect(screen.queryByText(trainingSessionAId)).not.toBeInTheDocument();
    expect(
      screen.getByRole("option", {
        name: /Open Water Guardian Cohort A.*Braven Burrows.*Makati Training Pool/
      })
    ).toBeInTheDocument();

    await user.selectOptions(
      screen.getByLabelText("Training Session"),
      trainingSessionAId
    );
    await user.click(
      screen.getByRole("button", { name: "Save Session Assignment" })
    );

    await screen.findByText("Training Session assigned successfully.");
    expect(await screen.findByText("Open Water Guardian Cohort A")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Assign Training Session" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Change/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Reschedule/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Clear/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Attendance/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Completion/i })).not.toBeInTheDocument();

    const assignmentCall = calls.find((call) =>
      call.url.endsWith("/session-assignment")
    );

    expect(JSON.parse(String(assignmentCall?.init?.body))).toEqual({
      training_session_id: trainingSessionAId
    });
    expect(
      calls.filter(
        (call) =>
          call.url === `/api/v1/training/trainees/${traineeAId}/enrollments`
      )
    ).toHaveLength(2);
  });

  it("hides mutation actions without independent Training permissions", async () => {
    mockFetchRoutes(
      standardRoutes([
        {
          method: "GET",
          url: "/api/v1/auth/me",
          responses: [
            {
              status: 200,
              body: {
                ...baseSession,
                permissions: ["view_training", "view_staff_member", "view_client"]
              }
            }
          ]
        }
      ]).filter(
        (route) =>
          !(route.method === "GET" && route.url === "/api/v1/auth/me" && route.responses[0]?.body === baseSession)
      )
    );

    renderWithRoute(routes.registrationTraining);

    expect(await screen.findByText("Jane Smith")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Register Trainee" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Link Personnel" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add Enrollment" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Assign Training Session" })).not.toBeInTheDocument();
  });
});
