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
