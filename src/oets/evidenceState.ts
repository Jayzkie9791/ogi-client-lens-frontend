import {
  OetsDefinition,
  OetsEvidencePayload,
  OetsField,
  OetsFieldValue,
  OetsSection,
  OetsTemplateRuntimeDefinition
} from "./types";

export interface RepeatableSectionInstance {
  key: string;
  values: Record<string, OetsFieldValue>;
}

export type EditableOetsState = Record<
  string,
  Record<string, OetsFieldValue> | RepeatableSectionInstance[]
>;

export function createInitialEvidenceState(
  definition: OetsDefinition
): EditableOetsState {
  return Object.fromEntries(
    orderedSections(definition).map((section) => {
      if (section.repeatable) {
        const { minimumInstances } = repeatableConstraints(section);
        return [
          section.section_code,
          Array.from({ length: minimumInstances }, (_, index) =>
            createRepeatableSectionInstance(section, index)
          )
        ];
      }

      return [section.section_code, createFieldValues(section.fields)];
    })
  );
}

export function assembleEvidencePayload(
  runtimeTemplate: OetsTemplateRuntimeDefinition,
  definition: OetsDefinition,
  state: EditableOetsState
): OetsEvidencePayload {
  const sections = Object.fromEntries(
    orderedSections(definition).map((section) => {
      const sectionState = state[section.section_code];

      if (section.repeatable) {
        const instances = Array.isArray(sectionState) ? sectionState : [];

        return [
          section.section_code,
          instances.map((instance) =>
            orderedFieldValues(section.fields, instance.values)
          )
        ];
      }

      return [
        section.section_code,
        orderedFieldValues(
          section.fields,
          !Array.isArray(sectionState) && sectionState ? sectionState : {}
        )
      ];
    })
  );

  return {
    template_code: runtimeTemplate.template_code,
    template_version_id: runtimeTemplate.template_version_id,
    template_version: runtimeTemplate.template_version,
    schema_version: runtimeTemplate.schema_version,
    checksum: runtimeTemplate.checksum,
    sections
  };
}

export function createFieldValues(fields: OetsField[]) {
  return Object.fromEntries(
    orderedPayloadFields(fields).map((field) => [
      field.field_code,
      defaultFieldValue(field)
    ])
  );
}

export function orderedSections(definition: OetsDefinition) {
  return [...definition.sections]
    .filter((section) => section.visible !== false)
    .sort((left, right) => left.sequence - right.sequence);
}

export function orderedFields(fields: OetsField[]) {
  return [...fields]
    .filter((field) => field.visible)
    .sort((left, right) => left.sequence - right.sequence);
}

export function repeatableConstraints(section: OetsSection) {
  const value = section.metadata?.repeatable_constraints;
  const constraints = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  const minimum = constraints.minimum_instances;
  const maximum = constraints.maximum_instances;
  return {
    minimumInstances: Number.isInteger(minimum) && (minimum as number) >= 0
      ? minimum as number
      : 1,
    maximumInstances: Number.isInteger(maximum) && (maximum as number) >= 1
      ? maximum as number
      : null
  };
}

export function createRepeatableSectionInstance(section: OetsSection, index: number) {
  const values = createFieldValues(section.fields);
  const identity = section.fields.find(isPersistedTechnicalRowIdentity);
  return {
    key: identity ? repeatableInstanceKey(section, values, index) : crypto.randomUUID(),
    values
  };
}

function orderedPayloadFields(fields: OetsField[]) {
  return [...fields]
    .filter((field) => field.visible || isPersistedTechnicalRowIdentity(field))
    .sort((left, right) => left.sequence - right.sequence);
}

function repeatableInstanceKey(
  section: OetsSection,
  values: Record<string, OetsFieldValue>,
  index: number
) {
  const identity = section.fields.find(isPersistedTechnicalRowIdentity);
  const value = identity ? values[identity.field_code] : null;
  return typeof value === "string" && value.length > 0
    ? value
    : `${section.section_code}-${index + 1}`;
}

function isPersistedTechnicalRowIdentity(field: OetsField) {
  return field.metadata?.persist_hidden === true &&
    field.metadata?.technical_row_identity === "CLIENT_GENERATED_UUID_V1";
}

function orderedFieldValues(
  fields: OetsField[],
  values: Record<string, OetsFieldValue>
) {
  return Object.fromEntries(
    orderedPayloadFields(fields).map((field) => [
      field.field_code,
      typedFieldValue(field, values[field.field_code] ?? defaultFieldValue(field))
    ])
  );
}

export function createEvidenceStateFromPayload(
  definition: OetsDefinition,
  payload: Pick<OetsEvidencePayload, "sections">
): EditableOetsState {
  return Object.fromEntries(
    orderedSections(definition).map((section) => {
      const sectionPayload = payload.sections[section.section_code];

      if (section.repeatable) {
        const instances = Array.isArray(sectionPayload) ? sectionPayload : [];

        return [
          section.section_code,
          instances.map((values, index) => {
            const instanceValues = {
              ...createFieldValues(section.fields),
              ...values
            };
            return {
              key: repeatableInstanceKey(section, instanceValues, index),
              values: instanceValues
            };
          })
        ];
      }

      return [
        section.section_code,
        {
          ...createFieldValues(section.fields),
          ...(!Array.isArray(sectionPayload) && sectionPayload
            ? sectionPayload
            : {})
        }
      ];
    })
  );
}

function typedFieldValue(field: OetsField, value: OetsFieldValue): OetsFieldValue {
  if (field.field_type !== "NUMBER" && field.field_type !== "DECIMAL") {
    return value;
  }

  if (value === null || value === "") {
    return null;
  }

  if (typeof value === "number") {
    return value;
  }

  if (typeof value !== "string") {
    return value;
  }

  const trimmedValue = value.trim();

  if (trimmedValue.length === 0) {
    return null;
  }

  const numericValue = Number(trimmedValue);

  return Number.isFinite(numericValue) ? numericValue : value;
}

function defaultFieldValue(field: OetsField): OetsFieldValue {
  if (isPersistedTechnicalRowIdentity(field)) {
    return crypto.randomUUID();
  }

  if (field.field_type === "BOOLEAN" || field.field_type === "CHECKBOX") {
    return false;
  }

  if (field.field_type === "MULTISELECT") {
    return [];
  }

  return null;
}
