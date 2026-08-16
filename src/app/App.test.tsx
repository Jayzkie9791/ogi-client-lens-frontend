import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { afterEach, beforeEach, expect, vi } from "vitest";

import { apiRequest, configureApiAuth } from "../api/client";
import { isAuthenticatedSession } from "../auth/guards";
import { getRefreshTokenStorageKey } from "../auth/storage";
import { AppProviders } from "./providers/AppProviders";
import { appRoutes } from "./router";
import { routes } from "./routePaths";

const session = {
  id: "user-1",
  email: "operator@example.test",
  username: null,
  fullName: "Operator One",
  status: "ACTIVE",
  clientId: "00000000-0000-4000-8000-000000000101",
  facilityScopeMode: "EXPLICIT",
  facilityIds: ["00000000-0000-4000-8000-000000000201"],
  roles: ["Operator"],
  permissions: ["view_operational_evidence"]
};

const submitCapableSession = {
  ...session,
  permissions: ["view_operational_evidence", "submit_operational_evidence"]
};

const administrationSession = {
  ...session,
  roles: ["Administration Viewer"],
  permissions: ["view_operational_evidence", "view_users"]
};

const administrationUsersResponse = [
  {
    id: "00000000-0000-4000-8000-000000000901",
    email: "marvin.alcantara@ogiofficial.com",
    username: null,
    full_name: "Marvin Alcantara",
    status: "ACTIVE",
    created_at: "2026-08-01T00:00:00.000Z"
  },
  {
    id: "00000000-0000-4000-8000-000000000902",
    email: null,
    username: "braven.burrows",
    full_name: "Braven Burrows",
    status: "INVITED",
    created_at: "2026-08-02T00:00:00.000Z"
  }
];
const catalogResponse = {
  templates: [
    {
      template_registry_id: "00000000-0000-4000-8000-000000000301",
      template_version_id: "00000000-0000-4000-8000-000000000401",
      template_code: "OGI_F001_WEEKLY_SAFETY_AUDIT_CHECKLIST",
      template_name: "Weekly Safety Audit Checklist",
      template_archetype: "CHECKLIST_INSPECTION",
      module: "MODULE_A",
      template_version: "1.0.0",
      schema_version: "1.0",
      checksum: "checksum-a",
      registry_status: "ACTIVE",
      version_status: "ACTIVE",
      description: "Capture weekly operational safety audit evidence.",
      business_context: {
        enterprise_capability: "Operational Governance",
        supporting_capabilities: ["Audit Management"],
        operational_domain: "Safety Operations",
        business_process: "Weekly safety audit",
        evidence_type: "INSPECTION",
        governance_scope: "Operational evidence",
        description: "Business context description"
      },
      document_number: "OGI-F001",
      document_revision: "Rev A",
      registered_at: "2026-08-01T00:00:00.000Z",
      last_synchronized_at: "2026-08-01T00:00:00.000Z"
    },
    {
      template_registry_id: "00000000-0000-4000-8000-000000000302",
      template_version_id: "00000000-0000-4000-8000-000000000402",
      template_code: "OGI_F903_RISK_REGISTER",
      template_name: "Risk Register",
      template_archetype: "OPERATIONAL_REGISTER",
      module: "MODULE_B",
      template_version: "1.0.0",
      schema_version: "1.0",
      checksum: "checksum-b",
      registry_status: "ACTIVE",
      version_status: "ACTIVE",
      description: null,
      business_context: {
        enterprise_capability: "Operational Governance",
        supporting_capabilities: null,
        operational_domain: "Risk Management",
        business_process: "Risk register maintenance",
        evidence_type: "REGISTER",
        governance_scope: "Operational evidence",
        description: "Maintain risk register evidence."
      },
      document_number: null,
      document_revision: "Rev B",
      registered_at: "2026-08-01T00:00:00.000Z",
      last_synchronized_at: null
    }
  ]
};


const recordsResponse = {
  records: [
    {
      evidence_record_id: "00000000-0000-4000-8000-000000000501",
      template_registry_id: "00000000-0000-4000-8000-000000000301",
      template_version_id: "00000000-0000-4000-8000-000000000401",
      template_code: "OGI_F001_WEEKLY_SAFETY_AUDIT_CHECKLIST",
      template_version: "1.0.0",
      schema_version: "1.0",
      client_id: "00000000-0000-4000-8000-000000000101",
      facility_id: "00000000-0000-4000-8000-000000000201",
      lifecycle_state: "SUBMITTED",
      payload_checksum: "payload-checksum-1",
      created_by_user_id: "00000000-0000-4000-8000-000000000901",
      submitted_by_user_id: "00000000-0000-4000-8000-000000000902",
      created_at: "2026-08-01T00:00:00.000Z",
      submitted_at: "2026-08-02T00:00:00.000Z",
      updated_at: "2026-08-03T00:00:00.000Z"
    }
  ],
  pagination: {
    limit: 25,
    offset: 0,
    count: 1,
    total_count: 40
  }
};

const secondRecordsPageResponse = {
  records: [
    {
      ...recordsResponse.records[0],
      evidence_record_id: "00000000-0000-4000-8000-000000000502",
      template_code: "OGI_F903_RISK_REGISTER",
      lifecycle_state: "INTAKE_APPROVED",
      submitted_at: "2026-08-04T00:00:00.000Z"
    }
  ],
  pagination: {
    limit: 25,
    offset: 25,
    count: 1,
    total_count: 26
  }
};

const queueEvidenceRecord = {
  id: "00000000-0000-4000-8000-000000000701",
  template_provenance: {
    template_id: "00000000-0000-4000-8000-000000000301",
    template_code: "OGI_F001_WEEKLY_SAFETY_AUDIT_CHECKLIST",
    template_version: "1.0.0",
    template_registry_id: "00000000-0000-4000-8000-000000000301",
    template_version_id: "00000000-0000-4000-8000-000000000401",
    schema_version: "1.0",
    checksum: "checksum-a"
  },
  client_id: "00000000-0000-4000-8000-000000000101",
  facility_id: "00000000-0000-4000-8000-000000000201",
  lifecycle_state: "SUBMITTED",
  payload: {
    sections: {}
  },
  payload_checksum: "payload-checksum-queue",
  created_by_user_id: "00000000-0000-4000-8000-000000000901",
  submitted_by_user_id: "00000000-0000-4000-8000-000000000902",
  created_at: "2026-08-01T00:00:00.000Z",
  submitted_at: "2026-08-02T00:00:00.000Z",
  updated_at: "2026-08-03T00:00:00.000Z"
};

const queueClaim = {
  id: "00000000-0000-4000-8000-000000000801",
  evidence_record_id: queueEvidenceRecord.id,
  template_version_id: queueEvidenceRecord.template_provenance.template_version_id,
  governance_authority_code: "OGI",
  lifecycle_state: "SUBMITTED",
  transition_trigger: "begin_ogi_review",
  claim_status: "ACTIVE",
  claimed_by_user_id: session.id,
  claimed_at: "2026-08-02T00:10:00.000Z",
  released_at: null,
  completed_at: null,
  created_at: "2026-08-02T00:10:00.000Z",
  updated_at: "2026-08-02T00:10:00.000Z"
};

const unclaimedQueueResponse = [
  {
    evidence_record: queueEvidenceRecord,
    governance_authority_code: "OGI",
    lifecycle_state: "SUBMITTED",
    transition_trigger: "begin_ogi_review",
    target_state: "UNDER_OGI_REVIEW",
    active_claim: null
  }
];

const ownedClaimQueueResponse = [
  {
    ...unclaimedQueueResponse[0],
    active_claim: queueClaim
  }
];

const otherClaimQueueResponse = [
  {
    ...unclaimedQueueResponse[0],
    active_claim: {
      ...queueClaim,
      claimed_by_user_id: "00000000-0000-4000-8000-000000000999"
    }
  }
];

interface MockResponse {
  status: number;
  body?: unknown;
  statusText?: string;
}

function renderWithRoute(initialPath: string) {
  const testRouter = createMemoryRouter(appRoutes, {
    initialEntries: [initialPath]
  });

  return render(
    <AppProviders>
      <RouterProvider router={testRouter} />
    </AppProviders>
  );
}

function mockFetchQueue(responses: MockResponse[]) {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const next = responses.shift();

    calls.push({
      url: readRequestPath(input),
      init
    });

    if (!next) {
      throw new Error(`Unexpected fetch call: ${String(input)}`);
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

  return {
    calls,
    fetchMock
  };
}

function readRequestPath(input: RequestInfo | URL) {
  const value = String(input);

  if (!value.startsWith("http")) {
    return value;
  }

  const url = new URL(value);

  return `${url.pathname}${url.search}`;
}

function authHeaders(calls: Array<{ init?: RequestInit }>) {
  return calls.map(({ init }) => {
    const headers = new Headers(init?.headers);

    return headers.get("Authorization");
  });
}

beforeEach(() => {
  window.sessionStorage.clear();
});

afterEach(() => {
  configureApiAuth(null);
  vi.unstubAllGlobals();
  window.sessionStorage.clear();
});

describe("Client Lens authentication foundation", () => {
  it("redirects an unauthenticated user to login without flashing protected content", async () => {
    renderWithRoute(routes.workbench);

    expect(
      screen.queryByRole("heading", { name: "Client Lens Overview" })
    ).not.toBeInTheDocument();
    expect(
      await screen.findByRole("heading", { name: "Sign in to Client Lens" })
    ).toBeInTheDocument();
  });

  it("renders the application shell and brand treatment", () => {
    window.sessionStorage.setItem(getRefreshTokenStorageKey(), "refresh-token");
    mockFetchQueue([
      { status: 200, body: { accessToken: "access-token" } },
      { status: 200, body: session }
    ]);

    renderWithRoute(routes.workbench);

    return expect(
      screen.findByRole("img", { name: "Client Lens by OGI Ltd." })
    ).resolves.toHaveAttribute("src", "/brand/client-lens-logo.png");
  });

  it("renders the primary navigation and permission-aware reviews link", async () => {
    window.sessionStorage.setItem(getRefreshTokenStorageKey(), "refresh-token");
    mockFetchQueue([
      { status: 200, body: { accessToken: "access-token" } },
      { status: 200, body: session }
    ]);
    renderWithRoute(routes.workbench);

    expect(
      await screen.findByRole("navigation", { name: "Primary navigation" })
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Overview" })).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Reviews" })
    ).toHaveAttribute("href", routes.governanceQueue);
    expect(screen.queryByRole("link", { name: "Workbench" })).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Operations" })
    ).toHaveAttribute("href", routes.operations);
    expect(screen.queryByRole("link", { name: "Assessments" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Operational Risk" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Administration" })).not.toBeInTheDocument();
  });

  it("opens Administration from primary navigation and loads authorized users", async () => {
    const user = userEvent.setup();
    window.sessionStorage.setItem(getRefreshTokenStorageKey(), "refresh-token");
    const { calls } = mockFetchQueue([
      { status: 200, body: { accessToken: "access-token" } },
      { status: 200, body: administrationSession },
      { status: 200, body: administrationUsersResponse }
    ]);
    renderWithRoute(routes.workbench);

    await user.click(await screen.findByRole("button", { name: "Menu" }));
    await user.click(await screen.findByRole("link", { name: "Administration" }));

    expect(await screen.findByRole("heading", { name: "Administration" })).toBeInTheDocument();
    expect(screen.getAllByText("Administration").length).toBeGreaterThan(0);
    expect(
      screen.getByText(
        "Use only the administrative capabilities available through your current server-authorized session."
      )
    ).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Authorized users" })).toBeInTheDocument();
    expect(screen.getByText("Marvin Alcantara")).toBeInTheDocument();
    expect(screen.getByText("marvin.alcantara@ogiofficial.com")).toBeInTheDocument();
    expect(screen.getByText("ACTIVE")).toBeInTheDocument();
    expect(screen.getByText("2026-08-01T00:00:00.000Z")).toBeInTheDocument();
    expect(screen.getByText("00000000-0000-4000-8000-000000000901")).toBeInTheDocument();
    expect(screen.getByText("Braven Burrows")).toBeInTheDocument();
    expect(screen.getByText("braven.burrows")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /create user/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /disable user/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /assign roles/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /manage permissions/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: /search/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: /client/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: /facility/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Assessments" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Operational Risk" })).not.toBeInTheDocument();
    expect(calls.map(({ url }) => url)).toEqual([
      "/api/v1/auth/refresh",
      "/api/v1/auth/me",
      "/api/v1/auth/users"
    ]);
  });

  it("does not reveal Administration from role names without view_users", async () => {
    window.sessionStorage.setItem(getRefreshTokenStorageKey(), "refresh-token");
    mockFetchQueue([
      { status: 200, body: { accessToken: "access-token" } },
      {
        status: 200,
        body: {
          ...session,
          permissions: ["view_operational_evidence"],
          roles: ["Administration", "Administrator", "User Manager"]
        }
      }
    ]);
    renderWithRoute(routes.workbench);

    await userEvent.click(await screen.findByRole("button", { name: "Menu" }));

    expect(screen.queryByRole("link", { name: "Administration" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Operations" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Reviews" })).toBeInTheDocument();
  });

  it("blocks the Administration route without Administration authority and does not call the users endpoint", async () => {
    window.sessionStorage.setItem(getRefreshTokenStorageKey(), "refresh-token");
    const { calls } = mockFetchQueue([
      { status: 200, body: { accessToken: "access-token" } },
      {
        status: 200,
        body: {
          ...session,
          permissions: [],
          roles: ["Administration", "Administrator"]
        }
      }
    ]);
    renderWithRoute(routes.administration);

    expect(
      await screen.findByRole("heading", { name: "You are not authorized to use Administration." })
    ).toBeInTheDocument();
    expect(calls.map(({ url }) => url)).toEqual([
      "/api/v1/auth/refresh",
      "/api/v1/auth/me"
    ]);
  });

  it("renders the Administration users loading state", async () => {
    window.sessionStorage.setItem(getRefreshTokenStorageKey(), "refresh-token");
    mockFetchQueue([
      { status: 200, body: { accessToken: "access-token" } },
      { status: 200, body: administrationSession },
      { status: 200, body: administrationUsersResponse }
    ]);
    renderWithRoute(routes.administration);

    expect(await screen.findByText("Loading users.")).toBeInTheDocument();
  });

  it("renders the Administration users empty state", async () => {
    window.sessionStorage.setItem(getRefreshTokenStorageKey(), "refresh-token");
    mockFetchQueue([
      { status: 200, body: { accessToken: "access-token" } },
      { status: 200, body: administrationSession },
      { status: 200, body: [] }
    ]);
    renderWithRoute(routes.administration);

    expect(
      await screen.findByRole("heading", { name: "No users were returned." })
    ).toBeInTheDocument();
  });

  it("renders the Administration users authorization failure state", async () => {
    window.sessionStorage.setItem(getRefreshTokenStorageKey(), "refresh-token");
    mockFetchQueue([
      { status: 200, body: { accessToken: "access-token" } },
      { status: 200, body: administrationSession },
      {
        status: 403,
        body: {
          error: {
            code: "FORBIDDEN",
            message: "Forbidden"
          }
        }
      }
    ]);
    renderWithRoute(routes.administration);

    expect(
      await screen.findByRole("heading", { name: "You are not authorized to view users." })
    ).toBeInTheDocument();
  });

  it("renders the Administration users generic failure state", async () => {
    window.sessionStorage.setItem(getRefreshTokenStorageKey(), "refresh-token");
    mockFetchQueue([
      { status: 200, body: { accessToken: "access-token" } },
      { status: 200, body: administrationSession },
      {
        status: 500,
        body: {
          error: {
            code: "INTERNAL_SERVER_ERROR",
            message: "Internal Server Error"
          }
        }
      }
    ]);
    renderWithRoute(routes.administration);

    expect(
      await screen.findByRole("heading", { name: "Users could not be loaded." })
    ).toBeInTheDocument();
  });
  it("hides permission-gated navigation when /me lacks permission", async () => {
    window.sessionStorage.setItem(getRefreshTokenStorageKey(), "refresh-token");
    mockFetchQueue([
      { status: 200, body: { accessToken: "access-token" } },
      { status: 200, body: { ...session, permissions: [] } }
    ]);
    renderWithRoute(routes.workbench);

    expect(
      await screen.findByRole("heading", { name: "Client Lens Overview" })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Reviews" })
    ).not.toBeInTheDocument();
  });

  it("logs in, stores only the refresh token, loads /me, and reaches workbench", async () => {
    const user = userEvent.setup();
    const { calls } = mockFetchQueue([
      {
        status: 200,
        body: {
          accessToken: "login-access-token",
          refreshToken: "login-refresh-token",
          user: {
            id: "user-1",
            email: "operator@example.test",
            username: null,
            fullName: "Operator One",
            status: "ACTIVE"
          }
        }
      },
      { status: 200, body: session }
    ]);

    renderWithRoute(routes.login);

    await user.type(screen.getByLabelText("Email or Username"), "operator@example.test");
    await user.type(screen.getByLabelText("Password"), "correct-password");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(
      await screen.findByRole("heading", { name: "Client Lens Overview" })
    ).toBeInTheDocument();
    expect(window.sessionStorage.getItem(getRefreshTokenStorageKey())).toBe(
      "login-refresh-token"
    );
    expect(window.sessionStorage.getItem("accessToken")).toBeNull();
    expect(calls.map(({ url }) => url)).toEqual([
      "/api/v1/auth/login",
      "/api/v1/auth/me"
    ]);
    expect(JSON.parse(String(calls[0]?.init?.body))).toEqual({
      identifier: "operator@example.test",
      password: "correct-password"
    });
  });

  it("restores a stored refresh token by refreshing and loading /me", async () => {
    window.sessionStorage.setItem(getRefreshTokenStorageKey(), "stored-refresh");
    const { calls } = mockFetchQueue([
      { status: 200, body: { accessToken: "restored-access" } },
      { status: 200, body: session }
    ]);

    renderWithRoute(routes.workbench);

    expect(
      await screen.findByText("Operator One")
    ).toBeInTheDocument();
    expect(calls.map(({ url }) => url)).toEqual([
      "/api/v1/auth/refresh",
      "/api/v1/auth/me"
    ]);
  });

  it("clears a stored refresh token when bootstrap refresh fails", async () => {
    window.sessionStorage.setItem(getRefreshTokenStorageKey(), "expired-refresh");
    mockFetchQueue([{ status: 401, body: { message: "Unauthorized" } }]);

    renderWithRoute(routes.workbench);

    expect(
      await screen.findByRole("heading", { name: "Sign in to Client Lens" })
    ).toBeInTheDocument();
    expect(window.sessionStorage.getItem(getRefreshTokenStorageKey())).toBeNull();
  });

  it("reactively refreshes once on 401 and retries the original request once", async () => {
    window.sessionStorage.setItem(getRefreshTokenStorageKey(), "refresh-token");
    let accessToken: string | null = "expired-access-token";
    const { calls } = mockFetchQueue([
      { status: 401, body: { message: "Expired" } },
      { status: 200, body: { accessToken: "new-access-token" } },
      { status: 200, body: session }
    ]);
    configureApiAuth({
      getAccessToken: () => accessToken,
      refreshAccessToken: async () => {
        const response = await import("../auth/authApi").then((module) =>
          module.refresh({ refreshToken: "refresh-token" })
        );

        accessToken = response.accessToken;
        return response.accessToken;
      },
      onAuthFailure: () => {
        accessToken = null;
        window.sessionStorage.removeItem(getRefreshTokenStorageKey());
      }
    });

    const result = await apiRequest("/api/v1/auth/me", {
      validate: isAuthenticatedSession
    });

    expect(result.email).toBe("operator@example.test");
    expect(calls.map(({ url }) => url)).toEqual([
      "/api/v1/auth/me",
      "/api/v1/auth/refresh",
      "/api/v1/auth/me"
    ]);
    expect(authHeaders(calls)).toEqual([
      "Bearer expired-access-token",
      null,
      "Bearer new-access-token"
    ]);
  });

  it("shares one refresh request across concurrent 401 responses", async () => {
    window.sessionStorage.setItem(getRefreshTokenStorageKey(), "refresh-token");
    let accessToken: string | null = "expired-access-token";
    const { calls } = mockFetchQueue([
      { status: 401, body: { message: "Expired" } },
      { status: 401, body: { message: "Expired" } },
      { status: 200, body: { accessToken: "shared-access-token" } },
      { status: 200, body: session },
      { status: 200, body: session }
    ]);
    configureApiAuth({
      getAccessToken: () => accessToken,
      refreshAccessToken: async () => {
        const response = await import("../auth/authApi").then((module) =>
          module.refresh({ refreshToken: "refresh-token" })
        );

        accessToken = response.accessToken;
        return response.accessToken;
      },
      onAuthFailure: () => {
        accessToken = null;
      }
    });

    const [first, second] = await Promise.all([
      apiRequest("/api/v1/auth/me", { validate: isAuthenticatedSession }),
      apiRequest("/api/v1/auth/me", { validate: isAuthenticatedSession })
    ]);

    expect(first.id).toBe("user-1");
    expect(second.id).toBe("user-1");
    expect(calls.filter(({ url }) => url === "/api/v1/auth/refresh")).toHaveLength(1);
  });

  it("does not refresh on 403", async () => {
    window.sessionStorage.setItem(getRefreshTokenStorageKey(), "refresh-token");
    configureApiAuth({
      getAccessToken: () => "access-token",
      refreshAccessToken: async () => {
        throw new Error("Refresh should not be called for 403.");
      },
      onAuthFailure: () => undefined
    });
    const { calls } = mockFetchQueue([
      {
        status: 403,
        statusText: "Forbidden",
        body: { error: { code: "FORBIDDEN", message: "Forbidden" } }
      }
    ]);

    await expect(
      apiRequest("/api/v1/auth/me", { validate: isAuthenticatedSession })
    ).rejects.toMatchObject({ status: 403 });
    expect(calls.map(({ url }) => url)).toEqual(["/api/v1/auth/me"]);
  });

  it("local logout clears sessionStorage and authenticated state", async () => {
    const user = userEvent.setup();
    window.sessionStorage.setItem(getRefreshTokenStorageKey(), "refresh-token");
    mockFetchQueue([
      { status: 200, body: { accessToken: "access-token" } },
      { status: 200, body: session }
    ]);
    renderWithRoute(routes.workbench);

    await user.click(await screen.findByRole("button", { name: "Log out" }));

    expect(window.sessionStorage.getItem(getRefreshTokenStorageKey())).toBeNull();
    expect(
      await screen.findByRole("heading", { name: "Sign in to Client Lens" })
    ).toBeInTheDocument();
  });

  it("redirects login route when already authenticated", async () => {
    window.sessionStorage.setItem(getRefreshTokenStorageKey(), "refresh-token");
    mockFetchQueue([
      { status: 200, body: { accessToken: "access-token" } },
      { status: 200, body: session }
    ]);

    renderWithRoute(routes.login);

    expect(
      await screen.findByRole("heading", { name: "Client Lens Overview" })
    ).toBeInTheDocument();
  });

  it("fails safely when login response is malformed", async () => {
    const user = userEvent.setup();
    mockFetchQueue([{ status: 200, body: { accessToken: "missing-refresh" } }]);

    renderWithRoute(routes.login);

    await user.type(screen.getByLabelText("Email or Username"), "operator@example.test");
    await user.type(screen.getByLabelText("Password"), "correct-password");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(
      await screen.findByText("The server returned an unexpected response.")
    ).toBeInTheDocument();
    expect(window.sessionStorage.getItem(getRefreshTokenStorageKey())).toBeNull();
  });

  it("validates login form input visibly", async () => {
    const user = userEvent.setup();
    renderWithRoute(routes.login);

    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(screen.getByText("Enter your email or username and password.")).toBeInTheDocument();
  });

  it("opens the review queue from primary navigation", async () => {
    const user = userEvent.setup();
    window.sessionStorage.setItem(getRefreshTokenStorageKey(), "refresh-token");
    const { calls } = mockFetchQueue([
      { status: 200, body: { accessToken: "access-token" } },
      { status: 200, body: session },
      { status: 200, body: unclaimedQueueResponse }
    ]);
    renderWithRoute(routes.workbench);

    await user.click(await screen.findByRole("button", { name: "Menu" }));
    await user.click(await screen.findByRole("link", { name: "Reviews" }));

    expect(
      await screen.findByRole("heading", { name: "Review Queue" })
    ).toBeInTheDocument();
    expect(
      screen.getByText("Find governed review work available to you or already claimed by you.")
    ).toBeInTheDocument();
    const queueItem = within(
      screen.getByRole("list", { name: "Governance review queue" })
    ).getByRole("listitem");
    expect(screen.getByText("OGI_F001_WEEKLY_SAFETY_AUDIT_CHECKLIST")).toBeInTheDocument();
    expect(screen.getByText("Awaiting Review")).toBeInTheDocument();
    expect(screen.getByText("OGI")).toBeInTheDocument();
    expect(within(queueItem).getByText("Available")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Claim Review" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open Record" })).toHaveAttribute(
      "href",
      routes.evidenceRecordPath(queueEvidenceRecord.id)
    );
    expect(screen.queryByText("begin_ogi_review")).not.toBeInTheDocument();
    expect(screen.queryByText("UNDER_OGI_REVIEW")).not.toBeInTheDocument();
    expect(screen.queryByText("My Work")).not.toBeInTheDocument();
    expect(calls.map(({ url }) => url)).toEqual([
      "/api/v1/auth/refresh",
      "/api/v1/auth/me",
      "/api/v1/operational-evidence/governance/queue?claim_status=ANY"
    ]);
  });

  it("does not reveal Reviews from role names without the required permission", async () => {
    window.sessionStorage.setItem(getRefreshTokenStorageKey(), "refresh-token");
    mockFetchQueue([
      { status: 200, body: { accessToken: "access-token" } },
      {
        status: 200,
        body: {
          ...session,
          permissions: [],
          roles: ["Reviews", "Reviewer", "Administrator"]
        }
      }
    ]);
    renderWithRoute(routes.workbench);

    await userEvent.click(await screen.findByRole("button", { name: "Menu" }));

    expect(screen.queryByRole("link", { name: "Reviews" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Administration" })).not.toBeInTheDocument();
  });

  it("filters the review queue using supported governance query parameters", async () => {
    const user = userEvent.setup();
    const { calls } = mockFetchQueue([
      { status: 200, body: { accessToken: "access-token" } },
      { status: 200, body: session },
      { status: 200, body: unclaimedQueueResponse },
      { status: 200, body: ownedClaimQueueResponse }
    ]);
    window.sessionStorage.setItem(getRefreshTokenStorageKey(), "refresh-token");
    renderWithRoute(routes.governanceQueue);

    await screen.findByRole("heading", { name: "Review Queue" });
    await user.type(screen.getByLabelText("Governance authority"), "OGI");
    await user.type(screen.getByLabelText("Lifecycle state"), "SUBMITTED");
    await user.selectOptions(screen.getByLabelText("Claim status"), "CLAIMED");
    await user.click(screen.getByRole("button", { name: "Apply filters" }));

    expect(await screen.findByText("Claimed by you")).toBeInTheDocument();
    expect(calls.map(({ url }) => url)).toContain(
      "/api/v1/operational-evidence/governance/queue?claim_status=CLAIMED&governance_authority_code=OGI&lifecycle_state=SUBMITTED"
    );
  });

  it("claims a review from the queue and reconciles to the owned claim state", async () => {
    const user = userEvent.setup();
    const { calls } = mockFetchQueue([
      { status: 200, body: { accessToken: "access-token" } },
      { status: 200, body: session },
      { status: 200, body: unclaimedQueueResponse },
      { status: 201, body: queueClaim },
      { status: 200, body: ownedClaimQueueResponse }
    ]);
    window.sessionStorage.setItem(getRefreshTokenStorageKey(), "refresh-token");
    renderWithRoute(routes.governanceQueue);

    await user.click(await screen.findByRole("button", { name: "Claim Review" }));

    expect(await screen.findByText("Claimed by you")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Continue Review" })).toHaveAttribute(
      "href",
      routes.evidenceRecordPath(queueEvidenceRecord.id)
    );
    expect(screen.queryByRole("button", { name: "Claim Review" })).not.toBeInTheDocument();

    const claimCall = calls.find((call) =>
      call.url.endsWith("/governance/review-claims")
    );

    expect(claimCall?.init?.method).toBe("POST");
    expect(JSON.parse(String(claimCall?.init?.body))).toEqual({
      evidence_record_id: queueEvidenceRecord.id,
      governance_authority_code: "OGI",
      transition_trigger: "begin_ogi_review"
    });
    expect(calls.map(({ url }) => url)).toEqual([
      "/api/v1/auth/refresh",
      "/api/v1/auth/me",
      "/api/v1/operational-evidence/governance/queue?claim_status=ANY",
      "/api/v1/operational-evidence/governance/review-claims",
      "/api/v1/operational-evidence/governance/queue?claim_status=ANY"
    ]);
  });

  it("shows claimed-by-another review work as non-actionable", async () => {
    window.sessionStorage.setItem(getRefreshTokenStorageKey(), "refresh-token");
    mockFetchQueue([
      { status: 200, body: { accessToken: "access-token" } },
      { status: 200, body: session },
      { status: 200, body: otherClaimQueueResponse }
    ]);
    renderWithRoute(routes.governanceQueue);

    expect(await screen.findByText("Claimed by another reviewer")).toBeInTheDocument();
    expect(screen.getByText(/Claimed by 00000000-0000-4000-8000-000000000999/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View Record" })).toHaveAttribute(
      "href",
      routes.evidenceRecordPath(queueEvidenceRecord.id)
    );
    expect(screen.queryByRole("button", { name: "Claim Review" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Continue Review" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Release Claim" })).not.toBeInTheDocument();
  });

  it("fails closed on duplicate review claim conflict and refreshes queue state", async () => {
    const user = userEvent.setup();
    const { calls } = mockFetchQueue([
      { status: 200, body: { accessToken: "access-token" } },
      { status: 200, body: session },
      { status: 200, body: unclaimedQueueResponse },
      {
        status: 409,
        statusText: "Conflict",
        body: {
          error: {
            code: "OEE_GOVERNANCE_REVIEW_CLAIM_CONFLICT",
            message: "Governance review is already claimed."
          }
        }
      },
      { status: 200, body: otherClaimQueueResponse }
    ]);
    window.sessionStorage.setItem(getRefreshTokenStorageKey(), "refresh-token");
    renderWithRoute(routes.governanceQueue);

    await user.click(await screen.findByRole("button", { name: "Claim Review" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "This review is already claimed. The queue has been refreshed."
    );
    expect(await screen.findByText("Claimed by another reviewer")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Claim Review" })).not.toBeInTheDocument();
    expect(calls.filter((call) =>
      call.url.endsWith("/governance/review-claims")
    )).toHaveLength(1);
  });

  it("keeps capability-driven navigation intact when the compact menu opens", async () => {
    const user = userEvent.setup();
    window.sessionStorage.setItem(getRefreshTokenStorageKey(), "refresh-token");
    mockFetchQueue([
      { status: 200, body: { accessToken: "access-token" } },
      { status: 200, body: { ...session, permissions: [] } }
    ]);
    renderWithRoute(routes.workbench);

    await user.click(await screen.findByRole("button", { name: "Menu" }));

    expect(screen.getByRole("link", { name: "Overview" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Reviews" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Operations" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Assessments" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Operational Risk" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Administration" })).not.toBeInTheDocument();
  });

  it("opens Operations from primary navigation and loads the canonical catalog", async () => {
    const user = userEvent.setup();
    const { calls } = mockFetchQueue([
      { status: 200, body: { accessToken: "access-token" } },
      { status: 200, body: submitCapableSession },
      { status: 200, body: catalogResponse }
    ]);
    window.sessionStorage.setItem(getRefreshTokenStorageKey(), "refresh-token");
    renderWithRoute(routes.workbench);

    await user.click(await screen.findByRole("button", { name: "Menu" }));
    await user.click(await screen.findByRole("link", { name: "Operations" }));

    expect(
      await screen.findByRole("heading", { name: "Forms & Audits" })
    ).toBeInTheDocument();
    expect(screen.getByText("Choose an operational form or audit to open.")).toBeInTheDocument();
    expect(screen.getByText("Weekly Safety Audit Checklist")).toBeInTheDocument();
    expect(screen.getByText("Capture weekly operational safety audit evidence.")).toBeInTheDocument();
    expect(screen.getAllByText("MODULE_A").length).toBeGreaterThan(0);
    expect(screen.getByText("OGI_F001_WEEKLY_SAFETY_AUDIT_CHECKLIST")).toBeInTheDocument();
    expect(screen.getByText("OGI-F001 / Rev A")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Open Form" })[0]).toHaveAttribute(
      "href",
      routes.oetsTemplatePath("OGI_F001_WEEKLY_SAFETY_AUDIT_CHECKLIST")
    );
    expect(screen.queryByText("checksum-a")).not.toBeInTheDocument();
    expect(screen.queryByText("00000000-0000-4000-8000-000000000301")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Records" })).toHaveAttribute(
      "href",
      routes.records
    );
    expect(screen.queryByRole("link", { name: "My Work" })).not.toBeInTheDocument();
    expect(calls.map(({ url }) => url)).toEqual([
      "/api/v1/auth/refresh",
      "/api/v1/auth/me",
      "/api/v1/operational-evidence/templates"
    ]);
  });

  it("renders the Operations catalog loading state", async () => {
    window.sessionStorage.setItem(getRefreshTokenStorageKey(), "refresh-token");
    mockFetchQueue([
      { status: 200, body: { accessToken: "access-token" } },
      { status: 200, body: session },
      { status: 200, body: catalogResponse }
    ]);
    renderWithRoute(routes.operations);

    expect(
      await screen.findByText("Loading forms and audits.")
    ).toBeInTheDocument();
  });

  it("renders the Operations catalog empty state without assignment language", async () => {
    window.sessionStorage.setItem(getRefreshTokenStorageKey(), "refresh-token");
    mockFetchQueue([
      { status: 200, body: { accessToken: "access-token" } },
      { status: 200, body: session },
      { status: 200, body: { templates: [] } }
    ]);
    renderWithRoute(routes.operations);

    expect(
      await screen.findByRole("heading", {
        name: "No forms or audits are currently available."
      })
    ).toBeInTheDocument();
    expect(screen.queryByText(/assigned/i)).not.toBeInTheDocument();
  });

  it("renders the Operations catalog authorization state", async () => {
    window.sessionStorage.setItem(getRefreshTokenStorageKey(), "refresh-token");
    mockFetchQueue([
      { status: 200, body: { accessToken: "access-token" } },
      { status: 200, body: session },
      {
        status: 403,
        body: {
          error: {
            code: "FORBIDDEN",
            message: "Forbidden"
          }
        }
      }
    ]);
    renderWithRoute(routes.operations);

    expect(
      await screen.findByRole("heading", {
        name: "Forms and audits are not available with your current authorization."
      })
    ).toBeInTheDocument();
  });

  it("filters the Operations catalog by module without client or facility availability", async () => {
    const user = userEvent.setup();
    window.sessionStorage.setItem(getRefreshTokenStorageKey(), "refresh-token");
    mockFetchQueue([
      { status: 200, body: { accessToken: "access-token" } },
      { status: 200, body: session },
      { status: 200, body: catalogResponse }
    ]);
    renderWithRoute(routes.operations);

    await screen.findByRole("heading", { name: "Forms & Audits" });
    await user.selectOptions(screen.getByLabelText("Module"), "MODULE_B");

    expect(screen.queryByText("Weekly Safety Audit Checklist")).not.toBeInTheDocument();
    expect(screen.getByText("Risk Register")).toBeInTheDocument();
    expect(
      screen.queryByRole("combobox", { name: /client/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("combobox", { name: /facility/i })
    ).not.toBeInTheDocument();
  });

  it("routes view-only actors to the existing read-only runtime form", async () => {
    window.sessionStorage.setItem(getRefreshTokenStorageKey(), "refresh-token");
    mockFetchQueue([
      { status: 200, body: { accessToken: "access-token" } },
      { status: 200, body: session },
      { status: 200, body: catalogResponse }
    ]);
    renderWithRoute(routes.operations);

    const viewActions = await screen.findAllByRole("link", { name: "View Form" });

    expect(viewActions[0]).toHaveAttribute(
      "href",
      `${routes.oetsTemplatePath("OGI_F001_WEEKLY_SAFETY_AUDIT_CHECKLIST")}?mode=readonly`
    );
    expect(screen.queryByRole("link", { name: "Open Form" })).not.toBeInTheDocument();
  });

  it("does not reveal Operations from role names without the required permission", async () => {
    window.sessionStorage.setItem(getRefreshTokenStorageKey(), "refresh-token");
    mockFetchQueue([
      { status: 200, body: { accessToken: "access-token" } },
      {
        status: 200,
        body: {
          ...session,
          permissions: [],
          roles: ["Operations", "Administrator"]
        }
      }
    ]);
    renderWithRoute(routes.workbench);

    await userEvent.click(await screen.findByRole("button", { name: "Menu" }));

    expect(screen.queryByRole("link", { name: "Operations" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Administration" })).not.toBeInTheDocument();
  });

  it("opens Records from Operations child navigation and calls the neutral records endpoint", async () => {
    const user = userEvent.setup();
    const { calls } = mockFetchQueue([
      { status: 200, body: { accessToken: "access-token" } },
      { status: 200, body: session },
      { status: 200, body: catalogResponse },
      { status: 200, body: recordsResponse }
    ]);
    window.sessionStorage.setItem(getRefreshTokenStorageKey(), "refresh-token");
    renderWithRoute(routes.operations);

    await user.click(await screen.findByRole("link", { name: "Records" }));

    expect(
      await screen.findByRole("heading", { name: "Records" })
    ).toBeInTheDocument();
    expect(
      screen.getByText("Browse Operational Evidence records you are authorized to view.")
    ).toBeInTheDocument();
    expect(screen.getByText("OGI_F001_WEEKLY_SAFETY_AUDIT_CHECKLIST")).toBeInTheDocument();
    expect(screen.getByText("Awaiting Review")).toBeInTheDocument();
    expect(screen.getByText("Record 00000000-0000-4000-8000-000000000501")).toBeInTheDocument();
    expect(screen.getByText("00000000-0000-4000-8000-000000000101")).toBeInTheDocument();
    expect(screen.getByText("00000000-0000-4000-8000-000000000201")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View Record" })).toHaveAttribute(
      "href",
      routes.evidenceRecordPath("00000000-0000-4000-8000-000000000501")
    );
    expect(screen.queryByText("payload-checksum-1")).not.toBeInTheDocument();
    expect(screen.queryByText("Claim Review")).not.toBeInTheDocument();
    expect(screen.queryByText("Review Conclusion")).not.toBeInTheDocument();
    expect(screen.queryByText(/assigned/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete" })).not.toBeInTheDocument();
    expect(calls.map(({ url }) => url)).toEqual([
      "/api/v1/auth/refresh",
      "/api/v1/auth/me",
      "/api/v1/operational-evidence/templates",
      "/api/v1/operational-evidence/records?limit=25&offset=0"
    ]);
  });

  it("hides Records navigation without view_operational_evidence even when roles sound privileged", async () => {
    window.sessionStorage.setItem(getRefreshTokenStorageKey(), "refresh-token");
    mockFetchQueue([
      { status: 200, body: { accessToken: "access-token" } },
      {
        status: 200,
        body: {
          ...session,
          permissions: [],
          roles: ["Records", "Operations", "Administrator"]
        }
      }
    ]);
    renderWithRoute(routes.workbench);

    await userEvent.click(await screen.findByRole("button", { name: "Menu" }));

    expect(screen.queryByRole("link", { name: "Operations" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Records" })).not.toBeInTheDocument();
  });

  it("serializes Records filters to the canonical query parameters", async () => {
    const user = userEvent.setup();
    const { calls } = mockFetchQueue([
      { status: 200, body: { accessToken: "access-token" } },
      { status: 200, body: session },
      { status: 200, body: recordsResponse },
      { status: 200, body: recordsResponse }
    ]);
    window.sessionStorage.setItem(getRefreshTokenStorageKey(), "refresh-token");
    renderWithRoute(routes.records);

    await screen.findByRole("heading", { name: "Records" });
    await user.type(screen.getByLabelText("Lifecycle state"), "SUBMITTED");
    await user.type(
      screen.getByLabelText("Template code"),
      "OGI_F001_WEEKLY_SAFETY_AUDIT_CHECKLIST"
    );
    await user.type(screen.getByLabelText("Submitted from"), "2026-08-01T08:30");
    await user.type(screen.getByLabelText("Submitted to"), "2026-08-05T17:45");
    await user.click(screen.getByRole("button", { name: "Apply filters" }));

    expect(
      await screen.findByRole("link", { name: "View Record" })
    ).toBeInTheDocument();
    expect(calls.map(({ url }) => url)).toContain(
      "/api/v1/operational-evidence/records?lifecycle_state=SUBMITTED&template_code=OGI_F001_WEEKLY_SAFETY_AUDIT_CHECKLIST&submitted_from=2026-08-01T08%3A30%3A00.000Z&submitted_to=2026-08-05T17%3A45%3A00.000Z&limit=25&offset=0"
    );
  });

  it("renders Records loading, empty, and authorization states", async () => {
    window.sessionStorage.setItem(getRefreshTokenStorageKey(), "refresh-token");
    mockFetchQueue([
      { status: 200, body: { accessToken: "access-token" } },
      { status: 200, body: session },
      { status: 200, body: { records: [], pagination: { limit: 25, offset: 0, count: 0, total_count: 0 } } }
    ]);
    renderWithRoute(routes.records);

    expect(await screen.findByText("Loading records.")).toBeInTheDocument();
    expect(
      await screen.findByRole("heading", { name: "No records are currently available." })
    ).toBeInTheDocument();
    expect(screen.queryByText(/assigned/i)).not.toBeInTheDocument();

    vi.unstubAllGlobals();
    window.sessionStorage.clear();
    window.sessionStorage.setItem(getRefreshTokenStorageKey(), "refresh-token");
    mockFetchQueue([
      { status: 200, body: { accessToken: "access-token" } },
      { status: 200, body: session },
      { status: 403, body: { error: { code: "FORBIDDEN", message: "Forbidden" } } }
    ]);
    renderWithRoute(routes.records);

    expect(
      await screen.findByRole("heading", {
        name: "Records are not available with your current authorization."
      })
    ).toBeInTheDocument();
  });

  it("paginates Records with backend limit, offset, and total count", async () => {
    const user = userEvent.setup();
    const { calls } = mockFetchQueue([
      { status: 200, body: { accessToken: "access-token" } },
      { status: 200, body: session },
      { status: 200, body: recordsResponse },
      { status: 200, body: secondRecordsPageResponse }
    ]);
    window.sessionStorage.setItem(getRefreshTokenStorageKey(), "refresh-token");
    renderWithRoute(routes.records);

    expect(await screen.findByText("Showing 1-1 of 40")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Next" })).toBeEnabled();

    await user.click(screen.getByRole("button", { name: "Next" }));

    expect(await screen.findByText("Showing 26-26 of 26")).toBeInTheDocument();
    expect(screen.getByText("Audit Approved")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Previous" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Previous" }));

    expect(await screen.findByText("Showing 1-1 of 40")).toBeInTheDocument();
    expect(calls.map(({ url }) => url)).toEqual([
      "/api/v1/auth/refresh",
      "/api/v1/auth/me",
      "/api/v1/operational-evidence/records?limit=25&offset=0",
      "/api/v1/operational-evidence/records?limit=25&offset=25"
    ]);
  });

  it("renders a safe not-found experience for unknown authenticated routes", async () => {
    window.sessionStorage.setItem(getRefreshTokenStorageKey(), "refresh-token");
    mockFetchQueue([
      { status: 200, body: { accessToken: "access-token" } },
      { status: 200, body: session }
    ]);
    renderWithRoute("/unknown-route");

    expect(
      await screen.findByRole("heading", {
        name: "This workspace page is not available."
      })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: "Client Lens by OGI Ltd." })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Return to workbench" })
    ).toHaveAttribute("href", routes.workbench);
  });
});
