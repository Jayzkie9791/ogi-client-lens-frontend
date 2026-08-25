import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { EvidenceAttestation } from "./attestationApi";
import { GovernedAttestationControl } from "./GovernedAttestationControl";
import { OetsField } from "./types";

const statement = "I certify that the information provided is true and accurate.";

const field: OetsField = {
  field_id: "00000000-0000-4000-8000-000000000001",
  field_code: "WITNESS_SIGNATURE",
  label: "Witness Signature",
  field_type: "SIGNATURE",
  required: true,
  readonly: false,
  visible: true,
  sequence: 1,
  metadata: {
    governed_attestation: {
      statement,
      purpose: "WITNESS",
      permitted_signer_modes: [
        "AUTHENTICATED_SELF_ATTESTATION",
        "RECORDED_EXTERNAL_ATTESTATION"
      ],
      source_role_label: "Witness",
      external_subject_role: "OPTIONAL"
    }
  }
};

const context = {
  evidenceRecordId: "record-1",
  payloadChecksum: "payload-checksum",
  templateVersionId: "template-version-1",
  templateChecksum: "template-checksum",
  actorDisplayName: "Authenticated Recorder"
};

describe("GovernedAttestationControl", () => {
  it("requires an explicit ceremony and submits only governed context assertions", async () => {
    const user = userEvent.setup();
    const onAttest = vi.fn().mockResolvedValue({});
    render(
      <GovernedAttestationControl
        attestations={[]}
        context={context}
        field={field}
        onAttest={onAttest}
        pending={false}
        readOnly={false}
        sectionInstanceIndex={null}
      />
    );

    expect(screen.getByText(statement)).toBeVisible();
    expect(screen.getByText(/Signing as/)).toHaveTextContent("Authenticated Recorder");
    const button = screen.getByRole("button", { name: "Sign & Attest" });
    expect(button).toBeDisabled();
    await user.click(screen.getByRole("checkbox"));
    await user.click(button);
    expect(onAttest).toHaveBeenCalledTimes(1);
    expect(onAttest.mock.calls[0][0]).toMatchObject({
      signature_field_id: field.field_id,
      confirmed: true,
      signer_mode: "AUTHENTICATED_SELF_ATTESTATION",
      expected_payload_checksum: context.payloadChecksum,
      expected_template_version_id: context.templateVersionId,
      expected_template_checksum: context.templateChecksum
    });
    expect(onAttest.mock.calls[0][0]).not.toHaveProperty("signer_user_id");
    expect(onAttest.mock.calls[0][0]).not.toHaveProperty("signed_at");
  });

  it("clearly separates external subject from authenticated recorder", async () => {
    const user = userEvent.setup();
    const onAttest = vi.fn().mockResolvedValue({});
    render(
      <GovernedAttestationControl
        attestations={[]}
        context={context}
        field={field}
        onAttest={onAttest}
        pending={false}
        readOnly={false}
        sectionInstanceIndex={null}
      />
    );
    await user.selectOptions(screen.getByLabelText("Signer mode"), "RECORDED_EXTERNAL_ATTESTATION");
    await user.type(screen.getByLabelText("External signer name"), "External Witness");
    expect(screen.getByText(/Recorded by/)).toHaveTextContent("Authenticated Recorder");
    expect(screen.getByText(/not represented as digitally authenticated/)).toBeVisible();
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "Sign & Attest" }));
    expect(onAttest.mock.calls[0][0]).toMatchObject({
      signer_mode: "RECORDED_EXTERNAL_ATTESTATION",
      external_subject_name: "External Witness"
    });
  });

  it("renders immutable current and stale snapshots in read-only mode", () => {
    render(
      <GovernedAttestationControl
        attestations={[snapshot("CURRENT"), snapshot("STALE")]}
        field={field}
        pending={false}
        readOnly
        sectionInstanceIndex={null}
      />
    );
    expect(screen.getByText("Current attestation")).toBeVisible();
    expect(screen.getByText("Stale historical attestation")).toBeVisible();
    expect(screen.getAllByText(/External Witness/)).toHaveLength(2);
    expect(screen.getAllByText(/Recorded by: Authenticated Recorder/)).toHaveLength(2);
    expect(screen.queryByRole("button", { name: "Sign & Attest" })).not.toBeInTheDocument();
  });

  it("keeps historical unconfigured signature fields non-editable without fabricating a signature value", () => {
    render(
      <GovernedAttestationControl
        attestations={[]}
        field={{ ...field, metadata: undefined }}
        pending={false}
        readOnly={false}
        sectionInstanceIndex={null}
      />
    );
    expect(screen.getByText(/metadata is not configured/)).toBeVisible();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("keeps the control unsigned after an API failure and permits a safe retry", async () => {
    const user = userEvent.setup();
    const onAttest = vi.fn().mockRejectedValueOnce(new Error("server rejected signing"));
    const { rerender } = render(
      <GovernedAttestationControl
        attestations={[]}
        context={context}
        field={field}
        onAttest={onAttest}
        pending={false}
        readOnly={false}
        sectionInstanceIndex={null}
      />
    );
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "Sign & Attest" }));
    expect(await screen.findByText("No governed attestation has been recorded.")).toBeVisible();

    rerender(
      <GovernedAttestationControl
        attestations={[]}
        context={context}
        errorMessage="The attestation request failed."
        field={field}
        onAttest={onAttest}
        pending={false}
        readOnly={false}
        sectionInstanceIndex={null}
      />
    );
    expect(screen.getByRole("alert")).toHaveTextContent("The attestation request failed.");
    expect(screen.getByRole("button", { name: "Sign & Attest" })).toBeEnabled();
  });

  it("renders only server-confirmed state and isolates repeatable section instances", () => {
    render(
      <>
        <GovernedAttestationControl
          attestations={[{ ...snapshot("CURRENT"), section_instance_index: 0 }]}
          context={context}
          field={field}
          pending={false}
          readOnly={false}
          sectionInstanceIndex={0}
        />
        <GovernedAttestationControl
          attestations={[{ ...snapshot("CURRENT"), section_instance_index: 0 }]}
          context={context}
          field={field}
          pending={false}
          readOnly={false}
          sectionInstanceIndex={1}
        />
      </>
    );
    expect(screen.getAllByText("Current attestation")).toHaveLength(1);
    expect(screen.getAllByText("No governed attestation has been recorded.")).toHaveLength(1);
  });
});

function snapshot(status: "CURRENT" | "STALE"): EvidenceAttestation {
  return {
    id: `${status.toLowerCase()}-attestation`, evidence_record_id: "record-1",
    template_version_id: "template-version-1", template_code_snapshot: "OGI_TEST",
    template_checksum: "template-checksum", payload_checksum: status === "CURRENT" ? "payload-checksum" : "old-checksum",
    signature_field_id: field.field_id, signature_field_code_snapshot: field.field_code,
    section_code_snapshot: "CERTIFICATION", section_instance_index: null,
    attestation_statement_snapshot: "I certify.", purpose: "WITNESS",
    signer_mode: "RECORDED_EXTERNAL_ATTESTATION", subject_name_snapshot: "External Witness",
    external_subject_role_snapshot: "Witness", actor_user_id: "actor-1",
    actor_display_name_snapshot: "Authenticated Recorder", signer_user_id: null,
    signer_display_name_snapshot: null, client_id_snapshot: "client-1", facility_id_snapshot: null,
    lifecycle_state_snapshot: "DRAFT", signed_at: "2026-08-24T00:00:00.000Z", correlation_id: null,
    created_at: "2026-08-24T00:00:00.000Z", status,
    assurance: "RECORDED_EXTERNAL_ATTESTATION"
  };
}
