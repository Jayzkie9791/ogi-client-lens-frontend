import {afterEach,expect,it,vi} from "vitest";
import {issuePersonnelRegistrationInvitation} from "./personnelRegistrationInvitationApi";

afterEach(()=>vi.unstubAllGlobals());
it("sends the exact invite-first request and idempotency key",async()=>{const fetch=vi.fn().mockResolvedValue(new Response(JSON.stringify({invitation:{id:"i",client_id:"c",facility_id:"f",full_name:"Guard",email:"guard@example.test",assigned_from:"2026-10-01",role_name:"CLIENT_LIFEGUARD",duty_code:"OPERATIONAL_LIFEGUARD",position_title:"Lifeguard",status:"ISSUED",issued_by_user_id:"u",issued_at:"2026-09-24T00:00:00Z",expires_at:"2026-09-25T00:00:00Z",consumed_at:null,revoked_at:null,superseded_by_invitation_id:null,integrity_checksum:"a".repeat(64)},activation_token:"secret",idempotent_replay:false}),{status:201,headers:{"content-type":"application/json"}}));vi.stubGlobal("fetch",fetch);
  await issuePersonnelRegistrationInvitation({client_id:"c",facility_id:"f",full_name:"Guard",email:"guard@example.test",assigned_from:"2026-10-01"},"key-1");
  const [,options]=fetch.mock.calls[0];expect(options.method).toBe("POST");expect(new Headers(options.headers).get("Idempotency-Key")).toBe("key-1");expect(JSON.parse(options.body)).toEqual({client_id:"c",facility_id:"f",full_name:"Guard",email:"guard@example.test",assigned_from:"2026-10-01"});
});
