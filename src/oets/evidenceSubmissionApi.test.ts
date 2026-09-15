import { afterEach, describe, expect, it, vi } from "vitest";

import { getOperationalEvidenceRecord } from "./evidenceSubmissionApi";

describe("Operational Evidence existing-context response guard", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("accepts an immutable A.0.2 context envelope", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json(record({
      requirement_code: "CERTIFICATION_CONTEXT",
      context_kind: "CERTIFICATION",
      selected_id: "certification-1",
      summary: { id: "certification-1", primary_label: "OGI-CERT-2026-0001", secondary_label: "Sky Guard", context_kind: "CERTIFICATION", holder_kind: "TRAINEE" },
      field_policy: { CERTIFICATION_NUMBER: "READ_ONLY_DERIVED" },
      authoritative_values: { CERTIFICATION_NUMBER: "OGI-CERT-2026-0001", ACTIVE: true, TAGS: ["CURRENT"], OPTIONAL: null },
      snapshot_provenance: "EVIDENCE_BINDING_AND_PAYLOAD"
    }))));

    await expect(getOperationalEvidenceRecord("record-1")).resolves.toMatchObject({ context: { selected_id: "certification-1" } });
  });

  it("rejects malformed context instead of silently treating a contextual record as uncontextual", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json(record({
      requirement_code: "CERTIFICATION_CONTEXT",
      context_kind: "CERTIFICATION",
      selected_id: "certification-1",
      summary: { id: "certification-1", primary_label: "Certification", secondary_label: "Holder", context_kind: "CERTIFICATION" },
      field_policy: { CERTIFICATION_NUMBER: "CALLER_OVERRIDE" },
      authoritative_values: {},
      snapshot_provenance: "CURRENT_DOMAIN_ROW"
    }))));

    await expect(getOperationalEvidenceRecord("record-1")).rejects.toMatchObject({ code: "MALFORMED_RESPONSE" });
  });
});

function record(context: unknown) {
  return {
    id: "record-1",
    template_provenance: { template_version_id: "version-1", checksum: "checksum-1" },
    client_id: "client-1",
    facility_id: "facility-1",
    lifecycle_state: "DRAFT",
    payload: { sections: {} },
    payload_checksum: "payload-checksum",
    created_by_user_id: "user-1",
    submitted_by_user_id: "user-1",
    created_at: "2026-09-15T00:00:00.000Z",
    submitted_at: "2026-09-15T00:00:00.000Z",
    updated_at: "2026-09-15T00:00:00.000Z",
    scope_kind: "CLIENT_SCOPED",
    training_context: null,
    context
  };
}

function json(value: unknown) {
  return new Response(JSON.stringify(value), { status: 200, headers: { "Content-Type": "application/json" } });
}
