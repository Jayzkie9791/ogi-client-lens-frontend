import { afterEach, describe, expect, it, vi } from "vitest";

import { getOetsContextCandidates, getOetsContextRequirement, resolveOetsContext } from "./contextApi";

const authority = { templateCode: "OGI_F048_DIGITAL_CREDENTIAL_ISSUANCE_FORM", templateVersionId: "3462dcff-6892-4bf1-b6e1-0b52363c39da", checksum: "a".repeat(64) };

describe("OETS context API authority guards", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("loads a required explicit-selection contract and preserves zero/one/many without choosing", async () => {
    const candidate = { id: "certification-1", primary_label: "OGI-CERT-2026-0001", secondary_label: "Aurelia Guard · OGI_L1_POOL_LIFEGUARD", holder_kind: "TRAINEE" };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(json({ required: true, requirement_code: "CERTIFICATION_CONTEXT", selection_mode: "EXPLICIT" }))
      .mockResolvedValueOnce(json({ candidates: [candidate], count: 1, selection_mode: "EXPLICIT" }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(getOetsContextRequirement(authority)).resolves.toMatchObject({ required: true, selection_mode: "EXPLICIT" });
    await expect(getOetsContextCandidates({ ...authority, clientId: "client-1", facilityId: "facility-1" })).resolves.toEqual({ candidates: [candidate], count: 1, selection_mode: "EXPLICIT" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const candidateRequest = fetchMock.mock.calls[1];
    if (!candidateRequest) throw new Error("Candidate discovery request was not issued.");
    const candidateUrl = new URL(String(candidateRequest[0]), window.location.origin);
    expect(candidateUrl.pathname).toBe(
      `/api/v1/operational-evidence/templates/${authority.templateCode}/context-candidates`
    );
    expect([...candidateUrl.searchParams.entries()]).toEqual([
      ["template_version_id", authority.templateVersionId],
      ["checksum", authority.checksum],
      ["client_id", "client-1"],
      ["facility_id", "facility-1"]
    ]);
  });

  it("rejects a malformed candidate projection instead of silently rendering an empty selector", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(json({
      candidates: [{ candidate_id: "certification-1", display_label: "Stale candidate shape" }],
      count: 1,
      selection_mode: "EXPLICIT"
    })));

    await expect(
      getOetsContextCandidates({ ...authority, clientId: "client-1" })
    ).rejects.toMatchObject({ code: "MALFORMED_RESPONSE" });
  });

  it("accepts exact textual and numeric authority and rejects malformed policy or values", async () => {
    const summary = { id: "certification-1", primary_label: "OGI-CERT-2026-0001", secondary_label: "Aurelia Guard · OGI_L1_POOL_LIFEGUARD", holder_kind: "TRAINEE" };
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(json({ requirement_code: "CERTIFICATION_CONTEXT", selected_id: "certification-1", summary, field_policy: { CERTIFICATION_NUMBER: "READ_ONLY_DERIVED", CURRENT_CRI_SCORE_100: "READ_ONLY_DERIVED" }, authoritative_values: { CERTIFICATION_NUMBER: "OGI-CERT-2026-0001", CURRENT_CRI_SCORE_100: 87.5 } }))
      .mockResolvedValueOnce(json({ requirement_code: "CERTIFICATION_CONTEXT", selected_id: "certification-1", summary, field_policy: { CERTIFICATION_NUMBER: "CALLER_OVERRIDE" }, authoritative_values: {} }))
      .mockResolvedValueOnce(json({ requirement_code: "CERTIFICATION_CONTEXT", selected_id: "certification-1", summary, field_policy: { CERTIFICATION_NUMBER: "READ_ONLY_DERIVED" }, authoritative_values: { CERTIFICATION_NUMBER: true } })));

    await expect(resolveOetsContext({ ...authority, clientId: "client-1", selectedId: "certification-1" })).resolves.toMatchObject({ selected_id: "certification-1", authoritative_values: { CURRENT_CRI_SCORE_100: 87.5 } });
    await expect(resolveOetsContext({ ...authority, clientId: "client-1", selectedId: "certification-1" })).rejects.toMatchObject({ code: "MALFORMED_RESPONSE" });
    await expect(resolveOetsContext({ ...authority, clientId: "client-1", selectedId: "certification-1" })).rejects.toMatchObject({ code: "MALFORMED_RESPONSE" });
  });
});

function json(value: unknown) { return new Response(JSON.stringify(value), { status: 200, headers: { "Content-Type": "application/json" } }); }
