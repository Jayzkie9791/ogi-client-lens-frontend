import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { afterEach, beforeEach, expect, vi } from "vitest";

import { configureApiAuth } from "../api/client";
import { getRefreshTokenStorageKey } from "../auth/storage";
import { appRoutes } from "../app/router";
import { AppProviders } from "../app/providers/AppProviders";
import { narrowOetsDefinition } from "./definitionGuards";
import { OetsRenderer } from "./OetsRenderer";
import { OetsDefinition, OetsTemplateRuntimeDefinition } from "./types";

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

function mockFetchQueue(responses: MockResponse[]) {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const next = responses.shift();

    calls.push({
      url: String(input),
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
