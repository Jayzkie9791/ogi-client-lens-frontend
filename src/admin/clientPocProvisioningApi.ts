import { apiRequest } from "../api/client";

export type ClientPocFacilityScope =
  | {
      mode: "CLIENT_WIDE";
    }
  | {
      mode: "EXPLICIT";
      facility_ids: string[];
    };

export interface ProvisionClientPocRequest {
  client_id: string;
  full_name: string;
  email: string;
  initial_password: string;
  facility_scope: ClientPocFacilityScope;
}

export interface ProvisionClientPocResponse {
  id: string;
  client_id: string;
  full_name: string;
  email: string;
  username: null;
  status: "ACTIVE";
  role_code: "CLIENT_ADMIN";
  facility_scope_mode: "EXPLICIT" | "CLIENT_WIDE";
  explicit_facility_ids: string[];
  created_at: string;
}

export function provisionClientPoc(request: ProvisionClientPocRequest) {
  return apiRequest<ProvisionClientPocResponse>("/api/v1/admin/client-pocs", {
    method: "POST",
    body: request,
    validate: isProvisionClientPocResponse
  });
}

function isProvisionClientPocResponse(
  value: unknown
): value is ProvisionClientPocResponse {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.client_id === "string" &&
    typeof value.full_name === "string" &&
    typeof value.email === "string" &&
    value.username === null &&
    value.status === "ACTIVE" &&
    value.role_code === "CLIENT_ADMIN" &&
    (value.facility_scope_mode === "EXPLICIT" ||
      value.facility_scope_mode === "CLIENT_WIDE") &&
    Array.isArray(value.explicit_facility_ids) &&
    value.explicit_facility_ids.every((item) => typeof item === "string") &&
    typeof value.created_at === "string"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
