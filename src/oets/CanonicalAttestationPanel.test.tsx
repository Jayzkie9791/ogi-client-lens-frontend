import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CanonicalAttestationPanel } from "./CanonicalAttestationPanel";
import {
  CanonicalAttestation,
  canonicalIdempotencyKey,
  createCanonicalAttestation,
  listCanonicalAttestations
} from "./canonicalAttestationApi";
import { OperationalEvidenceRecord } from "./evidenceSubmissionApi";

vi.mock("./canonicalAttestationApi", async (importOriginal) => {
  const original = await importOriginal<typeof import("./canonicalAttestationApi")>();
  return {
    ...original,
    createCanonicalAttestation: vi.fn(),
    listCanonicalAttestations: vi.fn()
  };
});

describe("CFAC-4S5 canonical two-attestor workflow", () => {
  afterEach(() => vi.clearAllMocks());

  it("offers Assessor first and explains why Reviewer is blocked", async () => {
    vi.mocked(listCanonicalAttestations).mockResolvedValue({ attestations: [] });
    renderPanel();

    expect(await screen.findByRole("button", { name: "Attest as Assessor" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Attest as Reviewer" })).not.toBeInTheDocument();
    expect(screen.getByText("A current Assessor attestation is required first.")).toBeInTheDocument();
    expect(screen.getByText(/not converted into Assessor or Reviewer authority/)).toBeInTheDocument();
  });

  it("records explicit Assessor confirmation against exact saved authority", async () => {
    vi.mocked(listCanonicalAttestations).mockResolvedValue({ attestations: [] });
    vi.mocked(createCanonicalAttestation).mockResolvedValue({ attestation: attestation(), replayed: false });
    renderPanel();

    const confirmation = await screen.findByLabelText("I confirm this role for the exact saved evidence payload shown here.");
    fireEvent.click(confirmation);
    fireEvent.click(screen.getByRole("button", { name: "Attest as Assessor" }));

    await waitFor(() => expect(createCanonicalAttestation).toHaveBeenCalledWith(
      "evidence-1",
      {
        role: "ASSESSOR",
        expected_payload_checksum: "b".repeat(64),
        expected_template_version_id: "template-version-1",
        expected_template_checksum: "a".repeat(64),
        confirmed: true
      },
      `cfac4s5:evidence-1:${"b".repeat(64)}:ASSESSOR`
    ));
  });

  it("keeps exact-payload idempotency keys within the backend header limit", () => {
    const key = canonicalIdempotencyKey(
      "21395a0a-c89d-45f5-81b8-b13e28c0eb6a",
      "b".repeat(64),
      "REVIEWER"
    );

    expect(key).toBe(`cfac4s5:21395a0a-c89d-45f5-81b8-b13e28c0eb6a:${"b".repeat(64)}:REVIEWER`);
    expect(key.length).toBeLessThanOrEqual(150);
  });

  it("enforces separation of duty and displays stale history without reinterpretation", async () => {
    vi.mocked(listCanonicalAttestations).mockResolvedValue({
      attestations: [
        attestation(),
        attestation({ id: "old-assessor", payloadChecksum: "c".repeat(64), status: "STALE", signedAt: "2026-09-30T10:00:00.000Z" })
      ]
    });
    renderPanel();

    expect(await screen.findByText("Separation of duty requires a different eligible Reviewer.")).toBeInTheDocument();
    fireEvent.click(screen.getByText("History (2)"));
    expect(screen.getByText("Historical · payload changed")).toBeInTheDocument();
  });

  it("offers a deliberate reasoned override only to an authorized same-person founder",async()=>{
    vi.mocked(listCanonicalAttestations).mockResolvedValue({attestations:[attestation()]});
    vi.mocked(createCanonicalAttestation).mockResolvedValue({attestation:attestation({id:"override-1",role:"REVIEWER",separation:overrideSeparation()}),replayed:false});
    renderPanel({canOverrideSeparation:true});

    expect(await screen.findByText("Founding executive override")).toBeInTheDocument();
    expect(screen.queryByRole("button",{name:"Attest as Reviewer with Override"})).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Use founding executive separation override"));
    fireEvent.change(screen.getByLabelText("Operational reason"),{target:{value:"Founding executive coverage is required for this assessment."}});
    fireEvent.click(screen.getByLabelText(/I explicitly confirm that I am acting as both Assessor and Reviewer/));
    fireEvent.click(screen.getByRole("button",{name:"Attest as Reviewer with Override"}));

    await waitFor(()=>expect(createCanonicalAttestation).toHaveBeenCalledWith("evidence-1",expect.objectContaining({
      role:"REVIEWER",separation_override:true,separation_override_reason:"Founding executive coverage is required for this assessment.",separation_override_confirmed:true
    }),expect.stringContaining(":REVIEWER:OVERRIDE")));
  });

  it("permanently identifies a same-person override and its reason",async()=>{
    vi.mocked(listCanonicalAttestations).mockResolvedValue({attestations:[attestation(),attestation({id:"override-1",role:"REVIEWER",separation:overrideSeparation()})]});
    renderPanel({canOverrideSeparation:true});
    expect((await screen.findAllByText(/Founding Executive Override · same-person assessment and review/)).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Reason: Founding executive coverage was required for this assessment.").length).toBeGreaterThan(0);
  });

  it("blocks both actions while the Draft has unsaved changes", async () => {
    vi.mocked(listCanonicalAttestations).mockResolvedValue({ attestations: [] });
    renderPanel({ draftDirty: true });

    expect(await screen.findByText("Save the Draft before attesting to its exact payload.")).toBeInTheDocument();
    expect(screen.getByText("Save the Draft before reviewing its exact payload.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Attest as/ })).not.toBeInTheDocument();
  });
});

function renderPanel(overrides: Partial<React.ComponentProps<typeof CanonicalAttestationPanel>> = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <CanonicalAttestationPanel
        canAttest
        canOverrideSeparation={false}
        canReview
        currentUserId="actor-1"
        draftDirty={false}
        draftSavePending={false}
        record={record()}
        {...overrides}
      />
    </QueryClientProvider>
  );
}

function record(): OperationalEvidenceRecord {
  return {
    id: "evidence-1",
    template_provenance: {
      template_id: "template-1",
      template_code: "OGI_F001_TEST",
      template_version: "1.0",
      template_registry_id: "registry-1",
      template_version_id: "template-version-1",
      schema_version: "1.0",
      checksum: "a".repeat(64)
    },
    client_id: "client-1",
    facility_id: "facility-1",
    lifecycle_state: "DRAFT",
    payload: { sections: {} },
    payload_checksum: "b".repeat(64),
    created_by_user_id: "actor-1",
    submitted_by_user_id: "",
    created_at: "2026-10-04T00:00:00.000Z",
    submitted_at: "",
    updated_at: "2026-10-04T00:00:00.000Z"
  };
}

function attestation(overrides: Partial<CanonicalAttestation> = {}): CanonicalAttestation {
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
    separation:{mode:null,overrideReason:null,overridePermission:null,overrideRole:null,overrideConfirmed:false,overrideAuthorityChecksum:null},
    ...overrides
  };
}

function overrideSeparation():CanonicalAttestation["separation"]{return {mode:"FOUNDING_EXECUTIVE_OVERRIDE",overrideReason:"Founding executive coverage was required for this assessment.",overridePermission:"override_operational_assessment_separation",overrideRole:"FOUNDING_EXECUTIVE_ASSESSMENT_OVERRIDE",overrideConfirmed:true,overrideAuthorityChecksum:"d".repeat(64)};}
