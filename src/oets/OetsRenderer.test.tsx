import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { act } from "react";
import {
  createMemoryRouter,
  MemoryRouter,
  Route,
  RouterProvider,
  Routes
} from "react-router-dom";
import { afterEach, beforeEach, expect, vi } from "vitest";

import { configureApiAuth } from "../api/client";
import { AuthContext, AuthContextValue } from "../auth/AuthContext";
import { getRefreshTokenStorageKey } from "../auth/storage";
import { appRoutes } from "../app/router";
import { AppProviders } from "../app/providers/AppProviders";
import { narrowOetsDefinition } from "./definitionGuards";
import {
  getOperationalEvidenceRecord,
  transitionOperationalEvidenceRecord
} from "./evidenceSubmissionApi";
import { OetsRenderer } from "./OetsRenderer";
import { OperationalEvidenceRecordPage } from "./OperationalEvidenceRecordPage";
import { RuntimeTemplatePage } from "./RuntimeTemplatePage";
import { OetsDefinition, OetsEvidencePayload, OetsTemplateRuntimeDefinition } from "./types";

const session = {
  id: "user-1",
  email: "operator@example.test",
  fullName: "Operator One",
  status: "ACTIVE",
  clientId: "00000000-0000-4000-8000-000000000101",
  facilityIds: ["00000000-0000-4000-8000-000000000201"],
  roles: ["Operator"],
  permissions: ["view_operational_evidence"]
};

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

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: Infinity
      }
    }
  });
}

function renderRuntimeTemplatePageWithSession({
  initialPath,
  queryClient,
  currentSession
}: {
  initialPath: string;
  queryClient: QueryClient;
  currentSession: typeof session;
}) {
  function element(nextSession: typeof session) {
    return (
      <QueryClientProvider client={queryClient}>
        <AuthContext.Provider value={authContextValue(nextSession)}>
          <MemoryRouter initialEntries={[initialPath]}>
            <Routes>
              <Route
                element={<RuntimeTemplatePage />}
                path="/workbench/oets/:templateCode"
              />
            </Routes>
          </MemoryRouter>
        </AuthContext.Provider>
      </QueryClientProvider>
    );
  }

  const view = render(element(currentSession));

  return {
    ...view,
    rerenderWithSession(nextSession: typeof session) {
      view.rerender(element(nextSession));
    }
  };
}

function authContextValue(currentSession: typeof session): AuthContextValue {
  return {
    status: "authenticated",
    session: currentSession,
    errorMessage: null,
    login: async () => undefined,
    logout: () => undefined,
    clearAuthError: () => undefined,
    refreshAccessToken: async () => "access-token",
    canUsePermission: (permission) =>
      currentSession.permissions.includes(permission)
  };
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

function jsonResponse(status: number, body: unknown, statusText = "OK") {
  return new Response(JSON.stringify(body), {
    status,
    statusText,
    headers: {
      "Content-Type": "application/json"
    }
  });
}

function evidenceRecord(
  overrides: Partial<{
    facility_id: string | null;
    lifecycle_state: string;
    payload: Pick<OetsEvidencePayload, "sections">;
  }> = {}
) {
  return {
    id: "evidence-record-1",
    template_provenance: {
      template_id: "template-1",
      template_code: runtimeTemplate.template_code,
      template_version: runtimeTemplate.template_version,
      template_registry_id: runtimeTemplate.template_registry_id,
      template_version_id: runtimeTemplate.template_version_id,
      schema_version: runtimeTemplate.schema_version,
      checksum: runtimeTemplate.checksum
    },
    client_id: session.clientId,
    facility_id: session.facilityIds[0],
    lifecycle_state: "SUBMITTED",
    payload: {
      sections: {}
    },
    payload_checksum: "payload-checksum-1",
    created_by_user_id: session.id,
    submitted_by_user_id: session.id,
    created_at: "2026-07-27T00:00:00.000Z",
    submitted_at: "2026-07-27T00:00:00.000Z",
    updated_at: "2026-07-27T00:00:00.000Z",
    ...overrides
  };
}

function renderOperationalEvidenceRecordPageWithSession({
  initialPath,
  queryClient,
  currentSession
}: {
  initialPath: string;
  queryClient: QueryClient;
  currentSession: typeof session;
}) {
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider value={authContextValue(currentSession)}>
        <MemoryRouter initialEntries={[initialPath]}>
          <Routes>
            <Route
              element={<OperationalEvidenceRecordPage />}
              path="/workbench/evidence/:recordId"
            />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>
  );
}

function clientContext() {
  return {
    id: session.clientId,
    name: "Bahama Bay Resort",
    status: "ACTIVE"
  };
}

beforeEach(() => {
  window.sessionStorage.clear();
});

afterEach(() => {
  configureApiAuth(null);
  vi.unstubAllGlobals();
  window.sessionStorage.clear();
});

describe("Generic OETS renderer", () => {
  it("retrieves a runtime template by template_code through the authenticated API boundary", async () => {
    window.sessionStorage.setItem(getRefreshTokenStorageKey(), "refresh-token");
    const { calls } = mockFetchQueue([
      { status: 200, body: { accessToken: "access-token" } },
      { status: 200, body: session },
      { status: 200, body: { ...runtimeTemplate, definition_jsonb: definition } }
    ]);

    renderWithRoute("/workbench/oets/ARBITRARY_RUNTIME_TEMPLATE");

    expect(
      await screen.findByRole("heading", { name: "Generic Runtime Template" })
    ).toBeInTheDocument();
    expect(calls.map(({ url }) => url)).toEqual([
      "/api/v1/auth/refresh",
      "/api/v1/auth/me",
      "/api/v1/operational-evidence/templates/ARBITRARY_RUNTIME_TEMPLATE/current"
    ]);
  });

  it("retrieves an Operational Evidence record by ID through the authenticated API boundary", async () => {
    const { calls } = mockFetchQueue([
      { status: 200, body: evidenceRecord({ lifecycle_state: "DRAFT" }) }
    ]);

    configureApiAuth({
      getAccessToken: () => "access-token",
      refreshAccessToken: async () => "access-token",
      onAuthFailure: () => undefined
    });

    const record = await getOperationalEvidenceRecord("evidence-record-1");

    expect(record.id).toBe("evidence-record-1");
    expect(record.lifecycle_state).toBe("DRAFT");
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe(
      "/api/v1/operational-evidence/records/evidence-record-1"
    );
    expect(calls[0].init?.method).toBe("GET");
  });

  it("posts a workflow transition through the authenticated API boundary", async () => {
    const { calls } = mockFetchQueue([
      { status: 200, body: evidenceRecord({ lifecycle_state: "SUBMITTED" }) }
    ]);

    configureApiAuth({
      getAccessToken: () => "access-token",
      refreshAccessToken: async () => "access-token",
      onAuthFailure: () => undefined
    });

    const record = await transitionOperationalEvidenceRecord(
      "evidence-record-1",
      {
        transition_trigger: "submit_intake_request"
      }
    );
    const requestBody = JSON.parse(String(calls[0].init?.body));

    expect(record.lifecycle_state).toBe("SUBMITTED");
    expect(calls[0].url).toBe(
      "/api/v1/operational-evidence/records/evidence-record-1/transitions"
    );
    expect(calls[0].init?.method).toBe("POST");
    expect(requestBody).toEqual({
      transition_trigger: "submit_intake_request"
    });
    expect(requestBody.target_state).toBeUndefined();
  });

  it("loads a persisted Operational Evidence record and renders its payload read-only", async () => {
    window.sessionStorage.setItem(getRefreshTokenStorageKey(), "refresh-token");
    const persistedRecord = evidenceRecord({
      lifecycle_state: "DRAFT",
      payload: {
        sections: {
          GENERAL_EVIDENCE: {
            TEXT_FIELD: "Persisted evidence",
            NUMBER_FIELD: 7,
            SELECT_FIELD: "OPTION_A"
          },
          REPEATABLE_OBSERVATIONS: [
            {
              OBSERVATION_TIME: "10:30"
            }
          ]
        }
      }
    });
    const queryClient = createTestQueryClient();
    const { calls } = mockFetchQueue([
      { status: 200, body: persistedRecord },
      { status: 200, body: { ...runtimeTemplate, definition_jsonb: definition } }
    ]);

    renderOperationalEvidenceRecordPageWithSession({
      initialPath: "/workbench/evidence/evidence-record-1",
      queryClient,
      currentSession: session
    });

    expect(
      await screen.findByRole("heading", { name: "evidence-record-1" })
    ).toBeInTheDocument();
    expect(screen.getByText("DRAFT")).toBeInTheDocument();
    expect(screen.getByText(runtimeTemplate.template_code)).toBeInTheDocument();
    expect(screen.getAllByText(runtimeTemplate.template_version).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(runtimeTemplate.template_version_id)).toBeInTheDocument();
    expect(screen.getByText("payload-checksum-1")).toBeInTheDocument();
    expect(screen.getByLabelText("Text Field")).toHaveValue("Persisted evidence");
    expect(screen.getByLabelText("Text Field")).toBeDisabled();
    expect(screen.getByLabelText("Number Field")).toHaveValue(7);
    expect(screen.getByLabelText("Select Field")).toHaveValue("OPTION_A");
    expect(screen.getByLabelText("Observation Time")).toHaveValue("10:30");
    expect(screen.queryByRole("button", { name: "Submit evidence" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /save/i })).not.toBeInTheDocument();
    expect(calls.map(({ url }) => url)).toEqual([
      "/api/v1/operational-evidence/records/evidence-record-1",
      "/api/v1/operational-evidence/template-versions/version-1"
    ]);
  });

  it("derives available workflow actions from the governing template and transitions successfully", async () => {
    const user = userEvent.setup();
    const queryClient = createTestQueryClient();
    const draftRecord = evidenceRecord({
      lifecycle_state: "DRAFT",
      payload: {
        sections: {
          GENERAL_EVIDENCE: {
            TEXT_FIELD: "Transition candidate"
          }
        }
      }
    });
    const submittedRecord = evidenceRecord({
      lifecycle_state: "SUBMITTED",
      payload: draftRecord.payload
    });
    const { calls } = mockFetchQueue([
      { status: 200, body: draftRecord },
      {
        status: 200,
        body: { ...runtimeTemplate, definition_jsonb: workflowDefinition }
      },
      { status: 200, body: submittedRecord },
      { status: 200, body: submittedRecord }
    ]);

    renderOperationalEvidenceRecordPageWithSession({
      initialPath: "/workbench/evidence/evidence-record-1",
      queryClient,
      currentSession: session
    });

    expect(
      await screen.findByRole("button", { name: "Submit Intake Request" })
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Archive Evidence" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Text Field")).toHaveValue("Transition candidate");
    expect(screen.getByLabelText("Text Field")).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Submit Intake Request" }));

    await waitFor(() =>
      expect(screen.getByText("SUBMITTED")).toBeInTheDocument()
    );
    expect(
      screen.queryByRole("button", { name: "Submit Intake Request" })
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Submit evidence" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /save/i })).not.toBeInTheDocument();

    const transitionCall = calls.find((call) =>
      call.url.endsWith("/records/evidence-record-1/transitions")
    );
    const requestBody = JSON.parse(String(transitionCall?.init?.body));

    expect(requestBody).toEqual({
      transition_trigger: "submit_intake_request"
    });
    expect(calls.map(({ init }) => init?.method ?? "GET")).toEqual([
      "GET",
      "GET",
      "POST",
      "GET"
    ]);
    expect(calls.some((call) => call.init?.method === "PATCH")).toBe(false);
  });

  it("claims governance review before beginning a review workflow transition", async () => {
    const user = userEvent.setup();
    const queryClient = createTestQueryClient();
    const submittedRecord = evidenceRecord({ lifecycle_state: "SUBMITTED" });
    const reviewRecord = evidenceRecord({ lifecycle_state: "UNDER_OGI_REVIEW" });
    const claim = {
      id: "claim-1",
      evidence_record_id: "evidence-record-1",
      template_version_id: "version-1",
      governance_authority_code: "OGI",
      lifecycle_state: "SUBMITTED",
      transition_trigger: "begin_ogi_review",
      claim_status: "ACTIVE",
      claimed_by_user_id: session.id,
      claimed_at: "2026-07-27T00:00:00.000Z",
      released_at: null,
      completed_at: null,
      created_at: "2026-07-27T00:00:00.000Z",
      updated_at: "2026-07-27T00:00:00.000Z"
    };
    const { calls } = mockFetchQueue([
      { status: 200, body: submittedRecord },
      {
        status: 200,
        body: { ...runtimeTemplate, definition_jsonb: ogiReviewWorkflowDefinition }
      },
      { status: 201, body: claim },
      { status: 200, body: reviewRecord },
      { status: 200, body: reviewRecord }
    ]);

    renderOperationalEvidenceRecordPageWithSession({
      initialPath: "/workbench/evidence/evidence-record-1",
      queryClient,
      currentSession: session
    });

    await user.click(
      await screen.findByRole("button", { name: "Claim OGI review" })
    );
    expect(
      await screen.findByRole("button", { name: "Begin review" })
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Begin review" }));

    await waitFor(() =>
      expect(screen.getByText("UNDER_OGI_REVIEW")).toBeInTheDocument()
    );

    const claimCall = calls.find((call) =>
      call.url.endsWith("/governance/review-claims")
    );
    const transitionCall = calls.find((call) =>
      call.url.endsWith("/governance/review-claims/claim-1/transitions")
    );

    expect(JSON.parse(String(claimCall?.init?.body))).toEqual({
      evidence_record_id: "evidence-record-1",
      governance_authority_code: "OGI",
      transition_trigger: "begin_ogi_review"
    });
    expect(JSON.parse(String(transitionCall?.init?.body))).toEqual({});
    expect(calls.some((call) =>
      call.url.endsWith("/records/evidence-record-1/transitions")
    )).toBe(false);
  });

  it("uses generic workflow metadata labels for arbitrary states", async () => {
    const queryClient = createTestQueryClient();
    const { calls } = mockFetchQueue([
      { status: 200, body: evidenceRecord({ lifecycle_state: "ALPHA_STATE" }) },
      {
        status: 200,
        body: { ...runtimeTemplate, definition_jsonb: alternateWorkflowDefinition }
      }
    ]);

    renderOperationalEvidenceRecordPageWithSession({
      initialPath: "/workbench/evidence/evidence-record-1",
      queryClient,
      currentSession: session
    });

    expect(
      await screen.findByRole("button", { name: "Promote Alpha Evidence" })
    ).toBeInTheDocument();
    expect(screen.queryByText("submit_intake_request")).not.toBeInTheDocument();
    expect(calls.map(({ url }) => url)).toEqual([
      "/api/v1/operational-evidence/records/evidence-record-1",
      "/api/v1/operational-evidence/template-versions/version-1"
    ]);
  });

  it("surfaces rejected workflow transitions without mutating evidence payload", async () => {
    const user = userEvent.setup();
    const queryClient = createTestQueryClient();
    const { calls } = mockFetchQueue([
      { status: 200, body: evidenceRecord({ lifecycle_state: "DRAFT" }) },
      {
        status: 200,
        body: { ...runtimeTemplate, definition_jsonb: workflowDefinition }
      },
      {
        status: 422,
        statusText: "Unprocessable Entity",
        body: {
          error: {
            code: "OEE_ILLEGAL_WORKFLOW_TRANSITION",
            message: "Workflow transition is not declared."
          }
        }
      }
    ]);

    renderOperationalEvidenceRecordPageWithSession({
      initialPath: "/workbench/evidence/evidence-record-1",
      queryClient,
      currentSession: session
    });

    await user.click(
      await screen.findByRole("button", { name: "Submit Intake Request" })
    );

    expect(
      await screen.findByRole("alert")
    ).toHaveTextContent(
      "The workflow action was rejected by the backend. Reload the record and try again."
    );
    expect(screen.getByText("DRAFT")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Submit Intake Request" })).toBeInTheDocument();
    expect(calls.some((call) => call.init?.method === "PATCH")).toBe(false);
  });

  it("surfaces forbidden record retrieval without leaking record details", async () => {
    const queryClient = createTestQueryClient();
    mockFetchQueue([
      {
        status: 403,
        statusText: "Forbidden",
        body: {
          error: {
            code: "OEE_AUTHORIZATION_DENIED",
            message: "Forbidden"
          }
        }
      }
    ]);

    renderOperationalEvidenceRecordPageWithSession({
      initialPath: "/workbench/evidence/restricted-record",
      queryClient,
      currentSession: session
    });

    expect(
      await screen.findByRole("heading", {
        name: "Evidence record is not available."
      })
    ).toBeInTheDocument();
    expect(screen.queryByText("restricted-record")).not.toBeInTheDocument();
  });

  it("renders ordered sections and every Phase 2 supported field type generically", () => {
    render(
      <OetsRenderer definition={definition} runtimeTemplate={runtimeTemplate} />
    );

    const headings = screen.getAllByRole("heading", { level: 2 });

    expect(headings.map((heading) => heading.textContent)).toEqual([
      "General Evidence",
      "Repeatable Observations",
      "Local Evidence Payload"
    ]);
    expect(screen.getByLabelText("Text Field")).toHaveAttribute("type", "text");
    expect(screen.getByLabelText("Textarea Field").tagName).toBe("TEXTAREA");
    expect(screen.getByLabelText("Number Field")).toHaveAttribute(
      "type",
      "number"
    );
    expect(screen.getByLabelText("Decimal Field")).toHaveAttribute(
      "type",
      "number"
    );
    expect(screen.getByLabelText("Boolean Field")).toHaveAttribute(
      "type",
      "checkbox"
    );
    expect(screen.getByLabelText("Checkbox Field")).toHaveAttribute(
      "type",
      "checkbox"
    );
    expect(screen.getByLabelText("Date Field")).toHaveAttribute("type", "date");
    expect(screen.getByLabelText("Email Field")).toHaveAttribute("type", "email");
    expect(screen.getByLabelText("Phone Field")).toHaveAttribute("type", "tel");
    expect(screen.getByLabelText("Time Field")).toHaveAttribute("type", "time");
    expect(screen.getByLabelText("Url Field")).toHaveAttribute("type", "url");
    expect(
      screen.getByText(/Signature capture is not available in Phase 2/)
    ).toBeInTheDocument();
  });

  it("serializes typed NUMBER and DECIMAL controls as JSON numbers in the local payload", async () => {
    const user = userEvent.setup();

    render(
      <OetsRenderer definition={definition} runtimeTemplate={runtimeTemplate} />
    );

    await user.type(screen.getByLabelText("Number Field"), "5");
    await user.type(screen.getByLabelText("Decimal Field"), "12.5");

    expect(screen.getByText(/"NUMBER_FIELD": 5/)).toBeInTheDocument();
    expect(screen.queryByText(/"NUMBER_FIELD": "5"/)).not.toBeInTheDocument();
    expect(screen.getByText(/"DECIMAL_FIELD": 12.5/)).toBeInTheDocument();
    expect(screen.queryByText(/"DECIMAL_FIELD": "12.5"/)).not.toBeInTheDocument();
  });

  it("preserves zero as evidence and keeps untouched or cleared numeric fields empty", async () => {
    const user = userEvent.setup();

    render(
      <OetsRenderer definition={definition} runtimeTemplate={runtimeTemplate} />
    );

    expect(screen.getByText(/"NUMBER_FIELD": null/)).toBeInTheDocument();
    expect(screen.getByText(/"DECIMAL_FIELD": null/)).toBeInTheDocument();

    await user.type(screen.getByLabelText("Number Field"), "0");

    expect(screen.getByText(/"NUMBER_FIELD": 0/)).toBeInTheDocument();
    expect(screen.queryByText(/"NUMBER_FIELD": "0"/)).not.toBeInTheDocument();

    await user.clear(screen.getByLabelText("Number Field"));

    expect(screen.getByText(/"NUMBER_FIELD": null/)).toBeInTheDocument();
  });

  it("handles select, radio, and multiselect options from field metadata", async () => {
    const user = userEvent.setup();

    render(
      <OetsRenderer definition={definition} runtimeTemplate={runtimeTemplate} />
    );

    await user.selectOptions(screen.getByLabelText("Select Field"), "OPTION_B");
    await user.click(screen.getByLabelText("Radio Beta"));
    await user.selectOptions(screen.getByLabelText("Multiselect Field"), [
      "OPTION_A",
      "OPTION_B"
    ]);

    expect(screen.getByText(/"SELECT_FIELD": "OPTION_B"/)).toBeInTheDocument();
    expect(screen.getByText(/"RADIO_FIELD": "OPTION_B"/)).toBeInTheDocument();
    expect(screen.getByText(/"MULTISELECT_FIELD": \[/)).toBeInTheDocument();
  });

  it("supports repeatable sections and assembles deterministic local payload arrays", async () => {
    const user = userEvent.setup();

    render(
      <OetsRenderer definition={definition} runtimeTemplate={runtimeTemplate} />
    );

    await user.type(screen.getByLabelText("Observation Time"), "09:30");
    await user.click(screen.getByRole("button", { name: "Add entry" }));
    await user.type(screen.getAllByLabelText("Observation Time")[1], "10:15");

    expect(screen.getByRole("heading", { name: "Entry 2" })).toBeInTheDocument();
    expect(screen.getByText(/"REPEATABLE_OBSERVATIONS": \[/)).toBeInTheDocument();
    expect(screen.getByText(/"OBSERVATION_TIME": "09:30"/)).toBeInTheDocument();
    expect(screen.getByText(/"OBSERVATION_TIME": "10:15"/)).toBeInTheDocument();
  });

  it("does not reuse repeatable instance identity after removing a non-last entry", async () => {
    const user = userEvent.setup();

    render(
      <OetsRenderer definition={definition} runtimeTemplate={runtimeTemplate} />
    );

    await user.type(screen.getByLabelText("Observation Time"), "09:00");
    await user.click(screen.getByRole("button", { name: "Add entry" }));
    await user.type(screen.getAllByLabelText("Observation Time")[1], "10:00");
    await user.click(screen.getAllByRole("button", { name: "Remove" })[0]);
    await user.click(screen.getByRole("button", { name: "Add entry" }));
    await user.clear(screen.getAllByLabelText("Observation Time")[1]);
    await user.type(screen.getAllByLabelText("Observation Time")[1], "11:00");

    expect(screen.getByText(/"OBSERVATION_TIME": "10:00"/)).toBeInTheDocument();
    expect(screen.getByText(/"OBSERVATION_TIME": "11:00"/)).toBeInTheDocument();
    expect(screen.queryByText(/"OBSERVATION_TIME": "09:00"/)).not.toBeInTheDocument();
  });

  it("prevents mutation in read-only mode while preserving the same structure", async () => {
    const user = userEvent.setup();

    render(
      <OetsRenderer
        definition={definition}
        readOnly
        runtimeTemplate={runtimeTemplate}
      />
    );

    expect(screen.getByText("Read only")).toBeInTheDocument();
    expect(screen.getByLabelText("Text Field")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Add entry" })).toBeDisabled();
    await user.type(screen.getByLabelText("Text Field"), "Blocked");
    expect(screen.queryByText(/"TEXT_FIELD": "Blocked"/)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Submit evidence" })
    ).not.toBeInTheDocument();
  });

  it("submits the rendered template provenance, client context, facility context, and sections only", async () => {
    window.sessionStorage.setItem(getRefreshTokenStorageKey(), "refresh-token");
    const { calls } = mockFetchQueue([
      { status: 200, body: { accessToken: "access-token" } },
      { status: 200, body: session },
      { status: 200, body: { ...runtimeTemplate, definition_jsonb: definition } },
      { status: 201, body: evidenceRecord() }
    ]);
    const user = userEvent.setup();

    renderWithRoute("/workbench/oets/ARBITRARY_RUNTIME_TEMPLATE");

    await user.type(await screen.findByLabelText("Text Field"), "Submitted");
    await user.type(screen.getByLabelText("Number Field"), "5");
    await user.type(screen.getByLabelText("Decimal Field"), "12.5");
    await user.click(screen.getByRole("button", { name: "Submit evidence" }));

    expect(
      await screen.findByText(/Evidence record created. Record evidence-record-1 is SUBMITTED./)
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open record" })).toHaveAttribute(
      "href",
      "/workbench/evidence/evidence-record-1"
    );

    const requestBody = JSON.parse(String(calls[3].init?.body));

    expect(calls[3].url).toBe("/api/v1/operational-evidence/records");
    expect(calls[3].init?.method).toBe("POST");
    expect(requestBody).toMatchObject({
      template_code: runtimeTemplate.template_code,
      template_version_id: runtimeTemplate.template_version_id,
      checksum: runtimeTemplate.checksum,
      client_id: session.clientId,
      facility_id: session.facilityIds[0],
      payload: {
        sections: {
          GENERAL_EVIDENCE: {
            TEXT_FIELD: "Submitted"
          }
        }
      }
    });
    expect(requestBody.payload.template_version).toBeUndefined();
    expect(requestBody.payload.schema_version).toBeUndefined();
    expect(requestBody.payload.template_version_id).toBeUndefined();
    expect(requestBody.payload.checksum).toBeUndefined();
  });

  it("pins the rendered template provenance and definition for the editing session when query data changes", async () => {
    const queryClient = createTestQueryClient();
    const { calls } = mockFetchQueue([
      { status: 201, body: evidenceRecord() }
    ]);
    const user = userEvent.setup();

    queryClient.setQueryData(
      ["oets-runtime-template", runtimeTemplate.template_code],
      { ...runtimeTemplate, definition_jsonb: definition }
    );

    renderRuntimeTemplatePageWithSession({
      initialPath: "/workbench/oets/ARBITRARY_RUNTIME_TEMPLATE",
      queryClient,
      currentSession: session
    });

    await user.type(await screen.findByLabelText("Text Field"), "Version N");

    await act(async () => {
      queryClient.setQueryData(
        ["oets-runtime-template", runtimeTemplate.template_code],
        { ...versionTwoRuntimeTemplate, definition_jsonb: versionTwoDefinition }
      );
    });

    expect(
      screen.getByRole("heading", { name: "Generic Runtime Template" })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Newer Runtime Template" })
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Submit evidence" }));

    const requestBody = JSON.parse(String(calls[0].init?.body));

    expect(requestBody.template_version_id).toBe(runtimeTemplate.template_version_id);
    expect(requestBody.checksum).toBe(runtimeTemplate.checksum);
    expect(requestBody.payload.sections).toMatchObject({
      GENERAL_EVIDENCE: {
        TEXT_FIELD: "Version N"
      },
      REPEATABLE_OBSERVATIONS: [
        {
          OBSERVATION_TIME: null
        }
      ]
    });
    expect(requestBody.payload.sections.NEW_SECTION).toBeUndefined();
  });

  it("omits facility_id when the session has no facility context", async () => {
    window.sessionStorage.setItem(getRefreshTokenStorageKey(), "refresh-token");
    const { calls } = mockFetchQueue([
      { status: 200, body: { accessToken: "access-token" } },
      { status: 200, body: { ...session, facilityIds: [] } },
      { status: 200, body: { ...runtimeTemplate, definition_jsonb: definition } },
      { status: 201, body: evidenceRecord({ facility_id: null }) }
    ]);
    const user = userEvent.setup();

    renderWithRoute("/workbench/oets/ARBITRARY_RUNTIME_TEMPLATE");

    await user.click(await screen.findByRole("button", { name: "Submit evidence" }));

    const requestBody = JSON.parse(String(calls[3].init?.body));

    expect(requestBody.facility_id).toBeUndefined();
  });

  it("uses an explicitly selected facility when multiple session facilities exist", async () => {
    window.sessionStorage.setItem(getRefreshTokenStorageKey(), "refresh-token");
    const multiFacilitySession = {
      ...session,
      facilityIds: [
        "00000000-0000-4000-8000-000000000201",
        "00000000-0000-4000-8000-000000000202"
      ]
    };
    const { calls } = mockFetchQueue([
      { status: 200, body: { accessToken: "access-token" } },
      { status: 200, body: multiFacilitySession },
      { status: 200, body: { ...runtimeTemplate, definition_jsonb: definition } },
      { status: 201, body: evidenceRecord({ facility_id: multiFacilitySession.facilityIds[1] }) }
    ]);
    const user = userEvent.setup();

    renderWithRoute("/workbench/oets/ARBITRARY_RUNTIME_TEMPLATE");

    await user.selectOptions(
      await screen.findByLabelText("Facility context"),
      multiFacilitySession.facilityIds[1]
    );
    await user.click(screen.getByRole("button", { name: "Submit evidence" }));

    const requestBody = JSON.parse(String(calls[3].init?.body));

    expect(requestBody.facility_id).toBe(multiFacilitySession.facilityIds[1]);
  });

  it("blocks submission safely when authenticated session has no client context", async () => {
    window.sessionStorage.setItem(getRefreshTokenStorageKey(), "refresh-token");
    const { calls } = mockFetchQueue([
      { status: 200, body: { accessToken: "access-token" } },
      { status: 200, body: { ...session, clientId: null } },
      { status: 200, body: { ...runtimeTemplate, definition_jsonb: definition } },
      { status: 200, body: { clients: [clientContext()] } }
    ]);

    renderWithRoute("/workbench/oets/ARBITRARY_RUNTIME_TEMPLATE");

    expect(
      await screen.findAllByText("You must first select a Client before submitting Operational Evidence.")
    ).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Submit evidence" })).toBeDisabled();
    expect(calls).toHaveLength(4);
  });

  it("submits OGI bootstrap evidence using explicitly selected client context", async () => {
    window.sessionStorage.setItem(getRefreshTokenStorageKey(), "refresh-token");
    const { calls } = mockFetchQueue([
      { status: 200, body: { accessToken: "access-token" } },
      { status: 200, body: { ...session, clientId: null, facilityIds: [] } },
      { status: 200, body: { ...runtimeTemplate, definition_jsonb: definition } },
      { status: 200, body: { clients: [clientContext()] } },
      { status: 200, body: { facilities: [] } },
      { status: 201, body: evidenceRecord({ facility_id: null }) }
    ]);
    const user = userEvent.setup();

    renderWithRoute("/workbench/oets/ARBITRARY_RUNTIME_TEMPLATE");

    await user.selectOptions(
      await screen.findByLabelText("Client context"),
      session.clientId
    );
    await user.type(await screen.findByLabelText("Text Field"), "Submitted");
    await user.type(screen.getByLabelText("Number Field"), "5");
    await user.type(screen.getByLabelText("Decimal Field"), "12.5");
    await user.click(screen.getByRole("button", { name: "Submit evidence" }));

    expect(
      await screen.findByText(/Evidence record created. Record evidence-record-1 is SUBMITTED./)
    ).toBeInTheDocument();

    const requestBody = JSON.parse(String(calls[5].init?.body));

    expect(calls[5].url).toBe("/api/v1/operational-evidence/records");
    expect(requestBody).toMatchObject({
      client_id: session.clientId,
      payload: {
        sections: {
          GENERAL_EVIDENCE: {
            TEXT_FIELD: "Submitted",
            NUMBER_FIELD: 5,
            DECIMAL_FIELD: 12.5
          }
        }
      }
    });
    expect(requestBody.payload.sections.GENERAL_EVIDENCE.TEXT_FIELD).toBe("Submitted");
    expect(typeof requestBody.payload.sections.GENERAL_EVIDENCE.TEXT_FIELD).toBe("string");
    expect(typeof requestBody.payload.sections.GENERAL_EVIDENCE.NUMBER_FIELD).toBe("number");
    expect(typeof requestBody.payload.sections.GENERAL_EVIDENCE.DECIMAL_FIELD).toBe("number");
    expect(requestBody.facility_id).toBeUndefined();
  });

  it("disables the submit button while pending and prevents duplicate concurrent requests", async () => {
    window.sessionStorage.setItem(getRefreshTokenStorageKey(), "refresh-token");
    let resolveSubmit: (response: Response) => void = () => undefined;
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const user = userEvent.setup();

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        calls.push({ url: readRequestPath(input), init });

        if (calls.length === 1) {
          return jsonResponse(200, { accessToken: "access-token" });
        }

        if (calls.length === 2) {
          return jsonResponse(200, session);
        }

        if (calls.length === 3) {
          return jsonResponse(200, { ...runtimeTemplate, definition_jsonb: definition });
        }

        return new Promise<Response>((resolve) => {
          resolveSubmit = resolve;
        });
      })
    );

    renderWithRoute("/workbench/oets/ARBITRARY_RUNTIME_TEMPLATE");

    const button = await screen.findByRole("button", { name: "Submit evidence" });

    await user.dblClick(button);

    expect(screen.getByRole("button", { name: "Submitting..." })).toBeDisabled();
    expect(calls.filter((call) => call.url.endsWith("/records"))).toHaveLength(1);

    resolveSubmit(jsonResponse(201, evidenceRecord()));

    expect(await screen.findByText(/Evidence record created/)).toBeInTheDocument();
  });

  it("uses a synchronous lock so immediate submit activations create only one request", async () => {
    window.sessionStorage.setItem(getRefreshTokenStorageKey(), "refresh-token");
    let resolveSubmit: (response: Response) => void = () => undefined;
    const calls: Array<{ url: string; init?: RequestInit }> = [];

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        calls.push({ url: readRequestPath(input), init });

        if (calls.length === 1) {
          return jsonResponse(200, { accessToken: "access-token" });
        }

        if (calls.length === 2) {
          return jsonResponse(200, session);
        }

        if (calls.length === 3) {
          return jsonResponse(200, { ...runtimeTemplate, definition_jsonb: definition });
        }

        return new Promise<Response>((resolve) => {
          resolveSubmit = resolve;
        });
      })
    );

    renderWithRoute("/workbench/oets/ARBITRARY_RUNTIME_TEMPLATE");

    const button = await screen.findByRole("button", { name: "Submit evidence" });

    act(() => {
      button.click();
      button.click();
    });

    await waitFor(() =>
      expect(calls.filter((call) => call.url.endsWith("/records"))).toHaveLength(1)
    );

    resolveSubmit(jsonResponse(201, evidenceRecord()));

    expect(await screen.findByText(/Evidence record created/)).toBeInTheDocument();
  });

  it("does not allow the same successful evidence capture to be submitted again", async () => {
    window.sessionStorage.setItem(getRefreshTokenStorageKey(), "refresh-token");
    const { calls } = mockFetchQueue([
      { status: 200, body: { accessToken: "access-token" } },
      { status: 200, body: session },
      { status: 200, body: { ...runtimeTemplate, definition_jsonb: definition } },
      { status: 201, body: evidenceRecord() }
    ]);
    const user = userEvent.setup();

    renderWithRoute("/workbench/oets/ARBITRARY_RUNTIME_TEMPLATE");

    await user.click(await screen.findByRole("button", { name: "Submit evidence" }));

    expect(await screen.findByText(/Evidence record created/)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Submit evidence" })
    ).not.toBeInTheDocument();

    expect(calls.filter((call) => call.url.endsWith("/records"))).toHaveLength(1);
  });

  it("presents template integrity conflicts as form-level stale-template messages", async () => {
    window.sessionStorage.setItem(getRefreshTokenStorageKey(), "refresh-token");
    mockFetchQueue([
      { status: 200, body: { accessToken: "access-token" } },
      { status: 200, body: session },
      { status: 200, body: { ...runtimeTemplate, definition_jsonb: definition } },
      {
        status: 409,
        body: {
          error: {
            code: "OEE_TEMPLATE_VERSION_CONFLICT",
            message: "The Operational Evidence Template version changed."
          }
        }
      }
    ]);
    const user = userEvent.setup();

    renderWithRoute("/workbench/oets/ARBITRARY_RUNTIME_TEMPLATE");

    await user.click(await screen.findByRole("button", { name: "Submit evidence" }));

    expect(
      await screen.findByText(
        "This operational template changed while you were completing it. Reload the current template before submitting."
      )
    ).toBeInTheDocument();
    expect(screen.queryByText("Backend field issue")).not.toBeInTheDocument();
  });

  it("maps backend 422 validation details to form, section, field, and repeatable messages", async () => {
    window.sessionStorage.setItem(getRefreshTokenStorageKey(), "refresh-token");
    mockFetchQueue([
      { status: 200, body: { accessToken: "access-token" } },
      { status: 200, body: session },
      { status: 200, body: { ...runtimeTemplate, definition_jsonb: definition } },
      {
        status: 422,
        body: {
          error: {
            code: "OEE_EVIDENCE_VALIDATION_FAILED",
            message: "Evidence validation failed.",
            details: [
              {
                field: null,
                instance_path: "/payload",
                rule: "PAYLOAD_INVALID",
                message: "Form issue"
              },
              {
                field: null,
                instance_path: "/payload/sections/GENERAL_EVIDENCE",
                rule: "SECTION_INVALID",
                message: "Section issue"
              },
              {
                field: "TEXT_FIELD",
                instance_path: "/payload/sections/GENERAL_EVIDENCE/TEXT_FIELD",
                rule: "FIELD_REQUIRED",
                message: "Backend field issue"
              },
              {
                field: "OBSERVATION_TIME",
                instance_path:
                  "/payload/sections/REPEATABLE_OBSERVATIONS/0/OBSERVATION_TIME",
                rule: "FIELD_REQUIRED",
                message: "Repeatable field issue"
              },
              {
                field: null,
                instance_path: "/unexpected",
                rule: "UNKNOWN",
                message: "Unrecognized path issue"
              }
            ]
          }
        }
      }
    ]);
    const user = userEvent.setup();

    renderWithRoute("/workbench/oets/ARBITRARY_RUNTIME_TEMPLATE");

    await user.click(await screen.findByRole("button", { name: "Submit evidence" }));

    expect(
      await screen.findByText(
        "The backend rejected this evidence. Review the highlighted validation messages."
      )
    ).toBeInTheDocument();
    expect(screen.getByText("Form issue")).toBeInTheDocument();
    expect(screen.getByText("Section issue")).toBeInTheDocument();
    expect(screen.getByText("Backend field issue")).toBeInTheDocument();
    expect(screen.getByText("Repeatable field issue")).toBeInTheDocument();
    expect(screen.getByText("Unrecognized path issue")).toBeInTheDocument();
  });

  it("keeps contradictory backend validation details visible without attaching them to the wrong field", async () => {
    window.sessionStorage.setItem(getRefreshTokenStorageKey(), "refresh-token");
    mockFetchQueue([
      { status: 200, body: { accessToken: "access-token" } },
      { status: 200, body: session },
      { status: 200, body: { ...runtimeTemplate, definition_jsonb: definition } },
      {
        status: 422,
        body: {
          error: {
            code: "OEE_EVIDENCE_VALIDATION_FAILED",
            message: "Evidence validation failed.",
            details: [
              {
                field: "OBSERVATION_TIME",
                instance_path: "/payload/sections/GENERAL_EVIDENCE/TEXT_FIELD",
                rule: "CONFLICTING_FIELD",
                message: "Conflicting field issue"
              },
              {
                field: "TEXT_FIELD",
                instance_path: "/payload/sections/GENERAL_EVIDENCE",
                rule: "SECTION_WITH_FIELD",
                message: "Section-only path issue"
              },
              {
                field: "TEXT_FIELD",
                instance_path: "/payload/sections/GENERAL_EVIDENCE/TEXT_FIELD",
                rule: "CONFLICTING_SECTION",
                message: "Conflicting section issue",
                params: {
                  section_code: "REPEATABLE_OBSERVATIONS"
                }
              }
            ]
          }
        }
      }
    ]);
    const user = userEvent.setup();

    renderWithRoute("/workbench/oets/ARBITRARY_RUNTIME_TEMPLATE");

    await user.click(await screen.findByRole("button", { name: "Submit evidence" }));

    expect(await screen.findByText("Conflicting field issue")).toBeInTheDocument();
    expect(screen.getByText("Section-only path issue")).toBeInTheDocument();
    expect(screen.getByText("Conflicting section issue")).toBeInTheDocument();

    const textField = screen.getByLabelText("Text Field");
    expect(textField.parentElement).not.toHaveTextContent("Conflicting field issue");
    expect(textField.parentElement).not.toHaveTextContent("Section-only path issue");
    expect(textField.parentElement).not.toHaveTextContent("Conflicting section issue");
  });

  it("clears a selected facility when the authenticated facility context changes", async () => {
    const queryClient = createTestQueryClient();
    const multiFacilitySession = {
      ...session,
      facilityIds: [
        "00000000-0000-4000-8000-000000000201",
        "00000000-0000-4000-8000-000000000202"
      ]
    };
    const changedFacilitySession = {
      ...session,
      facilityIds: ["00000000-0000-4000-8000-000000000203"]
    };
    const { calls } = mockFetchQueue([
      { status: 201, body: evidenceRecord({ facility_id: changedFacilitySession.facilityIds[0] }) }
    ]);
    const user = userEvent.setup();

    queryClient.setQueryData(
      ["oets-runtime-template", runtimeTemplate.template_code],
      { ...runtimeTemplate, definition_jsonb: definition }
    );

    const view = renderRuntimeTemplatePageWithSession({
      initialPath: "/workbench/oets/ARBITRARY_RUNTIME_TEMPLATE",
      queryClient,
      currentSession: multiFacilitySession
    });

    await user.selectOptions(
      await screen.findByLabelText("Facility context"),
      multiFacilitySession.facilityIds[1]
    );

    view.rerenderWithSession(changedFacilitySession);

    await waitFor(() =>
      expect(screen.queryByLabelText("Facility context")).not.toBeInTheDocument()
    );

    await user.click(screen.getByRole("button", { name: "Submit evidence" }));

    const requestBody = JSON.parse(String(calls[0].init?.body));

    expect(requestBody.facility_id).toBe(changedFacilitySession.facilityIds[0]);
  });

  it("presents authorization and general API failures as safe form-level errors", async () => {
    window.sessionStorage.setItem(getRefreshTokenStorageKey(), "refresh-token");
    mockFetchQueue([
      { status: 200, body: { accessToken: "access-token" } },
      { status: 200, body: session },
      { status: 200, body: { ...runtimeTemplate, definition_jsonb: definition } },
      {
        status: 403,
        body: {
          error: {
            code: "OEE_AUTHORIZATION_DENIED",
            message: "Forbidden."
          }
        }
      },
      {
        status: 500,
        body: {
          error: {
            code: "OEE_INTERNAL_ERROR",
            message: "Server failed."
          }
        }
      }
    ]);
    const user = userEvent.setup();

    renderWithRoute("/workbench/oets/ARBITRARY_RUNTIME_TEMPLATE");

    await user.click(await screen.findByRole("button", { name: "Submit evidence" }));
    expect(
      await screen.findByText("You are not authorized to submit this operational evidence.")
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Submit evidence" }));
    expect(await screen.findByText("Server failed.")).toBeInTheDocument();
  });

  it("fails visibly for malformed definitions and unsupported metadata", () => {
    const malformed = narrowOetsDefinition({
      schema_version: "1.0",
      template_metadata: {
        template_id: "template",
        template_code: "BROKEN",
        template_name: "Broken",
        module: "Module",
        version: "1.0"
      },
      sections: []
    });
    const unsupported = narrowOetsDefinition({
      ...definition,
      sections: [
        {
          ...definition.sections[0],
          fields: [
            {
              ...definition.sections[0].fields[0],
              field_type: "TABLE"
            }
          ]
        }
      ]
    });

    expect(malformed.errors).toContain("sections must be a non-empty array.");
    expect(unsupported.warnings).toContain(
      "sections[0].fields[0] uses unsupported field_type TABLE."
    );

    if (unsupported.definition) {
      render(
        <OetsRenderer
          definition={unsupported.definition}
          runtimeTemplate={runtimeTemplate}
        />
      );
    }

    expect(screen.getByText(/Unsupported field type/)).toBeInTheDocument();
  });

  it("does not warn ordinary users solely for root workflow, automation, or relationship metadata", async () => {
    window.sessionStorage.setItem(getRefreshTokenStorageKey(), "refresh-token");
    mockFetchQueue([
      { status: 200, body: { accessToken: "access-token" } },
      { status: 200, body: session },
      {
        status: 200,
        body: {
          ...runtimeTemplate,
          definition_jsonb: {
            ...definition,
            workflow: { initial_state: "SUBMITTED" },
            automation: [{ action_type: "QUEUE_JOB" }],
            relationships: [{ relationship_type: "RELATED_EVIDENCE" }]
          }
        }
      }
    ]);

    renderWithRoute("/workbench/oets/ARBITRARY_RUNTIME_TEMPLATE");

    expect(
      await screen.findByRole("heading", { name: "Generic Runtime Template" })
    ).toBeInTheDocument();
    expect(screen.queryByText("Unsupported renderer metadata")).not.toBeInTheDocument();
  });

  it("shows loading and retrieval error states without flashing protected renderer content", async () => {
    window.sessionStorage.setItem(getRefreshTokenStorageKey(), "refresh-token");
    mockFetchQueue([
      { status: 200, body: { accessToken: "access-token" } },
      { status: 200, body: session },
      {
        status: 404,
        body: {
          error: {
            code: "OETS_TEMPLATE_NOT_FOUND",
            message: "Template not found."
          }
        }
      },
      {
        status: 404,
        body: {
          error: {
            code: "OETS_TEMPLATE_NOT_FOUND",
            message: "Template not found."
          }
        }
      }
    ]);

    renderWithRoute("/workbench/oets/MISSING_TEMPLATE");

    expect(
      await screen.findByRole("heading", { name: "Loading runtime template." })
    ).toBeInTheDocument();
    expect(
      await screen.findByRole(
        "heading",
        { name: "Template could not be loaded." },
        { timeout: 3_000 }
      )
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Generic Runtime Template" })
    ).not.toBeInTheDocument();
  });
});

const runtimeTemplate: OetsTemplateRuntimeDefinition = {
  template_registry_id: "registry-1",
  template_version_id: "version-1",
  template_code: "ARBITRARY_RUNTIME_TEMPLATE",
  template_archetype: "CHECKLIST_INSPECTION",
  template_version: "1.0",
  schema_version: "1.0",
  checksum: "checksum-1",
  status: "ACTIVE",
  definition_jsonb: undefined
};

const versionTwoRuntimeTemplate: OetsTemplateRuntimeDefinition = {
  ...runtimeTemplate,
  template_version_id: "version-2",
  template_version: "2.0",
  checksum: "checksum-2"
};

const definition: OetsDefinition = {
  schema_version: "1.0",
  template_metadata: {
    template_id: "template-1",
    template_code: "ARBITRARY_RUNTIME_TEMPLATE",
    template_name: "Generic Runtime Template",
    module: "GENERIC_MODULE",
    version: "1.0"
  },
  sections: [
    {
      section_id: "section-2",
      section_code: "REPEATABLE_OBSERVATIONS",
      title: "Repeatable Observations",
      sequence: 2,
      repeatable: true,
      visible: true,
      fields: [
        {
          field_id: "field-repeat-1",
          field_code: "OBSERVATION_TIME",
          label: "Observation Time",
          field_type: "TIME",
          required: false,
          readonly: false,
          visible: true,
          sequence: 1
        }
      ]
    },
    {
      section_id: "section-1",
      section_code: "GENERAL_EVIDENCE",
      title: "General Evidence",
      sequence: 1,
      repeatable: false,
      visible: true,
      fields: [
        textField("TEXT_FIELD", "Text Field", "TEXT", 1),
        textField("TEXTAREA_FIELD", "Textarea Field", "TEXTAREA", 2),
        textField("NUMBER_FIELD", "Number Field", "NUMBER", 3),
        textField("DECIMAL_FIELD", "Decimal Field", "DECIMAL", 4),
        booleanField("BOOLEAN_FIELD", "Boolean Field", "BOOLEAN", 5),
        booleanField("CHECKBOX_FIELD", "Checkbox Field", "CHECKBOX", 6),
        optionField("RADIO_FIELD", "Radio Field", "RADIO", 7),
        optionField("SELECT_FIELD", "Select Field", "SELECT", 8),
        optionField("MULTISELECT_FIELD", "Multiselect Field", "MULTISELECT", 9),
        textField("DATE_FIELD", "Date Field", "DATE", 10),
        textField("EMAIL_FIELD", "Email Field", "EMAIL", 11),
        textField("PHONE_FIELD", "Phone Field", "PHONE", 12),
        textField("SIGNATURE_FIELD", "Signature Field", "SIGNATURE", 13),
        textField("TIME_FIELD", "Time Field", "TIME", 14),
        textField("URL_FIELD", "Url Field", "URL", 15)
      ]
    }
  ]
};

const workflowDefinition: OetsDefinition = {
  ...definition,
  workflow: {
    initial_state: "DRAFT",
    states: [
      {
        state_code: "DRAFT",
        name: "Draft"
      },
      {
        state_code: "SUBMITTED",
        name: "Submitted"
      },
      {
        state_code: "ARCHIVED",
        name: "Archived"
      }
    ],
    transitions: [
      {
        from: "DRAFT",
        to: "SUBMITTED",
        trigger: "submit_intake_request",
        label: "Submit Intake Request"
      },
      {
        from: "SUBMITTED",
        to: "ARCHIVED",
        trigger: "archive_evidence",
        label: "Archive Evidence"
      }
    ]
  }
};

const ogiReviewWorkflowDefinition: OetsDefinition = {
  ...definition,
  workflow: {
    initial_state: "SUBMITTED",
    states: [
      {
        state_code: "SUBMITTED",
        name: "Submitted"
      },
      {
        state_code: "UNDER_OGI_REVIEW",
        name: "Under OGI Review"
      }
    ],
    transitions: [
      {
        from: "SUBMITTED",
        to: "UNDER_OGI_REVIEW",
        trigger: "begin_ogi_review"
      }
    ]
  }
};

const alternateWorkflowDefinition: OetsDefinition = {
  ...definition,
  workflow: {
    initial_state: "ALPHA_STATE",
    states: [
      {
        state_code: "ALPHA_STATE",
        name: "Alpha State"
      },
      {
        state_code: "BETA_STATE",
        name: "Beta State"
      }
    ],
    transitions: [
      {
        from: "ALPHA_STATE",
        to: "BETA_STATE",
        trigger: "promote_alpha",
        label: "Promote Alpha Evidence"
      }
    ]
  }
};

const versionTwoDefinition: OetsDefinition = {
  ...definition,
  template_metadata: {
    ...definition.template_metadata,
    template_name: "Newer Runtime Template",
    version: "2.0"
  },
  sections: [
    {
      section_id: "section-new",
      section_code: "NEW_SECTION",
      title: "New Section",
      sequence: 1,
      repeatable: false,
      visible: true,
      fields: [
        {
          field_id: "field-new",
          field_code: "NEW_FIELD",
          label: "New Field",
          field_type: "TEXT",
          required: false,
          readonly: false,
          visible: true,
          sequence: 1
        }
      ]
    }
  ]
};

function textField(
  fieldCode: string,
  label: string,
  fieldType: string,
  sequence: number
) {
  return {
    field_id: `field-${sequence}`,
    field_code: fieldCode,
    label,
    field_type: fieldType,
    required: false,
    readonly: false,
    visible: true,
    sequence
  };
}

function booleanField(
  fieldCode: string,
  label: string,
  fieldType: string,
  sequence: number
) {
  return textField(fieldCode, label, fieldType, sequence);
}

function optionField(
  fieldCode: string,
  label: string,
  fieldType: string,
  sequence: number
) {
  return {
    ...textField(fieldCode, label, fieldType, sequence),
    options: [
      {
        label: "Radio Beta",
        value: "OPTION_B",
        sequence: 2
      },
      {
        label: "Option Alpha",
        value: "OPTION_A",
        sequence: 1
      }
    ]
  };
}
