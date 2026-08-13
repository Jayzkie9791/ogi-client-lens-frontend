export const routes = {
  home: "/",
  login: "/login",
  workbench: "/workbench",
  operations: "/workbench/operations",
  records: "/workbench/operations/records",
  administration: "/workbench/administration",
  registrationClients: "/workbench/registration/clients",
  registrationFacilities: "/workbench/registration/facilities",
  registrationPersonnel: "/workbench/registration/personnel",
  credentials: "/workbench/credentials",
  credentialsPersonnel: "/workbench/credentials/personnel/:staffMemberId",
  credentialsPersonnelPath: (staffMemberId: string) =>
    `/workbench/credentials/personnel/${encodeURIComponent(staffMemberId)}`,
  governanceQueue: "/workbench/governance/queue",
  oetsTemplate: "/workbench/oets/:templateCode",
  oetsTemplatePath: (templateCode: string) =>
    `/workbench/oets/${encodeURIComponent(templateCode)}`,
  evidenceRecord: "/workbench/evidence/:recordId",
  evidenceRecordPath: (recordId: string) =>
    `/workbench/evidence/${encodeURIComponent(recordId)}`
} as const;
