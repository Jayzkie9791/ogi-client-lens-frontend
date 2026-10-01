import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

describe("R15B durable evidence return launchers", () => {
  it("connects every Governance Queue record action to the fixed queue context", async () => {
    const source = await readFile("src/oets/GovernanceQueuePage.tsx", "utf8");

    expect(source).toContain('evidencePathWithReturn(item.evidence_record.id, { kind: "GOVERNANCE_QUEUE" })');
    expect(source).not.toContain("routes.evidenceRecordPath(item.evidence_record.id)");
  });

  it("connects Workbench drafts and reviews to the fixed Workbench context", async () => {
    const source = await readFile("src/app/routes/WorkbenchPage.tsx", "utf8");

    expect(source.match(/kind: "WORKBENCH"/g)).toHaveLength(2);
    expect(source).not.toContain("routes.evidenceRecordPath(record.evidence_record_id)");
    expect(source).not.toContain("routes.evidenceRecordPath(item.evidence_record.id)");
  });

  it("connects Records and legacy Training evidence links without transient router state", async () => {
    const records = await readFile("src/app/routes/RecordsPage.tsx", "utf8");
    const training = await readFile("src/training/RegistrationTrainingPage.tsx", "utf8");

    expect(records).toContain('returnKind = "RECORDS"');
    expect(records).toContain('returnKind="MY_DRAFTS"');
    expect(records).toContain("evidencePathWithReturn(record.evidence_record_id, { kind: returnKind })");
    expect(training.match(/kind: "TRAINING"/g)).toHaveLength(2);
    expect(training).not.toContain('state={{ returnTo: routes.registrationTraining }}');
  });
});
