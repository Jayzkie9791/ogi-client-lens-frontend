export const auditStatuses = [
  "DRAFT",
  "IN_PROGRESS",
  "SUBMITTED",
  "REVIEWED",
  "APPROVED",
  "REJECTED"
] as const;

export type AuditStatus = (typeof auditStatuses)[number];

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
