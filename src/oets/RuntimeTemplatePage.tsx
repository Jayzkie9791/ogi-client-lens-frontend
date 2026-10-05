import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient
} from "@tanstack/react-query";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";

import { isApiError } from "../api/errors";
import { routes } from "../app/routePaths";
import { useAuth } from "../auth/useAuth";
import { Button } from "../ui/components/Button";
import { Surface } from "../ui/components/Surface";
import { IncidentContextRegistration } from "../incidents/IncidentContextRegistration";
import { AssetRegistrationPanel } from "../assets/AssetRegistrationPanel";
import {
  ClientContextClient,
  ClientContextFacility,
  getAuthorizedClientContexts,
  getAuthorizedClientFacilities
} from "./clientContextApi";
import { narrowOetsDefinition } from "./definitionGuards";
import { isOetsDeveloperDiagnosticsEnabled } from "./developerDiagnostics";
import {
  createOperationalEvidenceDraft,
  OperationalEvidenceCreateRequest,
  OperationalEvidenceRecord,
  OetsDraftCreationResolution
} from "./evidenceSubmissionApi";
import {
  mapBackendValidationDetails,
  OetsValidationSummary
} from "./evidenceValidation";
import { OetsRenderer } from "./OetsRenderer";
import { getCurrentRuntimeTemplate } from "./runtimeTemplateApi";
import { getOetsContextCandidates, getOetsContextRequirement, resolveOetsContext, resolveOetsExistingContextRecord } from "./contextApi";
import {
  OetsDefinition,
  OetsEvidencePayload,
  OetsFieldValue,
  OetsTemplateRuntimeDefinition
} from "./types";

interface EditingTemplateSession {
  routeTemplateCode: string;
  runtimeTemplate: OetsTemplateRuntimeDefinition;
  definition: OetsDefinition;
  warnings: string[];
}

export function RuntimeTemplatePage({
  embeddedTemplateCode,
  initialClientId,
  initialContextId,
  initialFacilityId,
  lockInitialContext,
  lockInitialScope,
  onDraftCreated,
  onDirtyChange,
  actionPortalId,
  initialFieldValues
}: {
  readonly embeddedTemplateCode?: string;
  readonly initialClientId?: string | null;
  readonly initialContextId?: string;
  readonly initialFacilityId?: string | null;
  readonly lockInitialContext?: boolean;
  readonly lockInitialScope?: boolean;
  readonly onDraftCreated?: (recordId: string) => void;
  readonly onDirtyChange?: (dirty: boolean) => void;
  readonly actionPortalId?: string;
  readonly initialFieldValues?: Record<string, OetsFieldValue>;
} = {}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const auth = useAuth();
  const session = auth.session;
  const { templateCode: routeTemplateCode } = useParams();
  const templateCode = embeddedTemplateCode ?? routeTemplateCode;
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
  const [selectedContextId, setSelectedContextId] = useState(initialContextId ?? "");
  const [contextSearchInput, setContextSearchInput] = useState("");
  const [contextSearchQuery, setContextSearchQuery] = useState("");
  const [formDirty, setFormDirty] = useState(false);
  const contextIsLocked = Boolean(lockInitialContext && initialContextId);
  const scopeIsLocked = Boolean(lockInitialScope && initialClientId);
  const submitLockedRef = useRef(false);
  const draftIdempotencyKeyRef = useRef(crypto.randomUUID());
  const initialFieldValuesSignature = JSON.stringify(initialFieldValues ?? {});
  // Journey shells may rebuild the projection object when their dirty state
  // changes. Preserve the initial authority by semantic value so that an
  // equivalent new object cannot rehydrate the renderer on every keystroke.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const stableInitialFieldValues = useMemo(() => initialFieldValues, [initialFieldValuesSignature]);

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
  const effectiveClientId =
    initialClientId ?? session?.clientId ?? (selectedClientId || null);
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
  const facilityId =
    initialFacilityId ??
    resolveFacilityId(availableFacilityIds, selectedFacilityId);
  const activeEditingSession =
    editingSession?.routeTemplateCode === templateCode ? editingSession : null;
  const creationPresentation = draftCreationPresentation(
    successRecord?.creation_resolution,
    successRecord?.template_provenance.template_code
  );
  const contextAuthority = activeEditingSession ? {
    templateCode: activeEditingSession.runtimeTemplate.template_code,
    templateVersionId: activeEditingSession.runtimeTemplate.template_version_id,
    checksum: activeEditingSession.runtimeTemplate.checksum
  } : null;
  const contextRequirementQuery = useQuery({
    enabled: !readOnly && Boolean(contextAuthority),
    queryKey: ["oets-context-requirement", contextAuthority],
    queryFn: () => {
      if (!contextAuthority) throw new Error("OETS context authority is unavailable.");
      return getOetsContextRequirement(contextAuthority);
    }
  });
  const contextCandidatesQuery = useInfiniteQuery({
    enabled: !readOnly && !contextIsLocked && contextRequirementQuery.data?.required === true && Boolean(contextAuthority && effectiveClientId),
    queryKey: ["oets-context-candidates", contextAuthority, effectiveClientId, facilityId, contextSearchQuery],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => {
      if (!contextAuthority || !effectiveClientId) throw new Error("OETS context scope is unavailable.");
      return getOetsContextCandidates({ ...contextAuthority, clientId: effectiveClientId, facilityId, candidateQuery: contextSearchQuery || undefined, limit: 25, cursor: pageParam });
    },
    getNextPageParam: (lastPage) => lastPage.next_cursor ?? undefined
  });
  const resolvedContextQuery = useQuery({
    enabled: Boolean(contextAuthority && effectiveClientId && selectedContextId),
    queryKey: ["oets-context-resolved", contextAuthority, effectiveClientId, facilityId, selectedContextId],
    queryFn: () => {
      if (!contextAuthority || !effectiveClientId || !selectedContextId) throw new Error("OETS context selection is unavailable.");
      return resolveOetsContext({ ...contextAuthority, clientId: effectiveClientId, facilityId, selectedId: selectedContextId });
    }
  });
  const duplicatePolicy = contextRequirementQuery.data?.duplicate_policy;
  const supportsExistingRecordPreflight = duplicatePolicy === "ONE_LIVE_RECORD_PER_SUBJECT" || duplicatePolicy === "ONE_ACTIVE_DRAFT_PER_SUBJECT" || duplicatePolicy === "ONE_EVIDENCE_LINEAGE_PER_SUBJECT";
  const existingContextRecordQuery = useQuery({
    enabled: !readOnly && Boolean(contextAuthority && effectiveClientId && resolvedContextQuery.data && supportsExistingRecordPreflight),
    queryKey: ["oets-context-existing-record", contextAuthority, effectiveClientId, facilityId, resolvedContextQuery.data?.requirement_code, resolvedContextQuery.data?.selected_id],
    retry: false,
    queryFn: () => {
      if (!contextAuthority || !effectiveClientId || !resolvedContextQuery.data) throw new Error("Resolved OETS context is unavailable.");
      return resolveOetsExistingContextRecord({
        ...contextAuthority,
        clientId: effectiveClientId,
        facilityId,
        requirementCode: resolvedContextQuery.data.requirement_code,
        selectedId: resolvedContextQuery.data.selected_id
      });
    }
  });
  useEffect(() => {
    setSelectedContextId(initialContextId ?? "");
    setContextSearchInput("");
    setContextSearchQuery("");
    setFormDirty(false);
  }, [templateCode, effectiveClientId, facilityId, initialContextId]);
  const contextCandidates = useMemo(() => {
    const seen = new Set<string>();
    return (contextCandidatesQuery.data?.pages ?? []).flatMap((page) => page.candidates).filter((candidate) => {
      if (seen.has(candidate.id)) return false;
      seen.add(candidate.id);
      return true;
    });
  }, [contextCandidatesQuery.data?.pages]);
  const contextCandidateCount = contextCandidatesQuery.data?.pages[0]?.count ?? 0;
  const contextualDefinition = useMemo(() => applyContextFieldPolicy(activeEditingSession?.definition, resolvedContextQuery.data?.field_policy, resolvedContextQuery.data?.required_fields, scopeIsLocked ? stableInitialFieldValues : undefined), [activeEditingSession?.definition, resolvedContextQuery.data?.field_policy, resolvedContextQuery.data?.required_fields, stableInitialFieldValues, scopeIsLocked]);
  const contextualInitialPayload = useMemo(() => buildContextInitialPayload(contextualDefinition, { ...stableInitialFieldValues, ...resolvedContextQuery.data?.authoritative_values }, resolvedContextQuery.data?.repeatable_groups ?? []), [contextualDefinition, stableInitialFieldValues, resolvedContextQuery.data?.authoritative_values, resolvedContextQuery.data?.repeatable_groups]);
  const repeatableSectionControls = useMemo(() => Object.fromEntries((resolvedContextQuery.data?.repeatable_groups ?? []).flatMap((group) => group.sections.map((section) => [section.section_code, { cardinality: group.cardinality, instance_count: group.instance_count }]))), [resolvedContextQuery.data?.repeatable_groups]);
  const contextPresentation = contextRequirementQuery.data?.presentation;
  // An embedded journey must hand off to the persisted record editor before
  // users start completing the form. That editor owns checkpoint saves,
  // attestations, and lifecycle actions. Keeping embedded forms on the legacy
  // one-shot creation path strands the user on the transient new-form screen
  // after the record has already been created.
  // CFAC-4S7: every human-authored evidence flow starts with a persisted Draft.
  // The canonical Assessor/Reviewer gate is enforced only when that Draft is
  // finalized, so a one-shot non-Draft create path must never be selected here.
  const requiresPersistedDraft = true;
  const draftMutation = useMutation({
    mutationFn: createOperationalEvidenceDraft,
    onSuccess(record) {
      submitLockedRef.current = false;
      if (onDraftCreated) onDraftCreated(record.id);
      else if (record.creation_resolution && record.creation_resolution.outcome !== "CREATED_NEW") {
        setSuccessRecord(record);
      }
      else {
        const preservedSearch = searchParams.toString();
        navigate({ pathname: routes.evidenceRecordPath(record.id), search: preservedSearch ? `?${preservedSearch}` : "" });
      }
    },
    onError(error) {
      submitLockedRef.current = false;
      if (isApiError(error)) handleSubmissionError(error, setFormMessage, setBackendValidation);
      else setFormMessage("Audit draft creation failed. Try again later.");
    }
  });
  const existingContextRecord = existingContextRecordQuery.data?.resolution === "EXISTING_RECORD"
    ? existingContextRecordQuery.data.record
    : null;
  const existingHistoricalAuthorityNotice = existingContextRecord?.version_relation === "HISTORICAL_VERSION"
    ? historicalVersionNotices.get(`${templateCode ?? ""}@${existingContextRecord.template_version}->${activeEditingSession?.runtimeTemplate.template_version ?? ""}`)
    : undefined;
  const openExistingContextRecord = () => {
    if (!existingContextRecord) return;
    if (onDraftCreated) {
      onDraftCreated(existingContextRecord.evidence_record_id);
      return;
    }
    const preservedSearch = searchParams.toString();
    navigate({ pathname: routes.evidenceRecordPath(existingContextRecord.evidence_record_id), search: preservedSearch ? `?${preservedSearch}` : "" });
  };
  const successRecordSearch = searchParams.toString();

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
        {isOetsDeveloperDiagnosticsEnabled()
          ? (narrowing?.errors ?? ["definition_jsonb was not returned."]).join(" ")
          : "This template cannot be displayed. Contact an administrator if the problem continues."}
      </SafeState>
    );
  }

  if (!readOnly && contextRequirementQuery.isLoading) {
    return <SafeState title="Loading evidence context.">Please wait while the template context requirement is verified.</SafeState>;
  }

  if (!readOnly && contextRequirementQuery.isError) {
    return (
      <SafeState title="Evidence context could not be loaded.">
        <p>The form remains unavailable until its context requirement can be verified.</p>
        <Button className="mt-3" onClick={() => contextRequirementQuery.refetch()} variant="secondary">Retry</Button>
      </SafeState>
    );
  }

  if (!readOnly && contextIsLocked && contextRequirementQuery.data?.required !== true) {
    return (
      <SafeState title="Evidence context authority mismatch.">
        This form was opened for a specific governed subject, but the active template does not expose the required context authority. Return to the journey and contact an administrator. Evidence creation is disabled.
      </SafeState>
    );
  }

  return (
    <div className="space-y-4">
      {isOetsDeveloperDiagnosticsEnabled() && activeEditingSession.warnings.length > 0 ? (
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
      {!readOnly && session && !contextIsLocked && !scopeIsLocked ? (
        <ClientContextPanel
          clients={clientContextsQuery.data?.clients ?? []}
          currentClientId={effectiveClientId}
          error={clientContextsQuery.isError}
          disabled={formDirty}
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
      !contextIsLocked &&
      !scopeIsLocked &&
      !needsExplicitClientContext &&
      session.facilityIds.length > 1 ? (
        <Surface className="border-blue-100 bg-blue-50/50 py-3">
          <label className="block text-sm font-semibold text-text-primary">
            Facility context
            <select
              className="mt-2 min-h-10 w-full rounded-component border border-border bg-surface px-3 py-2 text-sm text-text-primary outline-none focus:border-focus focus:ring-2 focus:ring-focus"
              disabled={formDirty}
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
      !contextIsLocked &&
      !scopeIsLocked &&
      effectiveClientId &&
      (facilitiesQuery.data?.facilities.length ?? 0) > 0 ? (
        <FacilityContextPanel
          disabled={formDirty}
          facilities={facilitiesQuery.data?.facilities ?? []}
          onFacilityChange={setSelectedFacilityId}
          selectedFacilityId={selectedFacilityId}
        />
      ) : null}
      {!readOnly && contextRequirementQuery.data?.required && contextPresentation ? (
        <Surface className="border-blue-200 bg-blue-50/60">
          <p className="text-sm font-semibold text-primary-navy">{contextPresentation.label}</p>
          <p className="mt-1 text-sm text-text-muted">{contextPresentation.help_text}</p>
          {contextIsLocked ? (
            <div className="mt-2 rounded-component border border-blue-200 bg-white px-3 py-3">
              {resolvedContextQuery.isLoading ? <p className="text-sm text-text-muted">Resolving the selected {contextPresentation.candidate_singular.toLowerCase()}…</p> : null}
              {resolvedContextQuery.data ? <><p className="text-sm font-semibold text-primary-blue">{resolvedContextQuery.data.summary.primary_label}</p><p className="mt-1 text-sm text-text-muted">{resolvedContextQuery.data.summary.secondary_label}</p><p className="mt-2 text-xs font-bold uppercase tracking-wide text-teal-700">Locked evidence context</p></> : null}
              {resolvedContextQuery.isError ? <div className="rounded-component border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert"><p>The selected {contextPresentation.candidate_singular.toLowerCase()} could not be resolved. {readQueryErrorMessage(resolvedContextQuery.error)}</p><Button className="mt-2" onClick={() => resolvedContextQuery.refetch()} variant="secondary">Retry</Button></div> : null}
            </div>
          ) : (
            <>
              <form className="mt-3 flex flex-col gap-2 sm:flex-row" onSubmit={(event) => { event.preventDefault(); setSelectedContextId(""); setContextSearchQuery(contextSearchInput.trim()); }}>
                <label className="flex-1 text-sm font-semibold text-primary-navy">Search {contextPresentation.candidate_plural}
                  <input className="mt-2 min-h-10 w-full rounded-component border border-border bg-white px-3 py-2" disabled={formDirty || contextCandidatesQuery.isFetching} onChange={(event) => setContextSearchInput(event.target.value)} placeholder={`Search ${contextPresentation.candidate_plural.toLowerCase()}…`} value={contextSearchInput} />
                </label>
                <Button className="self-end" disabled={formDirty || contextCandidatesQuery.isFetching} type="submit" variant="secondary">Search</Button>
              </form>
              <label className="mt-3 block text-sm font-semibold text-primary-navy">Select {contextPresentation.candidate_singular}
                <select className="mt-2 min-h-10 w-full rounded-component border border-border bg-white px-3 py-2" disabled={formDirty || contextCandidatesQuery.isLoading || contextCandidatesQuery.isError} onChange={(event) => setSelectedContextId(event.target.value)} value={selectedContextId}>
                  <option value="">Select a {contextPresentation.candidate_singular.toLowerCase()} deliberately…</option>
                  {contextCandidates.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.primary_label} — {candidate.secondary_label}</option>)}
                </select>
              </label>
            </>
          )}
          {!contextIsLocked && contextCandidatesQuery.isLoading ? <p className="mt-2 text-sm text-text-muted">Loading eligible {contextPresentation.candidate_plural.toLowerCase()}…</p> : null}
          {!contextIsLocked && contextCandidatesQuery.isError ? (
            <div className="mt-2 rounded-component border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
              <p>{contextPresentation.candidate_singular} eligibility could not be loaded. {readQueryErrorMessage(contextCandidatesQuery.error)}</p>
              <Button className="mt-2" onClick={() => contextCandidatesQuery.refetch()} variant="secondary">Retry</Button>
            </div>
          ) : null}
          {!contextIsLocked && !contextCandidatesQuery.isLoading && contextCandidateCount === 0 ? <p className="mt-2 text-sm text-text-muted">No eligible {contextPresentation.candidate_singular.toLowerCase()} is available for this Client and Facility.</p> : null}
          {!contextIsLocked && contextCandidateCount > 0 ? <p className="mt-2 text-xs text-text-muted">Showing {contextCandidates.length} of {contextCandidateCount}.</p> : null}
          {!contextIsLocked && contextRequirementQuery.data.requirement_code === "INCIDENT_CONTEXT" && Boolean(facilityId) && auth.canUsePermission("create_incident") ? (
            <IncidentContextRegistration
              disabled={formDirty || contextCandidatesQuery.isFetching}
              facilityId={facilityId ?? ""}
              onCreated={(incident) => {
                void queryClient.invalidateQueries({ queryKey: ["oets-context-candidates", contextAuthority, effectiveClientId, facilityId] }).then(() => {
                  setContextSearchInput("");
                  setContextSearchQuery("");
                  setSelectedContextId(incident.incident_id);
                });
              }}
            />
          ) : null}
          {!contextIsLocked && contextRequirementQuery.data.requirement_code === "ASSET_CONTEXT" && Boolean(facilityId) && auth.canUsePermission("create_asset") ? (
            <AssetRegistrationPanel
              disabled={formDirty || contextCandidatesQuery.isFetching}
              facilityId={facilityId ?? ""}
              onCreated={(asset) => {
                void queryClient.invalidateQueries({ queryKey: ["oets-context-candidates", contextAuthority, effectiveClientId, facilityId] }).then(() => {
                  setContextSearchInput("");
                  setContextSearchQuery("");
                  setSelectedContextId(asset.asset_id);
                });
              }}
            />
          ) : null}
          {!contextIsLocked && contextCandidatesQuery.hasNextPage ? <Button className="mt-2" disabled={contextCandidatesQuery.isFetchingNextPage || formDirty} onClick={() => contextCandidatesQuery.fetchNextPage()} variant="secondary">{contextCandidatesQuery.isFetchingNextPage ? "Loading…" : "Load more"}</Button> : null}
          {!contextIsLocked && resolvedContextQuery.isLoading ? <p className="mt-2 text-sm text-text-muted">Verifying the selected {contextPresentation.candidate_singular.toLowerCase()}…</p> : null}
          {!contextIsLocked && resolvedContextQuery.isError ? <div className="mt-2 rounded-component border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert"><p>The selected {contextPresentation.candidate_singular.toLowerCase()} could not be resolved. {readQueryErrorMessage(resolvedContextQuery.error)}</p><Button className="mt-2" onClick={() => resolvedContextQuery.refetch()} variant="secondary">Retry</Button></div> : null}
          {!contextIsLocked && resolvedContextQuery.data ? <p className="mt-2 text-sm text-text-muted">Using {resolvedContextQuery.data.summary.primary_label} for {resolvedContextQuery.data.summary.secondary_label}.</p> : null}
          {formDirty ? <p className="mt-2 text-sm text-amber-700">Save or clear your changes before changing evidence context.</p> : null}
        </Surface>
      ) : null}
      {existingContextRecord ? (
        <Surface className="border-blue-300 bg-blue-50/60">
          <p className="font-semibold text-primary-navy">
            {existingContextRecord.access_action === "CONTINUE_DRAFT" ? "Existing Draft found" : "Existing record found"}
          </p>
          <p className="mt-1 text-sm text-text-muted">
            {existingContextRecord.version_relation === "HISTORICAL_VERSION"
              ? "This governed context already has a v" + existingContextRecord.template_version + " " + existingContextRecord.lifecycle_state + " record. The selected current form is v" + activeEditingSession.runtimeTemplate.template_version + "."
              : "This governed context already has a v" + existingContextRecord.template_version + " " + existingContextRecord.lifecycle_state + " record."}
          </p>
          {existingHistoricalAuthorityNotice ? <p className="mt-2 text-sm font-medium text-amber-800">{existingHistoricalAuthorityNotice}</p> : null}
          <Button className="mt-3" onClick={openExistingContextRecord}>
            {existingContextRecord.access_action === "CONTINUE_DRAFT"
              ? "Continue existing v" + existingContextRecord.template_version + " Draft"
              : "View existing record"}
          </Button>
        </Surface>
      ) : contextRequirementQuery.data?.required && !resolvedContextQuery.data ? null : <OetsRenderer
        actionPortalId={actionPortalId}
        backendValidation={backendValidation}
        definition={contextualDefinition ?? activeEditingSession.definition}
        fieldAuthority={resolvedContextQuery.data?.field_authority ?? activeEditingSession.runtimeTemplate.field_authority}
        initialPayload={contextualInitialPayload}
        repeatableSectionControls={repeatableSectionControls}
        key={`${activeEditingSession.runtimeTemplate.template_version_id}:${resolvedContextQuery.data?.selected_id ?? "unresolved-context"}`}
        formMessage={formMessage}
        isSubmitting={draftMutation.isPending}
        embedded={Boolean(embeddedTemplateCode)}
        onDirtyChange={(dirty) => { setFormDirty(dirty); onDirtyChange?.(dirty); }}
        onSubmit={
          readOnly || successRecord
            ? undefined
            : (payload) =>
                handleEvidenceSubmit({
                  payload,
                  clientId: effectiveClientId,
                  facilityId,
                  isPending: draftMutation.isPending,
                  mutate: (request) => draftMutation.mutate({ ...request, idempotency_key: draftIdempotencyKeyRef.current }),
                  idempotencyKey: draftIdempotencyKeyRef.current,
                  setBackendValidation,
                  setFormMessage,
                  setSuccessRecord,
                  submitLockedRef,
                  context: resolvedContextQuery.data ? { requirement_code: resolvedContextQuery.data.requirement_code, selected_id: resolvedContextQuery.data.selected_id } : undefined
                })
        }
        readOnly={readOnly}
        runtimeTemplate={activeEditingSession.runtimeTemplate}
        submitHelpText={requiresPersistedDraft
          ? existingContextRecordQuery.isError
            ? "Existing-record lookup is unavailable. The server will safely open an existing governed record or create a new Draft."
            : "Begin a persisted draft before completing and submitting this evidence."
          : undefined}
        submitLabel={requiresPersistedDraft
          ? existingContextRecordQuery.isError ? "Open or Begin Evidence" : "Begin Evidence"
          : undefined}
        submittingLabel={requiresPersistedDraft ? "Beginning..." : undefined}
        submitDisabledReason={readSubmissionDisabledReason(
          effectiveClientId,
          successRecord,
          contextRequirementQuery.data?.required === true && (!resolvedContextQuery.data || existingContextRecordQuery.isLoading)
        )}
        submitSuccess={
          successRecord
            ? {
                evidenceRecordId: successRecord.id,
                lifecycleState: successRecord.lifecycle_state,
                recordHref: `${routes.evidenceRecordPath(successRecord.id)}${successRecordSearch ? `?${successRecordSearch}` : ""}`
              }
            : null
        }
        submitSuccessTitle={creationPresentation.title}
        submitSuccessMessage={creationPresentation.message}
        submitSuccessLinkLabel={creationPresentation.linkLabel}
      />}
    </div>
  );
}

interface SubmitInput {
  payload: OetsEvidencePayload;
  clientId: string | null;
  facilityId?: string;
  isPending: boolean;
  mutate: (request: OperationalEvidenceCreateRequest) => void;
  setBackendValidation: (validation: OetsValidationSummary | null) => void;
  setFormMessage: (message: string | null) => void;
  setSuccessRecord: (record: OperationalEvidenceRecord | null) => void;
  submitLockedRef: { current: boolean };
  idempotencyKey?: string;
  context?: { requirement_code: string; selected_id: string };
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
  submitLockedRef,
  idempotencyKey,
  context
}: SubmitInput) {
  if (isPending || submitLockedRef.current) {
    return;
  }

  setSuccessRecord(null);

  if (!clientId) {
    setBackendValidation(null);
    setFormMessage("Creating an audit draft requires an assigned client context.");
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
    ...(idempotencyKey ? { idempotency_key: idempotencyKey } : {}),
    ...(context ? { context } : {}),
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
      "This audit template changed while you were completing it. Reload the current template before submitting."
    );
    return;
  }

  if (error.status === 422 && error.code === "OEE_EVIDENCE_VALIDATION_FAILED") {
    setBackendValidation(mapBackendValidationDetails(error.details));
    setFormMessage("The backend rejected this audit. Review the highlighted validation messages.");
    return;
  }

  setBackendValidation(null);

  if (error.status === 403) {
    setFormMessage("You are not authorized to create this audit draft.");
    return;
  }

  if (error.status === 400) {
    setFormMessage("The audit draft creation request was malformed.");
    return;
  }

  if (error.status === 404) {
    setFormMessage("The audit template or record is unavailable.");
    return;
  }

  setFormMessage(error.message || "Audit draft creation failed. Try again later.");
}

function readSubmissionDisabledReason(
  clientId: string | null,
  successRecord: OperationalEvidenceRecord | null,
  contextRequiredButUnresolved = false
) {
  if (successRecord) {
    return "This audit draft has already been created.";
  }

  if (contextRequiredButUnresolved) return "Select and verify an eligible evidence context before creating this evidence.";

  return clientId ? null : "You must first select a client before creating an audit draft.";
}

function applyContextFieldPolicy(definition: OetsDefinition | undefined, policy: Record<string, "OPERATOR_EDITABLE" | "READ_ONLY_DERIVED" | "UNAVAILABLE_POST_ISSUANCE"> | undefined, requiredFields: string[] | undefined, lockedValues?: Record<string, OetsFieldValue>) {
  if (!definition) return definition;
  const isF002 = definition.template_metadata.template_code ===
    "OGI_F002_FACILITY_PROFILE_BASELINE_INTELLIGENCE_ASSESSMENT";
  const armaaInputs = new Set([
    "GOVERNANCE_MATURITY",
    "DOCUMENTATION_INTEGRITY",
    "COMPLIANCE_MANAGEMENT",
    "TRAINING_ADMINISTRATION",
    "CORRECTIVE_ACTION_MANAGEMENT",
    "RISK_MANAGEMENT_SYSTEMS",
    "ACCOUNTABILITY_AND_OVERSIGHT"
  ]);
  const armaaOutputs = new Set([
    "ADMINISTRATIVE_RISK_SCORE",
    "ADMINISTRATIVE_CLASSIFICATION"
  ]);
  const intelligenceInputs = new Set([
    "GOVERNANCE_SCORE", "DOCUMENTATION_INTEGRITY_SCORE", "OPERATIONAL_CONTROL_SCORE",
    "COMPETENCY_ASSURANCE_SCORE", "EMERGENCY_READINESS_SCORE", "CORRECTIVE_ACTION_EFFECTIVENESS_SCORE",
    "OPERATIONAL_RISK", "EMERGENCY_PREPAREDNESS", "TRAINING_AND_COMPETENCY", "INSURANCE_READINESS_INDEX"
  ]);
  const intelligenceOutputs = new Set([
    "ODIS_SCORE", "DEFENSIBILITY_CLASSIFICATION", "ADMINISTRATIVE_RISK",
    "DEFENSIBILITY", "INSURANCE_READINESS", "ARI_SCORE", "ARI_CLASSIFICATION", "CLASSIFICATION"
  ]);
  return {
    ...definition,
    sections: definition.sections.map((section) => ({
      ...section,
      fields: section.fields.map((field) => {
        const authority = policy?.[`${section.section_code}.${field.field_code}`] ?? policy?.[field.field_code];
        return {
          ...field,
          required: field.required || Boolean(requiredFields?.includes(field.field_code)),
          readonly: field.readonly || (isF002 && (armaaOutputs.has(field.field_code) || intelligenceOutputs.has(field.field_code) || field.field_code === "ASSESSOR" || field.field_code === "ASSESSMENT_DATE" || field.field_code === "DATE" || field.field_code === "DATE_2")) || isApplicableInitialFieldValue(section, field, lockedValues) || authority === "READ_ONLY_DERIVED" || authority === "UNAVAILABLE_POST_ISSUANCE",
          validation: isF002 && (armaaInputs.has(field.field_code) || intelligenceInputs.has(field.field_code))
            ? { ...field.validation, minimum: 0, maximum: 100 }
            : field.validation,
          description: authority === "UNAVAILABLE_POST_ISSUANCE" ? "Available only after governed Credential issuance." : field.description
        };
      })
    }))
  };
}

function buildContextInitialPayload(definition: OetsDefinition | undefined, values: Record<string, OetsFieldValue> | undefined, repeatableGroups: import("./contextApi").OetsContextRepeatableGroup[] = []): Pick<OetsEvidencePayload, "sections"> | undefined {
  if (!definition || !values) return undefined;
  const sections: OetsEvidencePayload["sections"] = {};
  for (const section of definition.sections) {
    const sectionValues: Record<string, OetsFieldValue> = {};
    for (const field of section.fields) {
      const qualifiedCode = `${section.section_code}.${field.field_code}`;
      const value = values[qualifiedCode] ?? values[field.field_code];
      if (value !== undefined && isApplicableInitialFieldValue(section, field, values)) {
        sectionValues[field.field_code] = value;
      }
    }
    sections[section.section_code] = section.repeatable ? [] : sectionValues;
  }
  for (const group of repeatableGroups) for (const governed of group.sections) sections[governed.section_code] = governed.instances.map((instance) => ({ ...instance }));
  return { sections };
}

const scopeIdentifierFields = new Set([
  "CLIENT_ID", "CLIENT_NUMBER", "CLIENT_ORGANIZATION_ID",
  "FACILITY_ID", "FACILITY_NUMBER"
]);

function isApplicableInitialFieldValue(
  section: OetsDefinition["sections"][number],
  field: OetsDefinition["sections"][number]["fields"][number],
  values?: Record<string, OetsFieldValue>
) {
  const value = values?.[`${section.section_code}.${field.field_code}`] ?? values?.[field.field_code];
  if (value === undefined) return false;
  if (field.field_code === "ORGANIZATION_NAME") {
    const codes = new Set(section.fields.map((candidate) => candidate.field_code));
    if (![...scopeIdentifierFields].some((code) => codes.has(code))) return false;
  }
  if (scopeIdentifierFields.has(field.field_code) && typeof value === "string") {
    const pattern = typeof field.validation?.pattern === "string"
      ? field.validation.pattern
      : undefined;
    if (pattern) {
      try {
        if (!new RegExp(pattern).test(value)) return false;
      } catch {
        return false;
      }
    }
  }
  return true;
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
  disabled = false,
  isLoading,
  needsExplicitClientContext,
  onClientChange,
  sessionClientId
}: {
  clients: ClientContextClient[];
  currentClientId: string | null;
  error: boolean;
  disabled?: boolean;
  isLoading: boolean;
  needsExplicitClientContext: boolean;
  onClientChange: (clientId: string) => void;
  sessionClientId: string | null;
}) {
  if (!needsExplicitClientContext) {
    return (
        <Surface className="border-blue-100 bg-blue-50/50 py-3">
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
    <Surface className="border-blue-100 bg-blue-50/50 py-3">
      <label className="block text-sm font-semibold text-text-primary">
        Client context
        <select
          className="mt-2 min-h-10 w-full rounded-component border border-border bg-surface px-3 py-2 text-sm text-text-primary outline-none focus:border-focus focus:ring-2 focus:ring-focus"
          disabled={disabled || isLoading || error}
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
            : "You must first select a client before creating an audit draft."}
      </p>
    </Surface>
  );
}

function FacilityContextPanel({
  facilities,
  disabled = false,
  onFacilityChange,
  selectedFacilityId
}: {
  facilities: ClientContextFacility[];
  disabled?: boolean;
  onFacilityChange: (facilityId: string) => void;
  selectedFacilityId: string;
}) {
  return (
    <Surface className="border-blue-100 bg-blue-50/50 py-3">
      <label className="block text-sm font-semibold text-text-primary">
        Facility context
        <select
          className="mt-2 min-h-10 w-full rounded-component border border-border bg-surface px-3 py-2 text-sm text-text-primary outline-none focus:border-focus focus:ring-2 focus:ring-focus"
          disabled={disabled}
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

function readQueryErrorMessage(error: unknown) {
  return error instanceof Error && error.message.trim()
    ? error.message
    : "Review the backend response and try again.";
}

function draftCreationPresentation(
  resolution: OetsDraftCreationResolution | undefined,
  templateCode: string | undefined
) {
  if (!resolution || resolution.outcome === "CREATED_NEW") return {
    title: "Draft saved",
    message: "Draft audit created successfully.",
    linkLabel: "Open Audit"
  };
  if (resolution.outcome === "IDEMPOTENT_REPLAY") return {
    title: "Existing Draft returned",
    message: "This Draft-creation request was already completed. Continue to the existing Draft.",
    linkLabel: `Continue existing v${resolution.returned_template_version} Draft`
  };
  const subject = resolution.context_label ? ` for ${resolution.context_label}` : "";
  const policy = duplicatePolicyExplanation(resolution.duplicate_policy);
  if (resolution.version_relation === "HISTORICAL_VERSION_REUSED") {
    const governedNotice = historicalVersionNotices.get(
      `${templateCode ?? ""}@${resolution.returned_template_version}->${resolution.requested_template_version}`
    );
    return {
      title: "Existing historical-version record found",
      message: `An existing live ${templateCode ?? "form"} v${resolution.returned_template_version} record already exists${subject}. It was reopened because ${policy} The current form is v${resolution.requested_template_version}, but this record remains governed by v${resolution.returned_template_version}.${governedNotice ? ` ${governedNotice}` : ""}`,
      linkLabel: `Continue existing v${resolution.returned_template_version} Draft`
    };
  }
  return {
    title: "Existing record found",
    message: `An existing live ${templateCode ?? "form"} v${resolution.returned_template_version} record already exists${subject}. It was reopened because ${policy}`,
    linkLabel: `Continue existing v${resolution.returned_template_version} Draft`
  };
}

const historicalVersionNotices = new Map<string, string>([
  [
    "OGI_F093_INDIVIDUAL_TRAINING_RECORD@3.3->3.4",
    "WRI mirroring and Overall WRI calculation are available only in v3.4."
  ]
]);

function duplicatePolicyExplanation(policy: OetsDraftCreationResolution["duplicate_policy"]) {
  if (policy === "ONE_ACTIVE_DRAFT_PER_SUBJECT") return "the form permits only one active Draft for the selected governed subject.";
  if (policy === "ONE_EVIDENCE_LINEAGE_PER_SUBJECT") return "the form permits only one evidence lineage for the selected governed subject.";
  return "the form permits only one live record for the selected governed subject.";
}

const clientContextStorageKey = "client-lens:selected-client-context";

function SafeState({
  title,
  children
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <Surface>
      <h1 className="text-xl font-semibold text-text-primary">{title}</h1>
      <div className="mt-2 text-sm text-text-muted">{children}</div>
    </Surface>
  );
}
