import {QueryClient,QueryClientProvider} from "@tanstack/react-query";
import {render,screen} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {beforeEach,expect,it,vi} from "vitest";
import {InviteLifeguardPanel} from "./InviteLifeguardPanel";
import * as facilityApi from "./registrationFacilityApi";
import * as invitationApi from "./personnelRegistrationInvitationApi";

vi.mock("./registrationFacilityApi",()=>({listRegistrationFacilities:vi.fn()}));
vi.mock("./personnelRegistrationInvitationApi",()=>({issuePersonnelRegistrationInvitation:vi.fn(),listPersonnelRegistrationInvitations:vi.fn(),revokePersonnelRegistrationInvitation:vi.fn()}));
const client={id:"c1",organization_name:"Aia Ava",business_identifier:"C1",status:"ACTIVE" as const,contact_email:null,contact_phone:null,address:null,country:null,notes:null,created_at:"2026-01-01",updated_at:"2026-01-01",deleted_at:null};
const facility={id:"f1",client_id:"c1",facility_name:"Aia Private Club",business_identifier:"F1",facility_type:"BEACH" as const,operational_status:"ACTIVE" as const,address:null,country:null,timezone:"America/Nassau",notes:null,created_at:"2026-01-01",updated_at:"2026-01-01",deleted_at:null};
const invitation={id:"i1",client_id:"c1",facility_id:"f1",full_name:"Guard One",email:"guard@example.test",assigned_from:"2026-10-01",role_name:"CLIENT_LIFEGUARD" as const,duty_code:"OPERATIONAL_LIFEGUARD" as const,position_title:"Lifeguard" as const,status:"ISSUED" as const,issued_by_user_id:"u1",issued_at:"2026-09-24T00:00:00Z",expires_at:"2026-09-25T00:00:00Z",consumed_at:null,revoked_at:null,superseded_by_invitation_id:null,integrity_checksum:"a".repeat(64)};
function view(){const queryClient=new QueryClient({defaultOptions:{queries:{retry:false},mutations:{retry:false}}});return render(<QueryClientProvider client={queryClient}><InviteLifeguardPanel clients={[client]}/></QueryClientProvider>)}
beforeEach(()=>{vi.mocked(facilityApi.listRegistrationFacilities).mockResolvedValue({facilities:[facility]});vi.mocked(invitationApi.listPersonnelRegistrationInvitations).mockResolvedValue({client_id:"c1",facility_id:null,status:null,invitations:[]});vi.mocked(invitationApi.issuePersonnelRegistrationInvitation).mockResolvedValue({invitation,activation_token:"invite-secret",idempotent_replay:false});localStorage.clear();sessionStorage.clear()});

it("collects explicit authority and exposes server-owned Lifeguard values",async()=>{const user=userEvent.setup();view();await user.click(screen.getByRole("button",{name:"Invite New Lifeguard"}));
  await user.selectOptions(screen.getByLabelText("Client"),"c1");await user.selectOptions(await screen.findByLabelText("Facility"),"f1");
  await user.type(screen.getByLabelText("Full name"),"Guard One");await user.type(screen.getByLabelText("Email"),"guard@example.test");await user.type(screen.getByLabelText("Assignment effective date"),"2026-10-01");
  expect(screen.getByText(/Governed duty:/).parentElement).toHaveTextContent("Operational Lifeguard");await user.click(screen.getByRole("button",{name:"Generate invitation link"}));
  expect(invitationApi.issuePersonnelRegistrationInvitation).toHaveBeenCalledWith({client_id:"c1",facility_id:"f1",full_name:"Guard One",email:"guard@example.test",assigned_from:"2026-10-01"},expect.any(String));
  const link=await screen.findByLabelText<HTMLInputElement>("One-time registration link");expect(link.value).toContain("registration_token=invite-secret");expect(localStorage.length).toBe(0);expect(sessionStorage.length).toBe(0);
});
