import { afterEach, describe, expect, it, vi } from "vitest";

import {
  CanonicalAttestation,
  createCanonicalAttestation,
  listCanonicalAttestations
} from "./canonicalAttestationApi";

describe("CFAC-4S5 canonical attestation API boundary", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("accepts exact list/create contracts and sends the idempotency header", async () => {
    const value = attestation();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ attestations: [value] }))
      .mockResolvedValueOnce(jsonResponse({ attestation: value, replayed: false }, 201));
    vi.stubGlobal("fetch", fetchMock);

    await expect(listCanonicalAttestations("evidence-1")).resolves.toEqual({ attestations: [value] });
    await expect(createCanonicalAttestation("evidence-1", {
      role: "ASSESSOR",
      expected_payload_checksum: "b".repeat(64),
      expected_template_version_id: "template-version-1",
      expected_template_checksum: "a".repeat(64),
      confirmed: true
    }, "command-1")).resolves.toEqual({ attestation: value, replayed: false });

    expect((fetchMock.mock.calls[1]?.[1]?.headers as Headers).get("Idempotency-Key")).toBe("command-1");
  });

  it("rejects omitted authority fields and unexpected persistence internals", async () => {
    const missing = { ...attestation() } as Partial<CanonicalAttestation>;
    delete missing.payloadChecksum;
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(jsonResponse({ attestations: [missing] }))
      .mockResolvedValueOnce(jsonResponse({ attestation: { ...attestation(), authorityChecksum: "x" }, replayed: false })));

    await expect(listCanonicalAttestations("evidence-1")).rejects.toMatchObject({ code: "MALFORMED_RESPONSE" });
    await expect(createCanonicalAttestation("evidence-1", {
      role: "ASSESSOR",
      expected_payload_checksum: "b".repeat(64),
      expected_template_version_id: "template-version-1",
      expected_template_checksum: "a".repeat(64),
      confirmed: true
    }, "command-1")).rejects.toMatchObject({ code: "MALFORMED_RESPONSE" });
  });
});

function attestation(): CanonicalAttestation {
  return {
    id: "attestation-1",
    evidenceRecordId: "evidence-1",
    role: "ASSESSOR",
    templateVersionId: "template-version-1",
    templateCode: "OGI_F001_TEST",
    templateVersion: "1.0",
    templateChecksum: "a".repeat(64),
    payloadChecksum: "b".repeat(64),
    signer: { userId: "actor-1", personnelId: "personnel-1", name: "Assessor One", businessIdentifier: "OGI-001" },
    clientId: "client-1",
    facilityId: "facility-1",
    signedAt: "2026-10-04T01:00:00.000Z",
    createdAt: "2026-10-04T01:00:00.000Z",
    status: "CURRENT",
    separation:{mode:null,overrideReason:null,overridePermission:null,overrideRole:null,overrideConfirmed:false,overrideAuthorityChecksum:null}
  };
}

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: { "Content-Type": "application/json" } });
}
