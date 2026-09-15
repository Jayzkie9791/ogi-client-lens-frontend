import { describe, expect, it } from "vitest";

import { evidencePathWithReturn, evidenceReturnDestination, readEvidenceReturnContext } from "./evidenceReturnContext";

describe("durable evidence return context", () => {
  it("round-trips an allowlisted Facility Assessment destination", () => {
    const path = evidencePathWithReturn("record-1", { kind: "FACILITY_ASSESSMENT", clientId: "client-1", facilityId: "facility-1", categoryCode: "LIFEGUARD_OPERATIONS" });
    const context = readEvidenceReturnContext(new URL(path, "https://example.test").search);
    expect(context).toEqual({ kind: "FACILITY_ASSESSMENT", clientId: "client-1", facilityId: "facility-1", categoryCode: "LIFEGUARD_OPERATIONS" });
    expect(evidenceReturnDestination(context!)).toBe("/workbench/assessments/facility-journeys?client=client-1&facility=facility-1&category=LIFEGUARD_OPERATIONS");
  });

  it("round-trips the exact Training enrollment", () => {
    const context = readEvidenceReturnContext("?return=training-journey&enrollment=enrollment-1");
    expect(evidenceReturnDestination(context!)).toBe("/workbench/training/journeys?enrollment=enrollment-1");
  });

  it("rejects unknown and incomplete return descriptors", () => {
    expect(readEvidenceReturnContext("?return=https://evil.example")).toBeNull();
    expect(readEvidenceReturnContext("?return=facility-assessment&client=client-1")).toBeNull();
    expect(readEvidenceReturnContext("?return=training-journey")).toBeNull();
  });
});
