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
