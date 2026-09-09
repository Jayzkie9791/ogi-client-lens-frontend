export const routes = {
  home: "/",
  login: "/login",
  forgotPassword: "/forgot-password",
  resetPassword: "/reset-password",
  workbench: "/workbench",
  auditRisk: "/workbench/audit-risk",
  auditDetail: "/workbench/audit-risk/audits/:auditId",
  auditDetailPath: (auditId: string) =>
    `/workbench/audit-risk/audits/${encodeURIComponent(auditId)}`,
  auditExecution: "/workbench/audit-risk/audits/:auditId/execution",
  auditExecutionPath: (auditId: string) =>
    `/workbench/audit-risk/audits/${encodeURIComponent(auditId)}/execution`,
  auditFindings: "/workbench/audit-risk/findings",
  auditFindingDetail: "/workbench/audit-risk/findings/:findingId",
  auditFindingDetailPath: (findingId: string) =>
    `/workbench/audit-risk/findings/${encodeURIComponent(findingId)}`,
  operations: "/workbench/operations",
  records: "/workbench/operations/records",
  administration: "/workbench/administration",
  administrationClientPocs: "/workbench/administration/client-pocs",
  registrationClients: "/workbench/registration/clients",
  registrationFacilities: "/workbench/registration/facilities",
  registrationPersonnel: "/workbench/registration/personnel",
  registrationTraining: "/workbench/training/trainees",
  training: "/workbench/training",
  trainingTrainees: "/workbench/training/trainees",
  trainingSessions: "/workbench/training/sessions",
  trainingRegister: "/workbench/training/register",
  trainerCommercialEvaluations: "/workbench/training/trainer-evaluations",
  certifications: "/workbench/certifications",
  credentials: "/workbench/credentials",
  credentialsPersonnel: "/workbench/credentials/personnel/:staffMemberId",
  credentialsPersonnelPath: (staffMemberId: string) =>
    `/workbench/credentials/personnel/${encodeURIComponent(staffMemberId)}`,
  credentialCertificate:
    "/workbench/credentials/certificates/:issuanceId",
  credentialCertificatePath: (issuanceId: string) =>
    `/workbench/credentials/certificates/${encodeURIComponent(issuanceId)}`,
  credentialCertificateDevPreview:
    "/workbench/credentials/certificates/dev-preview",
  governanceQueue: "/workbench/governance/queue",
  oetsTemplate: "/workbench/oets/:templateCode",
  oetsTemplatePath: (templateCode: string) =>
    `/workbench/oets/${encodeURIComponent(templateCode)}`,
  evidenceRecord: "/workbench/evidence/:recordId",
  evidenceRecordPath: (recordId: string) =>
    `/workbench/evidence/${encodeURIComponent(recordId)}`
} as const;
