import { describe, expect, it } from "vitest";

import type { EvidenceAttestation } from "./attestationApi";
import {
  deriveOetsProgress,
  isMeaningfulOetsValue,
  progressValueKey
} from "./oetsProgress";
import type { OetsField, OetsFieldValue, OetsSection } from "./types";

const baseField: OetsField = {
  field_id: "field-1", field_code: "VALUE", label: "Value", field_type: "TEXT",
  required: true, readonly: false, visible: true, sequence: 1
};
const baseSection: OetsSection = {
  section_id: "section-1", section_code: "GENERAL", title: "General",
  sequence: 1, fields: [baseField]
};

describe("OETS progress derivation", () => {
  it("uses type-specific meaningful-value rules instead of truthiness", () => {
    expect(isMeaningfulOetsValue(baseField, "", true)).toBe(false);
    expect(isMeaningfulOetsValue(baseField, "   ", true)).toBe(false);
    expect(isMeaningfulOetsValue(field("NUMBER"), 0, true)).toBe(true);
    expect(isMeaningfulOetsValue(field("BOOLEAN"), false, false)).toBe(false);
    expect(isMeaningfulOetsValue(field("BOOLEAN"), false, true)).toBe(true);
    expect(isMeaningfulOetsValue(field("CHECKBOX"), false, true)).toBe(false);
    expect(isMeaningfulOetsValue(field("CHECKBOX"), true, true)).toBe(true);
    expect(isMeaningfulOetsValue(field("MULTISELECT"), [], true)).toBe(false);
    expect(isMeaningfulOetsValue(field("MULTISELECT"), ["YES"], true)).toBe(true);
    expect(isMeaningfulOetsValue(field("SELECT"), "UNKNOWN", true)).toBe(false);
    expect(isMeaningfulOetsValue(field("RADIO"), "YES", true)).toBe(true);
  });

  it("derives completion and never reports 100 for a zero denominator", () => {
    expect(derive({ VALUE: null }).sections[0].status).toBe("NOT_STARTED");
    expect(derive({ VALUE: null }).percentage).toBe(0);
    expect(derive({ VALUE: "evidence" }).percentage).toBe(100);

    const optional = { ...baseSection, fields: [{ ...baseField, required: false }] };
    const noRequired = derive({ VALUE: null }, { section: optional });
    expect(noRequired.percentage).toBeNull();
    expect(noRequired.sections[0].status).toBe("NOT_STARTED");
  });

  it("counts active repeatable instances and the supplied visible fields", () => {
    const repeated = derive([{ VALUE: "one" }, { VALUE: null }], { repeatable: true });
    expect(repeated.totalRequired).toBe(2);
    expect(repeated.fulfilledRequired).toBe(1);
    expect(repeated.sections[0].status).toBe("IN_PROGRESS");

    expect(derive([{ VALUE: "one" }], { repeatable: true }).totalRequired).toBe(1);
    expect(derive({}, { section: { ...baseSection, fields: [] } }).totalRequired).toBe(0);
  });

  it("requires exact current signature provenance", () => {
    const section = { ...baseSection, fields: [field("SIGNATURE")] };
    const current = attestation();
    expect(derive({ VALUE: null }, {
      section, attestations: [current], withContext: true
    }).sections[0].status).toBe("COMPLETE");

    const invalid = [
      { ...current, status: "STALE" as const },
      { ...current, evidence_record_id: "other" },
      { ...current, template_version_id: "other" },
      { ...current, payload_checksum: "other" },
      { ...current, signature_field_code_snapshot: "OTHER" },
      { ...current, section_code_snapshot: "OTHER" },
      { ...current, section_instance_index: 0 }
    ];
    for (const item of invalid) {
      expect(derive({ VALUE: null }, {
        section, attestations: [item], withContext: true
      }).sections[0].status).toBe("NOT_STARTED");
    }
  });

  it("gives mapped backend attention precedence without assigning form errors", () => {
    expect(derive({ VALUE: "evidence" }, {
      fieldMessages: { "GENERAL/VALUE": ["invalid"] }
    }).sections[0].status).toBe("NEEDS_ATTENTION");
    expect(derive({ VALUE: "evidence" }, {
      sectionMessages: { GENERAL: ["invalid"] }
    }).sections[0].status).toBe("NEEDS_ATTENTION");
    const formOnly = derive({ VALUE: "evidence" }, { formMessages: ["unmapped"] });
    expect(formOnly.sections[0].status).toBe("COMPLETE");
    expect(formOnly.hasUnmappedAttention).toBe(true);
  });

  it("derives without mutating evidence values", () => {
    const values = Object.freeze({ VALUE: "immutable evidence" });
    derive(values);
    expect(values).toEqual({ VALUE: "immutable evidence" });
  });
});

function field(fieldType: OetsField["field_type"]): OetsField {
  return {
    ...baseField, field_type: fieldType,
    options: [
      { label: "Yes", value: "YES", sequence: 1 },
      { label: "No", value: "NO", sequence: 2 }
    ]
  };
}

interface DeriveOptions {
  section?: OetsSection;
  repeatable?: boolean;
  attestations?: EvidenceAttestation[];
  withContext?: boolean;
  formMessages?: string[];
  sectionMessages?: Record<string, string[]>;
  fieldMessages?: Record<string, string[]>;
}

function derive(
  values: Record<string, OetsFieldValue> | Array<Record<string, OetsFieldValue>>,
  options: DeriveOptions = {}
) {
  const instances = Array.isArray(values) ? values : [values];
  return deriveOetsProgress({
    sections: [{
      section: { ...(options.section ?? baseSection), repeatable: options.repeatable },
      domId: "oets-section-section-1",
      instances: instances.map((item, index) => ({
        instanceKey: options.repeatable ? "GENERAL-" + (index + 1) : "single",
        instanceIndex: options.repeatable ? index : null,
        values: item
      }))
    }],
    explicitValueKeys: new Set(instances.flatMap((item, index) =>
      Object.keys(item).map((fieldCode) => progressValueKey(
        "GENERAL", options.repeatable ? "GENERAL-" + (index + 1) : "single", fieldCode
      ))
    )),
    attestations: options.attestations ?? [],
    attestationContext: options.withContext ? {
      evidenceRecordId: "record-1", payloadChecksum: "payload-1",
      templateVersionId: "version-1", templateChecksum: "template-1",
      actorDisplayName: "Operator"
    } : undefined,
    attestationBaselineCurrent: true,
    validation: {
      formMessages: options.formMessages ?? [],
      sectionMessages: options.sectionMessages ?? {},
      fieldMessages: options.fieldMessages ?? {}
    }
  });
}

function attestation(): EvidenceAttestation {
  return {
    id: "attestation-1", evidence_record_id: "record-1",
    template_version_id: "version-1", template_code_snapshot: "FORM-1",
    template_checksum: "template-1", payload_checksum: "payload-1",
    signature_field_id: "field-1", signature_field_code_snapshot: "VALUE",
    section_code_snapshot: "GENERAL", section_instance_index: null,
    attestation_statement_snapshot: "I attest.", purpose: "APPROVAL",
    signer_mode: "AUTHENTICATED_SELF_ATTESTATION", subject_name_snapshot: "Operator",
    external_subject_role_snapshot: null, actor_user_id: "user-1",
    actor_display_name_snapshot: "Operator", signer_user_id: "user-1",
    signer_display_name_snapshot: "Operator", client_id_snapshot: null,
    facility_id_snapshot: null, lifecycle_state_snapshot: "DRAFT",
    signed_at: "2026-01-01T00:00:00.000Z", correlation_id: null,
    created_at: "2026-01-01T00:00:00.000Z", status: "CURRENT",
    assurance: "AUTHENTICATED_SELF_ATTESTATION"
  };
}
