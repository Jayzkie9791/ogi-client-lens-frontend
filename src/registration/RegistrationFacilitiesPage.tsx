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
import { RegistrationNavigation } from "./RegistrationNavigation";

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

export function RegistrationFacilitiesPage() {
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
    if (!selectedFacilityId && facilities.length > 0) {
      setSelectedFacilityId(facilities[0].id);
    }

    if (
      selectedFacilityId &&
      facilities.length > 0 &&
      !facilities.some((facility) => facility.id === selectedFacilityId)
    ) {
      setSelectedFacilityId(facilities[0].id);
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

  if (!canView) {
    return (
      <SafeState title="You are not authorized to view Facility registration.">
        Your current session does not include Facility registration authority.
      </SafeState>
    );
  }

  return (
    <section aria-labelledby="registration-facilities-heading" className="space-y-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-primary-blue">
          Registration
        </p>
        <h1
          className="mt-2 text-2xl font-semibold text-text-primary"
          id="registration-facilities-heading"
        >
          Facilities
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-text-muted">
          Manage durable Facility registration records without changing Operational Evidence working context.
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
        <FacilityFormSurface
          actionLabel="Create Facility"
          clients={clients}
          formId="create-registration-facility"
          formState={createForm}
          isSubmitting={createMutation.isPending}
          lockClientSelection={!canViewClients}
          onChange={setCreateForm}
          onSubmit={submitCreateForm}
          title="Create Facility"
        />
      ) : null}

      {canViewClients ? (
        <ClientFilter
          clients={clients}
          disabled={clientsQuery.isLoading}
          value={clientFilter}
          onChange={(value) => {
            setClientFilter(value);
            setSelectedFacilityId(null);
          }}
        />
      ) : null}

      {facilitiesQuery.isLoading ? (
        <SafeState title="Loading Facility records." role="status">
          Please wait.
        </SafeState>
      ) : facilitiesQuery.isError ? (
        <RegistrationFacilitiesErrorState error={facilitiesQuery.error} />
      ) : facilities.length === 0 ? (
        <Surface>
          <h2 className="text-base font-semibold text-text-primary">
            No Facility records are currently available.
          </h2>
          <p className="mt-2 text-sm leading-6 text-text-muted">
            The registration service did not return any Facility records for your current authority.
          </p>
        </Surface>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,28rem)]">
          <FacilitiesList
            clientNameById={clientNameById}
            facilities={facilities}
            onSelectFacility={setSelectedFacilityId}
            selectedFacilityId={selectedFacilityId}
          />
          <FacilityDetailsPanel
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
          />
        </div>
      )}
    </section>
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

function FacilitiesList({
  clientNameById,
  facilities,
  onSelectFacility,
  selectedFacilityId
}: {
  clientNameById: Map<string, string>;
  facilities: RegistrationFacility[];
  onSelectFacility: (facilityId: string) => void;
  selectedFacilityId: string | null;
}) {
  return (
    <ul aria-label="Facility records" className="space-y-3">
      {facilities.map((facility) => (
        <li key={facility.id}>
          <Surface className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 space-y-3">
              <div>
                <h2 className="break-words text-lg font-semibold text-text-primary">
                  {facility.facility_name}
                </h2>
                <p className="mt-1 break-all text-sm text-text-muted">
                  Facility ID {facility.id}
                </p>
              </div>
              <dl className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
                <MetadataItem label="Client" value={clientLabel(facility.client_id, clientNameById)} />
                <MetadataItem label="Type" value={displayCode(facility.facility_type)} />
                <MetadataItem label="Status" value={displayCode(facility.operational_status)} />
                <MetadataItem label="Country" value={facility.country ?? "Not specified"} />
                <MetadataItem label="Timezone" value={facility.timezone ?? "Not specified"} />
              </dl>
            </div>
            <Button
              aria-pressed={selectedFacilityId === facility.id}
              onClick={() => onSelectFacility(facility.id)}
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
    <Surface>
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-text-primary">
            Facility Details
          </h2>
          <p className="mt-1 break-all text-sm text-text-muted">{facility.id}</p>
        </div>

        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <MetadataItem label="Client" value={clientLabel(facility.client_id, clientNameById)} />
          <MetadataItem label="Client ID" value={facility.client_id} />
          <MetadataItem label="Created" value={facility.created_at} />
          <MetadataItem label="Updated" value={facility.updated_at} />
        </dl>

        {canUpdate ? (
          <FacilityForm
            actionLabel="Save Facility"
            clients={[]}
            formId="edit-registration-facility"
            formState={editForm}
            isSubmitting={isSubmitting}
            lockClientSelection
            onChange={onEditChange}
            onSubmit={onSubmit}
          />
        ) : (
          <FacilityReadOnlyDetails facility={facility} />
        )}

        {canDeactivate && facility.operational_status !== "INACTIVE" ? (
          <Button disabled={isSubmitting} onClick={onDeactivate} variant="secondary">
            Deactivate Facility
          </Button>
        ) : null}
      </div>
    </Surface>
  );
}

function FacilityFormSurface({
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
  formState: FacilityFormState;
  isSubmitting: boolean;
  lockClientSelection: boolean;
  onChange: (formState: FacilityFormState) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  title: string;
}) {
  return (
    <Surface>
      <h2 className="text-base font-semibold text-text-primary">{title}</h2>
      <div className="mt-4">
        <FacilityForm
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

function FacilityForm({
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
  formState: FacilityFormState;
  isSubmitting: boolean;
  lockClientSelection: boolean;
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
    <dl className="grid gap-2 text-sm sm:grid-cols-2">
      <MetadataItem label="Facility type" value={displayCode(facility.facility_type)} />
      <MetadataItem label="Operational status" value={displayCode(facility.operational_status)} />
      <MetadataItem label="Country" value={facility.country ?? "Not specified"} />
      <MetadataItem label="Address" value={facility.address ?? "Not specified"} />
      <MetadataItem label="Timezone" value={facility.timezone ?? "Not specified"} />
      <MetadataItem label="Notes" value={facility.notes ?? "Not specified"} />
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