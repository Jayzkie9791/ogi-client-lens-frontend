import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe,expect,it } from "vitest";

describe("incident-form journey coverage",()=>{it("renders F063-F066 by governed Incident with start, continue, and view actions",async()=>{const source=await readFile(path.resolve(process.cwd(),"src/assessments/FacilityAssessmentJourneysPage.tsx"),"utf8"),coverage=source.slice(source.indexOf("function IncidentCoverageCard"),source.indexOf("function AssetFormCoverage"));expect(source).toContain('formCode==="F063"||formCode==="F064"||formCode==="F065"||formCode==="F066"');expect(coverage).toContain("Continue draft");expect(coverage).toContain("View evidence");expect(coverage).toContain("Start another record");expect(coverage).toContain("Register an Incident and start");expect(coverage).toContain("border-l-gray-300");});});
