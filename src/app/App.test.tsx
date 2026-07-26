import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router-dom";

import { AppProviders } from "./providers/AppProviders";
import { routes } from "./routePaths";
import { AppShell } from "../ui/layout/AppShell";
import { NotFoundPage } from "./routes/NotFoundPage";
import { WorkbenchPage } from "./routes/WorkbenchPage";

function renderWithRoute(initialPath: string) {
  const testRouter = createMemoryRouter(
    [
      {
        path: routes.home,
        element: <AppShell />,
        children: [
          {
            index: true,
            element: <WorkbenchPage />
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
    ],
    {
      initialEntries: [initialPath]
    }
  );

  return render(
    <AppProviders>
      <RouterProvider router={testRouter} />
    </AppProviders>
  );
}

describe("Client Lens application foundation", () => {
  it("renders the application shell and brand treatment", () => {
    renderWithRoute(routes.workbench);

    expect(
      screen.getByRole("img", { name: "Client Lens by OGI Ltd." })
    ).toHaveAttribute("src", "/brand/client-lens-logo.png");
    expect(
      screen.getByRole("heading", { name: "Operational Governance Workbench" })
    ).toBeInTheDocument();
  });

  it("renders the primary navigation with a clear Phase 0 placeholder", () => {
    renderWithRoute(routes.workbench);

    expect(
      screen.getByRole("navigation", { name: "Primary navigation" })
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Workbench" })).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Operational Evidence/i })
    ).toHaveAttribute("aria-disabled", "true");
  });

  it("keeps unimplemented navigation placeholders on the current route", async () => {
    const user = userEvent.setup();
    renderWithRoute(routes.workbench);

    await user.click(screen.getByRole("link", { name: /Operational Evidence/i }));

    expect(
      screen.getByRole("heading", { name: "Operational Governance Workbench" })
    ).toBeInTheDocument();
  });

  it("renders a safe not-found experience for unknown routes", () => {
    renderWithRoute("/unknown-route");

    expect(
      screen.getByRole("heading", {
        name: "This workspace page is not available."
      })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Return to workbench" })
    ).toHaveAttribute("href", routes.workbench);
  });
});
