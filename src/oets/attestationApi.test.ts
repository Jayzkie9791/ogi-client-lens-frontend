import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createEvidenceAttestation,
  EvidenceAttestation,
  listEvidenceAttestations
} from "./attestationApi";

describe("governed attestation API response guard", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("accepts complete self and external responses with required nullable role snapshots", async () => {
    const self = attestation({ external_subject_role_snapshot: null });
    const external = attestation({
      id: "attestation-external",
      signer_mode: "RECORDED_EXTERNAL_ATTESTATION",
      assurance: "RECORDED_EXTERNAL_ATTESTATION",
      subject_name_snapshot: "Receiving Provider",
      external_subject_role_snapshot: "Receiving Provider",
      signer_user_id: null,
      signer_display_name_snapshot: null
    });
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(jsonResponse({ attestations: [self, external] }))
      .mockResolvedValueOnce(jsonResponse(external, 201)));

    await expect(listEvidenceAttestations("evidence-1")).resolves.toEqual({
      attestations: [self, external]
    });
    await expect(createEvidenceAttestation("evidence-1", request())).resolves.toEqual(external);
  });

  it("rejects an omitted external_subject_role_snapshot instead of treating nullable as optional", async () => {
    const malformed: Partial<EvidenceAttestation> = { ...attestation() };
    delete malformed.external_subject_role_snapshot;
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(malformed)));

    await expectMalformed(createEvidenceAttestation("evidence-1", request()));
  });

  it.each([42, {}, []])("rejects invalid external role snapshot type %j", async (invalid) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(
      attestation({ external_subject_role_snapshot: invalid as never })
    )));

    await expectMalformed(createEvidenceAttestation("evidence-1", request()));
  });

  it("rejects incomplete responses and unexpected internal persistence fields", async () => {
    const incomplete = { ...attestation(), template_code_snapshot: undefined };
    const internal = {
      ...attestation(),
      idempotency_key: "internal-key",
      command_checksum: "a".repeat(64)
    };
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(jsonResponse(incomplete))
      .mockResolvedValueOnce(jsonResponse(internal)));

    await expectMalformed(createEvidenceAttestation("evidence-1", request()));
    await expectMalformed(createEvidenceAttestation("evidence-1", request()));
  });
});

function attestation(overrides: Partial<EvidenceAttestation> = {}): EvidenceAttestation {
  return {
    id: "attestation-self",
    evidence_record_id: "evidence-1",
    template_version_id: "template-version-1",
    template_code_snapshot: "OGI_TEST_ATTESTATION",
    template_checksum: "a".repeat(64),
    payload_checksum: "b".repeat(64),
    signature_field_id: "signature-field-1",
    signature_field_code_snapshot: "SIGNATURE",
    section_code_snapshot: "ATTESTATION",
    section_instance_index: null,
    attestation_statement_snapshot: "I attest to this exact evidence.",
    purpose: "ACKNOWLEDGEMENT",
    signer_mode: "AUTHENTICATED_SELF_ATTESTATION",
    subject_name_snapshot: "Authenticated Operator",
    external_subject_role_snapshot: null,
    actor_user_id: "actor-1",
    actor_display_name_snapshot: "Authenticated Operator",
    signer_user_id: "actor-1",
    signer_display_name_snapshot: "Authenticated Operator",
    client_id_snapshot: "client-1",
    facility_id_snapshot: null,
    lifecycle_state_snapshot: "DRAFT",
    signed_at: "2026-08-24T10:00:00.000Z",
    correlation_id: null,
    created_at: "2026-08-24T10:00:00.000Z",
    status: "CURRENT",
    assurance: "AUTHENTICATED_SELF_ATTESTATION",
    ...overrides
  };
}

function request() {
  return {
    expected_payload_checksum: "b".repeat(64),
    expected_template_version_id: "template-version-1",
    expected_template_checksum: "a".repeat(64),
    signature_field_id: "signature-field-1",
    confirmed: true as const,
    signer_mode: "AUTHENTICATED_SELF_ATTESTATION" as const,
    idempotency_key: "idempotency-1"
  };
}

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

async function expectMalformed(promise: Promise<unknown>) {
  await expect(promise).rejects.toMatchObject({
    code: "MALFORMED_RESPONSE"
  });
}
