import { describe, expect, it } from "vitest";

import { describeDomainCandidate, formatAssessmentDateTime, previewProfessionalCategoryIndex, professionalDeterminationReadiness, professionalIndexBands, shortEvidenceReference } from "./DomainAssessmentWorkspace";
import type { DomainAssessmentWorkspaceRecord } from "./domainAssessmentWorkspaceApi";

describe("Domain Assessment presentation", () => {
  it("formats governed evidence instants for people without exposing raw ISO text", () => {
    const instant = "2026-08-30T00:00:00.000Z";
    const display = formatAssessmentDateTime(instant);

    expect(display).not.toBe(instant);
    expect(display).not.toContain("T00:00:00.000Z");
    expect(display).not.toBe("Date unavailable");
  });

  it("fails to a readable label for missing or invalid evidence dates", () => {
    expect(formatAssessmentDateTime(null)).toBe("Date unavailable");
    expect(formatAssessmentDateTime("not-an-instant")).toBe("Date unavailable");
  });

  it("presents operational evidence with exact form, lifecycle, version, date, and a secondary short reference", () => {
    const presentation = describeDomainCandidate("F002", {
      id: "00000000-0000-4000-8000-000091ac42e7",
      sourceKind: "OPERATIONAL_EVIDENCE",
      templateCode: "OGI_F002_FACILITY_PROFILE_BASELINE_INTELLIGENCE_ASSESSMENT",
      templateVersion: "3.5",
      lifecycleState: "GOVERNANCE_APPROVED",
      sourceChecksum: "a".repeat(64),
      sourceAt: "2026-09-25T00:51:00.000Z",
      href: "/api/v1/operational-evidence/00000000-0000-4000-8000-000091ac42e7"
    });

    expect(presentation.heading).toBe("F002 governed evidence");
    expect(presentation.summary).toContain("Governance approved");
    expect(presentation.summary).toContain("Template v3.5");
    expect(presentation.summary).toContain("Submitted");
    expect(presentation.summary).not.toContain("OPERATIONAL_EVIDENCE");
    expect(presentation.reference).toBe("…91ac42e7");
  });

  it("uses additive backend presentation metadata and retains a safe generic fallback", () => {
    const enriched = describeDomainCandidate("F025", {
      id:"evidence-1",sourceKind:"OPERATIONAL_EVIDENCE",templateVersion:"3.4",lifecycleState:"GOVERNANCE_APPROVED",sourceAt:"2026-09-24T12:09:00.000Z",
      presentation:{schemaVersion:"DOMAIN_EVIDENCE_PRESENTATION_V1",mode:"GENERIC",primaryLabel:"F025 governed evidence",secondaryLabel:"OGI_F025_OPERATIONAL_READINESS_EVALUATION",contextKind:"OPERATIONAL_EVIDENCE",contextReference:"evidence-1",timestamp:{label:"Submitted",value:"2026-09-24T12:09:00.000Z"}}
    });
    expect(enriched.heading).toBe("F025 governed evidence");
    expect(enriched.context).toBe("OGI_F025_OPERATIONAL_READINESS_EVALUATION");
    expect(enriched.summary).toContain("Submitted");
    const fallback=describeDomainCandidate("F025",{id:"evidence-2",sourceKind:"OPERATIONAL_EVIDENCE",sourceAt:null});
    expect(fallback.heading).toBe("F025 governed evidence");
    expect(fallback.summary).toContain("Submitted Date unavailable");
  });

  it("keeps short technical references secondary and deterministic", () => {
    expect(shortEvidenceReference("12345678")).toBe("12345678");
    expect(shortEvidenceReference("00000000-0000-4000-8000-12345678")).toBe("…12345678");
  });

  it("explains the manual professional scale and previews exact LMHC boundaries", () => {
    expect(professionalIndexBands.map((band) => [band.range, band.classification])).toEqual([
      ["80–100", "LOW"], ["70–<80", "MODERATE"], ["60–<70", "HIGH"], ["0–<60", "CRITICAL"]
    ]);
    expect(["59.999999999999999999999999", "60", "69.999999999999999999999999", "70", "79.999999999999999999999999", "80", "100"].map((value) => previewProfessionalCategoryIndex(value)?.classification)).toEqual(["CRITICAL", "HIGH", "HIGH", "MODERATE", "MODERATE", "LOW", "LOW"]);
    expect(previewProfessionalCategoryIndex("101")?.valid).toBe(false);
    expect(previewProfessionalCategoryIndex("-1")?.valid).toBe(false);
    expect(previewProfessionalCategoryIndex("1e2")?.valid).toBe(false);
    expect(previewProfessionalCategoryIndex("1.1234567890123456789012345")?.valid).toBe(false);
  });

  it("separates resolved evidence, entered judgment, unsaved changes, and submission readiness", () => {
    const assessment: DomainAssessmentWorkspaceRecord = {
      id: "assessment-1", assessmentVersion: 1, lifecycle: "DRAFT", root: { domainCode: "GOVERNANCE_DOCUMENTATION" }, scope: { id: "scope-1", displayName: "Facility-wide" },
      professionalDetermination: { professionalCategoryIndex: null, lmhc: null, synthesis: null }, authority: { professionalIndexContract: "PROFESSIONAL_CATEGORY_INDEX" },
      applicability: [{ formCode: "F002", canonicalOrder: 1, state: "APPLICABLE", contributions: [{ sourceKind: "OPERATIONAL_EVIDENCE", sourceId: "evidence-1", sourceAt: "2026-09-25T00:51:00.000Z" }] }]
    };
    const unsaved = professionalDeterminationReadiness(assessment, "80", "LOW", "Evidence supports strong controls.");
    expect(unsaved.canSave).toBe(true);
    expect(unsaved.determinationSaved).toBe(false);
    expect(unsaved.readyToSubmit).toBe(false);
    expect(unsaved.checks[unsaved.checks.length - 1]?.label).toBe("Professional determination has unsaved changes");

    const saved = professionalDeterminationReadiness({ ...assessment, professionalDetermination: { professionalCategoryIndex: "80", lmhc: "LOW", synthesis: "Evidence supports strong controls." } }, "80", "LOW", "Evidence supports strong controls.");
    expect(saved.determinationSaved).toBe(true);
    expect(saved.readyToSubmit).toBe(true);
  });
});
