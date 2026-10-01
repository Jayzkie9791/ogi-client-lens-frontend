import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe,expect,it } from "vitest";

describe("asset-form coverage presentation",()=>{
  it("keeps F084/F085 collapsed by default while preserving F081 baseline expansion",async()=>{
    const source=await readFile(path.resolve(process.cwd(),"src/assessments/FacilityAssessmentJourneysPage.tsx"),"utf8");
    const coverage=source.slice(source.indexOf("function AssetCoverageCard"),source.indexOf("function AssetFormCoverage"));
    expect(coverage).toContain("<details open={defaultOpen}>");
    expect(source).toContain('defaultOpen={formCode==="F081"}');
  });
});
