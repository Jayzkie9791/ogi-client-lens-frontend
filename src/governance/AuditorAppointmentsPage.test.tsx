import {QueryClient,QueryClientProvider} from "@tanstack/react-query";
import {render,screen,waitFor} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {beforeEach,describe,expect,it,vi} from "vitest";

import {AuditorAppointmentsPage} from "./AuditorAppointmentsPage";
import {listAuditorAppointments} from "./auditorAppointmentsApi";
import {listFeatureClients,listFeatureFacilities} from "../api/featureScopedDiscoveryApi";
import {listRegistrationPersonnel} from "../registration/registrationPersonnelApi";

const canUsePermission=vi.hoisted(()=>vi.fn<(permission:string)=>boolean>());
vi.mock("../auth/useAuth",()=>({useAuth:()=>({canUsePermission})}));
vi.mock("./auditorAppointmentsApi",()=>({
  appointmentProfiles:["AUDIT_OPERATOR"],appointmentScopes:["FACILITY_SPECIFIC","CLIENT_WIDE","OGI_ENTERPRISE"],
  listAuditorAppointments:vi.fn(async()=>({appointments:[]})),createAuditorAppointment:vi.fn()
}));
vi.mock("../api/featureScopedDiscoveryApi",()=>({listFeatureClients:vi.fn(async()=>({clients:[]})),listFeatureFacilities:vi.fn(async()=>({facilities:[]}))}));
vi.mock("../registration/registrationPersonnelApi",()=>({listRegistrationPersonnel:vi.fn(async()=>({personnel:[]}))}));

function view(){
  const queryClient=new QueryClient({defaultOptions:{queries:{retry:false},mutations:{retry:false}}});
  return render(<QueryClientProvider client={queryClient}><AuditorAppointmentsPage/></QueryClientProvider>);
}

describe("AuditorAppointmentsPage discovery authority",()=>{
  beforeEach(()=>{
    vi.clearAllMocks();
    canUsePermission.mockImplementation(permission=>permission==="view_audit_appointment");
  });

  it("keeps appointment reads available without mounting registration discovery for CLIENT_ADMIN",async()=>{
    view();
    expect(await screen.findByText("No auditor appointments match the current filters.")).toBeInTheDocument();
    expect(listAuditorAppointments).toHaveBeenCalledTimes(1);
    expect(listFeatureClients).not.toHaveBeenCalled();
    expect(listRegistrationPersonnel).not.toHaveBeenCalled();
    expect(listFeatureFacilities).not.toHaveBeenCalled();
    expect(screen.queryByRole("button",{name:"New Appointment"})).not.toBeInTheDocument();
  });

  it("loads bounded creation discovery only after an authorized manager opens the workflow",async()=>{
    canUsePermission.mockImplementation(permission=>["view_audit_appointment","manage_audit_appointment"].includes(permission));
    const user=userEvent.setup();
    view();
    await screen.findByText("No auditor appointments match the current filters.");
    expect(listFeatureClients).not.toHaveBeenCalled();
    expect(listRegistrationPersonnel).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button",{name:"New Appointment"}));
    await waitFor(()=>expect(listFeatureClients).toHaveBeenCalledWith("auditor-appointments"));
    expect(listRegistrationPersonnel).toHaveBeenCalledTimes(1);
    expect(listFeatureFacilities).not.toHaveBeenCalled();
  });
});
