import { apiRequest } from "./client";
import type { RegistrationClientListResponse } from "../registration/registrationClientApi";
import type { RegistrationFacilityListResponse } from "../registration/registrationFacilityApi";

export type FeatureDiscovery =
  | "facility-assessment-journeys"
  | "auditor-appointments"
  | "ogi-personnel-operational-authority";

export function listFeatureClients(feature: FeatureDiscovery) {
  return apiRequest<RegistrationClientListResponse>(`/api/v1/feature-discovery/${feature}/clients`, {
    validate: isClientList,
  });
}

export function listFeatureFacilities(feature: FeatureDiscovery, clientId?: string) {
  const query = clientId ? `?clientId=${encodeURIComponent(clientId)}` : "";
  return apiRequest<RegistrationFacilityListResponse>(`/api/v1/feature-discovery/${feature}/facilities${query}`, {
    validate: isFacilityList,
  });
}

function isClientList(value: unknown): value is RegistrationClientListResponse {
  return isRecord(value) && Array.isArray(value.clients) && value.clients.every((client) =>
    isRecord(client) && typeof client.id === "string" && typeof client.organization_name === "string" &&
    typeof client.status === "string" && typeof client.created_at === "string" && typeof client.updated_at === "string");
}

function isFacilityList(value: unknown): value is RegistrationFacilityListResponse {
  return isRecord(value) && Array.isArray(value.facilities) && value.facilities.every((facility) =>
    isRecord(facility) && typeof facility.id === "string" && typeof facility.client_id === "string" &&
    typeof facility.facility_name === "string" && typeof facility.facility_type === "string" &&
    typeof facility.operational_status === "string" && typeof facility.created_at === "string" &&
    typeof facility.updated_at === "string");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
