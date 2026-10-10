import { describe, expect, it } from "vitest";
import { applyOrdinaryPerformerPresentation, isOrdinaryPerformerSuccessor } from "./ordinaryPerformerPresentation";

const definition = { sections: [{ section_code: "QA", title: "Audit", fields: [
  { field_code: "RESULT", field_id: "result", label: "Result", field_type: "TEXT", metadata: { authority: "BOUND_PERFORMER_WRITABLE_RESULT" } },
  { field_code: "ROUTING", field_id: "routing", label: "Routing", field_type: "TEXT" }
]}] } as any;
const binding = { performer_user_id: "performer" } as any;

describe("ordinary performer presentation", () => {
  it("recognizes only the prospective successor versions", () => {
    expect(isOrdinaryPerformerSuccessor("OGI_F023_OPERATIONAL_SKILLS_ASSESSMENT", "3.6")).toBe(true);
    expect(isOrdinaryPerformerSuccessor("OGI_F023_OPERATIONAL_SKILLS_ASSESSMENT", "3.5")).toBe(false);
  });
  it("keeps result fields read-only until the authenticated actor is the bound performer", () => {
    expect((applyOrdinaryPerformerPresentation(definition, null, "performer") as any).sections[0].fields[0].readonly).toBe(true);
    expect((applyOrdinaryPerformerPresentation(definition, binding, "other") as any).sections[0].fields[0].readonly).toBe(true);
    expect((applyOrdinaryPerformerPresentation(definition, binding, "performer") as any).sections[0].fields[0].readonly).toBe(false);
    expect((applyOrdinaryPerformerPresentation(definition, binding, "other") as any).sections[0].fields[1].readonly).toBeUndefined();
  });
});
