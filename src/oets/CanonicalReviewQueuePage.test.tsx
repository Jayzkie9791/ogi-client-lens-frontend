import { QueryClient,QueryClientProvider } from "@tanstack/react-query";
import { render,screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach,describe,expect,it,vi } from "vitest";
import { CanonicalReviewQueuePage } from "./CanonicalReviewQueuePage";

const canUsePermission=vi.fn<(permission:string)=>boolean>();
vi.mock("../auth/useAuth",()=>({useAuth:()=>({canUsePermission})}));

describe("CFAC-4S8C canonical reviewer queue UAT contract",()=>{
  afterEach(()=>{vi.restoreAllMocks();vi.unstubAllGlobals();canUsePermission.mockReset();});

  it("shows an eligible assessed Draft with a durable read-only review link",async()=>{
    canUsePermission.mockReturnValue(true);
    vi.stubGlobal("fetch",vi.fn().mockResolvedValue(json({items:[item()],pagination:{limit:25,offset:0,count:1,total_count:1}})));
    renderPage();
    expect(await screen.findByRole("heading",{name:"Awaiting My Review"})).toBeInTheDocument();
    expect(await screen.findByText("Assessor One · OGI-001")).toBeInTheDocument();
    expect(screen.getByRole("link",{name:"Review Draft"})).toHaveAttribute("href","/workbench/evidence/evidence-1?return=review-queue");
    expect(screen.queryByText("Save Draft")).not.toBeInTheDocument();
  });

  it("fails closed when either viewing or reviewing authority is absent",()=>{
    canUsePermission.mockImplementation(permission=>permission!=="view_operational_evidence");
    renderPage();
    expect(screen.getByRole("heading",{name:"Reviewer authority unavailable."})).toBeInTheDocument();
    expect(screen.queryByRole("link",{name:"Review Draft"})).not.toBeInTheDocument();
  });

  it("shows deterministic empty state after another Reviewer wins",async()=>{
    canUsePermission.mockReturnValue(true);
    vi.stubGlobal("fetch",vi.fn().mockResolvedValue(json({items:[],pagination:{limit:25,offset:0,count:0,total_count:0}})));
    renderPage();
    expect(await screen.findByRole("heading",{name:"No Drafts are awaiting your review."})).toBeInTheDocument();
  });
});

function renderPage(){const client=new QueryClient({defaultOptions:{queries:{retry:false}}});return render(<QueryClientProvider client={client}><MemoryRouter><CanonicalReviewQueuePage/></MemoryRouter></QueryClientProvider>);}
function item(){return {evidence_record_id:"evidence-1",template:{version_id:"version-1",code:"OGI_F001_TEST",version:"1.0",checksum:"a".repeat(64)},payload_checksum:"b".repeat(64),client:{id:"client-1",name:"Client One"},facility:{id:"facility-1",name:"Facility One"},creator:{user_id:"creator-1",name:"Draft Owner"},assessor:{user_id:"assessor-1",name:"Assessor One",business_identifier:"OGI-001",signed_at:"2026-10-05T01:00:00.000Z"},created_at:"2026-10-05T00:00:00.000Z",updated_at:"2026-10-05T01:00:00.000Z",status:"AWAITING_REVIEWER"};}
function json(value:unknown){return new Response(JSON.stringify(value),{status:200,headers:{"Content-Type":"application/json"}});}
