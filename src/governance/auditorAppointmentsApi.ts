import { apiRequest } from "../api/client";

export const appointmentProfiles = ["AUDIT_TEAM_MEMBER", "AUDIT_OPERATOR", "LEAD_AUDITOR", "AUDIT_REVIEWER", "AUDIT_APPROVER", "FULL_AUDIT_AUTHORITY"] as const;
export const appointmentScopes = ["OGI_ENTERPRISE", "CLIENT_WIDE", "FACILITY_SPECIFIC"] as const;
export const appointmentStatuses = ["PENDING", "ACTIVE", "SUSPENDED", "REVOKED", "EXPIRED"] as const;

export type AppointmentProfile = typeof appointmentProfiles[number];
export type AppointmentScope = typeof appointmentScopes[number];
export type AppointmentStatus = typeof appointmentStatuses[number];

export interface AuditorAppointment {
  id: string;
  business_identifier: string;
  audit_number?: string | null;
  personnel_id: string;
  client_id: string | null;
  profile: AppointmentProfile;
  capabilities: string[];
  authority_basis: string;
  scope_mode: AppointmentScope;
  status: AppointmentStatus;
  valid_from: string;
  valid_until: string | null;
  reason: string;
  full_name: string;
  organizational_affiliation: string;
  facility_ids: string[];
  created_at?: string;
}

export interface CreateAuditorAppointmentRequest {
  personnel_id: string;
  profile: AppointmentProfile;
  authority_basis: string;
  scope_mode: AppointmentScope;
  client_id?: string;
  facility_ids: string[];
  valid_from: string;
  valid_until?: string;
  reason: string;
}

export function listAuditorAppointments() {
  return apiRequest<{ appointments: AuditorAppointment[] }>("/api/v1/audit-appointments", { validate: isAppointmentList });
}

export function createAuditorAppointment(request: CreateAuditorAppointmentRequest) {
  return apiRequest<{ id: string; identifier: string; audit_number: string; status: string; replayed: boolean }>("/api/v1/audit-appointments", {
    method: "POST", body: request, headers: { "Idempotency-Key": crypto.randomUUID() }, validate: isCreateResponse
  });
}

function isAppointmentList(value: unknown): value is { appointments: AuditorAppointment[] } {
  return isRecord(value) && Array.isArray(value.appointments) && value.appointments.every(isAppointment);
}
function isAppointment(value: unknown): value is AuditorAppointment {
  return isRecord(value) && typeof value.id === "string" && typeof value.full_name === "string" && typeof value.profile === "string" && typeof value.scope_mode === "string" && typeof value.status === "string" && Array.isArray(value.facility_ids);
}
function isCreateResponse(value: unknown): value is { id: string; identifier: string; audit_number: string; status: string; replayed: boolean } {
  return isRecord(value) && typeof value.id === "string" && typeof value.identifier === "string" && typeof value.audit_number === "string" && typeof value.status === "string" && typeof value.replayed === "boolean";
}
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
