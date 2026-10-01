import {afterEach,expect,it,vi} from "vitest";
import {issuePersonnelActivationInvitation,listPersonnelActivationInvitations,revokePersonnelActivationInvitation} from "./personnelAccountActivationApi";

afterEach(()=>vi.unstubAllGlobals());
const invitation={id:"i1",personnel_id:"p1",client_id:"c1",email:"guard@example.test",status:"ISSUED",issued_at:"2026-09-24T00:00:00Z",expires_at:"2026-09-25T00:00:00Z",consumed_at:null,revoked_at:null,superseded_by_invitation_id:null,issued_by_user_id:"u1",integrity_checksum:"a".repeat(64)};
it("uses exact Personnel-scoped status, issue idempotency, and revoke routes",async()=>{const fetchMock=vi.fn()
  .mockResolvedValueOnce(new Response(JSON.stringify({client_id:"c1",personnel_id:"p1",invitations:[invitation]}),{status:200,headers:{"Content-Type":"application/json"}}))
  .mockResolvedValueOnce(new Response(JSON.stringify({invitation,activation_token:"secret",idempotent_replay:false}),{status:201,headers:{"Content-Type":"application/json"}}))
  .mockResolvedValueOnce(new Response(JSON.stringify({invitation:{...invitation,status:"REVOKED",revoked_at:"2026-09-24T01:00:00Z"},unchanged:false}),{status:200,headers:{"Content-Type":"application/json"}}));vi.stubGlobal("fetch",fetchMock);
  await listPersonnelActivationInvitations("c1","p1");await issuePersonnelActivationInvitation("p1","key-1");await revokePersonnelActivationInvitation("i1");
  expect(String(fetchMock.mock.calls[0][0])).toContain("client_id=c1&personnel_id=p1");
  expect((fetchMock.mock.calls[1][1] as RequestInit).headers).toBeInstanceOf(Headers);
  expect(((fetchMock.mock.calls[1][1] as RequestInit).headers as Headers).get("Idempotency-Key")).toBe("key-1");
  expect(String(fetchMock.mock.calls[2][0])).toContain("/invitations/i1/revoke");
});
