import { describe, expect, it } from "vitest";

import { buildFieldAuthorityIndex, fieldAuthorityKey, fieldAuthorityMessage } from "./fieldAuthorityPresentation";
import type { OetsDefinition, OetsFieldAuthorityPresentation } from "./types";

const definition: OetsDefinition = {
  schema_version: "1.0",
  template_metadata: { template_id: "template-1", template_code: "OGI_TEST", template_name: "Test", module: "TEST", version: "1.0" },
  sections: [{
    section_id: "section-1", section_code: "DETAIL", title: "Detail", sequence: 1, repeatable: false,
    fields: [{ field_id: "field-1", field_code: "VALUE", label: "Value", field_type: "NUMBER", required: false, readonly: true, visible: true, sequence: 1 }]
  }]
};

const projection: OetsFieldAuthorityPresentation = {
  projection_version: "OETS_FIELD_AUTHORITY_PRESENTATION_V1",
  template_code: "OGI_TEST",
  template_version: "1.0",
  template_version_id: "version-1",
  projection_checksum: "a".repeat(64),
  fields: [{
    section_code: "DETAIL", field_id: "field-1", field_code: "VALUE", repeatable: false, visible: true,
    authority_kind: "SERVER_CALCULATED", authority_state: "EFFECTIVE", disposition: "ACTIVE",
    presentation_editability: "READ_ONLY", reason_code: "CALCULATED_BY_SERVER"
  }]
};

describe("I-A4 frontend field-authority presentation", () => {
  it("indexes exact identities and maps server-owned authority to bounded prose", () => {
    const index = buildFieldAuthorityIndex(definition, projection);
    const field = index.get(fieldAuthorityKey("DETAIL", "field-1", "VALUE"));
    expect(field && fieldAuthorityMessage(field)).toBe("Calculated automatically from governed values in this record.");
  });

  it("fails closed for version drift, missing fields, and duplicate authority identities", () => {
    expect(() => buildFieldAuthorityIndex(definition, { ...projection, template_version: "2.0" })).toThrow(/exact OETS template version/);
    expect(() => buildFieldAuthorityIndex(definition, { ...projection, fields: [] })).toThrow(/incomplete/);
    expect(() => buildFieldAuthorityIndex(definition, { ...projection, fields: [projection.fields[0]!, projection.fields[0]!] })).toThrow(/Duplicate field authority identity/);
  });

  it("keeps declared context distinct from effective context", () => {
    expect(fieldAuthorityMessage({ ...projection.fields[0]!, reason_code: "GOVERNED_CONTEXT_PROJECTION_DECLARED" })).toContain("when that context is selected");
    expect(fieldAuthorityMessage({ ...projection.fields[0]!, reason_code: "GOVERNED_CONTEXT_PROJECTION_EFFECTIVE" })).toBe("Provided from the selected governed record.");
  });
});
