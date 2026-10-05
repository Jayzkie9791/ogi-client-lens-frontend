import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("CFAC-4S7 persisted Draft entry", () => {
  it("uses the Draft endpoint for every human-authored runtime template", async () => {
    const source = await readFile("src/oets/RuntimeTemplatePage.tsx", "utf8");
    expect(source).toContain("const requiresPersistedDraft = true");
    expect(source).toContain("draftMutation.mutate");
    expect(source).not.toContain("mutationFn: createOperationalEvidenceRecord");
  });

  it("projects FINALIZE_DRAFT only when the readable canonical gate is ready", async () => {
    const source = await readFile("src/oets/OperationalEvidenceRecordPage.tsx", "utf8");
    expect(source).toContain("canonicalFinalizationReady");
    expect(source).toContain('transition.trigger !== "FINALIZE_DRAFT"');
    expect(source).toContain("!canonicalReadinessKnown || canonicalFinalizationReady");
  });
});
