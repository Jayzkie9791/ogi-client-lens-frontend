import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { isAuthorityReadOnly, OetsRenderer } from "./OetsRenderer";
import type {
  OetsDefinition,
  OetsFieldAuthorityPresentation,
  OetsFieldAuthorityPresentationField,
  OetsTemplateRuntimeDefinition
} from "./types";

const definition: OetsDefinition = {
  schema_version: "1.0",
  template_metadata: {
    template_id: "d3-template",
    template_code: "OGI_D3_PRESENTATION_TEST",
    template_name: "D3 Presentation Test",
    module: "TEST",
    version: "1.0"
  },
  sections: [{
    section_id: "credential",
    section_code: "CREDENTIAL",
    title: "Credential",
    sequence: 1,
    fields: [
      field("manual", "MANUAL_VALUE", "Manual Value", 1),
      field("calculated", "CALCULATED_VALUE", "Calculated Value", 2),
      field("downstream", "DOWNSTREAM_VALUE", "Downstream Value", 3)
    ]
  }]
};

const authority: OetsFieldAuthorityPresentation = {
  projection_version: "OETS_FIELD_AUTHORITY_PRESENTATION_V1",
  template_code: definition.template_metadata.template_code,
  template_version: definition.template_metadata.version,
  template_version_id: "d3-version",
  projection_checksum: "d".repeat(64),
  fields: [
    authorityRow("manual", "MANUAL_VALUE", "OPERATOR_RECORDED", "EDITABLE", "OPERATOR_RECORDED", "EFFECTIVE"),
    authorityRow("calculated", "CALCULATED_VALUE", "CALCULATED_BY_SERVER", "READ_ONLY", "SERVER_CALCULATED", "EFFECTIVE"),
    authorityRow("downstream", "DOWNSTREAM_VALUE", "UNAVAILABLE_POST_ISSUANCE", "UNAVAILABLE", "DOWNSTREAM_UNAVAILABLE", "UNAVAILABLE")
  ]
};

const runtime: OetsTemplateRuntimeDefinition = {
  template_registry_id: "d3-registry",
  template_version_id: "d3-version",
  template_code: definition.template_metadata.template_code,
  template_archetype: "OPERATIONAL_FORM_TRANSACTION",
  template_version: definition.template_metadata.version,
  schema_version: definition.schema_version,
  checksum: "d3-checksum",
  status: "ACTIVE",
  definition_jsonb: definition,
  field_authority: authority
};

describe("Run D3 frontend downstream authority closure", () => {
  it("enforces projected editability independently of editable template metadata", () => {
    render(<OetsRenderer definition={definition} fieldAuthority={authority} runtimeTemplate={runtime} />);

    expect(screen.getByLabelText("Manual Value")).toBeEnabled();
    expect(screen.getByLabelText("Calculated Value")).toBeDisabled();
    expect(screen.getByLabelText("Downstream Value")).toBeDisabled();
  });

  it("presents the exact downstream lifecycle message without implying manual entry", () => {
    render(<OetsRenderer definition={definition} fieldAuthority={authority} runtimeTemplate={runtime} />);

    expect(screen.getByLabelText("Downstream Value")).toHaveAccessibleDescription("Available only after governed issuance.");
    expect(screen.queryByText("Recorded manually.")).toBeVisible();
  });

  it("maps only READ_ONLY and UNAVAILABLE projections to ordinary disabled controls", () => {
    expect(isAuthorityReadOnly(authority.fields[0])).toBe(false);
    expect(isAuthorityReadOnly(authority.fields[1])).toBe(true);
    expect(isAuthorityReadOnly(authority.fields[2])).toBe(true);
    expect(isAuthorityReadOnly({ ...authority.fields[2]!, presentation_editability: "ACTION_CONTROLLED" })).toBe(false);
  });
});

function field(fieldId: string, fieldCode: string, label: string, sequence: number) {
  return {
    field_id: fieldId,
    field_code: fieldCode,
    label,
    field_type: "TEXT" as const,
    required: false,
    readonly: false,
    visible: true,
    sequence
  };
}

function authorityRow(
  fieldId: string,
  fieldCode: string,
  reasonCode: OetsFieldAuthorityPresentationField["reason_code"],
  editability: OetsFieldAuthorityPresentationField["presentation_editability"],
  kind: OetsFieldAuthorityPresentationField["authority_kind"],
  state: OetsFieldAuthorityPresentationField["authority_state"]
): OetsFieldAuthorityPresentationField {
  return {
    section_code: "CREDENTIAL",
    field_id: fieldId,
    field_code: fieldCode,
    repeatable: false,
    visible: true,
    authority_kind: kind,
    authority_state: state,
    disposition: reasonCode === "UNAVAILABLE_POST_ISSUANCE" ? "UNAVAILABLE_POST_ISSUANCE" : "ACTIVE",
    presentation_editability: editability,
    reason_code: reasonCode
  };
}
