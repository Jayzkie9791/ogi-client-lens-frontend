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
  CredentialIssuanceResponse,
  CredentialsListResponse,
  CredentialsOperationalAuthorizationProjection,
  CredentialsPersonnelDetailProjection,
  CredentialsPersonnelProjection
} from "../credentials/credentialsApi";
import { CredentialIssuancePreparationResponse } from "./credentialIssuanceApi";

const clientId = "00000000-0000-4000-8000-000000100001";
const staffMemberId = "00000000-0000-4000-8000-000000300001";
const secondStaffMemberId = "00000000-0000-4000-8000-000000300002";
const certificationId = "00000000-0000-4000-8000-000000400001";
const newCertificationId = "00000000-0000-4000-8000-000000400002";
const operationalAuthorizationId = "00000000-0000-4000-8000-000000500001";
const renewedOperationalAuthorizationId = "00000000-0000-4000-8000-000000500002";
const sourceEvidenceRecordId = "00000000-0000-4000-8000-000000800001";
const credentialIssuanceId = "00000000-0000-4000-8000-000000900001";
const olderCredentialIssuanceId = "00000000-0000-4000-8000-000000900002";

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

const credentialIssuanceSession: AuthenticatedSession = {
  ...certificationSession,
  permissions: [
    ...certificationSession.permissions,
    "issue_certification",
    "view_operational_authorization"
  ]
};

const endorsementSession: AuthenticatedSession = {
  ...certificationSession,
  permissions: [...certificationSession.permissions, "endorse_certification"]
};

const authorizationViewSession: AuthenticatedSession = {
  ...certificationSession,
  permissions: [
    ...certificationSession.permissions,
    "view_operational_authorization"
  ]
};

const authorizationCreateSession: AuthenticatedSession = {
  ...authorizationViewSession,
  permissions: [
    ...authorizationViewSession.permissions,
    "create_operational_authorization"
  ]
};

const authorizationLifecycleSession: AuthenticatedSession = {
  ...authorizationViewSession,
  permissions: [
    ...authorizationViewSession.permissions,
    "renew_operational_authorization",
    "suspend_operational_authorization",
    "reinstate_operational_authorization",
    "revoke_operational_authorization"
  ]
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

const anaDetailWithoutEndorsements: CredentialsPersonnelDetailProjection = {
  ...anaDetail,
  certifications: anaDetail.certifications.map((certification) =>
    certification.id === certificationId
      ? { ...certification, endorsements: [] }
      : certification
  )
};

const anaDetailWithNewEndorsement: CredentialsPersonnelDetailProjection = {
  ...anaDetail,
  certifications: anaDetail.certifications.map((certification) =>
    certification.id === certificationId
      ? {
          ...certification,
          endorsements: [
            ...certification.endorsements,
            {
              endorsement: "WATERFRONT",
              created_at: "2026-01-03T00:00:00.000Z"
            }
          ]
        }
      : certification
  )
};

const activeOperationalAuthorization: CredentialsOperationalAuthorizationProjection = {
  id: operationalAuthorizationId,
  authorization_number: "AUTH-001",
  authorization_level: "L3",
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
  authorization_status: "ACTIVE",
  issue_date: "2026-01-05T00:00:00.000Z",
  expiry_date: "2027-01-05T00:00:00.000Z",
  renewal_date: null,
  certification_id: certificationId,
  previous_authorization_id: null
};

const suspendedOperationalAuthorization: CredentialsOperationalAuthorizationProjection = {
  ...activeOperationalAuthorization,
  authorization_status: "SUSPENDED"
};

const revokedOperationalAuthorization: CredentialsOperationalAuthorizationProjection = {
  ...activeOperationalAuthorization,
  authorization_status: "REVOKED"
};

const renewedOperationalAuthorization: CredentialsOperationalAuthorizationProjection = {
  ...activeOperationalAuthorization,
  id: renewedOperationalAuthorizationId,
  authorization_number: "AUTH-002",
  issue_date: "2026-02-01T00:00:00.000Z",
  expiry_date: "2027-02-01T00:00:00.000Z",
  renewal_date: "2026-02-01T00:00:00.000Z",
  previous_authorization_id: operationalAuthorizationId
};

function detailWithAuthorizations(
  authorizations: CredentialsOperationalAuthorizationProjection[]
): CredentialsPersonnelDetailProjection {
  return {
    ...anaDetail,
    operational_authorizations: authorizations
  };
}

function authorizationCommandResponse(
  authorization: CredentialsOperationalAuthorizationProjection
) {
  return {
    success: true,
    data: {
      id: authorization.id,
      authorization_number: authorization.authorization_number,
      authorization_level: authorization.authorization_level,
      authorization_status: authorization.authorization_status,
      issue_date: authorization.issue_date,
      expiry_date: authorization.expiry_date,
      renewal_date: authorization.renewal_date,
      upgrade_requested: false,
      staff_member_id: staffMemberId,
      certification_id: authorization.certification_id,
      previous_authorization_id: authorization.previous_authorization_id,
      created_by_user_id: authorizationLifecycleSession.id
    }
  };
}

const credentialIssuance: CredentialIssuanceResponse = {
  id: credentialIssuanceId,
  source_certification_id: certificationId,
  staff_member_id: staffMemberId,
  client_id: clientId,
  source_authorization_id: operationalAuthorizationId,
  source_evidence_record_id: sourceEvidenceRecordId,
  issued_by_user_id: credentialIssuanceSession.id,
  credential_program_code_snapshot: "OPEN_WATER_GUARDIAN",
  certification_level_snapshot: "L3",
  program_display_name_snapshot: "Open Water Guardian",
  qualification_label_snapshot: "Open Water Guardian",
  required_training_hours: 60,
  certificate_display: {
    qualification_title: "Open Water Guardian Certification",
    skills: [
      {
        key: "water-rescue",
        label: "Water rescue",
        source_section: "KEY_SKILLS_AND_TRAINING"
      }
    ],
    qualified_to: [
      {
        key: "guardian-duty",
        label: "Operate as an Open Water Guardian",
        source_section: "HOLDER_IS_QUALIFIED_TO"
      }
    ],
    training_standards: [
      {
        key: "ogi-standard",
        label: "OGI standard",
        source_section: "TRAINING_STANDARD"
      }
    ],
    scope_limitations: [],
    source_authority_refs: ["L1-L7 Certification Framework"]
  },
  validity_period: {
    unit: "YEAR",
    value: 1
  },
  certificate_template_code_snapshot: "OGI_L1_L7_CERTIFICATE_FAMILY",
  certificate_template_version_snapshot: "1.0",
  certificate_template_variant_code_snapshot: null,
  holder_name_snapshot: "Ana Santos",
  student_number_snapshot: null,
  certification_number_snapshot: "OGI-OWG-000001",
  issue_date_snapshot: "2026-01-05T00:00:00.000Z",
  expiry_date_snapshot: "2027-01-05T00:00:00.000Z",
  completion_date_snapshot: "2025-12-31",
  training_location_snapshot: "Subic Bay",
  instructor_snapshot: "Braven Burrows",
  training_center_snapshot: "OGI Training Center",
  certification_status_at_issuance: "ACTIVE",
  issuing_organization_snapshot: "Ocean Guardian International Ltd.",
  supporting_evidence_refs: [
    {
      evidence_record_id: sourceEvidenceRecordId,
      template_code: "OGI_F048_DIGITAL_CREDENTIAL_ISSUANCE_FORM",
      template_version_id: "00000000-0000-4000-8000-000000810001",
      payload_checksum: "sha256:evidence"
    }
  ],
  issued_at: "2026-01-05T00:00:00.000Z"
};

const secondSourceEvidenceRecordId = "00000000-0000-4000-8000-000000800002";

function derivedPreparationField(value: string) {
  return {
    value,
    provenance_status: "DERIVED",
    source: "TEST_AUTHORITY",
    message: null
  } as const;
}

function requiresInputPreparationField(message = "Required for credential issuance.") {
  return {
    value: null,
    provenance_status: "REQUIRES_INPUT",
    source: null,
    message
  } as const;
}

function unavailablePreparationField(message = "Not available from the current certification.") {
  return {
    value: null,
    provenance_status: "UNAVAILABLE",
    source: null,
    message
  } as const;
}

const f048EvidenceCandidate = {
  operational_evidence_record_id: sourceEvidenceRecordId,
  template_code: "OGI_F048_DIGITAL_CREDENTIAL_ISSUANCE_FORM",
  template_version_id: "00000000-0000-4000-8000-000000810001",
  template_name: "Digital Credential & Verification Management Form",
  document_number: "OGI F-048",
  lifecycle_state: "GOVERNANCE_APPROVED",
  client_id: clientId,
  facility_id: null,
  payload_checksum: "sha256:evidence",
  created_at: "2026-01-04T00:00:00.000Z",
  submitted_at: "2026-01-04T01:00:00.000Z"
} as const;

const secondF048EvidenceCandidate = {
  ...f048EvidenceCandidate,
  operational_evidence_record_id: secondSourceEvidenceRecordId,
  document_number: "OGI F-048-A",
  payload_checksum: "sha256:evidence-two"
} as const;

const issuancePreparation: CredentialIssuancePreparationResponse = {
  preparation_status: "REQUIRES_INPUT",
  certification: {
    id: certificationId,
    certification_number: derivedPreparationField("CERT-001"),
    certification_level: derivedPreparationField("L3"),
    certification_status: derivedPreparationField("ACTIVE"),
    issue_date: derivedPreparationField("2026-01-01T00:00:00.000Z"),
    expiry_date: derivedPreparationField("2027-01-01T00:00:00.000Z"),
    program: {
      program_code: "OPEN_WATER_GUARDIAN",
      display_name: "Open Water Guardian",
      qualification_label: "Open Water Guardian"
    }
  },
  subject: {
    holder_name: derivedPreparationField("Ana Santos"),
    student_number: unavailablePreparationField("No governed Student Number is available."),
    trainee: null,
    staff_member: {
      id: staffMemberId,
      full_name: "Ana Santos",
      client_id: clientId
    },
    client: {
      id: clientId,
      organization_name: "Ocean Guard International"
    }
  },
  training: {
    readiness_decision: null,
    enrollment: null,
    session: null,
    completion_date: requiresInputPreparationField(),
    training_location: requiresInputPreparationField(),
    instructor: requiresInputPreparationField(),
    training_center: requiresInputPreparationField()
  },
  eligible_f048_evidence: [f048EvidenceCandidate],
  operational_authorization_options: [
    {
      id: operationalAuthorizationId,
      staff_member_id: staffMemberId,
      certification_id: certificationId,
      authorization_number: "AUTH-001",
      authorization_level: "L3",
      authorization_status: "ACTIVE",
      issue_date: "2026-01-05T00:00:00.000Z",
      expiry_date: "2027-01-05T00:00:00.000Z",
      renewal_date: null
    }
  ],
  existing_issuance: null,
  missing_required_inputs: [
    "completion_date",
    "training_location",
    "instructor",
    "training_center"
  ],
  limitations: []
};

const olderCredentialIssuance: CredentialIssuanceResponse = {
  ...credentialIssuance,
  id: olderCredentialIssuanceId,
  certification_number_snapshot: "OGI-OWG-000000",
  issued_at: "2026-01-04T00:00:00.000Z"
};

interface MockResponse {
  status: number;
  body?: unknown;
  statusText?: string;
  delayMs?: number;
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
  const rendered = render(
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>
  );

  return { router, ...rendered };
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

    if (!route && method === "GET" && url === issuanceHistoryUrl()) {
      return new Response(JSON.stringify({ issuances: [] }), {
        status: 200,
        headers: {
          "Content-Type": "application/json"
        }
      });
    }
    if (!route) {
      throw new Error(`Unexpected fetch call: ${method} ${url}`);
    }

    const next = route.responses.shift();

    if (!next) {
      throw new Error(`Unexpected fetch call count: ${method} ${url}`);
    }

    if (next.delayMs) {
      await new Promise((resolve) => window.setTimeout(resolve, next.delayMs));
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

function issuanceHistoryUrl() {
  return `/api/v1/credentials/issuances?certificationId=${certificationId}`;
}

function issuanceHistoryRoute(
  responses: MockResponse[] = [{ status: 200, body: { issuances: [] } }]
): MockRoute {
  return {
    url: issuanceHistoryUrl(),
    responses
  };
}

function issuancePreparationUrl(id = certificationId) {
  return `/api/v1/credentials/issuances/preparation?certificationId=${id}`;
}

function issuancePreparationRoute(
  responses: MockResponse[] = [{ status: 200, body: issuancePreparation }]
): MockRoute {
  return {
    url: issuancePreparationUrl(),
    responses
  };
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

function certificationRoutes(
  detail: CredentialsPersonnelDetailProjection = anaDetail,
  session: AuthenticatedSession = certificationSession
): MockRoute[] {
  return [
    ...authRoutes(session),
    {
      url: "/api/v1/credentials",
      responses: [{ status: 200, body: credentialsListResponse }]
    },
    {
      url: `/api/v1/credentials/personnel/${staffMemberId}`,
      responses: [{ status: 200, body: detail }]
    }
  ];
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
});

afterEach(() => {
  cleanup();
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

  it("renders selected Certification detail and endorsement history without command controls for view-only actors", async () => {
    const user = userEvent.setup();
    const { calls } = mockFetchRoutes(certificationRoutes());

    renderWithRoute(routes.certifications);

    await user.click(await screen.findByRole("button", { name: "View Certification" }));

    expect(await screen.findByText("CERT-001")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Endorsements" })).toBeInTheDocument();
    expect(screen.getByText("Open Water")).toBeInTheDocument();
    expect(screen.getByText("Recorded 2026-01-02")).toBeInTheDocument();
    expect(screen.queryByText(certificationId)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add Endorsement" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /renew/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /suspend/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /issue credential/i })).not.toBeInTheDocument();
    expect(calls.map(({ url }) => url)).toEqual([
      "/api/v1/auth/refresh",
      "/api/v1/auth/me",
      "/api/v1/credentials",
      `/api/v1/credentials/personnel/${staffMemberId}`,
      issuanceHistoryUrl()
    ]);
  });

  it("renders neutral empty endorsement state and exposes Add Endorsement only with permission", async () => {
    const user = userEvent.setup();
    mockFetchRoutes(certificationRoutes(anaDetailWithoutEndorsements, endorsementSession));

    renderWithRoute(routes.certifications);

    await user.click(await screen.findByRole("button", { name: "View Certification" }));

    expect(await screen.findByText("No endorsements recorded.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add Endorsement" })).toBeInTheDocument();
  });

  it("opens and cancels Add Endorsement without mutation", async () => {
    const user = userEvent.setup();
    const { calls } = mockFetchRoutes(certificationRoutes(anaDetailWithoutEndorsements, endorsementSession));

    renderWithRoute(routes.certifications);

    await user.click(await screen.findByRole("button", { name: "View Certification" }));
    await user.click(await screen.findByRole("button", { name: "Add Endorsement" }));

    expect(screen.getByText("Endorsing Open Water Guardian certificate CERT-001.")).toBeInTheDocument();
    expect(screen.getByLabelText("Endorsement")).toHaveValue("POOL");

    await user.selectOptions(screen.getByLabelText("Endorsement"), "WATERFRONT");
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByLabelText("Endorsement")).not.toBeInTheDocument();
    expect(calls.some((call) => call.url.includes("/endorsements"))).toBe(false);
  });

  it("submits the exact endorsement contract, refetches authoritative detail, and keeps the Certification selected", async () => {
    const user = userEvent.setup();
    const { calls } = mockFetchRoutes([
      ...authRoutes(endorsementSession),
      {
        url: "/api/v1/credentials",
        responses: [
          { status: 200, body: credentialsListResponse },
          { status: 200, body: credentialsListResponse }
        ]
      },
      {
        url: `/api/v1/credentials/personnel/${staffMemberId}`,
        responses: [
          { status: 200, body: anaDetailWithoutEndorsements },
          { status: 200, body: anaDetailWithNewEndorsement }
        ]
      },
      {
        method: "POST",
        url: `/api/v1/certifications/${certificationId}/endorsements`,
        responses: [
          {
            status: 201,
            body: {
              success: true,
              data: {
                certification_id: certificationId,
                endorsement: "WATERFRONT",
                created_at: "2026-01-03T00:00:00.000Z"
              }
            }
          }
        ]
      }
    ]);

    renderWithRoute(routes.certifications);

    await user.click(await screen.findByRole("button", { name: "View Certification" }));
    await user.click(await screen.findByRole("button", { name: "Add Endorsement" }));
    await user.selectOptions(screen.getByLabelText("Endorsement"), "WATERFRONT");
    const addButtons = screen.getAllByRole("button", { name: "Add Endorsement" });
    const submitButton = addButtons[addButtons.length - 1];

    expect(submitButton).toBeDefined();
    await user.click(submitButton);

    expect(await screen.findByText("Waterfront endorsement added successfully.")).toBeInTheDocument();
    expect(await screen.findByText("Waterfront")).toBeInTheDocument();
    expect(screen.getByText("CERT-001")).toBeInTheDocument();

    const endorsementCall = calls.find(
      (call) => call.url === `/api/v1/certifications/${certificationId}/endorsements`
    );

    expect(endorsementCall?.init?.method).toBe("POST");
    expect(JSON.parse(String(endorsementCall?.init?.body))).toEqual({
      endorsement: "WATERFRONT"
    });
    expect(
      calls.filter((call) => call.url === `/api/v1/credentials/personnel/${staffMemberId}`)
    ).toHaveLength(2);
    expect(
      calls.some(
        (call) =>
          call.url === "/api/v1/credentials/issuances" &&
          call.init?.method === "POST"
      )
    ).toBe(false);
    expect(calls.map(({ url }) => url)).not.toContain("/api/v1/operational-authorizations");
  });

  it("prevents duplicate Add Endorsement submission while pending", async () => {
    const user = userEvent.setup();
    const { calls } = mockFetchRoutes([
      ...authRoutes(endorsementSession),
      {
        url: "/api/v1/credentials",
        responses: [
          { status: 200, body: credentialsListResponse },
          { status: 200, body: credentialsListResponse }
        ]
      },
      {
        url: `/api/v1/credentials/personnel/${staffMemberId}`,
        responses: [
          { status: 200, body: anaDetailWithoutEndorsements },
          { status: 200, body: anaDetailWithNewEndorsement }
        ]
      },
      {
        method: "POST",
        url: `/api/v1/certifications/${certificationId}/endorsements`,
        responses: [
          {
            status: 201,
            delayMs: 50,
            body: {
              success: true,
              data: {
                certification_id: certificationId,
                endorsement: "WATERFRONT",
                created_at: "2026-01-03T00:00:00.000Z"
              }
            }
          }
        ]
      }
    ]);

    renderWithRoute(routes.certifications);

    await user.click(await screen.findByRole("button", { name: "View Certification" }));
    await user.click(await screen.findByRole("button", { name: "Add Endorsement" }));
    await user.selectOptions(screen.getByLabelText("Endorsement"), "WATERFRONT");
    const addButtons = screen.getAllByRole("button", { name: "Add Endorsement" });
    const submitButton = addButtons[addButtons.length - 1];

    expect(submitButton).toBeDefined();
    await user.click(submitButton);
    await user.click(screen.getByRole("button", { name: "Adding Endorsement" }));

    expect(await screen.findByText("Waterfront endorsement added successfully.")).toBeInTheDocument();
    expect(
      calls.filter((call) => call.url === `/api/v1/certifications/${certificationId}/endorsements`)
    ).toHaveLength(1);
  });

  it.each([
    [400, "Certification endorsement input is invalid."],
    [403, "Certification endorsement is not available with your current authorization."],
    [404, "Certification is unavailable or outside your scope."],
    [409, "Certification endorsement could not be added because of a conflict."],
    [500, "Certification endorsement could not be added."]
  ])("maps endorsement %i errors safely and refetches authoritative detail", async (status, message) => {
    const user = userEvent.setup();
    const { calls } = mockFetchRoutes([
      ...authRoutes(endorsementSession),
      {
        url: "/api/v1/credentials",
        responses: [{ status: 200, body: credentialsListResponse }]
      },
      {
        url: `/api/v1/credentials/personnel/${staffMemberId}`,
        responses: [
          { status: 200, body: anaDetailWithoutEndorsements },
          { status: 200, body: anaDetailWithoutEndorsements }
        ]
      },
      {
        method: "POST",
        url: `/api/v1/certifications/${certificationId}/endorsements`,
        responses: [
          {
            status,
            body: {
              success: false,
              code: "CERTIFICATION_ERROR",
              message: "Backend detail should not be shown.",
              status
            }
          }
        ]
      }
    ]);

    renderWithRoute(routes.certifications);

    await user.click(await screen.findByRole("button", { name: "View Certification" }));
    await user.click(await screen.findByRole("button", { name: "Add Endorsement" }));
    const addButtons = screen.getAllByRole("button", { name: "Add Endorsement" });
    const submitButton = addButtons[addButtons.length - 1];

    expect(submitButton).toBeDefined();
    await user.click(submitButton);

    expect(await screen.findByRole("alert")).toHaveTextContent(message);
    expect(screen.queryByText("Backend detail should not be shown.")).not.toBeInTheDocument();
    await waitFor(() =>
      expect(
        calls.filter((call) => call.url === `/api/v1/credentials/personnel/${staffMemberId}`)
      ).toHaveLength(2)
    );
  });

  it("renders Operational Authorization only with view_operational_authorization", async () => {
    const user = userEvent.setup();

    mockFetchRoutes(
      certificationRoutes(
        detailWithAuthorizations([activeOperationalAuthorization]),
        certificationSession
      )
    );

    renderWithRoute(routes.certifications);

    await user.click(await screen.findByRole("button", { name: "View Certification" }));

    expect(screen.queryByRole("heading", { name: "Operational Authorization" })).not.toBeInTheDocument();
    expect(screen.queryByText("AUTH-001")).not.toBeInTheDocument();

    cleanup();
    vi.unstubAllGlobals();
    window.sessionStorage.clear();
    window.sessionStorage.setItem(getRefreshTokenStorageKey(), "refresh-token");
    mockFetchRoutes(
      certificationRoutes(
        detailWithAuthorizations([activeOperationalAuthorization]),
        authorizationViewSession
      )
    );

    renderWithRoute(routes.certifications);
    await user.click(await screen.findByRole("button", { name: "View Certification" }));

    expect(
      await screen.findByRole("heading", { name: "Operational Authorization" })
    ).toBeInTheDocument();
    expect(screen.getByText("AUTH-001")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Create Operational Authorization" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Renew" })).not.toBeInTheDocument();
  });

  it("creates Operational Authorization with the exact backend contract and refetches authoritative projections", async () => {
    const user = userEvent.setup();
    const { calls } = mockFetchRoutes([
      ...authRoutes(authorizationCreateSession),
      {
        url: "/api/v1/credentials",
        responses: [
          { status: 200, body: credentialsListResponse },
          { status: 200, body: credentialsListResponse }
        ]
      },
      {
        url: `/api/v1/credentials/personnel/${staffMemberId}`,
        responses: [
          { status: 200, body: anaDetail },
          { status: 200, body: detailWithAuthorizations([activeOperationalAuthorization]) }
        ]
      },
      {
        method: "POST",
        url: "/api/v1/operational-authorizations",
        responses: [
          {
            status: 201,
            body: authorizationCommandResponse(activeOperationalAuthorization)
          }
        ]
      }
    ]);

    renderWithRoute(routes.certifications);

    await user.click(await screen.findByRole("button", { name: "View Certification" }));
    await user.click(await screen.findByRole("button", { name: "Create Operational Authorization" }));
    await user.type(screen.getByLabelText("Authorization number"), "AUTH-001");
    await user.selectOptions(screen.getByLabelText("Authorization level"), "L3");
    await user.type(screen.getByLabelText("Issue date"), "2026-01-05");
    await user.type(screen.getByLabelText("Expiry date"), "2027-01-05");
    const createButtons = screen.getAllByRole("button", {
      name: "Create Operational Authorization"
    });

    await user.click(createButtons[createButtons.length - 1]);

    expect(
      await screen.findByText("Operational Authorization created successfully.")
    ).toBeInTheDocument();
    expect(await screen.findByText("AUTH-001")).toBeInTheDocument();

    const createCall = calls.find(
      (call) => call.url === "/api/v1/operational-authorizations"
    );

    expect(createCall?.init?.method).toBe("POST");
    expect(JSON.parse(String(createCall?.init?.body))).toEqual({
      authorization_number: "AUTH-001",
      authorization_level: "L3",
      issue_date: "2026-01-05T00:00:00.000Z",
      expiry_date: "2027-01-05T00:00:00.000Z",
      certification_id: certificationId,
      staff_member_id: staffMemberId
    });
    expect(
      calls.filter((call) => call.url === `/api/v1/credentials/personnel/${staffMemberId}`)
    ).toHaveLength(2);
    expect(
      calls.some(
        (call) =>
          call.url === "/api/v1/credentials/issuances" &&
          call.init?.method === "POST"
      )
    ).toBe(false);
    expect(calls.map(({ url }) => url)).not.toContain("/api/v1/registration/facility-assignments");
    expect(calls.map(({ url }) => url)).not.toContain("/api/v1/auth/user-facility-access");
  });

  it("gates Operational Authorization actions by lifecycle status and permission", async () => {
    const user = userEvent.setup();

    mockFetchRoutes(
      certificationRoutes(
        detailWithAuthorizations([activeOperationalAuthorization]),
        authorizationViewSession
      )
    );

    renderWithRoute(routes.certifications);
    await user.click(await screen.findByRole("button", { name: "View Certification" }));

    expect(await screen.findByText("AUTH-001")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Renew" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Suspend" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Revoke" })).not.toBeInTheDocument();

    cleanup();
    vi.unstubAllGlobals();
    window.sessionStorage.clear();
    window.sessionStorage.setItem(getRefreshTokenStorageKey(), "refresh-token");
    mockFetchRoutes(
      certificationRoutes(
        detailWithAuthorizations([activeOperationalAuthorization]),
        authorizationLifecycleSession
      )
    );

    renderWithRoute(routes.certifications);
    await user.click(await screen.findByRole("button", { name: "View Certification" }));

    expect(await screen.findByRole("button", { name: "Renew" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Suspend" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Revoke" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reinstate" })).not.toBeInTheDocument();

    cleanup();
    vi.unstubAllGlobals();
    window.sessionStorage.clear();
    window.sessionStorage.setItem(getRefreshTokenStorageKey(), "refresh-token");
    mockFetchRoutes(
      certificationRoutes(
        detailWithAuthorizations([suspendedOperationalAuthorization]),
        authorizationLifecycleSession
      )
    );

    renderWithRoute(routes.certifications);
    await user.click(await screen.findByRole("button", { name: "View Certification" }));

    expect(await screen.findByRole("button", { name: "Reinstate" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Revoke" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Renew" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Suspend" })).not.toBeInTheDocument();

    cleanup();
    vi.unstubAllGlobals();
    window.sessionStorage.clear();
    window.sessionStorage.setItem(getRefreshTokenStorageKey(), "refresh-token");
    mockFetchRoutes(
      certificationRoutes(
        detailWithAuthorizations([revokedOperationalAuthorization]),
        authorizationLifecycleSession
      )
    );

    renderWithRoute(routes.certifications);
    await user.click(await screen.findByRole("button", { name: "View Certification" }));

    expect(await screen.findByText("AUTH-001")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Renew" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reinstate" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Revoke" })).not.toBeInTheDocument();
  });

  it("renders multiple Operational Authorization records without collapsing retained history", async () => {
    const user = userEvent.setup();

    mockFetchRoutes(
      certificationRoutes(
        detailWithAuthorizations([
          renewedOperationalAuthorization,
          revokedOperationalAuthorization
        ]),
        authorizationLifecycleSession
      )
    );

    renderWithRoute(routes.certifications);

    await user.click(await screen.findByRole("button", { name: "View Certification" }));

    expect(await screen.findByText("AUTH-002")).toBeInTheDocument();
    expect(screen.getByText("AUTH-001")).toBeInTheDocument();
    expect(screen.getByText("Previous authorization retained as metadata.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Renew" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Suspend" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reinstate" })).not.toBeInTheDocument();
  });

  it("renews Operational Authorization with exact contract and keeps previous authorization metadata read-only", async () => {
    const user = userEvent.setup();
    const { calls } = mockFetchRoutes([
      ...authRoutes(authorizationLifecycleSession),
      {
        url: "/api/v1/credentials",
        responses: [
          { status: 200, body: credentialsListResponse },
          { status: 200, body: credentialsListResponse }
        ]
      },
      {
        url: `/api/v1/credentials/personnel/${staffMemberId}`,
        responses: [
          { status: 200, body: detailWithAuthorizations([activeOperationalAuthorization]) },
          { status: 200, body: detailWithAuthorizations([renewedOperationalAuthorization]) }
        ]
      },
      {
        method: "POST",
        url: `/api/v1/operational-authorizations/${operationalAuthorizationId}/renew`,
        responses: [
          {
            status: 201,
            body: authorizationCommandResponse(renewedOperationalAuthorization)
          }
        ]
      }
    ]);

    renderWithRoute(routes.certifications);

    await user.click(await screen.findByRole("button", { name: "View Certification" }));
    await user.click(await screen.findByRole("button", { name: "Renew" }));
    await user.type(screen.getByLabelText("Authorization number"), "AUTH-002");
    await user.type(screen.getByLabelText("Issue date"), "2026-02-01");
    await user.type(screen.getByLabelText("Expiry date"), "2027-02-01");
    await user.click(screen.getByRole("button", { name: "Renew Authorization" }));

    expect(
      await screen.findByText("Operational Authorization renewed successfully.")
    ).toBeInTheDocument();
    expect(await screen.findByText("AUTH-002")).toBeInTheDocument();
    expect(screen.getByText("Previous authorization retained as metadata.")).toBeInTheDocument();

    const renewCall = calls.find(
      (call) =>
        call.url === `/api/v1/operational-authorizations/${operationalAuthorizationId}/renew`
    );

    expect(renewCall?.init?.method).toBe("POST");
    expect(JSON.parse(String(renewCall?.init?.body))).toEqual({
      authorization_number: "AUTH-002",
      issue_date: "2026-02-01T00:00:00.000Z",
      expiry_date: "2027-02-01T00:00:00.000Z"
    });
  });

  it("prevents duplicate Operational Authorization lifecycle submission while pending", async () => {
    const user = userEvent.setup();
    const { calls } = mockFetchRoutes([
      ...authRoutes(authorizationLifecycleSession),
      {
        url: "/api/v1/credentials",
        responses: [
          { status: 200, body: credentialsListResponse },
          { status: 200, body: credentialsListResponse }
        ]
      },
      {
        url: `/api/v1/credentials/personnel/${staffMemberId}`,
        responses: [
          { status: 200, body: detailWithAuthorizations([activeOperationalAuthorization]) },
          { status: 200, body: detailWithAuthorizations([suspendedOperationalAuthorization]) }
        ]
      },
      {
        method: "POST",
        url: `/api/v1/operational-authorizations/${operationalAuthorizationId}/suspend`,
        responses: [
          {
            status: 200,
            delayMs: 50,
            body: authorizationCommandResponse(suspendedOperationalAuthorization)
          }
        ]
      }
    ]);

    renderWithRoute(routes.certifications);

    await user.click(await screen.findByRole("button", { name: "View Certification" }));
    await user.click(await screen.findByRole("button", { name: "Suspend" }));
    await user.type(screen.getByLabelText("Reason"), "Temporary operating restriction");
    await user.click(screen.getByRole("button", { name: "Suspend Authorization" }));
    await user.click(screen.getByRole("button", { name: "Suspending" }));

    expect(
      await screen.findByText("Operational Authorization suspended successfully.")
    ).toBeInTheDocument();
    expect(
      calls.filter(
        (call) =>
          call.url ===
          `/api/v1/operational-authorizations/${operationalAuthorizationId}/suspend`
      )
    ).toHaveLength(1);
  });

  it.each([
    ["suspend", "Suspend", "Suspend Authorization", "/suspend", "Operational Authorization suspended successfully."],
    ["reinstate", "Reinstate", "Reinstate Authorization", "/reinstate", "Operational Authorization reinstated successfully."],
    ["revoke", "Revoke", "Revoke Authorization", "/revoke", "Operational Authorization revoked successfully."]
  ])(
    "submits %s Operational Authorization governance commands with reason and optional notes only",
    async (_mode, actionLabel, submitLabel, suffix, successMessage) => {
      const user = userEvent.setup();
      const sourceAuthorization =
        actionLabel === "Reinstate"
          ? suspendedOperationalAuthorization
          : activeOperationalAuthorization;
      const updatedAuthorization =
        actionLabel === "Suspend"
          ? suspendedOperationalAuthorization
          : actionLabel === "Revoke"
          ? revokedOperationalAuthorization
          : activeOperationalAuthorization;
      const { calls } = mockFetchRoutes([
        ...authRoutes(authorizationLifecycleSession),
        {
          url: "/api/v1/credentials",
          responses: [
            { status: 200, body: credentialsListResponse },
            { status: 200, body: credentialsListResponse }
          ]
        },
        {
          url: `/api/v1/credentials/personnel/${staffMemberId}`,
          responses: [
            { status: 200, body: detailWithAuthorizations([sourceAuthorization]) },
            { status: 200, body: detailWithAuthorizations([updatedAuthorization]) }
          ]
        },
        {
          method: "POST",
          url: `/api/v1/operational-authorizations/${operationalAuthorizationId}${suffix}`,
          responses: [
            {
              status: 200,
              body: authorizationCommandResponse(updatedAuthorization)
            }
          ]
        }
      ]);

      renderWithRoute(routes.certifications);

      await user.click(await screen.findByRole("button", { name: "View Certification" }));
      await user.click(await screen.findByRole("button", { name: actionLabel }));
      await user.type(screen.getByLabelText("Reason"), "Governed lifecycle update");
      await user.type(screen.getByLabelText("Notes"), "Reviewed by OGI");
      await user.click(screen.getByRole("button", { name: submitLabel }));

      expect(await screen.findByText(successMessage)).toBeInTheDocument();

      const commandCall = calls.find(
        (call) => call.url === `/api/v1/operational-authorizations/${operationalAuthorizationId}${suffix}`
      );

      expect(commandCall?.init?.method).toBe("POST");
      expect(JSON.parse(String(commandCall?.init?.body))).toEqual({
        reason: "Governed lifecycle update",
        notes: "Reviewed by OGI"
      });
    }
  );

  it("maps Operational Authorization conflicts safely and refetches persisted state", async () => {
    const user = userEvent.setup();
    const { calls } = mockFetchRoutes([
      ...authRoutes(authorizationLifecycleSession),
      {
        url: "/api/v1/credentials",
        responses: [{ status: 200, body: credentialsListResponse }]
      },
      {
        url: `/api/v1/credentials/personnel/${staffMemberId}`,
        responses: [
          { status: 200, body: detailWithAuthorizations([activeOperationalAuthorization]) },
          { status: 200, body: detailWithAuthorizations([activeOperationalAuthorization]) }
        ]
      },
      {
        method: "POST",
        url: `/api/v1/operational-authorizations/${operationalAuthorizationId}/suspend`,
        responses: [
          {
            status: 409,
            body: {
              success: false,
              code: "OPERATIONAL_AUTHORIZATION_CONFLICT",
              message: "Backend detail should not be shown.",
              status: 409
            }
          }
        ]
      }
    ]);

    renderWithRoute(routes.certifications);

    await user.click(await screen.findByRole("button", { name: "View Certification" }));
    await user.click(await screen.findByRole("button", { name: "Suspend" }));
    await user.type(screen.getByLabelText("Reason"), "Duplicate lifecycle command");
    await user.click(screen.getByRole("button", { name: "Suspend Authorization" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Operational Authorization lifecycle action could not be completed because of a conflict."
    );
    expect(screen.queryByText("Backend detail should not be shown.")).not.toBeInTheDocument();
    await waitFor(() =>
      expect(
        calls.filter((call) => call.url === `/api/v1/credentials/personnel/${staffMemberId}`)
      ).toHaveLength(2)
    );
  });

  it("shows Credential Issuances context for selected Certifications and gates Issue Credential by issue_certification", async () => {
    const user = userEvent.setup();

    mockFetchRoutes(certificationRoutes(anaDetail, certificationSession));

    renderWithRoute(routes.certifications);

    await user.click(await screen.findByRole("button", { name: "View Certification" }));

    expect(
      await screen.findByRole("heading", { name: "Credential Issuances" })
    ).toBeInTheDocument();
    expect(
      screen.getByText("No credentials have been issued from this certification.")
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Issue Credential" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Endorsements" })).toBeInTheDocument();
    expect(screen.queryByText("dev-preview")).not.toBeInTheDocument();

    cleanup();
    vi.unstubAllGlobals();
    window.sessionStorage.clear();
    window.sessionStorage.setItem(getRefreshTokenStorageKey(), "refresh-token");
    mockFetchRoutes(certificationRoutes(anaDetail, issueSession));

    renderWithRoute(routes.certifications);
    await user.click(await screen.findByRole("button", { name: "View Certification" }));

    expect(await screen.findByRole("button", { name: "Issue Credential" })).toBeInTheDocument();
  });

  it("loads persisted Credential Issuance history for a selected Certification", async () => {
    const user = userEvent.setup();

    mockFetchRoutes([
      ...authRoutes(certificationSession),
      {
        url: "/api/v1/credentials",
        responses: [{ status: 200, body: credentialsListResponse }]
      },
      {
        url: `/api/v1/credentials/personnel/${staffMemberId}`,
        responses: [{ status: 200, body: anaDetail }]
      },
      issuanceHistoryRoute([
        {
          status: 200,
          body: { issuances: [credentialIssuance, olderCredentialIssuance] }
        }
      ])
    ]);

    renderWithRoute(routes.certifications);

    await user.click(await screen.findByRole("button", { name: "View Certification" }));

    expect(await screen.findByText("Credential OGI-OWG-000001")).toBeInTheDocument();
    expect(screen.getByText("Credential OGI-OWG-000000")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Issue Credential" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "View Certificate" })[0]).toHaveAttribute(
      "href",
      routes.credentialCertificatePath(credentialIssuanceId)
    );
  });

  it("navigates from persisted Credential Issuance history to the Certificate viewer", async () => {
    const user = userEvent.setup();
    const certificatePath = routes.credentialCertificatePath(credentialIssuanceId);
    const { calls } = mockFetchRoutes([
      ...authRoutes(certificationSession),
      {
        url: "/api/v1/credentials",
        responses: [{ status: 200, body: credentialsListResponse }]
      },
      {
        url: `/api/v1/credentials/personnel/${staffMemberId}`,
        responses: [{ status: 200, body: anaDetail }]
      },
      issuanceHistoryRoute([
        {
          status: 200,
          body: { issuances: [credentialIssuance] }
        }
      ]),
      {
        url: `/api/v1/credentials/issuances/${credentialIssuanceId}`,
        responses: [{ status: 200, body: credentialIssuance }]
      },
      {
        url: `/api/v1/credentials/issuances/${credentialIssuanceId}/certificate`,
        responses: [
          {
            status: 200,
            body: new Blob(["%PDF-1.4\ncertificate"], {
              type: "application/pdf"
            })
          }
        ]
      }
    ]);
    const { router } = renderWithRoute(routes.certifications);

    await user.click(await screen.findByRole("button", { name: "View Certification" }));

    const viewCertificateLink = await screen.findByRole("link", {
      name: "View Certificate"
    });

    expect(viewCertificateLink).toHaveAttribute("href", certificatePath);

    await user.click(viewCertificateLink);

    await waitFor(() => expect(router.state.location.pathname).toBe(certificatePath));
    expect(
      await screen.findByRole("heading", { name: "Digital Certificate" })
    ).toBeInTheDocument();
    expect(
      await screen.findByLabelText("Digital certificate visual preview")
    ).toBeInTheDocument();
    expect(screen.getByText("Canonical PDF artifact is ready for opening or download.")).toBeInTheDocument();
    expect(calls.map(({ url }) => url)).toContain(
      `/api/v1/credentials/issuances/${credentialIssuanceId}`
    );
    expect(calls.map(({ url }) => url)).toContain(
      `/api/v1/credentials/issuances/${credentialIssuanceId}/certificate`
    );
    const metadataCall = calls.find(
      (call) => call.url === `/api/v1/credentials/issuances/${credentialIssuanceId}`
    );
    const certificateCall = calls.find(
      (call) => call.url === `/api/v1/credentials/issuances/${credentialIssuanceId}/certificate`
    );

    expect(metadataCall?.init?.method).toBe("GET");
    expect(certificateCall?.init?.method).toBe("GET");
  });
  it("distinguishes Credential Issuance history loading and error states", async () => {
    const user = userEvent.setup();

    mockFetchRoutes([
      ...authRoutes(certificationSession),
      {
        url: "/api/v1/credentials",
        responses: [{ status: 200, body: credentialsListResponse }]
      },
      {
        url: `/api/v1/credentials/personnel/${staffMemberId}`,
        responses: [{ status: 200, body: anaDetail }]
      },
      issuanceHistoryRoute([
        {
          status: 200,
          delayMs: 50,
          body: { issuances: [] }
        }
      ])
    ]);

    renderWithRoute(routes.certifications);

    await user.click(await screen.findByRole("button", { name: "View Certification" }));

    expect(await screen.findByText("Loading credential issuance history.")).toBeInTheDocument();
    expect(await screen.findByText("No credentials have been issued from this certification.")).toBeInTheDocument();

    cleanup();
    vi.unstubAllGlobals();
    window.sessionStorage.clear();
    window.sessionStorage.setItem(getRefreshTokenStorageKey(), "refresh-token");
    mockFetchRoutes([
      ...authRoutes(certificationSession),
      {
        url: "/api/v1/credentials",
        responses: [{ status: 200, body: credentialsListResponse }]
      },
      {
        url: `/api/v1/credentials/personnel/${staffMemberId}`,
        responses: [{ status: 200, body: anaDetail }]
      },
      issuanceHistoryRoute([
        {
          status: 500,
          body: {
            code: "CREDENTIAL_ISSUANCE_REQUEST_FAILED",
            message: "Backend detail should not be shown.",
            status: 500
          }
        }
      ])
    ]);

    renderWithRoute(routes.certifications);
    await user.click(await screen.findByRole("button", { name: "View Certification" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Credential issuance could not be completed."
    );
    expect(screen.queryByText("No credentials have been issued from this certification.")).not.toBeInTheDocument();
    expect(screen.queryByText("Backend detail should not be shown.")).not.toBeInTheDocument();
  });

  it("opens and cancels Credential Issuances without mutation", async () => {
    const user = userEvent.setup();
    const { calls } = mockFetchRoutes([
      ...certificationRoutes(anaDetail, issueSession),
      issuancePreparationRoute()
    ]);

    renderWithRoute(routes.certifications);

    await user.click(await screen.findByRole("button", { name: "View Certification" }));
    await user.click(await screen.findByRole("button", { name: "Issue Credential" }));

    expect(screen.getByText("Issuing from selected certificate CERT-001.")).toBeInTheDocument();
    expect(await screen.findByLabelText("F-048 evidence")).toBeInTheDocument();
    expect(screen.queryByLabelText("F-048 evidence record ID")).not.toBeInTheDocument();

    await user.type(screen.getByLabelText("Training location"), "Subic Bay");
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByLabelText("F-048 evidence")).not.toBeInTheDocument();
    expect(
      calls.some(
        (call) =>
          call.url === "/api/v1/credentials/issuances" &&
          call.init?.method === "POST"
      )
    ).toBe(false);
  });

  it("submits exact Credential Issuances contract, refetches projections, and links to the returned certificate", async () => {
    const user = userEvent.setup();
    const { calls } = mockFetchRoutes([
      ...authRoutes(credentialIssuanceSession),
      {
        url: "/api/v1/credentials",
        responses: [
          { status: 200, body: credentialsListResponse },
          { status: 200, body: credentialsListResponse }
        ]
      },
      {
        url: `/api/v1/credentials/personnel/${staffMemberId}`,
        responses: [
          { status: 200, body: detailWithAuthorizations([activeOperationalAuthorization]) },
          { status: 200, body: detailWithAuthorizations([activeOperationalAuthorization]) }
        ]
      },
      issuanceHistoryRoute([
        { status: 200, body: { issuances: [] } },
        { status: 200, body: { issuances: [credentialIssuance] } }
      ]),
      issuancePreparationRoute(),
      {
        method: "POST",
        url: "/api/v1/credentials/issuances",
        responses: [{ status: 201, body: credentialIssuance }]
      }
    ]);

    renderWithRoute(routes.certifications);

    await user.click(await screen.findByRole("button", { name: "View Certification" }));
    await user.click(await screen.findByRole("button", { name: "Issue Credential" }));
    expect(await screen.findByLabelText("F-048 evidence")).toHaveValue(sourceEvidenceRecordId);
    const authorizationSelector = screen
      .getAllByLabelText("Operational Authorization")
      .find((element): element is HTMLSelectElement => element instanceof HTMLSelectElement);
    expect(authorizationSelector).toHaveValue(operationalAuthorizationId);
    expect(screen.queryByLabelText("F-048 evidence record ID")).not.toBeInTheDocument();
    await user.type(screen.getByLabelText("Completion date"), "2025-12-31");
    await user.type(screen.getByLabelText("Training location"), "Subic Bay");
    await user.type(screen.getByLabelText("Instructor"), "Braven Burrows");
    await user.type(screen.getByLabelText("Training center"), "OGI Training Center");
    await user.click(screen.getByRole("button", { name: "Confirm Issue Credential" }));

    expect(await screen.findByText("Credential issued successfully.")).toBeInTheDocument();
    expect(await screen.findByText("Credential OGI-OWG-000001")).toBeInTheDocument();
    expect(screen.getByText("Newly issued")).toBeInTheDocument();
    expect(screen.getByText("Ocean Guardian International Ltd.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View Certificate" })).toHaveAttribute(
      "href",
      routes.credentialCertificatePath(credentialIssuanceId)
    );
    expect(screen.getByText("CERT-001")).toBeInTheDocument();

    const issuanceCall = calls.find((call) => call.url === "/api/v1/credentials/issuances");

    expect(issuanceCall?.init?.method).toBe("POST");
    expect(JSON.parse(String(issuanceCall?.init?.body))).toEqual({
      certification_id: certificationId,
      source_evidence_record_id: sourceEvidenceRecordId,
      source_authorization_id: operationalAuthorizationId,
      completion_date: "2025-12-31",
      training_location: "Subic Bay",
      instructor: "Braven Burrows",
      training_center: "OGI Training Center"
    });
    expect(
      calls.filter((call) => call.url === `/api/v1/credentials/personnel/${staffMemberId}`)
    ).toHaveLength(2);
    expect(calls.map(({ url }) => url)).not.toContain("/api/v1/registration/facility-assignments");
    expect(calls.map(({ url }) => url)).not.toContain("/api/v1/auth/user-facility-access");
  });

  it("uses derived preparation facts without editable fields or invented authorization", async () => {
    const user = userEvent.setup();
    const traineePreparation: CredentialIssuancePreparationResponse = {
      ...issuancePreparation,
      preparation_status: "READY_FOR_REVIEW",
      subject: {
        ...issuancePreparation.subject,
        holder_name: derivedPreparationField("Mika Reyes"),
        student_number: derivedPreparationField("OGI-STU-2026-0001"),
        trainee: {
          id: "00000000-0000-4000-8000-000000700001",
          full_name: "Mika Reyes",
          student_number: "OGI-STU-2026-0001"
        },
        staff_member: null,
        client: null
      },
      training: {
        ...issuancePreparation.training,
        completion_date: derivedPreparationField("2025-12-31"),
        training_location: derivedPreparationField("Subic Bay"),
        instructor: derivedPreparationField("Braven Burrows"),
        training_center: derivedPreparationField("OGI Training Center")
      },
      operational_authorization_options: [],
      missing_required_inputs: []
    };
    const { calls } = mockFetchRoutes([
      ...certificationRoutes(anaDetail, issueSession),
      issuancePreparationRoute([{ status: 200, body: traineePreparation }]),
      issuanceHistoryRoute([
        { status: 200, body: { issuances: [] } },
        {
          status: 200,
          body: {
            issuances: [
              {
                ...credentialIssuance,
                staff_member_id: null,
                client_id: null,
                source_authorization_id: null,
                holder_name_snapshot: "Mika Reyes",
                student_number_snapshot: "OGI-STU-2026-0001"
              }
            ]
          }
        }
      ]),
      {
        method: "POST",
        url: "/api/v1/credentials/issuances",
        responses: [
          {
            status: 201,
            body: {
              ...credentialIssuance,
              staff_member_id: null,
              client_id: null,
              source_authorization_id: null,
              holder_name_snapshot: "Mika Reyes",
              student_number_snapshot: "OGI-STU-2026-0001"
            }
          }
        ]
      }
    ]);

    renderWithRoute(routes.certifications);

    await user.click(await screen.findByRole("button", { name: "View Certification" }));
    await user.click(await screen.findByRole("button", { name: "Issue Credential" }));

    expect(await screen.findByText("Mika Reyes")).toBeInTheDocument();
    expect(screen.getByText("OGI-STU-2026-0001")).toBeInTheDocument();
    expect(screen.getByText("No Operational Authorization selected.")).toBeInTheDocument();
    expect(screen.queryByLabelText("Completion date")).not.toBeInTheDocument();
    expect(screen.getByText("Completion date")).toBeInTheDocument();
    expect(screen.getByText("Subic Bay")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Confirm Issue Credential" }));

    const issuanceCall = calls.find((call) => call.url === "/api/v1/credentials/issuances");

    expect(JSON.parse(String(issuanceCall?.init?.body))).toEqual({
      certification_id: certificationId,
      source_evidence_record_id: sourceEvidenceRecordId,
      completion_date: "2025-12-31",
      training_location: "Subic Bay",
      instructor: "Braven Burrows",
      training_center: "OGI Training Center"
    });
  });

  it("requires an explicit F-048 choice when multiple governed evidence candidates are available", async () => {
    const user = userEvent.setup();
    const { calls } = mockFetchRoutes([
      ...certificationRoutes(anaDetail, issueSession),
      issuancePreparationRoute([
        {
          status: 200,
          body: {
            ...issuancePreparation,
            eligible_f048_evidence: [
              f048EvidenceCandidate,
              secondF048EvidenceCandidate
            ],
            operational_authorization_options: []
          }
        }
      ]),
      issuanceHistoryRoute([
        { status: 200, body: { issuances: [] } },
        { status: 200, body: { issuances: [credentialIssuance] } }
      ]),
      {
        method: "POST",
        url: "/api/v1/credentials/issuances",
        responses: [
          {
            status: 201,
            body: {
              ...credentialIssuance,
              source_evidence_record_id: secondSourceEvidenceRecordId,
              source_authorization_id: null
            }
          }
        ]
      }
    ]);

    renderWithRoute(routes.certifications);

    await user.click(await screen.findByRole("button", { name: "View Certification" }));
    await user.click(await screen.findByRole("button", { name: "Issue Credential" }));

    const evidenceSelector = await screen.findByLabelText("F-048 evidence");
    expect(evidenceSelector).toHaveValue("");
    await user.selectOptions(evidenceSelector, secondSourceEvidenceRecordId);
    await user.type(screen.getByLabelText("Completion date"), "2025-12-31");
    await user.type(screen.getByLabelText("Training location"), "Subic Bay");
    await user.type(screen.getByLabelText("Instructor"), "Braven Burrows");
    await user.type(screen.getByLabelText("Training center"), "OGI Training Center");
    await user.click(screen.getByRole("button", { name: "Confirm Issue Credential" }));

    const issuanceCall = calls.find((call) => call.url === "/api/v1/credentials/issuances");

    expect(JSON.parse(String(issuanceCall?.init?.body))).toMatchObject({
      source_evidence_record_id: secondSourceEvidenceRecordId
    });
  });

  it("renders blocked and already-issued preparation states without a usable issuance workflow", async () => {
    const user = userEvent.setup();
    const { calls } = mockFetchRoutes([
      ...certificationRoutes(anaDetail, issueSession),
      issuancePreparationRoute([
        {
          status: 200,
          body: {
            ...issuancePreparation,
            preparation_status: "BLOCKED",
            eligible_f048_evidence: [],
            limitations: ["Approved F-048 evidence is unavailable."]
          }
        }
      ])
    ]);

    renderWithRoute(routes.certifications);

    await user.click(await screen.findByRole("button", { name: "View Certification" }));
    await user.click(await screen.findByRole("button", { name: "Issue Credential" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Credential issuance is blocked by the current preparation state."
    );
    expect(screen.queryByLabelText("F-048 evidence")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirm Issue Credential" })).toBeDisabled();
    expect(calls.some((call) => call.url === "/api/v1/credentials/issuances")).toBe(false);

    cleanup();
    vi.unstubAllGlobals();
    window.sessionStorage.clear();
    window.sessionStorage.setItem(getRefreshTokenStorageKey(), "refresh-token");

    mockFetchRoutes([
      ...certificationRoutes(anaDetail, issueSession),
      issuancePreparationRoute([
        {
          status: 200,
          body: {
            ...issuancePreparation,
            preparation_status: "ALREADY_ISSUED",
            existing_issuance: {
              id: credentialIssuanceId,
              source_certification_id: certificationId,
              issued_at: "2026-01-05T00:00:00.000Z",
              certificate_template_code_snapshot: "OGI_L1_L7_CERTIFICATE_FAMILY"
            }
          }
        }
      ])
    ]);

    renderWithRoute(routes.certifications);

    await user.click(await screen.findByRole("button", { name: "View Certification" }));
    await user.click(await screen.findByRole("button", { name: "Issue Credential" }));

    expect(await screen.findByText("Credential already issued.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View Certificate" })).toHaveAttribute(
      "href",
      routes.credentialCertificatePath(credentialIssuanceId)
    );
    expect(screen.queryByLabelText("F-048 evidence")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirm Issue Credential" })).toBeDisabled();
  });

  it("does not include hidden Operational Authorization context when the actor lacks authorization visibility", async () => {
    const user = userEvent.setup();
    const { calls } = mockFetchRoutes([
      ...authRoutes(issueSession),
      {
        url: "/api/v1/credentials",
        responses: [
          { status: 200, body: credentialsListResponse },
          { status: 200, body: credentialsListResponse }
        ]
      },
      {
        url: `/api/v1/credentials/personnel/${staffMemberId}`,
        responses: [
          { status: 200, body: detailWithAuthorizations([activeOperationalAuthorization]) },
          { status: 200, body: detailWithAuthorizations([activeOperationalAuthorization]) }
        ]
      },
      issuancePreparationRoute([
        {
          status: 200,
          body: {
            ...issuancePreparation,
            operational_authorization_options: []
          }
        }
      ]),
      {
        method: "POST",
        url: "/api/v1/credentials/issuances",
        responses: [
          {
            status: 201,
            body: {
              ...credentialIssuance,
              source_authorization_id: null
            }
          }
        ]
      }
    ]);

    renderWithRoute(routes.certifications);

    await user.click(await screen.findByRole("button", { name: "View Certification" }));
    expect(screen.queryByRole("heading", { name: "Operational Authorization" })).not.toBeInTheDocument();
    await user.click(await screen.findByRole("button", { name: "Issue Credential" }));
    expect(await screen.findByLabelText("F-048 evidence")).toHaveValue(sourceEvidenceRecordId);
    expect(screen.getByText("No Operational Authorization selected.")).toBeInTheDocument();
    await user.type(screen.getByLabelText("Completion date"), "2025-12-31");
    await user.type(screen.getByLabelText("Training location"), "Subic Bay");
    await user.type(screen.getByLabelText("Instructor"), "Braven Burrows");
    await user.type(screen.getByLabelText("Training center"), "OGI Training Center");
    await user.click(screen.getByRole("button", { name: "Confirm Issue Credential" }));

    const issuanceCall = calls.find((call) => call.url === "/api/v1/credentials/issuances");

    expect(JSON.parse(String(issuanceCall?.init?.body))).toEqual({
      certification_id: certificationId,
      source_evidence_record_id: sourceEvidenceRecordId,
      completion_date: "2025-12-31",
      training_location: "Subic Bay",
      instructor: "Braven Burrows",
      training_center: "OGI Training Center"
    });
  });

  it("prevents duplicate Credential Issuances submission while pending", async () => {
    const user = userEvent.setup();
    const { calls } = mockFetchRoutes([
      ...authRoutes(issueSession),
      {
        url: "/api/v1/credentials",
        responses: [
          { status: 200, body: credentialsListResponse },
          { status: 200, body: credentialsListResponse }
        ]
      },
      {
        url: `/api/v1/credentials/personnel/${staffMemberId}`,
        responses: [
          { status: 200, body: anaDetail },
          { status: 200, body: anaDetail }
        ]
      },
      issuancePreparationRoute(),
      {
        method: "POST",
        url: "/api/v1/credentials/issuances",
        responses: [
          {
            status: 201,
            delayMs: 50,
            body: {
              ...credentialIssuance,
              source_authorization_id: null
            }
          }
        ]
      }
    ]);

    renderWithRoute(routes.certifications);

    await user.click(await screen.findByRole("button", { name: "View Certification" }));
    await user.click(await screen.findByRole("button", { name: "Issue Credential" }));
    expect(await screen.findByLabelText("F-048 evidence")).toHaveValue(sourceEvidenceRecordId);
    await user.type(screen.getByLabelText("Completion date"), "2025-12-31");
    await user.type(screen.getByLabelText("Training location"), "Subic Bay");
    await user.type(screen.getByLabelText("Instructor"), "Braven Burrows");
    await user.type(screen.getByLabelText("Training center"), "OGI Training Center");
    await user.click(screen.getByRole("button", { name: "Confirm Issue Credential" }));
    await user.click(screen.getByRole("button", { name: "Issuing Credential" }));

    expect(await screen.findByText("Credential issued successfully.")).toBeInTheDocument();
    expect(calls.filter((call) => call.url === "/api/v1/credentials/issuances")).toHaveLength(1);
  });

  it.each([
    [400, "Credential issuance input is invalid."],
    [403, "Credential issuance is not available with your current authorization."],
    [404, "Credential issuance source is unavailable or outside your scope."],
    [409, "Credential issuance could not be completed because of a conflict."],
    [422, "Credential issuance input is invalid."],
    [500, "Credential issuance could not be completed."]
  ])("maps Credential Issuances %i errors safely and refetches authoritative state", async (status, message) => {
    const user = userEvent.setup();
    const { calls } = mockFetchRoutes([
      ...authRoutes(issueSession),
      {
        url: "/api/v1/credentials",
        responses: [{ status: 200, body: credentialsListResponse }]
      },
      {
        url: `/api/v1/credentials/personnel/${staffMemberId}`,
        responses: [
          { status: 200, body: anaDetail },
          { status: 200, body: anaDetail }
        ]
      },
      issuancePreparationRoute([
        { status: 200, body: issuancePreparation },
        { status: 200, body: issuancePreparation }
      ]),
      {
        method: "POST",
        url: "/api/v1/credentials/issuances",
        responses: [
          {
            status,
            body: {
              code: "CREDENTIAL_ISSUANCE_ERROR",
              message: "Backend detail should not be shown.",
              status
            }
          }
        ]
      }
    ]);

    renderWithRoute(routes.certifications);

    await user.click(await screen.findByRole("button", { name: "View Certification" }));
    await user.click(await screen.findByRole("button", { name: "Issue Credential" }));
    expect(await screen.findByLabelText("F-048 evidence")).toHaveValue(sourceEvidenceRecordId);
    await user.type(screen.getByLabelText("Completion date"), "2025-12-31");
    await user.type(screen.getByLabelText("Training location"), "Subic Bay");
    await user.type(screen.getByLabelText("Instructor"), "Braven Burrows");
    await user.type(screen.getByLabelText("Training center"), "OGI Training Center");
    await user.click(screen.getByRole("button", { name: "Confirm Issue Credential" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(message);
    expect(screen.queryByText("Backend detail should not be shown.")).not.toBeInTheDocument();
    await waitFor(() =>
      expect(
        calls.filter((call) => call.url === `/api/v1/credentials/personnel/${staffMemberId}`)
      ).toHaveLength(2)
    );
    await waitFor(() =>
      expect(calls.filter((call) => call.url === issuancePreparationUrl())).toHaveLength(2)
    );
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

    cleanup();
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
    expect(screen.queryByRole("button", { name: "Add Endorsement" })).not.toBeInTheDocument();
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
    expect(
      calls.some(
        (call) =>
          call.url === "/api/v1/credentials/issuances" &&
          call.init?.method === "POST"
      )
    ).toBe(false);
    expect(calls.map(({ url }) => url)).not.toContain("/api/v1/operational-authorizations");
    expect(calls.map(({ url }) => url)).not.toContain("/api/v1/registration/facility-assignments");
    expect(calls.map(({ url }) => url)).not.toContain("/api/v1/auth/user-facility-access");
  });
});
