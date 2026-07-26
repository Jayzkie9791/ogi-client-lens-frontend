import { createBrowserRouter, Navigate } from "react-router-dom";

import { AppShell } from "../ui/layout/AppShell";
import { NotFoundPage } from "./routes/NotFoundPage";
import { WorkbenchPage } from "./routes/WorkbenchPage";
import { routes } from "./routePaths";

export const router = createBrowserRouter([
  {
    path: routes.home,
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
        path: "*",
        element: <NotFoundPage />
      }
    ]
  }
]);
