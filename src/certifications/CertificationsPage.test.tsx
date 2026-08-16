import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { configureApiAuth } from "../api/client";
import { AppProviders } from "../app/providers/AppProviders";
import { appRoutes } from "../app/router";
import { routes } from "../app/routePaths";
import { getRefreshTokenStorageKey } from "../auth/storage";
import { AuthenticatedSession } from "../auth/types";
import {
  CredentialsListResponse,
  CredentialsPersonnelDetailProjection,
  CredentialsPersonnelProjection
} from "../credentials/credentialsApi";

const clientId = "00000000-0000-4000-8000-000000100001";
const staffMemberId = "00000000-0000-4000-8000-000000300001";
const secondStaffMemberId = "00000000-0000-4000-8000-000000300002";
const certificationId = "00000000-0000-4000-8000-000000400001";
const newCertificationId = "00000000-0000-4000-8000-000000400002";

const certificationSession: AuthenticatedSession = {
  id: "00000000-0000-4000-8000-000000000001",
  email: "operator@example.test",
  username: null,
  fullName: "Operator One",
  status: "ACTIVE",
  clientId: null,
  facilityScopeMode: null,
  facilityIds: [],
  roles: ["Certification Viewer"],
  permissions: ["view_staff_member", "view_certification"]
};

const draftSession: AuthenticatedSession = {
  ...certificationSession,
  permissions: [
    "view_staff_member",
    "view_certification",
    "create_certification_draft"
  ]
};

const issueSession: AuthenticatedSession = {
  ...draftSession,
  permissions: [...draftSession.permissions, "issue_certification"]
};

const credentialsOnlySession: AuthenticatedSession = {
  ...certificationSession,
  permissions: ["view_staff_member"]
};

const noCreateSession: AuthenticatedSession = certificationSession;

const anaProjection: CredentialsPersonnelProjection = {
  id: staffMemberId,
  full_name: "Ana Santos",
  hire_date: "2026-01-15",
  employment_status: "ACTIVE",
  client: {
    id: clientId,
    organization_name: "Ocean Guard International"
  },
  facilities: [],
  qualifications: [
    {
      source_type: "CERTIFICATION",
      source_id: certificationId,
      label: "Open Water Guardian",
      status: "ACTIVE",
      issue_date: "2026-01-01T00:00:00.000Z",
      expiry_date: "2027-01-01T00:00:00.000Z"
    }
  ]
};

const jamieProjection: CredentialsPersonnelProjection = {
  id: secondStaffMemberId,
  full_name: "Jamie Brooks",
  hire_date: null,
  employment_status: "SEASONAL",
  client: {
    id: "00000000-0000-4000-8000-000000100002",
    organization_name: "Bluewater Resorts"
  },
  facilities: [],
  qualifications: []
};

const credentialsListResponse: CredentialsListResponse = {
  personnel: [anaProjection, jamieProjection]
};

const credentialsListWithNewCertification: CredentialsListResponse = {
  personnel: [
    {
      ...anaProjection,
      qualifications: [
        ...anaProjection.qualifications,
        {
          source_type: "CERTIFICATION",
          source_id: newCertificationId,
          label: "L3",
          status: "PENDING",
          issue_date: "2026-02-01T00:00:00.000Z",
          expiry_date: "2027-02-01T00:00:00.000Z"
        }
      ]
    },
    jamieProjection
  ]
};

const anaDetail: CredentialsPersonnelDetailProjection = {
  ...anaProjection,
  email: "ana.santos@example.test",
  phone_number: "+63 900 000 3001",
  notes: "Certification workspace fixture",
  certifications: [
    {
      id: certificationId,
      certification_level: "L3",
      program: {
        program_code: "OPEN_WATER_GUARDIAN",
        certification_level: "L3",
        display_name: "Open Water Guardian",
        qualification_label: "Open Water Guardian",
        validity_period: {
          unit: "YEAR",
          value: 1
        },
        teaching_authority_levels: [],
        certificate_eligible: true,
        certificate_template_family_code: "OGI_L1_L7_CERTIFICATE_FAMILY",
        certificate_template_variant_code: null
      },
      certification_number: "CERT-001",
      certification_status: "ACTIVE",
      issue_date: "2026-01-01T00:00:00.000Z",
      expiry_date: "2027-01-01T00:00:00.000Z",
      medical_clearance_provided: true,
      fitness_standard_achieved: true,
      training_hours_completed: 60,
      written_exam_score: 91,
      endorsements: [
        {
          endorsement: "OPEN_WATER",
          created_at: "2026-01-02T00:00:00.000Z"
        }
      ]
    },
    {
      id: newCertificationId,
      certification_level: "L3",
      certification_number: "CERT-002",
      certification_status: "PENDING",
      issue_date: "2026-02-01T00:00:00.000Z",
      expiry_date: "2027-02-01T00:00:00.000Z",
      medical_clearance_provided: false,
      fitness_standard_achieved: false,
      training_hours_completed: null,
      written_exam_score: null,
      endorsements: []
    }
  ],
  operational_authorizations: []
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

function authRoutes(session = certificationSession): MockRoute[] {
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

beforeEach(() => {
  window.sessionStorage.clear();
  window.sessionStorage.setItem(getRefreshTokenStorageKey(), "refresh-token");
});

afterEach(() => {
  configureApiAuth(null);
  vi.unstubAllGlobals();
  window.sessionStorage.clear();
});

describe("Certification workspace frontend", () => {
  it("exposes one certification-aware navigation entry and preserves existing Credentials deep links", async () => {
    const user = userEvent.setup();
    mockFetchRoutes([
      ...authRoutes(),
      {
        url: "/api/v1/credentials",
        responses: [{ status: 200, body: credentialsListResponse }]
      }
    ]);

    renderWithRoute(routes.workbench);

    await user.click(await screen.findByRole("button", { name: "Menu" }));

    expect(
      screen.getByRole("link", { name: "Credentials & Certifications" })
    ).toHaveAttribute("href", routes.certifications);
    expect(screen.queryByRole("link", { name: "Certifications" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Certificates" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("link", { name: "Credentials & Certifications" }));

    expect(
      await screen.findByRole("heading", { name: "Certification Registry" })
    ).toBeInTheDocument();

    cleanup();
    vi.unstubAllGlobals();
    window.sessionStorage.clear();
    window.sessionStorage.setItem(getRefreshTokenStorageKey(), "refresh-token");
    mockFetchRoutes([
      ...authRoutes(),
      {
        url: "/api/v1/credentials",
        responses: [{ status: 200, body: credentialsListResponse }]
      }
    ]);

    renderWithRoute(routes.credentials);

    expect(
      await screen.findByRole("heading", { name: "Personnel Credentials" })
    ).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /dev-preview/i })).not.toBeInTheDocument();
  });

  it("does not present the Certification section without view_certification", async () => {
    mockFetchRoutes(authRoutes(credentialsOnlySession));

    renderWithRoute(routes.certifications);

    expect(
      await screen.findByRole("heading", {
        name: "Certifications are not available with your current authorization."
      })
    ).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Certification Registry" })).not.toBeInTheDocument();
  });

  it("renders Certification registry rows from the Credentials read projection without making UUIDs primary", async () => {
    const { calls } = mockFetchRoutes([
      ...authRoutes(),
      {
        url: "/api/v1/credentials",
        responses: [{ status: 200, body: credentialsListResponse }]
      }
    ]);

    renderWithRoute(routes.certifications);

    expect(
      await screen.findByRole("heading", { name: "Certification Registry" })
    ).toBeInTheDocument();
    expect(await screen.findByText("Ana Santos")).toBeInTheDocument();
    expect(screen.getByText("Ocean Guard International")).toBeInTheDocument();
    expect(screen.getByText("Open Water Guardian")).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.queryByText(certificationId)).not.toBeInTheDocument();
    expect(calls.map(({ url }) => url)).toEqual([
      "/api/v1/auth/refresh",
      "/api/v1/auth/me",
      "/api/v1/credentials"
    ]);
  });

  it("selects a Certification and renders read-only detail, endorsements, and no command controls", async () => {
    const user = userEvent.setup();
    const { calls } = mockFetchRoutes([
      ...authRoutes(),
      {
        url: "/api/v1/credentials",
        responses: [{ status: 200, body: credentialsListResponse }]
      },
      {
        url: `/api/v1/credentials/personnel/${staffMemberId}`,
        responses: [{ status: 200, body: anaDetail }]
      }
    ]);

    renderWithRoute(routes.certifications);

    await user.click(await screen.findByRole("button", { name: "View Certification" }));

    expect(await screen.findByText("CERT-001")).toBeInTheDocument();
    expect(screen.getByText("OPEN_WATER")).toBeInTheDocument();
    expect(screen.getByText(certificationId)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /endorse/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /renew/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /suspend/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /issue credential/i })).not.toBeInTheDocument();
    expect(calls.map(({ url }) => url)).toEqual([
      "/api/v1/auth/refresh",
      "/api/v1/auth/me",
      "/api/v1/credentials",
      `/api/v1/credentials/personnel/${staffMemberId}`
    ]);
  });

  it("renders loading, empty, and safe error states", async () => {
    mockFetchRoutes([
      ...authRoutes(),
      {
        url: "/api/v1/credentials",
        responses: [{ status: 200, body: { personnel: [] } }]
      }
    ]);

    renderWithRoute(routes.certifications);

    expect(await screen.findByText("Loading certification records.")).toBeInTheDocument();
    expect(
      await screen.findByRole("heading", { name: "No certifications found." })
    ).toBeInTheDocument();

    vi.unstubAllGlobals();
    window.sessionStorage.clear();
    window.sessionStorage.setItem(getRefreshTokenStorageKey(), "refresh-token");
    mockFetchRoutes([
      ...authRoutes(),
      {
        url: "/api/v1/credentials",
        responses: [
          {
            status: 500,
            body: { error: { code: "INTERNAL_SERVER_ERROR", message: "Failed" } }
          }
        ]
      }
    ]);

    renderWithRoute(routes.certifications);

    expect(
      await screen.findByRole("heading", { name: "Certifications could not be loaded." })
    ).toBeInTheDocument();
  });

  it("hides create from view-only actors and limits draft-only actors to Draft status", async () => {
    mockFetchRoutes([
      ...authRoutes(noCreateSession),
      {
        url: "/api/v1/credentials",
        responses: [{ status: 200, body: credentialsListResponse }]
      }
    ]);

    renderWithRoute(routes.certifications);

    expect(
      await screen.findByRole("heading", { name: "Certification Registry" })
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Create Certification" })).not.toBeInTheDocument();

    vi.unstubAllGlobals();
    window.sessionStorage.clear();
    window.sessionStorage.setItem(getRefreshTokenStorageKey(), "refresh-token");
    mockFetchRoutes([
      ...authRoutes(draftSession),
      {
        url: "/api/v1/credentials",
        responses: [{ status: 200, body: credentialsListResponse }]
      }
    ]);

    renderWithRoute(routes.certifications);
    await userEvent.click(await screen.findByRole("button", { name: "Create Certification" }));

    expect(screen.getByLabelText("Status")).toHaveValue("PENDING");
    expect(screen.getByRole("option", { name: "Draft" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Active" })).not.toBeInTheDocument();
  });

  it("submits the exact Certification create contract, refreshes projection, and selects the new Certification", async () => {
    const user = userEvent.setup();
    const { calls } = mockFetchRoutes([
      ...authRoutes(issueSession),
      {
        url: "/api/v1/credentials",
        responses: [
          { status: 200, body: credentialsListResponse },
          { status: 200, body: credentialsListWithNewCertification }
        ]
      },
      {
        method: "POST",
        url: "/api/v1/certifications",
        responses: [
          {
            status: 201,
            body: {
              success: true,
              data: {
                id: newCertificationId,
                certification_level: "L3",
                certification_number: "CERT-002",
                issue_date: "2026-02-01T00:00:00.000Z",
                expiry_date: "2027-02-01T00:00:00.000Z",
                medical_clearance_provided: true,
                fitness_standard_achieved: true,
                training_hours_completed: 60,
                written_exam_score: 92,
                certification_status: "ACTIVE",
                staff_member_id: staffMemberId,
                created_by_user_id: issueSession.id
              }
            }
          }
        ]
      },
      {
        url: `/api/v1/credentials/personnel/${staffMemberId}`,
        responses: [{ status: 200, body: anaDetail }]
      }
    ]);

    renderWithRoute(routes.certifications);

    await user.click(await screen.findByRole("button", { name: "Create Certification" }));
    await user.selectOptions(screen.getByLabelText("Personnel"), staffMemberId);
    await user.selectOptions(screen.getByLabelText("Certification level"), "L3");
    await user.selectOptions(screen.getByLabelText("Status"), "ACTIVE");
    await user.type(screen.getByLabelText("Certification number"), "CERT-002");
    await user.type(screen.getByLabelText("Issue date"), "2026-02-01");
    await user.type(screen.getByLabelText("Expiry date"), "2027-02-01");
    await user.click(screen.getByLabelText("Medical clearance provided"));
    await user.click(screen.getByLabelText("Fitness standard achieved"));
    await user.type(screen.getByLabelText("Training hours"), "60");
    await user.type(screen.getByLabelText("Written exam score"), "92");
    const createButtons = screen.getAllByRole("button", { name: "Create Certification" });
    const submitButton = createButtons[createButtons.length - 1];

    expect(submitButton).toBeDefined();
    await user.click(submitButton);

    await waitFor(() =>
      expect(calls.some((call) => call.url === `/api/v1/credentials/personnel/${staffMemberId}`)).toBe(true)
    );

    const createCall = calls.find(
      (call) => call.url === "/api/v1/certifications" && call.init?.method === "POST"
    );

    expect(JSON.parse(String(createCall?.init?.body))).toEqual({
      certification_level: "L3",
      certification_number: "CERT-002",
      issue_date: "2026-02-01T00:00:00.000Z",
      expiry_date: "2027-02-01T00:00:00.000Z",
      medical_clearance_provided: true,
      fitness_standard_achieved: true,
      training_hours_completed: 60,
      written_exam_score: 92,
      certification_status: "ACTIVE",
      staff_member_id: staffMemberId
    });
    expect(await screen.findByText("CERT-002")).toBeInTheDocument();
    expect(calls.map(({ url }) => url)).not.toContain("/api/v1/credentials/issuances");
    expect(calls.map(({ url }) => url)).not.toContain("/api/v1/operational-authorizations");
    expect(calls.map(({ url }) => url)).not.toContain("/api/v1/registration/facility-assignments");
    expect(calls.map(({ url }) => url)).not.toContain("/api/v1/auth/user-facility-access");
  });
});
