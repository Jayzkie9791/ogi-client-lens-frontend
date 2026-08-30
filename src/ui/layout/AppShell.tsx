import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";

import { routes } from "../../app/routePaths";
import { useAuth } from "../../auth/useAuth";

const navigationItems = [
  {
    label: "Overview",
    to: routes.workbench,
    implemented: true
  },
  {
    label: "Operations",
    permissions: ["view_operational_evidence"],
    to: routes.operations,
    implemented: true
  },
  {
    label: "Reviews",
    permissions: ["view_operational_evidence"],
    to: routes.governanceQueue,
    implemented: true
  },
  {
    label: "Audit & Risk",
    permissions: ["view_audit"],
    to: routes.auditRisk,
    implemented: true
  },
  {
    label: "Registration",
    permissions: ["view_client", "view_facility", "view_staff_member", "view_training"],
    to: routes.registrationClients,
    implemented: true
  },
  {
    label: "Credentials & Certifications",
    permissions: ["view_staff_member", "view_certification"],
    to: routes.certifications,
    implemented: true
  },
  {
    label: "Administration",
    permissions: ["view_users", "create_user"],
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
                  if (
                    "permissions" in item &&
                    !item.permissions.some((permission) =>
                      auth.canUsePermission(permission)
                    )
                  ) {
                    return null;
                  }

                  const navigationItem =
                    item.label === "Registration"
                      ? { ...item, to: registrationLandingPath(auth) }
                      : item.label === "Credentials & Certifications"
                        ? { ...item, to: credentialsLandingPath(auth) }
                        : item;

                  return <NavigationListItem item={navigationItem} key={item.label} />;
                })}
              </ul>
            </nav>

            <div className="flex flex-wrap items-center gap-3 text-sm text-text-muted">
              <span>
                {auth.session?.fullName}
                <span className="ml-2 text-xs text-text-muted">
                  {sessionIdentityLabel(auth.session)}
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

type NavigationItem = {
  readonly label: string;
  readonly to: string;
  readonly implemented: boolean;
};

function sessionIdentityLabel(
  session: ReturnType<typeof useAuth>["session"]
) {
  return session?.email ?? session?.username ?? "";
}
function credentialsLandingPath(auth: ReturnType<typeof useAuth>) {
  if (auth.canUsePermission("view_certification")) {
    return routes.certifications;
  }

  return routes.credentials;
}

function registrationLandingPath(auth: ReturnType<typeof useAuth>) {
  if (auth.canUsePermission("view_client")) {
    return routes.registrationClients;
  }

  if (auth.canUsePermission("view_facility")) {
    return routes.registrationFacilities;
  }

  if (auth.canUsePermission("view_staff_member")) {
    return routes.registrationPersonnel;
  }

  return routes.registrationTraining;
}

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
