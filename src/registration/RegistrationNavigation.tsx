import { NavLink } from "react-router-dom";

import { routes } from "../app/routePaths";
import { useAuth } from "../auth/useAuth";

export function RegistrationNavigation() {
  const auth = useAuth();
  const canRegisterClients = auth.canUsePermission("create_client");
  const canRegisterFacilities = auth.canUsePermission("create_facility");
  const canRegisterPersonnel = auth.canUsePermission("create_staff_member") || auth.canUsePermission("manage_personnel_operational_authorization");

  return (
    <nav aria-label="Registration resource tabs">
      <ul className="flex flex-wrap gap-2">
        {canRegisterClients ? (
          <li>
            <NavLink className={childNavigationClassName} end to={routes.registrationClients}>
              Register Client
            </NavLink>
          </li>
        ) : null}
        {canRegisterFacilities ? (
          <li>
            <NavLink className={childNavigationClassName} end to={routes.registrationFacilities}>
              Register Facility
            </NavLink>
          </li>
        ) : null}
        {canRegisterPersonnel ? (
          <li>
            <NavLink className={childNavigationClassName} end to={routes.registrationPersonnel}>
              Register Personnel
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
