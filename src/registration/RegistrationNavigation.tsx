import { NavLink } from "react-router-dom";

import { routes } from "../app/routePaths";
import { useAuth } from "../auth/useAuth";

export function RegistrationNavigation() {
  const auth = useAuth();
  const canViewClients = auth.canUsePermission("view_client");
  const canViewFacilities = auth.canUsePermission("view_facility");
  const canViewPersonnel = auth.canUsePermission("view_staff_member");

  return (
    <nav aria-label="Registration navigation">
      <ul className="flex flex-wrap gap-2">
        {canViewClients ? (
          <li>
            <NavLink className={childNavigationClassName} end to={routes.registrationClients}>
              Clients / Organizations
            </NavLink>
          </li>
        ) : null}
        {canViewFacilities ? (
          <li>
            <NavLink className={childNavigationClassName} to={routes.registrationFacilities}>
              Facilities
            </NavLink>
          </li>
        ) : null}
        {canViewPersonnel ? (
          <li>
            <NavLink className={childNavigationClassName} to={routes.registrationPersonnel}>
              Personnel
            </NavLink>
          </li>
        ) : null}
      </ul>
    </nav>
  );
}

function childNavigationClassName({ isActive }: { isActive: boolean }) {
  return [
    "inline-flex min-h-10 items-center rounded-component px-3 text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-canvas",
    isActive
      ? "bg-primary-navy text-text-inverse"
      : "border border-border bg-surface text-text-primary hover:bg-elevated"
  ].join(" ");
}
