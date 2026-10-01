import { afterEach, describe, expect, it, vi } from "vitest";

import { getOetsContextCandidates, getOetsContextRequirement, resolveOetsContext, resolveOetsExistingContextRecord } from "./contextApi";

const authority = { templateCode: "OGI_F048_DIGITAL_CREDENTIAL_ISSUANCE_FORM", templateVersionId: "3462dcff-6892-4bf1-b6e1-0b52363c39da", checksum: "a".repeat(64) };

describe("OETS context API authority guards", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("accepts the recurring-subject active-draft duplicate policy", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json({ required: true, requirement_code: "ASSET_CONTEXT", selection_mode: "EXPLICIT", presentation: { label: "Asset context", help_text: "Select one.", candidate_singular: "Asset", candidate_plural: "Assets" }, duplicate_policy: "ONE_ACTIVE_DRAFT_PER_SUBJECT", successor_policy: "CLONE_IMMUTABLE_CONTEXT" })));
    await expect(getOetsContextRequirement({ ...authority, templateCode: "OGI_F081_EQUIPMENT_INSPECTION_REPORT" })).resolves.toMatchObject({ duplicate_policy: "ONE_ACTIVE_DRAFT_PER_SUBJECT" });
  });

  it("accepts the one-lineage Audit Appointment duplicate policy", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json({
      required: true,
      requirement_code: "AUDIT_APPOINTMENT_CONTEXT",
      selection_mode: "EXPLICIT",
      presentation: {
        label: "Audit Appointment context",
        help_text: "Select the exact active Audit Appointment that governs this audit effort.",
        candidate_singular: "Audit Appointment",
        candidate_plural: "Audit Appointments"
      },
      duplicate_policy: "ONE_EVIDENCE_LINEAGE_PER_SUBJECT",
      successor_policy: "CLONE_IMMUTABLE_CONTEXT"
    })));

    await expect(getOetsContextRequirement({
      ...authority,
      templateCode: "OGI_F003_ARMAS_OPERATIONAL_AUDIT_INSTRUMENT"
    })).resolves.toMatchObject({
      requirement_code: "AUDIT_APPOINTMENT_CONTEXT",
      duplicate_policy: "ONE_EVIDENCE_LINEAGE_PER_SUBJECT"
    });
  });

  it("loads a required explicit-selection contract and preserves zero/one/many without choosing", async () => {
    const candidate = { id: "certification-1", primary_label: "OGI-CERT-2026-0001", secondary_label: "Aurelia Guard · OGI_L1_POOL_LIFEGUARD", context_kind: "CERTIFICATION", holder_kind: "TRAINEE" };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(json({ required: true, requirement_code: "CERTIFICATION_CONTEXT", selection_mode: "EXPLICIT", presentation: { label: "Certification context", help_text: "Select one.", candidate_singular: "Certification", candidate_plural: "Certifications" }, duplicate_policy: "IDEMPOTENCY_ONLY", successor_policy: "CLONE_IMMUTABLE_CONTEXT" }))
      .mockResolvedValueOnce(json({ candidates: [candidate], count: 1, next_cursor: null, selection_mode: "EXPLICIT" }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(getOetsContextRequirement(authority)).resolves.toMatchObject({ required: true, selection_mode: "EXPLICIT" });
    await expect(getOetsContextCandidates({ ...authority, clientId: "client-1", facilityId: "facility-1" })).resolves.toEqual({ candidates: [candidate], count: 1, next_cursor: null, selection_mode: "EXPLICIT" });
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

  it("rejects abbreviated required and non-contextual requirement contracts", async () => {
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(json({ required: true, requirement_code: "CERTIFICATION_CONTEXT", selection_mode: "EXPLICIT" }))
      .mockResolvedValueOnce(json({ required: false, requirement_code: null, selection_mode: null })));

    await expect(getOetsContextRequirement(authority)).rejects.toMatchObject({ code: "MALFORMED_RESPONSE" });
    await expect(getOetsContextRequirement(authority)).rejects.toMatchObject({ code: "MALFORMED_RESPONSE" });
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

  it("transports bounded search and opaque cursor parameters without selecting a candidate", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(json({ candidates: [], count: 0, next_cursor: null, selection_mode: "EXPLICIT" }));
    vi.stubGlobal("fetch", fetchMock);
    await getOetsContextCandidates({ ...authority, clientId: "client-1", candidateQuery: "Sky", limit: 25, cursor: "opaque-cursor" });
    const request = fetchMock.mock.calls[0];
    if (!request) throw new Error("Candidate discovery request was not issued.");
    const url = new URL(String(request[0]), window.location.origin);
    expect(url.searchParams.get("q")).toBe("Sky");
    expect(url.searchParams.get("limit")).toBe("25");
    expect(url.searchParams.get("cursor")).toBe("opaque-cursor");
  });

  it("accepts supported OETS authority values and rejects malformed policy or values", async () => {
    const summary = { id: "certification-1", primary_label: "OGI-CERT-2026-0001", secondary_label: "Aurelia Guard · OGI_L1_POOL_LIFEGUARD", context_kind: "CERTIFICATION", holder_kind: "TRAINEE" };
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(json({ requirement_code: "CERTIFICATION_CONTEXT", selected_id: "certification-1", summary, field_policy: { CERTIFICATION_NUMBER: "READ_ONLY_DERIVED", CURRENT_CRI_SCORE_100: "READ_ONLY_DERIVED" }, authoritative_values: { CERTIFICATION_NUMBER: "OGI-CERT-2026-0001", CURRENT_CRI_SCORE_100: 87.5, ACTIVE: true, TAGS: ["A", "B"], OPTIONAL: null }, required_fields: [] }))
      .mockResolvedValueOnce(json({ requirement_code: "CERTIFICATION_CONTEXT", selected_id: "certification-1", summary, field_policy: { CERTIFICATION_NUMBER: "CALLER_OVERRIDE" }, authoritative_values: {}, required_fields: [] }))
      .mockResolvedValueOnce(json({ requirement_code: "CERTIFICATION_CONTEXT", selected_id: "certification-1", summary, field_policy: { CERTIFICATION_NUMBER: "READ_ONLY_DERIVED" }, authoritative_values: { CERTIFICATION_NUMBER: { invalid: true } }, required_fields: [] })));

    await expect(resolveOetsContext({ ...authority, clientId: "client-1", selectedId: "certification-1" })).resolves.toMatchObject({ selected_id: "certification-1", authoritative_values: { CURRENT_CRI_SCORE_100: 87.5 } });
    await expect(resolveOetsContext({ ...authority, clientId: "client-1", selectedId: "certification-1" })).rejects.toMatchObject({ code: "MALFORMED_RESPONSE" });
    await expect(resolveOetsContext({ ...authority, clientId: "client-1", selectedId: "certification-1" })).rejects.toMatchObject({ code: "MALFORMED_RESPONSE" });
  });

  it("accepts bounded fixed repeatable groups and rejects cardinality drift", async () => {
    const summary = { id: "session-1", primary_label: "Session 1", secondary_label: "Training", context_kind: "TRAINING_SESSION" };
    const base = { requirement_code: "TRAINING_SESSION_CONTEXT", selected_id: "session-1", summary, field_policy: {}, authoritative_values: {}, required_fields: [] };
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(json({ ...base, repeatable_groups: [{ group_code: "ROSTER", cardinality: "FIXED", instance_count: 2, max_instances: 100, sections: [{ section_code: "PARTICIPANTS", instances: [{ NAME: "Alpha" }, { NAME: "Bravo" }] }, { section_code: "ATTENDANCE", instances: [{}, {}] }] }] }))
      .mockResolvedValueOnce(json({ ...base, repeatable_groups: [{ group_code: "ROSTER", cardinality: "FIXED", instance_count: 2, max_instances: 100, sections: [{ section_code: "PARTICIPANTS", instances: [{ NAME: "Alpha" }] }] }] })));
    await expect(resolveOetsContext({ ...authority, clientId: "client-1", selectedId: "session-1" })).resolves.toMatchObject({ repeatable_groups: [{ instance_count: 2 }] });
    await expect(resolveOetsContext({ ...authority, clientId: "client-1", selectedId: "session-1" })).rejects.toMatchObject({ code: "MALFORMED_RESPONSE" });
  });

  it("posts exact contextual preflight authority and accepts an accessible historical Draft", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(json({
      resolution: "EXISTING_RECORD",
      duplicate_policy: "ONE_LIVE_RECORD_PER_SUBJECT",
      record: {
        evidence_record_id: "record-1",
        lifecycle_state: "DRAFT",
        template_version: "3.3",
        version_relation: "HISTORICAL_VERSION",
        access_action: "CONTINUE_DRAFT"
      }
    }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(resolveOetsExistingContextRecord({
      ...authority,
      templateCode: "OGI_F093_INDIVIDUAL_TRAINING_RECORD",
      clientId: "client-1",
      facilityId: "facility-1",
      requirementCode: "PERSONNEL_CONTEXT",
      selectedId: "staff-1"
    })).resolves.toMatchObject({ resolution: "EXISTING_RECORD", record: { template_version: "3.3" } });

    const request = fetchMock.mock.calls[0];
    expect(String(request?.[0])).toContain("/context-record-resolution");
    expect(request?.[1]).toMatchObject({ method: "POST" });
    expect(JSON.parse(String(request?.[1]?.body))).toEqual({
      template_version_id: authority.templateVersionId,
      checksum: authority.checksum,
      client_id: "client-1",
      facility_id: "facility-1",
      context: { requirement_code: "PERSONNEL_CONTEXT", selected_id: "staff-1" }
    });
  });
});

function json(value: unknown) {
  const enriched = value && typeof value === "object" && !Array.isArray(value) && "selected_id" in value
    ? { ...value, field_authority: { projection_version: "OETS_FIELD_AUTHORITY_PRESENTATION_V1", template_code: authority.templateCode, template_version: "1.0", template_version_id: authority.templateVersionId, fields: [], projection_checksum: "a".repeat(64) } }
    : value;
  return new Response(JSON.stringify(enriched), { status: 200, headers: { "Content-Type": "application/json" } });
}
