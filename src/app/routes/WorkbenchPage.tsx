import { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { routes } from "../routePaths";
import { AuthenticatedSession } from "../../auth/types";
import { useAuth } from "../../auth/useAuth";
import { listGovernanceQueue } from "../../oets/governanceApi";
import { listOperationalEvidenceRecords } from "../../oets/recordsApi";
import { listRecentTrainingRegistrations, TrainingEnrollment } from "../../training/trainingApi";
import { Button } from "../../ui/components/Button";
import { Surface } from "../../ui/components/Surface";
import { WorkspaceShell } from "../../ui/components/WorkspaceShell";

interface OverviewAction {
  description: string;
  label: string;
  permissions: string[];
  to: string;
}

interface OverviewGroup {
  description: string;
  eyebrow: string;
  actions: OverviewAction[];
  tone: OverviewTone;
}

type OverviewTone = "teal" | "blue" | "amber" | "indigo";

const overviewGroups: OverviewGroup[] = [
  {
    eyebrow: "Start here",
    tone: "teal",
    description: "Create a new organization, facility, or personnel record.",
    actions: [
      { label: "Request Training", description: "Ask OGI to arrange training for your team.", to: routes.trainingRequests, permissions: ["view_training_request"] },
      { label: "Register Client", description: "Add a client organization.", to: routes.registrationClients, permissions: ["create_client"] },
      { label: "Register Facility", description: "Add a facility under an authorized client.", to: routes.registrationFacilities, permissions: ["create_facility"] },
      { label: "Register Personnel", description: "Add a person before training or employment workflows begin.", to: routes.registrationPersonnel, permissions: ["create_staff_member", "manage_personnel_operational_authorization"] }
    ]
  },
  {
    eyebrow: "Manage records",
    tone: "blue",
    description: "Review the current organizational and workforce masterlists.",
    actions: [
      { label: "Client Masterlist", description: "Review registered client organizations.", to: routes.clientMasterlist, permissions: ["view_client"] },
      { label: "Facility Masterlist", description: "Review facilities and their organizational context.", to: routes.facilityMasterlist, permissions: ["view_facility"] },
      { label: "Personnel Masterlist", description: "Review employment profiles, training history, and credentials.", to: routes.personnelMasterlist, permissions: ["view_staff_member"] }
    ]
  },
  {
    eyebrow: "Deliver training",
    tone: "amber",
    description: "Move authorized personnel through enrollment, evidence, and evaluation.",
    actions: [
      { label: "Register Training", description: "Create a governed program enrollment.", to: routes.trainingRegister, permissions: ["create_training_enrollment"] },
      { label: "Training Sessions", description: "Manage sessions and attendance context.", to: routes.trainingSessions, permissions: ["view_training"] },
      { label: "Training Journeys", description: "Follow each trainee through the required evidence route.", to: routes.trainingJourneys, permissions: ["view_training"] },
      { label: "Trainer Evaluations", description: "Record authorized training assessments.", to: routes.trainerCommercialEvaluations, permissions: ["record_training_assessment"] }
    ]
  },
  {
    eyebrow: "Review and issue",
    tone: "indigo",
    description: "Complete governance review and manage approved credentials.",
    actions: [
      { label: "Governance Reviews", description: "Review governed evidence awaiting an authorized decision.", to: routes.governanceQueue, permissions: ["view_operational_evidence"] },
      { label: "Certifications", description: "Evaluate readiness and complete credential issuance.", to: routes.certifications, permissions: ["view_certification"] },
      { label: "Credentials", description: "Review issued digital credentials by personnel.", to: routes.credentials, permissions: ["view_staff_member"] },
      { label: "Audit & Risk", description: "Review audit execution, findings, and risk records.", to: routes.auditRisk, permissions: ["view_audit", "view_finding"] }
    ]
  }
];

const lifecycle: ReadonlyArray<readonly [string, string, string, OverviewTone]> = [
  ["1", "Register", "Establish the client, facility, and personnel records.", "teal"],
  ["2", "Enroll", "Assign the person to the correct governed training program.", "blue"],
  ["3", "Train & evaluate", "Capture attendance, assessments, and required evidence.", "amber"],
  ["4", "Review & approve", "Independent authorized reviewers make governed decisions.", "indigo"],
  ["5", "Issue & monitor", "Issue the credential and retain its auditable history.", "teal"]
] as const;

export function WorkbenchPage() {
  const auth = useAuth();
  const session = auth.session;
  const visibleGroups = overviewGroups
    .map((group) => ({
      ...group,
      actions: group.actions
        .filter((action) => action.permissions.some(auth.canUsePermission))
        .map((action) =>
          action.label === "Audit & Risk" && !auth.canUsePermission("view_audit")
            ? { ...action, to: routes.auditFindings }
            : action
        )
    }))
    .filter((group) => group.actions.length > 0);

  return (
    <WorkspaceShell
      description="Understand your authorized scope, choose the right workflow, and follow each record through its governed lifecycle."
      headingId="overview"
      navigation={null}
      sectionDescription=""
      sectionTitle=""
      showSectionHeader={false}
      title={`Welcome${session?.fullName ? `, ${session.fullName}` : ""}`}
    >
      <div className="space-y-5">
        {session ? <AuthorizationContext session={session} /> : null}

        <ContinueYourWork />

        <section aria-labelledby="authorized-actions-heading">
          <SectionHeading description="Only actions allowed by your current account and organizational scope are shown." id="authorized-actions-heading" title="What would you like to do?" />
          {visibleGroups.length ? (
            <div className="mt-4 grid gap-4 xl:grid-cols-2">
              {visibleGroups.map((group) => (
                <Surface className={`cl-overview-group ${toneClass(group.tone)}`} key={group.eyebrow}>
                  <p className="cl-overview-group-label"><span aria-hidden="true" className="cl-overview-group-dot" />{group.eyebrow}</p>
                  <p className="mt-2 text-sm leading-6 text-text-muted">{group.description}</p>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {group.actions.map((action) => <ActionCard action={action} key={action.label} tone={group.tone} />)}
                  </div>
                </Surface>
              ))}
            </div>
          ) : (
            <Surface className="mt-4 border-workspace-border">
              <p className="text-sm text-text-muted">No operational actions are available within your current authorization. Contact an administrator if your work scope appears incomplete.</p>
            </Surface>
          )}
        </section>

        <section aria-labelledby="lifecycle-heading">
          <SectionHeading description="Client Lens separates registration, operational work, governance, and issuance so each decision remains traceable." id="lifecycle-heading" title="How work moves through Client Lens" />
          <ol className="mt-4 grid gap-3 md:grid-cols-5">
            {lifecycle.map(([number, title, description, tone], index) => (
              <li className={`cl-overview-lifecycle ${toneClass(tone)}`} key={number}>
                <span className="cl-overview-step-number">{number}</span>
                <h3 className="mt-3 font-semibold text-primary-navy">{title}</h3>
                <p className="mt-1 text-xs leading-5 text-text-muted">{description}</p>
                {index < lifecycle.length - 1 ? <span aria-hidden="true" className="cl-overview-step-arrow">→</span> : null}
              </li>
            ))}
          </ol>
        </section>

        <div className="grid gap-4 lg:grid-cols-2">
          <GuidancePanel className="cl-overview-guidance-boundary" title="Important workflow boundaries">
            <ul className="space-y-3 text-sm leading-6 text-text-muted">
              <li><strong className="text-text-primary">Registration is identity setup.</strong> It does not imply enrollment, completion, approval, or certification.</li>
              <li><strong className="text-text-primary">Evidence and approval are separate.</strong> Submitting a record does not approve it, and governed decisions may require an independent authorized reviewer.</li>
              <li><strong className="text-text-primary">Credentials come last.</strong> Issuance depends on the required approved evidence and operational inputs.</li>
            </ul>
          </GuidancePanel>
          <GuidancePanel className="cl-overview-guidance-terms" title="Terms used in Client Lens">
            <dl className="space-y-3 text-sm">
              <Term name="Personnel" value="A person’s employment and operational profile." />
              <Term name="Trainee" value="A training identity used for enrollment and evidence." />
              <Term name="Certification" value="The governed determination that requirements were met." />
              <Term name="Credential" value="The issued, verifiable representation of an approved certification." />
            </dl>
          </GuidancePanel>
        </div>
      </div>
    </WorkspaceShell>
  );
}

interface ContinueWorkItem {
  id: string;
  label: string;
  meta: string;
  to: string;
}

interface ContinueWorkLaneData {
  allTo: string;
  count: number;
  empty: string;
  failed: boolean;
  items: ContinueWorkItem[];
  loading: boolean;
  title: string;
  tone: OverviewTone;
}

type TrainingNextAction = NonNullable<TrainingEnrollment["journey_progress"]>["next_action"];

function ContinueYourWork() {
  const auth = useAuth();
  const userId = auth.session?.id ?? "";
  const canViewEvidence = auth.canUsePermission("view_operational_evidence");
  const canViewTraining = auth.canUsePermission("view_training");
  const canViewCertifications = auth.canUsePermission("view_certification");
  const draftsQuery = useQuery({
    queryKey: ["overview", "my-evidence-drafts", userId],
    queryFn: () => listOperationalEvidenceRecords({ lifecycle_state: "DRAFT", created_by_user_id: userId, sort_by: "created_at", sort_direction: "desc", limit: 3 }),
    enabled: canViewEvidence && Boolean(userId),
    retry: false
  });
  const reviewsQuery = useQuery({
    queryKey: ["operational-evidence-governance-queue", {}],
    queryFn: () => listGovernanceQueue(),
    enabled: canViewEvidence,
    retry: false
  });
  const trainingQuery = useQuery({
    queryKey: ["training-recent-registrations"],
    queryFn: listRecentTrainingRegistrations,
    enabled: canViewTraining,
    retry: false
  });

  const drafts: ContinueWorkItem[] = (draftsQuery.data?.records ?? []).map((record) => ({
    id: record.evidence_record_id,
    label: record.presentation?.template_name ?? humanizeCode(record.template_code),
    meta: [record.presentation?.subject?.display_name, `Updated ${formatOverviewDate(record.updated_at)}`].filter(Boolean).join(" · "),
    to: routes.evidenceRecordPath(record.evidence_record_id)
  }));
  const reviews: ContinueWorkItem[] = (reviewsQuery.data ?? []).slice(0, 3).map((item) => ({
    id: item.evidence_record.id,
    label: item.display_context?.template_name ?? humanizeCode(item.evidence_record.template_provenance.template_code),
    meta: [item.display_context?.subject_name, item.active_claim?.claimed_by_user_id === userId ? "Claimed by you" : item.active_claim ? "Claimed" : "Available"].filter(Boolean).join(" · "),
    to: routes.evidenceRecordPath(item.evidence_record.id)
  }));
  const activeEnrollments = (trainingQuery.data?.enrollments ?? []).filter((enrollment) => enrollment.journey_progress?.next_action !== "DIGITAL_CREDENTIAL_ISSUED");
  const trainingEnrollments = activeEnrollments.filter((enrollment) => isTrainingAction(enrollment.journey_progress?.next_action));
  const certificationEnrollments = activeEnrollments.filter((enrollment) => !isTrainingAction(enrollment.journey_progress?.next_action));
  const trainingItems = trainingEnrollments.slice(0, 3).map(toTrainingWorkItem);
  const certificationItems = certificationEnrollments.slice(0, 3).map(toCertificationWorkItem);
  const possibleLanes: Array<ContinueWorkLaneData | null> = [
    canViewEvidence ? { title: "My evidence drafts", tone: "teal" as const, count: draftsQuery.data?.pagination.total_count ?? drafts.length, items: drafts, loading: draftsQuery.isLoading, failed: draftsQuery.isError, empty: "No evidence drafts need your attention.", allTo: routes.myDrafts } : null,
    canViewEvidence ? { title: "Governance reviews", tone: "indigo" as const, count: reviewsQuery.data?.length ?? reviews.length, items: reviews, loading: reviewsQuery.isLoading, failed: reviewsQuery.isError, empty: "No governed reviews are waiting.", allTo: routes.governanceQueue } : null,
    canViewTraining ? { title: "Training journeys", tone: "amber" as const, count: trainingEnrollments.length, items: trainingItems, loading: trainingQuery.isLoading, failed: trainingQuery.isError, empty: "No active training steps are waiting.", allTo: routes.trainingJourneys } : null,
    canViewTraining && canViewCertifications ? { title: "Certification & issuance", tone: "blue" as const, count: certificationEnrollments.length, items: certificationItems, loading: trainingQuery.isLoading, failed: trainingQuery.isError, empty: "No certification actions are waiting.", allTo: routes.certifications } : null
  ];
  const lanes = possibleLanes.filter((lane): lane is ContinueWorkLaneData => lane !== null);

  if (!lanes.length) return null;

  return (
    <section aria-labelledby="continue-work-heading">
      <SectionHeading description="A concise view of records that may need your attention now. Opening an item does not change its workflow state." id="continue-work-heading" title="Continue your work" />
      <div className="mt-4 grid gap-4 lg:grid-cols-2 2xl:grid-cols-4">
        {lanes.map((lane) => <ContinueWorkLane key={lane.title} {...lane} />)}
      </div>
    </section>
  );
}

function ContinueWorkLane({ allTo, count, empty, failed, items, loading, title, tone }: ContinueWorkLaneData) {
  return (
    <Surface className={`cl-overview-work-lane ${toneClass(tone)}`}>
      <div className="cl-overview-work-heading flex items-start justify-between gap-3">
        <h3 className="font-semibold text-primary-navy">{title}</h3>
        {!loading && !failed ? <span className="cl-overview-work-count">{count}</span> : null}
      </div>
      <div className="cl-overview-work-body flex-1">
        {loading ? <p className="text-sm text-text-muted" role="status">Loading current work…</p> : failed ? <p className="text-sm text-state-error" role="alert">This work list could not be loaded.</p> : items.length ? <ul className="space-y-2">{items.map((item) => <li key={item.id}><Link className="cl-overview-work-item" to={item.to}><span className="min-w-0"><span className="block truncate text-sm font-semibold text-primary-navy">{item.label}</span><span className="mt-0.5 block truncate text-xs text-text-muted">{item.meta}</span></span><span aria-hidden="true" className="cl-overview-work-arrow">→</span></Link></li>)}</ul> : <p className="text-sm leading-6 text-text-muted">{empty}</p>}
      </div>
      <Link className="cl-overview-view-all" to={allTo}>View all <span aria-hidden="true">→</span></Link>
    </Surface>
  );
}

function isTrainingAction(action: TrainingNextAction | undefined) {
  return !action || ["RECORD_ATTENDANCE", "RECORD_SKILLS_ASSESSMENT", "RECORD_KNOWLEDGE_ASSESSMENT", "RECORD_READINESS_DECISION"].includes(action);
}

function toTrainingWorkItem(enrollment: TrainingEnrollment): ContinueWorkItem {
  return { id: enrollment.id, label: enrollment.trainee.full_name, meta: `${enrollment.program.certification_level} · ${nextActionLabel(enrollment.journey_progress?.next_action)}`, to: routes.trainingJourneyPath(enrollment.id) };
}

function toCertificationWorkItem(enrollment: TrainingEnrollment): ContinueWorkItem {
  const certification = enrollment.journey_progress?.certification;
  const certificationId = certification?.id;
  return { id: enrollment.id, label: enrollment.trainee.full_name, meta: `${enrollment.program.certification_level} · ${nextActionLabel(enrollment.journey_progress?.next_action)}`, to: certificationId ? `${routes.certifications}?certification=${encodeURIComponent(certificationId)}` : routes.trainingJourneyPath(enrollment.id) };
}

function nextActionLabel(action: TrainingNextAction | undefined) {
  const labels: Record<string, string> = { RECORD_ATTENDANCE: "Record attendance", RECORD_SKILLS_ASSESSMENT: "Complete skills assessment", RECORD_KNOWLEDGE_ASSESSMENT: "Complete knowledge assessment", RECORD_READINESS_DECISION: "Record readiness decision", CERTIFICATION_REVIEW: "Certification review", BEGIN_F048: "Begin F-048", COMPLETE_F048_REVIEW: "Complete F-048 review", CREDENTIAL_ASSOCIATION_REVIEW: "Review credential association", ISSUE_DIGITAL_CREDENTIAL: "Issue digital credential" };
  return labels[String(action)] ?? "Review journey";
}

function formatOverviewDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(value));
}

function humanizeCode(value: string) {
  return value.replace(/^OGI_/, "").replaceAll("_", " ").replace(/\bF(\d{1,3})\b/, (_, digits: string) => `F-${digits.padStart(3, "0")}`).toLowerCase().replace(/\b\w/g, (character) => character.toUpperCase());
}

function AuthorizationContext({ session }: { session: AuthenticatedSession }) {
  return (
    <Surface aria-labelledby="authorization-context-heading" className="cl-overview-access" role="region">
      <SectionHeading description="This context controls which records and actions are available to you." id="authorization-context-heading" title="Your current access" />
      <dl className="mt-4 grid gap-4 sm:grid-cols-3">
        <ContextItem label="Signed in as" tone="teal" value={session.email ?? session.username ?? session.fullName} />
        <ContextItem label="Account scope" tone="blue" value={session.clientId ? "Client organization" : "OGI organization"} />
        <ContextItem label="Facility scope" tone="indigo" value={facilityScopeLabel(session)} />
      </dl>
    </Surface>
  );
}

function ActionCard({ action, tone }: { action: OverviewAction; tone: OverviewTone }) {
  return (
    <div className={`cl-overview-action ${toneClass(tone)}`}>
      <h3 className="font-semibold text-primary-navy">{action.label}</h3>
      <p className="mt-1 flex-1 text-xs leading-5 text-text-muted">{action.description}</p>
      <div className="mt-3"><Button asChild variant="secondary"><Link className="cl-overview-action-link" style={{ backgroundColor: "var(--cl-overview-accent)", borderColor: "var(--cl-overview-accent)", color: "white" }} to={action.to}>Open <span aria-hidden="true">→</span></Link></Button></div>
    </div>
  );
}

function SectionHeading({ description, id, title }: { description: string; id: string; title: string }) {
  return <div><h2 className="text-lg font-semibold text-primary-navy" id={id}>{title}</h2>{description ? <p className="mt-1 text-sm leading-6 text-text-muted">{description}</p> : null}</div>;
}

function GuidancePanel({ children, className, title }: { children: ReactNode; className: string; title: string }) {
  return <Surface className={className}><h2 className="text-lg font-semibold text-primary-navy">{title}</h2><div className="mt-4">{children}</div></Surface>;
}

function ContextItem({ label, tone, value }: { label: string; tone: OverviewTone; value: string }) {
  return <div className={`cl-overview-context-item ${toneClass(tone)}`}><dt className="text-xs font-bold uppercase tracking-wide">{label}</dt><dd className="mt-1 text-sm font-semibold text-text-primary">{value}</dd></div>;
}

function Term({ name, value }: { name: string; value: string }) {
  return <div><dt className="font-semibold text-text-primary">{name}</dt><dd className="mt-0.5 leading-5 text-text-muted">{value}</dd></div>;
}

function facilityScopeLabel(session: AuthenticatedSession) {
  if (session.facilityScopeMode === "CLIENT_WIDE") return "All facilities in client scope";
  if (session.facilityScopeMode === "EXPLICIT") return `${session.facilityIds.length} assigned ${session.facilityIds.length === 1 ? "facility" : "facilities"}`;
  return "Organizational scope";
}

function toneClass(tone: OverviewTone) {
  const classes: Record<OverviewTone, string> = {
    teal: "cl-overview-tone-teal",
    blue: "cl-overview-tone-blue",
    amber: "cl-overview-tone-amber",
    indigo: "cl-overview-tone-indigo"
  };
  return classes[tone];
}
