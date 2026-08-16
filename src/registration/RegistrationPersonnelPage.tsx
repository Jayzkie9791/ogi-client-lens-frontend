import { FormEvent, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { isApiError } from "../api/errors";
import { useAuth } from "../auth/useAuth";
import { Button } from "../ui/components/Button";
import { Surface } from "../ui/components/Surface";
import {
  listRegistrationClients,
  RegistrationClient
} from "./registrationClientApi";
import {
  listRegistrationFacilities,
  RegistrationFacility
} from "./registrationFacilityApi";
import {
  createRegistrationPersonnel,
  getRegistrationPersonnel,
  listRegistrationPersonnel,
  RegistrationPersonnel,
  RegistrationPersonnelEmploymentStatus,
  RegistrationPersonnelMutationRequest,
  registrationPersonnelEmploymentStatuses,
  updateRegistrationPersonnel
} from "./registrationPersonnelApi";
import { RegistrationFacilityAssignmentsPanel } from "./RegistrationFacilityAssignmentsPanel";
import { RegistrationWorkspaceShell } from "./RegistrationWorkspaceShell";

const permissions = {
  viewClients: "view_client",
  viewFacilities: "view_facility",
  view: "view_staff_member",
  create: "create_staff_member",
  update: "update_staff_member",
  deactivate: "deactivate_staff_member",
  viewFacilityAssignments: "view_facility_assignment"
} as const;

type PersonnelSecondaryTab = "overview" | "facilities";

interface PersonnelFormState {
  clientId: string;
  fullName: string;
  email: string;
  phoneNumber: string;
  employmentStatus: RegistrationPersonnelEmploymentStatus;
  hireDate: string;
  notes: string;
}

const emptyCreateForm: PersonnelFormState = {
  clientId: "",
  fullName: "",
  email: "",
  phoneNumber: "",
  employmentStatus: "ACTIVE",
  hireDate: "",
  notes: ""
};

export function RegistrationPersonnelPage() {
  const auth = useAuth();
  const queryClient = useQueryClient();
  const canViewClients = auth.canUsePermission(permissions.viewClients);
  const canViewFacilities = auth.canUsePermission(permissions.viewFacilities);
  const canView = auth.canUsePermission(permissions.view);
  const canCreate = auth.canUsePermission(permissions.create);
  const canUpdate = auth.canUsePermission(permissions.update);
  const canDeactivate = auth.canUsePermission(permissions.deactivate);
  const canViewFacilityAssignments = auth.canUsePermission(
    permissions.viewFacilityAssignments
  );
  const [clientFilter, setClientFilter] = useState("");
  const [facilityFilter, setFacilityFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    RegistrationPersonnelEmploymentStatus | ""
  >("");
  const [selectedPersonnelId, setSelectedPersonnelId] = useState<string | null>(null);
  const [personnelIdBeforeCreate, setPersonnelIdBeforeCreate] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [selectedTab, setSelectedTab] = useState<PersonnelSecondaryTab>("overview");
  const [createForm, setCreateForm] = useState<PersonnelFormState>({
    ...emptyCreateForm,
    clientId: auth.session?.clientId ?? ""
  });
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

  useEffect(() => {
    if (!createForm.clientId && clients.length > 0) {
      setCreateForm((current) => ({ ...current, clientId: clients[0].id }));
    }
  }, [clients, createForm.clientId]);

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
    if (!selectedPersonnelId && personnel.length > 0) {
      setSelectedPersonnelId(personnel[0].id);
    }

    if (
      selectedPersonnelId &&
      personnel.length > 0 &&
      !personnel.some((staffMember) => staffMember.id === selectedPersonnelId)
    ) {
      setSelectedPersonnelId(personnel[0].id);
      setSelectedTab("overview");
    }

    if (selectedPersonnelId && personnel.length === 0) {
      setSelectedPersonnelId(null);
      setSelectedTab("overview");
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

  const createMutation = useMutation({
    mutationFn: () => createRegistrationPersonnel(buildCreateRequest(createForm)),
    onSuccess: (staffMember) => {
      setMessage("Personnel record created successfully.");
      setCreateForm({ ...emptyCreateForm, clientId: createForm.clientId });
      setSelectedPersonnelId(staffMember.id);
      setPersonnelIdBeforeCreate(null);
      setIsCreating(false);
      setSelectedTab("overview");
      void queryClient.invalidateQueries({ queryKey: ["registration-personnel"] });
      queryClient.setQueryData(
        ["registration-personnel", staffMember.id],
        staffMember
      );
    }
  });

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

  function submitCreateForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    createMutation.mutate();
  }

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

  function startCreatePersonnel() {
    setMessage(null);
    setPersonnelIdBeforeCreate(selectedPersonnelId);
    setCreateForm({
      ...emptyCreateForm,
      clientId:
        clientFilter ||
        auth.session?.clientId ||
        createForm.clientId ||
        clients[0]?.id ||
        ""
    });
    setIsCreating(true);
    setSelectedTab("overview");
  }

  function cancelCreatePersonnel() {
    setMessage(null);
    setCreateForm({
      ...emptyCreateForm,
      clientId: clientFilter || auth.session?.clientId || createForm.clientId
    });
    setSelectedPersonnelId(personnelIdBeforeCreate);
    setPersonnelIdBeforeCreate(null);
    setIsCreating(false);
    setSelectedTab("overview");
  }

  function selectPersonnel(staffMemberId: string) {
    setIsCreating(false);
    setPersonnelIdBeforeCreate(null);
    setSelectedPersonnelId(staffMemberId);
    setSelectedTab("overview");
  }

  function changeClientFilter(value: string) {
    setClientFilter(value);
    setFacilityFilter("");
    setSelectedPersonnelId(null);
    setSelectedTab("overview");

    if (isCreating && value) {
      setCreateForm((current) => ({ ...current, clientId: value }));
    }
  }

  function changeFacilityFilter(value: string) {
    setFacilityFilter(value);
    setSelectedPersonnelId(null);
    setSelectedTab("overview");
  }

  function changeStatusFilter(value: RegistrationPersonnelEmploymentStatus | "") {
    setStatusFilter(value);
    setSelectedPersonnelId(null);
    setSelectedTab("overview");
  }

  if (!canView) {
    return (
      <SafeState title="You are not authorized to view Personnel registration.">
        Your current session does not include Personnel registration authority.
      </SafeState>
    );
  }

  return (
    <RegistrationWorkspaceShell
      description="Manage personnel registered with Client Lens."
      headingId="registration-personnel-heading"
      title="Personnel"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm leading-6 text-text-muted">
            Find personnel, review profile details, and manage where each person works.
          </p>
        </div>
        {canCreate ? (
          <Button
            aria-expanded={isCreating}
            onClick={startCreatePersonnel}
            type="button"
          >
            Register Personnel
          </Button>
        ) : null}
      </div>

      {message ? (
        <Surface role="status">
          <p className="text-sm font-semibold text-text-primary">{message}</p>
        </Surface>
      ) : null}

      <RegistrationErrorAlert error={createMutation.error ?? updateMutation.error} />

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
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(16rem,0.8fr)_minmax(0,1.2fr)]">
          <PersonnelList
            clientNameById={clientNameById}
            onSelectPersonnel={selectPersonnel}
            personnel={personnel}
            selectedPersonnelId={selectedPersonnelId}
          />
          {isCreating ? (
            <PersonnelCreatePanel
              clients={clients}
              formState={createForm}
              isSubmitting={createMutation.isPending}
              lockClientSelection={!canViewClients}
              onCancel={cancelCreatePersonnel}
              onChange={setCreateForm}
              onSubmit={submitCreateForm}
            />
          ) : personnel.length === 0 ? (
            <PersonnelEmptyDetailPanel canCreate={canCreate} />
          ) : (
            <PersonnelDetailsPanel
              canDeactivate={canDeactivate}
              canUpdate={canUpdate}
              canViewFacilityAssignments={canViewFacilityAssignments}
              clientNameById={clientNameById}
              editForm={editForm}
              isLoading={selectedPersonnelQuery.isLoading}
              isSubmitting={updateMutation.isPending}
              onDeactivate={deactivateSelectedPersonnel}
              onEditChange={setEditForm}
              onSubmit={submitEditForm}
              onTabChange={setSelectedTab}
              selectedTab={selectedTab}
              staffMember={selectedPersonnelQuery.data ?? null}
            />
          )}
        </div>
      )}
    </RegistrationWorkspaceShell>
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

function PersonnelList({
  clientNameById,
  onSelectPersonnel,
  personnel,
  selectedPersonnelId
}: {
  clientNameById: Map<string, string>;
  onSelectPersonnel: (staffMemberId: string) => void;
  personnel: RegistrationPersonnel[];
  selectedPersonnelId: string | null;
}) {
  return (
    <Surface>
      <div className="mb-3">
        <h2 className="text-base font-semibold text-text-primary">Personnel records</h2>
        <p className="mt-1 text-sm text-text-muted">
          Select a person to review profile details.
        </p>
      </div>
      {personnel.length === 0 ? (
        <div className="rounded-component border border-dashed border-border p-4">
          <h3 className="text-sm font-semibold text-text-primary">
            No Personnel match the current filters.
          </h3>
          <p className="mt-2 text-sm text-text-muted">
            Use Register Personnel to add a person when you have create authority.
          </p>
        </div>
      ) : (
        <ul aria-label="Personnel records" className="space-y-2">
          {personnel.map((staffMember) => {
            const isSelected = selectedPersonnelId === staffMember.id;

            return (
              <li key={staffMember.id}>
                <button
                  aria-current={isSelected ? "true" : undefined}
                  className={[
                    "w-full rounded-component border px-3 py-3 text-left outline-none transition focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
                    isSelected
                      ? "border-primary-navy bg-elevated shadow-sm"
                      : "border-border bg-surface hover:bg-elevated"
                  ].join(" ")}
                  onClick={() => onSelectPersonnel(staffMember.id)}
                  type="button"
                >
                  <span className="block break-words text-sm font-semibold text-text-primary">
                    {staffMember.full_name}
                  </span>
                  <span className="mt-2 flex flex-wrap gap-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
                    <span>{displayCode(staffMember.employment_status)}</span>
                    {staffMember.hire_date ? <span>Hired {staffMember.hire_date}</span> : null}
                  </span>
                  <span className="mt-2 block break-words text-sm text-text-muted">
                    {clientLabel(staffMember.client_id, clientNameById)}
                  </span>
                  {staffMember.email ? (
                    <span className="mt-2 block break-words text-sm text-text-muted">
                      {staffMember.email}
                    </span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Surface>
  );
}

function PersonnelDetailsPanel({
  canDeactivate,
  canUpdate,
  canViewFacilityAssignments,
  clientNameById,
  editForm,
  isLoading,
  isSubmitting,
  onDeactivate,
  onEditChange,
  onSubmit,
  onTabChange,
  selectedTab,
  staffMember
}: {
  canDeactivate: boolean;
  canUpdate: boolean;
  canViewFacilityAssignments: boolean;
  clientNameById: Map<string, string>;
  editForm: PersonnelFormState | null;
  isLoading: boolean;
  isSubmitting: boolean;
  onDeactivate: () => void;
  onEditChange: (formState: PersonnelFormState) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onTabChange: (tab: PersonnelSecondaryTab) => void;
  selectedTab: PersonnelSecondaryTab;
  staffMember: RegistrationPersonnel | null;
}) {
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
          <div>
            <h2 className="text-lg font-semibold text-text-primary">
              {staffMember.full_name}
            </h2>
            <p className="mt-1 break-words text-sm text-text-muted">
              {displayCode(staffMember.employment_status)} - {clientLabel(staffMember.client_id, clientNameById)}
            </p>
            {staffMember.email ? (
              <p className="mt-1 break-words text-sm text-text-muted">{staffMember.email}</p>
            ) : null}
          </div>

          <PersonnelSecondaryNavigation
            canViewFacilityAssignments={canViewFacilityAssignments}
            onTabChange={onTabChange}
            selectedTab={selectedTab}
          />

          {selectedTab === "overview" ? (
            <PersonnelOverview
              canDeactivate={canDeactivate}
              canUpdate={canUpdate}
              clientNameById={clientNameById}
              editForm={editForm}
              isSubmitting={isSubmitting}
              onDeactivate={onDeactivate}
              onEditChange={onEditChange}
              onSubmit={onSubmit}
              staffMember={staffMember}
            />
          ) : null}
        </div>
      </Surface>

      {selectedTab === "facilities" && canViewFacilityAssignments ? (
        <div
          aria-labelledby="personnel-facilities-tab"
          id="personnel-facilities-panel"
          role="tabpanel"
        >
          <RegistrationFacilityAssignmentsPanel staffMember={staffMember} />
        </div>
      ) : null}
    </div>
  );
}

function PersonnelSecondaryNavigation({
  canViewFacilityAssignments,
  onTabChange,
  selectedTab
}: {
  canViewFacilityAssignments: boolean;
  onTabChange: (tab: PersonnelSecondaryTab) => void;
  selectedTab: PersonnelSecondaryTab;
}) {
  return (
    <div aria-label="Personnel detail sections" className="flex flex-wrap gap-2" role="tablist">
      <button
        aria-controls="personnel-overview-panel"
        aria-selected={selectedTab === "overview"}
        className={tabClassName(selectedTab === "overview")}
        id="personnel-overview-tab"
        onClick={() => onTabChange("overview")}
        role="tab"
        type="button"
      >
        Overview
      </button>
      {canViewFacilityAssignments ? (
        <button
          aria-controls="personnel-facilities-panel"
          aria-selected={selectedTab === "facilities"}
          className={tabClassName(selectedTab === "facilities")}
          id="personnel-facilities-tab"
          onClick={() => onTabChange("facilities")}
          role="tab"
          type="button"
        >
          Facilities
        </button>
      ) : null}
    </div>
  );
}

function PersonnelOverview({
  canDeactivate,
  canUpdate,
  clientNameById,
  editForm,
  isSubmitting,
  onDeactivate,
  onEditChange,
  onSubmit,
  staffMember
}: {
  canDeactivate: boolean;
  canUpdate: boolean;
  clientNameById: Map<string, string>;
  editForm: PersonnelFormState;
  isSubmitting: boolean;
  onDeactivate: () => void;
  onEditChange: (formState: PersonnelFormState) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  staffMember: RegistrationPersonnel;
}) {
  return (
    <div
      aria-labelledby="personnel-overview-tab"
      className="space-y-4"
      id="personnel-overview-panel"
      role="tabpanel"
    >
      <dl className="grid gap-2 text-sm sm:grid-cols-2">
        <MetadataItem
          label="Client"
          value={clientLabel(staffMember.client_id, clientNameById)}
        />
        <MetadataItem label="Personnel ID" value={staffMember.id} />
        <MetadataItem label="Client ID" value={staffMember.client_id} />
        <MetadataItem
          label="Platform user"
          value={staffMember.user_id ?? "No linked user account"}
        />
        <MetadataItem label="Created" value={staffMember.created_at} />
        <MetadataItem label="Updated" value={staffMember.updated_at} />
      </dl>

      {canUpdate ? (
        <PersonnelForm
          actionLabel="Save Personnel"
          clients={[]}
          formId="edit-registration-personnel"
          formState={editForm}
          isSubmitting={isSubmitting}
          lockClientSelection
          onChange={onEditChange}
          onSubmit={onSubmit}
        />
      ) : (
        <PersonnelReadOnlyDetails staffMember={staffMember} />
      )}

      {canDeactivate && staffMember.employment_status !== "INACTIVE" ? (
        <Button disabled={isSubmitting} onClick={onDeactivate} variant="secondary">
          Deactivate Personnel
        </Button>
      ) : null}
    </div>
  );
}

function PersonnelCreatePanel({
  clients,
  formState,
  isSubmitting,
  lockClientSelection,
  onCancel,
  onChange,
  onSubmit
}: {
  clients: RegistrationClient[];
  formState: PersonnelFormState;
  isSubmitting: boolean;
  lockClientSelection: boolean;
  onCancel: () => void;
  onChange: (formState: PersonnelFormState) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <Surface>
      <h2 className="text-lg font-semibold text-text-primary">Register Personnel</h2>
      <p className="mt-1 text-sm text-text-muted">
        Create a Personnel profile under the selected Client.
      </p>
      <div className="mt-4">
        <PersonnelForm
          actionLabel="Create Personnel"
          cancelLabel="Cancel"
          clients={clients}
          formId="create-registration-personnel"
          formState={formState}
          isSubmitting={isSubmitting}
          lockClientSelection={lockClientSelection}
          onCancel={onCancel}
          onChange={onChange}
          onSubmit={onSubmit}
        />
      </div>
    </Surface>
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
  onCancel,
  onChange,
  onSubmit
}: {
  actionLabel: string;
  cancelLabel?: string;
  clients: RegistrationClient[];
  formId: string;
  formState: PersonnelFormState;
  isSubmitting: boolean;
  lockClientSelection: boolean;
  onCancel?: () => void;
  onChange: (formState: PersonnelFormState) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const canSubmit =
    formState.fullName.trim().length > 0 && formState.clientId.trim().length > 0;

  return (
    <form aria-label={actionLabel} className="space-y-4" id={formId} onSubmit={onSubmit}>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="block text-sm font-semibold text-text-primary">
          Client
          {lockClientSelection ? (
            <input className={inputClassName} readOnly value={formState.clientId} />
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
      <div className="flex flex-wrap gap-2">
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
      </div>
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
    <dl className="grid gap-2 text-sm sm:grid-cols-2">
      <MetadataItem label="Full name" value={staffMember.full_name} />
      <MetadataItem
        label="Employment status"
        value={displayCode(staffMember.employment_status)}
      />
      <MetadataItem label="Email" value={staffMember.email ?? "Not specified"} />
      <MetadataItem
        label="Phone"
        value={staffMember.phone_number ?? "Not specified"}
      />
      <MetadataItem
        label="Hire date"
        value={staffMember.hire_date ?? "Not specified"}
      />
      <MetadataItem label="Notes" value={staffMember.notes ?? "Not specified"} />
    </dl>
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

function MetadataItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-semibold uppercase tracking-wide text-text-muted">
        {label}
      </dt>
      <dd className="mt-1 break-words text-text-primary">{value}</dd>
    </div>
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

function buildCreateRequest(formState: PersonnelFormState) {
  return {
    client_id: formState.clientId,
    full_name: formState.fullName.trim(),
    email: nullableText(formState.email),
    phone_number: nullableText(formState.phoneNumber),
    employment_status: formState.employmentStatus,
    hire_date: nullableText(formState.hireDate),
    notes: nullableText(formState.notes)
  };
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
    clientId: staffMember.client_id,
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

function clientLabel(clientId: string, clientNameById: Map<string, string>) {
  const name = clientNameById.get(clientId);

  return name ? `${name} (${clientId})` : clientId;
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
