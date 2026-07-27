import { createBrowserRouter, Navigate, RouteObject } from "react-router-dom";

import { PublicOnlyRoute, RequireAuth } from "../auth/AuthGuards";
import { AppShell } from "../ui/layout/AppShell";
import { LoginPage } from "./routes/LoginPage";
import { NotFoundPage } from "./routes/NotFoundPage";
import { WorkbenchPage } from "./routes/WorkbenchPage";
import { routes } from "./routePaths";
import { RuntimeTemplatePage } from "../oets/RuntimeTemplatePage";

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
            path: "workbench/oets/:templateCode",
            element: <RuntimeTemplatePage />
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
