export type SupportedOetsFieldType =
  | "BOOLEAN"
  | "CHECKBOX"
  | "DATE"
  | "DECIMAL"
  | "EMAIL"
  | "MULTISELECT"
  | "NUMBER"
  | "PHONE"
  | "RADIO"
  | "SELECT"
  | "SIGNATURE"
  | "TEXT"
  | "TEXTAREA"
  | "TIME"
  | "URL";

export interface OetsOption {
  label: string;
  value: string;
  default?: boolean;
  sequence?: number;
}

export interface OetsField {
  field_id: string;
  field_code: string;
  label: string;
  field_type: SupportedOetsFieldType | string;
  required: boolean;
  readonly: boolean;
  visible: boolean;
  sequence: number;
  description?: string;
  placeholder?: string;
  help_text?: string;
  validation?: Record<string, unknown>;
  options?: OetsOption[];
  metadata?: Record<string, unknown>;
}

export interface OetsSection {
  section_id: string;
  section_code: string;
  title: string;
  sequence: number;
  fields: OetsField[];
  description?: string;
  visible?: boolean;
  repeatable?: boolean;
  metadata?: Record<string, unknown>;
}

export interface OetsDefinition {
  schema_version: string;
  template_metadata: {
    template_id: string;
    template_code: string;
    template_name: string;
    module: string;
    version: string;
    [key: string]: unknown;
  };
  sections: OetsSection[];
  workflow?: Record<string, unknown>;
  relationships?: unknown;
  automation?: unknown;
  business_context?: Record<string, unknown>;
  version_information?: Record<string, unknown>;
  extensions?: Record<string, unknown>;
}

export interface OetsTemplateRuntimeDefinition {
  template_registry_id: string;
  template_version_id: string;
  template_code: string;
  template_archetype: string;
  template_version: string;
  schema_version: string;
  checksum: string;
  status: string;
  definition_jsonb: unknown;
  field_authority: OetsFieldAuthorityPresentation;
}

export type OetsFieldAuthorityKind =
  | "OPERATOR_RECORDED"
  | "CONTEXT_PROJECTED"
  | "SERVER_GENERATED"
  | "SERVER_CALCULATED"
  | "STATIC_CONTENT"
  | "TECHNICAL_IDENTITY"
  | "GOVERNED_ATTESTATION"
  | "ATTESTATION_PROJECTED"
  | "DOWNSTREAM_UNAVAILABLE";

export type OetsFieldAuthorityState = "DECLARED" | "EFFECTIVE" | "UNAVAILABLE";
export type OetsFieldAuthorityDisposition =
  | "ACTIVE"
  | "FORMULA_ABSENT"
  | "SEMANTICS_BLOCKED"
  | "CONTEXT_BLOCKED"
  | "DOWNSTREAM_UNAVAILABLE"
  | "RETIRED_STATIC_NOTE"
  | "INTENTIONALLY_UNUSED"
  | "UNAVAILABLE_POST_ISSUANCE"
  | "TEMPLATE_READ_ONLY_UNCLASSIFIED";
export type OetsFieldAuthorityEditability = "EDITABLE" | "READ_ONLY" | "ACTION_CONTROLLED" | "UNAVAILABLE";
export type OetsFieldAuthorityReasonCode =
  | "OPERATOR_RECORDED"
  | "OPERATOR_RECORDED_FORMULA_ABSENT"
  | "OPERATOR_RECORDED_SEMANTICS_BLOCKED"
  | "OPERATOR_RECORDED_CONTEXT_BLOCKED"
  | "TEMPLATE_READ_ONLY_AUTHORITY_UNCLASSIFIED"
  | "GOVERNED_CONTEXT_PROJECTION_DECLARED"
  | "GOVERNED_CONTEXT_PROJECTION_EFFECTIVE"
  | "GOVERNED_AGGREGATE_PROJECTION"
  | "GENERATED_AT_DRAFT_CREATION"
  | "GENERATED_TEMPORAL_VALUE"
  | "GOVERNED_ASSIGNED_ROLE_PROJECTION"
  | "STATIC_TEMPLATE_CONTENT"
  | "STATIC_CERTIFICATION_TEXT"
  | "TECHNICAL_ROW_IDENTITY"
  | "CALCULATED_BY_SERVER"
  | "GOVERNED_ATTESTATION_ACTION"
  | "DERIVED_FROM_GOVERNED_ATTESTATION"
  | "GOVERNED_ARTIFACT_DEFERRED"
  | "DOWNSTREAM_UNAVAILABLE"
  | "RETIRED_STATIC_NOTE"
  | "INTENTIONALLY_UNUSED"
  | "UNAVAILABLE_POST_ISSUANCE";

export interface OetsFieldAuthorityPresentationField {
  section_code: string;
  field_id: string;
  field_code: string;
  repeatable: boolean;
  visible: boolean;
  authority_kind: OetsFieldAuthorityKind;
  authority_state: OetsFieldAuthorityState;
  disposition: OetsFieldAuthorityDisposition;
  presentation_editability: OetsFieldAuthorityEditability;
  reason_code: OetsFieldAuthorityReasonCode;
}

export interface OetsFieldAuthorityPresentation {
  projection_version: "OETS_FIELD_AUTHORITY_PRESENTATION_V1";
  template_code: string;
  template_version: string;
  template_version_id: string | null;
  fields: OetsFieldAuthorityPresentationField[];
  projection_checksum: string;
}

export type OetsFieldValue = string | number | boolean | string[] | null;

export type OetsSectionValues =
  | Record<string, OetsFieldValue>
  | Array<Record<string, OetsFieldValue>>;

export interface OetsEvidencePayload {
  template_code: string;
  template_version_id: string;
  template_version: string;
  schema_version: string;
  checksum: string;
  sections: Record<string, OetsSectionValues>;
}
