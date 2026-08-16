import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { configureApiAuth } from "../api/client";
import { AppProviders } from "../app/providers/AppProviders";
import { appRoutes } from "../app/router";
import { routes } from "../app/routePaths";
import { getRefreshTokenStorageKey } from "../auth/storage";
import { AuthenticatedSession } from "../auth/types";
import { CredentialIssuanceResponse } from "./credentialsApi";

const issuanceId = "00000000-0000-4000-8000-000000900001";

const credentialsSession: AuthenticatedSession = {
  id: "00000000-0000-4000-8000-000000000001",
  email: "operator@example.test",
  username: null,
  fullName: "Operator One",
  status: "ACTIVE",
  clientId: null,
  facilityIds: [],
  roles: ["Credentials"],
  permissions: ["view_certification"]
};

const restrictedSession: AuthenticatedSession = {
  ...credentialsSession,
  permissions: ["view_staff_member"]
};

const issuance: CredentialIssuanceResponse = {
  id: issuanceId,
  source_certification_id: "00000000-0000-4000-8000-000000900002",
  staff_member_id: "00000000-0000-4000-8000-000000900003",
  client_id: "00000000-0000-4000-8000-000000900004",
  source_authorization_id: null,
  source_evidence_record_id: "00000000-0000-4000-8000-000000900005",
  issued_by_user_id: "00000000-0000-4000-8000-000000900006",
  credential_program_code_snapshot: "OPEN_WATER_GUARDIAN",
  certification_level_snapshot: "L3",
  program_display_name_snapshot: "Open Water Guardian",
  qualification_label_snapshot: "Open Water Guardian",
  required_training_hours: 60,
  certificate_display: {
    qualification_title: "Open Water Guardian Certification",
    skills: [
      {
        key: "WATER_RESCUE",
        label: "Water rescue readiness",
        source_section: "KEY_SKILLS_AND_TRAINING"
      }
    ],
    qualified_to: [
      {
        key: "SUPERVISE_OPEN_WATER",
        label: "Supervise open-water guardian operations",
        source_section: "HOLDER_IS_QUALIFIED_TO"
      }
    ],
    training_standards: [
      {
        key: "OGI_L3_STANDARD",
        label: "OGI L3 Open Water Guardian Standard",
        source_section: "TRAINING_STANDARD"
      }
    ],
    scope_limitations: [],
    source_authority_refs: ["L1-L7_CERTIFICATE_DISPLAY_CONFIGURATION"]
  },
  validity_period: {
    unit: "YEAR",
    value: 1
  },
  certificate_template_code_snapshot: "OGI_L1_L7_CERTIFICATE_FAMILY",
  certificate_template_version_snapshot: "1.0",
  certificate_template_variant_code_snapshot: null,
  holder_name_snapshot: "Ana Santos",
  certification_number_snapshot: "OGI-OWG-000001",
  issue_date_snapshot: "2026-01-01T00:00:00.000Z",
  expiry_date_snapshot: "2027-01-01T00:00:00.000Z",
  completion_date_snapshot: "2025-12-31",
  training_location_snapshot: "Makati Training Pool",
  instructor_snapshot: "Braven Burrows",
  training_center_snapshot: "OGI Guardian Academy",
  certification_status_at_issuance: "ACTIVE",
  issuing_organization_snapshot: "Ocean Guardian International Ltd.",
  supporting_evidence_refs: [],
  issued_at: "2026-01-01T00:00:00.000Z"
};

interface MockResponse {
  status: number;
  body?: unknown;
  statusText?: string;
  headers?: Record<string, string>;
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

    if (next.body instanceof Blob) {
      return new Response(next.body, {
        status: next.status,
        statusText: next.statusText,
        headers: next.headers
      });
    }

    return new Response(
      next.body === undefined ? null : JSON.stringify(next.body),
      {
        status: next.status,
        statusText: next.statusText,
        headers: {
          "Content-Type": "application/json",
          ...next.headers
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

function certificatePdf(filename = "OGI-OWG-000001.pdf") {
  return {
    status: 200,
    body: new Blob(["%PDF-1.4\ncertificate"], {
      type: "application/pdf"
    }),
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`
    }
  };
}

beforeEach(() => {
  window.sessionStorage.clear();
  window.sessionStorage.setItem(getRefreshTokenStorageKey(), "refresh-token");
  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    value: vi.fn(() => "blob:certificate-preview")
  });
  Object.defineProperty(URL, "revokeObjectURL", {
    configurable: true,
    value: vi.fn()
  });
  vi.spyOn(window, "open").mockReturnValue(null);
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
});

afterEach(() => {
  configureApiAuth(null);
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  window.sessionStorage.clear();
});

describe("Production certificate viewer", () => {
  it("loads issuance metadata and authenticated PDF artifact for an issuance route", async () => {
    const { calls } = mockFetchRoutes([
      ...authRoutes(),
      {
        url: `/api/v1/credentials/issuances/${issuanceId}`,
        responses: [{ status: 200, body: issuance }]
      },
      {
        url: `/api/v1/credentials/issuances/${issuanceId}/certificate`,
        responses: [certificatePdf()]
      }
    ]);

    renderWithRoute(routes.credentialCertificatePath(issuanceId));

    expect(
      await screen.findByRole("heading", { name: "Digital Certificate" })
    ).toBeInTheDocument();
    expect((await screen.findAllByText("Ana Santos")).length).toBeGreaterThan(0);
    expect(screen.getByText("Open Water Guardian")).toBeInTheDocument();
    expect(
      await screen.findByLabelText("Digital certificate visual preview")
    ).toHaveAttribute("data-cert-visual", "universal-l1-l7");
    expect(screen.queryByTitle("Digital certificate PDF preview")).not.toBeInTheDocument();
    for (const region of certificateRegions) {
      expect(
        document.querySelector(`[data-cert-region="${region}"]`)
      ).toBeInTheDocument();
    }
    expect(
      screen.getByRole("img", { name: "Ocean Guardian International Ltd." })
    ).toHaveAttribute("src", "/brand/ogi-master-logo.png");
    expect(
      screen.getByRole("img", { name: "Braven Burrows signature" })
    ).toHaveAttribute("src", "/brand/BravenSignature.png");
    expect(screen.getByRole("img", { name: "OGI certificate ribbon" })).toHaveAttribute(
      "src",
      "/brand/OGIRibbon.png"
    );
    expect(calls.map(({ url }) => url)).toEqual([
      "/api/v1/auth/refresh",
      "/api/v1/auth/me",
      `/api/v1/credentials/issuances/${issuanceId}`,
      `/api/v1/credentials/issuances/${issuanceId}/certificate`
    ]);
    const pdfRequestHeaders = new Headers(calls[3].init?.headers);

    expect(pdfRequestHeaders.get("Accept")).toBe("application/pdf");
    expect(pdfRequestHeaders.get("Authorization")).toBe("Bearer access-token");
  });

  it("refreshes metadata and PDF artifact, and supports open/download actions", async () => {
    const user = userEvent.setup();
    const { calls } = mockFetchRoutes([
      ...authRoutes(),
      {
        url: `/api/v1/credentials/issuances/${issuanceId}`,
        responses: [
          { status: 200, body: issuance },
          { status: 200, body: issuance }
        ]
      },
      {
        url: `/api/v1/credentials/issuances/${issuanceId}/certificate`,
        responses: [
          certificatePdf(),
          certificatePdf("OGI-OWG-000001-refresh.pdf")
        ]
      }
    ]);

    renderWithRoute(routes.credentialCertificatePath(issuanceId));

    await screen.findByLabelText("Digital certificate visual preview");
    await user.click(screen.getByRole("button", { name: "Refresh" }));
    await user.click(screen.getByRole("button", { name: "Open PDF" }));
    await user.click(screen.getByRole("button", { name: "Download PDF" }));

    await waitFor(() =>
      expect(
        calls.filter(({ url }) =>
          url === `/api/v1/credentials/issuances/${issuanceId}/certificate`
        )
      ).toHaveLength(2)
    );
    expect(window.open).toHaveBeenCalledWith(
      "blob:certificate-preview",
      "_blank",
      "noopener,noreferrer"
    );
  });

  it("keeps the certificate viewer unavailable without certificate authority", async () => {
    mockFetchRoutes(authRoutes(restrictedSession));

    renderWithRoute(routes.credentialCertificatePath(issuanceId));

    expect(
      await screen.findByRole("heading", {
        name: "Certificate viewer is not available with your current authorization."
      })
    ).toBeInTheDocument();
  });

  it("uses the same viewer for development preview mode with backend metadata and dev-only guides", async () => {
    const user = userEvent.setup();
    const { calls } = mockFetchRoutes([
      ...authRoutes(),
      {
        url: "/api/v1/credentials/issuances/dev-preview?level=L3",
        responses: [
          {
            status: 200,
            body: {
              ...issuance,
              id: "development-preview",
              holder_name_snapshot: "Development Preview Holder",
              certification_number_snapshot: "OGI-L3-PREVIEW",
              certificate_template_version_snapshot: "development-preview"
            }
          }
        ]
      },
      {
        url: "/api/v1/credentials/issuances/dev-preview/certificate?level=L3",
        responses: [certificatePdf("OGI-L3-PREVIEW.pdf")]
      }
    ]);

    renderWithRoute(`${routes.credentialCertificateDevPreview}?level=L3`);

    expect(
      await screen.findByRole("heading", { name: "Digital Certificate" })
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Development preview level")).toHaveValue("L3");
    expect(
      (await screen.findAllByText("Development Preview Holder")).length
    ).toBeGreaterThan(0);
    expect(
      await screen.findByLabelText("Digital certificate visual preview")
    ).toHaveClass("relative");
    expect(screen.queryByTitle("Digital certificate PDF preview")).not.toBeInTheDocument();
    await user.click(screen.getByLabelText("Show Guides"));
    expect(
      await screen.findByLabelText("Digital certificate visual preview")
    ).toHaveClass("cert-guides");
    expect(screen.getByLabelText("Development preview level")).toBeInTheDocument();
    expect(screen.getByText("Canonical PDF artifact is ready for opening or download.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open PDF" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Download PDF" })).toBeEnabled();
    expect(screen.getByRole("img", { name: "OGI certificate ribbon" })).toHaveAttribute(
      "src",
      "/brand/OGIRibbon.png"
    );
    expect(calls.map(({ url }) => url)).toEqual([
      "/api/v1/auth/refresh",
      "/api/v1/auth/me",
      "/api/v1/credentials/issuances/dev-preview?level=L3",
      "/api/v1/credentials/issuances/dev-preview/certificate?level=L3"
    ]);
  });
});

const certificateRegions = [
  "header",
  "athlete",
  "master-logo",
  "certificate-meta",
  "identity",
  "skills",
  "center",
  "certification-details",
  "signatory",
  "qualified-to",
  "training-standards",
  "validity-verification",
  "ribbon",
  "footer"
] as const;
