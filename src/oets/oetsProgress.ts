import type { EvidenceAttestation } from "./attestationApi";
import type { GovernedAttestationContext } from "./GovernedAttestationControl";
import type { OetsField, OetsFieldValue, OetsSection } from "./types";
import type { OetsValidationSummary } from "./evidenceValidation";

export type OetsSectionProgressStatus =
  | "NEEDS_ATTENTION"
  | "NOT_STARTED"
  | "IN_PROGRESS"
  | "COMPLETE";

export interface OetsProgressInstance {
  instanceKey: string;
  instanceIndex: number | null;
  values: Record<string, OetsFieldValue>;
}

export interface OetsProgressSectionInput {
  section: OetsSection;
  domId: string;
  instances: readonly OetsProgressInstance[];
}

export interface OetsSectionProgress {
  sectionId: string;
  sectionCode: string;
  sequence: number;
  title: string;
  domId: string;
  status: OetsSectionProgressStatus;
  fulfilledRequired: number;
  totalRequired: number;
}

export interface OetsProgressModel {
  sections: OetsSectionProgress[];
  fulfilledRequired: number;
  totalRequired: number;
  percentage: number | null;
  hasUnmappedAttention: boolean;
}

interface DeriveOetsProgressInput {
  sections: readonly OetsProgressSectionInput[];
  explicitValueKeys: ReadonlySet<string>;
  attestations: readonly EvidenceAttestation[];
  attestationContext?: GovernedAttestationContext;
  attestationBaselineCurrent: boolean;
  validation: OetsValidationSummary | null;
}

export function deriveOetsProgress({
  sections,
  explicitValueKeys,
  attestations,
  attestationContext,
  attestationBaselineCurrent,
  validation
}: DeriveOetsProgressInput): OetsProgressModel {
  const progressSections = sections.map(({ section, domId, instances }) => {
    let meaningful = false;
    let fulfilledRequired = 0;
    let totalRequired = 0;

    for (const instance of instances) {
      for (const field of section.fields) {
        const explicit = explicitValueKeys.has(
          progressValueKey(section.section_code, instance.instanceKey, field.field_code)
        );
        const fulfilled = field.field_type === "SIGNATURE"
          ? hasCurrentAttestation(
              field,
              section,
              instance.instanceIndex,
              attestations,
              attestationContext,
              attestationBaselineCurrent
            )
          : isMeaningfulOetsValue(field, instance.values[field.field_code], explicit);

        meaningful ||= fulfilled;

        if (field.required && !field.readonly) {
          totalRequired += 1;
          if (fulfilled) fulfilledRequired += 1;
        }
      }
    }

    const status = sectionHasAttention(section.section_code, validation)
      ? "NEEDS_ATTENTION"
      : !meaningful
        ? "NOT_STARTED"
        : fulfilledRequired === totalRequired
          ? "COMPLETE"
          : "IN_PROGRESS";

    return {
      sectionId: section.section_id,
      sectionCode: section.section_code,
      sequence: section.sequence,
      title: section.title,
      domId,
      status,
      fulfilledRequired,
      totalRequired
    } satisfies OetsSectionProgress;
  });
  const fulfilledRequired = progressSections.reduce(
    (total, section) => total + section.fulfilledRequired,
    0
  );
  const totalRequired = progressSections.reduce(
    (total, section) => total + section.totalRequired,
    0
  );

  return {
    sections: progressSections,
    fulfilledRequired,
    totalRequired,
    percentage:
      totalRequired === 0
        ? null
        : Math.round((fulfilledRequired / totalRequired) * 100),
    hasUnmappedAttention: Boolean(validation?.formMessages.length)
  };
}

export function isMeaningfulOetsValue(
  field: OetsField,
  value: OetsFieldValue | undefined,
  explicitlyPresent: boolean
) {
  switch (field.field_type) {
    case "BOOLEAN":
      return typeof value === "boolean" && explicitlyPresent;
    case "CHECKBOX":
      return value === true;
    case "NUMBER":
    case "DECIMAL":
      return typeof value === "number" && Number.isFinite(value);
    case "MULTISELECT": {
      const allowed = new Set((field.options ?? []).map((option) => option.value));
      return (
        Array.isArray(value) &&
        value.length > 0 &&
        value.every((item) => allowed.has(item))
      );
    }
    case "RADIO":
    case "SELECT":
      return (
        typeof value === "string" &&
        value.length > 0 &&
        (field.options ?? []).some((option) => option.value === value)
      );
    case "SIGNATURE":
      return false;
    case "TEXT":
    case "TEXTAREA":
    case "EMAIL":
    case "PHONE":
    case "URL":
    case "DATE":
    case "TIME":
      return typeof value === "string" && value.trim().length > 0;
    default:
      return false;
  }
}

export function progressValueKey(
  sectionCode: string,
  instanceKey: string,
  fieldCode: string
) {
  return `${sectionCode}/${instanceKey}/${fieldCode}`;
}

function hasCurrentAttestation(
  field: OetsField,
  section: OetsSection,
  instanceIndex: number | null,
  attestations: readonly EvidenceAttestation[],
  context: GovernedAttestationContext | undefined,
  baselineCurrent: boolean
) {
  if (!context || !baselineCurrent) return false;

  return attestations.some(
    (item) =>
      item.status === "CURRENT" &&
      item.evidence_record_id === context.evidenceRecordId &&
      item.template_version_id === context.templateVersionId &&
      item.template_checksum === context.templateChecksum &&
      item.payload_checksum === context.payloadChecksum &&
      item.signature_field_id === field.field_id &&
      item.signature_field_code_snapshot === field.field_code &&
      item.section_code_snapshot === section.section_code &&
      item.section_instance_index === instanceIndex
  );
}

function sectionHasAttention(
  sectionCode: string,
  validation: OetsValidationSummary | null
) {
  if (!validation) return false;
  if ((validation.sectionMessages[sectionCode] ?? []).length > 0) return true;

  return Object.entries(validation.fieldMessages).some(
    ([key, messages]) => key.startsWith(`${sectionCode}/`) && messages.length > 0
  );
}
