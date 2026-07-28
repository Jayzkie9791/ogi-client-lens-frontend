import { apiRequest } from "../api/client";

export interface ClientContextClient {
  id: string;
  name: string;
  status: string;
}

export interface ClientContextFacility {
  id: string;
  clientId: string;
  name: string;
  status: string;
}

interface ClientContextClientsResponse {
  clients: ClientContextClient[];
}

interface ClientContextFacilitiesResponse {
  facilities: ClientContextFacility[];
}

export function getAuthorizedClientContexts() {
  return apiRequest<ClientContextClientsResponse>("/api/v1/client-context/clients", {
    validate: isClientContextClientsResponse
  });
}

export function getAuthorizedClientFacilities(clientId: string) {
  return apiRequest<ClientContextFacilitiesResponse>(
    `/api/v1/client-context/clients/${encodeURIComponent(clientId)}/facilities`,
    {
      validate: isClientContextFacilitiesResponse
    }
  );
}

function isClientContextClientsResponse(
  value: unknown
): value is ClientContextClientsResponse {
  return (
    isRecord(value) &&
    Array.isArray(value.clients) &&
    value.clients.every(isClientContextClient)
  );
}

function isClientContextFacilitiesResponse(
  value: unknown
): value is ClientContextFacilitiesResponse {
  return (
    isRecord(value) &&
    Array.isArray(value.facilities) &&
    value.facilities.every(isClientContextFacility)
  );
}

function isClientContextClient(value: unknown): value is ClientContextClient {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    typeof value.status === "string"
  );
}

function isClientContextFacility(
  value: unknown
): value is ClientContextFacility {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.clientId === "string" &&
    typeof value.name === "string" &&
    typeof value.status === "string"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
