import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { FacilityAssessmentJourneysPage } from "./FacilityAssessmentJourneysPage";
import { calculateFacilityOri, getCertificationFormCompleteness, getCurrentFacilityOri, getDomainAssessmentDetail, getFacilityOriHistory, getFacilityOriReadiness, getFacilityWorkforceAuthority, getPersonnelFormCompleteness } from "./facilityAssessmentApi";
import { listOetsTemplateCatalog } from "../oets/templateCatalogApi";
import { listOperationalEvidenceRecords } from "../oets/recordsApi";

const runtimeTemplateSpy = vi.hoisted(() => vi.fn());

vi.mock("../registration/registrationClientApi", () => ({ listRegistrationClients: vi.fn(async () => ({ clients: [{ id: "client-1", business_identifier: "CLIENT-2026-000016", organization_name: "Braven Resorts", status: "ACTIVE", created_at: "2026-01-01", updated_at: "2026-01-01" }] })) }));
vi.mock("../registration/registrationFacilityApi", () => ({ listRegistrationFacilities: vi.fn(async () => ({ facilities: [{ id: "facility-1", client_id: "client-1", business_identifier: "FACILITY-2026-000017", facility_name: "Sky Ranch", facility_type: "WATERPARK", operational_status: "ACTIVE", created_at: "2026-01-01", updated_at: "2026-01-01" }] })) }));
vi.mock("../auth/useAuth", () => ({ useAuth: () => ({ session: { id: "user-1", fullName: "Maria Hannah Khrisna Depacaquivo" }, canUsePermission: (permission: string) => permission === "review_domain_assessment" }) }));
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
  getCertificationFormCompleteness: vi.fn(async (_clientId:string,_facilityId:string,formCode:"F041"|"F044"|"F047") => ({projectionVersion:"CERTIFICATION_FORM_COMPLETENESS_V2",clientId:"client-1",facilityId:"facility-1",formCode,templateCode:formCode,counts:{certifications:1,withCurrentEvidence:0,eligibleToRequest:formCode==="F044"?1:0,dataIssues:0,excluded:0},subjects:[{certificationId:"cert-1",certificationNumber:"OGI-GR-1",certificationLevel:"L1",certificationStatus:"ACTIVE",holderName:"Sky Alcantara",issueDate:"2026-01-01T00:00:00.000Z",expiryDate:"2027-01-01T00:00:00.000Z",eligibility:formCode==="F041"?"RECORDABLE":formCode==="F044"?"ELIGIBLE_TO_REQUEST":"VERIFIABLE",currentRecord:null,records:[]}],checksum:"c".repeat(64)})),
  calculateFacilityOri: vi.fn(),
  getDomainAssessmentDetail: vi.fn(async () => ({ id: "assessment-1", lifecycle: "FINAL", applicability: [{ formCode: "F002", canonicalOrder: 1, state: "APPLICABLE", contributions: [{ sourceKind: "OPERATIONAL_EVIDENCE", sourceId: "evidence-1", sourceAt: "2026-08-30T00:00:00.000Z" }] }] }))
}));

describe("FacilityAssessmentJourneysPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(listOetsTemplateCatalog).mockResolvedValue({ templates: [] });
    vi.mocked(listOperationalEvidenceRecords).mockResolvedValue({ records: [], pagination: { limit: 100, offset: 0, count: 0, total_count: 0 } });
    vi.mocked(getCurrentFacilityOri).mockResolvedValue(null);
    vi.mocked(getFacilityOriHistory).mockResolvedValue([]);
    vi.mocked(getFacilityWorkforceAuthority).mockClear();
    vi.mocked(getPersonnelFormCompleteness).mockClear();
    vi.mocked(getCertificationFormCompleteness).mockClear();
  });

  it("calculates ORI when all nine category finals are eligible", async () => {
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
    expect(await screen.findByText("All nine category finals are eligible. ORI is ready to calculate.")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Calculate ORI" }));
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
    expect(screen.getByRole("button", { name: "Calculate ORI" })).toBeDisabled();
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
    expect(runtimeTemplateSpy).toHaveBeenLastCalledWith(expect.objectContaining({ initialFieldValues: expect.objectContaining({ CLIENT_ID: "CLIENT-2026-000016", CLIENT_NUMBER: "CLIENT-2026-000016", CLIENT_ORGANIZATION_ID: "CLIENT-2026-000016", CLIENT_NAME: "Braven Resorts", CLIENT_ORGANIZATION: "Braven Resorts", FACILITY_ID: "FACILITY-2026-000017", FACILITY_NUMBER: "FACILITY-2026-000017", FACILITY_TYPE: ["WATERPARK"], ASSESSOR: "Maria Hannah Khrisna Depacaquivo", ASSESSMENT_DATE: expect.any(String) }) }));
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
