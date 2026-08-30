import { apiRequest } from "../api/client";
import {
  AuditListResponse,
  AuditReadProjection,
  AuditStatus,
  isAuditListResponse,
  isAuditReadProjection
} from "./auditRiskTypes";

export interface AuditListFilters {
  readonly status?: AuditStatus;
}

export const auditQueryKeys = {
  all: ["audits"] as const,
  list: (filters: AuditListFilters) => ["audits", "list", filters.status ?? null] as const,
  detail: (auditId: string) => ["audits", "detail", auditId] as const
};

export function listAudits(filters: AuditListFilters = {}) {
  return apiRequest<AuditListResponse>(buildAuditListPath(filters), {
    validate: isAuditListResponse
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
