export const auditStatuses = [
  "DRAFT",
  "IN_PROGRESS",
  "SUBMITTED",
  "REVIEWED",
  "APPROVED",
  "REJECTED"
] as const;

export type AuditStatus = (typeof auditStatuses)[number];

export const auditTemplateTypes = ["FULL_SAFETY_AUDIT", "OPENING_CHECKLIST", "CLOSING_CHECKLIST"] as const;
export type AuditTemplateType = (typeof auditTemplateTypes)[number];

export const auditFacilityStatuses = ["ACTIVE", "INACTIVE", "UNDER_MAINTENANCE", "PENDING_APPROVAL", "SUSPENDED"] as const;
export type AuditFacilityStatus = (typeof auditFacilityStatuses)[number];

export const auditFindingSeverities = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
export type AuditFindingSeverity = (typeof auditFindingSeverities)[number];

export const auditExecutionFieldTypes = ["boolean", "compliance_check", "text", "textarea", "select", "date", "signature", "percentage", "risk_matrix", "findings_workspace", "corrective_action_workspace"] as const;
export type AuditExecutionFieldType = (typeof auditExecutionFieldTypes)[number];
export const auditExecutionEditAuthorities = ["USER_RESPONSE", "SYSTEM_READ_ONLY"] as const;
export type AuditExecutionEditAuthority = (typeof auditExecutionEditAuthorities)[number];
export const auditExecutionResponseKinds = ["BOOLEAN", "TEXT", "SELECT", "DATE", "ACKNOWLEDGEMENT_TRUE", "NONE"] as const;
export type AuditExecutionResponseKind = (typeof auditExecutionResponseKinds)[number];

export interface AuditExecutionField {
  readonly field_id: string;
  readonly label: string;
  readonly type: AuditExecutionFieldType;
  readonly required: boolean;
  readonly source_required: boolean;
  readonly edit_authority: AuditExecutionEditAuthority;
  readonly response_kind: AuditExecutionResponseKind;
  readonly options?: readonly string[];
  readonly system_generated?: true;
  readonly risk_categories?: readonly string[];
  readonly supports_justification?: boolean;
  readonly severity?: AuditFindingSeverity;
  readonly columns?: readonly string[];
  readonly supports_notes?: boolean;
  readonly supports_evidence?: boolean;
  readonly failure_creates_finding?: boolean;
  readonly scorable?: boolean;
  readonly weight?: number;
  readonly placeholder?: string;
}

export interface AuditExecutionSection { readonly section_code: string; readonly title: string; readonly description?: string; readonly fields: readonly AuditExecutionField[]; }
export interface AuditExecutionSchema { readonly sections: readonly AuditExecutionSection[]; }
export interface AuditExecutionDefinition { readonly template_id: string; readonly version: number; readonly checksum: string; readonly schema: AuditExecutionSchema; }
export interface AuditCanonicalResponse { readonly id: string; readonly audit_id: string; readonly template_id: string; readonly section_code: string; readonly response_payload: Readonly<Record<string, unknown>>; readonly version: number; readonly checksum: string; readonly submitted_at: string; }
export type AuditExecutionSourceCondition = "FAILING" | "PASSING" | "UNKNOWN";
export interface AuditExecutionFinding { readonly id: string; readonly business_identifier: string; readonly is_resolved: boolean; readonly source_section_code: string; readonly source_field_id: string; readonly source_condition: AuditExecutionSourceCondition; }
export interface AuditCompleteness { readonly is_complete: boolean; readonly incomplete: readonly { readonly section_code: string; readonly field_id: string }[]; }
export interface AuditExecutionProjection { readonly audit: AuditReadProjection; readonly definition: AuditExecutionDefinition; readonly responses: readonly AuditCanonicalResponse[]; readonly findings: readonly AuditExecutionFinding[]; readonly completeness: AuditCompleteness; readonly completion_eligible: boolean; readonly legacy_history_excluded: true; }
export interface AuditResponseCommandResult { readonly response: AuditCanonicalResponse; readonly completeness: AuditCompleteness; }
export interface AuditCompletionResult { readonly audit: AuditReadProjection; readonly findings: readonly AuditExecutionFinding[]; readonly replayed: boolean; }
export interface AuditBackendErrorEnvelope { readonly statusCode: number; readonly code: string; readonly message: string; }

export function isAuditExecutionProjection(value: unknown): value is AuditExecutionProjection {
  return isRecord(value) && isAuditReadProjection(value.audit) && isAuditExecutionDefinition(value.definition) && Array.isArray(value.responses) && value.responses.every(isAuditCanonicalResponse) && Array.isArray(value.findings) && value.findings.every(isAuditExecutionFinding) && isAuditCompleteness(value.completeness) && typeof value.completion_eligible === "boolean" && value.legacy_history_excluded === true;
}

export function isAuditResponseCommandResult(value: unknown): value is AuditResponseCommandResult {
  return isRecord(value) && isAuditCanonicalResponse(value.response) && isAuditCompleteness(value.completeness);
}

export function isAuditCompletionResult(value: unknown): value is AuditCompletionResult {
  return isRecord(value) && isAuditReadProjection(value.audit) && Array.isArray(value.findings) && value.findings.every(isAuditExecutionFinding) && typeof value.replayed === "boolean";
}

function isAuditExecutionDefinition(value: unknown): value is AuditExecutionDefinition {
  return isRecord(value) && isUuid(value.template_id) && Number.isInteger(value.version) && Number(value.version) >= 1 && typeof value.checksum === "string" && /^[0-9a-f]{64}$/.test(value.checksum) && isAuditExecutionSchema(value.schema);
}

function isAuditExecutionSchema(value: unknown): value is AuditExecutionSchema {
  if (!isRecord(value) || !Array.isArray(value.sections) || value.sections.length === 0 || !value.sections.every(isAuditExecutionSection)) return false;
  return new Set(value.sections.map((section) => section.section_code)).size === value.sections.length;
}

function isAuditExecutionSection(value: unknown): value is AuditExecutionSection {
  if (!isRecord(value) || !isNonEmptyString(value.section_code) || !isNonEmptyString(value.title) || (value.description !== undefined && !isNonEmptyString(value.description)) || !Array.isArray(value.fields) || value.fields.length === 0 || !value.fields.every(isAuditExecutionField)) return false;
  return new Set(value.fields.map((field) => field.field_id)).size === value.fields.length;
}

function isAuditExecutionField(value: unknown): value is AuditExecutionField {
  if (!isRecord(value) || !isNonEmptyString(value.field_id) || !isNonEmptyString(value.label) || typeof value.type !== "string" || !auditExecutionFieldTypes.includes(value.type as AuditExecutionFieldType) || typeof value.required !== "boolean" || typeof value.source_required !== "boolean" || typeof value.edit_authority !== "string" || !auditExecutionEditAuthorities.includes(value.edit_authority as AuditExecutionEditAuthority) || typeof value.response_kind !== "string" || !auditExecutionResponseKinds.includes(value.response_kind as AuditExecutionResponseKind)) return false;
  if (!optionalBooleans(value, ["supports_justification", "supports_notes", "supports_evidence", "failure_creates_finding", "scorable"]) || (value.weight !== undefined && (typeof value.weight !== "number" || !Number.isFinite(value.weight))) || (value.placeholder !== undefined && !isNonEmptyString(value.placeholder))) return false;
  const type = value.type as AuditExecutionFieldType;
  const readOnly = value.edit_authority === "SYSTEM_READ_ONLY";
  if (readOnly !== (value.response_kind === "NONE") || (readOnly && value.required) || (value.system_generated !== undefined && value.system_generated !== true)) return false;
  if (type === "boolean" || type === "compliance_check") return !readOnly && value.response_kind === "BOOLEAN";
  if (type === "text" || type === "textarea") return !readOnly && value.response_kind === "TEXT";
  if (type === "date") return !readOnly && value.response_kind === "DATE";
  if (type === "signature") return !readOnly && value.response_kind === "ACKNOWLEDGEMENT_TRUE";
  if (type === "select") return isUniqueStringList(value.options) && (value.system_generated === true ? readOnly : !readOnly && value.response_kind === "SELECT");
  if (type === "percentage") return readOnly && value.system_generated === true;
  if (type === "risk_matrix") return readOnly && isUniqueStringList(value.risk_categories) && typeof value.supports_justification === "boolean";
  if (type === "findings_workspace") return readOnly && typeof value.severity === "string" && auditFindingSeverities.includes(value.severity as AuditFindingSeverity);
  return readOnly && isUniqueStringList(value.columns);
}

function isAuditCanonicalResponse(value: unknown): value is AuditCanonicalResponse {
  return isRecord(value) && isUuid(value.id) && isUuid(value.audit_id) && isUuid(value.template_id) && isNonEmptyString(value.section_code) && isRecord(value.response_payload) && Number.isInteger(value.version) && Number(value.version) >= 1 && typeof value.checksum === "string" && /^[0-9a-f]{64}$/.test(value.checksum) && isDateTime(value.submitted_at);
}

function isAuditExecutionFinding(value: unknown): value is AuditExecutionFinding {
  return isRecord(value) && isUuid(value.id) && isNonEmptyString(value.business_identifier) && typeof value.is_resolved === "boolean" && isNonEmptyString(value.source_section_code) && isNonEmptyString(value.source_field_id) && typeof value.source_condition === "string" && ["FAILING", "PASSING", "UNKNOWN"].includes(value.source_condition);
}

function isAuditCompleteness(value: unknown): value is AuditCompleteness {
  return isRecord(value) && typeof value.is_complete === "boolean" && Array.isArray(value.incomplete) && value.incomplete.every((item) => isRecord(item) && isNonEmptyString(item.section_code) && isNonEmptyString(item.field_id));
}

function isUniqueStringList(value: unknown): value is readonly string[] { return Array.isArray(value) && value.length > 0 && value.every(isNonEmptyString) && new Set(value).size === value.length; }
function optionalBooleans(value: Record<string, unknown>, keys: readonly string[]) { return keys.every((key) => value[key] === undefined || typeof value[key] === "boolean"); }

export interface AuditFindingReadProjection {
  readonly id: string;
  readonly business_identifier: string;
  readonly audit: { readonly id: string; readonly business_identifier: string };
  readonly facility: { readonly id: string; readonly business_identifier: string; readonly name: string };
  readonly client: { readonly id: string; readonly business_identifier: string; readonly name: string };
  readonly category: string;
  readonly severity: AuditFindingSeverity;
  readonly title: string;
  readonly description: string;
  readonly recommendation: string | null;
  readonly is_resolved: boolean;
  readonly identified_at: string;
  readonly resolved_at: string | null;
  readonly remediation: readonly {
    readonly id: string;
    readonly business_identifier: string;
    readonly status: string;
  }[];
}

export interface AuditFindingListResponse {
  readonly findings: readonly AuditFindingReadProjection[];
}

export function isAuditFindingListResponse(value: unknown): value is AuditFindingListResponse {
  return isRecord(value) && Array.isArray(value.findings) && value.findings.every(isAuditFindingReadProjection);
}

export function isAuditFindingReadProjection(value: unknown): value is AuditFindingReadProjection {
  return (
    isRecord(value) &&
    isUuid(value.id) &&
    isNonEmptyString(value.business_identifier) &&
    isAuditReference(value.audit) &&
    isGovernedReference(value.facility) &&
    isGovernedReference(value.client) &&
    isNonEmptyString(value.category) &&
    typeof value.severity === "string" &&
    auditFindingSeverities.includes(value.severity as AuditFindingSeverity) &&
    isNonEmptyString(value.title) &&
    isNonEmptyString(value.description) &&
    (value.recommendation === null || typeof value.recommendation === "string") &&
    typeof value.is_resolved === "boolean" &&
    isDateTime(value.identified_at) &&
    (value.resolved_at === null || isDateTime(value.resolved_at)) &&
    Array.isArray(value.remediation) &&
    value.remediation.every(isRemediationReference)
  );
}

export interface AuditTemplateSelector {
  readonly id: string;
  readonly name: string;
  readonly type: AuditTemplateType;
  readonly version: number;
  readonly description: string | null;
  readonly is_active: true;
}

export interface AuditEligibleFacility {
  readonly id: string;
  readonly business_identifier: string;
  readonly name: string;
  readonly operational_status: AuditFacilityStatus;
  readonly client: {
    readonly id: string;
    readonly business_identifier: string;
    readonly name: string;
  };
}

export interface AuditEligibleFacilityList {
  readonly facilities: readonly AuditEligibleFacility[];
}

export function isAuditTemplateList(value: unknown): value is readonly AuditTemplateSelector[] {
  return Array.isArray(value) && value.every(isAuditTemplateSelector);
}

export function isAuditEligibleFacilityList(value: unknown): value is AuditEligibleFacilityList {
  return isRecord(value) && Array.isArray(value.facilities) && value.facilities.every(isAuditEligibleFacility);
}

export function displayCode(value: string) {
  return value.toLowerCase().split("_").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}

export function formatDateTime(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export interface AuditReadProjection {
  readonly id: string;
  readonly business_identifier: string;
  readonly audit_status: AuditStatus;
  readonly started_at: string;
  readonly completed_at: string | null;
  readonly template: {
    readonly id: string;
    readonly name: string;
    readonly type: string;
    readonly version: number;
  };
  readonly facility: {
    readonly id: string;
    readonly business_identifier: string;
    readonly name: string;
  };
  readonly client: {
    readonly id: string;
    readonly business_identifier: string;
    readonly name: string;
  };
  readonly auditor: {
    readonly id: string;
    readonly name: string;
  } | null;
}

export interface AuditListResponse {
  readonly audits: readonly AuditReadProjection[];
}

export function isAuditListResponse(value: unknown): value is AuditListResponse {
  return isRecord(value) && Array.isArray(value.audits) && value.audits.every(isAuditReadProjection);
}

export function isAuditReadProjection(value: unknown): value is AuditReadProjection {
  return (
    isRecord(value) &&
    isUuid(value.id) &&
    isNonEmptyString(value.business_identifier) &&
    isAuditStatus(value.audit_status) &&
    isDateTime(value.started_at) &&
    (value.completed_at === null || isDateTime(value.completed_at)) &&
    isTemplateReference(value.template) &&
    isGovernedReference(value.facility) &&
    isGovernedReference(value.client) &&
    (value.auditor === null || isNamedUuidReference(value.auditor))
  );
}

function isTemplateReference(value: unknown) {
  return (
    isNamedUuidReference(value) &&
    isRecord(value) &&
    isNonEmptyString(value.type) &&
    Number.isInteger(value.version) &&
    (value.version as number) >= 1
  );
}

function isGovernedReference(value: unknown) {
  return isNamedUuidReference(value) && isRecord(value) && isNonEmptyString(value.business_identifier);
}

function isNamedUuidReference(value: unknown) {
  return isRecord(value) && isUuid(value.id) && isNonEmptyString(value.name);
}

function isAuditStatus(value: unknown): value is AuditStatus {
  return typeof value === "string" && auditStatuses.includes(value as AuditStatus);
}

function isAuditReference(value: unknown) {
  return isRecord(value) && isUuid(value.id) && isNonEmptyString(value.business_identifier);
}

function isRemediationReference(value: unknown) {
  return isRecord(value) && isUuid(value.id) && isNonEmptyString(value.business_identifier) && isNonEmptyString(value.status);
}

function isAuditTemplateSelector(value: unknown): value is AuditTemplateSelector {
  return (
    isNamedUuidReference(value) &&
    isRecord(value) &&
    typeof value.type === "string" &&
    auditTemplateTypes.includes(value.type as AuditTemplateType) &&
    Number.isInteger(value.version) &&
    (value.version as number) >= 1 &&
    (value.description === null || typeof value.description === "string") &&
    value.is_active === true
  );
}

function isAuditEligibleFacility(value: unknown): value is AuditEligibleFacility {
  return (
    isGovernedReference(value) &&
    isRecord(value) &&
    typeof value.operational_status === "string" &&
    auditFacilityStatuses.includes(value.operational_status as AuditFacilityStatus) &&
    isGovernedReference(value.client)
  );
}

function isUuid(value: unknown) {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function isDateTime(value: unknown) {
  return typeof value === "string" && value.length > 0 && !Number.isNaN(Date.parse(value));
}

function isNonEmptyString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
