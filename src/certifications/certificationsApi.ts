import { apiRequest } from "../api/client";

export const certificationLevels = ["L1", "L2", "L3", "L4", "L5", "L6", "L7"] as const;

export const certificationStatuses = [
  "PENDING",
  "ACTIVE",
  "EXPIRED",
  "SUSPENDED",
  "REVOKED"
] as const;

export const certificationEndorsements = [
  "POOL",
  "WATERFRONT",
  "WATERPARK",
  "OPEN_WATER",
  "INSTRUCTOR"
] as const;

export type CertificationLevel = (typeof certificationLevels)[number];
export type CertificationStatus = (typeof certificationStatuses)[number];
export type CertificationEndorsement = (typeof certificationEndorsements)[number];

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

export interface CreateCertificationEndorsementRequest {
  readonly endorsement: CertificationEndorsement;
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

export interface CertificationEndorsementCommandRecord {
  readonly certification_id: string;
  readonly endorsement: CertificationEndorsement;
  readonly created_at: string;
}

interface CertificationCommandResponse {
  readonly success: true;
  readonly data: CertificationCommandRecord;
}

interface CertificationEndorsementCommandResponse {
  readonly success: true;
  readonly data: CertificationEndorsementCommandRecord;
}

export function createCertification(payload: CreateCertificationRequest) {
  return apiRequest<CertificationCommandResponse>("/api/v1/certifications", {
    method: "POST",
    body: payload,
    validate: isCertificationCommandResponse
  }).then((response) => response.data);
}

export function addCertificationEndorsement(
  certificationId: string,
  payload: CreateCertificationEndorsementRequest
) {
  return apiRequest<CertificationEndorsementCommandResponse>(
    `/api/v1/certifications/${encodeURIComponent(certificationId)}/endorsements`,
    {
      method: "POST",
      body: payload,
      validate: isCertificationEndorsementCommandResponse
    }
  ).then((response) => response.data);
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

function isCertificationEndorsementCommandResponse(
  value: unknown
): value is CertificationEndorsementCommandResponse {
  return (
    isRecord(value) &&
    value.success === true &&
    isCertificationEndorsementCommandRecord(value.data)
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

function isCertificationEndorsementCommandRecord(
  value: unknown
): value is CertificationEndorsementCommandRecord {
  return (
    isRecord(value) &&
    typeof value.certification_id === "string" &&
    isCertificationEndorsement(value.endorsement) &&
    typeof value.created_at === "string"
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

function isCertificationEndorsement(
  value: unknown
): value is CertificationEndorsement {
  return (
    typeof value === "string" &&
    certificationEndorsements.includes(value as CertificationEndorsement)
  );
}

function isNullableNumber(value: unknown) {
  return value === null || typeof value === "number";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}