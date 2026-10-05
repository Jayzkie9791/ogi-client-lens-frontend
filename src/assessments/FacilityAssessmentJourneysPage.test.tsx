import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FacilityAssessmentJourneysPage } from "./FacilityAssessmentJourneysPage";
import { calculateFacilityOri, getAssetFormCompleteness, getCertificationFormCompleteness, getCurrentFacilityOri, getDomainAssessmentDetail, getEquipmentInspectionProgramsFormCompleteness, getF081AssetFormCompleteness, getFacilityEnvironmentalSafetyFormCompleteness, getFacilityOriHistory, getFacilityOriReadiness, getFacilityWorkforceAuthority, getIncidentFormCompleteness, getPersonnelFormCompleteness, getPublicSafetySystemsFormCompleteness, getTrainingCompetencyFormCompleteness } from "./facilityAssessmentApi";
import { listOetsTemplateCatalog } from "../oets/templateCatalogApi";
import { listOperationalEvidenceRecords } from "../oets/recordsApi";
import { listFeatureClients } from "../api/featureScopedDiscoveryApi";

const runtimeTemplateSpy = vi.hoisted(() => vi.fn());
const canUsePermissionSpy = vi.hoisted(() => vi.fn((permission:string) => ["view_domain_assessment","review_domain_assessment"].includes(permission)));

vi.mock("../api/featureScopedDiscoveryApi", () => ({
  listFeatureClients: vi.fn(async () => ({ clients: [{ id: "client-1", business_identifier: "CLIENT-2026-000016", organization_name: "Braven Resorts", status: "ACTIVE", created_at: "2026-01-01", updated_at: "2026-01-01" }] })),
  listFeatureFacilities: vi.fn(async () => ({ facilities: [{ id: "facility-1", client_id: "client-1", business_identifier: "FACILITY-2026-000017", facility_name: "Sky Ranch", facility_type: "WATERPARK", operational_status: "ACTIVE", created_at: "2026-01-01", updated_at: "2026-01-01" }] }))
}));
vi.mock("../auth/useAuth", () => ({ useAuth: () => ({ session: { id: "user-1", fullName: "Maria Hannah Khrisna Depacaquivo" }, canUsePermission: canUsePermissionSpy }) }));
vi.mock("../oets/templateCatalogApi", () => ({ listOetsTemplateCatalog: vi.fn(async () => ({ templates: [] })) }));
vi.mock("../oets/recordsApi", () => ({ listOperationalEvidenceRecords: vi.fn(async () => ({ records: [], pagination: { limit: 100, offset: 0, count: 0, total_count: 0 } })) }));
vi.mock("../oets/RuntimeTemplatePage", () => ({ RuntimeTemplatePage: (props: { onDirtyChange: (dirty: boolean) => void; initialFieldValues: Record<string, unknown> }) => { runtimeTemplateSpy(props); return <input aria-label="Mock canonical form field" onChange={() => props.onDirtyChange(true)} />; } }));
vi.mock("../oets/OperationalEvidenceRecordPage", () => ({ OperationalEvidenceRecordPage: () => <div>Mock existing evidence editor</div> }));
vi.mock("./facilityAssessmentApi", () => ({
  getFacilityOriReadiness: vi.fn(async () => ({ clientId: "client-1", facilityId: "facility-1", ready: false, currentResultId: null, updateAvailable: false, blockers: [
    { categoryCode: "LIFEGUARD_OPERATIONS", code: "MISSING_FACILITY_WIDE_FINAL" }, { categoryCode: "EMERGENCY_PREPAREDNESS", code: "MISSING_FACILITY_WIDE_FINAL" }, { categoryCode: "RESCUE_EQUIPMENT_ASSETS", code: "MISSING_FACILITY_WIDE_FINAL" }, { categoryCode: "TRAINING_COMPETENCY", code: "MISSING_FACILITY_WIDE_FINAL" }, { categoryCode: "FACILITY_ENVIRONMENTAL_SAFETY", code: "MISSING_FACILITY_WIDE_FINAL" }, { categoryCode: "INCIDENT_MANAGEMENT", code: "MISSING_FACILITY_WIDE_FINAL" }, { categoryCode: "PUBLIC_SAFETY_SYSTEMS", code: "MISSING_FACILITY_WIDE_FINAL" }, { categoryCode: "EQUIPMENT_INSPECTION_PROGRAMS", code: "MISSING_FACILITY_WIDE_FINAL" }
  ], sources: [{ categoryCode: "GOVERNANCE_DOCUMENTATION", categoryName: "Governance & Documentation", weight: "0.10", scopeId: "scope-1", assessmentId: "assessment-1", assessmentVersion: 1, finalizedAt: "2026-09-01T00:00:00.000Z", evidenceCutoffAt: "2026-08-31T00:00:00.000Z", lmhc: "LOW", professionalCategoryIndex: "91" }] })),
  getCurrentFacilityOri: vi.fn(async () => null),
  getFacilityOriHistory: vi.fn(async () => []),
  getFacilityWorkforceAuthority: vi.fn(async () => ({ projectionVersion: "FACILITY_WORKFORCE_AUTHORITY_V1", clientId: "client-1", facilityId: "facility-1", cutoffAt: "2026-09-14T00:00:00.000Z", counts: { assignedPersonnel: 1, certified: 1, activeCertification: 1, f096Approved: 1, f048Approved: 0, credentialIssued: 0, currentlyAuthorized: 0, personnelWithGaps: 1 }, personnel: [{ staffMemberId: "staff-1", fullName: "Sky Alcantara", employmentStatus: "ACTIVE", certification: { certificationNumber: "OGI-GR-2026-000032", level: "L1", status: "ACTIVE", expiryDate: "2027-09-14T00:00:00.000Z" }, authorities: { f096Approved: true, f048Approved: false, credentialIssued: false, validOperationalAuthorizationCount: 0 }, gaps: ["F048_CREDENTIAL_EVIDENCE_NOT_APPROVED"] }], sourcePrecedence: ["ACTIVE_FACILITY_STAFF_ASSIGNMENT"], checksum: "a".repeat(64) })),
  getPersonnelFormCompleteness: vi.fn(async () => ({ projectionVersion:"PERSONNEL_FORM_COMPLETENESS_V1",clientId:"client-1",facilityId:"facility-1",templateCode:"OGI_F021_PERSONNEL_REGISTRATION_COMPETENCY_PROFILE",formCode:"F021",cutoffAt:"2026-09-14T00:00:00.000Z",counts:{assignedPersonnel:1,eligible:1,actionRequired:0},personnel:[{staffMemberId:"staff-1",fullName:"Sky Alcantara",traineeId:"trainee-1",studentNumber:"OGI-STU-1",trainingEnrollmentId:"enrollment-1",status:"ELIGIBLE",eligibleEvidenceRecordId:"evidence-f021",records:[]}],checksum:"b".repeat(64)})),
  getF081AssetFormCompleteness: vi.fn(async () => ({projectionVersion:"F081_ASSET_FORM_COMPLETENESS_V1",clientId:"client-1",facilityId:"facility-1",templateCode:"OGI_F081_EQUIPMENT_INSPECTION_REPORT",currentTemplateVersionId:"version-f081",counts:{eligibleAssets:0,withCurrentEvidence:0,activeDrafts:0,withoutEvidence:0,conflicts:0},assets:[],checksum:"8".repeat(64)})),
  getAssetFormCompleteness: vi.fn(async (_clientId:string,_facilityId:string,formCode:"F081"|"F082"|"F084"|"F085"|"F086"|"F087"|"F088"|"F089") => ({projectionVersion:formCode==="F081"?"F081_ASSET_FORM_COMPLETENESS_V1":"ASSET_FORM_COMPLETENESS_V2",clientId:"client-1",facilityId:"facility-1",formCode,templateCode:`OGI_${formCode}`,currentTemplateVersionId:`version-${formCode.toLowerCase()}`,counts:{eligibleAssets:0,withCurrentEvidence:0,activeDrafts:0,withoutEvidence:0,conflicts:0},assets:[],checksum:"8".repeat(64)})),
  getF083FindingFormCompleteness:vi.fn(async()=>({projectionVersion:"F083_FINDING_FORM_COMPLETENESS_V1",clientId:"client-1",facilityId:"facility-1",formCode:"F083",templateCode:"OGI_F083_EQUIPMENT_DEFICIENCY_REPORT",currentTemplateVersionId:"version-f083",counts:{findings:0,withCurrentEvidence:0,activeDrafts:0,withoutEvidence:0,conflicts:0},findings:[],checksum:"f".repeat(64)})),
  getIncidentFormCompleteness:vi.fn(async(_clientId:string,_facilityId:string,formCode:"F063"|"F064"|"F065"|"F066")=>({projectionVersion:"INCIDENT_FORM_COMPLETENESS_V1",clientId:"client-1",facilityId:"facility-1",formCode,templateCode:`OGI_${formCode}`,currentTemplateVersionId:`version-${formCode.toLowerCase()}`,counts:{incidents:0,withCurrentEvidence:0,activeDrafts:0,withoutEvidence:0,conflicts:0},incidents:[],checksum:"d".repeat(64)})),
  getTrainingCompetencyFormCompleteness:vi.fn(async(_clientId:string,_facilityId:string,formCode:"F022"|"F023"|"F024"|"F025"|"F027"|"F090"|"F091"|"F092"|"F093"|"F095")=>{const personnel=["F090","F092","F093","F095"].includes(formCode),session=formCode==="F022"||formCode==="F027"||formCode==="F091",oee=personnel||formCode==="F027"||formCode==="F091";return{projectionVersion:"TRAINING_COMPETENCY_MULTI_RECORD_V1",clientId:"client-1",facilityId:"facility-1",formCode,templateCode:`OGI_${formCode}`,currentTemplateVersionId:`version-${formCode.toLowerCase()}`,cardinality:{subjectKind:personnel?"PERSONNEL":session?"TRAINING_SESSION":"TRAINING_ENROLLMENT",recordModel:"ONE_PER_ENROLLMENT_PURPOSE",authorityState:oee?"GOVERNED_CONTEXT_REGISTRY":"GOVERNED_EXTERNAL_WORKFLOW",creationOwner:oee?"OPERATIONAL_EVIDENCE":"TRAINING_JOURNEY",contextRequirementCode:personnel?"PERSONNEL_CONTEXT":session&&oee?"TRAINING_SESSION_CONTEXT":null,governedDuplicatePolicy:null},counts:{subjects:0,withCurrentEvidence:0,activeDrafts:0,withoutEvidence:0,conflicts:0},subjects:[],checksum:"9".repeat(64)}}),
  getFacilityEnvironmentalSafetyFormCompleteness:vi.fn(async()=>({projectionVersion:"FACILITY_ENVIRONMENTAL_SAFETY_MULTI_RECORD_V1",projectionStatus:"READY",creationBlocker:null,clientId:"client-1",facilityId:"facility-1",formCode:"F905",templateCode:"OGI_F905_CHECKLIST_INSPECTION",currentTemplateVersionId:"version-f905",cardinality:{subjectKind:"AUDIT_APPOINTMENT",recordModel:"ONE_PER_AUDIT_APPOINTMENT",authorityState:"GOVERNED_CONTEXT_REGISTRY",creationOwner:"OPERATIONAL_EVIDENCE",contextRequirementCode:"AUDIT_APPOINTMENT_CONTEXT",governedDuplicatePolicy:"ONE_EVIDENCE_LINEAGE_PER_SUBJECT",embeddedCollectionModel:null},counts:{subjects:0,withCurrentEvidence:0,activeDrafts:0,withoutEvidence:0,conflicts:0,unboundRecords:0},subjects:[],unboundRecords:[],checksum:"6".repeat(64)})),
  getPublicSafetySystemsFormCompleteness:vi.fn(async(_clientId:string,_facilityId:string,formCode:string)=>({projectionVersion:"PUBLIC_SAFETY_SYSTEMS_MULTI_RECORD_V2",projectionStatus:"READY",creationBlocker:null,clientId:"client-1",facilityId:"facility-1",formCode,templateCode:`OGI_${formCode}`,currentTemplateVersionId:`version-${formCode.toLowerCase()}`,cardinality:{subjectKind:"GOVERNED_PUBLIC_SAFETY_SUBJECT",recordModel:"ONE_PER_SUBJECT",authorityState:"GOVERNED_CONTEXT_REGISTRY",creationOwner:"OPERATIONAL_EVIDENCE",contextRequirementCode:"GOVERNED_CONTEXT",governedDuplicatePolicy:"ONE_EVIDENCE_LINEAGE_PER_SUBJECT",embeddedCollectionModel:null,authorityReuse:null},counts:{subjects:0,withCurrentEvidence:0,activeDrafts:0,withoutEvidence:0,conflicts:0,unboundRecords:0},subjects:[],unboundRecords:[],conflicts:[],actions:{canStart:true,canContinue:false,canBind:false,canViewUnboundEvidence:false,startOwner:"OPERATIONAL_EVIDENCE"},checksum:"7".repeat(64)})),
  getCertificationFormCompleteness: vi.fn(async (_clientId:string,_facilityId:string,formCode:"F041"|"F044"|"F047") => ({projectionVersion:"CERTIFICATION_FORM_COMPLETENESS_V2",clientId:"client-1",facilityId:"facility-1",formCode,templateCode:formCode,counts:{certifications:1,withCurrentEvidence:0,eligibleToRequest:formCode==="F044"?1:0,dataIssues:0,excluded:0},subjects:[{certificationId:"cert-1",certificationNumber:"OGI-GR-1",certificationLevel:"L1",certificationStatus:"ACTIVE",holderName:"Sky Alcantara",issueDate:"2026-01-01T00:00:00.000Z",expiryDate:"2027-01-01T00:00:00.000Z",eligibility:formCode==="F041"?"RECORDABLE":formCode==="F044"?"ELIGIBLE_TO_REQUEST":"VERIFIABLE",currentRecord:null,records:[]}],checksum:"c".repeat(64)})),
  getEquipmentInspectionProgramsFormCompleteness:vi.fn(async(_clientId:string,_facilityId:string,formCode:string)=>({projectionVersion:"EQUIPMENT_INSPECTION_PROGRAMS_MULTI_RECORD_V1",projectionStatus:"READY",creationBlocker:null,clientId:"client-1",facilityId:"facility-1",formCode,templateCode:`OGI_${formCode}`,currentTemplateVersionId:`version-${formCode.toLowerCase()}`,cardinality:{subjectKind:"EQUIPMENT_ASSET",recordModel:"RECURRING_PER_ASSET",authorityState:"GOVERNED_ASSET_CONTEXT",creationOwner:"OPERATIONAL_EVIDENCE",contextRequirementCode:"ASSET_CONTEXT",governedDuplicatePolicy:"ONE_ACTIVE_DRAFT_PER_SUBJECT",embeddedCollectionModel:null},counts:{subjects:0,withCurrentEvidence:0,activeDrafts:0,withoutEvidence:0,conflicts:0,unboundRecords:0},subjects:[],unboundRecords:[],checksum:"e".repeat(64)})),
  calculateFacilityOri: vi.fn(),
  getDomainAssessmentDetail: vi.fn(async () => ({ id: "assessment-1", lifecycle: "FINAL", applicability: [{ formCode: "F002", canonicalOrder: 1, state: "APPLICABLE", contributions: [{ sourceKind: "OPERATIONAL_EVIDENCE", sourceId: "evidence-1", sourceAt: "2026-08-30T00:00:00.000Z" }] }] }))
}));

describe("FacilityAssessmentJourneysPage", () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    vi.clearAllMocks();
    canUsePermissionSpy.mockImplementation((permission:string) => ["view_domain_assessment","review_domain_assessment"].includes(permission));
    vi.mocked(listOetsTemplateCatalog).mockResolvedValue({ templates: [] });
    vi.mocked(listOperationalEvidenceRecords).mockResolvedValue({ records: [], pagination: { limit: 100, offset: 0, count: 0, total_count: 0 } });
    vi.mocked(getCurrentFacilityOri).mockResolvedValue(null);
    vi.mocked(getFacilityOriHistory).mockResolvedValue([]);
    vi.mocked(getFacilityWorkforceAuthority).mockClear();
    vi.mocked(getPersonnelFormCompleteness).mockClear();
    vi.mocked(getF081AssetFormCompleteness).mockClear();
    vi.mocked(getAssetFormCompleteness).mockClear();
    vi.mocked(getIncidentFormCompleteness).mockClear();
    vi.mocked(getTrainingCompetencyFormCompleteness).mockClear();
    vi.mocked(getFacilityEnvironmentalSafetyFormCompleteness).mockClear();
    vi.mocked(getPublicSafetySystemsFormCompleteness).mockClear();
    vi.mocked(getEquipmentInspectionProgramsFormCompleteness).mockClear();
    vi.mocked(getCertificationFormCompleteness).mockClear();
  });

  it("renders governed Category 9 subjects and starts with exact existing context",async()=>{
    vi.mocked(listOetsTemplateCatalog).mockResolvedValue({templates:[{template_registry_id:"registry-f081",template_version_id:"version-f081",template_code:"OGI_F081_EQUIPMENT_INSPECTION_REPORT",template_name:"Equipment Inspection Report",template_archetype:"REPORT",module:"AUDIT",template_version:"3.5",schema_version:"1",checksum:"checksum-f081",registry_status:"ACTIVE",version_status:"ACTIVE",description:null,business_context:null,document_number:"OGI F-081",document_revision:"3.5",registered_at:"2026-10-01",last_synchronized_at:null}]});
    vi.mocked(getEquipmentInspectionProgramsFormCompleteness).mockImplementation(async(_client,_facility,formCode)=>({projectionVersion:"EQUIPMENT_INSPECTION_PROGRAMS_MULTI_RECORD_V1",projectionStatus:"READY",creationBlocker:null,clientId:"client-1",facilityId:"facility-1",formCode,templateCode:`OGI_${formCode}`,currentTemplateVersionId:`version-${formCode.toLowerCase()}`,cardinality:{subjectKind:formCode==="F083"?"INSPECTION_FINDING":"EQUIPMENT_ASSET",recordModel:formCode==="F083"?"ONE_PER_INSPECTION_FINDING":"RECURRING_PER_ASSET",authorityState:"GOVERNED_ASSET_CONTEXT",creationOwner:"OPERATIONAL_EVIDENCE",contextRequirementCode:formCode==="F083"?"INSPECTION_FINDING_CONTEXT":"ASSET_CONTEXT",governedDuplicatePolicy:"ONE_ACTIVE_DRAFT_PER_SUBJECT",embeddedCollectionModel:null},counts:{subjects:1,withCurrentEvidence:0,activeDrafts:0,withoutEvidence:1,conflicts:0,unboundRecords:0},subjects:[{subjectId:`subject-${formCode.toLowerCase()}`,primaryLabel:`${formCode}-SUBJECT`,secondaryLabel:`Governed ${formCode} subject`,sourcePath:null,status:"MISSING_EVIDENCE",activeDrafts:[],currentRecord:null,historicalRecords:[],actions:{canContinue:false,canView:false,canStart:true,startOwner:"OPERATIONAL_EVIDENCE"}}],unboundRecords:[],checksum:"e".repeat(64)} as any));
    const user=userEvent.setup(),queryClient=new QueryClient({defaultOptions:{queries:{retry:false}}});render(<MemoryRouter><QueryClientProvider client={queryClient}><FacilityAssessmentJourneysPage/></QueryClientProvider></MemoryRouter>);await screen.findByRole("option",{name:"Braven Resorts"});await user.selectOptions(screen.getByLabelText("Client"),"client-1");await screen.findByRole("option",{name:"Sky Ranch"});await user.selectOptions(screen.getByLabelText("Facility"),"facility-1");await user.click(screen.getByRole("button",{name:/Equipment Inspection Programs/i}));const asset=await screen.findByText("F081-SUBJECT");await user.click(within(asset.closest("li")!).getByRole("button",{name:"Start record"}));expect(runtimeTemplateSpy).toHaveBeenLastCalledWith(expect.objectContaining({initialContextId:"subject-f081",lockInitialContext:true}));
  });

  it("renders governed Category 8 records and starts F920 with the selected annual period",async()=>{
    vi.mocked(listOetsTemplateCatalog).mockResolvedValue({templates:[{template_registry_id:"registry-f920",template_version_id:"version-f920",template_code:"OGI_F920_ANNUAL_PUBLIC_SAFETY_SUMMARY_REPORT",template_name:"Annual Public Safety Summary Report",template_archetype:"REPORT",module:"AUDIT",template_version:"3.2",schema_version:"1",checksum:"checksum-f920",registry_status:"ACTIVE",version_status:"ACTIVE",description:null,business_context:null,document_number:"OGI F-920",document_revision:"2.2",registered_at:"2026-09-30",last_synchronized_at:null}]});
    vi.mocked(getPublicSafetySystemsFormCompleteness).mockImplementation(async(_client,_facility,formCode)=>formCode==="F920"?({projectionVersion:"PUBLIC_SAFETY_SYSTEMS_MULTI_RECORD_V2",projectionStatus:"READY",creationBlocker:null,clientId:"client-1",facilityId:"facility-1",formCode:"F920",templateCode:"OGI_F920_ANNUAL_PUBLIC_SAFETY_SUMMARY_REPORT",currentTemplateVersionId:"version-f920",cardinality:{subjectKind:"ANNUAL_PUBLIC_SAFETY_REPORTING_PERIOD",recordModel:"ONE_PER_ANNUAL_PUBLIC_SAFETY_REPORTING_PERIOD",authorityState:"GOVERNED_CONTEXT_REGISTRY",creationOwner:"OPERATIONAL_EVIDENCE",contextRequirementCode:"ANNUAL_PUBLIC_SAFETY_REPORTING_PERIOD_CONTEXT",governedDuplicatePolicy:"ONE_EVIDENCE_LINEAGE_PER_SUBJECT",embeddedCollectionModel:null,authorityReuse:null},counts:{subjects:1,withCurrentEvidence:0,activeDrafts:1,withoutEvidence:0,conflicts:0,unboundRecords:0},subjects:[{subjectId:"period-2025",primaryLabel:"OGI-APS-2025-0001",secondaryLabel:"2025-01-01 — 2026-01-01",sourcePath:null,status:"ACTIVE_DRAFT",activeDrafts:[{evidenceRecordId:"draft-f920",templateVersionId:"version-f920",templateVersion:"3.2",lifecycleState:"DRAFT",createdByUserId:"user-1",createdAt:"2026-09-30T00:00:00.000Z",submittedAt:null}],currentRecord:null,historicalRecords:[],actions:{canContinue:true,canView:false,canStart:false,startOwner:"OPERATIONAL_EVIDENCE"}}],unboundRecords:[],conflicts:[],actions:{canStart:true,canContinue:true,canBind:false,canViewUnboundEvidence:false,startOwner:"OPERATIONAL_EVIDENCE"},checksum:"7".repeat(64)} as any):({projectionVersion:"PUBLIC_SAFETY_SYSTEMS_MULTI_RECORD_V2",projectionStatus:"READY",creationBlocker:null,clientId:"client-1",facilityId:"facility-1",formCode,templateCode:`OGI_${formCode}`,currentTemplateVersionId:`version-${formCode.toLowerCase()}`,cardinality:{subjectKind:"GOVERNED_PUBLIC_SAFETY_SUBJECT",recordModel:"ONE_PER_SUBJECT",authorityState:"GOVERNED_CONTEXT_REGISTRY",creationOwner:"OPERATIONAL_EVIDENCE",contextRequirementCode:"GOVERNED_CONTEXT",governedDuplicatePolicy:"ONE_EVIDENCE_LINEAGE_PER_SUBJECT",embeddedCollectionModel:null,authorityReuse:null},counts:{subjects:0,withCurrentEvidence:0,activeDrafts:0,withoutEvidence:0,conflicts:0,unboundRecords:0},subjects:[],unboundRecords:[],conflicts:[],actions:{canStart:true,canContinue:false,canBind:false,canViewUnboundEvidence:false,startOwner:"OPERATIONAL_EVIDENCE"},checksum:"7".repeat(64)} as any));
    const user=userEvent.setup(),queryClient=new QueryClient({defaultOptions:{queries:{retry:false}}});
    render(<MemoryRouter><QueryClientProvider client={queryClient}><FacilityAssessmentJourneysPage/></QueryClientProvider></MemoryRouter>);
    await screen.findByRole("option",{name:"Braven Resorts"});await user.selectOptions(screen.getByLabelText("Client"),"client-1");await screen.findByRole("option",{name:"Sky Ranch"});await user.selectOptions(screen.getByLabelText("Facility"),"facility-1");
    await user.click(screen.getByRole("button",{name:/Public Safety Systems/i}));
    expect(await screen.findByText("OGI-APS-2025-0001")).toBeInTheDocument();
    await user.clear(screen.getByLabelText("Reporting year"));await user.type(screen.getByLabelText("Reporting year"),"2027");await user.click(screen.getByRole("button",{name:"Start annual report"}));
    expect(runtimeTemplateSpy).toHaveBeenLastCalledWith(expect.objectContaining({initialContextId:"2027",lockInitialContext:true}));
  });

  it("reuses one governed F912 monitoring-date journey in Category 8",async()=>{
    vi.mocked(listOetsTemplateCatalog).mockResolvedValue({templates:[{template_registry_id:"registry-f912",template_version_id:"version-f912",template_code:"OGI_F912_FACILITY_CAPACITY_MONITORING_LOG",template_name:"Facility Capacity Monitoring Log",template_archetype:"LOG",module:"AUDIT",template_version:"3.3",schema_version:"1",checksum:"checksum-f912",registry_status:"ACTIVE",version_status:"ACTIVE",description:null,business_context:null,document_number:"OGI F-912",document_revision:"2.2",registered_at:"2026-10-01",last_synchronized_at:null}]});
    vi.mocked(getFacilityEnvironmentalSafetyFormCompleteness).mockImplementation(async(_client,_facility,formCode)=>formCode==="F912"?({projectionVersion:"FACILITY_ENVIRONMENTAL_SAFETY_MULTI_RECORD_V1",projectionStatus:"READY",creationBlocker:null,clientId:"client-1",facilityId:"facility-1",formCode:"F912",templateCode:"OGI_F912_FACILITY_CAPACITY_MONITORING_LOG",currentTemplateVersionId:"version-f912",cardinality:{subjectKind:"FACILITY_MONITORING_PERIOD",recordModel:"ONE_PER_MONITORING_PERIOD",authorityState:"GOVERNED_CONTEXT_REGISTRY",creationOwner:"OPERATIONAL_EVIDENCE",contextRequirementCode:"FACILITY_MONITORING_PERIOD_CONTEXT",governedDuplicatePolicy:"ONE_EVIDENCE_LINEAGE_PER_SUBJECT",embeddedCollectionModel:"OCCUPANCY_OBSERVATIONS"},counts:{subjects:0,withCurrentEvidence:0,activeDrafts:0,withoutEvidence:0,conflicts:0,unboundRecords:0},subjects:[],unboundRecords:[],checksum:"8".repeat(64)} as any):({projectionVersion:"FACILITY_ENVIRONMENTAL_SAFETY_MULTI_RECORD_V1",projectionStatus:"READY",creationBlocker:null,clientId:"client-1",facilityId:"facility-1",formCode:"F905",templateCode:"OGI_F905_CHECKLIST_INSPECTION",currentTemplateVersionId:"version-f905",cardinality:{subjectKind:"AUDIT_APPOINTMENT",recordModel:"ONE_PER_AUDIT_APPOINTMENT",authorityState:"GOVERNED_CONTEXT_REGISTRY",creationOwner:"OPERATIONAL_EVIDENCE",contextRequirementCode:"AUDIT_APPOINTMENT_CONTEXT",governedDuplicatePolicy:"ONE_EVIDENCE_LINEAGE_PER_SUBJECT",embeddedCollectionModel:null},counts:{subjects:0,withCurrentEvidence:0,activeDrafts:0,withoutEvidence:0,conflicts:0,unboundRecords:0},subjects:[],unboundRecords:[],checksum:"6".repeat(64)} as any));
    const user=userEvent.setup(),queryClient=new QueryClient({defaultOptions:{queries:{retry:false}}});render(<MemoryRouter><QueryClientProvider client={queryClient}><FacilityAssessmentJourneysPage/></QueryClientProvider></MemoryRouter>);
    await screen.findByRole("option",{name:"Braven Resorts"});await user.selectOptions(screen.getByLabelText("Client"),"client-1");await screen.findByRole("option",{name:"Sky Ranch"});await user.selectOptions(screen.getByLabelText("Facility"),"facility-1");await user.click(screen.getByRole("button",{name:/Public Safety Systems/i}));
    await user.clear(await screen.findByLabelText("Monitoring date"));await user.type(screen.getByLabelText("Monitoring date"),"2026-10-01");await user.click(screen.getByRole("button",{name:"Start monitoring log"}));expect(runtimeTemplateSpy).toHaveBeenLastCalledWith(expect.objectContaining({initialContextId:"2026-10-01",lockInitialContext:true}));
  });

  it("renders F905 by governed Audit Appointment and starts with the exact context",async()=>{
    vi.mocked(listOetsTemplateCatalog).mockResolvedValue({templates:[{template_registry_id:"registry-f905",template_version_id:"version-f905",template_code:"OGI_F905_CHECKLIST_INSPECTION",template_name:"Checklist Inspection",template_archetype:"CHECKLIST",module:"AUDIT",template_version:"3.5",schema_version:"1",checksum:"checksum-f905",registry_status:"ACTIVE",version_status:"ACTIVE",description:null,business_context:null,document_number:"OGI F-905",document_revision:"3.5",registered_at:"2026-01-02",last_synchronized_at:null}]});
    vi.mocked(getFacilityEnvironmentalSafetyFormCompleteness).mockResolvedValue({projectionVersion:"FACILITY_ENVIRONMENTAL_SAFETY_MULTI_RECORD_V1",projectionStatus:"READY",creationBlocker:null,clientId:"client-1",facilityId:"facility-1",formCode:"F905",templateCode:"OGI_F905_CHECKLIST_INSPECTION",currentTemplateVersionId:"version-f905",cardinality:{subjectKind:"AUDIT_APPOINTMENT",recordModel:"ONE_PER_AUDIT_APPOINTMENT",authorityState:"GOVERNED_CONTEXT_REGISTRY",creationOwner:"OPERATIONAL_EVIDENCE",contextRequirementCode:"AUDIT_APPOINTMENT_CONTEXT",governedDuplicatePolicy:"ONE_EVIDENCE_LINEAGE_PER_SUBJECT",embeddedCollectionModel:null},counts:{subjects:3,withCurrentEvidence:1,activeDrafts:1,withoutEvidence:1,conflicts:0,unboundRecords:0},subjects:[{subjectId:"appointment-1",primaryLabel:"AUDIT-2026-000001",secondaryLabel:"APPOINTMENT-1 · Daniel Cooper",sourcePath:null,status:"MISSING_EVIDENCE",activeDrafts:[],currentRecord:null,historicalRecords:[],actions:{canContinue:false,canView:false,canStart:true,startOwner:"OPERATIONAL_EVIDENCE"}},{subjectId:"appointment-2",primaryLabel:"AUDIT-2026-000002",secondaryLabel:"APPOINTMENT-2 · Daniel Cooper",sourcePath:null,status:"DRAFT",activeDrafts:[{evidenceRecordId:"draft-f905",templateVersionId:"version-f905",templateVersion:"3.5",lifecycleState:"DRAFT",createdByUserId:"user-1",createdAt:"2026-09-29T08:00:00.000Z",submittedAt:null}],currentRecord:null,historicalRecords:[],actions:{canContinue:true,canView:true,canStart:false,startOwner:"OPERATIONAL_EVIDENCE"}},{subjectId:"appointment-3",primaryLabel:"AUDIT-2026-000003",secondaryLabel:"APPOINTMENT-3 · Daniel Cooper",sourcePath:null,status:"GOVERNANCE_APPROVED",activeDrafts:[],currentRecord:{evidenceRecordId:"approved-f905",templateVersionId:"version-f905",templateVersion:"3.5",lifecycleState:"GOVERNANCE_APPROVED",createdByUserId:"user-1",createdAt:"2026-09-28T08:00:00.000Z",submittedAt:"2026-09-28T09:00:00.000Z"},historicalRecords:[],actions:{canContinue:false,canView:true,canStart:true,startOwner:"OPERATIONAL_EVIDENCE"}}],unboundRecords:[],checksum:"6".repeat(64)});
    const user=userEvent.setup(),queryClient=new QueryClient({defaultOptions:{queries:{retry:false}}});
    render(<MemoryRouter><QueryClientProvider client={queryClient}><FacilityAssessmentJourneysPage/></QueryClientProvider></MemoryRouter>);
    await screen.findByRole("option",{name:"Braven Resorts"});await user.selectOptions(screen.getByLabelText("Client"),"client-1");await screen.findByRole("option",{name:"Sky Ranch"});await user.selectOptions(screen.getByLabelText("Facility"),"facility-1");
    expect(getFacilityEnvironmentalSafetyFormCompleteness).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button",{name:/Facility & Environmental Safety/i}));
    expect(await screen.findByText("AUDIT-2026-000001")).toBeInTheDocument();
    expect(screen.getByRole("button",{name:"Continue draft"})).toBeInTheDocument();
    expect(screen.getByRole("link",{name:"View evidence"})).toHaveAttribute("href","/workbench/evidence/approved-f905?return=facility-assessment&client=client-1&facility=facility-1&category=FACILITY_ENVIRONMENTAL_SAFETY");
    const missingAppointment=screen.getByText("AUDIT-2026-000001").closest("li")!;
    await user.click(within(missingAppointment).getByRole("button",{name:"Start record"}));
    expect(runtimeTemplateSpy).toHaveBeenLastCalledWith(expect.objectContaining({initialContextId:"appointment-1"}));
  });

  it("renders the F901 server-allocated entry point and locks F902 to its approved F901 hazard",async()=>{
    vi.mocked(listOetsTemplateCatalog).mockResolvedValue({templates:[
      {template_registry_id:"registry-f901",template_version_id:"version-f901",template_code:"OGI_F901_HAZARD_IDENTIFICATION_REPORT",template_name:"Hazard Identification Report",template_archetype:"REPORT",module:"AUDIT",template_version:"3.2",schema_version:"1",checksum:"checksum-f901",registry_status:"ACTIVE",version_status:"ACTIVE",description:null,business_context:null,document_number:"OGI F-901",document_revision:"2.1",registered_at:"2026-01-02",last_synchronized_at:null},
      {template_registry_id:"registry-f902",template_version_id:"version-f902",template_code:"OGI_F902_RISK_ASSESSMENT_WORKSHEET",template_name:"Risk Assessment Worksheet",template_archetype:"ASSESSMENT",module:"AUDIT",template_version:"3.4",schema_version:"1",checksum:"checksum-f902",registry_status:"ACTIVE",version_status:"ACTIVE",description:null,business_context:null,document_number:"OGI F-902",document_revision:"2.3",registered_at:"2026-01-02",last_synchronized_at:null}
    ]});
    vi.mocked(getFacilityEnvironmentalSafetyFormCompleteness).mockImplementation(async(_client,_facility,formCode)=>formCode==="F902"?({projectionVersion:"FACILITY_ENVIRONMENTAL_SAFETY_MULTI_RECORD_V1",projectionStatus:"READY",creationBlocker:null,clientId:"client-1",facilityId:"facility-1",formCode:"F902",templateCode:"OGI_F902_RISK_ASSESSMENT_WORKSHEET",currentTemplateVersionId:"version-f902",cardinality:{subjectKind:"HAZARD_RISK_ASSESSMENT",recordModel:"ONE_PER_HAZARD_ASSESSMENT_OCCURRENCE",authorityState:"GOVERNED_CONTEXT_REGISTRY",creationOwner:"OPERATIONAL_EVIDENCE",contextRequirementCode:"HAZARD_RISK_ASSESSMENT_CONTEXT",governedDuplicatePolicy:"ONE_EVIDENCE_LINEAGE_PER_SUBJECT",embeddedCollectionModel:null},counts:{subjects:1,withCurrentEvidence:0,activeDrafts:0,withoutEvidence:1,conflicts:0,unboundRecords:0},subjects:[{subjectId:"hazard-occurrence-1",primaryLabel:"OGI-HIR-2026-0001",secondaryLabel:"PHYSICAL_HAZARD · Wet deck",sourcePath:null,status:"MISSING_EVIDENCE",activeDrafts:[],currentRecord:null,historicalRecords:[],actions:{canContinue:false,canView:false,canStart:true,startOwner:"OPERATIONAL_EVIDENCE"}}],unboundRecords:[],checksum:"2".repeat(64)} as any):({projectionVersion:"FACILITY_ENVIRONMENTAL_SAFETY_MULTI_RECORD_V1",projectionStatus:"READY",creationBlocker:null,clientId:"client-1",facilityId:"facility-1",formCode,templateCode:formCode==="F901"?"OGI_F901_HAZARD_IDENTIFICATION_REPORT":"OGI_F905_CHECKLIST_INSPECTION",currentTemplateVersionId:formCode==="F901"?"version-f901":"version-f905",cardinality:{subjectKind:formCode==="F901"?"HAZARD_OCCURRENCE":"AUDIT_APPOINTMENT",recordModel:formCode==="F901"?"ONE_PER_HAZARD_OCCURRENCE":"ONE_PER_AUDIT_APPOINTMENT",authorityState:"GOVERNED_CONTEXT_REGISTRY",creationOwner:"OPERATIONAL_EVIDENCE",contextRequirementCode:formCode==="F901"?"HAZARD_OCCURRENCE_CONTEXT":"AUDIT_APPOINTMENT_CONTEXT",governedDuplicatePolicy:"ONE_EVIDENCE_LINEAGE_PER_SUBJECT",embeddedCollectionModel:null},counts:{subjects:0,withCurrentEvidence:0,activeDrafts:0,withoutEvidence:0,conflicts:0,unboundRecords:0},subjects:[],unboundRecords:[],checksum:"1".repeat(64)} as any));
    const user=userEvent.setup(),queryClient=new QueryClient({defaultOptions:{queries:{retry:false}}});
    render(<MemoryRouter><QueryClientProvider client={queryClient}><FacilityAssessmentJourneysPage/></QueryClientProvider></MemoryRouter>);
    await screen.findByRole("option",{name:"Braven Resorts"});await user.selectOptions(screen.getByLabelText("Client"),"client-1");await screen.findByRole("option",{name:"Sky Ranch"});await user.selectOptions(screen.getByLabelText("Facility"),"facility-1");
    await user.click(screen.getByRole("button",{name:/Facility & Environmental Safety/i}));
    expect(await screen.findByRole("button",{name:"Report new hazard"})).toBeInTheDocument();
    const hazard=screen.getByText("OGI-HIR-2026-0001").closest("li")!;await user.click(within(hazard).getByRole("button",{name:"Assess this hazard"}));
    expect(runtimeTemplateSpy).toHaveBeenLastCalledWith(expect.objectContaining({initialContextId:"hazard-occurrence-1",lockInitialContext:true}));
  });

  it("shows governed F023 enrollment evidence without offering generic creation",async()=>{
    vi.mocked(getTrainingCompetencyFormCompleteness).mockImplementation(async(_clientId,_facilityId,formCode)=>formCode==="F023"?{projectionVersion:"TRAINING_COMPETENCY_MULTI_RECORD_V1",clientId:"client-1",facilityId:"facility-1",formCode:"F023",templateCode:"OGI_F023_OPERATIONAL_SKILLS_ASSESSMENT",currentTemplateVersionId:"version-f023",cardinality:{subjectKind:"TRAINING_ENROLLMENT",recordModel:"ONE_PER_ENROLLMENT_PURPOSE",authorityState:"GOVERNED_EXTERNAL_WORKFLOW",creationOwner:"TRAINING_JOURNEY",contextRequirementCode:null,governedDuplicatePolicy:"ONE_RECORD_PER_ENROLLMENT_PURPOSE"},counts:{subjects:2,withCurrentEvidence:1,activeDrafts:0,withoutEvidence:1,conflicts:0},subjects:[{subjectId:"enrollment-jay",primaryLabel:"Jay Jay Alcantara",secondaryLabel:"OGI-STU-0041 · TRAINING-SESSION-0412",sourcePath:"/workbench/training/journeys?enrollment=enrollment-jay",status:"GOVERNANCE_APPROVED",activeDrafts:[],currentRecord:{evidenceRecordId:"evidence-f023-jay",templateVersionId:"version-f023",templateVersion:"3.5",lifecycleState:"GOVERNANCE_APPROVED",createdByUserId:"user-1",createdAt:"2026-09-24T11:00:00.000Z",submittedAt:"2026-09-24T12:00:00.000Z"},historicalRecords:[],actions:{canContinue:false,canView:true,canStart:false,startOwner:"TRAINING_JOURNEY"}},{subjectId:"enrollment-elmer",primaryLabel:"Elmer Miranda",secondaryLabel:"OGI-STU-0040 · TRAINING-SESSION-0411",sourcePath:"/workbench/training/journeys?enrollment=enrollment-elmer",status:"MISSING_EVIDENCE",activeDrafts:[],currentRecord:null,historicalRecords:[],actions:{canContinue:false,canView:false,canStart:false,startOwner:"TRAINING_JOURNEY"}}],checksum:"a".repeat(64)}:await Promise.resolve({projectionVersion:"TRAINING_COMPETENCY_MULTI_RECORD_V1",clientId:"client-1",facilityId:"facility-1",formCode,templateCode:`OGI_${formCode}`,currentTemplateVersionId:`version-${formCode.toLowerCase()}`,cardinality:{subjectKind:formCode==="F022"?"TRAINING_SESSION":"TRAINING_ENROLLMENT",recordModel:"ONE_PER_ENROLLMENT_PURPOSE",authorityState:"GOVERNED_EXTERNAL_WORKFLOW",creationOwner:"TRAINING_JOURNEY",contextRequirementCode:null,governedDuplicatePolicy:null},counts:{subjects:0,withCurrentEvidence:0,activeDrafts:0,withoutEvidence:0,conflicts:0},subjects:[],checksum:"9".repeat(64)}));
    const user=userEvent.setup(),queryClient=new QueryClient({defaultOptions:{queries:{retry:false}}});
    render(<MemoryRouter><QueryClientProvider client={queryClient}><FacilityAssessmentJourneysPage/></QueryClientProvider></MemoryRouter>);
    await screen.findByRole("option",{name:"Braven Resorts"});await user.selectOptions(screen.getByLabelText("Client"),"client-1");await screen.findByRole("option",{name:"Sky Ranch"});await user.selectOptions(screen.getByLabelText("Facility"),"facility-1");
    await user.click(await screen.findByRole("button",{name:/Training & Competency/i}));
    await user.click((await screen.findAllByText("Enrollments ▾",{selector:"span"}))[0]!);
    const jay=screen.getByText("Jay Jay Alcantara").closest("li")!;
    expect(within(jay).getByRole("link",{name:"View evidence"})).toHaveAttribute("href","/workbench/evidence/evidence-f023-jay?return=facility-assessment&client=client-1&facility=facility-1&category=TRAINING_COMPETENCY");
    expect(within(jay).getByRole("link",{name:"Open training journey"})).toHaveAttribute("href","/workbench/training/journeys?enrollment=enrollment-jay");
    expect(screen.queryByRole("button",{name:/Start.*F023/i})).not.toBeInTheDocument();
  });

  it("does not mount assessment discovery for a CLIENT_LIFEGUARD without view_domain_assessment", async () => {
    canUsePermissionSpy.mockReturnValue(false);
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<MemoryRouter><QueryClientProvider client={queryClient}><FacilityAssessmentJourneysPage /></QueryClientProvider></MemoryRouter>);
    expect(screen.getByRole("heading", { name: "You are not authorized to use Facility Assessment Journeys." })).toBeInTheDocument();
    expect(listFeatureClients).not.toHaveBeenCalled();
    expect(getFacilityOriReadiness).not.toHaveBeenCalled();
    expect(getPersonnelFormCompleteness).not.toHaveBeenCalled();
  });

  it("calculates ARI when all nine category finals are eligible", async () => {
    const sources = Array.from({ length: 9 }, (_, index) => ({ categoryCode: ["GOVERNANCE_DOCUMENTATION", "LIFEGUARD_OPERATIONS", "EMERGENCY_PREPAREDNESS", "RESCUE_EQUIPMENT_ASSETS", "TRAINING_COMPETENCY", "FACILITY_ENVIRONMENTAL_SAFETY", "INCIDENT_MANAGEMENT", "PUBLIC_SAFETY_SYSTEMS", "EQUIPMENT_INSPECTION_PROGRAMS"][index], categoryName: `Category ${index + 1}`, weight: index === 8 ? "0.05" : index < 4 ? "0.15" : "0.10", scopeId: `scope-${index}`, assessmentId: `assessment-${index}`, assessmentVersion: 1, finalizedAt: "2026-09-01T00:00:00.000Z", evidenceCutoffAt: "2026-08-31T00:00:00.000Z", lmhc: "LOW", professionalCategoryIndex: "90" }));
    vi.mocked(getFacilityOriReadiness).mockResolvedValueOnce({ clientId: "client-1", facilityId: "facility-1", ready: true, currentResultId: null, updateAvailable: false, blockers: [], sources });
    vi.mocked(calculateFacilityOri).mockResolvedValueOnce({ replayed: false, result: { id: "ori-1", resultVersion: 1, clientId: "client-1", facilityId: "facility-1", oriValue: "90", lmhc: "LOW", calculatedAt: "2026-09-14T00:00:00.000Z", resultChecksum: "checksum", updateAvailable: false, contributions: [] } });
    const user = userEvent.setup();
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<MemoryRouter><QueryClientProvider client={queryClient}><FacilityAssessmentJourneysPage /></QueryClientProvider></MemoryRouter>);
    await screen.findByRole("option", { name: "Braven Resorts" });
    await user.selectOptions(screen.getByLabelText("Client"), "client-1");
    await screen.findByRole("option", { name: "Sky Ranch" });
    await user.selectOptions(screen.getByLabelText("Facility"), "facility-1");
    expect(await screen.findByText("Aquatic Risk Index (ARI)")).toBeVisible();
    expect(await screen.findByText("All nine category finals are eligible. ARI is ready to calculate.")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Calculate ARI" }));
    expect(calculateFacilityOri).toHaveBeenCalledWith("client-1", "facility-1");
  });

  it("loads readiness after facility selection and category detail only when expanded", async () => {
    const user = userEvent.setup();
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<MemoryRouter><QueryClientProvider client={queryClient}><FacilityAssessmentJourneysPage /></QueryClientProvider></MemoryRouter>);

    await screen.findByRole("option", { name: "Braven Resorts" });
    await user.selectOptions(screen.getByLabelText("Client"), "client-1");
    await screen.findByRole("option", { name: "Sky Ranch" });
    await user.selectOptions(screen.getByLabelText("Facility"), "facility-1");
    expect(await screen.findByText("1 of 9")).toBeInTheDocument();
    expect(getFacilityOriReadiness).toHaveBeenCalledWith("client-1", "facility-1");
    expect(getDomainAssessmentDetail).not.toHaveBeenCalled();
    expect(screen.getAllByRole("button", { expanded: false })).toHaveLength(9);

    await user.click(screen.getByRole("button", { name: /Governance & Documentation/i }));
    expect(await screen.findByRole("link", { name: "View evidence" })).toHaveAttribute("href", "/workbench/evidence/evidence-1?return=facility-assessment&client=client-1&facility=facility-1&category=GOVERNANCE_DOCUMENTATION");
    expect(getDomainAssessmentDetail).toHaveBeenCalledWith("assessment-1");
    expect(screen.queryByRole("button", { name: /^(Submit|Approve)/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Calculate ARI" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: /Lifeguard Operations/i }));
    expect(await screen.findByText("1 of 1 assigned personnel have eligible governed evidence")).toBeVisible();
    expect(getCertificationFormCompleteness).toHaveBeenCalledWith("client-1", "facility-1", "F041");
    expect(screen.getByText("Certification Intelligence Record")).toBeVisible();
    await user.click(screen.getByText("Personnel-level evidence ▾"));
    expect(screen.getAllByText("Sky Alcantara").some((element) => element.closest("li"))).toBe(true);
    expect(screen.getByRole("link", { name: "View eligible evidence" })).toHaveAttribute("href", "/workbench/evidence/evidence-f021?return=facility-assessment&client=client-1&facility=facility-1&category=LIFEGUARD_OPERATIONS");
  });

  it("restores the selected Client, Facility, and category from durable return context", async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<MemoryRouter initialEntries={["/workbench/assessments/facility-journeys?client=client-1&facility=facility-1&category=GOVERNANCE_DOCUMENTATION"]}><QueryClientProvider client={queryClient}><FacilityAssessmentJourneysPage /></QueryClientProvider></MemoryRouter>);
    await screen.findByRole("option", { name: "Braven Resorts" });
    await screen.findByRole("option", { name: "Sky Ranch" });
    await waitFor(() => expect(screen.getByLabelText("Client")).toHaveValue("client-1"));
    expect(screen.getByLabelText("Facility")).toHaveValue("facility-1");
    expect(await screen.findByRole("button", { name: /Governance & Documentation/i })).toHaveAttribute("aria-expanded", "true");
    expect(getFacilityOriReadiness).toHaveBeenCalledWith("client-1", "facility-1");
  });

  it("hands the selected personnel enrollment and facility directly to the locked F021 workspace", async () => {
    vi.mocked(getPersonnelFormCompleteness).mockResolvedValueOnce({ projectionVersion:"PERSONNEL_FORM_COMPLETENESS_V1",clientId:"client-1",facilityId:"facility-1",templateCode:"OGI_F021_PERSONNEL_REGISTRATION_COMPETENCY_PROFILE",formCode:"F021",cutoffAt:"2026-09-26T00:00:00.000Z",counts:{assignedPersonnel:1,eligible:0,actionRequired:1},personnel:[{staffMemberId:"staff-elmer",fullName:"Elmer Miranda",traineeId:"trainee-elmer",studentNumber:"OGI-STU-2026-0040",trainingEnrollmentId:"40000000-0000-4000-8000-000000000021",status:"SUPERSEDED",eligibleEvidenceRecordId:null,currentEvidenceRecordId:null,historicalEvidenceRecordId:"approved-f021-36",historicalTemplateVersion:"3.6",historicalLifecycleState:"GOVERNANCE_APPROVED",historicalRecords:[{evidenceRecordId:"approved-f021-36",trainingEnrollmentId:"40000000-0000-4000-8000-000000000021",lifecycleState:"GOVERNANCE_APPROVED",templateVersion:"3.6",currentTemplateVersion:false,eligibleAtCutoff:false},{evidenceRecordId:"draft-f021-36",trainingEnrollmentId:"40000000-0000-4000-8000-000000000021",lifecycleState:"DRAFT",templateVersion:"3.6",currentTemplateVersion:false,eligibleAtCutoff:false}],records:[{evidenceRecordId:"draft-f021-36",trainingEnrollmentId:"40000000-0000-4000-8000-000000000021",lifecycleState:"DRAFT",templateVersion:"3.6",currentTemplateVersion:false,eligibleAtCutoff:false},{evidenceRecordId:"approved-f021-36",trainingEnrollmentId:"40000000-0000-4000-8000-000000000021",lifecycleState:"GOVERNANCE_APPROVED",templateVersion:"3.6",currentTemplateVersion:false,eligibleAtCutoff:false}]}],checksum:"d".repeat(64) });
    vi.mocked(listOetsTemplateCatalog).mockResolvedValueOnce({ templates: [{ template_registry_id:"registry-f021",template_version_id:"version-f021-37",template_code:"OGI_F021_PERSONNEL_REGISTRATION_COMPETENCY_PROFILE",template_name:"Personnel Registration & Competency Profile",template_archetype:"FORM",module:"TRAINING",template_version:"3.7",schema_version:"1",checksum:"f".repeat(64),registry_status:"ACTIVE",version_status:"ACTIVE",description:null,business_context:null,document_number:"OGI-F-021",document_revision:"3.7",registered_at:"2026-09-26",last_synchronized_at:null }] });
    const user = userEvent.setup();
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<MemoryRouter><QueryClientProvider client={queryClient}><FacilityAssessmentJourneysPage /></QueryClientProvider></MemoryRouter>);
    await screen.findByRole("option", { name: "Braven Resorts" });
    await user.selectOptions(screen.getByLabelText("Client"), "client-1");
    await screen.findByRole("option", { name: "Sky Ranch" });
    await user.selectOptions(screen.getByLabelText("Facility"), "facility-1");
    await user.click(await screen.findByRole("button", { name: /Lifeguard Operations/i }));
    await user.click(await screen.findByText("Personnel-level evidence ▾"));
    expect(await screen.findByRole("link", { name: "View approved historical F021 v3.6" })).toHaveAttribute("href", "/workbench/evidence/approved-f021-36?return=facility-assessment&client=client-1&facility=facility-1&category=LIFEGUARD_OPERATIONS");
    expect(screen.getByText("Other historical records (1)")).toBeVisible();
    await user.click(await screen.findByRole("button", { name: "Create current F021" }));

    expect(screen.getByRole("dialog", { name: "Personnel Registration & Competency Profile" })).toBeVisible();
    expect(runtimeTemplateSpy).toHaveBeenLastCalledWith(expect.objectContaining({
      initialClientId: "client-1",
      initialFacilityId: "facility-1",
      initialContextId: "40000000-0000-4000-8000-000000000021",
      lockInitialContext: true,
      lockInitialScope: true
    }));
  });

  it("links existing current F021 evidence instead of offering duplicate creation", async () => {
    vi.mocked(getPersonnelFormCompleteness).mockResolvedValueOnce({ projectionVersion:"PERSONNEL_FORM_COMPLETENESS_V1",clientId:"client-1",facilityId:"facility-1",templateCode:"OGI_F021_PERSONNEL_REGISTRATION_COMPETENCY_PROFILE",formCode:"F021",cutoffAt:"2026-09-26T08:04:23.342Z",counts:{assignedPersonnel:1,eligible:0,actionRequired:1},personnel:[{staffMemberId:"staff-elmer",fullName:"Elmer Miranda",traineeId:"trainee-elmer",studentNumber:"OGI-STU-2026-0040",trainingEnrollmentId:"40000000-0000-4000-8000-000000000021",status:"APPROVED_AFTER_CUTOFF",eligibleEvidenceRecordId:null,currentEvidenceRecordId:"evidence-approved-f021",records:[{evidenceRecordId:"evidence-approved-f021",lifecycleState:"GOVERNANCE_APPROVED",eligibleAtCutoff:false}]}],checksum:"e".repeat(64) });
    const user = userEvent.setup();
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<MemoryRouter><QueryClientProvider client={queryClient}><FacilityAssessmentJourneysPage /></QueryClientProvider></MemoryRouter>);
    await screen.findByRole("option", { name: "Braven Resorts" });
    await user.selectOptions(screen.getByLabelText("Client"), "client-1");
    await screen.findByRole("option", { name: "Sky Ranch" });
    await user.selectOptions(screen.getByLabelText("Facility"), "facility-1");
    await user.click(await screen.findByRole("button", { name: /Lifeguard Operations/i }));
    await user.click(await screen.findByText("Personnel-level evidence ▾"));

    expect(await screen.findByRole("link", { name: "View evidence (after cutoff)" })).toHaveAttribute("href", "/workbench/evidence/evidence-approved-f021?return=facility-assessment&client=client-1&facility=facility-1&category=LIFEGUARD_OPERATIONS");
    expect(screen.queryByRole("button", { name: "Create F021" })).not.toBeInTheDocument();
  });

  it("links approved current F021 v3.7 evidence projected from its certification context", async () => {
    vi.mocked(getPersonnelFormCompleteness).mockResolvedValueOnce({ projectionVersion:"PERSONNEL_FORM_COMPLETENESS_V1",clientId:"client-1",facilityId:"facility-1",templateCode:"OGI_F021_PERSONNEL_REGISTRATION_COMPETENCY_PROFILE",formCode:"F021",cutoffAt:"2026-09-27T09:00:00.000Z",counts:{assignedPersonnel:1,eligible:1,actionRequired:0},personnel:[{staffMemberId:"staff-jay",fullName:"Jay Jay Alcantara",traineeId:"trainee-jay",studentNumber:"OGI-STU-2026-0041",trainingEnrollmentId:"f53499da-d25d-4213-91b4-efe3ad8bde06",status:"ELIGIBLE",eligibleEvidenceRecordId:"approved-f021-37",currentEvidenceRecordId:"approved-f021-37",historicalEvidenceRecordId:"draft-f021-36",historicalTemplateVersion:"3.6",historicalLifecycleState:"DRAFT",historicalRecords:[{evidenceRecordId:"draft-f021-36",trainingEnrollmentId:"f53499da-d25d-4213-91b4-efe3ad8bde06",lifecycleState:"DRAFT",templateVersion:"3.6",currentTemplateVersion:false,eligibleAtCutoff:false}],records:[{evidenceRecordId:"approved-f021-37",trainingEnrollmentId:"f53499da-d25d-4213-91b4-efe3ad8bde06",lifecycleState:"GOVERNANCE_APPROVED",templateVersion:"3.7",currentTemplateVersion:true,eligibleAtCutoff:true},{evidenceRecordId:"draft-f021-36",trainingEnrollmentId:"f53499da-d25d-4213-91b4-efe3ad8bde06",lifecycleState:"DRAFT",templateVersion:"3.6",currentTemplateVersion:false,eligibleAtCutoff:false}]}],checksum:"f".repeat(64)});
    const user=userEvent.setup();
    const queryClient=new QueryClient({defaultOptions:{queries:{retry:false}}});
    render(<MemoryRouter><QueryClientProvider client={queryClient}><FacilityAssessmentJourneysPage /></QueryClientProvider></MemoryRouter>);
    await screen.findByRole("option",{name:"Braven Resorts"});
    await user.selectOptions(screen.getByLabelText("Client"),"client-1");
    await screen.findByRole("option",{name:"Sky Ranch"});
    await user.selectOptions(screen.getByLabelText("Facility"),"facility-1");
    await user.click(await screen.findByRole("button",{name:/Lifeguard Operations/i}));
    await user.click(await screen.findByText("Personnel-level evidence ▾"));
    expect(await screen.findByText("1 of 1 assigned personnel have eligible governed evidence")).toBeVisible();
    expect(screen.getByRole("link",{name:"View eligible evidence"})).toHaveAttribute("href","/workbench/evidence/approved-f021-37?return=facility-assessment&client=client-1&facility=facility-1&category=LIFEGUARD_OPERATIONS");
    expect(screen.queryByRole("button",{name:/Create (?:current )?F021/})).not.toBeInTheDocument();
    expect(screen.getByRole("link",{name:"View historical draft v3.6"})).toHaveAttribute("href","/workbench/evidence/draft-f021-36?return=facility-assessment&client=client-1&facility=facility-1&category=LIFEGUARD_OPERATIONS");
  });

  it("shows asset-specific F081 Start, Continue, View, and recurring inspection actions",async()=>{
    vi.mocked(listOetsTemplateCatalog).mockResolvedValueOnce({templates:[{template_registry_id:"registry-f081",template_version_id:"version-f081",template_code:"OGI_F081_EQUIPMENT_INSPECTION_REPORT",template_name:"Equipment Inspection Intelligence Report",template_archetype:"CHECKLIST_INSPECTION",module:"RESCUE_EQUIPMENT_ASSETS",template_version:"3.5",schema_version:"1",checksum:"a".repeat(64),registry_status:"ACTIVE",version_status:"ACTIVE",description:null,business_context:null,document_number:"OGI-F-081",document_revision:"3.5",registered_at:"2026-09-01",last_synchronized_at:null}]});
    const evidence=(id:string,lifecycleState:string)=>({evidenceRecordId:id,lifecycleState,templateVersionId:"version-f081",templateVersion:"3.5",payloadChecksum:"b".repeat(64),createdByUserId:"user-1",createdAt:"2026-09-28T01:00:00.000Z",submittedAt:lifecycleState==="DRAFT"?null:"2026-09-28T02:00:00.000Z"});
    const draft=evidence("draft-f081","DRAFT"),approved=evidence("approved-f081","GOVERNANCE_APPROVED");
    vi.mocked(getF081AssetFormCompleteness).mockResolvedValueOnce({projectionVersion:"F081_ASSET_FORM_COMPLETENESS_V1",clientId:"client-1",facilityId:"facility-1",templateCode:"OGI_F081_EQUIPMENT_INSPECTION_REPORT",currentTemplateVersionId:"version-f081",counts:{eligibleAssets:3,withCurrentEvidence:2,activeDrafts:1,withoutEvidence:1,conflicts:0},assets:[{assetId:"asset-new",assetNumber:"ASSET-001",equipmentName:"Rescue Tube",equipmentCategory:"RESCUE_EQUIPMENT",lifecycleStatus:"ACTIVE",status:"MISSING_EVIDENCE",activeDraft:null,currentRecord:null,historicalRecords:[],canCreate:true},{assetId:"asset-draft",assetNumber:"ASSET-002",equipmentName:"Spine Board",equipmentCategory:"RESCUE_EQUIPMENT",lifecycleStatus:"ACTIVE",status:"DRAFT",activeDraft:draft,currentRecord:draft,historicalRecords:[],canCreate:false},{assetId:"asset-approved",assetNumber:"ASSET-003",equipmentName:"Emergency Wheelchair",equipmentCategory:"RESCUE_EQUIPMENT",lifecycleStatus:"ACTIVE",status:"GOVERNANCE_APPROVED",activeDraft:null,currentRecord:approved,historicalRecords:[],canCreate:true}],checksum:"c".repeat(64)});
    const user=userEvent.setup();const queryClient=new QueryClient({defaultOptions:{queries:{retry:false}}});
    render(<MemoryRouter><QueryClientProvider client={queryClient}><FacilityAssessmentJourneysPage/></QueryClientProvider></MemoryRouter>);
    await screen.findByRole("option",{name:"Braven Resorts"});await user.selectOptions(screen.getByLabelText("Client"),"client-1");await screen.findByRole("option",{name:"Sky Ranch"});await user.selectOptions(screen.getByLabelText("Facility"),"facility-1");
    await user.click(await screen.findByRole("button",{name:/Rescue Equipment & Assets/i}));
    expect(getF081AssetFormCompleteness).toHaveBeenCalledWith("client-1","facility-1");
    const newAsset=screen.getByText(/ASSET-001/).closest("li")!;const draftAsset=screen.getByText(/ASSET-002/).closest("li")!;const approvedAsset=screen.getByText(/ASSET-003/).closest("li")!;
    expect(within(newAsset).getByRole("button",{name:"Start inspection"})).toBeVisible();
    expect(within(draftAsset).getByRole("button",{name:"Continue draft"})).toBeVisible();
    expect(within(approvedAsset).getByRole("link",{name:"View evidence"})).toHaveAttribute("href","/workbench/evidence/approved-f081?return=facility-assessment&client=client-1&facility=facility-1&category=RESCUE_EQUIPMENT_ASSETS");
    expect(within(approvedAsset).getByRole("button",{name:"Start another inspection"})).toBeVisible();
    await user.click(within(newAsset).getByRole("button",{name:"Start inspection"}));
    expect(screen.getByRole("dialog",{name:"Equipment Inspection Intelligence Report"})).toBeVisible();
    expect(runtimeTemplateSpy).toHaveBeenLastCalledWith(expect.objectContaining({initialClientId:"client-1",initialFacilityId:"facility-1",initialContextId:"asset-new",lockInitialContext:true,lockInitialScope:true}));
  });

  it("opens one canonical form workspace and protects unsaved changes", async () => {
    vi.mocked(listOetsTemplateCatalog).mockResolvedValue({ templates: [{ template_registry_id: "registry-1", template_version_id: "version-1", template_code: "OGI_F002_FACILITY_PROFILE_BASELINE_INTELLIGENCE_ASSESSMENT", template_name: "Client and Facility Information", template_archetype: "FORM", module: "AUDIT", template_version: "3.2", schema_version: "1", checksum: "checksum", registry_status: "ACTIVE", version_status: "ACTIVE", description: null, business_context: null, document_number: "OGI-F-002", document_revision: "2.0", registered_at: "2026-01-01", last_synchronized_at: null }] });
    vi.mocked(listOperationalEvidenceRecords).mockResolvedValue({ records: [], pagination: { limit: 100, offset: 0, count: 0, total_count: 0 } });
    const user = userEvent.setup();
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<MemoryRouter><QueryClientProvider client={queryClient}><FacilityAssessmentJourneysPage /></QueryClientProvider></MemoryRouter>);
    await screen.findByRole("option", { name: "Braven Resorts" });
    await user.selectOptions(screen.getByLabelText("Client"), "client-1");
    await screen.findByRole("option", { name: "Sky Ranch" });
    await user.selectOptions(screen.getByLabelText("Facility"), "facility-1");
    await screen.findByText("1 of 9");
    await user.click(screen.getByRole("button", { name: /Governance & Documentation/i }));
    await user.click(await screen.findByRole("button", { name: "Start form →" }));
    expect(screen.getByRole("dialog", { name: "Client and Facility Information" })).toBeInTheDocument();
    expect(screen.getAllByLabelText("Mock canonical form field")).toHaveLength(1);
    expect(runtimeTemplateSpy).toHaveBeenLastCalledWith(expect.objectContaining({
      initialClientId: "client-1",
      initialFacilityId: "facility-1",
      lockInitialScope: true
    }));
    expect(runtimeTemplateSpy.mock.lastCall?.[0]).not.toHaveProperty("initialFieldValues");
    expect(screen.queryByText("Unsaved changes")).not.toBeInTheDocument();
    await user.type(screen.getByLabelText("Mock canonical form field"), "changed");
    expect(screen.getByText("Unsaved changes")).toBeInTheDocument();
    const confirm = vi.spyOn(window, "confirm").mockReturnValueOnce(false).mockReturnValueOnce(true);
    await user.click(screen.getByRole("button", { name: /Back to Facility Assessment Journey/ }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Back to Facility Assessment Journey/ }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    confirm.mockRestore();
  });

  it("does not reopen a draft created from a superseded template version", async () => {
    vi.mocked(listOetsTemplateCatalog).mockResolvedValue({ templates: [{ template_registry_id: "registry-1", template_version_id: "version-current", template_code: "OGI_F002_FACILITY_PROFILE_BASELINE_INTELLIGENCE_ASSESSMENT", template_name: "Client and Facility Information", template_archetype: "FORM", module: "AUDIT", template_version: "3.3", schema_version: "1", checksum: "checksum-current", registry_status: "ACTIVE", version_status: "ACTIVE", description: null, business_context: null, document_number: "OGI-F-002", document_revision: "3.0", registered_at: "2026-01-02", last_synchronized_at: null }] });
    vi.mocked(listOperationalEvidenceRecords).mockResolvedValue({ records: [{ evidence_record_id: "obsolete-draft", template_registry_id: "registry-1", template_version_id: "version-obsolete", template_code: "OGI_F002_FACILITY_PROFILE_BASELINE_INTELLIGENCE_ASSESSMENT", template_version: "3.2", schema_version: "1", client_id: "client-1", facility_id: "facility-1", lifecycle_state: "DRAFT", payload_checksum: "obsolete-checksum", created_by_user_id: "user-1", submitted_by_user_id: "user-1", created_at: "2026-01-01", submitted_at: "2026-01-01", updated_at: "2026-01-01" }], pagination: { limit: 100, offset: 0, count: 1, total_count: 1 } });
    const user = userEvent.setup();
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<MemoryRouter><QueryClientProvider client={queryClient}><FacilityAssessmentJourneysPage /></QueryClientProvider></MemoryRouter>);
    await screen.findByRole("option", { name: "Braven Resorts" });
    await user.selectOptions(screen.getByLabelText("Client"), "client-1");
    await screen.findByRole("option", { name: "Sky Ranch" });
    await user.selectOptions(screen.getByLabelText("Facility"), "facility-1");
    await screen.findByText("1 of 9");
    await user.click(screen.getByRole("button", { name: /Governance & Documentation/i }));
    expect(await screen.findByText("Historical draft v3.2 is preserved; start the current form")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Start current form →" }));
    expect(screen.getByRole("dialog", { name: "Client and Facility Information" })).toBeInTheDocument();
    expect(screen.getByText(/New form$/)).toBeVisible();
    expect(screen.queryByText("Mock existing evidence editor")).not.toBeInTheDocument();
  });

  it("offers the current form when only a submitted superseded-version record exists", async () => {
    vi.mocked(listOetsTemplateCatalog).mockResolvedValue({ templates: [{ template_registry_id: "registry-1", template_version_id: "version-current", template_code: "OGI_F905_CHECKLIST_INSPECTION", template_name: "Weekly Safety Audit Checklist", template_archetype: "CHECKLIST", module: "AUDIT", template_version: "3.3", schema_version: "1", checksum: "checksum-current", registry_status: "ACTIVE", version_status: "ACTIVE", description: null, business_context: null, document_number: "OGI F-905", document_revision: "2.0", registered_at: "2026-01-02", last_synchronized_at: null }] });
    vi.mocked(listOperationalEvidenceRecords).mockResolvedValue({ records: [{ evidence_record_id: "historical-submission", template_registry_id: "registry-1", template_version_id: "version-obsolete", template_code: "OGI_F905_CHECKLIST_INSPECTION", template_version: "3.2", schema_version: "1", client_id: "client-1", facility_id: "facility-1", lifecycle_state: "SUBMITTED", payload_checksum: "historical-checksum", created_by_user_id: "user-1", submitted_by_user_id: "user-1", created_at: "2026-01-01", submitted_at: "2026-01-01", updated_at: "2026-01-01" }], pagination: { limit: 100, offset: 0, count: 1, total_count: 1 } });
    const user = userEvent.setup();
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<MemoryRouter><QueryClientProvider client={queryClient}><FacilityAssessmentJourneysPage /></QueryClientProvider></MemoryRouter>);
    await screen.findByRole("option", { name: "Braven Resorts" });
    await user.selectOptions(screen.getByLabelText("Client"), "client-1");
    await screen.findByRole("option", { name: "Sky Ranch" });
    await user.selectOptions(screen.getByLabelText("Facility"), "facility-1");
    await screen.findByText("1 of 9");
    await user.click(await screen.findByRole("button", { name: /Governance & Documentation/ }));
    expect(await screen.findByText(/Historical submitted v3\.2 is preserved/)).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Start current form →" }));
    expect(screen.getByRole("dialog")).toHaveTextContent("New form");
  });
});
