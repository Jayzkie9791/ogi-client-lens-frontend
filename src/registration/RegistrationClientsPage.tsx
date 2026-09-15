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
import { formatRegistrationDateTime } from "./registrationPresentation";
import {
  RegistrationEditableSection,
  RegistrationMetadataGroup,
  RegistrationMetadataItem,
  RegistrationStatusBadge
} from "./RegistrationWorkspaceUi";

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

export function RegistrationClientsPage({ workspace = "masterlist" }: { workspace?: "registration" | "masterlist" }) {
  const auth = useAuth();
  const queryClient = useQueryClient();
  const canView = auth.canUsePermission(permissions.view);
  const canCreate = auth.canUsePermission(permissions.create);
  const canUpdate = auth.canUsePermission(permissions.update);
  const canDeactivate = auth.canUsePermission(permissions.deactivate);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
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
    if (selectedClientId && !clients.some((client) => client.id === selectedClientId)) {
      setSelectedClientId(null);
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

  function selectClient(clientId: string | null) {
    setMessage(null);
    setSelectedClientId(clientId);
  }

  if (workspace === "masterlist" && !canView) {
    return (
      <SafeState title="You are not authorized to view Client / Organization registration.">
        Your current session does not include Client / Organization registration authority.
      </SafeState>
    );
  }

  if (workspace === "registration" && !canCreate) {
    return <SafeState title="You are not authorized to register Clients / Organizations.">Your current session does not include Client registration authority.</SafeState>;
  }

  if (workspace === "registration") {
    return <RegistrationWorkspaceShell description="Create a new organization registration record." headingId="registration-clients-heading" title="Register Client / Organization">
      {message ? <Surface role="status"><p className="text-sm font-semibold text-text-primary">{message}</p><Link className="mt-3 inline-flex font-semibold text-primary-blue underline" to={routes.clientMasterlist}>Open Client Masterlist</Link></Surface> : null}
      <RegistrationErrorAlert error={createMutation.error} />
      <ClientCreatePanel formState={createForm} isSubmitting={createMutation.isPending} onCancel={() => setCreateForm(emptyCreateForm)} onChange={setCreateForm} onSubmit={submitCreateForm} />
    </RegistrationWorkspaceShell>;
  }

  return (
    <WorkspaceShell
      description="Review and maintain organizations registered with Client Lens."
      headingId="registration-clients-heading"
      navigation={null}
      sectionDescription="Select a Client record to review and maintain its registration details."
      sectionTitle="Client Masterlist"
      showSectionHeader={false}
      title="Clients / Organizations"
    >
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
        clients.length === 0 ? <ClientEmptyDetailPanel canCreate={false} /> : <div aria-label="Client / Organization records" className="space-y-4">{clients.map((client) => <RecordAccordion expanded={selectedClientId === client.id} id={`client-${client.id}`} key={client.id} onToggle={() => selectClient(selectedClientId === client.id ? null : client.id)} summary={<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs font-bold uppercase tracking-wide text-primary-blue">Client / Organization</p><h2 className="mt-1 text-lg font-semibold text-primary-navy">{client.organization_name}</h2><p className="mt-1 text-sm text-text-muted">{client.contact_email ?? client.country ?? "No contact details recorded"}</p></div><RegistrationStatusBadge value={client.status} /></div>}>
          {selectedClientId === client.id ? <ClientDetailsPanel
                canDeactivate={canDeactivate}
                canUpdate={canUpdate}
                client={selectedClientQuery.data ?? null}
                editForm={editForm}
                isLoading={selectedClientQuery.isLoading}
                isSubmitting={updateMutation.isPending}
                onDeactivate={deactivateSelectedClient}
                onEditChange={setEditForm}
                onSubmit={submitEditForm}
              /> : null}
        </RecordAccordion>)}</div>
      )}
    </WorkspaceShell>
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
      <div className="space-y-4">
        <RegistrationMetadataGroup description="System references and record history remain available for traceability.">
          <RegistrationMetadataItem
            label="Administrative Client ID"
            subtle
            value={client.id}
          />
          <RegistrationMetadataItem
            label="Created"
            value={formatRegistrationDateTime(client.created_at)}
          />
          <RegistrationMetadataItem
            label="Updated"
            value={formatRegistrationDateTime(client.updated_at)}
          />
        </RegistrationMetadataGroup>

        {canUpdate ? (
          <RegistrationEditableSection
            description="Update the organization information governed by Client registration."
            title="Editable Client information"
          >
            <ClientForm
              actionLabel="Save Client / Organization"
              formId="edit-registration-client"
              formState={editForm}
              isSubmitting={isSubmitting}
              onChange={onEditChange}
              onSubmit={onSubmit}
            />
          </RegistrationEditableSection>
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
    <RegistrationMetadataGroup
      description="This information is read-only with your current authority."
      title="Client information"
    >
      <RegistrationMetadataItem label="Status" value={client.status} />
      <RegistrationMetadataItem
        label="Contact email"
        value={client.contact_email ?? "Not specified"}
      />
      <RegistrationMetadataItem
        label="Contact phone"
        value={client.contact_phone ?? "Not specified"}
      />
      <RegistrationMetadataItem label="Country" value={client.country ?? "Not specified"} />
      <RegistrationMetadataItem label="Address" value={client.address ?? "Not specified"} />
      <RegistrationMetadataItem label="Notes" value={client.notes ?? "Not specified"} />
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
