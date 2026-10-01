import { afterEach, describe, expect, it, vi } from "vitest";

import { getMyCertificate, getMyCredentials, getMyProfile } from "./selfServiceApi";

describe("Lifeguard self-service API", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("uses identifier-free self profile and credential endpoints", async () => {
    const profile = { id: "staff-1", client_employee_number: null, full_name: "Life Guard", first_name: null, middle_name: null, last_name: null, email: null, phone_number: null, employment_status: "ACTIVE", hire_date: null, client: { id: "client-1", organization_name: "Client" }, facilities: [] };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(profile), { status: 200, headers: { "Content-Type": "application/json" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ personnel: profile, certifications: [] }), { status: 200, headers: { "Content-Type": "application/json" } }))
      .mockResolvedValueOnce(new Response(new Blob(["pdf"]), { status: 200, headers: { "Content-Type": "application/pdf" } }));
    vi.stubGlobal("fetch", fetchMock);

    await getMyProfile();
    await getMyCredentials();
    await getMyCertificate("issuance-1");

    expect(fetchMock.mock.calls.map(call => new URL(String(call[0]), "http://client-lens.test").pathname)).toEqual([
      "/api/v1/self/personnel",
      "/api/v1/self/credentials",
      "/api/v1/self/credential-issuances/issuance-1/certificate"
    ]);
  });
});
