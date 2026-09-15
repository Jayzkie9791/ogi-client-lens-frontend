import {QueryClient,QueryClientProvider} from "@tanstack/react-query";
import {render,screen,waitFor} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {afterEach,describe,expect,it,vi} from "vitest";
import {IncidentContextRegistration} from "./IncidentContextRegistration";

describe("Incident context registration",()=>{
  afterEach(()=>vi.unstubAllGlobals());
  it("registers through governed Incident API and returns the created identity",async()=>{
    const user=userEvent.setup();const onCreated=vi.fn();const fetchMock=vi.fn().mockResolvedValue(new Response(JSON.stringify({success:true,data:{incident_id:"incident-1",business_identifier:"INCIDENT-2026-000001",incident_type:"OTHER",severity:"LOW"}}),{status:200,headers:{"Content-Type":"application/json"}}));vi.stubGlobal("fetch",fetchMock);
    render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false},mutations:{retry:false}}})}><IncidentContextRegistration disabled={false} facilityId="11111111-1111-4111-8111-111111111111" onCreated={onCreated}/></QueryClientProvider>);
    await user.click(screen.getByRole("button",{name:"Register New Incident"}));
    await user.type(screen.getByLabelText("Incident date and time"),"2026-09-15T09:30");
    await user.type(screen.getByLabelText("Description"),"Pool deck incident");
    await user.click(screen.getByRole("button",{name:"Register Incident"}));
    await waitFor(()=>expect(onCreated).toHaveBeenCalledWith(expect.objectContaining({incident_id:"incident-1"})));
    const request=fetchMock.mock.calls[0];const body=JSON.parse(String((request?.[1] as RequestInit)?.body));
    expect(String(request?.[0])).toContain("/api/v1/incidents");expect(body).toMatchObject({facility_id:"11111111-1111-4111-8111-111111111111",incident_category:"INCIDENT_EVENT",incident_type:"OTHER",severity:"LOW",persons_involved:0,description:"Pool deck incident"});expect(body.incident_date).toMatch(/Z$/);
  });
  it("does not expose registration while disabled",()=>{render(<QueryClientProvider client={new QueryClient()}><IncidentContextRegistration disabled facilityId="11111111-1111-4111-8111-111111111111" onCreated={()=>{}}/></QueryClientProvider>);expect(screen.getByRole("button",{name:"Register New Incident"})).toBeDisabled();});
});
