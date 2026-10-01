import { routes } from "../app/routePaths";

export type EvidenceReturnContext =
  | { readonly kind: "FACILITY_ASSESSMENT"; readonly clientId: string; readonly facilityId: string; readonly categoryCode?: string }
  | { readonly kind: "TRAINING_JOURNEY"; readonly enrollmentId: string }
  | { readonly kind: "TRAINING" }
  | { readonly kind: "TRAINING_REQUEST" }
  | { readonly kind: "GOVERNANCE_QUEUE" }
  | { readonly kind: "WORKBENCH" }
  | { readonly kind: "RECORDS" }
  | { readonly kind: "MY_DRAFTS" };

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
  if (params.get("return") === "training-request") return { kind: "TRAINING_REQUEST" };
  if (params.get("return") === "training") return { kind: "TRAINING" };
  if (params.get("return") === "governance-queue") return { kind: "GOVERNANCE_QUEUE" };
  if (params.get("return") === "workbench") return { kind: "WORKBENCH" };
  if (params.get("return") === "records") return { kind: "RECORDS" };
  if (params.get("return") === "my-drafts") return { kind: "MY_DRAFTS" };
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
  } else if (context.kind === "TRAINING_JOURNEY") {
    params.set("return", "training-journey");
    params.set("enrollment", context.enrollmentId);
  } else if (context.kind === "TRAINING_REQUEST") {
    params.set("return", "training-request");
  } else if (context.kind === "TRAINING") {
    params.set("return", "training");
  } else if (context.kind === "GOVERNANCE_QUEUE") {
    params.set("return", "governance-queue");
  } else if (context.kind === "WORKBENCH") {
    params.set("return", "workbench");
  } else if (context.kind === "RECORDS") {
    params.set("return", "records");
  } else {
    params.set("return", "my-drafts");
  }
  return params;
}

export function evidenceReturnDestination(context: EvidenceReturnContext) {
  if (context.kind === "TRAINING_JOURNEY") return routes.trainingJourneyPath(context.enrollmentId);
  if (context.kind === "TRAINING") return routes.registrationTraining;
  if (context.kind === "TRAINING_REQUEST") return routes.trainingRequests;
  if (context.kind === "GOVERNANCE_QUEUE") return routes.governanceQueue;
  if (context.kind === "WORKBENCH") return routes.workbench;
  if (context.kind === "RECORDS") return routes.records;
  if (context.kind === "MY_DRAFTS") return routes.myDrafts;
  const params = new URLSearchParams({ client: context.clientId, facility: context.facilityId });
  if (context.categoryCode) params.set("category", context.categoryCode);
  return `${routes.facilityAssessmentJourneys}?${params.toString()}`;
}

export function evidenceReturnLabel(context: EvidenceReturnContext) {
  if (context.kind === "TRAINING_JOURNEY") return "Back to Training Journey";
  if (context.kind === "TRAINING") return "Back to Training";
  if (context.kind === "TRAINING_REQUEST") return "Back to Request Training";
  if (context.kind === "GOVERNANCE_QUEUE") return "Back to Governance Queue";
  if (context.kind === "WORKBENCH") return "Back to Workbench";
  if (context.kind === "RECORDS") return "Back to Records";
  if (context.kind === "MY_DRAFTS") return "Back to My Drafts";
  return "Back to Facility Assessment Journey";
}
