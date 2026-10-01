import {
  OetsDefinition,
  OetsFieldAuthorityPresentation,
  OetsField,
  OetsOption,
  OetsSection,
  OetsTemplateRuntimeDefinition,
  SupportedOetsFieldType
} from "./types";

const supportedFieldTypes = new Set<SupportedOetsFieldType>([
  "BOOLEAN",
  "CHECKBOX",
  "DATE",
  "DECIMAL",
  "EMAIL",
  "MULTISELECT",
  "NUMBER",
  "PHONE",
  "RADIO",
  "SELECT",
  "SIGNATURE",
  "TEXT",
  "TEXTAREA",
  "TIME",
  "URL"
]);

export function isOetsTemplateRuntimeDefinition(
  value: unknown
): value is OetsTemplateRuntimeDefinition {
  return (
    isRecord(value) &&
    isNonEmptyString(value.template_registry_id) &&
    isNonEmptyString(value.template_version_id) &&
    isNonEmptyString(value.template_code) &&
    isNonEmptyString(value.template_archetype) &&
    isNonEmptyString(value.template_version) &&
    isNonEmptyString(value.schema_version) &&
    isNonEmptyString(value.checksum) &&
    isNonEmptyString(value.status) &&
    "definition_jsonb" in value &&
    isOetsFieldAuthorityPresentation(value.field_authority)
  );
}

const authorityKinds = new Set(["OPERATOR_RECORDED", "CONTEXT_PROJECTED", "SERVER_GENERATED", "SERVER_CALCULATED", "GOVERNED_ATTESTATION", "ATTESTATION_PROJECTED", "DOWNSTREAM_UNAVAILABLE"]);
const authorityStates = new Set(["DECLARED", "EFFECTIVE", "UNAVAILABLE"]);
const authorityDispositions = new Set(["ACTIVE", "FORMULA_ABSENT", "SEMANTICS_BLOCKED", "CONTEXT_BLOCKED", "UNAVAILABLE_POST_ISSUANCE", "TEMPLATE_READ_ONLY_UNCLASSIFIED"]);
const authorityEditability = new Set(["EDITABLE", "READ_ONLY", "ACTION_CONTROLLED", "UNAVAILABLE"]);
const authorityReasonCodes = new Set(["OPERATOR_RECORDED", "OPERATOR_RECORDED_FORMULA_ABSENT", "OPERATOR_RECORDED_SEMANTICS_BLOCKED", "OPERATOR_RECORDED_CONTEXT_BLOCKED", "TEMPLATE_READ_ONLY_AUTHORITY_UNCLASSIFIED", "GOVERNED_CONTEXT_PROJECTION_DECLARED", "GOVERNED_CONTEXT_PROJECTION_EFFECTIVE", "GOVERNED_AGGREGATE_PROJECTION", "GENERATED_AT_DRAFT_CREATION", "CALCULATED_BY_SERVER", "GOVERNED_ATTESTATION_ACTION", "DERIVED_FROM_GOVERNED_ATTESTATION", "GOVERNED_ARTIFACT_DEFERRED", "UNAVAILABLE_POST_ISSUANCE"]);

export function isOetsFieldAuthorityPresentation(value: unknown): value is OetsFieldAuthorityPresentation {
  return isRecord(value) &&
    value.projection_version === "OETS_FIELD_AUTHORITY_PRESENTATION_V1" &&
    isNonEmptyString(value.template_code) &&
    isNonEmptyString(value.template_version) &&
    (value.template_version_id === null || isNonEmptyString(value.template_version_id)) &&
    Array.isArray(value.fields) && value.fields.every((field) =>
      isRecord(field) &&
      isNonEmptyString(field.section_code) &&
      isNonEmptyString(field.field_id) &&
      isNonEmptyString(field.field_code) &&
      typeof field.repeatable === "boolean" &&
      typeof field.visible === "boolean" &&
      authorityKinds.has(String(field.authority_kind)) &&
      authorityStates.has(String(field.authority_state)) &&
      authorityDispositions.has(String(field.disposition)) &&
      authorityEditability.has(String(field.presentation_editability)) &&
      authorityReasonCodes.has(String(field.reason_code))
    ) &&
    typeof value.projection_checksum === "string" && /^[a-f0-9]{64}$/.test(value.projection_checksum);
}

export interface DefinitionNarrowingResult {
  definition?: OetsDefinition;
  errors: string[];
  warnings: string[];
}

export function narrowOetsDefinition(value: unknown): DefinitionNarrowingResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!isRecord(value)) {
    return { errors: ["definition_jsonb must be a JSON object."], warnings };
  }

  const schemaVersion = readString(value.schema_version, "schema_version", errors);
  const metadata = isRecord(value.template_metadata)
    ? value.template_metadata
    : undefined;

  if (!metadata) {
    errors.push("template_metadata must be a JSON object.");
  }

  const sectionsValue = value.sections;

  if (!Array.isArray(sectionsValue) || sectionsValue.length === 0) {
    errors.push("sections must be a non-empty array.");
  }

  if (errors.length > 0 || !metadata || !Array.isArray(sectionsValue)) {
    return { errors, warnings };
  }

  const templateMetadata = {
    template_id: readString(
      metadata.template_id,
      "template_metadata.template_id",
      errors
    ),
    template_code: readString(
      metadata.template_code,
      "template_metadata.template_code",
      errors
    ),
    template_name: readString(
      metadata.template_name,
      "template_metadata.template_name",
      errors
    ),
    module: readString(metadata.module, "template_metadata.module", errors),
    version: readString(metadata.version, "template_metadata.version", errors),
    ...metadata
  };
  const sections = sectionsValue.flatMap((sectionValue, index) =>
    narrowSection(sectionValue, index, errors, warnings)
  );

  if (errors.length > 0) {
    return { errors, warnings };
  }

  const definition: OetsDefinition = {
    schema_version: schemaVersion,
    template_metadata: templateMetadata,
    sections,
    workflow: isRecord(value.workflow) ? value.workflow : undefined,
    relationships: value.relationships,
    automation: value.automation,
    business_context: isRecord(value.business_context)
      ? value.business_context
      : undefined,
    version_information: isRecord(value.version_information)
      ? value.version_information
      : undefined,
    extensions: isRecord(value.extensions) ? value.extensions : undefined
  };

  return { definition, errors, warnings };
}

export function isSupportedOetsFieldType(
  value: string
): value is SupportedOetsFieldType {
  return supportedFieldTypes.has(value as SupportedOetsFieldType);
}

function narrowSection(
  value: unknown,
  index: number,
  errors: string[],
  warnings: string[]
) {
  const path = `sections[${index}]`;

  if (!isRecord(value)) {
    errors.push(`${path} must be a JSON object.`);
    return [];
  }

  const fieldsValue = value.fields;

  if (!Array.isArray(fieldsValue) || fieldsValue.length === 0) {
    errors.push(`${path}.fields must be a non-empty array.`);
    return [];
  }

  const fields = fieldsValue.flatMap((fieldValue, fieldIndex) =>
    narrowField(fieldValue, `${path}.fields[${fieldIndex}]`, errors, warnings)
  );
  const section: OetsSection = {
    section_id: readString(value.section_id, `${path}.section_id`, errors),
    section_code: readString(value.section_code, `${path}.section_code`, errors),
    title: readString(value.title, `${path}.title`, errors),
    sequence: readNumber(value.sequence, `${path}.sequence`, errors),
    fields,
    description: readOptionalString(value.description),
    visible: readOptionalBoolean(value.visible),
    repeatable: readOptionalBoolean(value.repeatable),
    metadata: isRecord(value.metadata) ? value.metadata : undefined
  };

  return [section];
}

function narrowField(
  value: unknown,
  path: string,
  errors: string[],
  warnings: string[]
) {
  if (!isRecord(value)) {
    errors.push(`${path} must be a JSON object.`);
    return [];
  }

  const fieldType = readString(value.field_type, `${path}.field_type`, errors);

  if (fieldType && !isSupportedOetsFieldType(fieldType)) {
    warnings.push(`${path} uses unsupported field_type ${fieldType}.`);
  }
  collectFieldWarnings(value, path, warnings);

  const field: OetsField = {
    field_id: readString(value.field_id, `${path}.field_id`, errors),
    field_code: readString(value.field_code, `${path}.field_code`, errors),
    label: readString(value.label, `${path}.label`, errors),
    field_type: fieldType,
    required: readBoolean(value.required, `${path}.required`, errors),
    readonly: readBoolean(value.readonly, `${path}.readonly`, errors),
    visible: readBoolean(value.visible, `${path}.visible`, errors),
    sequence: readNumber(value.sequence, `${path}.sequence`, errors),
    description: readOptionalString(value.description),
    placeholder: readOptionalString(value.placeholder),
    help_text: readOptionalString(value.help_text),
    validation: isRecord(value.validation) ? value.validation : undefined,
    options: Array.isArray(value.options)
      ? value.options.flatMap((option, optionIndex) =>
          narrowOption(option, `${path}.options[${optionIndex}]`, errors)
        )
      : undefined,
    metadata: isRecord(value.metadata) ? value.metadata : undefined
  };

  return [field];
}

function narrowOption(value: unknown, path: string, errors: string[]) {
  if (!isRecord(value)) {
    errors.push(`${path} must be a JSON object.`);
    return [];
  }

  const option: OetsOption = {
    label: readString(value.label, `${path}.label`, errors),
    value: readString(value.value, `${path}.value`, errors),
    default: readOptionalBoolean(value.default),
    sequence: readOptionalNumber(value.sequence)
  };

  return [option];
}

function readString(value: unknown, path: string, errors: string[]) {
  if (isNonEmptyString(value)) {
    return value;
  }

  errors.push(`${path} must be a non-empty string.`);
  return "";
}

function readNumber(value: unknown, path: string, errors: string[]) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  errors.push(`${path} must be a number.`);
  return 0;
}

function readBoolean(value: unknown, path: string, errors: string[]) {
  if (typeof value === "boolean") {
    return value;
  }

  errors.push(`${path} must be a boolean.`);
  return false;
}

function readOptionalString(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

function readOptionalNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function readOptionalBoolean(value: unknown) {
  return typeof value === "boolean" ? value : undefined;
}

function collectFieldWarnings(
  value: Record<string, unknown>,
  path: string,
  warnings: string[]
) {
  const validation = value.validation;

  if (isRecord(validation) && Array.isArray(validation.rules)) {
    warnings.push(`${path}.validation.rules are backend-authoritative and are not reimplemented in Phase 2.`);
  }

  const metadata = value.metadata;

  if (!isRecord(metadata)) {
    return;
  }

  const unresolvedKeys = Object.keys(metadata).filter((key) =>
    /formula|computed|calculated|generated|threshold|dashboard|workflow|authority/i.test(
      key
    )
  );

  for (const key of unresolvedKeys) {
    warnings.push(`${path}.metadata.${key} is unresolved renderer metadata and is not executed in Phase 2.`);
  }
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
