import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("Package G.2.0 frontend closure", () => {
  it("keeps signer identity and signing time server-owned", async () => {
    const [control, renderer] = await Promise.all([
      readFile("src/oets/GovernedAttestationControl.tsx", "utf8"),
      readFile("src/oets/OetsRenderer.tsx", "utf8")
    ]);

    expect(control).toContain("expected_payload_checksum: context.payloadChecksum");
    expect(control).toContain("expected_template_version_id: context.templateVersionId");
    expect(control).toContain("expected_template_checksum: context.templateChecksum");
    expect(control).not.toMatch(/signer_user_id\s*:/);
    expect(control).not.toMatch(/signed_at\s*:/);
    expect(renderer).toContain('item.status === "CURRENT"');
    expect(renderer).toContain("current.subject_name_snapshot");
    expect(renderer).toContain("current.signed_at.slice(0, 10)");
  });

  it("keeps external subjects, repeatable instances, dirty drafts, and deferred artifacts bounded", async () => {
    const [control, page] = await Promise.all([
      readFile("src/oets/GovernedAttestationControl.tsx", "utf8"),
      readFile("src/oets/OperationalEvidenceRecordPage.tsx", "utf8")
    ]);

    expect(control).toContain("The external subject is not represented as digitally authenticated.");
    expect(control).toContain("item.section_instance_index === sectionInstanceIndex");
    expect(control).toContain("Governed artifact deferred");
    expect(control).toContain("No self-attestation or recorded external attestation is permitted.");
    expect(page).toContain("canAttestDraft && !draftDirty && !draftPayloadMutation.isPending");
    expect(page).toContain("return error.message");
  });

  it("freezes the G.2.0 relationship rejection and safe-retry journey", async () => {
    const tests = await readFile("src/oets/OetsRenderer.test.tsx", "utf8");
    expect(tests).toContain("G.2.0 keeps relationship-rejected signing unprojected and safely retries the same command");
    expect(tests).toContain("OEE_ATTESTATION_RELATIONSHIP_NOT_ELIGIBLE");
    expect(tests).toContain("commands[1].idempotency_key");
    expect(tests).toContain("Relationship Signer Name");
    expect(tests).toContain("Relationship Signed Date");
  });
});
