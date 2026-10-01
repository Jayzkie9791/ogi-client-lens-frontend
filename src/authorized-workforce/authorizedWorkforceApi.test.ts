import { afterEach, describe, expect, it, vi } from "vitest";

import {
  getAuthorizedFacilityTeam,
  getAuthorizedPersonnel,
  getAuthorizedPersonnelCertificate,
  getAuthorizedPersonnelCredentials
} from "./authorizedWorkforceApi";

describe("Lead Lifeguard authorized workforce API", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("uses only the dedicated read-only Facility-team endpoints", async () => {
    const profile = {
      id: "staff-1",
      client_employee_number: "EMP-1",
      full_name: "Facility Lifeguard",
      first_name: null,
      middle_name: null,
      last_name: null,
      email: null,
      phone_number: null,
      employment_status: "ACTIVE",
      hire_date: null,
      client: { id: "client-1", organization_name: "Client" },
      facilities: []
    };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(json({ facility_id: "facility-1", personnel: [profile] }))
      .mockResolvedValueOnce(json(profile))
      .mockResolvedValueOnce(json({ personnel: profile, certifications: [] }))
      .mockResolvedValueOnce(new Response(new Blob(["pdf"]), { status: 200, headers: { "Content-Type": "application/pdf" } }));
    vi.stubGlobal("fetch", fetchMock);

    await getAuthorizedFacilityTeam("facility-1");
    await getAuthorizedPersonnel("staff-1");
    await getAuthorizedPersonnelCredentials("staff-1");
    await getAuthorizedPersonnelCertificate("issuance-1");

    expect(fetchMock.mock.calls.map(call => new URL(String(call[0]), "http://client-lens.test").pathname + new URL(String(call[0]), "http://client-lens.test").search)).toEqual([
      "/api/v1/authorized-workforce/personnel?facility_id=facility-1",
      "/api/v1/authorized-workforce/personnel/staff-1",
      "/api/v1/authorized-workforce/personnel/staff-1/credentials",
      "/api/v1/authorized-workforce/credential-issuances/issuance-1/certificate"
    ]);
  });
});

function json(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
}
