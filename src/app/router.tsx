import { createBrowserRouter, Navigate, RouteObject } from "react-router-dom";

import { PublicOnlyRoute, RequireAuth } from "../auth/AuthGuards";
import { AuditDetailPage } from "../audit-risk/AuditDetailPage";
import { AuditFindingDetailPage, AuditFindingsPage } from "../audit-risk/AuditFindingsPage";
import { AuditRiskWorkspacePage } from "../audit-risk/AuditRiskWorkspacePage";
import { CertificationsPage } from "../certifications/CertificationsPage";
import {
  CredentialsDetailPage,
  CredentialsListPage
} from "../credentials/CredentialsPage";
import {
  CertificateDevPreviewPage,
  CertificatePage
} from "../credentials/CertificatePage";
import { GovernanceQueuePage } from "../oets/GovernanceQueuePage";
import { OperationalEvidenceRecordPage } from "../oets/OperationalEvidenceRecordPage";
import { RuntimeTemplatePage } from "../oets/RuntimeTemplatePage";
import { RegistrationClientsPage } from "../registration/RegistrationClientsPage";
import { RegistrationFacilitiesPage } from "../registration/RegistrationFacilitiesPage";
import { RegistrationPersonnelPage } from "../registration/RegistrationPersonnelPage";
import { RegistrationTrainingPage } from "../training/RegistrationTrainingPage";
import { AppShell } from "../ui/layout/AppShell";
import { routes } from "./routePaths";
import { AdministrationPage } from "./routes/AdministrationPage";
import { ClientPocProvisioningPage } from "./routes/ClientPocProvisioningPage";
import { LoginPage } from "./routes/LoginPage";
import { NotFoundPage } from "./routes/NotFoundPage";
import { OperationsPage } from "./routes/OperationsPage";
import { RecordsPage } from "./routes/RecordsPage";
import { WorkbenchPage } from "./routes/WorkbenchPage";

export const appRoutes: RouteObject[] = [
  {
    element: <PublicOnlyRoute />,
    children: [
      {
        path: routes.login,
        element: <LoginPage />
      }
    ]
  },
  {
    path: routes.home,
    element: <RequireAuth />,
    children: [
      {
        element: <AppShell />,
        children: [
          {
            index: true,
            element: <Navigate to={routes.workbench} replace />
          },
          {
            path: "workbench",
            element: <WorkbenchPage />
          },
          {
            path: "workbench/audit-risk",
            element: <AuditRiskWorkspacePage />
          },
          {
            path: "workbench/audit-risk/audits/:auditId",
            element: <AuditDetailPage />
          },
          {
            path: "workbench/audit-risk/findings",
            element: <AuditFindingsPage />
          },
          {
            path: "workbench/audit-risk/findings/:findingId",
            element: <AuditFindingDetailPage />
          },
          {
            path: "workbench/operations",
            element: <OperationsPage />
          },
          {
            path: "workbench/operations/records",
            element: <RecordsPage />
          },
          {
            path: "workbench/administration",
            element: <AdministrationPage />
          },
          {
            path: "workbench/administration/client-pocs",
            element: <ClientPocProvisioningPage />
          },
          {
            path: "workbench/registration/clients",
            element: <RegistrationClientsPage />
          },
          {
            path: "workbench/registration/facilities",
            element: <RegistrationFacilitiesPage />
          },
          {
            path: "workbench/registration/personnel",
            element: <RegistrationPersonnelPage />
          },
          {
            path: "workbench/registration/training",
            element: <RegistrationTrainingPage />
          },
          {
            path: "workbench/certifications",
            element: <CertificationsPage />
          },
          {
            path: "workbench/credentials",
            element: <CredentialsListPage />
          },
          {
            path: "workbench/credentials/certificates/dev-preview",
            element: <CertificateDevPreviewPage />
          },
          {
            path: "workbench/credentials/certificates/:issuanceId",
            element: <CertificatePage />
          },
          {
            path: "workbench/credentials/personnel/:staffMemberId",
            element: <CredentialsDetailPage />
          },
          {
            path: "workbench/governance/queue",
            element: <GovernanceQueuePage />
          },
          {
            path: "workbench/oets/:templateCode",
            element: <RuntimeTemplatePage />
          },
          {
            path: "workbench/evidence/:recordId",
            element: <OperationalEvidenceRecordPage />
          },
          {
            path: "*",
            element: <NotFoundPage />
          }
        ]
      }
    ]
  }
];

export const router = createBrowserRouter(appRoutes);
