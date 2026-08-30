import { readFileSync } from "node:fs";

import { render, screen } from "@testing-library/react";
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
  CredentialsPersonnelProjection,
  getPersonnelCredentials,
  listCredentials
} from "./credentialsApi";

const clientId = "00000000-0000-4000-8000-000000100001";
const facilityId = "00000000-0000-4000-8000-000000200001";
const staffMemberId = "00000000-0000-4000-8000-000000300001";
const secondStaffMemberId = "00000000-0000-4000-8000-000000300002";

const credentialsSession: AuthenticatedSession = {
  id: "00000000-0000-4000-8000-000000000001",
  email: "operator@example.test",
  username: null,
  fullName: "Operator One",
  status: "ACTIVE",
  clientId: null,
  facilityScopeMode: null,
  facilityIds: [],
  roles: ["Credentials"],
  permissions: [
    "view_staff_member",
    "view_certification",
    "view_operational_authorization"
  ]
};

const registrationSession: AuthenticatedSession = {
  ...credentialsSession,
  roles: ["Registration"],
  permissions: ["view_client", "view_facility", "view_staff_member"]
};

const restrictedCredentialsSession: AuthenticatedSession = {
  ...credentialsSession,
  permissions: ["view_staff_member"]
};

const anaCredentials: CredentialsPersonnelProjection = {
  id: staffMemberId,
  full_name: "Ana Santos",
  hire_date: "2026-01-15",
  employment_status: "ACTIVE",
  client: {
    id: clientId,
    organization_name: "Ocean Guard International"
  },
  facilities: [
    {
      id: facilityId,
      facility_name: "Makati Training Pool",
      assignment_status: "ACTIVE",
      is_primary_assignment: true
    }
  ],
  qualifications: [
    {
      source_type: "CERTIFICATION",
      source_id: "certification-1",
      label: "Certification L2",
      status: "ACTIVE",
      issue_date: "2026-01-01T00:00:00.000Z",
      expiry_date: "2027-01-01T00:00:00.000Z"
    },
    {
      source_type: "CERTIFICATION_ENDORSEMENT",
      source_id: "certification-1:POOL",
      label: "Endorsement POOL",
      status: "ACTIVE",
      issue_date: "2026-01-02T00:00:00.000Z",
      expiry_date: "2027-01-01T00:00:00.000Z"
    },
    {
      source_type: "OPERATIONAL_AUTHORIZATION",
      source_id: "authorization-1",
      label: "Operational Authorization L2",
      status: "ACTIVE",
      issue_date: "2026-01-03T00:00:00.000Z",
      expiry_date: "2027-01-03T00:00:00.000Z"
    }
  ]
};

const jamieCredentials: CredentialsPersonnelProjection = {
  id: secondStaffMemberId,
  full_name: "Jamie Brooks",
  hire_date: null,
  employment_status: "SEASONAL",
  client: {
    id: "00000000-0000-4000-8000-000000100002",
    organization_name: "Bluewater Resorts"
  },
  facilities: [
    {
      id: "00000000-0000-4000-8000-000000200002",
      facility_name: "Bluewater Beach Zone",
      assignment_status: "ACTIVE",
      is_primary_assignment: false
    }
  ],
  qualifications: []
};

const credentialsListResponse: CredentialsListResponse = {
  personnel: [anaCredentials, jamieCredentials]
};

const anaCredentialsDetail: CredentialsPersonnelDetailProjection = {
  ...anaCredentials,
  email: "ana.santos@example.test",
  phone_number: "+63 900 000 3001",
  notes: "Credential projection fixture",
  certifications: [
    {
      id: "00000000-0000-4000-8000-000000400001",
      business_identifier: "CERTIFICATION-2026-000001",
      certification_level: "L2",
      certification_number: "CERT-001",
      certification_status: "ACTIVE",
      issue_date: "2026-01-01T00:00:00.000Z",
      expiry_date: "2027-01-01T00:00:00.000Z",
      medical_clearance_provided: true,
      fitness_standard_achieved: true,
      training_hours_completed: 40,
      written_exam_score: 91,
      endorsements: [
        {
          endorsement: "POOL",
          created_at: "2026-01-02T00:00:00.000Z"
        }
      ]
    }
  ],
  operational_authorizations: [
    {
      id: "00000000-0000-4000-8000-000000500001",
      business_identifier: "AUTHORIZATION-2026-000001",
      authorization_number: "AUTH-001",
      authorization_level: "L2",
      authorization_status: "ACTIVE",
      issue_date: "2026-01-03T00:00:00.000Z",
      expiry_date: "2027-01-03T00:00:00.000Z",
      renewal_date: null,
      certification_id: "00000000-0000-4000-8000-000000400001",
      previous_authorization_id: null
    }
  ]
};

const restrictedCredentialsDetail: CredentialsPersonnelDetailProjection = {
  ...anaCredentialsDetail,
  qualifications: [],
  certifications: [],
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

function authRoutes(session = credentialsSession): MockRoute[] {
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

function standardCredentialRoutes(session = credentialsSession): MockRoute[] {
  return [
    ...authRoutes(session),
    {
      url: "/api/v1/credentials",
      responses: [{ status: 200, body: credentialsListResponse }]
    },
    {
      url: `/api/v1/credentials/personnel/${staffMemberId}`,
      responses: [{ status: 200, body: anaCredentialsDetail }]
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

describe("Credentials V1 frontend", () => {
  it("exposes permission-aware Credentials navigation and preserves Registration routes", async () => {
    const user = userEvent.setup();
    const { calls } = mockFetchRoutes([
      ...authRoutes(registrationSession),
      {
        url: "/api/v1/registration/clients",
        responses: [{ status: 200, body: { clients: [] } }]
      }
    ]);

    renderWithRoute(routes.workbench);

    await user.click(await screen.findByRole("button", { name: "Menu" }));

    expect(screen.getByRole("link", { name: "Credentials & Certifications" })).toHaveAttribute(
      "href",
      routes.credentials
    );
    expect(screen.getByRole("link", { name: "Registration" })).toHaveAttribute(
      "href",
      routes.registrationClients
    );

    await user.click(screen.getByRole("link", { name: "Registration" }));

    expect(
      await screen.findByRole("heading", { name: "Clients / Organizations" })
    ).toBeInTheDocument();
    expect(calls.some((call) => call.url.startsWith("/api/v1/credentials"))).toBe(false);
  });

  it("hides Credentials navigation when the actor lacks view_staff_member", async () => {
    mockFetchRoutes([
      ...authRoutes({
        ...credentialsSession,
        permissions: ["view_operational_evidence"]
      })
    ]);

    renderWithRoute(routes.workbench);

    await userEvent.click(await screen.findByRole("button", { name: "Menu" }));

    expect(screen.queryByRole("link", { name: "Credentials & Certifications" })).not.toBeInTheDocument();
  });

  it("renders loading, success, empty, and error states for the personnel-centered list", async () => {
    mockFetchRoutes([
      ...authRoutes(),
      {
        url: "/api/v1/credentials",
        responses: [{ status: 200, body: { personnel: [] } }]
      }
    ]);

    renderWithRoute(routes.credentials);

    expect(await screen.findByText("Loading personnel credential records.")).toBeInTheDocument();
    expect(
      await screen.findByRole("heading", {
        name: "No personnel credential records are available."
      })
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

    renderWithRoute(routes.credentials);

    expect(
      await screen.findByRole("heading", { name: "Credentials could not be loaded." })
    ).toBeInTheDocument();
  });

  it("renders one row per Personnel identity with name, hire date, status, and projected qualifications", async () => {
    const { calls } = mockFetchRoutes(standardCredentialRoutes());

    renderWithRoute(routes.credentials);

    expect(
      await screen.findByRole("heading", { name: "Personnel Credentials" })
    ).toBeInTheDocument();
    await screen.findByText("Ana Santos");
    expect(screen.getByRole("columnheader", { name: "Personnel / Lifeguard Name" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Hire Date" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Employment Status" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Qualifications" })).toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: /position/i })).not.toBeInTheDocument();
    expect(screen.queryByText("job_title")).not.toBeInTheDocument();
    expect(screen.getByText("Ana Santos")).toBeInTheDocument();
    expect(screen.getByText("2026-01-15")).toBeInTheDocument();
    expect(screen.getByText("Certification L2")).toBeInTheDocument();
    expect(screen.getByText("Endorsement POOL")).toBeInTheDocument();
    expect(screen.getByText("Operational Authorization L2")).toBeInTheDocument();
    expect(screen.getByText("Jamie Brooks")).toBeInTheDocument();
    expect(screen.getByText("Qualification projection is unavailable or not returned.")).toBeInTheDocument();
    expect(calls.map(({ url }) => url)).toEqual([
      "/api/v1/auth/refresh",
      "/api/v1/auth/me",
      "/api/v1/credentials"
    ]);
  });

  it("uses only backend-supported Credentials filters", async () => {
    const user = userEvent.setup();
    const { calls } = mockFetchRoutes([
      ...standardCredentialRoutes(),
      {
        url: `/api/v1/credentials?clientId=${clientId}`,
        responses: [{ status: 200, body: { personnel: [anaCredentials] } }]
      },
      {
        url: `/api/v1/credentials?clientId=${clientId}&facilityId=${facilityId}`,
        responses: [{ status: 200, body: { personnel: [anaCredentials] } }]
      },
      {
        url: `/api/v1/credentials?clientId=${clientId}&facilityId=${facilityId}&employmentStatus=ACTIVE`,
        responses: [{ status: 200, body: { personnel: [anaCredentials] } }]
      },
      {
        url: `/api/v1/credentials?clientId=${clientId}&facilityId=${facilityId}&employmentStatus=ACTIVE&certificationStatus=ACTIVE`,
        responses: [{ status: 200, body: { personnel: [anaCredentials] } }]
      }
    ]);

    renderWithRoute(routes.credentials);

    await screen.findByText("Ana Santos");
    await user.selectOptions(screen.getByLabelText("Client filter"), clientId);
    await screen.findByText("Makati Training Pool");
    await user.selectOptions(screen.getByLabelText("Facility filter"), facilityId);
    await user.selectOptions(screen.getByLabelText("Employment status filter"), "ACTIVE");
    await user.selectOptions(screen.getByLabelText("Certification status filter"), "ACTIVE");

    expect(calls.map(({ url }) => url)).toContain(
      `/api/v1/credentials?clientId=${clientId}`
    );
    expect(calls.map(({ url }) => url)).toContain(
      `/api/v1/credentials?clientId=${clientId}&facilityId=${facilityId}`
    );
    expect(calls.map(({ url }) => url)).toContain(
      `/api/v1/credentials?clientId=${clientId}&facilityId=${facilityId}&employmentStatus=ACTIVE`
    );
    expect(calls.map(({ url }) => url)).toContain(
      `/api/v1/credentials?clientId=${clientId}&facilityId=${facilityId}&employmentStatus=ACTIVE&certificationStatus=ACTIVE`
    );
  });

  it("renders Personnel detail, certifications, endorsements, and operational authorizations", async () => {
    const user = userEvent.setup();
    const { calls } = mockFetchRoutes(standardCredentialRoutes());

    renderWithRoute(routes.credentials);

    await screen.findByText("Ana Santos");
    await user.click(screen.getAllByRole("link", { name: "Open Credentials" })[0]);

    expect(await screen.findByRole("heading", { name: "Ana Santos" })).toBeInTheDocument();
    expect(screen.getByText("Ocean Guard International")).toBeInTheDocument();
    expect(screen.getByText("Makati Training Pool")).toBeInTheDocument();
    expect(screen.getByText("CERT-001")).toBeInTheDocument();
    expect(screen.getByText("2027-01-01")).toBeInTheDocument();
    expect(screen.getByText("POOL")).toBeInTheDocument();
    expect(screen.getByText("AUTH-001")).toBeInTheDocument();
    expect(screen.getByText("2027-01-03")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /create credential/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /edit credential/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /issue credential/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /revoke/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/qr/i)).not.toBeInTheDocument();
    expect(calls.map(({ url }) => url)).toEqual([
      "/api/v1/auth/refresh",
      "/api/v1/auth/me",
      "/api/v1/credentials",
      `/api/v1/credentials/personnel/${staffMemberId}`
    ]);
  });

  it("uses neutral wording when restricted certification and authorization projections are omitted", async () => {
    mockFetchRoutes([
      ...authRoutes(restrictedCredentialsSession),
      {
        url: `/api/v1/credentials/personnel/${staffMemberId}`,
        responses: [{ status: 200, body: restrictedCredentialsDetail }]
      }
    ]);

    renderWithRoute(routes.credentialsPersonnelPath(staffMemberId));

    expect(await screen.findByRole("heading", { name: "Ana Santos" })).toBeInTheDocument();
    expect(screen.getByText("Qualification projection is unavailable or not returned.")).toBeInTheDocument();
    expect(screen.getByText("Certification records are not available in this projection.")).toBeInTheDocument();
    expect(screen.getByText("Operational Authorization records are not available in this projection.")).toBeInTheDocument();
    expect(screen.queryByText("No qualifications")).not.toBeInTheDocument();
  });

  it("keeps the Credentials API adapter GET-only and outside Registration, OETS, Assessment, ORI, digital issuance, and Module 6A", async () => {
    const { calls } = mockFetchRoutes([
      {
        url: "/api/v1/credentials",
        responses: [{ status: 200, body: credentialsListResponse }]
      },
      {
        url: `/api/v1/credentials/personnel/${staffMemberId}`,
        responses: [{ status: 200, body: anaCredentialsDetail }]
      }
    ]);

    await listCredentials();
    await getPersonnelCredentials(staffMemberId);

    expect(calls.map(({ url }) => url)).toEqual([
      "/api/v1/credentials",
      `/api/v1/credentials/personnel/${staffMemberId}`
    ]);
    expect(calls.map(({ init }) => init?.method ?? "GET")).toEqual(["GET", "GET"]);

    const adapterSource = readFileSync(
      "src/credentials/credentialsApi.ts",
      "utf8"
    );

    for (const forbidden of ["POST", "PATCH", "PUT", "DELETE"]) {
      expect(adapterSource).not.toContain(forbidden);
    }

    for (const forbidden of [
      "/api/v1/registration",
      "/api/v1/operational-evidence",
      "/api/v1/assessment",
      "/api/v1/ori",
      "ori_score",
      "qr_code",
      "wallet",
      "ceu"
    ]) {
      expect(adapterSource.toLowerCase()).not.toContain(forbidden.toLowerCase());
    }
  });
});
