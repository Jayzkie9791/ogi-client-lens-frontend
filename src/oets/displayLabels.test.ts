import { describe, expect, it } from "vitest";

import { displayLifecycleStatus } from "./displayLabels";

describe("displayLifecycleStatus", () => {
  it("does not call terminal submitted evidence Awaiting Review", () => {
    expect(displayLifecycleStatus("SUBMITTED", { hasDeclaredOutgoingTransition: false })).toBe("Submitted");
  });

  it("retains Awaiting Review when the governing template declares a next action", () => {
    expect(displayLifecycleStatus("SUBMITTED", { hasDeclaredOutgoingTransition: true })).toBe("Awaiting Review");
  });
});
