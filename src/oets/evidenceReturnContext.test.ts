import { describe, expect, it } from "vitest";

import { evidencePathWithReturn, evidenceReturnDestination, evidenceReturnLabel, readEvidenceReturnContext } from "./evidenceReturnContext";

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

  it("round-trips the fixed Training Request destination", () => {
    const path = evidencePathWithReturn("record-1", { kind: "TRAINING_REQUEST" });
    const context = readEvidenceReturnContext(new URL(path, "https://example.test").search);
    expect(path).toBe("/workbench/evidence/record-1?return=training-request");
    expect(context).toEqual({ kind: "TRAINING_REQUEST" });
    expect(evidenceReturnDestination(context!)).toBe("/workbench/training/requests");
  });

  it.each([
    ["TRAINING", "training", "/workbench/training/trainees", "Back to Training"],
    ["GOVERNANCE_QUEUE", "governance-queue", "/workbench/governance/queue", "Back to Governance Queue"],
    ["WORKBENCH", "workbench", "/workbench", "Back to Workbench"],
    ["RECORDS", "records", "/workbench/operations/records", "Back to Records"],
    ["MY_DRAFTS", "my-drafts", "/workbench/operations/my-drafts", "Back to My Drafts"]
  ] as const)("round-trips the fixed %s destination", (kind, descriptor, destination, label) => {
    const path = evidencePathWithReturn("record/with spaces", { kind });
    const context = readEvidenceReturnContext(new URL(path, "https://example.test").search);

    expect(path).toBe(`/workbench/evidence/record%2Fwith%20spaces?return=${descriptor}`);
    expect(context).toEqual({ kind });
    expect(evidenceReturnDestination(context!)).toBe(destination);
    expect(evidenceReturnLabel(context!)).toBe(label);
  });

  it("rejects unknown and incomplete return descriptors", () => {
    expect(readEvidenceReturnContext("?return=https://evil.example")).toBeNull();
    expect(readEvidenceReturnContext("?return=facility-assessment&client=client-1")).toBeNull();
    expect(readEvidenceReturnContext("?return=training-journey")).toBeNull();
    expect(readEvidenceReturnContext("?return=governance-queue-extra")).toBeNull();
    expect(readEvidenceReturnContext("?return=records&destination=https://evil.example")).toEqual({ kind: "RECORDS" });
  });
});
