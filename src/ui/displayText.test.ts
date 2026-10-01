import { describe, expect, it } from "vitest";

import { humanizeDisplayCode, humanizeDisplaySentence, normalizeDisplayAcronyms } from "./displayText";

describe("governed display text", () => {
  it("preserves approved acronyms while humanizing machine codes", () => {
    expect(humanizeDisplayCode("CPR_AED_EVENT")).toBe("CPR AED Event");
    expect(humanizeDisplayCode("ARI_CLASSIFICATION")).toBe("ARI Classification");
    expect(humanizeDisplayCode("INCIDENT_SEVERITY_INDEX_ISI")).toBe("Incident Severity Index ISI");
    expect(humanizeDisplayCode("OGI_OETS_REVIEW")).toBe("OGI OETS Review");
    expect(humanizeDisplayCode("FACILITY_ID")).toBe("Facility ID");
  });

  it("preserves sentence-case status labels without losing acronyms",()=>{
    expect(humanizeDisplaySentence("GOVERNANCE_APPROVED")).toBe("Governance approved");
    expect(humanizeDisplaySentence("CPR_AED_REVIEW")).toBe("CPR AED review");
  });

  it("normalizes acronyms in system-authored template presentation text", () => {
    expect(normalizeDisplayAcronyms("Aquatic Risk Intelligence Review (Ari™)")).toBe("Aquatic Risk Intelligence Review (ARI™)");
    expect(normalizeDisplayAcronyms("Cpr/Aed controls impact Eap effectiveness")).toBe("CPR/AED controls impact EAP effectiveness");
    expect(normalizeDisplayAcronyms("Ogi-Armaa and Odis review")).toBe("OGI-ARMAA and ODIS review");
    expect(normalizeDisplayAcronyms("Facility Id · Cap Number")).toBe("Facility ID · CAP Number");
  });

  it.each([
    ["Incident Severity Index (Isi™)", "Incident Severity Index (ISI™)"],
    ["Rescue Effectiveness Rating (Rer™)", "Rescue Effectiveness Rating (RER™)"],
    ["Operational Competency Score (Ocs™)", "Operational Competency Score (OCS™)"],
    ["Near-Miss Severity Index (Nmsi™)", "Near-Miss Severity Index (NMSI™)"],
    ["Incident Investigation Rating (Iir™)", "Incident Investigation Rating (IIR™)"]
  ])("normalizes governed trademark presentation text %s",(input,expected)=>{
    expect(normalizeDisplayAcronyms(input)).toBe(expected);
  });

  it("does not uppercase an unregistered trademarked word",()=>{
    expect(normalizeDisplayAcronyms("Client Lens Product™")).toBe("Client Lens Product™");
  });

  it("covers every mixed-case trademark acronym found in the governed template corpus",()=>{
    const acronyms=["Acr","Ari","Biis","Cacr","Cdr","Cri","Dei","Dfr","Drs","Ds","Err","Frr","Hsi","Icr","Ids","Ifr","Iir","Isi","Isr","Lei","Nmsi","Ocs","Oks","Pos","Rdr","Rei","Rer","Rpn","Rrs","Rrv","Sir","Vs"];
    for(const acronym of acronyms)expect(normalizeDisplayAcronyms(`${acronym}™`)).toBe(`${acronym.toUpperCase()}™`);
    expect(normalizeDisplayAcronyms("isi™")).toBe("ISI™");
  });

  it("does not rewrite words outside the governed acronym vocabulary", () => {
    expect(normalizeDisplayAcronyms("Rapid response plan with a capacity cap")).toBe("Rapid response plan with a capacity cap");
  });
});
