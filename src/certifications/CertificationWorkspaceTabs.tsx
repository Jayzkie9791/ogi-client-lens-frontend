import { NavLink } from "react-router-dom";

import { routes } from "../app/routePaths";
import { useAuth } from "../auth/useAuth";

export function CertificationWorkspaceTabs() {
  const auth = useAuth();
  const canViewCertifications = auth.canUsePermission("view_certification");
  const canViewCredentials = auth.canUsePermission("view_staff_member");

  return (
    <nav aria-label="Credentials and certifications sections">
      <ul className="flex flex-wrap gap-2 border-b border-border pb-3">
        {canViewCertifications ? (
          <li>
            <WorkspaceTab label="Certifications" to={routes.certifications} />
          </li>
        ) : null}
        {canViewCredentials ? (
          <li>
            <WorkspaceTab label="Credentials" to={routes.credentials} />
          </li>
        ) : null}
      </ul>
    </nav>
  );
}

function WorkspaceTab({ label, to }: { label: string; to: string }) {
  return (
    <NavLink
      className={({ isActive }) =>
        [
          "inline-flex min-h-10 items-center rounded-component px-3 text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-canvas",
          isActive
            ? "bg-primary-navy text-text-inverse"
            : "text-text-muted hover:bg-elevated hover:text-text-primary"
        ].join(" ")
      }
      to={to}
    >
      {label}
    </NavLink>
  );
}
