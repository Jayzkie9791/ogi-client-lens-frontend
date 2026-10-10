import { describe,expect,it } from "vitest";
import { readFile } from "node:fs/promises";

const read=(path:string)=>readFile(path,"utf8");

describe("CFAC-7C4A9-R2 F026 Assessment Journey production integration",()=>{
  it("queries and renders exact F026 governed completeness",async()=>{
    const [page,api]=await Promise.all([
      read("src/assessments/FacilityAssessmentJourneysPage.tsx"),
      read("src/assessments/facilityAssessmentApi.ts")
    ]);
    expect(api).toContain('"F025"|"F026"|"F027"');
    expect(page).toContain('getTrainingCompetencyFormCompleteness(clientId,facilityId,"F026")');
    expect(page).toContain('F026:f026Query.data??null');
    expect(page).toContain('F026:f026Query.isError');
    expect(page).toContain('formCode==="F026"');
  });

  it("keeps dormant v3.2 hidden and starts only exact current v3.3 selection workflow",async()=>{
    const page=await read("src/assessments/FacilityAssessmentJourneysPage.tsx");
    expect(page).toContain('formCode==="F026"&&template?.template_version==="3.3"');
    expect(page).toContain('formCode!=="F026"&&subject.actions.canStart');
    expect(page).toContain("Start Instructor QA review");
    expect(page).toContain("immutable Instructor QA review occurrence and source-role bindings");
    expect(page).not.toMatch(/formCode==="F026"&&template\?\.template_version!=="3\.3"/);
  });
});
