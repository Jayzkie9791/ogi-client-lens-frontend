import { FormEvent, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { isApiError } from "../api/errors";
import { useAuth } from "../auth/useAuth";
import { Button } from "../ui/components/Button";
import { Surface } from "../ui/components/Surface";
import {
  createRegistrationClient,
  getRegistrationClient,
  listRegistrationClients,
  RegistrationClient,
  RegistrationClientMutationRequest,
  RegistrationClientStatus,
  registrationClientStatuses,
  updateRegistrationClient
} from "./registrationClientApi";
import { RegistrationWorkspaceShell } from "./RegistrationWorkspaceShell";

const permissions = {
  view: "view_client",
  create: "create_client",
  update: "update_client",
  deactivate: "deactivate_client"
} as const;

interface ClientFormState {
  organizationName: string;
  contactEmail: string;
  contactPhone: string;
  status: RegistrationClientStatus;
  address: string;
  country: string;
  notes: string;
}

const emptyCreateForm: ClientFormState = {
  organizationName: "",
  contactEmail: "",
  contactPhone: "",
  status: "ACTIVE",
  address: "",
  country: "",
  notes: ""
};

export function RegistrationClientsPage() {
  const auth = useAuth();
  const queryClient = useQueryClient();
  const canView = auth.canUsePermission(permissions.view);
  const canCreate = auth.canUsePermission(permissions.create);
  const canUpdate = auth.canUsePermission(permissions.update);
  const canDeactivate = auth.canUsePermission(permissions.deactivate);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [clientIdBeforeCreate, setClientIdBeforeCreate] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [createForm, setCreateForm] = useState<ClientFormState>(emptyCreateForm);
  const [editForm, setEditForm] = useState<ClientFormState | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const clientsQuery = useQuery({
    queryKey: ["registration-clients"],
    queryFn: () => listRegistrationClients(),
    enabled: canView,
    retry: false
  });
  const clients = useMemo(
    () => clientsQuery.data?.clients ?? [],
    [clientsQuery.data]
  );

  useEffect(() => {
    if (!selectedClientId && clients.length > 0) {
      setSelectedClientId(clients[0].id);
    }
  }, [clients, selectedClientId]);

  const selectedClientQuery = useQuery({
    queryKey: ["registration-client", selectedClientId],
    queryFn: () => getRegistrationClient(selectedClientId ?? ""),
    enabled: canView && selectedClientId !== null,
    retry: false
  });

  useEffect(() => {
    if (selectedClientQuery.data) {
      setEditForm(formStateFromClient(selectedClientQuery.data));
    }
  }, [selectedClientQuery.data]);

  const createMutation = useMutation({
    mutationFn: () => createRegistrationClient(buildCreateRequest(createForm)),
    onSuccess: (client) => {
      setMessage("Client / Organization created successfully.");
      setCreateForm(emptyCreateForm);
      setIsCreating(false);
      setClientIdBeforeCreate(null);
      setSelectedClientId(client.id);
      void queryClient.invalidateQueries({ queryKey: ["registration-clients"] });
      queryClient.setQueryData(["registration-client", client.id], client);
    }
  });

  const updateMutation = useMutation({
    mutationFn: (request: RegistrationClientMutationRequest) => {
      if (!selectedClientId) {
        throw new Error("No Client / Organization is selected.");
      }

      return updateRegistrationClient(selectedClientId, request);
    },
    onSuccess: (client) => {
      setMessage("Client / Organization updated successfully.");
      void queryClient.invalidateQueries({ queryKey: ["registration-clients"] });
      queryClient.setQueryData(["registration-client", client.id], client);
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

  function deactivateSelectedClient() {
    setMessage(null);
    updateMutation.mutate({ status: "INACTIVE" });
  }

  function startCreateClient() {
    setMessage(null);
    setClientIdBeforeCreate(selectedClientId);
    setCreateForm(emptyCreateForm);
    setIsCreating(true);
  }

  function cancelCreateClient() {
    setMessage(null);
    setCreateForm(emptyCreateForm);
    setSelectedClientId(clientIdBeforeCreate);
    setClientIdBeforeCreate(null);
    setIsCreating(false);
  }

  function selectClient(clientId: string) {
    setMessage(null);
    setIsCreating(false);
    setClientIdBeforeCreate(null);
    setSelectedClientId(clientId);
  }

  if (!canView) {
    return (
      <SafeState title="You are not authorized to view Client / Organization registration.">
        Your current session does not include Client / Organization registration authority.
      </SafeState>
    );
  }

  return (
    <RegistrationWorkspaceShell
      description="Manage organizations registered with Client Lens."
      headingId="registration-clients-heading"
      title="Clients / Organizations"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm leading-6 text-text-muted">
            Find existing organizations, review registration details, and maintain lifecycle information.
          </p>
        </div>
        {canCreate ? (
          <Button
            aria-expanded={isCreating}
            onClick={startCreateClient}
            type="button"
          >
            Register Client
          </Button>
        ) : null}
      </div>

      {message ? (
        <Surface role="status">
          <p className="text-sm font-semibold text-text-primary">{message}</p>
        </Surface>
      ) : null}

      <RegistrationErrorAlert error={createMutation.error ?? updateMutation.error} />

      {clientsQuery.isLoading ? (
        <SafeState title="Loading Client / Organization records." role="status">
          Please wait.
        </SafeState>
      ) : clientsQuery.isError ? (
        <RegistrationClientsErrorState error={clientsQuery.error} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(16rem,0.8fr)_minmax(0,1.2fr)]">
          <ClientsList
            clients={clients}
            onSelectClient={selectClient}
            selectedClientId={selectedClientId}
          />
          {isCreating ? (
            <ClientCreatePanel
              formState={createForm}
              isSubmitting={createMutation.isPending}
              onCancel={cancelCreateClient}
              onChange={setCreateForm}
              onSubmit={submitCreateForm}
            />
          ) : clients.length === 0 ? (
            <ClientEmptyDetailPanel canCreate={canCreate} />
          ) : (
            <ClientDetailsPanel
              canDeactivate={canDeactivate}
              canUpdate={canUpdate}
              client={selectedClientQuery.data ?? null}
              editForm={editForm}
              isLoading={selectedClientQuery.isLoading}
              isSubmitting={updateMutation.isPending}
              onDeactivate={deactivateSelectedClient}
              onEditChange={setEditForm}
              onSubmit={submitEditForm}
            />
          )}
        </div>
      )}
    </RegistrationWorkspaceShell>
  );
}

function ClientsList({
  clients,
  onSelectClient,
  selectedClientId
}: {
  clients: RegistrationClient[];
  onSelectClient: (clientId: string) => void;
  selectedClientId: string | null;
}) {
  return (
    <Surface>
      <div className="mb-3">
        <h2 className="text-base font-semibold text-text-primary">Clients</h2>
        <p className="mt-1 text-sm text-text-muted">
          Select an organization to review its registration details.
        </p>
      </div>
      {clients.length === 0 ? (
        <div className="rounded-component border border-dashed border-border p-4">
          <h3 className="text-sm font-semibold text-text-primary">
            No Clients registered yet.
          </h3>
          <p className="mt-2 text-sm text-text-muted">
            Use Register Client to add the first organization when you have create authority.
          </p>
        </div>
      ) : (
        <ul aria-label="Client / Organization records" className="space-y-2">
          {clients.map((client) => {
            const isSelected = selectedClientId === client.id;

            return (
              <li key={client.id}>
                <button
                  aria-current={isSelected ? "true" : undefined}
                  className={[
                    "w-full rounded-component border px-3 py-3 text-left outline-none transition focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
                    isSelected
                      ? "border-primary-navy bg-elevated shadow-sm"
                      : "border-border bg-surface hover:bg-elevated"
                  ].join(" ")}
                  onClick={() => onSelectClient(client.id)}
                  type="button"
                >
                  <span className="block break-words text-sm font-semibold text-text-primary">
                    {client.organization_name}
                  </span>
                  <span className="mt-2 flex flex-wrap gap-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
                    <span>{client.status}</span>
                    {client.country ? <span>{client.country}</span> : null}
                  </span>
                  {client.contact_email ? (
                    <span className="mt-2 block break-words text-sm text-text-muted">
                      {client.contact_email}
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

function ClientDetailsPanel({
  canDeactivate,
  canUpdate,
  client,
  editForm,
  isLoading,
  isSubmitting,
  onDeactivate,
  onEditChange,
  onSubmit
}: {
  canDeactivate: boolean;
  canUpdate: boolean;
  client: RegistrationClient | null;
  editForm: ClientFormState | null;
  isLoading: boolean;
  isSubmitting: boolean;
  onDeactivate: () => void;
  onEditChange: (formState: ClientFormState) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  if (isLoading) {
    return (
      <SafeState title="Loading Client / Organization details." role="status">
        Please wait.
      </SafeState>
    );
  }

  if (!client || !editForm) {
    return (
      <SafeState title="Select a Client / Organization.">
        Choose a registration record to view its details.
      </SafeState>
    );
  }

  return (
    <Surface>
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-text-primary">
            Client / Organization Details
          </h2>
          <p className="mt-1 break-words text-sm font-semibold text-text-muted">
            {client.organization_name}
          </p>
        </div>

        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <MetadataItem label="Client ID" value={client.id} subtle />
          <MetadataItem label="Created" value={client.created_at} />
          <MetadataItem label="Updated" value={client.updated_at} />
        </dl>

        {canUpdate ? (
          <ClientForm
            actionLabel="Save Client / Organization"
            formId="edit-registration-client"
            formState={editForm}
            isSubmitting={isSubmitting}
            onChange={onEditChange}
            onSubmit={onSubmit}
          />
        ) : (
          <ClientReadOnlyDetails client={client} />
        )}

        {canDeactivate && client.status !== "INACTIVE" ? (
          <Button
            disabled={isSubmitting}
            onClick={onDeactivate}
            variant="secondary"
          >
            Deactivate Client / Organization
          </Button>
        ) : null}
      </div>
    </Surface>
  );
}

function ClientCreatePanel({
  formState,
  isSubmitting,
  onCancel,
  onChange,
  onSubmit
}: {
  formState: ClientFormState;
  isSubmitting: boolean;
  onCancel: () => void;
  onChange: (formState: ClientFormState) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <Surface>
      <h2 className="text-lg font-semibold text-text-primary">Register Client</h2>
      <p className="mt-1 text-sm text-text-muted">
        Create a Client / Organization registration record.
      </p>
      <div className="mt-4">
        <ClientForm
          actionLabel="Create Client"
          cancelLabel="Cancel"
          formId="create-registration-client"
          formState={formState}
          isSubmitting={isSubmitting}
          onCancel={onCancel}
          onChange={onChange}
          onSubmit={onSubmit}
        />
      </div>
    </Surface>
  );
}

function ClientEmptyDetailPanel({ canCreate }: { canCreate: boolean }) {
  return (
    <Surface>
      <h2 className="text-base font-semibold text-text-primary">
        No Client selected.
      </h2>
      <p className="mt-2 text-sm leading-6 text-text-muted">
        {canCreate
          ? "Use Register Client to create the first organization."
          : "No Client / Organization records are currently available for your authority."}
      </p>
    </Surface>
  );
}

function ClientForm({
  actionLabel,
  cancelLabel,
  formId,
  formState,
  isSubmitting,
  onCancel,
  onChange,
  onSubmit
}: {
  actionLabel: string;
  cancelLabel?: string;
  formId: string;
  formState: ClientFormState;
  isSubmitting: boolean;
  onCancel?: () => void;
  onChange: (formState: ClientFormState) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form aria-label={actionLabel} className="space-y-4" id={formId} onSubmit={onSubmit}>
      <div className="grid gap-3 md:grid-cols-2">
        <FormInput
          label="Organization name"
          onChange={(organizationName) =>
            onChange({ ...formState, organizationName })
          }
          required
          value={formState.organizationName}
        />
        <label className="block text-sm font-semibold text-text-primary">
          Status
          <select
            className={inputClassName}
            onChange={(event) =>
              onChange({
                ...formState,
                status: event.currentTarget.value as RegistrationClientStatus
              })
            }
            value={formState.status}
          >
            {registrationClientStatuses.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </label>
        <FormInput
          label="Contact email"
          onChange={(contactEmail) => onChange({ ...formState, contactEmail })}
          type="email"
          value={formState.contactEmail}
        />
        <FormInput
          label="Contact phone"
          onChange={(contactPhone) => onChange({ ...formState, contactPhone })}
          value={formState.contactPhone}
        />
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
        <Button disabled={isSubmitting || !formState.organizationName.trim()} type="submit">
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
  type?: "email" | "text";
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

function ClientReadOnlyDetails({ client }: { client: RegistrationClient }) {
  return (
    <dl className="grid gap-2 text-sm sm:grid-cols-2">
      <MetadataItem label="Status" value={client.status} />
      <MetadataItem
        label="Contact email"
        value={client.contact_email ?? "Not specified"}
      />
      <MetadataItem
        label="Contact phone"
        value={client.contact_phone ?? "Not specified"}
      />
      <MetadataItem label="Country" value={client.country ?? "Not specified"} />
      <MetadataItem label="Address" value={client.address ?? "Not specified"} />
      <MetadataItem label="Notes" value={client.notes ?? "Not specified"} />
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

function RegistrationClientsErrorState({ error }: { error: Error }) {
  if (isApiError(error) && error.status === 403) {
    return (
      <SafeState title="Client / Organization registration is not available with your current authorization.">
        Your current session cannot open Client / Organization registration records.
      </SafeState>
    );
  }

  return (
    <SafeState title="Client / Organization registration could not be loaded.">
      The registration service returned an error.
    </SafeState>
  );
}

function MetadataItem({
  label,
  subtle = false,
  value
}: {
  label: string;
  subtle?: boolean;
  value: string;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-semibold uppercase tracking-wide text-text-muted">
        {label}
      </dt>
      <dd
        className={[
          "mt-1 break-words",
          subtle ? "text-xs text-text-muted" : "text-text-primary"
        ].join(" ")}
      >
        {value}
      </dd>
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

function buildCreateRequest(
  formState: ClientFormState
): Required<Pick<RegistrationClientMutationRequest, "organization_name">> &
  RegistrationClientMutationRequest {
  return {
    organization_name: formState.organizationName.trim(),
    status: formState.status,
    contact_email: nullableText(formState.contactEmail),
    contact_phone: nullableText(formState.contactPhone),
    address: nullableText(formState.address),
    country: nullableText(formState.country),
    notes: nullableText(formState.notes)
  };
}

function buildUpdateRequest(
  formState: ClientFormState
): RegistrationClientMutationRequest {
  return buildCreateRequest(formState);
}

function formStateFromClient(client: RegistrationClient): ClientFormState {
  return {
    organizationName: client.organization_name,
    contactEmail: client.contact_email ?? "",
    contactPhone: client.contact_phone ?? "",
    status: client.status,
    address: client.address ?? "",
    country: client.country ?? "",
    notes: client.notes ?? ""
  };
}

function nullableText(value: string) {
  const trimmed = value.trim();

  return trimmed ? trimmed : null;
}

const inputClassName =
  "mt-2 min-h-10 w-full rounded-component border border-border bg-surface px-3 py-2 text-sm text-text-primary outline-none focus:border-focus focus:ring-2 focus:ring-focus";
