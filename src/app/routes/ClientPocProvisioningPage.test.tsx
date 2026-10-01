import {QueryClient,QueryClientProvider} from "@tanstack/react-query";
import {cleanup,render,screen,waitFor,within} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {MemoryRouter} from "react-router-dom";
import {afterEach,beforeEach,describe,expect,it,vi} from "vitest";
import * as invitationApi from "../../admin/clientPocInvitationApi";
import * as clientApi from "../../registration/registrationClientApi";
import * as facilityApi from "../../registration/registrationFacilityApi";
import {ClientPocProvisioningPage} from "./ClientPocProvisioningPage";

const auth={canUsePermission:vi.fn(()=>true),session:{clientId:null as string|null}};
vi.mock("../../auth/useAuth",()=>({useAuth:()=>auth}));
vi.mock("../../admin/clientPocInvitationApi");
vi.mock("../../registration/registrationClientApi");
vi.mock("../../registration/registrationFacilityApi");
const client={id:"00000000-0000-4000-8000-000000000001",organization_name:"AiaAva Hotels",status:"ACTIVE"};
const facility={id:"00000000-0000-4000-8000-000000000002",client_id:client.id,facility_name:"Aia Private Club",operational_status:"ACTIVE"};
const invitation={id:"00000000-0000-4000-8000-000000000003",invitation_type:"CLIENT_POC" as const,client_id:client.id,full_name:"Client Contact",email:"contact@example.test",facility_scope:{mode:"EXPLICIT" as const,facility_ids:[facility.id]},status:"ISSUED" as const,issued_by_user_id:"00000000-0000-4000-8000-000000000004",issued_at:"2026-09-24T08:00:00Z",expires_at:"2026-09-25T08:00:00Z",consumed_at:null,revoked_at:null,integrity_checksum:"a".repeat(64)};

function view(){const queryClient=new QueryClient({defaultOptions:{queries:{retry:false},mutations:{retry:false}}});return render(<QueryClientProvider client={queryClient}><MemoryRouter><ClientPocProvisioningPage/></MemoryRouter></QueryClientProvider>)}
async function fill(user:ReturnType<typeof userEvent.setup>){await screen.findByText(facility.facility_name);await user.type(screen.getByLabelText("Full name"),"Client Contact");await user.type(screen.getByLabelText("Business email"),"contact@example.test");await user.click(screen.getByLabelText(facility.facility_name))}
beforeEach(()=>{auth.canUsePermission.mockReturnValue(true);auth.session.clientId=null;vi.mocked(clientApi.listRegistrationClients).mockResolvedValue({clients:[client]} as never);vi.mocked(facilityApi.listRegistrationFacilities).mockResolvedValue({facilities:[facility]} as never);vi.mocked(invitationApi.listClientPocInvitations).mockResolvedValue({invitations:[]});vi.mocked(invitationApi.issueClientPocInvitation).mockResolvedValue({invitation,activation_token:"one-time-secret",idempotent_replay:false});vi.mocked(invitationApi.revokeClientPocInvitation).mockResolvedValue({unchanged:false});Object.defineProperty(navigator,"clipboard",{configurable:true,value:{writeText:vi.fn().mockResolvedValue(undefined)}})});
afterEach(()=>{cleanup();vi.clearAllMocks()});

describe("OGI Client POC invitation UI",()=>{
  it("collects governed invitation fields without an OGI-selected password",async()=>{const user=userEvent.setup();view();await fill(user);expect(screen.queryByLabelText(/password/i)).not.toBeInTheDocument();await user.click(screen.getByRole("button",{name:"Generate invitation link"}));await waitFor(()=>expect(invitationApi.issueClientPocInvitation).toHaveBeenCalledWith({client_id:client.id,full_name:"Client Contact",email:"contact@example.test",facility_scope:{mode:"EXPLICIT",facility_ids:[facility.id]}},expect.any(String)))});
  it("shows and copies the one-time activation link",async()=>{const user=userEvent.setup();view();await fill(user);await user.click(screen.getByRole("button",{name:"Generate invitation link"}));const field=await screen.findByLabelText<HTMLInputElement>("One-time registration link");expect(field.value).toContain("client_poc_token=one-time-secret");await user.click(screen.getByRole("button",{name:"Copy registration link"}));expect(await screen.findByText("Registration link copied.")).toBeInTheDocument()});
  it("supports Client-wide authority without Facility IDs",async()=>{const user=userEvent.setup();view();await screen.findByText(facility.facility_name);await user.type(screen.getByLabelText("Full name"),"Client Contact");await user.type(screen.getByLabelText("Business email"),"contact@example.test");await user.click(screen.getByLabelText("Client-wide Access"));await user.click(screen.getByRole("button",{name:"Generate invitation link"}));await waitFor(()=>expect(invitationApi.issueClientPocInvitation).toHaveBeenCalledWith(expect.objectContaining({facility_scope:{mode:"CLIENT_WIDE"}}),expect.any(String)))});
  it("lists human Facility names and revokes issued invitations",async()=>{vi.mocked(invitationApi.listClientPocInvitations).mockResolvedValue({invitations:[invitation]});const user=userEvent.setup();view();await screen.findAllByText(facility.facility_name);const item=(await screen.findByText("Client Contact")).closest("li")!;expect(within(item).getByText(facility.facility_name)).toBeInTheDocument();expect(item).not.toHaveTextContent(facility.id);await user.click(within(item).getByRole("button",{name:"Revoke"}));await waitFor(()=>expect(vi.mocked(invitationApi.revokeClientPocInvitation).mock.calls[0]?.[0]).toBe(invitation.id))});
  it("fails closed without create_user",()=>{auth.canUsePermission.mockReturnValue(false);view();expect(screen.getByRole("heading",{name:"You are not authorized to invite Client POC accounts."})).toBeInTheDocument();expect(invitationApi.listClientPocInvitations).not.toHaveBeenCalled()});
});
