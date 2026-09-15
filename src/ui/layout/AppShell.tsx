import { FocusEvent, ReactNode, useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";

import { routes } from "../../app/routePaths";
import { useAuth } from "../../auth/useAuth";

interface SidebarItem { label: string; to: string; permission?: string; end?: boolean }
interface SidebarGroup { label: string; items: SidebarItem[] }

const sidebarPreferenceKey = "client-lens:sidebar-collapsed";

export function AppShell() {
  const auth = useAuth();
  const location = useLocation();
  const [navigationOpen, setNavigationOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => window.localStorage.getItem(sidebarPreferenceKey) === "true");
  const groups: SidebarGroup[] = [
    { label: "Workspace", items: [{ label: "Overview", to: routes.workbench, end: true }] },
    { label: "Registration", items: [
      { label: "Register Client", to: routes.registrationClients, permission: "create_client" }, { label: "Register Facility", to: routes.registrationFacilities, permission: "create_facility" }, { label: "Register Personnel", to: routes.registrationPersonnel, permission: personnelRegistrationPermission(auth) }
    ] },
    { label: "Organizations", items: [
      { label: "Client Masterlist", to: routes.clientMasterlist, permission: "view_client" }, { label: "Facility Masterlist", to: routes.facilityMasterlist, permission: "view_facility" }
    ] },
    { label: "Workforce", items: [
      { label: "Personnel Masterlist", to: routes.personnelMasterlist, permission: "view_staff_member" }
    ] },
    { label: "Training", items: [
      { label: "Request Training", to: routes.trainingRequests, permission: "view_training_request" }, { label: "Trainee Reconciliation", to: routes.trainingTrainees, permission: "view_training" }, { label: "Training Sessions", to: routes.trainingSessions, permission: "view_training" }, { label: "Register Training", to: routes.trainingRegister, permission: "create_training_enrollment" }, { label: "Training Journeys", to: routes.trainingJourneys, permission: "view_training" }, { label: "Trainer Evaluations", to: routes.trainerCommercialEvaluations, permission: "record_training_assessment" }
    ] },
    { label: "Assessment", items: [
      { label: "Facility Assessment Journeys", to: routes.facilityAssessmentJourneys, permission: "view_domain_assessment" }
    ] },
    { label: "Credentials", items: [
      { label: "Certifications", to: routes.certifications, permission: "view_certification" }, { label: "Credentials", to: routes.credentials, permission: "view_staff_member" }
    ] },
    { label: "Governance", items: [
      { label: "Auditor Appointments", to: routes.auditorAppointments, permission: appointmentPermission(auth) }, { label: "Operations", to: routes.operations, permission: "view_operational_evidence", end: true }, { label: "Reviews", to: routes.governanceQueue, permission: "view_operational_evidence" }, { label: "Audit & Risk", to: auditRiskLandingPath(auth), permission: auditRiskPermission(auth) }, { label: "Evidence Records", to: routes.records, permission: "view_operational_evidence" }, { label: "My Drafts", to: routes.myDrafts, permission: "view_operational_evidence" }
    ] },
    { label: "System", items: [{ label: "Administration", to: routes.administration, permission: administrationPermission(auth) }] }
  ];
  const visibleGroups = groups.map((group) => ({ ...group, items: group.items.filter((item) => !item.permission || auth.canUsePermission(item.permission)) })).filter((group) => group.items.length > 0);
  const activeGroup = activeGroupForPath(location.pathname, visibleGroups);
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const [previewGroup, setPreviewGroup] = useState<string | null>(null);

  useEffect(() => { setExpandedGroup(null); setPreviewGroup(null); }, [location.pathname]);
  useEffect(() => { window.localStorage.setItem(sidebarPreferenceKey, String(collapsed)); }, [collapsed]);

  function closeNavigation() { setNavigationOpen(false); setPreviewGroup(null); setExpandedGroup(null); }

  return <div className="flex min-h-screen bg-canvas text-text-primary">
    {navigationOpen ? <button aria-label="Close navigation" className="fixed inset-0 z-40 bg-primary-navy/45 lg:hidden" onClick={closeNavigation} type="button" /> : null}
    <aside className={["fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-border bg-surface shadow-xl transition-[transform,width] duration-200 lg:sticky lg:top-0 lg:h-screen lg:self-start lg:translate-x-0 lg:shadow-none", navigationOpen ? "translate-x-0" : "-translate-x-full", collapsed ? "lg:w-20" : "lg:w-72"].join(" ")} id="primary-navigation">
      <div className="flex min-h-24 shrink-0 items-center justify-between gap-3 border-b border-border px-4">
        <NavLink aria-label="Client Lens overview" className="min-w-0" onClick={closeNavigation} to={routes.workbench}><img alt="Client Lens by OGI Ltd." className={collapsed ? "h-16 w-auto lg:h-10 lg:w-10 lg:object-cover lg:object-left" : "h-16 w-auto"} src="/brand/client-lens-logo.png" /></NavLink>
        <button aria-label="Close navigation" className="rounded-component p-2 text-xl text-text-muted hover:bg-elevated lg:hidden" onClick={closeNavigation} type="button">×</button>
      </div>
      <nav aria-label="Primary navigation" className="min-h-0 flex-1 overflow-y-auto px-3 py-4 lg:overflow-visible">
        <div className="space-y-2">{visibleGroups.map((group) => {
          const isActiveGroup = group.label === activeGroup;
          const isOpen = group.label === (previewGroup ?? expandedGroup);
          const opensUpward = group.label === "Governance" || group.label === "System";
          const panelId = `sidebar-group-${group.label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
          return <section className="relative" key={group.label} onBlur={(event) => closePreviewAfterFocusLeaves(event, () => setPreviewGroup(null))} onFocus={() => setPreviewGroup(group.label)} onMouseEnter={() => setPreviewGroup(group.label)} onMouseLeave={() => setPreviewGroup(null)}>
            <button aria-controls={panelId} aria-expanded={isOpen} className={["relative flex min-h-12 w-full items-center gap-3 rounded-component border-l-4 px-3 text-left text-sm font-bold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-focus", isActiveGroup || isOpen ? "border-sidebar-active bg-sidebar-active-bg text-sidebar-active" : "border-transparent text-sidebar-parent hover:bg-sidebar-parent-active", collapsed ? "lg:justify-center lg:px-2" : ""].join(" ")} onClick={() => { setPreviewGroup(null); setExpandedGroup((current) => current === group.label ? null : group.label); }} title={collapsed ? group.label : undefined} type="button">
              <span className={isActiveGroup ? "rounded-component bg-white/80" : ""}><GroupIcon group={group.label} /></span><span className={collapsed ? "lg:sr-only" : ""}>{group.label}</span><Chevron className={["ml-auto transition-transform", isOpen ? "rotate-180" : "", collapsed ? "lg:hidden" : ""].join(" ")} />
              {isActiveGroup && collapsed ? <span aria-hidden="true" className="absolute right-1 hidden h-2 w-2 rounded-full bg-primary-blue lg:block" /> : null}
            </button>
            {isOpen ? <div className={["mt-1 bg-[var(--cl-sidebar-flyout-bg)] lg:absolute lg:left-full lg:z-50 lg:mt-0 lg:max-h-[calc(100vh-2rem)] lg:w-[16.5rem] lg:overflow-y-auto lg:rounded-panel lg:border lg:border-[var(--cl-sidebar-flyout-border)] lg:p-3 lg:shadow-xl", opensUpward ? "lg:bottom-0" : "lg:top-0"].join(" ")} id={panelId}>
              <p className="mb-2 hidden px-3 text-xs font-bold uppercase tracking-wide text-sidebar-parent lg:block">{group.label}</p>
              <ul className="space-y-1.5 border-l border-sidebar-child-rail pl-3">{group.items.map((item) => <li key={`${group.label}:${item.to}:${item.label}`}><NavLink className={({ isActive }) => ["flex min-h-10 items-center gap-3 rounded-component border border-primary-navy bg-primary-navy px-3 text-[0.8125rem] text-text-inverse shadow-sm outline-none transition-colors hover:border-primary-blue hover:bg-primary-blue focus-visible:border-primary-blue focus-visible:bg-primary-blue focus-visible:ring-2 focus-visible:ring-focus", isActive ? "font-bold ring-2 ring-primary-blue/30" : "font-medium"].join(" ")} end={item.end} onClick={closeNavigation} to={item.to}><span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" /><span>{item.label}</span></NavLink></li>)}</ul>
            </div> : null}
          </section>;
        })}</div>
      </nav>
      <button aria-label={collapsed ? "Expand navigation" : "Collapse navigation"} className="hidden min-h-12 shrink-0 border-t border-border px-4 text-sm font-semibold text-text-muted hover:bg-elevated hover:text-text-primary lg:block" onClick={() => setCollapsed((current) => !current)} type="button">{collapsed ? "→" : "← Collapse"}</button>
    </aside>
    <div className="min-w-0 flex-1"><header className="border-b border-border bg-surface"><div className="flex min-h-24 items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
      <button aria-controls="primary-navigation" aria-expanded={navigationOpen} aria-label="Menu" className="inline-flex h-11 w-11 items-center justify-center rounded-component border border-border text-xl text-primary-navy hover:bg-elevated lg:hidden" onClick={() => setNavigationOpen(true)} type="button">☰</button>
      <div className="ml-auto flex flex-wrap items-center justify-end gap-3 text-sm text-text-muted"><span className="text-right"><span className="font-medium text-text-primary">{auth.session?.fullName}</span><span className="ml-2 hidden text-xs sm:inline">{sessionIdentityLabel(auth.session)}</span></span><button className="rounded-component border border-border px-3 py-1.5 font-semibold text-text-primary hover:bg-elevated" onClick={auth.logout} type="button">Log out</button></div>
    </div></header><main className="mx-auto w-full max-w-[100rem] px-4 py-6 sm:px-6 lg:px-8"><Outlet /></main></div>
  </div>;
}

function activeGroupForPath(pathname: string, groups: SidebarGroup[]) {
  if (pathname === routes.workbench) return "Workspace";
  const group = groups.find((candidate) => candidate.items.some((item) => pathname === item.to || pathname.startsWith(`${item.to}/`)));
  if (group) return group.label;
  if (pathname.startsWith("/workbench/evidence/") || pathname.startsWith("/workbench/oets/")) return "Governance";
  return null;
}
function closePreviewAfterFocusLeaves(event: FocusEvent<HTMLElement>, close: () => void) {
  if (!(event.relatedTarget instanceof Node) || !event.currentTarget.contains(event.relatedTarget)) close();
}
function GroupIcon({ group }: { group: string }) {
  const paths: Record<string, ReactNode> = {
    Workspace: <><rect height="6" rx="1" width="6" x="3" y="3" /><rect height="6" rx="1" width="6" x="15" y="3" /><rect height="6" rx="1" width="6" x="3" y="15" /><rect height="6" rx="1" width="6" x="15" y="15" /></>,
    Registration: <><path d="M8 7h13M8 12h13M8 17h8" /><path d="m3.5 7 .8.8L6 6M3.5 12l.8.8L6 11M3.5 17l.8.8L6 16" /></>,
    Workforce: <><circle cx="12" cy="8" r="4" /><path d="M4 21c.8-4.4 3.5-7 8-7s7.2 2.6 8 7" /></>,
    Organizations: <><path d="M4 21V5h10v16M14 9h6v12M7 9h4M7 13h4M7 17h4M17 13h1M17 17h1" /></>,
    Training: <><path d="m3 10 9-5 9 5-9 5-9-5Z" /><path d="M7 12.5V17c3 2 7 2 10 0v-4.5M21 10v6" /></>,
    Assessment: <><path d="M5 3h14v18H5z" /><path d="m8 8 1.5 1.5L12 7M13 9h3M8 14l1.5 1.5L12 13M13 15h3" /></>,
    Credentials: <><circle cx="12" cy="9" r="6" /><path d="m8.5 14-1 7 4.5-2 4.5 2-1-7" /></>,
    Governance: <><path d="M12 3 4 6v5c0 5 3.4 8.5 8 10 4.6-1.5 8-5 8-10V6l-8-3Z" /><path d="m9 12 2 2 4-5" /></>,
    System: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.6v-.2h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z" /></>
  };
  return <span aria-hidden="true" className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-component border border-current/20"><svg className="h-5 w-5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" viewBox="0 0 24 24">{paths[group]}</svg></span>;
}
function Chevron({ className }: { className: string }) { return <svg aria-hidden="true" className={`h-4 w-4 shrink-0 ${className}`} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="m6 9 6 6 6-6" /></svg>; }
function sessionIdentityLabel(session: ReturnType<typeof useAuth>["session"]) { return session?.email ?? session?.username ?? ""; }
function auditRiskLandingPath(auth: ReturnType<typeof useAuth>) { return auth.canUsePermission("view_audit") ? routes.auditRisk : routes.auditFindings; }
function auditRiskPermission(auth: ReturnType<typeof useAuth>) { return auth.canUsePermission("view_audit") ? "view_audit" : "view_finding"; }
function administrationPermission(auth: ReturnType<typeof useAuth>) { return auth.canUsePermission("view_users") ? "view_users" : "create_user"; }
function personnelRegistrationPermission(auth: ReturnType<typeof useAuth>) { return auth.canUsePermission("create_staff_member") ? "create_staff_member" : "manage_personnel_operational_authorization"; }
function appointmentPermission(auth: ReturnType<typeof useAuth>) { return auth.canUsePermission("view_audit_appointment") ? "view_audit_appointment" : auditRiskPermission(auth); }
