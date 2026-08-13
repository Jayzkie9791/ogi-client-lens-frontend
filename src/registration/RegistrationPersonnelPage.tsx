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
import { RegistrationNavigation } from "./RegistrationNavigation";

const permissions = {
  viewClients: "view_client",
  viewFacilities: "view_facility",
  view: "view_staff_member",
  create: "create_staff_member",
  update: "update_staff_member",
  deactivate: "deactivate_staff_member"
} as const;

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
  const [clientFilter, setClientFilter] = useState("");
  const [facilityFilter, setFacilityFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    RegistrationPersonnelEmploymentStatus | ""
  >("");
  const [selectedPersonnelId, setSelectedPersonnelId] = useState<string | null>(null);
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

  if (!canView) {
    return (
      <SafeState title="You are not authorized to view Personnel registration.">
        Your current session does not include Personnel registration authority.
      </SafeState>
    );
  }

  return (
    <section aria-labelledby="registration-personnel-heading" className="space-y-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-primary-blue">
          Registration
        </p>
        <h1
          className="mt-2 text-2xl font-semibold text-text-primary"
          id="registration-personnel-heading"
        >
          Personnel
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-text-muted">
          Manage durable workforce identity records without creating platform users, facility assignments, credentials, or Operational Evidence.
        </p>
      </div>

      <RegistrationNavigation />

      {message ? (
        <Surface role="status">
          <p className="text-sm font-semibold text-text-primary">{message}</p>
        </Surface>
      ) : null}

      <RegistrationErrorAlert error={createMutation.error ?? updateMutation.error} />

      {canCreate ? (
        <PersonnelFormSurface
          actionLabel="Create Personnel"
          clients={clients}
          formId="create-registration-personnel"
          formState={createForm}
          isSubmitting={createMutation.isPending}
          lockClientSelection={!canViewClients}
          onChange={setCreateForm}
          onSubmit={submitCreateForm}
          title="Create Personnel"
        />
      ) : null}

      <PersonnelFilters
        canViewClients={canViewClients}
        canViewFacilities={canViewFacilities}
        clientFilter={clientFilter}
        clients={clients}
        facilityFilter={facilityFilter}
        facilities={facilities}
        facilitiesLoading={facilitiesQuery.isLoading}
        onClientFilterChange={(value) => {
          setClientFilter(value);
          setFacilityFilter("");
          setSelectedPersonnelId(null);
        }}
        onFacilityFilterChange={(value) => {
          setFacilityFilter(value);
          setSelectedPersonnelId(null);
        }}
        onStatusFilterChange={(value) => {
          setStatusFilter(value);
          setSelectedPersonnelId(null);
        }}
        statusFilter={statusFilter}
      />

      {personnelQuery.isLoading ? (
        <SafeState title="Loading Personnel records." role="status">
          Please wait.
        </SafeState>
      ) : personnelQuery.isError ? (
        <RegistrationPersonnelErrorState error={personnelQuery.error} />
      ) : personnel.length === 0 ? (
        <Surface>
          <h2 className="text-base font-semibold text-text-primary">
            No Personnel records are currently available.
          </h2>
          <p className="mt-2 text-sm leading-6 text-text-muted">
            The registration service did not return any Personnel records for your current authority.
          </p>
        </Surface>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,28rem)]">
          <PersonnelList
            clientNameById={clientNameById}
            onSelectPersonnel={setSelectedPersonnelId}
            personnel={personnel}
            selectedPersonnelId={selectedPersonnelId}
          />
          <PersonnelDetailsPanel
            canDeactivate={canDeactivate}
            canUpdate={canUpdate}
            clientNameById={clientNameById}
            editForm={editForm}
            isLoading={selectedPersonnelQuery.isLoading}
            isSubmitting={updateMutation.isPending}
            onDeactivate={deactivateSelectedPersonnel}
            onEditChange={setEditForm}
            onSubmit={submitEditForm}
            staffMember={selectedPersonnelQuery.data ?? null}
          />
        </div>
      )}
    </section>
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
    <ul aria-label="Personnel records" className="space-y-3">
      {personnel.map((staffMember) => (
        <li key={staffMember.id}>
          <Surface className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 space-y-3">
              <div>
                <h2 className="break-words text-lg font-semibold text-text-primary">
                  {staffMember.full_name}
                </h2>
                <p className="mt-1 break-all text-sm text-text-muted">
                  Personnel ID {staffMember.id}
                </p>
              </div>
              <dl className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
                <MetadataItem
                  label="Client"
                  value={clientLabel(staffMember.client_id, clientNameById)}
                />
                <MetadataItem
                  label="Employment status"
                  value={displayCode(staffMember.employment_status)}
                />
                <MetadataItem
                  label="Hire date"
                  value={staffMember.hire_date ?? "Not specified"}
                />
                <MetadataItem
                  label="Email"
                  value={staffMember.email ?? "Not specified"}
                />
                <MetadataItem
                  label="Phone"
                  value={staffMember.phone_number ?? "Not specified"}
                />
              </dl>
            </div>
            <Button
              aria-pressed={selectedPersonnelId === staffMember.id}
              onClick={() => onSelectPersonnel(staffMember.id)}
              variant="secondary"
            >
              View details
            </Button>
          </Surface>
        </li>
      ))}
    </ul>
  );
}

function PersonnelDetailsPanel({
  canDeactivate,
  canUpdate,
  clientNameById,
  editForm,
  isLoading,
  isSubmitting,
  onDeactivate,
  onEditChange,
  onSubmit,
  staffMember
}: {
  canDeactivate: boolean;
  canUpdate: boolean;
  clientNameById: Map<string, string>;
  editForm: PersonnelFormState | null;
  isLoading: boolean;
  isSubmitting: boolean;
  onDeactivate: () => void;
  onEditChange: (formState: PersonnelFormState) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
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
    <Surface>
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-text-primary">
            Personnel Details
          </h2>
          <p className="mt-1 break-all text-sm text-text-muted">{staffMember.id}</p>
        </div>

        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <MetadataItem
            label="Client"
            value={clientLabel(staffMember.client_id, clientNameById)}
          />
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
    </Surface>
  );
}

function PersonnelFormSurface({
  actionLabel,
  clients,
  formId,
  formState,
  isSubmitting,
  lockClientSelection,
  onChange,
  onSubmit,
  title
}: {
  actionLabel: string;
  clients: RegistrationClient[];
  formId: string;
  formState: PersonnelFormState;
  isSubmitting: boolean;
  lockClientSelection: boolean;
  onChange: (formState: PersonnelFormState) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  title: string;
}) {
  return (
    <Surface>
      <h2 className="text-base font-semibold text-text-primary">{title}</h2>
      <div className="mt-4">
        <PersonnelForm
          actionLabel={actionLabel}
          clients={clients}
          formId={formId}
          formState={formState}
          isSubmitting={isSubmitting}
          lockClientSelection={lockClientSelection}
          onChange={onChange}
          onSubmit={onSubmit}
        />
      </div>
    </Surface>
  );
}

function PersonnelForm({
  actionLabel,
  clients,
  formId,
  formState,
  isSubmitting,
  lockClientSelection,
  onChange,
  onSubmit
}: {
  actionLabel: string;
  clients: RegistrationClient[];
  formId: string;
  formState: PersonnelFormState;
  isSubmitting: boolean;
  lockClientSelection: boolean;
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
      <Button disabled={isSubmitting || !canSubmit} type="submit">
        {actionLabel}
      </Button>
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

const inputClassName =
  "mt-2 min-h-10 w-full rounded-component border border-border bg-surface px-3 py-2 text-sm text-text-primary outline-none focus:border-focus focus:ring-2 focus:ring-focus";
