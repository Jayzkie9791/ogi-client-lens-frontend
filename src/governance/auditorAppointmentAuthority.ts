import type { RegistrationPersonnel } from "../registration/registrationPersonnelApi";
import type { AppointmentProfile } from "./auditorAppointmentsApi";

const performanceProfiles = new Set<AppointmentProfile>([
  "AUDIT_TEAM_MEMBER",
  "AUDIT_OPERATOR",
  "LEAD_AUDITOR",
  "FULL_AUDIT_AUTHORITY"
]);

export function isOgiOnlyPerformanceProfile(profile: AppointmentProfile) {
  return performanceProfiles.has(profile);
}

export function isInvalidAuditPerformerSelection(
  profile: AppointmentProfile,
  personnel: RegistrationPersonnel | undefined
) {
  return Boolean(
    personnel &&
    isOgiOnlyPerformanceProfile(profile) &&
    (personnel.organizational_affiliation !== "OGI" || personnel.client_id !== null)
  );
}
