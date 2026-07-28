import {
  OetsDefinition,
  OetsEvidencePayload,
  OetsField,
  OetsFieldValue,
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
      const values = createFieldValues(section.fields);

      if (section.repeatable) {
        return [
          section.section_code,
          [
            {
              key: `${section.section_code}-1`,
              values
            }
          ]
        ];
      }

      return [section.section_code, values];
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
    orderedFields(fields).map((field) => [
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

function orderedFieldValues(
  fields: OetsField[],
  values: Record<string, OetsFieldValue>
) {
  return Object.fromEntries(
    orderedFields(fields).map((field) => [
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
          instances.map((values, index) => ({
            key: `${section.section_code}-${index + 1}`,
            values: {
              ...createFieldValues(section.fields),
              ...values
            }
          }))
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
  if (field.field_type === "BOOLEAN" || field.field_type === "CHECKBOX") {
    return false;
  }

  if (field.field_type === "MULTISELECT") {
    return [];
  }

  return null;
}
