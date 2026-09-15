import { apiRequest } from "../api/client";

export interface OriReadinessBlocker {
  readonly categoryCode: string;
  readonly code: string;
}

export interface OriReadinessSource {
  readonly categoryCode: string;
  readonly categoryName: string;
  readonly weight: string;
  readonly scopeId: string;
  readonly assessmentId: string;
  readonly assessmentVersion: number;
  readonly finalizedAt: string;
  readonly evidenceCutoffAt: string;
  readonly lmhc: string;
  readonly professionalCategoryIndex: string;
}

export interface OriReadiness {
  readonly clientId: string;
  readonly facilityId: string;
  readonly ready: boolean;
  readonly blockers: readonly OriReadinessBlocker[];
  readonly sources: readonly OriReadinessSource[];
  readonly currentResultId: string | null;
  readonly updateAvailable: boolean;
}

export interface FacilityWorkforceAuthority {
  readonly projectionVersion: "FACILITY_WORKFORCE_AUTHORITY_V1";
  readonly clientId: string; readonly facilityId: string; readonly cutoffAt: string;
  readonly counts: { readonly assignedPersonnel:number;readonly certified:number;readonly activeCertification:number;readonly f096Approved:number;readonly f048Approved:number;readonly credentialIssued:number;readonly currentlyAuthorized:number;readonly personnelWithGaps:number };
  readonly personnel: readonly { readonly staffMemberId:string;readonly fullName:string;readonly employmentStatus:string;readonly certification:null|{readonly certificationNumber:string;readonly level:string;readonly status:string;readonly expiryDate:string};readonly authorities:{readonly f096Approved:boolean;readonly f048Approved:boolean;readonly credentialIssued:boolean;readonly validOperationalAuthorizationCount:number};readonly gaps:readonly string[] }[];
  readonly sourcePrecedence: readonly string[]; readonly checksum:string;
}
export interface PersonnelFormCompleteness { readonly projectionVersion:"PERSONNEL_FORM_COMPLETENESS_V1";readonly clientId:string;readonly facilityId:string;readonly templateCode:string;readonly formCode:"F021";readonly cutoffAt:string;readonly counts:{readonly assignedPersonnel:number;readonly eligible:number;readonly actionRequired:number};readonly personnel:readonly {readonly staffMemberId:string;readonly fullName:string;readonly traineeId:string|null;readonly studentNumber:string|null;readonly trainingEnrollmentId:string|null;readonly status:string;readonly eligibleEvidenceRecordId:string|null;readonly records:readonly {readonly evidenceRecordId:string;readonly lifecycleState:string;readonly eligibleAtCutoff:boolean}[]}[];readonly checksum:string;}
export interface CertificationFormCompleteness {readonly projectionVersion:"CERTIFICATION_FORM_COMPLETENESS_V2";readonly clientId:string;readonly facilityId:string;readonly formCode:"F041"|"F044"|"F047";readonly templateCode:string;readonly counts:{readonly certifications:number;readonly withCurrentEvidence:number;readonly eligibleToRequest:number;readonly dataIssues:number;readonly excluded:number};readonly subjects:readonly {readonly certificationId:string;readonly certificationNumber:string;readonly certificationLevel:string;readonly certificationStatus:string;readonly holderName:string;readonly issueDate:string|null;readonly expiryDate:string|null;readonly eligibility:string;readonly currentRecord:{readonly evidenceRecordId:string;readonly lifecycleState:string}|null;readonly records:readonly {readonly evidenceRecordId:string;readonly lifecycleState:string}[]}[];readonly checksum:string;}

export function getFacilityWorkforceAuthority(clientId:string,facilityId:string){return apiRequest<FacilityWorkforceAuthority>(`/api/v1/clients/${encodeURIComponent(clientId)}/facilities/${encodeURIComponent(facilityId)}/workforce-authority`,{validate:isFacilityWorkforceAuthority});}
export function getPersonnelFormCompleteness(clientId:string,facilityId:string){return apiRequest<PersonnelFormCompleteness>(`/api/v1/clients/${encodeURIComponent(clientId)}/facilities/${encodeURIComponent(facilityId)}/personnel-form-completeness/f021`,{validate:isPersonnelFormCompleteness});}
export function getCertificationFormCompleteness(clientId:string,facilityId:string,formCode:"F041"|"F044"|"F047"){return apiRequest<CertificationFormCompleteness>(`/api/v1/clients/${encodeURIComponent(clientId)}/facilities/${encodeURIComponent(facilityId)}/certification-form-completeness/${formCode.toLowerCase()}`,{validate:isCertificationFormCompleteness});}

export interface OriContribution {
  readonly order: number;
  readonly categoryCode: string;
  readonly categoryName: string;
  readonly weight: string;
  readonly weightedContribution: string;
  readonly source: {
    readonly assessmentId: string;
    readonly assessmentVersion: number;
    readonly professionalCategoryIndex: string;
    readonly lmhc: string;
    readonly finalizedAt: string | null;
    readonly evidenceCutoffAt: string | null;
  };
}

export interface OriResult {
  readonly id: string;
  readonly resultVersion: number;
  readonly clientId: string;
  readonly facilityId: string;
  readonly oriValue: string;
  readonly lmhc: string;
  readonly calculatedAt: string | null;
  readonly resultChecksum: string;
  readonly updateAvailable: boolean;
  readonly contributions: readonly OriContribution[];
}

export interface DomainAssessmentContribution {
  readonly sourceKind: string;
  readonly sourceId: string;
  readonly sourceAt: string | null;
}

export interface DomainAssessmentApplicability {
  readonly formCode: string | null;
  readonly canonicalOrder: number;
  readonly state: string;
  readonly contributions: readonly DomainAssessmentContribution[];
}

export interface DomainAssessmentDetail {
  readonly id: string;
  readonly lifecycle: string;
  readonly applicability: readonly DomainAssessmentApplicability[];
}

export function getFacilityOriReadiness(clientId: string, facilityId: string) {
  return apiRequest<OriReadiness>(
    `/api/v1/clients/${encodeURIComponent(clientId)}/facilities/${encodeURIComponent(facilityId)}/operational-risk-index/readiness`,
    { validate: isOriReadiness }
  );
}

export function calculateFacilityOri(clientId: string, facilityId: string) {
  return apiRequest<{ readonly result: OriResult; readonly replayed: boolean }>(
    `/api/v1/clients/${encodeURIComponent(clientId)}/facilities/${encodeURIComponent(facilityId)}/operational-risk-index`,
    { method: "POST", body: {}, headers: { "idempotency-key": crypto.randomUUID() }, validate: isOriCalculation }
  );
}

export function getCurrentFacilityOri(clientId: string, facilityId: string) {
  return apiRequest<OriResult | null>(
    `/api/v1/clients/${encodeURIComponent(clientId)}/facilities/${encodeURIComponent(facilityId)}/operational-risk-index/current`,
    { validate: (value): value is OriResult | null => value === null || isOriResult(value) }
  );
}

export function getFacilityOriHistory(clientId: string, facilityId: string) {
  return apiRequest<readonly OriResult[]>(
    `/api/v1/clients/${encodeURIComponent(clientId)}/facilities/${encodeURIComponent(facilityId)}/operational-risk-index/history`,
    { validate: (value): value is readonly OriResult[] => Array.isArray(value) && value.every(isOriResult) }
  );
}

export function getDomainAssessmentDetail(assessmentId: string) {
  return apiRequest<DomainAssessmentDetail>(
    `/api/v1/domain-assessments/${encodeURIComponent(assessmentId)}`,
    { validate: isDomainAssessmentDetail }
  );
}

function isOriReadiness(value: unknown): value is OriReadiness {
  if (!isRecord(value) || typeof value.clientId !== "string" || typeof value.facilityId !== "string" || typeof value.ready !== "boolean" || !Array.isArray(value.blockers) || !Array.isArray(value.sources) || (value.currentResultId !== null && typeof value.currentResultId !== "string") || typeof value.updateAvailable !== "boolean") return false;
  return value.blockers.every((item) => isRecord(item) && typeof item.categoryCode === "string" && typeof item.code === "string")
    && value.sources.every((item) => isRecord(item) && typeof item.categoryCode === "string" && typeof item.categoryName === "string" && typeof item.weight === "string" && typeof item.scopeId === "string" && typeof item.assessmentId === "string" && typeof item.assessmentVersion === "number" && typeof item.finalizedAt === "string" && typeof item.evidenceCutoffAt === "string" && typeof item.lmhc === "string" && typeof item.professionalCategoryIndex === "string");
}

function isFacilityWorkforceAuthority(value:unknown):value is FacilityWorkforceAuthority{return isRecord(value)&&value.projectionVersion==="FACILITY_WORKFORCE_AUTHORITY_V1"&&typeof value.clientId==="string"&&typeof value.facilityId==="string"&&typeof value.cutoffAt==="string"&&isRecord(value.counts)&&Array.isArray(value.personnel)&&value.personnel.every((person)=>isRecord(person)&&typeof person.staffMemberId==="string"&&typeof person.fullName==="string"&&Array.isArray(person.gaps))&&Array.isArray(value.sourcePrecedence)&&typeof value.checksum==="string";}
function isPersonnelFormCompleteness(value:unknown):value is PersonnelFormCompleteness{return isRecord(value)&&value.projectionVersion==="PERSONNEL_FORM_COMPLETENESS_V1"&&value.formCode==="F021"&&isRecord(value.counts)&&Array.isArray(value.personnel)&&value.personnel.every((person)=>isRecord(person)&&typeof person.staffMemberId==="string"&&typeof person.fullName==="string"&&Array.isArray(person.records))&&typeof value.checksum==="string";}
function isCertificationFormCompleteness(value:unknown):value is CertificationFormCompleteness{return isRecord(value)&&value.projectionVersion==="CERTIFICATION_FORM_COMPLETENESS_V2"&&(value.formCode==="F041"||value.formCode==="F044"||value.formCode==="F047")&&isRecord(value.counts)&&Array.isArray(value.subjects)&&value.subjects.every((subject)=>isRecord(subject)&&typeof subject.certificationId==="string"&&typeof subject.holderName==="string"&&typeof subject.eligibility==="string"&&Array.isArray(subject.records))&&typeof value.checksum==="string";}

function isOriCalculation(value: unknown): value is { readonly result: OriResult; readonly replayed: boolean } {
  return isRecord(value) && isOriResult(value.result) && typeof value.replayed === "boolean";
}

function isOriResult(value: unknown): value is OriResult {
  return isRecord(value) && typeof value.id === "string" && typeof value.resultVersion === "number"
    && typeof value.clientId === "string" && typeof value.facilityId === "string"
    && typeof value.oriValue === "string" && typeof value.lmhc === "string"
    && (value.calculatedAt === null || typeof value.calculatedAt === "string")
    && typeof value.resultChecksum === "string" && typeof value.updateAvailable === "boolean"
    && Array.isArray(value.contributions) && value.contributions.every((item) => isRecord(item)
      && typeof item.order === "number" && typeof item.categoryCode === "string" && typeof item.categoryName === "string"
      && typeof item.weight === "string" && typeof item.weightedContribution === "string" && isRecord(item.source)
      && typeof item.source.assessmentId === "string" && typeof item.source.assessmentVersion === "number"
      && typeof item.source.professionalCategoryIndex === "string" && typeof item.source.lmhc === "string"
      && (item.source.finalizedAt === null || typeof item.source.finalizedAt === "string")
      && (item.source.evidenceCutoffAt === null || typeof item.source.evidenceCutoffAt === "string"));
}

function isDomainAssessmentDetail(value: unknown): value is DomainAssessmentDetail {
  return isRecord(value) && typeof value.id === "string" && typeof value.lifecycle === "string" && Array.isArray(value.applicability)
    && value.applicability.every((item) => isRecord(item) && (item.formCode === null || typeof item.formCode === "string") && typeof item.canonicalOrder === "number" && typeof item.state === "string" && Array.isArray(item.contributions)
      && item.contributions.every((source) => isRecord(source) && typeof source.sourceKind === "string" && typeof source.sourceId === "string" && (source.sourceAt === null || typeof source.sourceAt === "string")));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
