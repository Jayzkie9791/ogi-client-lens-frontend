import { FormEvent, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { isApiError } from "../api/errors";
import { routes } from "../app/routePaths";
import { useAuth } from "../auth/useAuth";
import { Button } from "../ui/components/Button";
import { Surface } from "../ui/components/Surface";
import { RecordAccordion } from "../ui/components/RecordAccordion";
import { WorkspaceShell } from "../ui/components/WorkspaceShell";
import {
  listRegistrationClients,
  RegistrationClient
} from "./registrationClientApi";
import {
  createRegistrationFacility,
  getRegistrationFacility,
  listRegistrationFacilities,
  RegistrationFacility,
  RegistrationFacilityMutationRequest,
  RegistrationFacilityOperationalStatus,
  registrationFacilityOperationalStatuses,
  RegistrationFacilityType,
  registrationFacilityTypes,
  updateRegistrationFacility
} from "./registrationFacilityApi";
import { RegistrationWorkspaceShell } from "./RegistrationWorkspaceShell";
import { formatRegistrationDateTime } from "./registrationPresentation";
import {
  RegistrationEditableSection,
  RegistrationMetadataGroup,
  RegistrationMetadataItem,
  RegistrationStatusBadge
} from "./RegistrationWorkspaceUi";

const permissions = {
  viewClients: "view_client",
  view: "view_facility",
  create: "create_facility",
  update: "update_facility",
  deactivate: "deactivate_facility"
} as const;

interface FacilityFormState {
  clientId: string;
  facilityName: string;
  facilityType: RegistrationFacilityType;
  operationalStatus: RegistrationFacilityOperationalStatus;
  address: string;
  country: string;
  timezone: string;
  notes: string;
}

const emptyCreateForm: FacilityFormState = {
  clientId: "",
  facilityName: "",
  facilityType: "POOL",
  operationalStatus: "ACTIVE",
  address: "",
  country: "",
  timezone: "",
  notes: ""
};

export function RegistrationFacilitiesPage({ workspace = "masterlist" }: { workspace?: "registration" | "masterlist" }) {
  const auth = useAuth();
  const queryClient = useQueryClient();
  const canViewClients = auth.canUsePermission(permissions.viewClients);
  const canView = auth.canUsePermission(permissions.view);
  const canCreate = auth.canUsePermission(permissions.create);
  const canUpdate = auth.canUsePermission(permissions.update);
  const canDeactivate = auth.canUsePermission(permissions.deactivate);
  const [clientFilter, setClientFilter] = useState("");
  const [selectedFacilityId, setSelectedFacilityId] = useState<string | null>(null);
  const [createForm, setCreateForm] = useState<FacilityFormState>({
    ...emptyCreateForm,
    clientId: auth.session?.clientId ?? ""
  });
  const [editForm, setEditForm] = useState<FacilityFormState | null>(null);
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
    enabled: canView,
    retry: false
  });
  const facilities = useMemo(
    () => facilitiesQuery.data?.facilities ?? [],
    [facilitiesQuery.data]
  );

  useEffect(() => {
    if (
      selectedFacilityId &&
      facilities.length > 0 &&
      !facilities.some((facility) => facility.id === selectedFacilityId)
    ) {
      setSelectedFacilityId(null);
    }
  }, [facilities, selectedFacilityId]);

  const selectedFacilityQuery = useQuery({
    queryKey: ["registration-facility", selectedFacilityId],
    queryFn: () => getRegistrationFacility(selectedFacilityId ?? ""),
    enabled: canView && selectedFacilityId !== null,
    retry: false
  });

  useEffect(() => {
    if (selectedFacilityQuery.data) {
      setEditForm(formStateFromFacility(selectedFacilityQuery.data));
    }
  }, [selectedFacilityQuery.data]);

  const createMutation = useMutation({
    mutationFn: () => createRegistrationFacility(buildCreateRequest(createForm)),
    onSuccess: (facility) => {
      setMessage("Facility created successfully.");
      setCreateForm({ ...emptyCreateForm, clientId: createForm.clientId });
      setSelectedFacilityId(facility.id);
      void queryClient.invalidateQueries({ queryKey: ["registration-facilities"] });
      queryClient.setQueryData(["registration-facility", facility.id], facility);
    }
  });

  const updateMutation = useMutation({
    mutationFn: (request: RegistrationFacilityMutationRequest) => {
      if (!selectedFacilityId) {
        throw new Error("No Facility is selected.");
      }

      return updateRegistrationFacility(selectedFacilityId, request);
    },
    onSuccess: (facility) => {
      setMessage("Facility updated successfully.");
      void queryClient.invalidateQueries({ queryKey: ["registration-facilities"] });
      queryClient.setQueryData(["registration-facility", facility.id], facility);
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

  function deactivateSelectedFacility() {
    setMessage(null);
    updateMutation.mutate({ operational_status: "INACTIVE" });
  }

  function cancelCreateFacility() {
    setMessage(null);
    setCreateForm({
      ...emptyCreateForm,
      clientId: clientFilter || auth.session?.clientId || createForm.clientId
    });
  }

  function selectFacility(facilityId: string | null) {
    setSelectedFacilityId(facilityId);
  }

  function changeClientFilter(value: string) {
    setClientFilter(value);
    setSelectedFacilityId(null);

    setCreateForm((current) => ({ ...current, clientId: value || current.clientId }));
  }

  if (workspace === "masterlist" && !canView) {
    return (
      <SafeState title="You are not authorized to view Facility registration.">
        Your current session does not include Facility registration authority.
      </SafeState>
    );
  }

  if (workspace === "registration" && !canCreate) {
    return <SafeState title="You are not authorized to register Facilities.">Your current session does not include Facility registration authority.</SafeState>;
  }

  if (workspace === "registration") {
    return <RegistrationWorkspaceShell description="Create a new Facility registration record." headingId="registration-facilities-heading" title="Register Facility">
      {message ? <Surface role="status"><p className="text-sm font-semibold text-text-primary">{message}</p><Link className="mt-3 inline-flex font-semibold text-primary-blue underline" to={routes.facilityMasterlist}>Open Facility Masterlist</Link></Surface> : null}
      <RegistrationErrorAlert error={createMutation.error} />
      <FacilityCreatePanel clients={clients} formState={createForm} isSubmitting={createMutation.isPending} lockClientSelection={!canViewClients} onCancel={cancelCreateFacility} onChange={setCreateForm} onSubmit={submitCreateForm} />
    </RegistrationWorkspaceShell>;
  }

  return (
    <WorkspaceShell
      description="Review and maintain facilities registered with Client Lens."
      headingId="registration-facilities-heading"
      navigation={null}
      sectionDescription="Select a Facility record to review and maintain its operational details."
      sectionTitle="Facility Masterlist"
      showSectionHeader={false}
      title="Facilities"
    >
      {message ? (
        <Surface role="status">
          <p className="text-sm font-semibold text-text-primary">{message}</p>
        </Surface>
      ) : null}

      <RegistrationErrorAlert error={createMutation.error ?? updateMutation.error} />

      {canViewClients ? (
        <ClientFilter
          clients={clients}
          disabled={clientsQuery.isLoading}
          value={clientFilter}
          onChange={changeClientFilter}
        />
      ) : null}

      {facilitiesQuery.isLoading ? (
        <SafeState title="Loading Facility records." role="status">
          Please wait.
        </SafeState>
      ) : facilitiesQuery.isError ? (
        <RegistrationFacilitiesErrorState error={facilitiesQuery.error} />
      ) : (
        facilities.length === 0 ? <FacilityEmptyDetailPanel canCreate={false} scopedToClient={Boolean(clientFilter)} /> : <div aria-label="Facility records" className="space-y-4">{facilities.map((facility) => <RecordAccordion expanded={selectedFacilityId === facility.id} id={`facility-${facility.id}`} key={facility.id} onToggle={() => selectFacility(selectedFacilityId === facility.id ? null : facility.id)} summary={<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs font-bold uppercase tracking-wide text-primary-blue">Facility</p><h2 className="mt-1 text-lg font-semibold text-primary-navy">{facility.facility_name}</h2><p className="mt-1 text-sm text-text-muted">{clientLabel(facility.client_id, clientNameById)} · {displayCode(facility.facility_type)}</p></div><RegistrationStatusBadge value={facility.operational_status} /></div>}>
          {selectedFacilityId === facility.id ? <FacilityDetailsPanel
              canDeactivate={canDeactivate}
              canUpdate={canUpdate}
              clientNameById={clientNameById}
              facility={selectedFacilityQuery.data ?? null}
              editForm={editForm}
              isLoading={selectedFacilityQuery.isLoading}
              isSubmitting={updateMutation.isPending}
              onDeactivate={deactivateSelectedFacility}
              onEditChange={setEditForm}
              onSubmit={submitEditForm}
            /> : null}
        </RecordAccordion>)}</div>
      )}
    </WorkspaceShell>
  );
}

function ClientFilter({
  clients,
  disabled,
  onChange,
  value
}: {
  clients: RegistrationClient[];
  disabled: boolean;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <Surface>
      <label className="block text-sm font-semibold text-text-primary">
        Client filter
        <select
          className={inputClassName}
          disabled={disabled}
          onChange={(event) => onChange(event.currentTarget.value)}
          value={value}
        >
          <option value="">All authorized clients</option>
          {clients.map((client) => (
            <option key={client.id} value={client.id}>
              {client.organization_name}
            </option>
          ))}
        </select>
      </label>
    </Surface>
  );
}

function FacilityDetailsPanel({
  canDeactivate,
  canUpdate,
  clientNameById,
  editForm,
  facility,
  isLoading,
  isSubmitting,
  onDeactivate,
  onEditChange,
  onSubmit
}: {
  canDeactivate: boolean;
  canUpdate: boolean;
  clientNameById: Map<string, string>;
  editForm: FacilityFormState | null;
  facility: RegistrationFacility | null;
  isLoading: boolean;
  isSubmitting: boolean;
  onDeactivate: () => void;
  onEditChange: (formState: FacilityFormState) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  if (isLoading) {
    return (
      <SafeState title="Loading Facility details." role="status">
        Please wait.
      </SafeState>
    );
  }

  if (!facility || !editForm) {
    return (
      <SafeState title="Select a Facility.">
        Choose a Facility registration record to view its details.
      </SafeState>
    );
  }

  return (
      <div className="space-y-4">
        <RegistrationMetadataGroup title="Operational context">
          <RegistrationMetadataItem
            label="Client"
            value={clientLabel(facility.client_id, clientNameById)}
          />
          <RegistrationMetadataItem
            label="Facility type"
            value={displayCode(facility.facility_type)}
          />
        </RegistrationMetadataGroup>

        <RegistrationMetadataGroup description="System references and record history remain available for traceability.">
          <RegistrationMetadataItem label="Administrative Facility ID" value={facility.id} subtle />
          <RegistrationMetadataItem label="Administrative Client ID" value={facility.client_id} subtle />
          <RegistrationMetadataItem label="Created" value={formatRegistrationDateTime(facility.created_at)} />
          <RegistrationMetadataItem label="Updated" value={formatRegistrationDateTime(facility.updated_at)} />
        </RegistrationMetadataGroup>

        {canUpdate ? (
          <RegistrationEditableSection
            description="Update the operational information governed by Facility registration."
            title="Editable Facility information"
          >
            <FacilityForm
              actionLabel="Save Facility"
              clients={[]}
              formId="edit-registration-facility"
              formState={editForm}
              isSubmitting={isSubmitting}
              lockClientSelection
              canChangeOperationalStatus={canDeactivate}
              onChange={onEditChange}
              onSubmit={onSubmit}
            />
          </RegistrationEditableSection>
        ) : (
          <FacilityReadOnlyDetails facility={facility} />
        )}

        {canDeactivate && facility.operational_status !== "INACTIVE" ? (
          <Button disabled={isSubmitting} onClick={onDeactivate} variant="secondary">
            Deactivate Facility
          </Button>
        ) : null}
      </div>
  );
}

function FacilityCreatePanel({
  clients,
  formState,
  isSubmitting,
  lockClientSelection,
  onCancel,
  onChange,
  onSubmit
}: {
  clients: RegistrationClient[];
  formState: FacilityFormState;
  isSubmitting: boolean;
  lockClientSelection: boolean;
  onCancel: () => void;
  onChange: (formState: FacilityFormState) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <Surface>
      <h2 className="text-lg font-semibold text-text-primary">Register Facility</h2>
      <p className="mt-1 text-sm text-text-muted">
        Create a Facility registration record under the selected owning Client.
      </p>
      <div className="mt-4">
        <FacilityForm
          actionLabel="Create Facility"
          cancelLabel="Cancel"
          clients={clients}
          formId="create-registration-facility"
          formState={formState}
          isSubmitting={isSubmitting}
          lockClientSelection={lockClientSelection}
          canChangeOperationalStatus
          onCancel={onCancel}
          onChange={onChange}
          onSubmit={onSubmit}
        />
      </div>
    </Surface>
  );
}

function FacilityEmptyDetailPanel({
  canCreate,
  scopedToClient
}: {
  canCreate: boolean;
  scopedToClient: boolean;
}) {
  return (
    <Surface>
      <h2 className="text-base font-semibold text-text-primary">
        No Facility selected.
      </h2>
      <p className="mt-2 text-sm leading-6 text-text-muted">
        {canCreate
          ? scopedToClient
            ? "Use Register Facility to create the first facility for this Client."
            : "Use Register Facility to create a facility under an authorized Client."
          : "No Facility records are currently available for your authority."}
      </p>
    </Surface>
  );
}

function FacilityForm({
  actionLabel,
  cancelLabel,
  canChangeOperationalStatus,
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
  canChangeOperationalStatus: boolean;
  clients: RegistrationClient[];
  formId: string;
  formState: FacilityFormState;
  isSubmitting: boolean;
  lockClientSelection: boolean;
  onCancel?: () => void;
  onChange: (formState: FacilityFormState) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const canSubmit =
    formState.facilityName.trim().length > 0 && formState.clientId.trim().length > 0;

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
          label="Facility name"
          onChange={(facilityName) => onChange({ ...formState, facilityName })}
          required
          value={formState.facilityName}
        />
        <label className="block text-sm font-semibold text-text-primary">
          Facility type
          <select
            className={inputClassName}
            onChange={(event) =>
              onChange({
                ...formState,
                facilityType: event.currentTarget.value as RegistrationFacilityType
              })
            }
            value={formState.facilityType}
          >
            {registrationFacilityTypes.map((type) => (
              <option key={type} value={type}>
                {displayCode(type)}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-semibold text-text-primary">
          Operational status
          <select
            className={inputClassName}
            disabled={!canChangeOperationalStatus}
            onChange={(event) =>
              onChange({
                ...formState,
                operationalStatus: event.currentTarget
                  .value as RegistrationFacilityOperationalStatus
              })
            }
            value={formState.operationalStatus}
          >
            {registrationFacilityOperationalStatuses.map((status) => (
              <option key={status} value={status}>
                {displayCode(status)}
              </option>
            ))}
          </select>
        </label>
        <FormInput
          label="Country"
          onChange={(country) => onChange({ ...formState, country })}
          value={formState.country}
        />
        <FormInput
          label="Address"
          onChange={(address) => onChange({ ...formState, address })}
          value={formState.address}
        />
        <FormInput
          label="Timezone"
          onChange={(timezone) => onChange({ ...formState, timezone })}
          value={formState.timezone}
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
  value
}: {
  label: string;
  onChange: (value: string) => void;
  required?: boolean;
  value: string;
}) {
  return (
    <label className="block text-sm font-semibold text-text-primary">
      {label}
      <input
        className={inputClassName}
        onChange={(event) => onChange(event.currentTarget.value)}
        required={required}
        value={value}
      />
    </label>
  );
}

function FacilityReadOnlyDetails({ facility }: { facility: RegistrationFacility }) {
  return (
    <RegistrationMetadataGroup
      description="This information is read-only with your current authority."
      title="Facility information"
    >
      <RegistrationMetadataItem label="Facility type" value={displayCode(facility.facility_type)} />
      <RegistrationMetadataItem label="Operational status" value={displayCode(facility.operational_status)} />
      <RegistrationMetadataItem label="Country" value={facility.country ?? "Not specified"} />
      <RegistrationMetadataItem label="Address" value={facility.address ?? "Not specified"} />
      <RegistrationMetadataItem label="Timezone" value={facility.timezone ?? "Not specified"} />
      <RegistrationMetadataItem label="Notes" value={facility.notes ?? "Not specified"} />
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

function RegistrationFacilitiesErrorState({ error }: { error: Error }) {
  if (isApiError(error) && error.status === 403) {
    return (
      <SafeState title="Facility registration is not available with your current authorization.">
        Your current session cannot open Facility registration records.
      </SafeState>
    );
  }

  return (
    <SafeState title="Facility registration could not be loaded.">
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

function buildCreateRequest(formState: FacilityFormState) {
  return {
    client_id: formState.clientId,
    facility_name: formState.facilityName.trim(),
    facility_type: formState.facilityType,
    operational_status: formState.operationalStatus,
    address: nullableText(formState.address),
    country: nullableText(formState.country),
    timezone: nullableText(formState.timezone),
    notes: nullableText(formState.notes)
  };
}

function buildUpdateRequest(
  formState: FacilityFormState
): RegistrationFacilityMutationRequest {
  return {
    facility_name: formState.facilityName.trim(),
    facility_type: formState.facilityType,
    operational_status: formState.operationalStatus,
    address: nullableText(formState.address),
    country: nullableText(formState.country),
    timezone: nullableText(formState.timezone),
    notes: nullableText(formState.notes)
  };
}

function formStateFromFacility(facility: RegistrationFacility): FacilityFormState {
  return {
    clientId: facility.client_id,
    facilityName: facility.facility_name,
    facilityType: facility.facility_type,
    operationalStatus: facility.operational_status,
    address: facility.address ?? "",
    country: facility.country ?? "",
    timezone: facility.timezone ?? "",
    notes: facility.notes ?? ""
  };
}

function buildClientNameMap(clients: RegistrationClient[]) {
  return new Map(clients.map((client) => [client.id, client.organization_name]));
}

function clientLabel(clientId: string, clientNameById: Map<string, string>) {
  const name = clientNameById.get(clientId);

  return name ?? clientId;
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
