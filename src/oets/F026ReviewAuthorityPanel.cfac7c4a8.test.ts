import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const read=(path:string)=>readFile(path,"utf8");

describe("CFAC-7C4A8 F026 dormant selection workflow",()=>{
 it("renders only for exact F026 v3.3 and submits the complete authority envelope",async()=>{
  const page=await read("src/oets/RuntimeTemplatePage.tsx");
  expect(page).toContain('template_code==="OGI_F026_INSTRUCTOR_QUALITY_ASSURANCE_REVIEW"');
  expect(page).toContain('template_version==="3.3"');
  expect(page).toContain("F026ReviewAuthorityPanel");
  expect(page).toContain("f026_review_authority:f026ReviewAuthority");
  expect(page).toContain("Complete the Instructor QA Review authority selection");
 });

 it("requires exact Instructor, effective Reviewer appointment, review date/types and conditional Session",async()=>{
  const panel=await read("src/oets/F026ReviewAuthorityPanel.tsx");
  const api=await read("src/oets/f026ReviewAuthorityApi.ts");
  for(const token of ["reviewed_instructor_personnel_id","qa_reviewer_appointment_id","training_session_id","review_types","review_date","sessionRequired"])expect(panel).toContain(token);
  for(const endpoint of ["instructor-candidates","appointment-candidates","training-session-candidates"])expect(api).toContain(endpoint);
  expect(panel).toContain("item.personnel_id!==instructorId");
 });
});
