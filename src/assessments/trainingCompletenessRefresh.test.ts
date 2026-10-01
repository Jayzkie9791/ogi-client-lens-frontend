import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

describe("Category 5 journey completeness refresh", () => {
  it("refreshes the facility-scoped projection when the embedded form closes", async () => {
    const source = await readFile("src/assessments/FacilityAssessmentJourneysPage.tsx", "utf8");

    expect(source).toContain(
      'queryClient.invalidateQueries({queryKey:["training-competency-form-completeness",clientId,facilityId]})'
    );
  });

  it("refreshes cached Category 5 projections after direct and governed transitions", async () => {
    const source = await readFile("src/oets/OperationalEvidenceRecordPage.tsx", "utf8");
    const invalidations = source.match(
      /queryClient\.invalidateQueries\(\{ queryKey: \["training-competency-form-completeness"\] \}\)/g
    );

    expect(invalidations).toHaveLength(2);
  });
});
