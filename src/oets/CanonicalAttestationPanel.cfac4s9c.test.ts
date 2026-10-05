import {describe,expect,it} from "vitest";
import {readFile} from "node:fs/promises";

const read=(path:string)=>readFile(path,"utf8");

describe("CFAC-4S9C founding executive override presentation",()=>{
  it("derives availability from the dedicated permission without broad role inference",async()=>{
    const record=await read("src/oets/OperationalEvidenceRecordPage.tsx");
    expect(record).toContain('canOverrideSeparation={auth.canUsePermission("override_operational_assessment_separation")}');
    expect(record).not.toMatch(/canOverrideSeparation=.*OGI_ADMIN|canOverrideSeparation=.*OGI_OFFICER|canOverrideSeparation=.*DEV/);
  });

  it("requires deliberate activation, reason, and separate confirmation",async()=>{
    const panel=await read("src/oets/CanonicalAttestationPanel.tsx");
    expect(panel).toContain("Use founding executive separation override");
    expect(panel).toContain("Operational reason");
    expect(panel).toContain("20–1000 characters");
    expect(panel).toContain("I explicitly confirm that I am acting as both Assessor and Reviewer");
  });

  it("renders truthful immutable override history",async()=>{
    const panel=await read("src/oets/CanonicalAttestationPanel.tsx");
    expect(panel).toContain("Founding Executive Override · same-person assessment and review");
    expect(panel).toContain("Reason: {attestation.separation.overrideReason}");
    expect(panel).toContain("Independent Reviewer · recorded before override metadata");
  });
});
