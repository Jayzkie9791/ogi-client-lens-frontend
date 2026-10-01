import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { OetsRenderer } from "./OetsRenderer";
import type { OetsDefinition, OetsFieldAuthorityPresentation, OetsTemplateRuntimeDefinition } from "./types";

const definition: OetsDefinition = {
  schema_version: "1.0",
  template_metadata: { template_id: "template-1", template_code: "OGI_TEST", template_name: "Authority Test", module: "TEST", version: "1.0" },
  sections: [{ section_id: "section-1", section_code: "DETAIL", title: "Detail", sequence: 1, fields: [
    { field_id: "manual", field_code: "MANUAL", label: "Manual", field_type: "TEXT", required: false, readonly: false, visible: true, sequence: 1 },
    { field_id: "calculated", field_code: "CALCULATED", label: "Calculated", field_type: "NUMBER", required: false, readonly: true, visible: true, sequence: 2 },
    { field_id: "signature", field_code: "SIGNATURE", label: "Signature", field_type: "SIGNATURE", required: false, readonly: true, visible: true, sequence: 3, metadata: { signature_containment: { kind: "DEFERRED_GOVERNED_ARTIFACT", reason: "Not implemented." } } }
  ] }]
};

const authority: OetsFieldAuthorityPresentation = {
  projection_version: "OETS_FIELD_AUTHORITY_PRESENTATION_V1", template_code: "OGI_TEST", template_version: "1.0", template_version_id: "version-1", projection_checksum: "a".repeat(64),
  fields: [
    row("manual", "MANUAL", "OPERATOR_RECORDED", "EDITABLE"),
    row("calculated", "CALCULATED", "CALCULATED_BY_SERVER", "READ_ONLY"),
    row("signature", "SIGNATURE", "GOVERNED_ARTIFACT_DEFERRED", "UNAVAILABLE")
  ]
};
const runtime: OetsTemplateRuntimeDefinition = { template_registry_id: "registry-1", template_version_id: "version-1", template_code: "OGI_TEST", template_archetype: "OPERATIONAL_FORM_TRANSACTION", template_version: "1.0", schema_version: "1.0", checksum: "checksum", status: "ACTIVE", definition_jsonb: definition, field_authority: authority };

describe("I-A4 renderer integration", () => {
  it("associates ordinary authority prose without manufacturing calculated values", () => {
    render(<OetsRenderer definition={definition} fieldAuthority={authority} runtimeTemplate={runtime} />);
    expect(screen.getByLabelText("Manual")).toHaveAccessibleDescription("Recorded manually.");
    expect(screen.getByLabelText("Calculated")).toHaveAccessibleDescription("Calculated automatically from governed values in this record.");
    expect(screen.getByLabelText("Calculated")).toHaveValue(null);
  });

  it("preserves specialized deferred-artifact presentation without duplicate generic prose", () => {
    render(<OetsRenderer definition={definition} fieldAuthority={authority} runtimeTemplate={runtime} />);
    expect(screen.getByText("Governed artifact deferred")).toBeVisible();
    expect(screen.queryByText("Governed artifact authority is not yet implemented.")).not.toBeInTheDocument();
  });
});

function row(fieldId: string, fieldCode: string, reasonCode: "OPERATOR_RECORDED" | "CALCULATED_BY_SERVER" | "GOVERNED_ARTIFACT_DEFERRED", editability: "EDITABLE" | "READ_ONLY" | "UNAVAILABLE") {
  return {
    section_code: "DETAIL", field_id: fieldId, field_code: fieldCode, repeatable: false, visible: true,
    authority_kind: reasonCode === "OPERATOR_RECORDED" ? "OPERATOR_RECORDED" as const : reasonCode === "CALCULATED_BY_SERVER" ? "SERVER_CALCULATED" as const : "DOWNSTREAM_UNAVAILABLE" as const,
    authority_state: reasonCode === "GOVERNED_ARTIFACT_DEFERRED" ? "UNAVAILABLE" as const : "EFFECTIVE" as const,
    disposition: "ACTIVE" as const, presentation_editability: editability, reason_code: reasonCode
  };
}
