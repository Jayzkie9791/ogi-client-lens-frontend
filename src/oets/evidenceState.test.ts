import { describe, expect, it } from "vitest";

import {
  assembleEvidencePayload,
  createEvidenceStateFromPayload,
  createInitialEvidenceState,
  createRepeatableSectionInstance
} from "./evidenceState";
import type { OetsDefinition, OetsTemplateRuntimeDefinition } from "./types";

const definition: OetsDefinition = {
  schema_version: "1.0",
  template_metadata: { template_id: "f081", template_code: "F081", template_name: "F081", module: "M05", version: "3.5" },
  sections: [{
    section_id: "findings",
    section_code: "INSPECTION_FINDINGS",
    title: "Inspection Findings",
    sequence: 1,
    repeatable: true,
    metadata: { repeatable_constraints: { minimum_instances: 0, maximum_instances: 100 } },
    fields: [
      { field_id: "row-key", field_code: "FINDING_SOURCE_ROW_KEY", label: "Row key", field_type: "TEXT", required: true, readonly: true, visible: false, sequence: 1, metadata: { persist_hidden: true, technical_row_identity: "CLIENT_GENERATED_UUID_V1" } },
      { field_id: "description", field_code: "DESCRIPTION", label: "Description", field_type: "TEXTAREA", required: false, readonly: false, visible: true, sequence: 2 }
    ]
  }]
};
const runtime: OetsTemplateRuntimeDefinition = { template_registry_id: "registry", template_version_id: "version", template_code: "F081", template_archetype: "CHECKLIST_INSPECTION", template_version: "3.5", schema_version: "1.0", checksum: "checksum", status: "INACTIVE", definition_jsonb: definition, field_authority: { projection_version: "OETS_FIELD_AUTHORITY_PRESENTATION_V1", template_code: "F081", template_version: "3.5", template_version_id: "version", fields: [], projection_checksum: "a".repeat(64) } };

describe("persisted technical repeatable-row identity", () => {
  it("starts a zero-minimum section empty and preserves an existing hidden UUID on reopen", () => {
    expect(createInitialEvidenceState(definition).INSPECTION_FINDINGS).toEqual([]);
    const key = "10000000-0000-4000-8000-000000000001";
    const payload = { sections: { INSPECTION_FINDINGS: [{ FINDING_SOURCE_ROW_KEY: key, DESCRIPTION: "Observed" }] } };
    const state = createEvidenceStateFromPayload(definition, payload);
    const instances = state.INSPECTION_FINDINGS;
    expect(Array.isArray(instances) && instances[0].key).toBe(key);
    expect(assembleEvidencePayload(runtime, definition, state).sections.INSPECTION_FINDINGS).toEqual(payload.sections.INSPECTION_FINDINGS);
  });
});

describe("local repeatable-row identity", () => {
  it("does not reuse a restored row key for a newly added F-022-style entry", () => {
    const attendanceDefinition = structuredClone(definition);
    const section = attendanceDefinition.sections[0];
    section.section_code = "PERSONNEL_ATTENDANCE_LOG";
    section.fields = [{ field_id: "date", field_code: "DATE", label: "Date", field_type: "DATE", required: false, readonly: false, visible: true, sequence: 1 }];
    const restored = createEvidenceStateFromPayload(attendanceDefinition, { sections: {
      PERSONNEL_ATTENDANCE_LOG: [{ DATE: "2026-09-21" }, { DATE: "2026-09-22" }]
    } }).PERSONNEL_ATTENDANCE_LOG;
    expect(Array.isArray(restored)).toBe(true);
    if (!Array.isArray(restored)) return;

    const third = createRepeatableSectionInstance(section, 1);
    expect(new Set([...restored.map((row) => row.key), third.key]).size).toBe(3);
    expect(third.values).toEqual({ DATE: null });
  });
});
