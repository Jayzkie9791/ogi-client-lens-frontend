import {
  useMutation,
  useQuery,
  UseMutateFunction
} from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";

import { isApiError } from "../api/errors";
import { useAuth } from "../auth/useAuth";
import { Surface } from "../ui/components/Surface";
import {
  ClientContextClient,
  ClientContextFacility,
  getAuthorizedClientContexts,
  getAuthorizedClientFacilities
} from "./clientContextApi";
import { narrowOetsDefinition } from "./definitionGuards";
import {
  createOperationalEvidenceRecord,
  OperationalEvidenceRecord
} from "./evidenceSubmissionApi";
import {
  mapBackendValidationDetails,
  OetsValidationSummary
} from "./evidenceValidation";
import { OetsRenderer } from "./OetsRenderer";
import { getCurrentRuntimeTemplate } from "./runtimeTemplateApi";
import {
  OetsDefinition,
  OetsEvidencePayload,
  OetsTemplateRuntimeDefinition
} from "./types";

interface EditingTemplateSession {
  routeTemplateCode: string;
  runtimeTemplate: OetsTemplateRuntimeDefinition;
  definition: OetsDefinition;
  warnings: string[];
}

export function RuntimeTemplatePage() {
  const auth = useAuth();
  const session = auth.session;
  const { templateCode } = useParams();
  const [searchParams] = useSearchParams();
  const readOnly = searchParams.get("mode") === "readonly";
  const [selectedClientId, setSelectedClientId] = useState(
    readStoredClientContext
  );
  const [selectedFacilityId, setSelectedFacilityId] = useState("");
  const [formMessage, setFormMessage] = useState<string | null>(null);
  const [backendValidation, setBackendValidation] =
    useState<OetsValidationSummary | null>(null);
  const [successRecord, setSuccessRecord] =
    useState<OperationalEvidenceRecord | null>(null);
  const [editingSession, setEditingSession] =
    useState<EditingTemplateSession | null>(null);
  const submitLockedRef = useRef(false);

  const query = useQuery({
    enabled: Boolean(templateCode),
    queryKey: ["oets-runtime-template", templateCode],
    queryFn: () => getCurrentRuntimeTemplate(templateCode ?? "")
  });
  const needsExplicitClientContext = Boolean(session && !session.clientId);
  const clientContextsQuery = useQuery({
    enabled: !readOnly && needsExplicitClientContext,
    queryKey: ["client-context", "clients"],
    queryFn: getAuthorizedClientContexts
  });
  const effectiveClientId = session?.clientId ?? (selectedClientId || null);
  const facilitiesQuery = useQuery({
    enabled: !readOnly && needsExplicitClientContext && Boolean(effectiveClientId),
    queryKey: ["client-context", "facilities", effectiveClientId],
    queryFn: () => getAuthorizedClientFacilities(effectiveClientId ?? "")
  });
  useEffect(() => {
    setEditingSession(null);
    setBackendValidation(null);
    setFormMessage(null);
    setSuccessRecord(null);
    submitLockedRef.current = false;
  }, [templateCode]);
  const narrowing = useMemo(
    () =>
      query.data ? narrowOetsDefinition(query.data.definition_jsonb) : undefined,
    [query.data]
  );
  useEffect(() => {
    const definition = narrowing?.definition;

    if (!templateCode || !query.data || !definition) {
      return;
    }

    setEditingSession((current) => {
      if (current?.routeTemplateCode === templateCode) {
        return current;
      }

      return {
        routeTemplateCode: templateCode,
        runtimeTemplate: query.data,
        definition,
        warnings: narrowing.warnings
      };
    });
  }, [narrowing, query.data, templateCode]);
  useEffect(() => {
    if (!selectedFacilityId) {
      return;
    }

    if (
      !readAvailableFacilityIds(
        session?.facilityIds ?? [],
        facilitiesQuery.data?.facilities,
        needsExplicitClientContext
      ).includes(selectedFacilityId)
    ) {
      setSelectedFacilityId("");
    }
  }, [
    facilitiesQuery.data?.facilities,
    needsExplicitClientContext,
    selectedFacilityId,
    session?.facilityIds
  ]);
  useEffect(() => {
    if (!needsExplicitClientContext || clientContextsQuery.isLoading) {
      return;
    }

    const authorizedClientIds =
      clientContextsQuery.data?.clients.map((client) => client.id) ?? [];

    if (selectedClientId && !authorizedClientIds.includes(selectedClientId)) {
      setSelectedClientId("");
      window.sessionStorage.removeItem(clientContextStorageKey);
    }
  }, [
    clientContextsQuery.data?.clients,
    clientContextsQuery.isLoading,
    needsExplicitClientContext,
    selectedClientId
  ]);
  useEffect(() => {
    setSelectedFacilityId("");
  }, [effectiveClientId]);
  const availableFacilityIds = readAvailableFacilityIds(
    session?.facilityIds ?? [],
    facilitiesQuery.data?.facilities,
    needsExplicitClientContext
  );
  const facilityId = resolveFacilityId(availableFacilityIds, selectedFacilityId);
  const activeEditingSession =
    editingSession?.routeTemplateCode === templateCode ? editingSession : null;
  const mutation = useMutation({
    mutationFn: createOperationalEvidenceRecord,
    onSuccess(record) {
      setBackendValidation(null);
      setFormMessage(null);
      setSuccessRecord(record);
      submitLockedRef.current = false;
    },
    onError(error) {
      setSuccessRecord(null);
      submitLockedRef.current = false;

      if (isApiError(error)) {
        handleSubmissionError(error, setFormMessage, setBackendValidation);
        return;
      }

      setBackendValidation(null);
      setFormMessage("Evidence submission failed. Try again later.");
    }
  });

  if (!templateCode) {
    return (
      <SafeState title="Template code is required.">
        Open a runtime template route with a template code.
      </SafeState>
    );
  }

  if (query.isLoading) {
    return <SafeState title="Loading runtime template.">Please wait.</SafeState>;
  }

  if (query.isError) {
    return (
      <SafeState title="Template could not be loaded.">
        The backend template endpoint returned an error.
      </SafeState>
    );
  }

  if (!activeEditingSession) {
    return (
      <SafeState title="Template definition is not renderable.">
        {(narrowing?.errors ?? ["definition_jsonb was not returned."]).join(" ")}
      </SafeState>
    );
  }

  return (
    <div className="space-y-4">
      {activeEditingSession.warnings.length > 0 ? (
        <Surface className="border-state-warning">
          <h2 className="text-base font-semibold text-text-primary">
            Unsupported renderer metadata
          </h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-text-muted">
            {activeEditingSession.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </Surface>
      ) : null}
      {!readOnly && session ? (
        <ClientContextPanel
          clients={clientContextsQuery.data?.clients ?? []}
          currentClientId={effectiveClientId}
          error={clientContextsQuery.isError}
          isLoading={clientContextsQuery.isLoading}
          needsExplicitClientContext={needsExplicitClientContext}
          onClientChange={(clientId) => {
            setSelectedClientId(clientId);
            setSelectedFacilityId("");

            if (clientId) {
              window.sessionStorage.setItem(clientContextStorageKey, clientId);
            } else {
              window.sessionStorage.removeItem(clientContextStorageKey);
            }
          }}
          sessionClientId={session.clientId}
        />
      ) : null}
      {!readOnly &&
      session &&
      !needsExplicitClientContext &&
      session.facilityIds.length > 1 ? (
        <Surface>
          <label className="block text-sm font-semibold text-text-primary">
            Facility context
            <select
              className="mt-2 min-h-10 w-full rounded-component border border-border bg-surface px-3 py-2 text-sm text-text-primary outline-none focus:border-focus focus:ring-2 focus:ring-focus"
              onChange={(event) => setSelectedFacilityId(event.target.value)}
              value={selectedFacilityId}
            >
              <option value="">No facility context</option>
              {session.facilityIds.map((facility) => (
                <option key={facility} value={facility}>
                  {facility}
                </option>
              ))}
            </select>
          </label>
        </Surface>
      ) : null}
      {!readOnly &&
      needsExplicitClientContext &&
      effectiveClientId &&
      (facilitiesQuery.data?.facilities.length ?? 0) > 0 ? (
        <FacilityContextPanel
          facilities={facilitiesQuery.data?.facilities ?? []}
          onFacilityChange={setSelectedFacilityId}
          selectedFacilityId={selectedFacilityId}
        />
      ) : null}
      <OetsRenderer
        backendValidation={backendValidation}
        definition={activeEditingSession.definition}
        formMessage={formMessage}
        isSubmitting={mutation.isPending}
        onSubmit={
          readOnly || successRecord
            ? undefined
            : (payload) =>
                handleEvidenceSubmit({
                  payload,
                  clientId: effectiveClientId,
                  facilityId,
                  isPending: mutation.isPending,
                  mutate: mutation.mutate,
                  setBackendValidation,
                  setFormMessage,
                  setSuccessRecord,
                  submitLockedRef
                })
        }
        readOnly={readOnly}
        runtimeTemplate={activeEditingSession.runtimeTemplate}
        submitDisabledReason={readSubmissionDisabledReason(
          effectiveClientId,
          successRecord
        )}
        submitSuccess={
          successRecord
            ? {
                evidenceRecordId: successRecord.id,
                lifecycleState: successRecord.lifecycle_state
              }
            : null
        }
      />
    </div>
  );
}

interface SubmitInput {
  payload: OetsEvidencePayload;
  clientId: string | null;
  facilityId?: string;
  isPending: boolean;
  mutate: UseMutateFunction<
    OperationalEvidenceRecord,
    Error,
    Parameters<typeof createOperationalEvidenceRecord>[0],
    unknown
  >;
  setBackendValidation: (validation: OetsValidationSummary | null) => void;
  setFormMessage: (message: string | null) => void;
  setSuccessRecord: (record: OperationalEvidenceRecord | null) => void;
  submitLockedRef: { current: boolean };
}

function handleEvidenceSubmit({
  payload,
  clientId,
  facilityId,
  isPending,
  mutate,
  setBackendValidation,
  setFormMessage,
  setSuccessRecord,
  submitLockedRef
}: SubmitInput) {
  if (isPending || submitLockedRef.current) {
    return;
  }

  setSuccessRecord(null);

  if (!clientId) {
    setBackendValidation(null);
    setFormMessage("Evidence submission requires an assigned client context.");
    return;
  }

  submitLockedRef.current = true;
  setBackendValidation(null);
  setFormMessage(null);
  mutate({
    template_code: payload.template_code,
    template_version_id: payload.template_version_id,
    checksum: payload.checksum,
    client_id: clientId,
    ...(facilityId ? { facility_id: facilityId } : {}),
    payload: {
      sections: payload.sections
    }
  });
}

function handleSubmissionError(
  error: { code: string; message: string; status: number; details?: unknown },
  setFormMessage: (message: string | null) => void,
  setBackendValidation: (validation: OetsValidationSummary | null) => void
) {
  if (error.status === 409 && error.code === "OEE_TEMPLATE_VERSION_CONFLICT") {
    setBackendValidation(null);
    setFormMessage(
      "This operational template changed while you were completing it. Reload the current template before submitting."
    );
    return;
  }

  if (error.status === 422 && error.code === "OEE_EVIDENCE_VALIDATION_FAILED") {
    setBackendValidation(mapBackendValidationDetails(error.details));
    setFormMessage("The backend rejected this evidence. Review the highlighted validation messages.");
    return;
  }

  setBackendValidation(null);

  if (error.status === 403) {
    setFormMessage("You are not authorized to submit this operational evidence.");
    return;
  }

  if (error.status === 400) {
    setFormMessage("The evidence submission request was malformed.");
    return;
  }

  if (error.status === 404) {
    setFormMessage("The operational template or evidence resource is unavailable.");
    return;
  }

  setFormMessage(error.message || "Evidence submission failed. Try again later.");
}

function readSubmissionDisabledReason(
  clientId: string | null,
  successRecord: OperationalEvidenceRecord | null
) {
  if (successRecord) {
    return "This evidence capture has already been submitted.";
  }

  return clientId ? null : "You must first select a Client before submitting Operational Evidence.";
}

function resolveFacilityId(facilityIds: string[], selectedFacilityId: string) {
  if (facilityIds.length === 1) {
    return facilityIds[0];
  }

  return selectedFacilityId || undefined;
}

function readAvailableFacilityIds(
  sessionFacilityIds: string[],
  contextFacilities: ClientContextFacility[] | undefined,
  needsExplicitClientContext: boolean
) {
  if (needsExplicitClientContext) {
    return contextFacilities?.map((facility) => facility.id) ?? [];
  }

  return sessionFacilityIds;
}

function readStoredClientContext() {
  return window.sessionStorage.getItem(clientContextStorageKey) ?? "";
}

function ClientContextPanel({
  clients,
  currentClientId,
  error,
  isLoading,
  needsExplicitClientContext,
  onClientChange,
  sessionClientId
}: {
  clients: ClientContextClient[];
  currentClientId: string | null;
  error: boolean;
  isLoading: boolean;
  needsExplicitClientContext: boolean;
  onClientChange: (clientId: string) => void;
  sessionClientId: string | null;
}) {
  if (!needsExplicitClientContext) {
    return (
      <Surface>
        <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">
          Client context
        </p>
        <p className="mt-1 text-sm text-text-primary">
          Current client: {sessionClientId}
        </p>
      </Surface>
    );
  }

  return (
    <Surface>
      <label className="block text-sm font-semibold text-text-primary">
        Client context
        <select
          className="mt-2 min-h-10 w-full rounded-component border border-border bg-surface px-3 py-2 text-sm text-text-primary outline-none focus:border-focus focus:ring-2 focus:ring-focus"
          disabled={isLoading || error}
          onChange={(event) => onClientChange(event.target.value)}
          value={currentClientId ?? ""}
        >
          <option value="">Select a client</option>
          {clients.map((client) => (
            <option key={client.id} value={client.id}>
              {client.name}
            </option>
          ))}
        </select>
      </label>
      <p className="mt-2 text-sm text-text-muted">
        {error
          ? "Authorized clients could not be loaded."
          : currentClientId
            ? `Current client: ${readClientName(clients, currentClientId)}`
            : "You must first select a Client before submitting Operational Evidence."}
      </p>
    </Surface>
  );
}

function FacilityContextPanel({
  facilities,
  onFacilityChange,
  selectedFacilityId
}: {
  facilities: ClientContextFacility[];
  onFacilityChange: (facilityId: string) => void;
  selectedFacilityId: string;
}) {
  return (
    <Surface>
      <label className="block text-sm font-semibold text-text-primary">
        Facility context
        <select
          className="mt-2 min-h-10 w-full rounded-component border border-border bg-surface px-3 py-2 text-sm text-text-primary outline-none focus:border-focus focus:ring-2 focus:ring-focus"
          onChange={(event) => onFacilityChange(event.target.value)}
          value={selectedFacilityId}
        >
          <option value="">No facility context</option>
          {facilities.map((facility) => (
            <option key={facility.id} value={facility.id}>
              {facility.name}
            </option>
          ))}
        </select>
      </label>
    </Surface>
  );
}

function readClientName(clients: ClientContextClient[], clientId: string) {
  return clients.find((client) => client.id === clientId)?.name ?? clientId;
}

const clientContextStorageKey = "client-lens:selected-client-context";

function SafeState({
  title,
  children
}: {
  title: string;
  children: string;
}) {
  return (
    <Surface>
      <h1 className="text-xl font-semibold text-text-primary">{title}</h1>
      <p className="mt-2 text-sm text-text-muted">{children}</p>
    </Surface>
  );
}
