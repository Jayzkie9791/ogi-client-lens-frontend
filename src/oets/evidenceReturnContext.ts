import { routes } from "../app/routePaths";

export type EvidenceReturnContext =
  | { readonly kind: "FACILITY_ASSESSMENT"; readonly clientId: string; readonly facilityId: string; readonly categoryCode?: string }
  | { readonly kind: "TRAINING_JOURNEY"; readonly enrollmentId: string };

export function readEvidenceReturnContext(search: string): EvidenceReturnContext | null {
  const params = new URLSearchParams(search);
  if (params.get("return") === "facility-assessment") {
    const clientId = params.get("client")?.trim() ?? "";
    const facilityId = params.get("facility")?.trim() ?? "";
    const categoryCode = params.get("category")?.trim() || undefined;
    return clientId && facilityId ? { kind: "FACILITY_ASSESSMENT", clientId, facilityId, ...(categoryCode ? { categoryCode } : {}) } : null;
  }
  if (params.get("return") === "training-journey") {
    const enrollmentId = params.get("enrollment")?.trim() ?? "";
    return enrollmentId ? { kind: "TRAINING_JOURNEY", enrollmentId } : null;
  }
  return null;
}

export function evidencePathWithReturn(recordId: string, context: EvidenceReturnContext) {
  return `${routes.evidenceRecordPath(recordId)}?${returnContextSearch(context).toString()}`;
}

export function returnContextSearch(context: EvidenceReturnContext) {
  const params = new URLSearchParams();
  if (context.kind === "FACILITY_ASSESSMENT") {
    params.set("return", "facility-assessment");
    params.set("client", context.clientId);
    params.set("facility", context.facilityId);
    if (context.categoryCode) params.set("category", context.categoryCode);
  } else {
    params.set("return", "training-journey");
    params.set("enrollment", context.enrollmentId);
  }
  return params;
}

export function evidenceReturnDestination(context: EvidenceReturnContext) {
  if (context.kind === "TRAINING_JOURNEY") return routes.trainingJourneyPath(context.enrollmentId);
  const params = new URLSearchParams({ client: context.clientId, facility: context.facilityId });
  if (context.categoryCode) params.set("category", context.categoryCode);
  return `${routes.facilityAssessmentJourneys}?${params.toString()}`;
}

export function evidenceReturnLabel(context: EvidenceReturnContext) {
  return context.kind === "TRAINING_JOURNEY" ? "Back to Training Journey" : "Back to Facility Assessment Journey";
}
