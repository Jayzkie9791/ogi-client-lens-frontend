import { afterEach, describe, expect, it, vi } from "vitest";
import { configureApiAuth } from "../api/client";
import { registerInspectionFinding } from "./inspectionFindingApi";

describe("F.2.2.2B Inspection Finding registration API", () => {
  afterEach(() => { configureApiAuth(null); vi.unstubAllGlobals(); });

  it("submits only the persisted row identity with an idempotency key", async () => {
    configureApiAuth({ getAccessToken:()=>"token",refreshAccessToken:async()=>null,onAuthFailure:()=>undefined });
    const fetchMock=vi.fn(async(_input:RequestInfo|URL,init?:RequestInit)=>new Response(JSON.stringify({id:"finding-id",business_identifier:"INSPECTION-FINDING-2026-000001"}),{status:201,headers:{"Content-Type":"application/json"}}));
    vi.stubGlobal("fetch",fetchMock);
    await registerInspectionFinding("record-id","10000000-0000-4000-8000-000000000001");
    const init=fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
    expect(JSON.parse(String(init?.body))).toEqual({source_row_key:"10000000-0000-4000-8000-000000000001"});
    expect(new Headers(init?.headers).get("Idempotency-Key")).toBe("f081:record-id:10000000-0000-4000-8000-000000000001");
  });
});
