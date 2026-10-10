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
export interface PersonnelFormCompleteness { readonly projectionVersion:"PERSONNEL_FORM_COMPLETENESS_V1";readonly clientId:string;readonly facilityId:string;readonly templateCode:string;readonly formCode:"F021";readonly cutoffAt:string;readonly counts:{readonly assignedPersonnel:number;readonly eligible:number;readonly actionRequired:number};readonly personnel:readonly {readonly staffMemberId:string;readonly fullName:string;readonly traineeId:string|null;readonly studentNumber:string|null;readonly trainingEnrollmentId:string|null;readonly status:string;readonly eligibleEvidenceRecordId:string|null;readonly currentEvidenceRecordId?:string|null;readonly historicalEvidenceRecordId?:string|null;readonly historicalTemplateVersion?:string|null;readonly historicalLifecycleState?:string|null;readonly historicalRecords?:readonly PersonnelFormEvidenceRecord[];readonly records:readonly PersonnelFormEvidenceRecord[]}[];readonly checksum:string;}
export interface PersonnelFormEvidenceRecord {readonly evidenceRecordId:string;readonly trainingEnrollmentId?:string|null;readonly lifecycleState:string;readonly templateVersion?:string;readonly currentTemplateVersion?:boolean;readonly submittedAt?:string|null;readonly createdAt?:string|null;readonly eligibleAtCutoff:boolean;}
export interface CertificationEvidenceSummary {readonly evidenceRecordId:string;readonly lifecycleState:string;readonly templateVersion?:string;readonly submittedAt?:string|null;}
export interface CertificationFormCompleteness {readonly projectionVersion:"CERTIFICATION_FORM_COMPLETENESS_V2";readonly clientId:string;readonly facilityId:string;readonly formCode:"F041"|"F044"|"F047";readonly templateCode:string;readonly counts:{readonly certifications:number;readonly withCurrentEvidence:number;readonly eligibleToRequest:number;readonly dataIssues:number;readonly excluded:number};readonly subjects:readonly {readonly certificationId:string;readonly certificationNumber:string;readonly certificationLevel:string;readonly certificationStatus:string;readonly holderName:string;readonly issueDate:string|null;readonly expiryDate:string|null;readonly eligibility:string;readonly currentRecord:CertificationEvidenceSummary|null;readonly historicalApprovedRecords?:readonly CertificationEvidenceSummary[];readonly records:readonly CertificationEvidenceSummary[]}[];readonly checksum:string;}
export interface AssetFormEvidenceRecord {readonly evidenceRecordId:string;readonly lifecycleState:string;readonly templateVersionId:string;readonly templateVersion:string;readonly payloadChecksum:string;readonly createdByUserId:string|null;readonly createdAt:string|null;readonly submittedAt:string|null;}
export type AssetJourneyFormCode="F081"|"F082"|"F084"|"F085"|"F086"|"F087"|"F088"|"F089";
export interface AssetFormCompleteness {readonly projectionVersion:"F081_ASSET_FORM_COMPLETENESS_V1"|"ASSET_FORM_COMPLETENESS_V2";readonly clientId:string;readonly facilityId:string;readonly formCode?:AssetJourneyFormCode;readonly templateCode:string;readonly currentTemplateVersionId:string;readonly counts:{readonly eligibleAssets:number;readonly withCurrentEvidence:number;readonly activeDrafts:number;readonly withoutEvidence:number;readonly conflicts:number};readonly assets:readonly {readonly assetId:string;readonly assetNumber:string;readonly equipmentName:string;readonly equipmentCategory:string;readonly lifecycleStatus:string;readonly status:string;readonly activeDraft:AssetFormEvidenceRecord|null;readonly currentRecord:AssetFormEvidenceRecord|null;readonly historicalRecords:readonly AssetFormEvidenceRecord[];readonly canCreate:boolean}[];readonly checksum:string;}
export type F081AssetFormCompleteness=AssetFormCompleteness;
export interface IncidentFormCompleteness {readonly projectionVersion:"INCIDENT_FORM_COMPLETENESS_V1";readonly clientId:string;readonly facilityId:string;readonly formCode:"F063"|"F064"|"F065"|"F066";readonly templateCode:string;readonly currentTemplateVersionId:string;readonly counts:{readonly incidents:number;readonly withCurrentEvidence:number;readonly activeDrafts:number;readonly withoutEvidence:number;readonly conflicts:number};readonly incidents:readonly {readonly incidentId:string;readonly incidentNumber:string;readonly incidentType:string;readonly incidentStatus:string;readonly incidentDate:string;readonly incidentLocation:string|null;readonly status:string;readonly activeDraft:AssetFormEvidenceRecord|null;readonly currentRecord:AssetFormEvidenceRecord|null;readonly historicalRecords:readonly AssetFormEvidenceRecord[];readonly canCreate:boolean}[];readonly checksum:string;}
export interface FindingFormCompleteness {readonly projectionVersion:"F083_FINDING_FORM_COMPLETENESS_V1";readonly clientId:string;readonly facilityId:string;readonly formCode:"F083";readonly templateCode:string;readonly currentTemplateVersionId:string;readonly counts:{readonly findings:number;readonly withCurrentEvidence:number;readonly activeDrafts:number;readonly withoutEvidence:number;readonly conflicts:number};readonly findings:readonly {readonly findingId:string;readonly findingIdentifier:string;readonly findingClassification:string;readonly findingDescription:string;readonly assetIdentifier:string;readonly status:string;readonly activeDraft:AssetFormEvidenceRecord|null;readonly currentRecord:AssetFormEvidenceRecord|null;readonly historicalRecords:readonly AssetFormEvidenceRecord[];readonly canCreate:boolean}[];readonly checksum:string;}
export type TrainingCompetencyJourneyFormCode="F022"|"F023"|"F024"|"F025"|"F026"|"F027"|"F090"|"F091"|"F092"|"F093"|"F095";
export interface TrainingCompetencyEvidenceRecord {readonly evidenceRecordId:string;readonly templateVersionId:string;readonly templateVersion:string;readonly lifecycleState:string;readonly createdByUserId:string|null;readonly createdAt:string;readonly submittedAt:string|null;}
export interface TrainingCompetencyFormCompleteness {readonly projectionVersion:"TRAINING_COMPETENCY_MULTI_RECORD_V1";readonly clientId:string;readonly facilityId:string;readonly formCode:TrainingCompetencyJourneyFormCode;readonly templateCode:string;readonly currentTemplateVersionId:string;readonly cardinality:{readonly subjectKind:string;readonly recordModel:string;readonly authorityState:string;readonly creationOwner:string;readonly contextRequirementCode:string|null;readonly governedDuplicatePolicy:string|null};readonly counts:{readonly subjects:number;readonly withCurrentEvidence:number;readonly activeDrafts:number;readonly withoutEvidence:number;readonly conflicts:number};readonly subjects:readonly {readonly subjectId:string;readonly primaryLabel:string;readonly secondaryLabel:string|null;readonly sourcePath:string|null;readonly status:string;readonly activeDrafts:readonly TrainingCompetencyEvidenceRecord[];readonly currentRecord:TrainingCompetencyEvidenceRecord|null;readonly historicalRecords:readonly TrainingCompetencyEvidenceRecord[];readonly actions:{readonly canContinue:boolean;readonly canView:boolean;readonly canStart:boolean;readonly startOwner:string}}[];readonly checksum:string;}
export type FacilityEnvironmentalSafetyJourneyFormCode="F002"|"F901"|"F902"|"F903"|"F904"|"F905"|"F912";
export interface FacilityEnvironmentalSafetyFormCompleteness {readonly projectionVersion:"FACILITY_ENVIRONMENTAL_SAFETY_MULTI_RECORD_V1";readonly projectionStatus:"READY"|"AUTHORITY_BLOCKED";readonly creationBlocker:string|null;readonly clientId:string;readonly facilityId:string;readonly formCode:FacilityEnvironmentalSafetyJourneyFormCode;readonly templateCode:string;readonly currentTemplateVersionId:string;readonly cardinality:{readonly subjectKind:string;readonly recordModel:string;readonly authorityState:string;readonly creationOwner:string;readonly contextRequirementCode:string|null;readonly governedDuplicatePolicy:string|null;readonly embeddedCollectionModel:string|null};readonly counts:{readonly subjects:number;readonly withCurrentEvidence:number;readonly activeDrafts:number;readonly withoutEvidence:number;readonly conflicts:number;readonly unboundRecords:number};readonly subjects:readonly {readonly subjectId:string;readonly primaryLabel:string;readonly secondaryLabel:string|null;readonly sourcePath:string|null;readonly status:string;readonly activeDrafts:readonly TrainingCompetencyEvidenceRecord[];readonly currentRecord:TrainingCompetencyEvidenceRecord|null;readonly historicalRecords:readonly TrainingCompetencyEvidenceRecord[];readonly actions:{readonly canContinue:boolean;readonly canView:boolean;readonly canStart:boolean;readonly startOwner:string}}[];readonly unboundRecords:readonly TrainingCompetencyEvidenceRecord[];readonly checksum:string;}
export type PublicSafetySystemsJourneyFormCode="F913"|"F914"|"F915"|"F916"|"F918"|"F920";
export type PublicSafetySystemsFormCompleteness=Omit<FacilityEnvironmentalSafetyFormCompleteness,"projectionVersion"|"formCode">&{readonly projectionVersion:"PUBLIC_SAFETY_SYSTEMS_MULTI_RECORD_V2";readonly formCode:PublicSafetySystemsJourneyFormCode};
export type EquipmentInspectionProgramsJourneyFormCode="F081"|"F082"|"F083"|"F084"|"F085"|"F086"|"F087"|"F904"|"F905";
export type EquipmentInspectionProgramsFormCompleteness=Omit<FacilityEnvironmentalSafetyFormCompleteness,"projectionVersion"|"formCode">&{readonly projectionVersion:"EQUIPMENT_INSPECTION_PROGRAMS_MULTI_RECORD_V1";readonly formCode:EquipmentInspectionProgramsJourneyFormCode};

export function getFacilityWorkforceAuthority(clientId:string,facilityId:string){return apiRequest<FacilityWorkforceAuthority>(`/api/v1/clients/${encodeURIComponent(clientId)}/facilities/${encodeURIComponent(facilityId)}/workforce-authority`,{validate:isFacilityWorkforceAuthority});}
export function getPersonnelFormCompleteness(clientId:string,facilityId:string){return apiRequest<PersonnelFormCompleteness>(`/api/v1/clients/${encodeURIComponent(clientId)}/facilities/${encodeURIComponent(facilityId)}/personnel-form-completeness/f021`,{validate:isPersonnelFormCompleteness});}
export function getCertificationFormCompleteness(clientId:string,facilityId:string,formCode:"F041"|"F044"|"F047"){return apiRequest<CertificationFormCompleteness>(`/api/v1/clients/${encodeURIComponent(clientId)}/facilities/${encodeURIComponent(facilityId)}/certification-form-completeness/${formCode.toLowerCase()}`,{validate:isCertificationFormCompleteness});}
export function getAssetFormCompleteness(clientId:string,facilityId:string,formCode:AssetJourneyFormCode){return apiRequest<AssetFormCompleteness>(`/api/v1/clients/${encodeURIComponent(clientId)}/facilities/${encodeURIComponent(facilityId)}/asset-form-completeness/${formCode.toLowerCase()}`,{validate:isAssetFormCompleteness});}
export function getF081AssetFormCompleteness(clientId:string,facilityId:string){return getAssetFormCompleteness(clientId,facilityId,"F081");}
export function getIncidentFormCompleteness(clientId:string,facilityId:string,formCode:"F063"|"F064"|"F065"|"F066"){return apiRequest<IncidentFormCompleteness>(`/api/v1/clients/${encodeURIComponent(clientId)}/facilities/${encodeURIComponent(facilityId)}/incident-form-completeness/${formCode.toLowerCase()}`,{validate:isIncidentFormCompleteness});}
export function getF083FindingFormCompleteness(clientId:string,facilityId:string){return apiRequest<FindingFormCompleteness>(`/api/v1/clients/${encodeURIComponent(clientId)}/facilities/${encodeURIComponent(facilityId)}/finding-form-completeness/f083`,{validate:(value):value is FindingFormCompleteness=>isRecord(value)&&value.projectionVersion==="F083_FINDING_FORM_COMPLETENESS_V1"&&Array.isArray(value.findings)&&typeof value.checksum==="string"});}
export function getTrainingCompetencyFormCompleteness(clientId:string,facilityId:string,formCode:TrainingCompetencyJourneyFormCode){return apiRequest<TrainingCompetencyFormCompleteness>(`/api/v1/clients/${encodeURIComponent(clientId)}/facilities/${encodeURIComponent(facilityId)}/training-competency-form-completeness/${formCode.toLowerCase()}`,{validate:isTrainingCompetencyFormCompleteness});}
export function getFacilityEnvironmentalSafetyFormCompleteness(clientId:string,facilityId:string,formCode:FacilityEnvironmentalSafetyJourneyFormCode){return apiRequest<FacilityEnvironmentalSafetyFormCompleteness>(`/api/v1/clients/${encodeURIComponent(clientId)}/facilities/${encodeURIComponent(facilityId)}/facility-environmental-safety-form-completeness/${formCode.toLowerCase()}`,{validate:isFacilityEnvironmentalSafetyFormCompleteness});}
export function getPublicSafetySystemsFormCompleteness(clientId:string,facilityId:string,formCode:PublicSafetySystemsJourneyFormCode){return apiRequest<PublicSafetySystemsFormCompleteness>(`/api/v1/clients/${encodeURIComponent(clientId)}/facilities/${encodeURIComponent(facilityId)}/public-safety-systems-form-completeness/${formCode.toLowerCase()}`,{validate:isPublicSafetySystemsFormCompleteness});}
export function getEquipmentInspectionProgramsFormCompleteness(clientId:string,facilityId:string,formCode:EquipmentInspectionProgramsJourneyFormCode){return apiRequest<EquipmentInspectionProgramsFormCompleteness>(`/api/v1/clients/${encodeURIComponent(clientId)}/facilities/${encodeURIComponent(facilityId)}/equipment-inspection-programs-form-completeness/${formCode.toLowerCase()}`,{validate:isEquipmentInspectionProgramsFormCompleteness});}

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
function isAssetFormCompleteness(value:unknown):value is AssetFormCompleteness{return isRecord(value)&&(value.projectionVersion==="F081_ASSET_FORM_COMPLETENESS_V1"||value.projectionVersion==="ASSET_FORM_COMPLETENESS_V2")&&(value.formCode===undefined||["F081","F082","F084","F085","F086","F087","F088","F089"].includes(String(value.formCode)))&&typeof value.templateCode==="string"&&typeof value.currentTemplateVersionId==="string"&&isRecord(value.counts)&&Array.isArray(value.assets)&&value.assets.every((asset)=>isRecord(asset)&&typeof asset.assetId==="string"&&typeof asset.assetNumber==="string"&&typeof asset.equipmentName==="string"&&typeof asset.status==="string"&&typeof asset.canCreate==="boolean"&&Array.isArray(asset.historicalRecords))&&typeof value.checksum==="string";}
function isIncidentFormCompleteness(value:unknown):value is IncidentFormCompleteness{return isRecord(value)&&value.projectionVersion==="INCIDENT_FORM_COMPLETENESS_V1"&&["F063","F064","F065","F066"].includes(String(value.formCode))&&typeof value.templateCode==="string"&&typeof value.currentTemplateVersionId==="string"&&isRecord(value.counts)&&Array.isArray(value.incidents)&&value.incidents.every(item=>isRecord(item)&&typeof item.incidentId==="string"&&typeof item.incidentNumber==="string"&&typeof item.incidentType==="string"&&typeof item.status==="string"&&typeof item.canCreate==="boolean"&&Array.isArray(item.historicalRecords))&&typeof value.checksum==="string";}
function isTrainingCompetencyFormCompleteness(value:unknown):value is TrainingCompetencyFormCompleteness{return isRecord(value)&&value.projectionVersion==="TRAINING_COMPETENCY_MULTI_RECORD_V1"&&["F022","F023","F024","F025","F027","F090","F091","F092","F093","F095"].includes(String(value.formCode))&&typeof value.templateCode==="string"&&typeof value.currentTemplateVersionId==="string"&&isRecord(value.cardinality)&&isRecord(value.counts)&&Array.isArray(value.subjects)&&value.subjects.every(subject=>isRecord(subject)&&typeof subject.subjectId==="string"&&typeof subject.primaryLabel==="string"&&Array.isArray(subject.activeDrafts)&&Array.isArray(subject.historicalRecords)&&isRecord(subject.actions))&&typeof value.checksum==="string";}
function isFacilityEnvironmentalSafetyFormCompleteness(value:unknown):value is FacilityEnvironmentalSafetyFormCompleteness{return isRecord(value)&&value.projectionVersion==="FACILITY_ENVIRONMENTAL_SAFETY_MULTI_RECORD_V1"&&(value.projectionStatus==="READY"||value.projectionStatus==="AUTHORITY_BLOCKED")&&["F002","F901","F902","F903","F904","F905","F912"].includes(String(value.formCode))&&typeof value.templateCode==="string"&&typeof value.currentTemplateVersionId==="string"&&isRecord(value.cardinality)&&isRecord(value.counts)&&Array.isArray(value.subjects)&&value.subjects.every(subject=>isRecord(subject)&&typeof subject.subjectId==="string"&&typeof subject.primaryLabel==="string"&&Array.isArray(subject.activeDrafts)&&Array.isArray(subject.historicalRecords)&&isRecord(subject.actions))&&Array.isArray(value.unboundRecords)&&typeof value.checksum==="string";}
function isPublicSafetySystemsFormCompleteness(value:unknown):value is PublicSafetySystemsFormCompleteness{return isRecord(value)&&value.projectionVersion==="PUBLIC_SAFETY_SYSTEMS_MULTI_RECORD_V2"&&value.projectionStatus==="READY"&&["F913","F914","F915","F916","F918","F920"].includes(String(value.formCode))&&typeof value.templateCode==="string"&&typeof value.currentTemplateVersionId==="string"&&isRecord(value.cardinality)&&isRecord(value.counts)&&Array.isArray(value.subjects)&&value.subjects.every(subject=>isRecord(subject)&&typeof subject.subjectId==="string"&&typeof subject.primaryLabel==="string"&&Array.isArray(subject.activeDrafts)&&Array.isArray(subject.historicalRecords)&&isRecord(subject.actions))&&Array.isArray(value.unboundRecords)&&typeof value.checksum==="string";}
function isEquipmentInspectionProgramsFormCompleteness(value:unknown):value is EquipmentInspectionProgramsFormCompleteness{return isRecord(value)&&value.projectionVersion==="EQUIPMENT_INSPECTION_PROGRAMS_MULTI_RECORD_V1"&&(value.projectionStatus==="READY"||value.projectionStatus==="AUTHORITY_BLOCKED")&&["F081","F082","F083","F084","F085","F086","F087","F904","F905"].includes(String(value.formCode))&&typeof value.templateCode==="string"&&typeof value.currentTemplateVersionId==="string"&&isRecord(value.cardinality)&&isRecord(value.counts)&&Array.isArray(value.subjects)&&value.subjects.every(subject=>isRecord(subject)&&typeof subject.subjectId==="string"&&typeof subject.primaryLabel==="string"&&Array.isArray(subject.activeDrafts)&&Array.isArray(subject.historicalRecords)&&isRecord(subject.actions))&&Array.isArray(value.unboundRecords)&&typeof value.checksum==="string";}

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
