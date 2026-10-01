import {afterEach,expect,it,vi} from "vitest";
import {configureApiAuth} from "../api/client";
import {issueClientPocInvitation,listClientPocInvitations,revokeClientPocInvitation} from "./clientPocInvitationApi";

const invitation={id:"i1",invitation_type:"CLIENT_POC",client_id:"c1",full_name:"Client Contact",email:"contact@example.test",facility_scope:{mode:"EXPLICIT",facility_ids:["f1"]},status:"ISSUED",issued_by_user_id:"u1",issued_at:"2026-09-24T00:00:00Z",expires_at:"2026-09-25T00:00:00Z",consumed_at:null,revoked_at:null,integrity_checksum:"a".repeat(64)};
afterEach(()=>{configureApiAuth(null);vi.unstubAllGlobals()});
it("uses the bounded AIR-2 issue, list, and revoke routes",async()=>{const fetch=vi.fn()
  .mockResolvedValueOnce(new Response(JSON.stringify({invitation,activation_token:"secret",idempotent_replay:false}),{status:201,headers:{"content-type":"application/json"}}))
  .mockResolvedValueOnce(new Response(JSON.stringify({invitations:[invitation]}),{status:200,headers:{"content-type":"application/json"}}))
  .mockResolvedValueOnce(new Response(JSON.stringify({unchanged:false}),{status:200,headers:{"content-type":"application/json"}}));vi.stubGlobal("fetch",fetch);
  const request={client_id:"c1",full_name:"Client Contact",email:"contact@example.test",facility_scope:{mode:"EXPLICIT" as const,facility_ids:["f1"]}};
  await issueClientPocInvitation(request,"command-1");await listClientPocInvitations();await revokeClientPocInvitation("i1");
  expect(String(fetch.mock.calls[0][0])).toContain("/api/v1/admin/account-registration-invitations/client-poc");expect(((fetch.mock.calls[0][1] as RequestInit).headers as Headers).get("Idempotency-Key")).toBe("command-1");
  expect(String(fetch.mock.calls[1][0])).toContain("/api/v1/admin/account-registration-invitations/client-poc");expect(String(fetch.mock.calls[2][0])).toContain("/api/v1/admin/account-registration-invitations/client-poc/i1/revoke");
});
