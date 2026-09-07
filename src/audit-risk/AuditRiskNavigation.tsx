import { NavLink } from "react-router-dom";

import { routes } from "../app/routePaths";
import { useCan } from "../auth/useCan";

export function AuditRiskNavigation() {
  const canViewAudits = useCan("view_audit");
  const canViewFindings = useCan("view_finding");

  return (
    <nav aria-label="Audit & Risk workspace" className="rounded-panel border border-blue-100 bg-blue-50/60 p-2">
      <ul className="flex flex-wrap gap-2">
        {canViewAudits ? <WorkspaceLink label="Audits" to={routes.auditRisk} /> : null}
        {canViewFindings ? <WorkspaceLink label="Findings" to={routes.auditFindings} /> : null}
      </ul>
    </nav>
  );
}

function WorkspaceLink({ label, to }: { label: string; to: string }) {
  return (
    <li>
      <NavLink className={({ isActive }) => `inline-flex min-h-10 items-center rounded-component px-3 text-sm font-semibold outline-none transition focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-blue-50 ${isActive ? "bg-primary-navy text-text-inverse shadow-sm" : "border border-transparent text-text-primary hover:border-blue-200 hover:bg-white"}`} end to={to}>{label}</NavLink>
    </li>
  );
}
