import { apiRequest } from "../api/client";
import {
  AuditListResponse,
  AuditReadProjection,
  AuditStatus,
  AuditFindingListResponse,
  AuditFindingReadProjection,
  AuditFindingSeverity,
  AuditEligibleFacilityList,
  AuditTemplateSelector,
  isAuditEligibleFacilityList,
  isAuditFindingListResponse,
  isAuditFindingReadProjection,
  isAuditListResponse,
  isAuditReadProjection,
  isAuditTemplateList
} from "./auditRiskTypes";

export interface AuditListFilters {
  readonly status?: AuditStatus;
}

export interface StartAuditCommand {
  readonly templateId: string;
  readonly facilityId: string;
}

export interface AuditFindingListFilters {
  readonly severity?: AuditFindingSeverity;
  readonly resolved?: boolean;
}

export const auditFindingQueryKeys = {
  all: ["audit-findings"] as const,
  list: (filters: AuditFindingListFilters) => ["audit-findings", "list", filters.severity ?? null, filters.resolved ?? null] as const,
  detail: (findingId: string) => ["audit-findings", "detail", findingId] as const
};

export const auditQueryKeys = {
  all: ["audits"] as const,
  lists: ["audits", "list"] as const,
  list: (filters: AuditListFilters) => ["audits", "list", filters.status ?? null] as const,
  detail: (auditId: string) => ["audits", "detail", auditId] as const,
  eligibleFacilities: ["audits", "selectors", "eligible-facilities"] as const,
  templates: ["audits", "selectors", "templates"] as const
};

export function listAudits(filters: AuditListFilters = {}) {
  return apiRequest<AuditListResponse>(buildAuditListPath(filters), {
    validate: isAuditListResponse
  });
}

export function listEligibleAuditFacilities() {
  return apiRequest<AuditEligibleFacilityList>("/api/v1/audits/eligible-facilities", {
    validate: isAuditEligibleFacilityList
  });
}

export function listAuditTemplates() {
  return apiRequest<readonly AuditTemplateSelector[]>("/api/v1/audit-templates", {
    validate: isAuditTemplateList
  });
}

export function startAudit(command: StartAuditCommand, idempotencyKey: string) {
  return apiRequest<AuditReadProjection>("/api/v1/audits/start", {
    method: "POST",
    body: command,
    headers: { "Idempotency-Key": idempotencyKey },
    validate: isAuditReadProjection
  });
}

export function getAudit(auditId: string) {
  return apiRequest<AuditReadProjection>(
    `/api/v1/audits/${encodeURIComponent(auditId)}`,
    { validate: isAuditReadProjection }
  );
}

export function listAuditFindings(filters: AuditFindingListFilters = {}) {
  return apiRequest<AuditFindingListResponse>(buildAuditFindingListPath(filters), {
    validate: isAuditFindingListResponse
  });
}

export function getAuditFinding(findingId: string) {
  return apiRequest<AuditFindingReadProjection>(
    `/api/v1/audit-findings/${encodeURIComponent(findingId)}`,
    { validate: isAuditFindingReadProjection }
  );
}

function buildAuditListPath(filters: AuditListFilters) {
  const search = new URLSearchParams();
  if (filters.status) search.set("status", filters.status);
  const query = search.toString();
  return `/api/v1/audits${query ? `?${query}` : ""}`;
}

function buildAuditFindingListPath(filters: AuditFindingListFilters) {
  const search = new URLSearchParams();
  if (filters.severity) search.set("severity", filters.severity);
  if (filters.resolved !== undefined) search.set("resolved", String(filters.resolved));
  const query = search.toString();
  return `/api/v1/audit-findings${query ? `?${query}` : ""}`;
}
