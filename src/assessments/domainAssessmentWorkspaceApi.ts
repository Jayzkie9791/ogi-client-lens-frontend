import { apiRequest } from "../api/client";

export type DomainApplicabilityState = "UNRESOLVED" | "APPLICABLE" | "NOT_APPLICABLE";

export interface DomainContribution {
  readonly sourceKind: string;
  readonly sourceId: string;
  readonly sourceAt: string | null;
}

export interface DomainApplicability {
  readonly formCode: string | null;
  readonly canonicalOrder: number;
  readonly state: DomainApplicabilityState;
  readonly rationale?: string | null;
  readonly contributions: readonly DomainContribution[];
}

export interface DomainAssessmentWorkspaceRecord {
  readonly id: string;
  readonly assessmentVersion: number;
  readonly lifecycle: string;
  readonly root: { readonly domainCode: string };
  readonly scope: { readonly id: string; readonly displayName: string };
  readonly professionalDetermination: {
    readonly professionalCategoryIndex: string | null;
    readonly lmhc: string | null;
    readonly synthesis: string | null;
  };
  readonly authority: { readonly professionalIndexContract: "PROFESSIONAL_CATEGORY_INDEX" | "LEGACY_LMHC" };
  readonly applicability: readonly DomainApplicability[];
}

export interface DomainCandidate {
  readonly id: string;
  readonly sourceKind: string;
  readonly templateVersion?: string;
  readonly lifecycleState?: string;
  readonly sourceAt: string | null;
}

export interface DomainReviewContext {
  readonly assessmentId: string;
  readonly lifecycle: string;
  readonly subjectId: string | null;
  readonly review: null | { readonly id: string; readonly requestedByUserId: string; readonly createdAt: string | null; readonly decision: null | { readonly state: string; readonly decidedByUserId: string; readonly decidedAt: string | null; readonly rationale: string } };
}
export interface DomainWorkforceSupport { readonly assessmentId:string;readonly categoryCode:string;readonly evidenceCutoffAt:string|null;readonly projection:{readonly projectionVersion:string;readonly cutoffAt:string;readonly checksum:string;readonly counts:{readonly assignedPersonnel:number;readonly activeCertification:number;readonly currentlyAuthorized:number;readonly personnelWithGaps:number}};readonly personnelFormCompleteness:{readonly checksum:string;readonly counts:{readonly assignedPersonnel:number;readonly eligible:number;readonly actionRequired:number};readonly personnel:readonly {readonly staffMemberId:string;readonly fullName:string;readonly studentNumber:string|null;readonly trainingEnrollmentId:string|null;readonly status:string;readonly eligibleEvidenceRecordId:string|null}[]};readonly binding:null|{readonly id:string;readonly projectionChecksum:string;readonly selectedByUserId:string;readonly selectedAt:string|null}; }

const valid = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const assessmentValid = (value: unknown): value is DomainAssessmentWorkspaceRecord => valid(value) && typeof value.id === "string" && typeof value.lifecycle === "string" && Array.isArray(value.applicability);

const openingAssessments = new Map<string, Promise<DomainAssessmentWorkspaceRecord>>();

export function openDomainAssessment(facilityId: string, domainCode: string, displayName: string) {
  const operationKey = `${facilityId}:${domainCode}`;
  const existing = openingAssessments.get(operationKey);
  if (existing) return existing;
  const opening = openDomainAssessmentOnce(facilityId, domainCode, displayName)
    .finally(() => openingAssessments.delete(operationKey));
  openingAssessments.set(operationKey, opening);
  return opening;
}

async function openDomainAssessmentOnce(facilityId: string, domainCode: string, displayName: string) {
  const workspaceKey = domainWorkspaceStorageKey(facilityId, domainCode);
  const retainedId = window.localStorage.getItem(workspaceKey);
  if (retainedId) {
    try { const retained = await readDomainAssessment(retainedId); if (["DRAFT", "SUBMITTED", "RETURNED"].includes(retained.lifecycle)) return retained; }
    catch { window.localStorage.removeItem(workspaceKey); }
  }
  const key = crypto.randomUUID();
  const rootResult = await apiRequest<{ root: { id: string } }>("/api/v1/domain-assessment-roots", { method: "POST", headers: { "idempotency-key": `${key}-root` }, body: { facilityId, domainCode }, validate: (value): value is { root: { id: string } } => valid(value) && valid(value.root) && typeof value.root.id === "string" });
  const scopesResult = await apiRequest<{ scopes: Array<{ id: string; scope_type: string; lifecycle: string }> }>(`/api/v1/domain-assessment-roots/${encodeURIComponent(rootResult.root.id)}/scopes`, { validate: (value): value is { scopes: Array<{ id: string; scope_type: string; lifecycle: string }> } => valid(value) && Array.isArray(value.scopes) });
  let scope = scopesResult.scopes.find((item) => item.scope_type === "FACILITY_WIDE" && item.lifecycle === "ACTIVE");
  if (!scope) {
    const created = await apiRequest<{ scope: { id: string } }>(`/api/v1/domain-assessment-roots/${encodeURIComponent(rootResult.root.id)}/scopes`, { method: "POST", headers: { "idempotency-key": `${key}-scope` }, body: { scopeType: "FACILITY_WIDE", displayName: `${displayName} facility-wide` }, validate: (value): value is { scope: { id: string } } => valid(value) && valid(value.scope) && typeof value.scope.id === "string" });
    scope = { id: created.scope.id, scope_type: "FACILITY_WIDE", lifecycle: "ACTIVE" };
  }
  const current = await readDomainAssessmentWorkspace(scope.id);
  if (current) { window.localStorage.setItem(workspaceKey, current.id); return current; }
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), 0, 1)).toISOString();
  const end = now.toISOString();
  const created = await apiRequest<{ assessment: DomainAssessmentWorkspaceRecord }>(`/api/v1/domain-assessment-scopes/${encodeURIComponent(scope.id)}/assessments`, { method: "POST", headers: { "idempotency-key": `${key}-assessment` }, body: { periodStart: start, periodEnd: end, evidenceCutoffAt: end, initiationKind: "CLIENT_REQUEST", initiationRationale: `Facility-wide ${displayName} assessment.` }, validate: (value): value is { assessment: DomainAssessmentWorkspaceRecord } => valid(value) && assessmentValid(value.assessment) });
  window.localStorage.setItem(workspaceKey, created.assessment.id);
  return created.assessment;
}

export const readDomainAssessment = (id: string) => apiRequest<DomainAssessmentWorkspaceRecord>(`/api/v1/domain-assessments/${encodeURIComponent(id)}`, { validate: assessmentValid });
export const listDomainAssessmentHistory = (scopeId: string) => apiRequest<DomainAssessmentWorkspaceRecord[]>(`/api/v1/domain-assessment-scopes/${encodeURIComponent(scopeId)}/history`, { validate: (value): value is DomainAssessmentWorkspaceRecord[] => Array.isArray(value) && value.every(assessmentValid) });
export const readDomainAssessmentWorkspace = (scopeId: string) => apiRequest<DomainAssessmentWorkspaceRecord | null>(`/api/v1/domain-assessment-scopes/${encodeURIComponent(scopeId)}/workspace`, { validate: (value): value is DomainAssessmentWorkspaceRecord | null => value === null || assessmentValid(value) });
export const readDomainReviewContext = (id: string) => apiRequest<DomainReviewContext>(`/api/v1/domain-assessments/${encodeURIComponent(id)}/review-context`, { validate: (value): value is DomainReviewContext => valid(value) && typeof value.assessmentId === "string" && typeof value.lifecycle === "string" && (value.subjectId === null || typeof value.subjectId === "string") && (value.review === null || valid(value.review)) });
const workforceSupportValid=(value:unknown):value is DomainWorkforceSupport=>valid(value)&&typeof value.assessmentId==="string"&&valid(value.projection)&&typeof value.projection.checksum==="string"&&valid(value.personnelFormCompleteness)&&Array.isArray(value.personnelFormCompleteness.personnel)&&(value.binding===null||valid(value.binding));
export const readDomainWorkforceSupport=(id:string)=>apiRequest<DomainWorkforceSupport>(`/api/v1/domain-assessments/${encodeURIComponent(id)}/workforce-authority`,{validate:workforceSupportValid});
export const bindDomainWorkforceSupport=(id:string)=>apiRequest<DomainWorkforceSupport>(`/api/v1/domain-assessments/${encodeURIComponent(id)}/workforce-authority`,{method:"PUT",validate:workforceSupportValid});
export const createDomainAssessmentSuccessor = (assessment: DomainAssessmentWorkspaceRecord, displayName: string) => { const now = new Date(), start = new Date(Date.UTC(now.getUTCFullYear(), 0, 1)).toISOString(), end = now.toISOString(); return apiRequest<{ assessment: DomainAssessmentWorkspaceRecord }>(`/api/v1/domain-assessment-scopes/${encodeURIComponent(assessment.scope.id)}/assessments`, { method: "POST", headers: { "idempotency-key": crypto.randomUUID() }, body: { periodStart: start, periodEnd: end, evidenceCutoffAt: end, initiationKind: "CLIENT_REQUEST", initiationRationale: `Successor facility-wide ${displayName} assessment.`, predecessorDomainAssessmentId: assessment.id }, validate: (value): value is { assessment: DomainAssessmentWorkspaceRecord } => valid(value) && assessmentValid(value.assessment) }); };
export const createDomainAssessmentRevision = (assessment: DomainAssessmentWorkspaceRecord) => apiRequest<{ assessment: DomainAssessmentWorkspaceRecord }>(`/api/v1/domain-assessments/${encodeURIComponent(assessment.id)}/revisions`, { method: "POST", headers: { "idempotency-key": crypto.randomUUID() }, body: { initiationRationale: "Correction of returned facility-wide category assessment." }, validate: (value): value is { assessment: DomainAssessmentWorkspaceRecord } => valid(value) && assessmentValid(value.assessment) });
export const listDomainCandidates = (id: string, formCode: string) => apiRequest<{ candidates: DomainCandidate[] }>(`/api/v1/domain-assessments/${encodeURIComponent(id)}/candidates/${encodeURIComponent(formCode)}`, { validate: (value): value is { candidates: DomainCandidate[] } => valid(value) && Array.isArray(value.candidates) });
export const resolveDomainApplicability = (id: string, formCode: string, body: { state: DomainApplicabilityState; reasonCode?: "NOT_APPLICABLE_OTHER"; rationale?: string }) => apiRequest<DomainAssessmentWorkspaceRecord>(`/api/v1/domain-assessments/${encodeURIComponent(id)}/applicability/${encodeURIComponent(formCode)}`, { method: "PUT", body, validate: assessmentValid });
export const bindDomainSource = (id: string, sourceId: string, sourceKind: string) => apiRequest<DomainAssessmentWorkspaceRecord>(`/api/v1/domain-assessments/${encodeURIComponent(id)}/${sourceKind === "OPERATIONAL_EVIDENCE" ? "evidence-bindings" : "bindings"}/${encodeURIComponent(sourceId)}`, { method: "PUT", validate: assessmentValid });
export const unbindDomainSource = (id: string, sourceId: string, sourceKind: string) => apiRequest<DomainAssessmentWorkspaceRecord>(`/api/v1/domain-assessments/${encodeURIComponent(id)}/${sourceKind === "OPERATIONAL_EVIDENCE" ? "evidence-bindings" : "bindings"}/${encodeURIComponent(sourceId)}`, { method: "DELETE", validate: assessmentValid });
export const determineDomainAssessment = (id: string, body: { professionalCategoryIndex?: string; lmhc?: "LOW" | "MODERATE" | "HIGH" | "CRITICAL"; synthesis: string }) => apiRequest<DomainAssessmentWorkspaceRecord>(`/api/v1/domain-assessments/${encodeURIComponent(id)}`, { method: "PATCH", body, validate: assessmentValid });
export const submitDomainAssessment = (id: string) => apiRequest<{ assessment: DomainAssessmentWorkspaceRecord; reviewSubject: { id: string } }>(`/api/v1/domain-assessments/${encodeURIComponent(id)}/submit`, { method: "POST", headers: { "idempotency-key": crypto.randomUUID() }, validate: (value): value is { assessment: DomainAssessmentWorkspaceRecord; reviewSubject: { id: string } } => valid(value) && assessmentValid(value.assessment) && valid(value.reviewSubject) && typeof value.reviewSubject.id === "string" });
export const requestDomainReview = (subjectId: string) => apiRequest<{ review: { id: string } }>("/api/v1/governed-reviews", { method: "POST", body: { subjectId, idempotencyKey: crypto.randomUUID() }, validate: (value): value is { review: { id: string } } => valid(value) && valid(value.review) && typeof value.review.id === "string" });
export const approveDomainReview = (reviewId: string, rationale: string) => apiRequest<Record<string, unknown>>(`/api/v1/governed-reviews/${encodeURIComponent(reviewId)}/decision`, { method: "POST", body: { decision: "APPROVED", rationale, idempotencyKey: crypto.randomUUID() }, validate: valid });
export const returnDomainReview = (reviewId: string, rationale: string) => apiRequest<Record<string, unknown>>(`/api/v1/governed-reviews/${encodeURIComponent(reviewId)}/decision`, { method: "POST", body: { decision: "NOT_APPROVED", rationale, idempotencyKey: crypto.randomUUID() }, validate: valid });

function domainWorkspaceStorageKey(facilityId: string, domainCode: string) { return `client-lens:domain-assessment:${facilityId}:${domainCode}`; }
