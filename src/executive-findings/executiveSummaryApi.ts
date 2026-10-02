import { apiRequest } from "../api/client";

export const executiveSummaryCategoryCodes = [
  "GOVERNANCE_DOCUMENTATION",
  "LIFEGUARD_OPERATIONS",
  "EMERGENCY_PREPAREDNESS",
  "RESCUE_EQUIPMENT_ASSETS",
  "TRAINING_COMPETENCY",
  "FACILITY_ENVIRONMENTAL_SAFETY",
  "INCIDENT_MANAGEMENT",
  "PUBLIC_SAFETY_SYSTEMS",
  "EQUIPMENT_INSPECTION_PROGRAMS"
] as const;

export type ExecutiveSummaryClassification = "LOW" | "MODERATE" | "HIGH" | "CRITICAL";

export interface ExecutiveSummaryCategory {
  readonly canonicalOrder: number;
  readonly categoryCode: string;
  readonly categoryName: string;
  readonly index: string;
  readonly classification: ExecutiveSummaryClassification;
  readonly weight: string;
  readonly weightedContribution: string;
  readonly source: {
    readonly assessmentId: string;
    readonly assessmentVersion: number;
    readonly assessmentSnapshotChecksum: string;
    readonly finalizedAt: string;
    readonly evidenceCutoffAt: string;
  };
  readonly contributionChecksum: string;
}

export interface ExecutiveSummaryProjection {
  readonly projectionVersion: "EXECUTIVE_SUMMARY_SLIDES_1_3_V1";
  readonly scope: {
    readonly clientId: string;
    readonly clientIdentifier: string;
    readonly clientName: string;
    readonly facilityId: string;
    readonly facilityIdentifier: string;
    readonly facilityName: string;
  };
  readonly ari: {
    readonly resultId: string;
    readonly resultVersion: number;
    readonly value: string;
    readonly classification: ExecutiveSummaryClassification;
    readonly calculatedAt: string;
    readonly resultChecksum: string;
    readonly sourceSetChecksum: string;
    readonly authorityVersion: string;
    readonly authorityChecksum: string;
    readonly numericContract: string;
  };
  readonly categories: readonly ExecutiveSummaryCategory[];
  readonly numericOrdering: {
    readonly lowestFirst: readonly ExecutiveSummaryNumericOrder[];
    readonly highestFirst: readonly ExecutiveSummaryNumericOrder[];
  };
}

interface ExecutiveSummaryNumericOrder {
  readonly categoryCode: string;
  readonly index: string;
  readonly sharedRank: number;
}

export function getExecutiveSummary(ariResultId: string) {
  return apiRequest<ExecutiveSummaryProjection>(
    `/api/v1/operational-risk-index/${encodeURIComponent(ariResultId)}/executive-summary`,
    { validate: isExecutiveSummaryProjection }
  );
}

export function isExecutiveSummaryProjection(value: unknown): value is ExecutiveSummaryProjection {
  if (!isRecord(value) || value.projectionVersion !== "EXECUTIVE_SUMMARY_SLIDES_1_3_V1"
    || !isScope(value.scope) || !isAri(value.ari) || !Array.isArray(value.categories)
    || value.categories.length !== executiveSummaryCategoryCodes.length || !isRecord(value.numericOrdering)) return false;
  const categoriesValid = value.categories.every((item, index) => isCategory(item, index));
  return categoriesValid
    && isOrdering(value.numericOrdering.lowestFirst)
    && isOrdering(value.numericOrdering.highestFirst);
}

function isScope(value: unknown) {
  return isRecord(value) && ["clientId", "clientIdentifier", "clientName", "facilityId", "facilityIdentifier", "facilityName"]
    .every((field) => nonempty(value[field]));
}

function isAri(value: unknown) {
  return isRecord(value) && nonempty(value.resultId) && positiveInteger(value.resultVersion)
    && decimalInRange(value.value, 0, 100) && classification(value.classification) && isoDate(value.calculatedAt)
    && checksum(value.resultChecksum) && checksum(value.sourceSetChecksum)
    && nonempty(value.authorityVersion) && checksum(value.authorityChecksum) && nonempty(value.numericContract);
}

function isCategory(value: unknown, index: number) {
  return isRecord(value) && value.canonicalOrder === index + 1
    && value.categoryCode === executiveSummaryCategoryCodes[index] && nonempty(value.categoryName)
    && decimalInRange(value.index, 0, 100) && classification(value.classification) && decimalInRange(value.weight, 0, 1)
    && decimalInRange(value.weightedContribution, 0, 100) && isRecord(value.source)
    && nonempty(value.source.assessmentId) && positiveInteger(value.source.assessmentVersion)
    && checksum(value.source.assessmentSnapshotChecksum) && isoDate(value.source.finalizedAt)
    && isoDate(value.source.evidenceCutoffAt) && checksum(value.contributionChecksum);
}

function isOrdering(value: unknown): value is readonly ExecutiveSummaryNumericOrder[] {
  if (!Array.isArray(value) || value.length !== executiveSummaryCategoryCodes.length) return false;
  const codes = new Set<string>();
  for (const item of value) {
    if (!isRecord(item) || !executiveSummaryCategoryCodes.includes(item.categoryCode as typeof executiveSummaryCategoryCodes[number])
      || !decimal(item.index) || !positiveInteger(item.sharedRank) || codes.has(String(item.categoryCode))) return false;
    codes.add(String(item.categoryCode));
  }
  return codes.size === executiveSummaryCategoryCodes.length;
}

function classification(value: unknown): value is ExecutiveSummaryClassification {
  return value === "LOW" || value === "MODERATE" || value === "HIGH" || value === "CRITICAL";
}

function decimal(value: unknown) {
  return typeof value === "string" && /^-?(?:\d+\.?\d*|\.\d+)$/.test(value);
}

function decimalInRange(value: unknown, minimum: number, maximum: number) {
  if (!decimal(value)) return false;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= minimum && parsed <= maximum;
}

function checksum(value: unknown) {
  return typeof value === "string" && /^[0-9a-f]{64}$/.test(value);
}

function isoDate(value: unknown) {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

function nonempty(value: unknown) {
  return typeof value === "string" && value.trim().length > 0;
}

function positiveInteger(value: unknown) {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
