import { apiRequest } from "../api/client";
import {
  AuditListResponse,
  AuditReadProjection,
  AuditStatus,
  AuditEligibleFacilityList,
  AuditTemplateSelector,
  isAuditEligibleFacilityList,
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

function buildAuditListPath(filters: AuditListFilters) {
  const search = new URLSearchParams();
  if (filters.status) search.set("status", filters.status);
  const query = search.toString();
  return `/api/v1/audits${query ? `?${query}` : ""}`;
}
