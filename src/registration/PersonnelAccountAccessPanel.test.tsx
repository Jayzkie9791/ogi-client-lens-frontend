import {QueryClient,QueryClientProvider} from "@tanstack/react-query";
import {render,screen} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {beforeEach,expect,it,vi} from "vitest";
import {PersonnelAccountAccessPanel} from "./PersonnelAccountAccessPanel";
import * as api from "./personnelAccountActivationApi";
import {RegistrationPersonnel} from "./registrationPersonnelApi";

vi.mock("./personnelAccountActivationApi",()=>({listPersonnelActivationInvitations:vi.fn(),issuePersonnelActivationInvitation:vi.fn(),revokePersonnelActivationInvitation:vi.fn()}));
const personnel:RegistrationPersonnel={id:"p1",client_id:"c1",user_id:null,full_name:"Guard One",client_employee_number:"EMP-1",email:"guard@example.test",employment_status:"ACTIVE",created_at:"2026-01-01",updated_at:"2026-01-01"};
const assignment={id:"a1",staff_member_id:"p1",facility_id:"f1",assignment_status:"ACTIVE" as const,assigned_from:"2026-01-01",assigned_to:null,is_primary_assignment:true,duty_code:"OPERATIONAL_LIFEGUARD" as const,created_at:"2026-01-01",updated_at:"2026-01-01"};
const invitation={id:"i1",personnel_id:"p1",client_id:"c1",email:"guard@example.test",status:"ISSUED" as const,issued_at:"2026-09-24T00:00:00Z",expires_at:"2026-09-25T00:00:00Z",consumed_at:null,revoked_at:null,superseded_by_invitation_id:null,issued_by_user_id:"u1",integrity_checksum:"a".repeat(64)};
function view(props:{personnel?:typeof personnel;assignments?:typeof assignment[]}={}){const client=new QueryClient({defaultOptions:{queries:{retry:false},mutations:{retry:false}}});return render(<QueryClientProvider client={client}><PersonnelAccountAccessPanel personnel={props.personnel??personnel} assignments={props.assignments??[assignment]}/></QueryClientProvider>)}
beforeEach(()=>{vi.mocked(api.listPersonnelActivationInvitations).mockReset().mockResolvedValue({client_id:"c1",personnel_id:"p1",invitations:[]});vi.mocked(api.issuePersonnelActivationInvitation).mockReset();vi.mocked(api.revokePersonnelActivationInvitation).mockReset();localStorage.clear();sessionStorage.clear();Object.defineProperty(navigator,"clipboard",{configurable:true,value:{writeText:vi.fn().mockResolvedValue(undefined)}});});

it("blocks issuance when governed eligibility is incomplete",()=>{view({assignments:[]});expect(screen.getByText(/current governed Operational Lifeguard/)).toBeInTheDocument();expect(screen.queryByRole("button",{name:"Issue activation invitation"})).not.toBeInTheDocument()});
it("shows linked accounts without performing invitation administration",()=>{view({personnel:{...personnel,user_id:"u1"}});expect(screen.getByText("Account access: Active")).toBeInTheDocument();expect(api.listPersonnelActivationInvitations).not.toHaveBeenCalled()});
it("issues and copies a one-time activation link without browser storage",async()=>{vi.mocked(api.issuePersonnelActivationInvitation).mockResolvedValue({invitation,activation_token:"one-time-secret",idempotent_replay:false});view();const user=userEvent.setup();
  await user.click(await screen.findByRole("button",{name:"Issue activation invitation"}));const field=await screen.findByLabelText<HTMLInputElement>("One-time activation link");expect(field.value).toContain("token=one-time-secret");
  await user.click(screen.getByRole("button",{name:"Copy activation link"}));expect(await screen.findByText("Activation link copied.")).toBeInTheDocument();expect(localStorage.length).toBe(0);expect(sessionStorage.length).toBe(0);
});
