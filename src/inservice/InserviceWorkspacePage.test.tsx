import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthContext, type AuthContextValue } from "../auth/AuthContext";
import { inserviceApi } from "./inserviceApi";
import { InserviceWorkspacePage } from "./InserviceWorkspacePage";

vi.mock("./inserviceApi", () => ({ inserviceApi: {
  facilities:vi.fn(),
  proposalDrafts:vi.fn(),createProposal:vi.fn(),updateProposal:vi.fn(),abandonProposal:vi.fn(),submitProposal:vi.fn(),
  eventApprovalQueue:vi.fn(),decideEvent:vi.fn(),
  drafts: vi.fn(), eligible: vi.fn(), create: vi.fn(), update: vi.fn(), submit: vi.fn(),
  approvedEvents:vi.fn(),claimDrafts:vi.fn(),createClaim:vi.fn(),readClaim:vi.fn(),submitClaim:vi.fn(),
  updateClaim:vi.fn(),claimHistory:vi.fn(),claimReviewQueue:vi.fn(),claimReview:vi.fn(),decideClaim:vi.fn(),
  submittedEvidence:vi.fn(),downloadSubmittedEvidence:vi.fn(),correctionClaim:vi.fn(),
  claimEvidence:vi.fn(),uploadClaimEvidence:vi.fn(),downloadClaimEvidence:vi.fn(),removeClaimEvidence:vi.fn(),
  targets: vi.fn(), progress: vi.fn(), openMonth: vi.fn(), saveFeedback: vi.fn(), finalizeMonth: vi.fn()
} }));
const facilityId = "22222222-2222-4222-8222-222222222222";
function renderAs(permissions: string[], clientId: string | null = null, roles:string[] = []) {
  const auth: AuthContextValue = { status: "authenticated", errorMessage: null,
    session: { id: "11111111-1111-4111-8111-111111111111", email: null, username: null,
      fullName: "Operator", status: "ACTIVE", clientId, facilityScopeMode: "EXPLICIT",
      facilityIds: [facilityId], roles, permissions },
    login: vi.fn(), logout: vi.fn(), clearAuthError: vi.fn(), refreshAccessToken: vi.fn(),
    canUsePermission: (permission) => permissions.includes(permission) };
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><AuthContext.Provider value={auth}>
    <InserviceWorkspacePage /></AuthContext.Provider></QueryClientProvider>);
}

describe("IS-5B bounded in-service workspace", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(inserviceApi.facilities).mockResolvedValue({has_more:false,facilities:[{id:facilityId,
      facility_name:"Aia Private Club",timezone:"America/Nassau"}]});
    vi.mocked(inserviceApi.proposalDrafts).mockResolvedValue({drafts:[]});
    vi.mocked(inserviceApi.eventApprovalQueue).mockResolvedValue({facility_id:facilityId,events:[]});
    vi.mocked(inserviceApi.drafts).mockResolvedValue({ drafts: [] });
    vi.mocked(inserviceApi.approvedEvents).mockResolvedValue({events:[]});
    vi.mocked(inserviceApi.claimDrafts).mockResolvedValue({drafts:[]});
    vi.mocked(inserviceApi.claimHistory).mockResolvedValue({facility_id:facilityId,has_more:false,claims:[]});
    vi.mocked(inserviceApi.claimReviewQueue).mockResolvedValue({facility_id:facilityId,has_more:false,claims:[]});
    vi.mocked(inserviceApi.targets).mockResolvedValue({ has_more: false, targets: [] });
  });

  it("separates Client Lead event proposals from approval and evaluation", async () => {
    renderAs(["create_training_log", "view_training_log"], "33333333-3333-4333-8333-333333333333",["CLIENT_LEAD_LIFEGUARD"]);
    expect(await screen.findByText("Aia Private Club")).toBeInTheDocument();
    expect(screen.queryByText(facilityId)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Recommended topics" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Participant hours" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Topic approval" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Monthly evaluation" })).not.toBeInTheDocument();
    await waitFor(() => expect(inserviceApi.proposalDrafts).toHaveBeenCalledWith(facilityId));
  });

  it("uses native device-local date/time controls and converts them to exact instants", async () => {
    const user = userEvent.setup();
    renderAs(["create_training_log", "view_training_log"],null,["OGI_ADMIN"]);
    await user.type(screen.getByLabelText("Topic title *"), "Rescue practice");
    const start=screen.getByLabelText("Completion period start *"),end=screen.getByLabelText("Completion period end *");
    expect(start).toHaveAttribute("type","datetime-local");expect(end).toHaveAttribute("type","datetime-local");
    expect(screen.getByText(/Select the completion period start and end/)).toBeInTheDocument();
    await user.type(start,"2026-10-10T09:00");await user.type(end,"2026-10-10T10:00");
    expect(screen.getByRole("button", { name: "Save topic Draft" })).toBeEnabled();
    expect(screen.queryByText("Roster and actual attendance")).not.toBeInTheDocument();
  });

  it("creates a header-only event proposal without roster or attendance",async()=>{
    const user=userEvent.setup();
    vi.mocked(inserviceApi.createProposal).mockResolvedValue({id:"draft-1",client_id:"client-1",facility_id:facilityId,
      facility_timezone:"America/Nassau",topic_title:"First aid practice",topic_description:null,
      related_category_code:null,starts_at:"2026-10-10T13:00:00.000Z",ends_at:"2026-10-10T14:00:00.000Z",
      conducting_user_id:null,revision:1,status:"DRAFT",root_event_id:null,corrects_revision_id:null,
      verified_credit_minutes:0});
    renderAs(["create_training_log","view_training_log"],"33333333-3333-4333-8333-333333333333",["CLIENT_LEAD_LIFEGUARD"]);
    await user.type(screen.getByLabelText("Topic title *"),"First aid practice");
    await user.type(screen.getByLabelText("Completion period start *"),"2026-10-10T09:00");
    await user.type(screen.getByLabelText("Completion period end *"),"2026-10-10T10:00");
    await user.click(screen.getByRole("button",{name:"Save topic Draft"}));
    await waitFor(()=>expect(inserviceApi.createProposal).toHaveBeenCalledWith({facility_id:facilityId,
      topic_title:"First aid practice",topic_description:null,related_category_code:null,
      starts_at:new Date("2026-10-10T09:00").toISOString(),ends_at:new Date("2026-10-10T10:00").toISOString(),
      conducting_user_id:null},expect.any(String)));
  });

  it("uploads private unscanned evidence only after creating an explicit participant claim Draft",async()=>{
    const user=userEvent.setup();
    vi.mocked(inserviceApi.approvedEvents).mockResolvedValue({events:[{event_id:"event-1",revision_id:"revision-1",
      revision_number:1,revision_checksum:"a".repeat(64),topic_title:"First aid practice",topic_description:null,
      related_category_code:null,starts_at:"2026-10-10T13:00:00.000Z",ends_at:"2026-10-10T14:00:00.000Z",
      decision:"APPROVED",decided_at:"2026-10-10T15:00:00.000Z",participant_entry_available:true}]});
    vi.mocked(inserviceApi.eligible).mockResolvedValue({facility_id:facilityId,facility_timezone:"America/Nassau",has_more:false,
      participants:[{staff_member_id:"staff-1",full_name:"Elmer Miranda",facility_assignment_id:"assignment-1",
        duty_code:"OPERATIONAL_LIFEGUARD",assigned_from:"2026-01-01",assigned_to:null}]});
    const claim={id:"claim-1",event_id:"event-1",event_revision_id:"revision-1",staff_member_id:"staff-1",
      facility_assignment_id:"assignment-1",revision:1,status:"DRAFT" as const,
      intervals:[{starts_at:"2026-10-10T13:00:00.000Z",ends_at:"2026-10-10T14:00:00.000Z"}]};
    vi.mocked(inserviceApi.createClaim).mockResolvedValue(claim);
    vi.mocked(inserviceApi.claimEvidence).mockResolvedValue({files:[]});
    vi.mocked(inserviceApi.uploadClaimEvidence).mockResolvedValue({id:"file-1",ordinal:1,original_file_name:"proof.png",
      detected_mime_type:"image/png",file_size_bytes:11,content_sha256:"b".repeat(64),storage_provider:"LOCAL_PRIVATE",
      lifecycle_state:"AVAILABLE",safety_status:"UNSCANNED",revision:1,safety_warning:"UNSCANNED",download_available:true});
    renderAs(["create_training_log","view_training_log","submit_training_log"]);
    await user.click(screen.getByRole("button",{name:"Participant hours"}));
    await screen.findByRole("option",{name:/First aid practice/});
    await user.selectOptions(screen.getByLabelText("Approved topic"),"revision-1");
    await user.click(await screen.findByRole("button",{name:/Elmer Miranda/}));
    await user.click(screen.getByRole("button",{name:"Create participant claim Draft"}));
    await waitFor(()=>expect(inserviceApi.createClaim).toHaveBeenCalledWith({event_id:"event-1",event_revision_id:"revision-1",
      staff_member_id:"staff-1",facility_assignment_id:"assignment-1",intervals:[{
        starts_at:"2026-10-10T13:00:00.000Z",ends_at:"2026-10-10T14:00:00.000Z"}]},expect.any(String)));
    const request=vi.mocked(inserviceApi.createClaim).mock.calls[0]?.[0] as Record<string,unknown>;
    expect(request).not.toHaveProperty("full_name");expect(request).not.toHaveProperty("duty_code");
    expect(request).not.toHaveProperty("assigned_from");expect(request).not.toHaveProperty("assigned_to");
    const input=await screen.findByLabelText("Evidence file");
    await user.upload(input,new File([new Uint8Array([0x89,0x50,0x4e,0x47])],"proof.png",{type:"image/png"}));
    await user.click(screen.getByRole("button",{name:"Upload private evidence"}));
    await waitFor(()=>expect(inserviceApi.uploadClaimEvidence).toHaveBeenCalledWith("claim-1",expect.any(File),expect.any(String)));
    expect(screen.getAllByText(/UNSCANNED/).length).toBeGreaterThan(0);
  });

  it("keeps future attendance editable but prevents freezing it as completed attendance",async()=>{
    const user=userEvent.setup();
    const claim={id:"claim-future",event_id:"event-1",event_revision_id:"revision-1",staff_member_id:"staff-1",
      facility_assignment_id:"assignment-1",revision:1,status:"DRAFT" as const,
      intervals:[{starts_at:"2099-10-10T13:00:00.000Z",ends_at:"2099-10-10T14:00:00.000Z"}]};
    vi.mocked(inserviceApi.claimDrafts).mockResolvedValue({drafts:[claim]});
    vi.mocked(inserviceApi.claimEvidence).mockResolvedValue({files:[]});
    renderAs(["create_training_log","view_training_log","submit_training_log"],
      "33333333-3333-4333-8333-333333333333",["CLIENT_LIFEGUARD"]);
    const resume=await screen.findByRole("button",{name:"Resume saved attendance Draft 1"});
    expect(resume).not.toHaveTextContent("claim-future");
    await user.click(resume);
    expect(screen.getByText(/Attendance Draft.*Revision 1/)).not.toHaveTextContent("claim-future");
    expect(screen.getByRole("button",{name:"Save attendance Draft"})).toBeEnabled();
    expect(screen.getByLabelText("Evidence file")).toBeEnabled();
    await user.click(screen.getByRole("checkbox"));
    expect(screen.getByRole("button",{name:"Submit participant claim"})).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent(/Attendance and evidence can be saved now.*Submission becomes available after/);
    expect(inserviceApi.submitClaim).not.toHaveBeenCalled();
  });

  it("lets only governed OGI authority decide the exact submitted event revision", async () => {
    const user = userEvent.setup();
    vi.mocked(inserviceApi.eventApprovalQueue).mockResolvedValue({facility_id:facilityId,events:[{
      event_id:"event-1",revision_id:"revision-1",revision_number:1,submitted_at:"2026-10-10T12:00:00Z",
      revision_checksum:"a".repeat(64),topic_title:"Rescue practice",topic_description:"Practice",
      related_category_code:null,starts_at:"2026-10-10T10:00:00Z",ends_at:"2026-10-10T11:00:00Z",
      approval_status:"PENDING",verified_credit_minutes:0}]});
    vi.mocked(inserviceApi.decideEvent).mockResolvedValue({decision:"APPROVED"});
    renderAs(["approve_inservice_event","view_training_log"],null,["OGI_INSERVICE_EVENT_APPROVER"]);
    await user.click(await screen.findByRole("button",{name:/Rescue practice/}));
    const displayedStart=new Intl.DateTimeFormat(undefined,{dateStyle:"medium",timeStyle:"short",
      timeZone:Intl.DateTimeFormat().resolvedOptions().timeZone}).format(Date.parse("2026-10-10T10:00:00Z"));
    expect(screen.getByText(new RegExp(displayedStart.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")))).toBeInTheDocument();
    expect(screen.queryByText(/2026-10-10T10:00:00Z/)).not.toBeInTheDocument();
    expect(screen.getByText(/Shown in this device timezone/)).toBeInTheDocument();
    expect(screen.getByText("Governance integrity details").parentElement).toHaveTextContent("a".repeat(64));
    await user.click(screen.getByRole("button",{name:"Approve topic"}));
    await waitFor(()=>expect(inserviceApi.decideEvent).toHaveBeenCalledWith("event-1","revision-1","APPROVED",null,
      "a".repeat(64),expect.any(String)));
    expect(await screen.findByText(/No attendance or credit was created/)).toBeInTheDocument();
  });

  it("lets governed OGI reviewers decide exact participant attendance without an attestation step", async () => {
    const user = userEvent.setup();
    const review = { claim_id:"claim-1",claim_revision_id:"claim-revision-1",review_status:"PENDING" as const,
      effective_status:"PENDING",review:null,credits:[],verified_credit_minutes:0,
      expected_claim_revision_checksum:"a".repeat(64),expected_event_revision_checksum:"b".repeat(64),
      expected_evidence_manifest_checksum:"c".repeat(64),snapshot:{event_id:"event-1",event_revision_id:"event-revision-1",
        staff_member_id:"staff-1",facility_assignment_id:"assignment-1",intervals:[{
          starts_at:"2026-10-10T13:00:00.000Z",ends_at:"2026-10-10T14:00:00.000Z"}]},
      evidence_manifest:{integrity_checksum:"c".repeat(64),files:[]} };
    vi.mocked(inserviceApi.claimReviewQueue).mockResolvedValue({facility_id:facilityId,has_more:false,claims:[review]});
    vi.mocked(inserviceApi.claimReview).mockResolvedValue(review);
    vi.mocked(inserviceApi.submittedEvidence).mockResolvedValue({manifest_checksum:"c".repeat(64),files:[]});
    vi.mocked(inserviceApi.decideClaim).mockResolvedValue({...review,review_status:"APPROVED",effective_status:"APPROVED",
      verified_credit_minutes:60,review:{review_note:null,reviewed_at:"2026-10-11T12:00:00Z",verifier_role_name:"OGI reviewer"}});
    renderAs(["approve_training_log","view_training_log"]);
    await user.click(await screen.findByRole("button",{name:/Training attendance/}));
    expect(screen.queryByText(/2026-10-10T13:00:00/)).not.toBeInTheDocument();
    expect(screen.getByText(/Shown in this device timezone/)).toBeInTheDocument();
    expect(screen.queryByText(/attest/i)).not.toBeInTheDocument();
    await user.click(screen.getByRole("button",{name:"Approve attendance"}));
    await waitFor(()=>expect(inserviceApi.decideClaim).toHaveBeenCalledWith("claim-1","claim-revision-1","APPROVED",null,
      review,expect.any(String)));
    expect(await screen.findByText(/Exact verified participant minutes were created/)).toBeInTheDocument();
  });

  it("presents training-history attendance as a readable device-local interval", async () => {
    vi.mocked(inserviceApi.claimHistory).mockResolvedValue({facility_id:facilityId,has_more:false,claims:[{
      claim_id:"claim-1",claim_revision_id:"claim-revision-1",revision_number:1,predecessor_revision_id:null,
      submitted_at:"2026-10-10T15:00:00.000Z",personnel:{staff_member_id:"staff-1",current_display_name:"Elmer Miranda"},
      topic:{event_id:"event-1",event_revision_id:"event-revision-1",title:"First aid practice",description:null,
        related_category_code:null,completion_period_starts_at:"2026-10-01T04:00:00.000Z",
        completion_period_ends_at:"2026-10-31T03:59:00.000Z"},
      attendance_intervals:[{starts_at:"2026-10-10T13:00:00.000Z",ends_at:"2026-10-10T14:00:00.000Z",recorded_minutes:60}],
      evidence:{file_count:0,manifest_checksum:"c".repeat(64),safety_status:"UNSCANNED"},
      review:{status:"PENDING_REVIEW",review_note:null,reviewed_at:null,verifier_role_name:null},
      effective_verified_minutes:0,correction_draft_id:null,correction_available:false,
      claim_revision_checksum:"a".repeat(64),event_revision_checksum:"b".repeat(64)
    }]});
    renderAs(["view_training_log"]);
    expect(await screen.findByText(/First aid practice.*Elmer Miranda/)).toBeInTheDocument();
    expect(screen.queryByText(/2026-10-10T13:00:00/)).not.toBeInTheDocument();
    expect(screen.getByText(/Shown in this device timezone/)).toBeInTheDocument();
  });

  it("shows closed-month targets without opening a determination automatically", async () => {
    renderAs(["evaluate_inservice_monthly_result", "view_training_log"]);
    expect(await screen.findByRole("heading", { name: "Facility-local monthly evaluation" })).toBeInTheDocument();
    await waitFor(() => expect(inserviceApi.targets).toHaveBeenCalled());
    expect(inserviceApi.openMonth).not.toHaveBeenCalled();
  });
});
