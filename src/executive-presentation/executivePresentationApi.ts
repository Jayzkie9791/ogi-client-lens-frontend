import { apiRequestWithMetadata } from "../api/client";
import type { ExecutiveSummaryProjection } from "../executive-findings/executiveSummaryApi";
import type { ExecutivePresentationContent, ExecutivePresentationDraftEnvelope, ExecutivePresentationDraftResponse } from "./executivePresentationTypes";

const etagPattern = /^"epa-draft-r[1-9][0-9]*"$/;

export function executivePresentationPath(projection: ExecutiveSummaryProjection) {
  const { clientId, facilityId } = projection.scope;
  return `/api/v1/clients/${encodeURIComponent(clientId)}/facilities/${encodeURIComponent(facilityId)}/operational-risk-index/${encodeURIComponent(projection.ari.resultId)}/executive-presentation`;
}

export async function readExecutivePresentationDraft(projection: ExecutiveSummaryProjection) {
  return request(projection, { method: "GET" });
}

export async function createExecutivePresentationDraft(projection: ExecutiveSummaryProjection) {
  return request(projection, { method: "POST", body: {} });
}

export async function saveExecutivePresentationDraft(projection: ExecutiveSummaryProjection, content: ExecutivePresentationContent, etag: string) {
  return request(projection, { method: "PUT", body: { content }, headers: { "If-Match": etag } });
}

async function request(
  projection: ExecutiveSummaryProjection,
  options: { method: "GET" | "POST" | "PUT"; body?: unknown; headers?: Readonly<Record<string, string>> }
): Promise<ExecutivePresentationDraftResponse> {
  const response = await apiRequestWithMetadata(executivePresentationPath(projection), {
    ...options,
    validate: isDraftEnvelope
  });
  const etag = response.headers.get("ETag");
  if (!etag || !etagPattern.test(etag)) throw new Error("The Executive Presentation response did not include a valid strong ETag.");
  return { envelope: response.data, etag };
}

function isDraftEnvelope(value: unknown): value is ExecutivePresentationDraftEnvelope {
  if (!record(value) || !record(value.draft)) return false;
  const draft = value.draft;
  return typeof draft.id === "string" && typeof draft.ariResultId === "string"
    && draft.schemaVersion === "1.0" && draft.lifecycle === "WORKING_DRAFT"
    && Number.isInteger(draft.revision) && Number(draft.revision) > 0
    && typeof draft.contentChecksum === "string" && /^[0-9a-f]{64}$/.test(draft.contentChecksum)
    && isContent(draft.content);
}

function isContent(value: unknown): value is ExecutivePresentationContent {
  return record(value) && value.schemaVersion === "1.0" && Array.isArray(value.sections)
    && value.sections.every((section) => record(section) && typeof section.heading === "string"
      && typeof section.scope === "string" && Array.isArray(section.findings)
      && section.findings.every((finding) => typeof finding === "string")
      && Array.isArray(section.recommendations)
      && section.recommendations.every((item) => record(item)
        && (item.kind === "RECOMMENDATION" || item.kind === "ACTION") && typeof item.text === "string"));
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

