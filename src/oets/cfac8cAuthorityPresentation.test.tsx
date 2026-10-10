import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  oetsFieldAuthorityDispositions,
  oetsFieldAuthorityKinds,
  oetsFieldAuthorityReasonCodes,
  isOetsFieldAuthorityPresentation
} from "./definitionGuards";
import { oetsFieldAuthorityMessages } from "./fieldAuthorityPresentation";
import { OetsRenderer, isAuthorityReadOnly } from "./OetsRenderer";
import type {
  OetsDefinition,
  OetsFieldAuthorityPresentation,
  OetsFieldAuthorityPresentationField,
  OetsTemplateRuntimeDefinition
} from "./types";

const backendKinds = ["OPERATOR_RECORDED", "CONTEXT_PROJECTED", "SERVER_GENERATED", "SERVER_CALCULATED", "STATIC_CONTENT", "TECHNICAL_IDENTITY", "GOVERNED_ATTESTATION", "ATTESTATION_PROJECTED", "DOWNSTREAM_UNAVAILABLE"] as const;
const backendDispositions = ["ACTIVE", "FORMULA_ABSENT", "SEMANTICS_BLOCKED", "CONTEXT_BLOCKED", "DOWNSTREAM_UNAVAILABLE", "RETIRED_STATIC_NOTE", "INTENTIONALLY_UNUSED", "UNAVAILABLE_POST_ISSUANCE", "TEMPLATE_READ_ONLY_UNCLASSIFIED"] as const;
const backendReasonCodes = ["OPERATOR_RECORDED", "OPERATOR_RECORDED_FORMULA_ABSENT", "OPERATOR_RECORDED_SEMANTICS_BLOCKED", "OPERATOR_RECORDED_CONTEXT_BLOCKED", "TEMPLATE_READ_ONLY_AUTHORITY_UNCLASSIFIED", "GOVERNED_CONTEXT_PROJECTION_DECLARED", "GOVERNED_CONTEXT_PROJECTION_EFFECTIVE", "GOVERNED_AGGREGATE_PROJECTION", "GENERATED_AT_DRAFT_CREATION", "GENERATED_TEMPORAL_VALUE", "GOVERNED_ASSIGNED_ROLE_PROJECTION", "STATIC_TEMPLATE_CONTENT", "STATIC_CERTIFICATION_TEXT", "TECHNICAL_ROW_IDENTITY", "CALCULATED_BY_SERVER", "GOVERNED_ATTESTATION_ACTION", "DERIVED_FROM_GOVERNED_ATTESTATION", "GOVERNED_ARTIFACT_DEFERRED", "DOWNSTREAM_UNAVAILABLE", "RETIRED_STATIC_NOTE", "INTENTIONALLY_UNUSED", "UNAVAILABLE_POST_ISSUANCE"] as const;

describe("CFAC-8C exact frontend field-authority parity", () => {
  it("recognizes exactly all backend kinds, dispositions, and reason codes", () => {
    expect(oetsFieldAuthorityKinds).toEqual(backendKinds);
    expect(oetsFieldAuthorityDispositions).toEqual(backendDispositions);
    expect(oetsFieldAuthorityReasonCodes).toEqual(backendReasonCodes);
    expect(Object.keys(oetsFieldAuthorityMessages)).toEqual(backendReasonCodes);
  });

  it("preserves all 22 exact messages", () => {
    expect(oetsFieldAuthorityMessages).toEqual({
      OPERATOR_RECORDED: "Recorded manually.",
      OPERATOR_RECORDED_FORMULA_ABSENT: "Recorded manually; no approved calculation formula is implemented.",
      OPERATOR_RECORDED_SEMANTICS_BLOCKED: "Recorded manually; calculation semantics are not approved.",
      OPERATOR_RECORDED_CONTEXT_BLOCKED: "Recorded manually; no approved contextual derivation is implemented.",
      TEMPLATE_READ_ONLY_AUTHORITY_UNCLASSIFIED: "Read-only field; no server ownership is asserted.",
      GOVERNED_CONTEXT_PROJECTION_DECLARED: "Provided from governed context when that context is selected.",
      GOVERNED_CONTEXT_PROJECTION_EFFECTIVE: "Provided from the selected governed record.",
      GOVERNED_AGGREGATE_PROJECTION: "Projected from governed source evidence.",
      GENERATED_AT_DRAFT_CREATION: "Generated automatically when this record is created.",
      GENERATED_TEMPORAL_VALUE: "Generated automatically from the governed date or time authority.",
      GOVERNED_ASSIGNED_ROLE_PROJECTION: "Provided from the governed assigned role.",
      STATIC_TEMPLATE_CONTENT: "Fixed content defined by this governed template.",
      STATIC_CERTIFICATION_TEXT: "Fixed certification text defined by this governed template.",
      TECHNICAL_ROW_IDENTITY: "Managed automatically as the technical row identifier.",
      CALCULATED_BY_SERVER: "Calculated automatically from governed values in this record.",
      GOVERNED_ATTESTATION_ACTION: "Use the governed attestation action shown for this field.",
      DERIVED_FROM_GOVERNED_ATTESTATION: "Derived from the governed attestation.",
      GOVERNED_ARTIFACT_DEFERRED: "Governed artifact authority is not yet implemented.",
      DOWNSTREAM_UNAVAILABLE: "Unavailable because the governed downstream value is not available.",
      RETIRED_STATIC_NOTE: "Retired template note; no entry is permitted.",
      INTENTIONALLY_UNUSED: "Intentionally unused; no entry is permitted.",
      UNAVAILABLE_POST_ISSUANCE: "Available only after governed issuance."
    });
  });

  it("fails closed for unknown and malformed projection values", () => {
    expect(isOetsFieldAuthorityPresentation(projection)).toBe(true);
    for (const [property, value] of [["authority_kind", "UNKNOWN_KIND"], ["disposition", "UNKNOWN_DISPOSITION"], ["reason_code", "UNKNOWN_REASON"], ["authority_state", "UNKNOWN_STATE"], ["presentation_editability", "UNKNOWN_EDITABILITY"]] as const) {
      expect(isOetsFieldAuthorityPresentation({ ...projection, fields: [{ ...projection.fields[0]!, [property]: value }] })).toBe(false);
    }
    expect(isOetsFieldAuthorityPresentation({ ...projection, fields: [{ ...projection.fields[0]!, field_id: "" }] })).toBe(false);
  });

  it("presents contextual states, editability, accessibility, and specialized containment", () => {
    render(<OetsRenderer definition={definition} fieldAuthority={projection} initialPayload={{ sections: { REPEATABLE: [{ REPEAT_VALUE: null }] } }} runtimeTemplate={runtime} />);

    expect(screen.getByLabelText("Declared Value")).toBeEnabled();
    expect(screen.getByLabelText("Declared Value")).toHaveAccessibleDescription("Provided from governed context when that context is selected.");
    expect(screen.getByLabelText("Effective Boolean")).toBeDisabled();
    expect(screen.getByLabelText("Effective Boolean")).toHaveAccessibleDescription("Provided from the selected governed record.");
    expect(screen.getByLabelText("Repeat Value")).toBeDisabled();
    expect(screen.getByLabelText("Repeat Value")).toHaveAccessibleDescription("Unavailable because the governed downstream value is not available.");
    expect(isAuthorityReadOnly({ ...projection.fields[0]!, presentation_editability: "ACTION_CONTROLLED" })).toBe(false);

    expect(screen.getByText("Attestation statement")).toBeVisible();
    expect(screen.queryByText("Use the governed attestation action shown for this field.")).not.toBeInTheDocument();
    expect(screen.getByText(/Unsupported field type/)).toBeVisible();
    expect(screen.queryByText("Managed automatically as the technical row identifier.")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Hidden Value")).not.toBeInTheDocument();
  });
});

const definition = {
  schema_version: "1.0",
  template_metadata: { template_id: "cfac-8c", template_code: "OGI_CFAC_8C", template_name: "CFAC 8C", module: "TEST", version: "1.0" },
  sections: [
    { section_id: "ordinary", section_code: "ORDINARY", title: "Ordinary", sequence: 1, fields: [
      field("declared", "DECLARED_VALUE", "Declared Value", "TEXT", true, 1),
      field("boolean", "EFFECTIVE_BOOLEAN", "Effective Boolean", "BOOLEAN", true, 2),
      field("unsupported", "UNSUPPORTED_VALUE", "Unsupported Value", "UNSUPPORTED", true, 3),
      field("hidden", "HIDDEN_VALUE", "Hidden Value", "TEXT", false, 4),
      { ...field("signature", "SIGNATURE", "Governed Signature", "SIGNATURE", true, 5), readonly: true, metadata: { governed_attestation: { statement: "I attest to this governed evidence.", purpose: "CERTIFICATION", permitted_signer_modes: ["AUTHENTICATED_SELF_ATTESTATION"], external_subject_role: "NOT_PERMITTED" } } }
    ] },
    { section_id: "repeatable", section_code: "REPEATABLE", title: "Repeatable", sequence: 2, repeatable: true, fields: [field("repeat", "REPEAT_VALUE", "Repeat Value", "TEXT", true, 1)] }
  ]
} as unknown as OetsDefinition;

const projection: OetsFieldAuthorityPresentation = {
  projection_version: "OETS_FIELD_AUTHORITY_PRESENTATION_V1", template_code: "OGI_CFAC_8C", template_version: "1.0", template_version_id: "version-8c", projection_checksum: "8".repeat(64),
  fields: [
    row("ORDINARY", "declared", "DECLARED_VALUE", false, true, "CONTEXT_PROJECTED", "DECLARED", "ACTIVE", "EDITABLE", "GOVERNED_CONTEXT_PROJECTION_DECLARED"),
    row("ORDINARY", "boolean", "EFFECTIVE_BOOLEAN", false, true, "CONTEXT_PROJECTED", "EFFECTIVE", "ACTIVE", "READ_ONLY", "GOVERNED_CONTEXT_PROJECTION_EFFECTIVE"),
    row("ORDINARY", "unsupported", "UNSUPPORTED_VALUE", false, true, "TECHNICAL_IDENTITY", "EFFECTIVE", "ACTIVE", "READ_ONLY", "TECHNICAL_ROW_IDENTITY"),
    row("ORDINARY", "hidden", "HIDDEN_VALUE", false, false, "STATIC_CONTENT", "EFFECTIVE", "ACTIVE", "READ_ONLY", "STATIC_TEMPLATE_CONTENT"),
    row("ORDINARY", "signature", "SIGNATURE", false, true, "GOVERNED_ATTESTATION", "EFFECTIVE", "ACTIVE", "ACTION_CONTROLLED", "GOVERNED_ATTESTATION_ACTION"),
    row("REPEATABLE", "repeat", "REPEAT_VALUE", true, true, "DOWNSTREAM_UNAVAILABLE", "UNAVAILABLE", "DOWNSTREAM_UNAVAILABLE", "UNAVAILABLE", "DOWNSTREAM_UNAVAILABLE")
  ]
};

const runtime: OetsTemplateRuntimeDefinition = { template_registry_id: "registry-8c", template_version_id: "version-8c", template_code: "OGI_CFAC_8C", template_archetype: "OPERATIONAL_FORM_TRANSACTION", template_version: "1.0", schema_version: "1.0", checksum: "checksum-8c", status: "ACTIVE", definition_jsonb: definition, field_authority: projection };

function field(id: string, code: string, label: string, type: string, visible: boolean, sequence: number) { return { field_id: id, field_code: code, label, field_type: type, required: false, readonly: false, visible, sequence }; }

function row(section_code: string, field_id: string, field_code: string, repeatable: boolean, visible: boolean, authority_kind: OetsFieldAuthorityPresentationField["authority_kind"], authority_state: OetsFieldAuthorityPresentationField["authority_state"], disposition: OetsFieldAuthorityPresentationField["disposition"], presentation_editability: OetsFieldAuthorityPresentationField["presentation_editability"], reason_code: OetsFieldAuthorityPresentationField["reason_code"]): OetsFieldAuthorityPresentationField {
  return { section_code, field_id, field_code, repeatable, visible, authority_kind, authority_state, disposition, presentation_editability, reason_code };
}
