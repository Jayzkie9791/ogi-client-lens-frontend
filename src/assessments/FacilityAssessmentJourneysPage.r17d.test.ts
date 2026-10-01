import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("R17D F041 current successor presentation",()=>{
  it("offers the exact current form while retaining the approved historical link",()=>{
    const source=readFileSync("src/assessments/FacilityAssessmentJourneysPage.tsx","utf8");
    expect(source).toContain("Create current F041");
    expect(source).toContain("View approved historical F041 v");
    expect(source).toContain("Continue current draft");
    expect(source).toContain("Historical approved records remain immutable");
  });
  it("consumes version-bound certification summaries",()=>{
    const api=readFileSync("src/assessments/facilityAssessmentApi.ts","utf8");
    expect(api).toContain("CertificationEvidenceSummary");
    expect(api).toContain("historicalApprovedRecords");
  });
});
