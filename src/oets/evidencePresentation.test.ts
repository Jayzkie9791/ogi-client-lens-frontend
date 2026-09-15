import { describe, expect, it } from "vitest";

import {
  evidenceSectionGuidance,
  formatEvidenceSectionTitle,
  humanizeEvidenceTemplateCode,
} from "./evidencePresentation";

describe("evidence presentation", () => {
  it("preserves the uppercase OCS trademark acronym in section titles", () => {
    expect(formatEvidenceSectionTitle("Operational Competency Score (Ocs™)")).toBe(
      "Operational Competency Score (OCS™)",
    );
  });

  it("preserves the uppercase OKS trademark acronym in section titles", () => {
    expect(formatEvidenceSectionTitle("Operational Knowledge Score (Oks™)")).toBe(
      "Operational Knowledge Score (OKS™)",
    );
  });

  it("does not alter unrelated section titles", () => {
    expect(formatEvidenceSectionTitle("Operational Skills Assessment")).toBe(
      "Operational Skills Assessment",
    );
  });

  it("capitalizes governed acronyms in template codes and section titles", () => {
    expect(humanizeEvidenceTemplateCode("OGI_F002_BASELINE_ARMAA_ASSESSMENT")).toBe(
      "F002 Baseline ARMAA Assessment",
    );
    expect(formatEvidenceSectionTitle("Baseline Armaa Assessment")).toBe(
      "Baseline ARMAA Assessment",
    );
    expect(formatEvidenceSectionTitle("Ogi Odis and Ari Review")).toBe(
      "OGI ODIS and ARI Review",
    );
  });

  it("explains the governed knowledge-domain point semantics", () => {
    expect(evidenceSectionGuidance("KNOWLEDGE_DOMAIN_SCORES")).toContain(
      "not percentages or a fixed 1–10 rating",
    );
    expect(evidenceSectionGuidance("OTHER_SECTION")).toBeNull();
  });

  it("explains F002 component grading and derived scoring", () => {
    expect(evidenceSectionGuidance("BASELINE_ARMAA_ASSESSMENT")).toContain("Governance 20%");
    expect(evidenceSectionGuidance("BASELINE_ODIS_ASSESSMENT")).toContain("16⅔% each");
    expect(evidenceSectionGuidance("BASELINE_ARI_ASSESSMENT")).toContain("Operational 30%");
    expect(evidenceSectionGuidance("INSURANCE_READINESS_ASSESSMENT")).toContain("projected into ARI");
  });

  it("explains F003 qualitative criteria and N/A normalization", () => {
    expect(evidenceSectionGuidance("OPERATIONAL_GOVERNANCE")).toContain("criteria have no points or weights");
    expect(evidenceSectionGuidance("ARI_SCORING_SUMMARY")).toContain("Domains marked Not Applicable are excluded");
  });

  it("explains unavailable optional authority without encouraging manual substitutes", () => {
    expect(evidenceSectionGuidance("CONTINUING_EDUCATION_INTELLIGENCE_CEI")).toContain("leave this optional section blank");
    expect(evidenceSectionGuidance("AQUATIC_RISK_INTELLIGENCE_REVIEW_ARI")).toContain("Do not estimate");
    expect(evidenceSectionGuidance("CLIENT_LENS_DASHBOARD_DATA")).toContain("CRI and Defensibility scores are repeated");
    expect(evidenceSectionGuidance("CERTIFICATION_PROFILE")).toContain("do not invent a substitute");
  });
});
