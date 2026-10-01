import { afterEach, expect, it, vi } from "vitest";
import { activatePersonnelAccount,activatePersonnelRegistration } from "./authApi";

afterEach(()=>vi.unstubAllGlobals());

it("submits Personnel activation anonymously with the exact contract",async()=>{
  const fetchMock=vi.fn().mockResolvedValue(new Response(JSON.stringify({activated:true}),{status:200,headers:{"Content-Type":"application/json"}}));
  vi.stubGlobal("fetch",fetchMock);
  const request={token:"a".repeat(43),client_employee_number:"EMP-1",new_password:"password1",confirm_password:"password1"};
  await expect(activatePersonnelAccount(request)).resolves.toEqual({activated:true});
  const[url,init]=fetchMock.mock.calls[0] as[string,RequestInit];
  expect(new URL(url,window.location.origin).pathname).toBe("/api/v1/auth/personnel-account-activation/confirm");
  expect(init.method).toBe("POST");expect((init.headers as Headers).get("Authorization")).toBeNull();
  expect(JSON.parse(String(init.body))).toEqual(request);
  expect(localStorage.length).toBe(0);expect(sessionStorage.length).toBe(0);
});

it("submits invite-first Personnel registration anonymously to its separate endpoint",async()=>{
  const fetchMock=vi.fn().mockResolvedValue(new Response(JSON.stringify({activated:true}),{status:200,headers:{"Content-Type":"application/json"}}));
  vi.stubGlobal("fetch",fetchMock);
  const request={token:"a".repeat(43),client_employee_number:"EMP-2",new_password:"password1",confirm_password:"password1"};
  await expect(activatePersonnelRegistration(request)).resolves.toEqual({activated:true});
  const[url,init]=fetchMock.mock.calls[0] as[string,RequestInit];
  expect(new URL(url,window.location.origin).pathname).toBe("/api/v1/auth/personnel-registration-activation/confirm");
  expect((init.headers as Headers).get("Authorization")).toBeNull();
});

it("fails closed on a malformed activation success",async()=>{
  vi.stubGlobal("fetch",vi.fn().mockResolvedValue(new Response(JSON.stringify({token:"leaked"}),{status:200,headers:{"Content-Type":"application/json"}})));
  await expect(activatePersonnelAccount({token:"a".repeat(43),client_employee_number:"EMP-1",new_password:"password1",confirm_password:"password1"}))
    .rejects.toMatchObject({code:"MALFORMED_RESPONSE"});
});
