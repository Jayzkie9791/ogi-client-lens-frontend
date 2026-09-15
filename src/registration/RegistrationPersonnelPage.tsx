import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";

import { isApiError } from "../api/errors";
import { routes } from "../app/routePaths";
import { useAuth } from "../auth/useAuth";
import { DigitalCertificateModal } from "../credentials/DigitalCertificateModal";
import { listTrainingEnrollments, listTrainingTrainees, TrainingEnrollment } from "../training/trainingApi";
import { Button } from "../ui/components/Button";
import { Surface } from "../ui/components/Surface";
import { WorkspaceShell } from "../ui/components/WorkspaceShell";
import { RecordAccordion } from "../ui/components/RecordAccordion";
import {
  listRegistrationClients,
  RegistrationClient
} from "./registrationClientApi";
import {
  listRegistrationFacilities,
  RegistrationFacility
} from "./registrationFacilityApi";
import {
  getRegistrationPersonnel,
  listRegistrationPersonnel,
  RegistrationPersonnel,
  RegistrationPersonnelEmploymentStatus,
  RegistrationPersonnelMutationRequest,
  registrationPersonnelEmploymentStatuses,
  updateRegistrationPersonnel
} from "./registrationPersonnelApi";
import { RegistrationFacilityAssignmentsPanel } from "./RegistrationFacilityAssignmentsPanel";
import { listRegistrationFacilityAssignments } from "./registrationFacilityAssignmentApi";
import { getPersonnelRegistrationIntent } from "./personnelRegistrationJourneyApi";
import { OgiOperationalAuthorityPanel } from "./OgiOperationalAuthorityPanel";
import { OgiInstructorQualificationPanel } from "./OgiInstructorQualificationPanel";
import { formatRegistrationDate, formatRegistrationDateTime } from "./registrationPresentation";
import {
  RegistrationEditableSection,
  RegistrationMetadataGroup,
  RegistrationMetadataItem,
  RegistrationStatusBadge
} from "./RegistrationWorkspaceUi";

const permissions = {
  viewClients: "view_client",
  viewFacilities: "view_facility",
  view: "view_staff_member",
  update: "update_staff_member",
  deactivate: "deactivate_staff_member",
  viewFacilityAssignments: "view_facility_assignment"
  ,viewOperationalAuthority: "view_personnel_operational_authorization"
  ,manageOperationalAuthority: "manage_personnel_operational_authorization"
  ,viewCertification: "view_certification"
  ,createCertification: "create_certification_draft"
  ,issueCertification: "issue_certification"
  ,viewInstructorRegistry: "view_instructor_registry"
  ,manageInstructorRegistry: "manage_instructor_registry"
  ,viewTraining: "view_training"
} as const;

type PersonnelSecondaryTab = "profile" | "training" | "records";

interface PersonnelFormState {
  clientId: string;
  fullName: string;
  email: string;
  phoneNumber: string;
  employmentStatus: RegistrationPersonnelEmploymentStatus;
  hireDate: string;
  notes: string;
}

export function RegistrationPersonnelPage() {
  const auth = useAuth();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const canViewClients = auth.canUsePermission(permissions.viewClients);
  const canViewFacilities = auth.canUsePermission(permissions.viewFacilities);
  const canView = auth.canUsePermission(permissions.view);
  const canViewTraining = auth.canUsePermission(permissions.viewTraining);
  const canRegisterTraining = auth.canUsePermission("create_training_enrollment");
  const canViewPersonnelCertificates = auth.canUsePermission(permissions.viewCertification);
  const canUpdate = auth.canUsePermission(permissions.update);
  const canDeactivate = auth.canUsePermission(permissions.deactivate);
  const canViewFacilityAssignments = auth.canUsePermission(
    permissions.viewFacilityAssignments
  );
  const canViewOperationalAuthority = auth.canUsePermission(permissions.viewOperationalAuthority) && auth.session?.clientId === null;
  const canManageOperationalAuthority = auth.canUsePermission(permissions.manageOperationalAuthority) && auth.session?.clientId === null;
  const canViewCertification = auth.canUsePermission(permissions.viewCertification) && auth.session?.clientId === null;
  const canCreateCertification = auth.canUsePermission(permissions.createCertification) && auth.session?.clientId === null;
  const canIssueCertification = auth.canUsePermission(permissions.issueCertification) && auth.session?.clientId === null;
  const canViewInstructorRegistry = auth.canUsePermission(permissions.viewInstructorRegistry) && auth.session?.clientId === null;
  const canManageInstructorRegistry = auth.canUsePermission(permissions.manageInstructorRegistry) && auth.session?.clientId === null;
  const [clientFilter, setClientFilter] = useState("");
  const [facilityFilter, setFacilityFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    RegistrationPersonnelEmploymentStatus | ""
  >("");
  const [selectedPersonnelId, setSelectedPersonnelId] = useState<string | null>(null);
  const [selectedTab, setSelectedTab] = useState<PersonnelSecondaryTab>("profile");
  const [editForm, setEditForm] = useState<PersonnelFormState | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const clientsQuery = useQuery({
    queryKey: ["registration-clients"],
    queryFn: () => listRegistrationClients(),
    enabled: canViewClients,
    retry: false
  });
  const clients = useMemo(
    () => clientsQuery.data?.clients ?? [],
    [clientsQuery.data]
  );
  const clientNameById = useMemo(() => buildClientNameMap(clients), [clients]);

  const facilitiesQuery = useQuery({
    queryKey: ["registration-facilities", clientFilter],
    queryFn: () =>
      listRegistrationFacilities(clientFilter ? { clientId: clientFilter } : {}),
    enabled: canViewFacilities,
    retry: false
  });
  const facilities = useMemo(
    () => facilitiesQuery.data?.facilities ?? [],
    [facilitiesQuery.data]
  );

  const personnelQuery = useQuery({
    queryKey: [
      "registration-personnel",
      clientFilter,
      facilityFilter,
      statusFilter
    ],
    queryFn: () =>
      listRegistrationPersonnel({
        ...(clientFilter ? { clientId: clientFilter } : {}),
        ...(facilityFilter ? { facilityId: facilityFilter } : {}),
        ...(statusFilter ? { status: statusFilter } : {})
      }),
    enabled: canView,
    retry: false
  });
  const personnel = useMemo(
    () => personnelQuery.data?.personnel ?? [],
    [personnelQuery.data]
  );

  useEffect(() => {
    const requestedPersonnelId = searchParams.get("personnel");
    if (requestedPersonnelId && personnel.some((staffMember) => staffMember.id === requestedPersonnelId)) {
      setSelectedPersonnelId(requestedPersonnelId);
    }
  }, [personnel, searchParams]);

  useEffect(() => {
    if (
      selectedPersonnelId &&
      personnel.length > 0 &&
      !personnel.some((staffMember) => staffMember.id === selectedPersonnelId)
    ) {
      setSelectedPersonnelId(null);
      setSelectedTab("profile");
    }

    if (selectedPersonnelId && personnel.length === 0) {
      setSelectedPersonnelId(null);
      setSelectedTab("profile");
    }
  }, [personnel, selectedPersonnelId]);

  const selectedPersonnelQuery = useQuery({
    queryKey: ["registration-personnel", selectedPersonnelId],
    queryFn: () => getRegistrationPersonnel(selectedPersonnelId ?? ""),
    enabled: canView && selectedPersonnelId !== null,
    retry: false
  });

  useEffect(() => {
    if (selectedPersonnelQuery.data) {
      setEditForm(formStateFromPersonnel(selectedPersonnelQuery.data));
    }
  }, [selectedPersonnelQuery.data]);

  const updateMutation = useMutation({
    mutationFn: (request: RegistrationPersonnelMutationRequest) => {
      if (!selectedPersonnelId) {
        throw new Error("No Personnel record is selected.");
      }

      return updateRegistrationPersonnel(selectedPersonnelId, request);
    },
    onSuccess: (staffMember) => {
      setMessage("Personnel record updated successfully.");
      void queryClient.invalidateQueries({ queryKey: ["registration-personnel"] });
      queryClient.setQueryData(
        ["registration-personnel", staffMember.id],
        staffMember
      );
    }
  });

  function submitEditForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!editForm) {
      return;
    }

    setMessage(null);
    updateMutation.mutate(buildUpdateRequest(editForm));
  }

  function deactivateSelectedPersonnel() {
    setMessage(null);
    updateMutation.mutate({ employment_status: "INACTIVE" });
  }

  function selectPersonnel(staffMemberId: string | null) {
    setSelectedPersonnelId(staffMemberId);
  }

  function changeClientFilter(value: string) {
    setClientFilter(value);
    setFacilityFilter("");
    setSelectedPersonnelId(null);
    setSelectedTab("profile");

  }

  function changeFacilityFilter(value: string) {
    setFacilityFilter(value);
    setSelectedPersonnelId(null);
    setSelectedTab("profile");
  }

  function changeStatusFilter(value: RegistrationPersonnelEmploymentStatus | "") {
    setStatusFilter(value);
    setSelectedPersonnelId(null);
    setSelectedTab("profile");
  }

  if (!canView) {
    return (
      <SafeState title="You are not authorized to view Personnel registration.">
        Your current session does not include Personnel registration authority.
      </SafeState>
    );
  }

  return (
    <WorkspaceShell
      title="Workforce"
      description="Review the authorized workforce masterlist, employment context, Training journeys, and issued credentials."
      headingId="registration-personnel-heading"
      navigation={null}
      sectionDescription="Select a Personnel record to review its profile, assignments, Training history, Certifications, and Credentials."
      sectionTitle="Personnel"
      showSectionHeader={false}
    >
      {message ? (
        <Surface role="status">
          <p className="text-sm font-semibold text-text-primary">{message}</p>
        </Surface>
      ) : null}

      <RegistrationErrorAlert error={updateMutation.error} />

      <PersonnelFilters
        canViewClients={canViewClients}
        canViewFacilities={canViewFacilities}
        clientFilter={clientFilter}
        clients={clients}
        facilityFilter={facilityFilter}
        facilities={facilities}
        facilitiesLoading={facilitiesQuery.isLoading}
        onClientFilterChange={changeClientFilter}
        onFacilityFilterChange={changeFacilityFilter}
        onStatusFilterChange={changeStatusFilter}
        statusFilter={statusFilter}
      />

      {personnelQuery.isLoading ? (
        <SafeState title="Loading Personnel records." role="status">
          Please wait.
        </SafeState>
      ) : personnelQuery.isError ? (
        <RegistrationPersonnelErrorState error={personnelQuery.error} />
      ) : personnel.length === 0 ? (
            <PersonnelEmptyDetailPanel canCreate={false} />
          ) : (
            <div aria-label="Personnel records" className="space-y-4">{personnel.map((staffMember) => <RecordAccordion expanded={selectedPersonnelId === staffMember.id} id={`personnel-${staffMember.id}`} key={staffMember.id} onToggle={() => selectPersonnel(selectedPersonnelId === staffMember.id ? null : staffMember.id)} summary={<PersonnelAccordionSummary clientNameById={clientNameById} staffMember={staffMember} />}>
            {selectedPersonnelId === staffMember.id ? <div className="space-y-4"><PersonnelDetailsPanel
              canDeactivate={canDeactivate}
              canUpdate={canUpdate}
              canViewFacilityAssignments={canViewFacilityAssignments && (!selectedPersonnelQuery.data || personnelAffiliation(selectedPersonnelQuery.data) === "CLIENT")}
              canViewTraining={canViewTraining}
              canRegisterTraining={canRegisterTraining}
              canViewPersonnelCertificates={canViewPersonnelCertificates}
              clientNameById={clientNameById}
              clients={clients}
              editForm={editForm}
              isLoading={selectedPersonnelQuery.isLoading}
              isSubmitting={updateMutation.isPending}
              mutationError={updateMutation.error}
              mutationMessage={message === "Personnel record updated successfully." ? message : null}
              onDeactivate={deactivateSelectedPersonnel}
              onEditChange={setEditForm}
              onSubmit={submitEditForm}
              onTabChange={setSelectedTab}
              selectedTab={selectedTab}
              staffMember={selectedPersonnelQuery.data ?? null}
              recordsContent={selectedPersonnelQuery.data && personnelAffiliation(selectedPersonnelQuery.data) === "OGI" ? <>{canViewOperationalAuthority ? <OgiOperationalAuthorityPanel canManage={canManageOperationalAuthority} personnelId={selectedPersonnelQuery.data.id} /> : null}<OgiInstructorQualificationPanel canCreate={canCreateCertification} canIssue={canIssueCertification} canManageRegistry={canManageInstructorRegistry} canView={canViewCertification} canViewRegistry={canViewInstructorRegistry} personnelId={selectedPersonnelQuery.data.id} /></> : null}
            />
            </div> : null}
            </RecordAccordion>)}</div>
          )}
    </WorkspaceShell>
  );
}

function PersonnelFilters({
  canViewClients,
  canViewFacilities,
  clientFilter,
  clients,
  facilityFilter,
  facilities,
  facilitiesLoading,
  onClientFilterChange,
  onFacilityFilterChange,
  onStatusFilterChange,
  statusFilter
}: {
  canViewClients: boolean;
  canViewFacilities: boolean;
  clientFilter: string;
  clients: RegistrationClient[];
  facilityFilter: string;
  facilities: RegistrationFacility[];
  facilitiesLoading: boolean;
  onClientFilterChange: (value: string) => void;
  onFacilityFilterChange: (value: string) => void;
  onStatusFilterChange: (value: RegistrationPersonnelEmploymentStatus | "") => void;
  statusFilter: RegistrationPersonnelEmploymentStatus | "";
}) {
  return (
    <Surface>
      <div className="grid gap-3 md:grid-cols-3">
        {canViewClients ? (
          <label className="block text-sm font-semibold text-text-primary">
            Client filter
            <select
              className={inputClassName}
              onChange={(event) => onClientFilterChange(event.currentTarget.value)}
              value={clientFilter}
            >
              <option value="">All authorized clients</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.organization_name}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {canViewFacilities ? (
          <label className="block text-sm font-semibold text-text-primary">
            Facility filter
            <select
              className={inputClassName}
              disabled={facilitiesLoading}
              onChange={(event) => onFacilityFilterChange(event.currentTarget.value)}
              value={facilityFilter}
            >
              <option value="">All assigned facilities</option>
              {facilities.map((facility) => (
                <option key={facility.id} value={facility.id}>
                  {facility.facility_name}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <label className="block text-sm font-semibold text-text-primary">
          Employment status filter
          <select
            className={inputClassName}
            onChange={(event) =>
              onStatusFilterChange(
                event.currentTarget.value as RegistrationPersonnelEmploymentStatus | ""
              )
            }
            value={statusFilter}
          >
            <option value="">All employment statuses</option>
            {registrationPersonnelEmploymentStatuses.map((status) => (
              <option key={status} value={status}>
                {displayCode(status)}
              </option>
            ))}
          </select>
        </label>
      </div>
    </Surface>
  );
}

function PersonnelAccordionSummary({ clientNameById, staffMember }: { clientNameById: Map<string, string>; staffMember: RegistrationPersonnel }) {
  return <div className="grid gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_auto] sm:items-center">
    <div><p className="text-xs font-bold uppercase tracking-wide text-primary-blue">Personnel</p><h3 className="mt-1 break-words text-lg font-semibold text-primary-navy">{staffMember.full_name}</h3><p className="mt-1 break-words text-sm text-text-muted">{staffMember.email ?? "Email not specified"}</p></div>
    <div><p className="text-sm font-semibold text-primary-navy">{personnelAffiliation(staffMember) === "OGI" ? "Ocean Guard International" : clientLabel(staffMember.client_id, clientNameById)}</p>{staffMember.hire_date ? <p className="mt-1 text-xs text-text-muted">Hired {formatRegistrationDate(staffMember.hire_date)}</p> : null}</div>
    <RegistrationStatusBadge value={staffMember.employment_status} />
  </div>;
}

function PersonnelDetailsPanel({
  canDeactivate,
  canRegisterTraining,
  canUpdate,
  canViewFacilityAssignments,
  canViewPersonnelCertificates,
  canViewTraining,
  clientNameById,
  clients,
  editForm,
  isLoading,
  isSubmitting,
  mutationError,
  mutationMessage,
  onDeactivate,
  onEditChange,
  onSubmit,
  onTabChange,
  selectedTab,
  staffMember,
  recordsContent
}: {
  canDeactivate: boolean;
  canRegisterTraining: boolean;
  canUpdate: boolean;
  canViewFacilityAssignments: boolean;
  canViewPersonnelCertificates: boolean;
  canViewTraining: boolean;
  clientNameById: Map<string, string>;
  clients: RegistrationClient[];
  editForm: PersonnelFormState | null;
  isLoading: boolean;
  isSubmitting: boolean;
  mutationError: Error | null;
  mutationMessage: string | null;
  onDeactivate: () => void;
  onEditChange: (formState: PersonnelFormState) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onTabChange: (tab: PersonnelSecondaryTab) => void;
  selectedTab: PersonnelSecondaryTab;
  staffMember: RegistrationPersonnel | null;
  recordsContent: ReactNode;
}) {
  const queryClient = useQueryClient();
  const [profileCardIndex, setProfileCardIndex] = useState(0);
  const staffMemberId = staffMember?.id;
  const staffMemberClientId = staffMember?.client_id;
  const isClientPersonnel = staffMember ? personnelAffiliation(staffMember) === "CLIENT" : false;
  const assignmentsQuery = useQuery({queryKey:["registration-facility-assignments",staffMemberId],queryFn:()=>staffMemberId?listRegistrationFacilityAssignments(staffMemberId):Promise.reject(new Error("No Personnel record is selected.")),enabled:canViewFacilityAssignments&&Boolean(staffMemberId),retry:false});
  const journeyQuery = useQuery({queryKey:["personnel-registration-intent",staffMemberId],queryFn:()=>staffMemberId?getPersonnelRegistrationIntent(staffMemberId):Promise.reject(new Error("No Personnel record is selected.")),enabled:Boolean(staffMemberId)&&isClientPersonnel,retry:false});
  const registrationFacilitiesQuery = useQuery({queryKey:["registration-facilities","personnel-summary",staffMemberClientId],queryFn:()=>staffMemberClientId?listRegistrationFacilities({clientId:staffMemberClientId}):Promise.reject(new Error("No Client is assigned to this Personnel record.")),enabled:canViewFacilityAssignments&&Boolean(staffMemberClientId),retry:false});
  const profileCards = canViewFacilityAssignments ? ["employment", "facilities", "administrative"] as const : ["employment", "administrative"] as const;
  const profileCard = profileCards[profileCardIndex % profileCards.length];
  useEffect(() => setProfileCardIndex(0), [staffMember?.id]);
  if (isLoading) {
    return (
      <SafeState title="Loading Personnel details." role="status">
        Please wait.
      </SafeState>
    );
  }

  if (!staffMember || !editForm) {
    return (
      <SafeState title="Select a Personnel record.">
        Choose a Personnel registration record to view its details.
      </SafeState>
    );
  }

  return (
    <div className="space-y-4">
      <Surface>
        <div className="space-y-4">
          <PersonnelSecondaryNavigation
            canViewTraining={canViewTraining}
            onTabChange={onTabChange}
            selectedTab={selectedTab}
          />

          {selectedTab === "profile" ? <div className="flex items-center justify-between gap-3 rounded-component border border-blue-200 bg-blue-50 px-3 py-3"><Button aria-label="Previous Profile card" className="min-h-11 min-w-28 gap-2 px-4 text-sm font-bold shadow-sm" onClick={() => setProfileCardIndex((current) => (current - 1 + profileCards.length) % profileCards.length)} type="button"><span aria-hidden="true" className="text-lg">←</span><span className="hidden sm:inline">Previous</span></Button><div className="text-center"><p className="text-sm font-bold text-primary-navy">{profileCard === "employment" ? "Employment Profile" : profileCard === "facilities" ? "Facility Assignments" : "Administrative Details"}</p><p className="mt-0.5 text-xs font-semibold text-primary-blue">{profileCardIndex % profileCards.length + 1} of {profileCards.length}</p></div><Button aria-label="Next Profile card" className="min-h-11 min-w-28 gap-2 px-4 text-sm font-bold shadow-sm" onClick={() => setProfileCardIndex((current) => (current + 1) % profileCards.length)} type="button"><span className="hidden sm:inline">Next</span><span aria-hidden="true" className="text-lg">→</span></Button></div> : null}

          {selectedTab === "profile" && profileCard !== "facilities" ? <PersonnelOverview
              canDeactivate={canDeactivate}
              canUpdate={canUpdate}
              clientNameById={clientNameById}
              editForm={editForm}
              isSubmitting={isSubmitting}
              mutationError={mutationError}
              mutationMessage={mutationMessage}
              onDeactivate={onDeactivate}
              onEditChange={onEditChange}
              onSubmit={onSubmit}
              section={profileCard}
              staffMember={staffMember}
            /> : null}
        </div>
      </Surface>

      {selectedTab === "profile" && profileCard === "facilities" && canViewFacilityAssignments ? (
        <div
          aria-labelledby="personnel-profile-tab"
          id="personnel-profile-facilities"
          role="tabpanel"
        >
          <RegistrationFacilityAssignmentsPanel staffMember={staffMember} />
        </div>
      ) : null}

      {selectedTab === "training" && canViewTraining ? <div aria-labelledby="personnel-training-tab" id="personnel-training-panel" role="tabpanel"><PersonnelTrainingRecords canRegisterTraining={canRegisterTraining} canViewCertificates={canViewPersonnelCertificates} staffMember={staffMember} /></div> : null}
      {selectedTab === "records" ? <div aria-labelledby="personnel-records-tab" className="space-y-4" id="personnel-records-panel" role="tabpanel">{personnelAffiliation(staffMember) === "CLIENT" ? <PersonnelRegistrationSummary assignments={assignmentsQuery.data?.assignments ?? []} clientName={clientLabel(staffMember.client_id, clientNameById)} facilities={registrationFacilitiesQuery.data?.facilities ?? []} intent={journeyQuery.data?.intent ?? null} loading={assignmentsQuery.isLoading || journeyQuery.isLoading || registrationFacilitiesQuery.isLoading} staffMember={staffMember} /> : null}{recordsContent}{!recordsContent && personnelAffiliation(staffMember) === "OGI" ? <Surface><p className="text-sm text-text-muted">No governed Personnel records are available with the current authority.</p></Surface> : null}</div> : null}

    </div>
  );
}

function PersonnelRegistrationSummary({assignments,clientName,facilities,intent,loading,staffMember}:{
  assignments: Awaited<ReturnType<typeof listRegistrationFacilityAssignments>>["assignments"];
  clientName:string;
  facilities:RegistrationFacility[];
  intent:Awaited<ReturnType<typeof getPersonnelRegistrationIntent>>["intent"];
  loading:boolean;
  staffMember:RegistrationPersonnel;
}) {
  if (personnelAffiliation(staffMember) !== "CLIENT") return null;
  const active=assignments.filter(item=>item.assignment_status==="ACTIVE");
  const nameById=new Map(facilities.map(item=>[item.id,item.facility_name]));
  const primary=active.find(item=>item.is_primary_assignment);
  const draft=intent?.draft && typeof intent.draft==="object" ? intent.draft as Record<string,unknown> : {};
  const access=draft.platformAccess==="REQUESTED"?"Provisioning requested":draft.platformAccess==="LINKED"||staffMember.user_id?"Platform account linked":"No platform access requested";
  return <section className="rounded-component border border-blue-200 bg-blue-50/60 p-5" aria-label="Personnel Registration summary">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wide text-primary-blue">Personnel Registration</p><h3 className="mt-1 text-lg font-semibold text-primary-navy">Registration summary</h3></div><span className={`rounded-full border px-3 py-1 text-xs font-bold uppercase ${intent?.status==="COMPLETED"?"border-emerald-200 bg-emerald-50 text-emerald-800":"border-amber-200 bg-amber-50 text-amber-800"}`}>{intent?.status==="COMPLETED"?"Complete":"Incomplete"}</span></div>
    {loading?<p className="mt-4 text-sm text-text-muted">Loading Registration details…</p>:<dl className="mt-4 grid gap-x-6 gap-y-4 sm:grid-cols-2">
      <RegistrationSummaryItem label="Client" value={clientName}/>
      <RegistrationSummaryItem label="Personnel type" value="Client Personnel"/>
      <RegistrationSummaryItem label="Assigned Facilities" value={active.length?active.map(item=>nameById.get(item.facility_id)??item.facility_id).join(", "):"No active Facility assignment"}/>
      <RegistrationSummaryItem label="Primary Facility" value={primary?(nameById.get(primary.facility_id)??primary.facility_id):"Not designated"}/>
      <RegistrationSummaryItem label="Platform access" value={access}/>
      <RegistrationSummaryItem label="Completed" value={intent?.completed_at?formatRegistrationDateTime(intent.completed_at):"Not completed"}/>
    </dl>}
  </section>;
}

function PersonnelTrainingRecords({ canRegisterTraining, canViewCertificates, staffMember }: { canRegisterTraining: boolean; canViewCertificates: boolean; staffMember: RegistrationPersonnel }) {
  const [certificateIssuanceId, setCertificateIssuanceId] = useState<string | null>(null);
  const traineesQuery = useQuery({
    queryKey: ["training-trainees", "personnel", staffMember.id],
    queryFn: listTrainingTrainees,
    retry: false
  });
  const trainee = traineesQuery.data?.trainees.find((candidate) =>
    candidate.staff_member_links.some((link) => link.staff_member_id === staffMember.id && link.ended_at === null)
  );
  const enrollmentsQuery = useQuery({
    queryKey: ["training-enrollments", "personnel", staffMember.id, trainee?.id],
    queryFn: () => trainee ? listTrainingEnrollments(trainee.id) : Promise.resolve({ enrollments: [] as TrainingEnrollment[] }),
    enabled: !traineesQuery.isLoading,
    retry: false
  });
  const enrollments = enrollmentsQuery.data?.enrollments ?? [];

  return <><Surface>
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><p className="text-xs font-bold uppercase tracking-wide text-primary-blue">Personnel record</p><h3 className="mt-1 text-lg font-semibold text-primary-navy">Training, Certifications, and Credentials</h3><p className="mt-1 text-sm text-text-muted">Enrollment journeys and issued authority linked to this exact Personnel identity.</p></div>
      {canRegisterTraining ? <Button asChild variant="secondary"><Link to={routes.trainingRegister}>Register Training</Link></Button> : null}
    </div>
    {traineesQuery.isLoading || enrollmentsQuery.isLoading ? <p className="mt-4 text-sm text-text-muted" role="status">Loading Training records…</p> : null}
    {traineesQuery.isError || enrollmentsQuery.isError ? <p className="mt-4 rounded-component border border-red-200 bg-red-50 p-3 text-sm text-red-900" role="alert">Training records could not be loaded with the current authority.</p> : null}
    {!traineesQuery.isLoading && !traineesQuery.isError && !trainee ? <div className="mt-4 rounded-component border border-amber-200 bg-amber-50 p-4"><p className="font-semibold text-amber-900">No linked Trainee identity</p><p className="mt-1 text-sm text-amber-900">Link the matching Trainee record before its Training history can appear on this Personnel profile.</p><Button asChild className="mt-3" variant="secondary"><Link to={routes.trainingTrainees}>Open Trainee Reconciliation</Link></Button></div> : null}
    {trainee && !enrollmentsQuery.isLoading && !enrollmentsQuery.isError && enrollments.length === 0 ? <p className="mt-4 rounded-component border border-dashed border-border p-4 text-sm text-text-muted">The linked Trainee has no active Training registrations.</p> : null}
    {enrollments.length > 0 ? <ul aria-label="Personnel Training records" className="mt-4 space-y-3">{enrollments.map((enrollment) => { const issuance = enrollment.journey_progress?.certification?.digital_credential.issuance; return <li className="rounded-component border border-border p-4" key={enrollment.id}><div className="flex flex-wrap items-start justify-between gap-3"><div><h4 className="font-semibold text-primary-navy">{enrollment.program.certification_level} · {enrollment.program.display_name}</h4><p className="mt-1 text-sm text-text-muted">{enrollment.training_session?.training_title ?? "Training Session not assigned"} · Enrolled {formatRegistrationDateTime(enrollment.enrolled_at)}</p></div><RegistrationStatusBadge value={personnelTrainingStatus(enrollment)} /></div><div className="mt-3 flex flex-wrap gap-2"><Button asChild><Link to={routes.trainingJourneyPath(enrollment.id)}>{enrollment.journey_progress?.certification ? "View Training Journey" : "Continue Training Journey"}</Link></Button>{canViewCertificates && issuance ? <Button onClick={() => setCertificateIssuanceId(issuance.id)} type="button" variant="secondary">View Certificate</Button> : null}{canViewCertificates && enrollment.journey_progress?.certification && !issuance ? <Button asChild variant="secondary"><Link to={routes.certifications}>View Certification Record</Link></Button> : null}</div></li>; })}</ul> : null}
  </Surface>{certificateIssuanceId ? <DigitalCertificateModal issuanceId={certificateIssuanceId} onClose={() => setCertificateIssuanceId(null)} /> : null}</>;
}

function personnelTrainingStatus(enrollment: TrainingEnrollment) {
  const progress = enrollment.journey_progress;
  if (progress?.certification?.digital_credential.issuance) return "CREDENTIAL ISSUED";
  if (progress?.certification) return "CERTIFIED";
  if (progress?.readiness) return "CERTIFICATION REVIEW";
  if (progress?.knowledge_assessment) return "READINESS";
  if (progress?.skills_assessment) return "KNOWLEDGE";
  if (progress?.attendance) return "SKILLS";
  return "REGISTERED";
}

function RegistrationSummaryItem({label,value}:{label:string;value:string}) {
  return <div><dt className="text-xs font-bold uppercase tracking-wide text-primary-blue/80">{label}</dt><dd className="mt-1 text-sm font-semibold leading-6 text-primary-navy">{value}</dd></div>;
}

function PersonnelSecondaryNavigation({
  canViewTraining,
  onTabChange,
  selectedTab
}: {
  canViewTraining: boolean;
  onTabChange: (tab: PersonnelSecondaryTab) => void;
  selectedTab: PersonnelSecondaryTab;
}) {
  return (
    <div aria-label="Personnel detail sections" className="flex flex-wrap gap-2" role="tablist">
      <button
        aria-controls="personnel-profile-panel"
        aria-selected={selectedTab === "profile"}
        className={tabClassName(selectedTab === "profile")}
        id="personnel-profile-tab"
        onClick={() => onTabChange("profile")}
        role="tab"
        type="button"
      >
        Profile
      </button>
      {canViewTraining ? (
        <button
          aria-controls="personnel-training-panel"
          aria-selected={selectedTab === "training"}
          className={tabClassName(selectedTab === "training")}
          id="personnel-training-tab"
          onClick={() => onTabChange("training")}
          role="tab"
          type="button"
        >
          Training
        </button>
      ) : null}
      <button aria-controls="personnel-records-panel" aria-selected={selectedTab === "records"} className={tabClassName(selectedTab === "records")} id="personnel-records-tab" onClick={() => onTabChange("records")} role="tab" type="button">Records</button>
    </div>
  );
}

function PersonnelOverview({
  canDeactivate,
  canUpdate,
  clientNameById,
  editForm,
  isSubmitting,
  mutationError,
  mutationMessage,
  onDeactivate,
  onEditChange,
  onSubmit,
  section,
  staffMember
}: {
  canDeactivate: boolean;
  canUpdate: boolean;
  clientNameById: Map<string, string>;
  editForm: PersonnelFormState;
  isSubmitting: boolean;
  mutationError: Error | null;
  mutationMessage: string | null;
  onDeactivate: () => void;
  onEditChange: (formState: PersonnelFormState) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  section: "employment" | "administrative";
  staffMember: RegistrationPersonnel;
}) {
  return (
    <div
      aria-labelledby="personnel-profile-tab"
      className="space-y-4"
      id="personnel-profile-panel"
      role="tabpanel"
    >
      {section === "administrative" ? <RegistrationMetadataGroup description="System relationships and record history remain secondary to the employment profile.">
        <RegistrationMetadataItem label="Administrative Personnel ID" value={staffMember.id} subtle />
        <RegistrationMetadataItem label="Affiliation" value={personnelAffiliation(staffMember)} />
        <RegistrationMetadataItem label="Administrative Client ID" value={staffMember.client_id ?? "Not client-affiliated"} subtle />
        <RegistrationMetadataItem
          label="Platform user"
          value={staffMember.user_id ?? "No linked user account"}
          subtle={Boolean(staffMember.user_id)}
        />
        <RegistrationMetadataItem label="Created" value={formatRegistrationDateTime(staffMember.created_at)} />
        <RegistrationMetadataItem label="Updated" value={formatRegistrationDateTime(staffMember.updated_at)} />
      </RegistrationMetadataGroup> : null}

      {section === "employment" && canUpdate ? (
        <RegistrationEditableSection
          description={`Employment information for ${personnelAffiliation(staffMember) === "OGI" ? "Ocean Guard International" : clientLabel(staffMember.client_id, clientNameById)}.`}
          title="Employment profile"
        >
          <PersonnelForm
            actionLabel="Save Personnel"
            clients={[]}
            formId="edit-registration-personnel"
            formState={editForm}
            isSubmitting={isSubmitting}
            lockClientSelection
            lockedClientDisplayValue={personnelAffiliation(staffMember) === "OGI" ? "Ocean Guard International" : clientLabel(staffMember.client_id, clientNameById)}
            onChange={onEditChange}
            onSubmit={onSubmit}
          />
          {mutationMessage ? <p className="mt-3 rounded-component border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-800" role="status">{mutationMessage}</p> : null}
          {mutationError ? <div className="mt-3"><RegistrationErrorAlert error={mutationError} /></div> : null}
        </RegistrationEditableSection>
      ) : section === "employment" ? (
        <PersonnelReadOnlyDetails staffMember={staffMember} />
      ) : null}

      {section === "employment" && canDeactivate && staffMember.employment_status !== "INACTIVE" ? (
        <Button disabled={isSubmitting} onClick={onDeactivate} variant="secondary">
          Deactivate Personnel
        </Button>
      ) : null}
    </div>
  );
}

function PersonnelEmptyDetailPanel({ canCreate }: { canCreate: boolean }) {
  return (
    <Surface>
      <h2 className="text-base font-semibold text-text-primary">
        No Personnel selected.
      </h2>
      <p className="mt-2 text-sm leading-6 text-text-muted">
        {canCreate
          ? "Use Register Personnel to create a Personnel profile under an authorized Client."
          : "No Personnel records are currently available for your authority."}
      </p>
    </Surface>
  );
}

function PersonnelForm({
  actionLabel,
  cancelLabel,
  clients,
  formId,
  formState,
  isSubmitting,
  lockClientSelection,
  lockedClientDisplayValue,
  onCancel,
  onChange,
  onSubmit,
  showActions = true
}: {
  actionLabel: string;
  cancelLabel?: string;
  clients: RegistrationClient[];
  formId: string;
  formState: PersonnelFormState;
  isSubmitting: boolean;
  lockClientSelection: boolean;
  lockedClientDisplayValue?: string;
  onCancel?: () => void;
  onChange: (formState: PersonnelFormState) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  showActions?: boolean;
}) {
  const canSubmit =
    formState.fullName.trim().length > 0 &&
    (lockClientSelection || formState.clientId.trim().length > 0);

  return (
    <form aria-label={actionLabel} className="space-y-4" id={formId} onSubmit={onSubmit}>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="block text-sm font-semibold text-text-primary">
          Client
          {lockClientSelection ? (
            <input className={inputClassName} readOnly value={lockedClientDisplayValue ?? formState.clientId} />
          ) : (
            <select
              className={inputClassName}
              onChange={(event) =>
                onChange({ ...formState, clientId: event.currentTarget.value })
              }
              required
              value={formState.clientId}
            >
              <option value="">Select a Client / Organization</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.organization_name}
                </option>
              ))}
            </select>
          )}
        </label>
        <FormInput
          label="Full name"
          onChange={(fullName) => onChange({ ...formState, fullName })}
          required
          value={formState.fullName}
        />
        <FormInput
          label="Email"
          onChange={(email) => onChange({ ...formState, email })}
          type="email"
          value={formState.email}
        />
        <FormInput
          label="Phone"
          onChange={(phoneNumber) => onChange({ ...formState, phoneNumber })}
          value={formState.phoneNumber}
        />
        <label className="block text-sm font-semibold text-text-primary">
          Employment status
          <select
            className={inputClassName}
            onChange={(event) =>
              onChange({
                ...formState,
                employmentStatus: event.currentTarget
                  .value as RegistrationPersonnelEmploymentStatus
              })
            }
            value={formState.employmentStatus}
          >
            {registrationPersonnelEmploymentStatuses.map((status) => (
              <option key={status} value={status}>
                {displayCode(status)}
              </option>
            ))}
          </select>
        </label>
        <FormInput
          label="Hire date"
          onChange={(hireDate) => onChange({ ...formState, hireDate })}
          type="date"
          value={formState.hireDate}
        />
      </div>
      <label className="block text-sm font-semibold text-text-primary">
        Notes
        <textarea
          className="mt-2 min-h-24 w-full rounded-component border border-border bg-surface px-3 py-2 text-sm text-text-primary outline-none focus:border-focus focus:ring-2 focus:ring-focus"
          onChange={(event) =>
            onChange({ ...formState, notes: event.currentTarget.value })
          }
          value={formState.notes}
        />
      </label>
      {showActions ? <div className="flex flex-wrap gap-2">
        <Button disabled={isSubmitting || !canSubmit} type="submit">
          {actionLabel}
        </Button>
        {onCancel && cancelLabel ? (
          <Button
            disabled={isSubmitting}
            onClick={onCancel}
            type="button"
            variant="secondary"
          >
            {cancelLabel}
          </Button>
        ) : null}
      </div> : null}
    </form>
  );
}

function FormInput({
  label,
  onChange,
  required = false,
  type = "text",
  value
}: {
  label: string;
  onChange: (value: string) => void;
  required?: boolean;
  type?: "date" | "email" | "text";
  value: string;
}) {
  return (
    <label className="block text-sm font-semibold text-text-primary">
      {label}
      <input
        className={inputClassName}
        onChange={(event) => onChange(event.currentTarget.value)}
        required={required}
        type={type}
        value={value}
      />
    </label>
  );
}

function PersonnelReadOnlyDetails({
  staffMember
}: {
  staffMember: RegistrationPersonnel;
}) {
  return (
    <RegistrationMetadataGroup
      description="This employment information is read-only with your current authority."
      title="Employment profile"
    >
      <RegistrationMetadataItem label="Full name" value={staffMember.full_name} />
      <RegistrationMetadataItem
        label="Employment status"
        value={displayCode(staffMember.employment_status)}
      />
      <RegistrationMetadataItem label="Email" value={staffMember.email ?? "Not specified"} />
      <RegistrationMetadataItem
        label="Phone"
        value={staffMember.phone_number ?? "Not specified"}
      />
      <RegistrationMetadataItem
        label="Hire date"
        value={staffMember.hire_date ? formatRegistrationDate(staffMember.hire_date) : "Not specified"}
      />
      <RegistrationMetadataItem label="Notes" value={staffMember.notes ?? "Not specified"} />
    </RegistrationMetadataGroup>
  );
}

function RegistrationErrorAlert({ error }: { error: Error | null }) {
  if (!error) {
    return null;
  }

  return (
    <Surface role="alert">
      <p className="text-sm font-semibold text-text-primary">
        {isApiError(error) ? error.message : "Registration request failed."}
      </p>
    </Surface>
  );
}

function RegistrationPersonnelErrorState({ error }: { error: Error }) {
  if (isApiError(error) && error.status === 403) {
    return (
      <SafeState title="Personnel registration is not available with your current authorization.">
        Your current session cannot open Personnel registration records.
      </SafeState>
    );
  }

  return (
    <SafeState title="Personnel registration could not be loaded.">
      The registration service returned an error.
    </SafeState>
  );
}

function SafeState({
  title,
  children,
  role
}: {
  title: string;
  children: string;
  role?: "status";
}) {
  return (
    <Surface role={role}>
      <h1 className="text-xl font-semibold text-text-primary">{title}</h1>
      <p className="mt-2 text-sm text-text-muted">{children}</p>
    </Surface>
  );
}

function buildUpdateRequest(
  formState: PersonnelFormState
): RegistrationPersonnelMutationRequest {
  return {
    full_name: formState.fullName.trim(),
    email: nullableText(formState.email),
    phone_number: nullableText(formState.phoneNumber),
    employment_status: formState.employmentStatus,
    hire_date: nullableText(formState.hireDate),
    notes: nullableText(formState.notes)
  };
}

function formStateFromPersonnel(
  staffMember: RegistrationPersonnel
): PersonnelFormState {
  return {
    clientId: staffMember.client_id ?? "",
    fullName: staffMember.full_name,
    email: staffMember.email ?? "",
    phoneNumber: staffMember.phone_number ?? "",
    employmentStatus: staffMember.employment_status,
    hireDate: staffMember.hire_date ?? "",
    notes: staffMember.notes ?? ""
  };
}

function buildClientNameMap(clients: RegistrationClient[]) {
  return new Map(clients.map((client) => [client.id, client.organization_name]));
}

function clientLabel(clientId: string | null, clientNameById: Map<string, string>) {
  if (!clientId) return "Not client-affiliated";
  const name = clientNameById.get(clientId);

  return name ?? clientId;
}

function personnelAffiliation(staffMember: RegistrationPersonnel): "CLIENT" | "OGI" {
  return staffMember.organizational_affiliation ?? (staffMember.client_id === null ? "OGI" : "CLIENT");
}

function displayCode(value: string) {
  return value
    .split("_")
    .map((part) => `${part.slice(0, 1)}${part.slice(1).toLowerCase()}`)
    .join(" ");
}

function nullableText(value: string) {
  const trimmed = value.trim();

  return trimmed ? trimmed : null;
}

function tabClassName(isSelected: boolean) {
  return [
    "inline-flex min-h-10 items-center rounded-component border px-3 text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
    isSelected
      ? "border-primary-navy bg-primary-navy text-text-inverse shadow-sm"
      : "border-border bg-surface text-text-primary hover:bg-elevated"
  ].join(" ");
}

const inputClassName =
  "mt-2 min-h-10 w-full rounded-component border border-border bg-surface px-3 py-2 text-sm text-text-primary outline-none focus:border-focus focus:ring-2 focus:ring-focus";
