import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";

import { routes } from "../../app/routePaths";
import { PermissionGate } from "../../auth/PermissionGate";
import { useAuth } from "../../auth/useAuth";

const navigationItems = [
  {
    label: "Overview",
    to: routes.workbench,
    implemented: true
  },
  {
    label: "Operations",
    permission: "view_operational_evidence",
    to: routes.operations,
    implemented: true
  },
  {
    label: "Reviews",
    permission: "view_operational_evidence",
    to: routes.governanceQueue,
    implemented: true
  },
  {
    label: "Registration",
    permission: "view_client",
    to: routes.registrationClients,
    implemented: true
  },
  {
    label: "Administration",
    permission: "view_users",
    to: routes.administration,
    implemented: true
  }
] as const;

export function AppShell() {
  const auth = useAuth();
  const [navigationOpen, setNavigationOpen] = useState(false);

  return (
    <div className="min-h-screen bg-canvas text-text-primary">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div className="flex items-center justify-between gap-4">
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
            <button
              aria-controls="primary-navigation"
              aria-expanded={navigationOpen}
              className="inline-flex min-h-10 items-center rounded-component border border-border px-3 text-sm font-semibold text-text-primary outline-none hover:bg-elevated focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-surface lg:hidden"
              onClick={() => setNavigationOpen((current) => !current)}
              type="button"
            >
              Menu
            </button>
          </div>

          <div className="flex flex-col gap-3 lg:items-end">
            <nav
              aria-label="Primary navigation"
              className={navigationOpen ? "block" : "hidden lg:block"}
              id="primary-navigation"
            >
              <ul className="flex flex-wrap gap-2">
                {navigationItems.map((item) => {
                  if ("permission" in item) {
                    return (
                      <PermissionGate
                        key={item.label}
                        permission={item.permission}
                      >
                        <NavigationListItem item={item} />
                      </PermissionGate>
                    );
                  }

                  return <NavigationListItem item={item} key={item.label} />;
                })}
              </ul>
            </nav>

            <div className="flex flex-wrap items-center gap-3 text-sm text-text-muted">
              <span>
                {auth.session?.fullName}
                <span className="ml-2 text-xs text-text-muted">
                  {auth.session?.email}
                </span>
              </span>
              <button
                className="rounded-component border border-border px-3 py-1.5 font-semibold text-text-primary outline-none hover:bg-elevated focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
                onClick={auth.logout}
                type="button"
              >
                Log out
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <Outlet />
      </main>
    </div>
  );
}

type NavigationItem = (typeof navigationItems)[number];

function NavigationListItem({ item }: { item: NavigationItem }) {
  return (
    <li>
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
        end={item.to === routes.workbench}
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
  );
}