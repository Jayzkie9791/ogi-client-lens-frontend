import { apiBlobRequest, apiRequest } from "../api/client";

export interface SelfProfile {
  id: string;
  client_employee_number: string | null;
  full_name: string;
  first_name: string | null;
  middle_name: string | null;
  last_name: string | null;
  email: string | null;
  phone_number: string | null;
  employment_status: string;
  hire_date: string | null;
  client: { id: string; organization_name: string } | null;
  facilities: Array<{ id: string; assignment_id: string; facility_name: string; position: string | null; is_primary: boolean; assigned_from: string; assigned_to: string | null }>;
}
export interface SelfCredentials {
  personnel: SelfProfile;
  certifications: Array<{ id: string; business_identifier: string; certification_level: string; certification_number: string; certification_status: string; issue_date: string; expiry_date: string; endorsements: Array<{ endorsement: string; created_at: string }>; credential_issuance_id: string | null }>;
}

export function getMyProfile() {
  return apiRequest<SelfProfile>("/api/v1/self/personnel", { validate: isProfile });
}
export function getMyCredentials() {
  return apiRequest<SelfCredentials>("/api/v1/self/credentials", { validate: (value): value is SelfCredentials => isObject(value) && isProfile(value.personnel) && Array.isArray(value.certifications) });
}
export function getMyCertificate(issuanceId: string) {
  return apiBlobRequest(`/api/v1/self/credential-issuances/${encodeURIComponent(issuanceId)}/certificate`);
}
function isProfile(value: unknown): value is SelfProfile {
  return isObject(value) && typeof value.id === "string" && typeof value.full_name === "string" && typeof value.employment_status === "string" && (value.client === null || (isObject(value.client) && typeof value.client.organization_name === "string")) && Array.isArray(value.facilities);
}
function isObject(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
