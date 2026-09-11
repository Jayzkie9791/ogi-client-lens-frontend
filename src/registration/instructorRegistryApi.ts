import { apiRequest } from "../api/client";
import { isApiError } from "../api/errors";

export interface InstructorRegistryIdentity {
  id: string;
  personnel_id: string;
  instructor_number: string;
  initial_entry_year: number;
  status: "ACTIVE" | "SUSPENDED" | "REVOKED" | "EXPIRED";
  created_by_user_id: string;
  created_at: string;
}

export async function getInstructorRegistryIdentity(personnelId: string) {
  try {
    return await apiRequest<InstructorRegistryIdentity>(
      `/api/v1/instructor-registry/personnel/${encodeURIComponent(personnelId)}`,
      { validate: isInstructorRegistryIdentity }
    );
  } catch (error) {
    if (isApiError(error) && error.status === 404) return null;
    throw error;
  }
}

export function allocateInstructorRegistryIdentity(personnelId: string) {
  return apiRequest<InstructorRegistryIdentity>(
    `/api/v1/instructor-registry/personnel/${encodeURIComponent(personnelId)}`,
    { method: "POST", validate: isInstructorRegistryIdentity }
  );
}

function isInstructorRegistryIdentity(value: unknown): value is InstructorRegistryIdentity {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const identity = value as Record<string, unknown>;
  return (
    typeof identity.id === "string" &&
    typeof identity.personnel_id === "string" &&
    typeof identity.instructor_number === "string" &&
    typeof identity.initial_entry_year === "number" &&
    ["ACTIVE", "SUSPENDED", "REVOKED", "EXPIRED"].includes(String(identity.status)) &&
    typeof identity.created_by_user_id === "string" &&
    typeof identity.created_at === "string"
  );
}
