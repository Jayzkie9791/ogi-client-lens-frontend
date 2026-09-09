import { createBrowserRouter, Navigate, RouteObject } from "react-router-dom";
import { lazy, ReactNode, Suspense } from "react";

import { PublicOnlyRoute, RequireAuth } from "../auth/AuthGuards";
import { AuditDetailPage } from "../audit-risk/AuditDetailPage";
import { AuditFindingDetailPage, AuditFindingsPage } from "../audit-risk/AuditFindingsPage";
import { AuditRiskWorkspacePage } from "../audit-risk/AuditRiskWorkspacePage";
import { RegistrationClientsPage } from "../registration/RegistrationClientsPage";
import { RegistrationFacilitiesPage } from "../registration/RegistrationFacilitiesPage";
import { RegistrationPersonnelPage } from "../registration/RegistrationPersonnelPage";
import { AppShell } from "../ui/layout/AppShell";
import { routes } from "./routePaths";
import { AdministrationPage } from "./routes/AdministrationPage";
import { ClientPocProvisioningPage } from "./routes/ClientPocProvisioningPage";
import { LoginPage } from "./routes/LoginPage";
import { ForgotPasswordPage, ResetPasswordPage } from "./routes/PasswordResetPages";
import { NotFoundPage } from "./routes/NotFoundPage";
import { OperationsPage } from "./routes/OperationsPage";
import { RecordsPage } from "./routes/RecordsPage";
import { WorkbenchPage } from "./routes/WorkbenchPage";

const AuditExecutionPage = lazy(() => import("../audit-risk/AuditExecutionPage").then((module) => ({ default: module.AuditExecutionPage })));
const GovernanceQueuePage = lazy(() => import("../oets/GovernanceQueuePage").then((module) => ({ default: module.GovernanceQueuePage })));
const OperationalEvidenceRecordPage = lazy(() => import("../oets/OperationalEvidenceRecordPage").then((module) => ({ default: module.OperationalEvidenceRecordPage })));
const RuntimeTemplatePage = lazy(() => import("../oets/RuntimeTemplatePage").then((module) => ({ default: module.RuntimeTemplatePage })));
const CertificationsPage = lazy(() => import("../certifications/CertificationsPage").then((module) => ({ default: module.CertificationsPage })));
const CredentialsDetailPage = lazy(() => import("../credentials/CredentialsPage").then((module) => ({ default: module.CredentialsDetailPage })));
const CredentialsListPage = lazy(() => import("../credentials/CredentialsPage").then((module) => ({ default: module.CredentialsListPage })));
const CertificateDevPreviewPage = lazy(() => import("../credentials/CertificatePage").then((module) => ({ default: module.CertificateDevPreviewPage })));
const CertificatePage = lazy(() => import("../credentials/CertificatePage").then((module) => ({ default: module.CertificatePage })));
const RegistrationTrainingPage = lazy(() => import("../training/RegistrationTrainingPage").then((module) => ({ default: module.RegistrationTrainingPage })));
const TrainerCommercialEvaluationPage = lazy(() => import("../training/TrainerCommercialEvaluationPage").then((module) => ({ default: module.TrainerCommercialEvaluationPage })));

function lazyRoute(element: ReactNode) {
  return <Suspense fallback={<p role="status">Loading workspace.</p>}>{element}</Suspense>;
}

export const appRoutes: RouteObject[] = [
  {
    element: <PublicOnlyRoute />,
    children: [
      {
        path: routes.login,
        element: <LoginPage />
      },
      {
        path: routes.forgotPassword,
        element: <ForgotPasswordPage />
      },
      {
        path: routes.resetPassword,
        element: <ResetPasswordPage />
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
            path: "workbench/audit-risk/audits/:auditId/execution",
            element: lazyRoute(<AuditExecutionPage />)
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
            element: <Navigate replace to={routes.trainingTrainees} />
          },
          {
            path: "workbench/registration/training/commercial-evaluations",
            element: <Navigate replace to={routes.trainerCommercialEvaluations} />
          },
          {
            path: "workbench/training",
            element: <Navigate replace to={routes.trainingTrainees} />
          },
          {
            path: "workbench/training/trainees",
            element: lazyRoute(<RegistrationTrainingPage workspace="trainees" />)
          },
          {
            path: "workbench/training/sessions",
            element: lazyRoute(<RegistrationTrainingPage workspace="sessions" />)
          },
          {
            path: "workbench/training/register",
            element: lazyRoute(<RegistrationTrainingPage workspace="register" />)
          },
          {
            path: "workbench/training/trainer-evaluations",
            element: lazyRoute(<TrainerCommercialEvaluationPage />)
          },
          {
            path: "workbench/certifications",
            element: lazyRoute(<CertificationsPage />)
          },
          {
            path: "workbench/credentials",
            element: lazyRoute(<CredentialsListPage />)
          },
          {
            path: "workbench/credentials/certificates/dev-preview",
            element: lazyRoute(<CertificateDevPreviewPage />)
          },
          {
            path: "workbench/credentials/certificates/:issuanceId",
            element: lazyRoute(<CertificatePage />)
          },
          {
            path: "workbench/credentials/personnel/:staffMemberId",
            element: lazyRoute(<CredentialsDetailPage />)
          },
          {
            path: "workbench/governance/queue",
            element: lazyRoute(<GovernanceQueuePage />)
          },
          {
            path: "workbench/oets/:templateCode",
            element: lazyRoute(<RuntimeTemplatePage />)
          },
          {
            path: "workbench/evidence/:recordId",
            element: lazyRoute(<OperationalEvidenceRecordPage />)
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
