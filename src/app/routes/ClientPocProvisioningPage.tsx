import { FormEvent, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import {
  provisionClientPoc,
  ProvisionClientPocResponse
} from "../../admin/clientPocProvisioningApi";
import { isApiError } from "../../api/errors";
import { useAuth } from "../../auth/useAuth";
import { listRegistrationClients } from "../../registration/registrationClientApi";
import {
  listRegistrationFacilities,
  RegistrationFacility
} from "../../registration/registrationFacilityApi";
import { Button } from "../../ui/components/Button";
import { Surface } from "../../ui/components/Surface";
import { routes } from "../routePaths";

type FacilityScopeMode = "EXPLICIT" | "CLIENT_WIDE";

interface ProvisionClientPocFormState {
  clientId: string;
  fullName: string;
  email: string;
  initialPassword: string;
  facilityScopeMode: FacilityScopeMode;
  explicitFacilityIds: string[];
}

interface ProvisioningConfirmation {
  account: ProvisionClientPocResponse;
  clientName: string;
  facilityLabels: string[];
}

const createUserPermission = "create_user";

const emptyForm: ProvisionClientPocFormState = {
  clientId: "",
  fullName: "",
  email: "",
  initialPassword: "",
  facilityScopeMode: "EXPLICIT",
  explicitFacilityIds: []
};

export function ClientPocProvisioningPage() {
  const auth = useAuth();
  const queryClient = useQueryClient();
  const canProvisionClientPoc = auth.canUsePermission(createUserPermission);
  const [formState, setFormState] =
    useState<ProvisionClientPocFormState>(emptyForm);
  const [localError, setLocalError] = useState<string | null>(null);
  const [confirmation, setConfirmation] =
    useState<ProvisioningConfirmation | null>(null);

  const clientsQuery = useQuery({
    queryKey: ["registration-clients"],
    queryFn: () => listRegistrationClients(),
    enabled: canProvisionClientPoc,
    retry: false
  });
  const clients = useMemo(
    () => clientsQuery.data?.clients ?? [],
    [clientsQuery.data]
  );
  const activeClients = useMemo(
    () => clients.filter((client) => client.status === "ACTIVE"),
    [clients]
  );
  const selectedClient = activeClients.find(
    (client) => client.id === formState.clientId
  );

  useEffect(() => {
    if (!formState.clientId && activeClients.length > 0) {
      setFormState((current) => ({
        ...current,
        clientId: activeClients[0].id,
        explicitFacilityIds: []
      }));
    }
  }, [activeClients, formState.clientId]);

  const facilitiesQuery = useQuery({
    queryKey: ["registration-facilities", formState.clientId],
    queryFn: () => listRegistrationFacilities({ clientId: formState.clientId }),
    enabled:
      canProvisionClientPoc &&
      formState.facilityScopeMode === "EXPLICIT" &&
      Boolean(formState.clientId),
    retry: false
  });
  const activeFacilities = useMemo(
    () =>
      (facilitiesQuery.data?.facilities ?? []).filter(
        (facility) => facility.operational_status === "ACTIVE"
      ),
    [facilitiesQuery.data]
  );

  const provisionMutation = useMutation({
    mutationFn: () =>
      provisionClientPoc({
        client_id: formState.clientId,
        full_name: formState.fullName.trim(),
        email: formState.email.trim(),
        initial_password: formState.initialPassword,
        facility_scope:
          formState.facilityScopeMode === "CLIENT_WIDE"
            ? { mode: "CLIENT_WIDE" }
            : {
                mode: "EXPLICIT",
                facility_ids: formState.explicitFacilityIds
              }
      }),
    onSuccess: (account) => {
      setConfirmation({
        account,
        clientName: selectedClient?.organization_name ?? account.client_id,
        facilityLabels: facilityLabelsForSelection(
          account.explicit_facility_ids,
          activeFacilities
        )
      });
      setLocalError(null);
      setFormState((current) => ({
        ...emptyForm,
        clientId: current.clientId,
        initialPassword: ""
      }));
      void queryClient.invalidateQueries({ queryKey: ["administration-users"] });
    },
    onError: (error) => {
      if (
        isApiError(error) &&
        error.status === 404 &&
        error.message.toLowerCase().includes("facility")
      ) {
        void queryClient.invalidateQueries({
          queryKey: ["registration-facilities", formState.clientId]
        });
      }
    }
  });

  function updateClient(clientId: string) {
    setFormState((current) => ({
      ...current,
      clientId,
      explicitFacilityIds: []
    }));
    setLocalError(null);
    setConfirmation(null);
  }

  function updateFacilityScopeMode(facilityScopeMode: FacilityScopeMode) {
    setFormState((current) => ({
      ...current,
      facilityScopeMode,
      explicitFacilityIds: []
    }));
    setLocalError(null);
    setConfirmation(null);
  }

  function toggleFacility(facilityId: string) {
    setFormState((current) => {
      const explicitFacilityIds = current.explicitFacilityIds.includes(facilityId)
        ? current.explicitFacilityIds.filter((id) => id !== facilityId)
        : [...current.explicitFacilityIds, facilityId];

      return {
        ...current,
        explicitFacilityIds
      };
    });
    setLocalError(null);
    setConfirmation(null);
  }

  function submitForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setConfirmation(null);

    const validationError = validateForm(formState);

    if (validationError) {
      setLocalError(validationError);
      return;
    }

    setLocalError(null);
    provisionMutation.mutate();
  }

  if (!canProvisionClientPoc) {
    return (
      <SafeState title="You are not authorized to provision Client POC accounts.">
        Your current session does not include Client POC provisioning authority.
      </SafeState>
    );
  }

  if (auth.session?.clientId) {
    return (
      <SafeState title="You are not authorized to provision Client POC accounts.">
        Client-bound sessions cannot use the OGI-side Client POC provisioning workflow.
      </SafeState>
    );
  }

  return (
    <section aria-labelledby="client-poc-provisioning-heading" className="space-y-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-primary-blue">
          Administration
        </p>
        <h1
          className="mt-2 text-2xl font-semibold text-text-primary"
          id="client-poc-provisioning-heading"
        >
          Provision Client POC
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-text-muted">
          Create one Client point-of-contact account using the server-owned Client Administrator provisioning contract.
        </p>
      </div>

      <Button asChild variant="secondary">
        <Link to={routes.administration}>Back to Administration</Link>
      </Button>

      {confirmation ? <ProvisioningSuccess confirmation={confirmation} /> : null}

      <ProvisioningErrorAlert error={provisionMutation.error} localError={localError} />

      <Surface>
        <form
          aria-label="Provision Client POC"
          className="space-y-5"
          onSubmit={submitForm}
        >
          <div className="grid gap-4 lg:grid-cols-2">
            <label className="block text-sm font-semibold text-text-primary">
              Client
              <select
                className={inputClassName}
                disabled={clientsQuery.isLoading || provisionMutation.isPending}
                onChange={(event) => updateClient(event.currentTarget.value)}
                value={formState.clientId}
              >
                <option value="">Select a Client</option>
                {activeClients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.organization_name}
                  </option>
                ))}
              </select>
            </label>
            <FormInput
              disabled={provisionMutation.isPending}
              label="Full name"
              onChange={(fullName) =>
                setFormState((current) => ({ ...current, fullName }))
              }
              value={formState.fullName}
            />
            <FormInput
              disabled={provisionMutation.isPending}
              label="Business email"
              onChange={(email) =>
                setFormState((current) => ({ ...current, email }))
              }
              type="email"
              value={formState.email}
            />
            <FormInput
              disabled={provisionMutation.isPending}
              label="Initial password"
              onChange={(initialPassword) =>
                setFormState((current) => ({ ...current, initialPassword }))
              }
              type="password"
              value={formState.initialPassword}
            />
          </div>

          <fieldset className="space-y-3">
            <legend className="text-sm font-semibold text-text-primary">
              Facility scope
            </legend>
            <div className="flex flex-col gap-3 sm:flex-row">
              <label className={scopeOptionClassName}>
                <input
                  checked={formState.facilityScopeMode === "EXPLICIT"}
                  disabled={provisionMutation.isPending}
                  name="facility-scope"
                  onChange={() => updateFacilityScopeMode("EXPLICIT")}
                  type="radio"
                />
                <span>Specific Facilities</span>
              </label>
              <label className={scopeOptionClassName}>
                <input
                  checked={formState.facilityScopeMode === "CLIENT_WIDE"}
                  disabled={provisionMutation.isPending}
                  name="facility-scope"
                  onChange={() => updateFacilityScopeMode("CLIENT_WIDE")}
                  type="radio"
                />
                <span>Client-wide Access</span>
              </label>
            </div>
          </fieldset>

          {formState.facilityScopeMode === "EXPLICIT" ? (
            <FacilitySelection
              disabled={provisionMutation.isPending}
              facilities={activeFacilities}
              facilitiesLoading={facilitiesQuery.isLoading}
              onToggleFacility={toggleFacility}
              selectedFacilityIds={formState.explicitFacilityIds}
            />
          ) : (
            <Surface className="bg-elevated shadow-none">
              <h2 className="text-base font-semibold text-text-primary">
                Client-wide Access
              </h2>
              <p className="mt-2 text-sm leading-6 text-text-muted">
                The backend will bind this account to the selected Client without per-Facility access rows.
              </p>
            </Surface>
          )}

          <Button disabled={provisionMutation.isPending} type="submit">
            {provisionMutation.isPending ? "Provisioning..." : "Provision Client POC"}
          </Button>
        </form>
      </Surface>
    </section>
  );
}

function FacilitySelection({
  disabled,
  facilities,
  facilitiesLoading,
  onToggleFacility,
  selectedFacilityIds
}: {
  disabled: boolean;
  facilities: RegistrationFacility[];
  facilitiesLoading: boolean;
  onToggleFacility: (facilityId: string) => void;
  selectedFacilityIds: string[];
}) {
  if (facilitiesLoading) {
    return (
      <Surface className="bg-elevated shadow-none" role="status">
        <p className="text-sm text-text-muted">Loading Client Facilities.</p>
      </Surface>
    );
  }

  if (facilities.length === 0) {
    return (
      <Surface className="bg-elevated shadow-none">
        <h2 className="text-base font-semibold text-text-primary">
          No active Facilities returned for the selected Client.
        </h2>
        <p className="mt-2 text-sm leading-6 text-text-muted">
          Select another Client or use Client-wide Access if that is the intended authority.
        </p>
      </Surface>
    );
  }

  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-semibold text-text-primary">
        Specific Facilities
      </legend>
      <div className="grid gap-3 md:grid-cols-2">
        {facilities.map((facility) => (
          <label
            className="flex items-start gap-3 rounded-component border border-border bg-surface p-3 text-sm text-text-primary"
            key={facility.id}
          >
            <input
              checked={selectedFacilityIds.includes(facility.id)}
              disabled={disabled}
              onChange={() => onToggleFacility(facility.id)}
              type="checkbox"
            />
            <span>
              <span className="block font-semibold">{facility.facility_name}</span>
              <span className="block break-all text-xs text-text-muted">
                {facility.id}
              </span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function ProvisioningSuccess({
  confirmation
}: {
  confirmation: ProvisioningConfirmation;
}) {
  const { account, clientName, facilityLabels } = confirmation;

  return (
    <Surface role="status">
      <h2 className="text-base font-semibold text-text-primary">
        Client POC account provisioned successfully.
      </h2>
      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
        <MetadataItem label="Full name" value={account.full_name} />
        <MetadataItem label="Business email" value={account.email} />
        <MetadataItem label="Client" value={clientName} />
        <MetadataItem label="Server-assigned role" value={account.role_code} />
        <MetadataItem label="Status" value={account.status} />
        <MetadataItem
          label="Facility scope"
          value={
            account.facility_scope_mode === "CLIENT_WIDE"
              ? "Client-wide Access"
              : "Specific Facilities"
          }
        />
      </dl>
      {account.facility_scope_mode === "EXPLICIT" ? (
        <div className="mt-4">
          <h3 className="text-sm font-semibold text-text-primary">
            Authorized Facilities
          </h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-text-muted">
            {facilityLabels.map((facilityLabel) => (
              <li key={facilityLabel}>{facilityLabel}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </Surface>
  );
}

function ProvisioningErrorAlert({
  error,
  localError
}: {
  error: Error | null;
  localError: string | null;
}) {
  const message = localError ?? provisioningErrorMessage(error);

  if (!message) {
    return null;
  }

  return (
    <Surface role="alert">
      <h2 className="text-base font-semibold text-text-primary">
        Client POC provisioning could not be completed.
      </h2>
      <p className="mt-2 text-sm leading-6 text-text-muted">{message}</p>
    </Surface>
  );
}

function provisioningErrorMessage(error: Error | null) {
  if (!error) {
    return null;
  }

  if (!isApiError(error)) {
    return "Client POC provisioning returned an unexpected error.";
  }

  if (error.status === 403) {
    return "You are not authorized to provision Client POC accounts.";
  }

  if (error.status === 409) {
    return "A Client POC account already exists for that business email.";
  }

  if (error.status === 400) {
    return error.message;
  }

  if (error.status === 404) {
    const lowerMessage = error.message.toLowerCase();

    if (lowerMessage.includes("facility")) {
      return "One or more selected Facilities are unavailable for this Client.";
    }

    if (lowerMessage.includes("client")) {
      return "The selected Client is unavailable for provisioning.";
    }

    return "Client POC provisioning is not currently available.";
  }

  return "Client POC provisioning failed. Please try again later.";
}

function FormInput({
  disabled,
  label,
  onChange,
  type = "text",
  value
}: {
  disabled: boolean;
  label: string;
  onChange: (value: string) => void;
  type?: "email" | "password" | "text";
  value: string;
}) {
  return (
    <label className="block text-sm font-semibold text-text-primary">
      {label}
      <input
        className={inputClassName}
        disabled={disabled}
        onChange={(event) => onChange(event.currentTarget.value)}
        type={type}
        value={value}
      />
    </label>
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

function validateForm(formState: ProvisionClientPocFormState) {
  if (!formState.clientId) {
    return "Select a Client before provisioning a Client POC account.";
  }

  if (!formState.fullName.trim()) {
    return "Enter the Client POC full name.";
  }

  if (!formState.email.trim()) {
    return "Enter the Client POC business email.";
  }

  if (!formState.initialPassword) {
    return "Enter an initial password.";
  }

  if (
    formState.facilityScopeMode === "EXPLICIT" &&
    formState.explicitFacilityIds.length === 0
  ) {
    return "Select at least one Facility for Specific Facilities scope.";
  }

  return null;
}

function facilityLabelsForSelection(
  facilityIds: readonly string[],
  facilities: readonly RegistrationFacility[]
) {
  const facilityNameById = new Map(
    facilities.map((facility) => [facility.id, facility.facility_name])
  );

  return facilityIds.map((facilityId) => {
    const name = facilityNameById.get(facilityId);

    return name ? `${name} (${facilityId})` : facilityId;
  });
}

const inputClassName =
  "mt-1 block min-h-10 w-full rounded-component border border-border bg-surface px-3 py-2 text-sm text-text-primary outline-none focus:border-primary-blue focus:ring-2 focus:ring-focus";

const scopeOptionClassName =
  "inline-flex min-h-10 items-center gap-2 rounded-component border border-border bg-surface px-3 py-2 text-sm font-semibold text-text-primary";
