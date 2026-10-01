import { apiBlobRequest, apiRequest } from "../api/client";
import { SelfCredentials, SelfProfile } from "../self-service/selfServiceApi";

export interface AuthorizedFacilityTeam {
  facility_id: string;
  personnel: SelfProfile[];
}

export function getAuthorizedFacilityTeam(facilityId: string) {
  return apiRequest<AuthorizedFacilityTeam>(
    `/api/v1/authorized-workforce/personnel?facility_id=${encodeURIComponent(facilityId)}`,
    { validate: isTeam }
  );
}

export function getAuthorizedPersonnel(staffMemberId: string) {
  return apiRequest<SelfProfile>(
    `/api/v1/authorized-workforce/personnel/${encodeURIComponent(staffMemberId)}`,
    { validate: isProfile }
  );
}

export function getAuthorizedPersonnelCredentials(staffMemberId: string) {
  return apiRequest<SelfCredentials>(
    `/api/v1/authorized-workforce/personnel/${encodeURIComponent(staffMemberId)}/credentials`,
    { validate: isCredentials }
  );
}

export function getAuthorizedPersonnelCertificate(issuanceId: string) {
  return apiBlobRequest(
    `/api/v1/authorized-workforce/credential-issuances/${encodeURIComponent(issuanceId)}/certificate`
  );
}

function isTeam(value: unknown): value is AuthorizedFacilityTeam {
  return isObject(value) && typeof value.facility_id === "string" &&
    Array.isArray(value.personnel) && value.personnel.every(isProfile);
}

function isProfile(value: unknown): value is SelfProfile {
  return isObject(value) && typeof value.id === "string" &&
    typeof value.full_name === "string" && Array.isArray(value.facilities);
}

function isCredentials(value: unknown): value is SelfCredentials {
  return isObject(value) && isProfile(value.personnel) &&
    Array.isArray(value.certifications);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
