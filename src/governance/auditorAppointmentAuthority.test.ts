import { describe, expect, it } from "vitest";

import type { RegistrationPersonnel } from "../registration/registrationPersonnelApi";
import {
  isInvalidAuditPerformerSelection,
  isOgiOnlyPerformanceProfile
} from "./auditorAppointmentAuthority";

const ogiPersonnel = personnel("OGI", null);
const clientPersonnel = personnel("CLIENT", "client-1");

describe("OGI-only audit performer presentation guard", () => {
  it("treats only profiles with PERFORM_FACILITY_AUDIT as OGI-only", () => {
    for (const profile of ["AUDIT_TEAM_MEMBER", "AUDIT_OPERATOR", "LEAD_AUDITOR", "FULL_AUDIT_AUTHORITY"] as const) {
      expect(isOgiOnlyPerformanceProfile(profile)).toBe(true);
      expect(isInvalidAuditPerformerSelection(profile, clientPersonnel)).toBe(true);
      expect(isInvalidAuditPerformerSelection(profile, ogiPersonnel)).toBe(false);
    }
  });

  it("does not widen the rule to reviewer or approver profiles", () => {
    for (const profile of ["AUDIT_REVIEWER", "AUDIT_APPROVER"] as const) {
      expect(isOgiOnlyPerformanceProfile(profile)).toBe(false);
      expect(isInvalidAuditPerformerSelection(profile, clientPersonnel)).toBe(false);
    }
  });
});

function personnel(
  organizational_affiliation: "CLIENT" | "OGI",
  client_id: string | null
): RegistrationPersonnel {
  return {
    id: `personnel-${organizational_affiliation}`,
    client_id,
    organizational_affiliation,
    user_id: "user-1",
    full_name: `${organizational_affiliation} Personnel`,
    employment_status: "ACTIVE",
    created_at: "2026-09-20T00:00:00.000Z",
    updated_at: "2026-09-20T00:00:00.000Z"
  };
}
