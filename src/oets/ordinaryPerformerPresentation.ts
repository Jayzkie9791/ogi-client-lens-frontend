import { OetsDefinition } from "./types";
import type { OrdinaryPerformerBinding } from "./ordinaryPerformerApi";

const successors = new Map([
  ["OGI_F023_OPERATIONAL_SKILLS_ASSESSMENT", "3.6"], ["OGI_F024_OPERATIONAL_KNOWLEDGE_ASSESSMENT_RECORD", "3.5"],
  ["OGI_F041_LIFEGUARD_CERTIFICATION_RECORD", "3.4"], ["OGI_F044_RECERTIFICATION_APPLICATION", "3.3"],
  ["OGI_F062_MEDICAL_TREATMENT_REPORT", "3.2"], ["OGI_F063_WATER_RESCUE_REPORT", "3.4"],
  ["OGI_F064_CPR_AED_EVENT_REPORT", "3.4"], ["OGI_F065_OXYGEN_ADMINISTRATION_REPORT", "3.4"],
  ["OGI_F066_SPINAL_INJURY_MANAGEMENT_REPORT", "3.4"], ["OGI_F083_EQUIPMENT_DEFICIENCY_REPORT", "3.3"]
]);
export function isOrdinaryPerformerSuccessor(code: string, version: string) { return successors.get(code) === version; }
export function applyOrdinaryPerformerPresentation(definition: OetsDefinition, binding: OrdinaryPerformerBinding | null, actorUserId?: string) {
  const actorOwnsResults = Boolean(binding && actorUserId === binding.performer_user_id);
  return { ...definition, sections: definition.sections.map(section => ({ ...section, fields: section.fields.map(field => {
    const authority = field.metadata?.authority;
    if (authority === "BOUND_PERFORMER_WRITABLE_RESULT") return { ...field, readonly: field.readonly || !actorOwnsResults, description: actorOwnsResults ? field.description : "Read-only. Only the exact bound performer may record or change this result." };
    return field;
  }) })) };
}
