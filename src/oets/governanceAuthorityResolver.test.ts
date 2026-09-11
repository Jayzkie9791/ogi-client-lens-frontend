import { describe, expect, it } from "vitest";

import { resolveGovernanceAuthorityCode } from "./governanceAuthorityResolver";

describe("resolveGovernanceAuthorityCode", () => {
  it("keeps ordinary review direct and reserves approval for governance", () => {
    expect(resolveGovernanceAuthorityCode("UNDER_REVIEW")).toBeNull();
    expect(resolveGovernanceAuthorityCode("GOVERNANCE_APPROVED")).toBe(
      "OETS_GOVERNANCE_APPROVER"
    );
  });

  it("preserves named review authority compatibility", () => {
    expect(resolveGovernanceAuthorityCode("UNDER_OGI_REVIEW")).toBe("OGI");
    expect(resolveGovernanceAuthorityCode("CLIENT_REVIEW")).toBe("CLIENT");
  });
});
