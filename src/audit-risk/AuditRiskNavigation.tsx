import { NavLink } from "react-router-dom";

import { routes } from "../app/routePaths";
import { useCan } from "../auth/useCan";

export function AuditRiskNavigation() {
  const canViewAudits = useCan("view_audit");
  const canViewFindings = useCan("view_finding");

  return (
    <nav aria-label="Audit & Risk workspace">
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
      <NavLink className={({ isActive }) => `inline-flex min-h-10 items-center rounded-component px-3 text-sm font-semibold ${isActive ? "bg-primary-navy text-text-inverse" : "border border-border text-text-primary hover:bg-elevated"}`} end to={to}>{label}</NavLink>
    </li>
  );
}
