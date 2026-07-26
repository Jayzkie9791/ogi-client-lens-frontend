import { NavLink, Outlet } from "react-router-dom";

import { routes } from "../../app/routePaths";

const navigationItems = [
  {
    label: "Workbench",
    to: routes.workbench,
    implemented: true
  },
  {
    label: "Operational Evidence",
    to: routes.workbench,
    implemented: false
  }
] as const;

export function AppShell() {
  return (
    <div className="min-h-screen bg-canvas text-text-primary">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <a
            aria-label="Client Lens by OGI Ltd."
            className="inline-flex rounded-component outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
            href={routes.workbench}
          >
            <img
              alt="Client Lens by OGI Ltd."
              className="h-12 w-auto object-contain sm:h-14"
              src="/brand/client-lens-logo.png"
            />
          </a>

          <nav aria-label="Primary navigation">
            <ul className="flex flex-wrap gap-2">
              {navigationItems.map((item) => (
                <li key={item.label}>
                  <NavLink
                    aria-disabled={!item.implemented}
                    className={({ isActive }) =>
                      [
                        "inline-flex min-h-10 items-center rounded-component px-3 text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
                        isActive && item.implemented
                          ? "bg-primary-navy text-text-inverse"
                          : "text-text-muted hover:bg-elevated hover:text-text-primary",
                        !item.implemented ? "cursor-not-allowed opacity-70" : ""
                      ]
                        .filter(Boolean)
                        .join(" ")
                    }
                    onClick={(event) => {
                      if (!item.implemented) {
                        event.preventDefault();
                      }
                    }}
                    to={item.to}
                  >
                    {item.label}
                    {!item.implemented ? (
                      <span className="ml-2 rounded-component border border-border px-1.5 py-0.5 text-[0.6875rem] font-semibold uppercase tracking-wide text-text-muted">
                        Later
                      </span>
                    ) : null}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <Outlet />
      </main>
    </div>
  );
}
