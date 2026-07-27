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

    if (!session?.facilityIds.includes(selectedFacilityId)) {
      setSelectedFacilityId("");
    }
  }, [selectedFacilityId, session?.facilityIds]);
  const facilityId = resolveFacilityId(
    session?.facilityIds ?? [],
    selectedFacilityId
  );
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
      {!readOnly && session && session.facilityIds.length > 1 ? (
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
                  clientId: session?.clientId ?? null,
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
          session?.clientId ?? null,
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

  return clientId ? null : "Evidence submission requires an assigned client context.";
}

function resolveFacilityId(facilityIds: string[], selectedFacilityId: string) {
  if (facilityIds.length === 1) {
    return facilityIds[0];
  }

  return selectedFacilityId || undefined;
}

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
