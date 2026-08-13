import { createBrowserRouter, Navigate, RouteObject } from "react-router-dom";

import { PublicOnlyRoute, RequireAuth } from "../auth/AuthGuards";
import { GovernanceQueuePage } from "../oets/GovernanceQueuePage";
import { OperationalEvidenceRecordPage } from "../oets/OperationalEvidenceRecordPage";
import { RuntimeTemplatePage } from "../oets/RuntimeTemplatePage";
import { RegistrationClientsPage } from "../registration/RegistrationClientsPage";
import { RegistrationFacilitiesPage } from "../registration/RegistrationFacilitiesPage";
import { RegistrationPersonnelPage } from "../registration/RegistrationPersonnelPage";
import { AppShell } from "../ui/layout/AppShell";
import { routes } from "./routePaths";
import { AdministrationPage } from "./routes/AdministrationPage";
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
