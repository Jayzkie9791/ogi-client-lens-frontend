import { NavLink } from "react-router-dom";

import { routes } from "../app/routePaths";
import { useAuth } from "../auth/useAuth";

export function RegistrationNavigation() {
  const auth = useAuth();
  const canViewClients = auth.canUsePermission("view_client");
  const canViewFacilities = auth.canUsePermission("view_facility");
  const canViewPersonnel = auth.canUsePermission("view_staff_member");

  return (
    <nav aria-label="Registration resource tabs">
      <ul className="flex flex-wrap gap-2">
        {canViewClients ? (
          <li>
            <NavLink className={childNavigationClassName} end to={routes.registrationClients}>
              Clients
            </NavLink>
          </li>
        ) : null}
        {canViewFacilities ? (
          <li>
            <NavLink className={childNavigationClassName} end to={routes.registrationFacilities}>
              Facilities
            </NavLink>
          </li>
        ) : null}
        {canViewPersonnel ? (
          <li>
            <NavLink className={childNavigationClassName} end to={routes.registrationPersonnel}>
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
    "cl-workspace-navigation-link",
    isActive ? "cl-workspace-navigation-link-active" : ""
  ].filter(Boolean).join(" ");
}
