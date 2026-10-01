import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("F-020 submitted attestation read path", () => {
  it("opens the existing governed evidence record instead of duplicating attestation state", async () => {
    const page = await readFile("src/training/RequestTrainingPage.tsx", "utf8");
    const api = await readFile("src/training/trainingApi.ts", "utf8");

    expect(api).toContain("readonly operational_evidence_record_id:string");
    expect(page).toContain("View governed record");
    expect(page).toContain('evidencePathWithReturn(r.operational_evidence_record_id,{kind:"TRAINING_REQUEST"})');
    expect(page).not.toContain("External signer:");
    expect(page).not.toContain("Recorded by:");
  });
});
