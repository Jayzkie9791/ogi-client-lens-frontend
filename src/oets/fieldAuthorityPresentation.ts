import type {
  OetsDefinition,
  OetsFieldAuthorityPresentation,
  OetsFieldAuthorityPresentationField,
  OetsFieldAuthorityReasonCode
} from "./types";

const messages: Record<OetsFieldAuthorityReasonCode, string> = {
  OPERATOR_RECORDED: "Recorded manually.",
  OPERATOR_RECORDED_FORMULA_ABSENT: "Recorded manually; no approved calculation formula is implemented.",
  OPERATOR_RECORDED_SEMANTICS_BLOCKED: "Recorded manually; calculation semantics are not approved.",
  OPERATOR_RECORDED_CONTEXT_BLOCKED: "Recorded manually; no approved contextual derivation is implemented.",
  TEMPLATE_READ_ONLY_AUTHORITY_UNCLASSIFIED: "Read-only field; no server ownership is asserted.",
  GOVERNED_CONTEXT_PROJECTION_DECLARED: "Provided from governed context when that context is selected.",
  GOVERNED_CONTEXT_PROJECTION_EFFECTIVE: "Provided from the selected governed record.",
  GOVERNED_AGGREGATE_PROJECTION: "Projected from governed source evidence.",
  GENERATED_AT_DRAFT_CREATION: "Generated automatically when this record is created.",
  CALCULATED_BY_SERVER: "Calculated automatically from governed values in this record.",
  GOVERNED_ATTESTATION_ACTION: "Use the governed attestation action shown for this field.",
  DERIVED_FROM_GOVERNED_ATTESTATION: "Derived from the governed attestation.",
  GOVERNED_ARTIFACT_DEFERRED: "Governed artifact authority is not yet implemented.",
  UNAVAILABLE_POST_ISSUANCE: "Available only after governed issuance."
};

export function fieldAuthorityMessage(field: OetsFieldAuthorityPresentationField) {
  return messages[field.reason_code];
}

export function buildFieldAuthorityIndex(
  definition: OetsDefinition,
  projection: OetsFieldAuthorityPresentation
) {
  if (projection.template_code !== definition.template_metadata.template_code ||
      projection.template_version !== definition.template_metadata.version) {
    throw new Error("Field authority does not match the exact OETS template version.");
  }

  const expected = new Map<string, { repeatable: boolean; visible: boolean }>();
  for (const section of definition.sections) {
    for (const field of section.fields) {
      const key = fieldAuthorityKey(section.section_code, field.field_id, field.field_code);
      if (expected.has(key)) throw new Error(`Duplicate OETS field identity: ${section.section_code}.${field.field_code}.`);
      expected.set(key, { repeatable: section.repeatable === true, visible: field.visible });
    }
  }

  const index = new Map<string, OetsFieldAuthorityPresentationField>();
  for (const field of projection.fields) {
    const key = fieldAuthorityKey(field.section_code, field.field_id, field.field_code);
    if (index.has(key)) throw new Error(`Duplicate field authority identity: ${field.section_code}.${field.field_code}.`);
    const exact = expected.get(key);
    if (!exact || exact.repeatable !== field.repeatable || exact.visible !== field.visible) {
      throw new Error(`Field authority identity drift: ${field.section_code}.${field.field_code}.`);
    }
    index.set(key, field);
  }

  if (index.size !== expected.size) {
    throw new Error("Field authority projection is incomplete for the exact OETS template version.");
  }
  return index;
}

export function fieldAuthorityKey(sectionCode: string, fieldId: string, fieldCode: string) {
  return `${sectionCode}\u0000${fieldId}\u0000${fieldCode}`;
}
