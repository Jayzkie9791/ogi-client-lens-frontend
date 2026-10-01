import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

describe("R15C durable evidence return continuity", () => {
  it("preserves the return query across new, existing, and converged contextual creation", async () => {
    const runtime = await readFile("src/oets/RuntimeTemplatePage.tsx", "utf8");

    expect(runtime).toContain('navigate({ pathname: routes.evidenceRecordPath(record.id), search: preservedSearch ? `?${preservedSearch}` : "" })');
    expect(runtime).toContain('navigate({ pathname: routes.evidenceRecordPath(existingContextRecord.evidence_record_id), search: preservedSearch ? `?${preservedSearch}` : "" })');
    expect(runtime).toContain('recordHref: `${routes.evidenceRecordPath(successRecord.id)}${successRecordSearch ? `?${successRecordSearch}` : ""}`');
  });

  it("preserves standalone context and keeps embedded correction or revision identity changes in their journey", async () => {
    const recordPage = await readFile("src/oets/OperationalEvidenceRecordPage.tsx", "utf8");
    const assessmentJourney = await readFile("src/assessments/FacilityAssessmentJourneysPage.tsx", "utf8");
    const trainingJourney = await readFile("src/training/RegistrationTrainingPage.tsx", "utf8");

    expect(recordPage.match(/navigate\(\{ pathname: routes\.evidenceRecordPath\(draft\.id\), search: location\.search \}, \{ state: location\.state \}\)/g)).toHaveLength(2);
    expect(recordPage.match(/if \(embeddedRecordId && onRecordIdentityChange\)/g)).toHaveLength(2);
    expect(recordPage.match(/onRecordIdentityChange\(draft\.id\)/g)).toHaveLength(2);
    expect(assessmentJourney).toContain("onRecordIdentityChange={onRecordCreated}");
    expect(trainingJourney).toContain("onRecordIdentityChange={setOpenRecordId}");
  });

  it("keeps save and lifecycle transitions on the same context-bearing record location", async () => {
    const recordPage = await readFile("src/oets/OperationalEvidenceRecordPage.tsx", "utf8");

    expect(recordPage).toContain("mutationFn: (payload: OetsEvidencePayload)");
    expect(recordPage).toContain("transitionOperationalEvidenceRecord(recordId ?? \"\"");
    expect(recordPage).toContain("transitionClaimedGovernanceReviewWithConclusion(record.id, claim.id");
    expect(recordPage).toContain("const durableReturnContext = !embeddedRecordId ? readEvidenceReturnContext(location.search) : null;");
    expect(recordPage).toContain("{standaloneReturnDestination ? <div><Button");
    expect(recordPage).not.toContain("standaloneReturnDestination && (!draftPayloadMutation.isSuccess || draftDirty)");
  });

  it("does not permit unrestricted return destinations", async () => {
    const context = await readFile("src/oets/evidenceReturnContext.ts", "utf8");

    expect(context).not.toMatch(/https?:\/\//);
  });
});
