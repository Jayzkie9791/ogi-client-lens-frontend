import { afterEach, describe, expect, it, vi } from "vitest";
import { listCanonicalReviewQueue } from "./canonicalReviewQueueApi";

describe("CFAC-4S8B canonical reviewer queue API",()=>{
  afterEach(()=>vi.unstubAllGlobals());
  it("loads deterministic pagination and validates the exact queue projection",async()=>{
    const fetchMock=vi.fn().mockResolvedValue(json({items:[item()],pagination:{limit:25,offset:0,count:1,total_count:1}}));
    vi.stubGlobal("fetch",fetchMock);
    await expect(listCanonicalReviewQueue({limit:25,offset:0})).resolves.toMatchObject({items:[{status:"AWAITING_REVIEWER"}]});
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("/api/v1/operational-evidence/canonical-review-queue?limit=25&offset=0");
  });
  it("fails closed on malformed queue projections",async()=>{
    vi.stubGlobal("fetch",vi.fn().mockResolvedValue(json({items:[{...item(),assessor:null}],pagination:{limit:25,offset:0,count:1,total_count:1}})));
    await expect(listCanonicalReviewQueue()).rejects.toMatchObject({code:"MALFORMED_RESPONSE"});
  });
});

function item(){return {evidence_record_id:"evidence-1",template:{version_id:"version-1",code:"OGI_F001_TEST",version:"1.0",checksum:"a".repeat(64)},payload_checksum:"b".repeat(64),client:{id:"client-1",name:"Client"},facility:{id:"facility-1",name:"Facility"},creator:{user_id:"creator-1",name:"Creator"},assessor:{user_id:"assessor-1",name:"Assessor",business_identifier:"OGI-001",signed_at:"2026-10-05T01:00:00.000Z"},created_at:"2026-10-05T00:00:00.000Z",updated_at:"2026-10-05T01:00:00.000Z",status:"AWAITING_REVIEWER"};}
function json(value:unknown){return new Response(JSON.stringify(value),{status:200,headers:{"Content-Type":"application/json"}});}
