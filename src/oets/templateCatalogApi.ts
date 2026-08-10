import { apiRequest } from "../api/client";

export interface OetsTemplateCatalogFilter {
  module?: string;
}

export interface OetsTemplateCatalogBusinessContext {
  enterprise_capability: string | null;
  supporting_capabilities: string[] | null;
  operational_domain: string | null;
  business_process: string | null;
  evidence_type: string | null;
  governance_scope: string | null;
  description: string | null;
}

export interface OetsTemplateCatalogItem {
  template_registry_id: string;
  template_version_id: string;
  template_code: string;
  template_name: string;
  template_archetype: string;
  module: string;
  template_version: string;
  schema_version: string;
  checksum: string;
  registry_status: "ACTIVE";
  version_status: "ACTIVE";
  description: string | null;
  business_context: OetsTemplateCatalogBusinessContext | null;
  document_number: string | null;
  document_revision: string | null;
  registered_at: string;
  last_synchronized_at: string | null;
}

export interface OetsTemplateCatalogResponse {
  templates: OetsTemplateCatalogItem[];
}

export function listOetsTemplateCatalog(
  filters: OetsTemplateCatalogFilter = {}
) {
  return apiRequest<OetsTemplateCatalogResponse>(
    buildTemplateCatalogPath(filters),
    {
      validate: isOetsTemplateCatalogResponse
    }
  );
}

function buildTemplateCatalogPath(filters: OetsTemplateCatalogFilter) {
  const searchParams = new URLSearchParams();

  if (filters.module) {
    searchParams.set("module", filters.module);
  }

  const query = searchParams.toString();

  return `/api/v1/operational-evidence/templates${query ? `?${query}` : ""}`;
}

function isOetsTemplateCatalogResponse(
  value: unknown
): value is OetsTemplateCatalogResponse {
  return (
    isRecord(value) &&
    Array.isArray(value.templates) &&
    value.templates.every(isOetsTemplateCatalogItem)
  );
}

function isOetsTemplateCatalogItem(
  value: unknown
): value is OetsTemplateCatalogItem {
  return (
    isRecord(value) &&
    typeof value.template_registry_id === "string" &&
    typeof value.template_version_id === "string" &&
    typeof value.template_code === "string" &&
    typeof value.template_name === "string" &&
    typeof value.template_archetype === "string" &&
    typeof value.module === "string" &&
    typeof value.template_version === "string" &&
    typeof value.schema_version === "string" &&
    typeof value.checksum === "string" &&
    value.registry_status === "ACTIVE" &&
    value.version_status === "ACTIVE" &&
    isNullableString(value.description) &&
    (value.business_context === null ||
      isOetsTemplateCatalogBusinessContext(value.business_context)) &&
    isNullableString(value.document_number) &&
    isNullableString(value.document_revision) &&
    typeof value.registered_at === "string" &&
    isNullableString(value.last_synchronized_at)
  );
}

function isOetsTemplateCatalogBusinessContext(
  value: unknown
): value is OetsTemplateCatalogBusinessContext {
  return (
    isRecord(value) &&
    isNullableString(value.enterprise_capability) &&
    (value.supporting_capabilities === null ||
      (Array.isArray(value.supporting_capabilities) &&
        value.supporting_capabilities.every(
          (item) => typeof item === "string"
        ))) &&
    isNullableString(value.operational_domain) &&
    isNullableString(value.business_process) &&
    isNullableString(value.evidence_type) &&
    isNullableString(value.governance_scope) &&
    isNullableString(value.description)
  );
}

function isNullableString(value: unknown) {
  return typeof value === "string" || value === null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
