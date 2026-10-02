import { executiveSummaryCategoryCodes, type ExecutiveSummaryProjection } from "./executiveSummaryApi";

const checksum = "a".repeat(64);
const values = [
  ["Governance & Documentation", "60", "CRITICAL", "0.1", "6"],
  ["Lifeguard Operations", "80", "LOW", "0.15", "12"],
  ["Emergency Preparedness", "80", "LOW", "0.15", "12"],
  ["Rescue Equipment & Assets", "85", "LOW", "0.15", "12.75"],
  ["Training & Competency", "90", "LOW", "0.1", "9"],
  ["Facility & Environmental Safety", "90", "LOW", "0.1", "9"],
  ["Incident Management", "90", "LOW", "0.1", "9"],
  ["Public Safety Systems", "96", "LOW", "0.1", "9.6"],
  ["Equipment Inspection Programs", "96", "LOW", "0.05", "4.8"]
] as const;

export function executiveSummaryFixture(): ExecutiveSummaryProjection {
  const categories = executiveSummaryCategoryCodes.map((categoryCode, index) => {
    const tuple = values.at(index);
    if (!tuple) throw new Error(`Missing executive-summary fixture category ${index + 1}.`);
    const [categoryName, categoryIndex, classification, weight, weightedContribution] = tuple;
    return {
      canonicalOrder: index + 1,
      categoryCode,
      categoryName,
      index: categoryIndex,
      classification,
      weight,
      weightedContribution,
      source: { assessmentId: `assessment-${index + 1}`, assessmentVersion: 1, assessmentSnapshotChecksum: checksum, finalizedAt: "2026-10-01T06:00:00.000Z", evidenceCutoffAt: "2026-09-30T06:00:00.000Z" },
      contributionChecksum: checksum
    };
  });
  const ordered = categories.map((category, index) => ({ categoryCode: category.categoryCode, index: category.index, sharedRank: index + 1 }));
  return {
    projectionVersion: "EXECUTIVE_SUMMARY_SLIDES_1_3_V1",
    scope: { clientId: "client-1", clientIdentifier: "CLIENT-2026-000002", clientName: "AiaAva Hotels and Resorts", facilityId: "facility-1", facilityIdentifier: "FACILITY-2026-000002", facilityName: "Aia Private Club" },
    ari: { resultId: "00000000-0000-4000-8000-000000000001", resultVersion: 1, value: "84.15", classification: "LOW", calculatedAt: "2026-10-01T09:57:45.000Z", resultChecksum: checksum, sourceSetChecksum: checksum, authorityVersion: "1.0", authorityChecksum: checksum, numericContract: "decimal-65-24-half-even-v1" },
    categories,
    numericOrdering: { lowestFirst: ordered, highestFirst: [...ordered].reverse() }
  };
}
