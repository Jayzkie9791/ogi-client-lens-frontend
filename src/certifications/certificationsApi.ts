import { apiRequest } from "../api/client";

export const certificationLevels = ["L1", "L2", "L3", "L4", "L5", "L6", "L7"] as const;

export const certificationStatuses = [
  "PENDING",
  "ACTIVE",
  "EXPIRED",
  "SUSPENDED",
  "REVOKED"
] as const;

export type CertificationLevel = (typeof certificationLevels)[number];
export type CertificationStatus = (typeof certificationStatuses)[number];

export interface CreateCertificationRequest {
  readonly certification_level: CertificationLevel;
  readonly certification_number: string;
  readonly issue_date: string;
  readonly expiry_date: string;
  readonly medical_clearance_provided?: boolean;
  readonly fitness_standard_achieved?: boolean;
  readonly training_hours_completed?: number;
  readonly written_exam_score?: number;
  readonly certification_status?: CertificationStatus;
  readonly staff_member_id: string;
}

export interface CertificationCommandRecord {
  readonly id: string;
  readonly certification_level: CertificationLevel;
  readonly certification_number: string;
  readonly issue_date: string;
  readonly expiry_date: string;
  readonly medical_clearance_provided: boolean;
  readonly fitness_standard_achieved: boolean;
  readonly training_hours_completed: number | null;
  readonly written_exam_score: number | null;
  readonly certification_status: CertificationStatus;
  readonly staff_member_id: string;
  readonly created_by_user_id: string | null;
}

interface CertificationCommandResponse {
  readonly success: true;
  readonly data: CertificationCommandRecord;
}

export function createCertification(payload: CreateCertificationRequest) {
  return apiRequest<CertificationCommandResponse>("/api/v1/certifications", {
    method: "POST",
    body: payload,
    validate: isCertificationCommandResponse
  }).then((response) => response.data);
}

function isCertificationCommandResponse(
  value: unknown
): value is CertificationCommandResponse {
  return (
    isRecord(value) &&
    value.success === true &&
    isCertificationCommandRecord(value.data)
  );
}

function isCertificationCommandRecord(
  value: unknown
): value is CertificationCommandRecord {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    isCertificationLevel(value.certification_level) &&
    typeof value.certification_number === "string" &&
    typeof value.issue_date === "string" &&
    typeof value.expiry_date === "string" &&
    typeof value.medical_clearance_provided === "boolean" &&
    typeof value.fitness_standard_achieved === "boolean" &&
    isNullableNumber(value.training_hours_completed) &&
    isNullableNumber(value.written_exam_score) &&
    isCertificationStatus(value.certification_status) &&
    typeof value.staff_member_id === "string" &&
    (value.created_by_user_id === null ||
      typeof value.created_by_user_id === "string")
  );
}

function isCertificationLevel(value: unknown): value is CertificationLevel {
  return (
    typeof value === "string" &&
    certificationLevels.includes(value as CertificationLevel)
  );
}

function isCertificationStatus(value: unknown): value is CertificationStatus {
  return (
    typeof value === "string" &&
    certificationStatuses.includes(value as CertificationStatus)
  );
}

function isNullableNumber(value: unknown) {
  return value === null || typeof value === "number";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
