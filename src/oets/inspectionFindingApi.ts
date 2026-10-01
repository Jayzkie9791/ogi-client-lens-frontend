import { apiRequest } from "../api/client";

export interface InspectionFindingRegistration {
  id: string;
  business_identifier: string;
}

export function registerInspectionFinding(evidenceRecordId: string, sourceRowKey: string) {
  return apiRequest<InspectionFindingRegistration>(
    `/api/v1/operational-evidence/records/${encodeURIComponent(evidenceRecordId)}/inspection-findings`,
    {
      method: "POST",
      headers: { "Idempotency-Key": `f081:${evidenceRecordId}:${sourceRowKey}` },
      body: { source_row_key: sourceRowKey },
      validate: isRegistration
    }
  );
}

function isRegistration(value: unknown): value is InspectionFindingRegistration {
  return Boolean(value) && typeof value === "object" &&
    typeof (value as Record<string, unknown>).id === "string" &&
    typeof (value as Record<string, unknown>).business_identifier === "string";
}
