import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";

import { Button } from "../ui/components/Button";
import { Surface } from "../ui/components/Surface";
import { normalizeDisplayAcronyms } from "../ui/displayText";
import {
  assembleEvidencePayload,
  createEvidenceStateFromPayload,
  createInitialEvidenceState,
  createRepeatableSectionInstance,
  EditableOetsState,
  orderedFields,
  orderedSections,
  repeatableConstraints,
  RepeatableSectionInstance
} from "./evidenceState";
import { isSupportedOetsFieldType } from "./definitionGuards";
import { isOetsDeveloperDiagnosticsEnabled } from "./developerDiagnostics";
import {
  evidenceSectionGuidance,
  formatEvidenceSectionTitle,
} from "./evidencePresentation";
import { CreateEvidenceAttestationRequest, EvidenceAttestation } from "./attestationApi";
import { isF048CredentialOfficerNumberProjection, projectF048CredentialOfficerNumber } from "./f048CredentialOfficerProjection";
import { OetsProgressNavigator } from "./OetsProgressNavigator";
import {
  deriveOetsProgress,
  OetsProgressSectionInput,
  progressValueKey
} from "./oetsProgress";
import {
  GovernedAttestationContext,
  GovernedAttestationControl
} from "./GovernedAttestationControl";
import {
  OetsDefinition,
  OetsEvidencePayload,
  OetsField,
  OetsFieldAuthorityPresentation,
  OetsFieldAuthorityPresentationField,
  OetsFieldValue,
  OetsTemplateRuntimeDefinition
} from "./types";
import { buildFieldAuthorityIndex, fieldAuthorityKey, fieldAuthorityMessage } from "./fieldAuthorityPresentation";
import {
  fieldErrorKey,
  OetsValidationSummary
} from "./evidenceValidation";

type RepeatableSectionCounters = Record<string, number>;

export interface OetsFieldVisibilityContext {
  field: OetsField;
  sectionCode: string;
  value: OetsFieldValue | undefined;
}

export type OetsFieldVisibilityPolicy = (
  context: OetsFieldVisibilityContext
) => boolean;

interface OetsRendererProps {
  runtimeTemplate: OetsTemplateRuntimeDefinition;
  definition: OetsDefinition;
  readOnly?: boolean;
  backendValidation?: OetsValidationSummary | null;
  formMessage?: string | null;
  initialPayload?: Pick<OetsEvidencePayload, "sections">;
  fieldVisibilityPolicy?: OetsFieldVisibilityPolicy;
  isSubmitting?: boolean;
  onSubmit?: (payload: OetsEvidencePayload) => void;
  submitDisabledReason?: string | null;
  submitHelpText?: string;
  submitLabel?: string;
  submittingLabel?: string;
  submitSuccessMessage?: string;
  submitSuccessTitle?: string;
  submitSuccessLinkLabel?: string;
  submitSuccess?: {
    evidenceRecordId: string;
    lifecycleState: string;
    payloadChecksum?: string;
    recordHref?: string;
  } | null;
  attestations?: readonly EvidenceAttestation[];
  attestationContext?: GovernedAttestationContext;
  attestationPending?: boolean;
  attestationErrorMessage?: string | null;
  onAttest?: (request: CreateEvidenceAttestationRequest) => Promise<unknown>;
  onDirtyChange?: (dirty: boolean) => void;
  embedded?: boolean;
  actionPortalId?: string;
  repeatableSectionControls?: Record<string, { cardinality: "FIXED"; instance_count: number }>;
  repeatableRowControl?: {
    sectionCode: string;
    isLocked: (values: Record<string, OetsFieldValue>) => boolean;
    renderAction: (values: Record<string, OetsFieldValue>, index: number) => ReactNode;
  };
  fieldAuthority?: OetsFieldAuthorityPresentation;
}

export function OetsRenderer({
  runtimeTemplate,
  definition,
  readOnly = false,
  backendValidation,
  formMessage,
  initialPayload,
  fieldVisibilityPolicy,
  isSubmitting = false,
  onSubmit,
  submitDisabledReason,
  submitHelpText = "Create a draft audit record.",
  submitLabel = "Create Audit Draft",
  submittingLabel = "Creating...",
  submitSuccessMessage = "Draft audit created successfully.",
  submitSuccessTitle = "Draft saved",
  submitSuccessLinkLabel = "Open Audit",
  submitSuccess,
  attestations = [],
  attestationContext,
  attestationPending = false,
  attestationErrorMessage,
  onAttest,
  onDirtyChange,
  embedded = false,
  actionPortalId,
  repeatableSectionControls,
  repeatableRowControl,
  fieldAuthority
}: OetsRendererProps) {
  const diagnosticsEnabled = isOetsDeveloperDiagnosticsEnabled();
  const [dismissedFormMessage, setDismissedFormMessage] = useState<string | null>(null);
  const [dismissedSuccessChecksum, setDismissedSuccessChecksum] = useState<string | null>(null);
  const [state, setState] = useState(() =>
    initialPayload
      ? createEvidenceStateFromPayload(definition, initialPayload)
      : createInitialEvidenceState(definition)
  );
  const [repeatableCounters, setRepeatableCounters] =
    useState<RepeatableSectionCounters>(() => createInitialRepeatableCounters(definition));
  const [explicitValueKeys, setExplicitValueKeys] = useState<Set<string>>(() =>
    createInitialExplicitValueKeys(definition, initialPayload)
  );
  const payload = useMemo(
    () => assembleEvidencePayload(runtimeTemplate, definition, state),
    [definition, runtimeTemplate, state]
  );
  const savedPayloadRef = useRef(JSON.stringify(payload.sections));
  const dirty = Boolean(initialPayload) && JSON.stringify(payload.sections) !== savedPayloadRef.current;
  useEffect(() => onDirtyChange?.(dirty), [dirty, onDirtyChange]);
  useEffect(() => {
    if (formMessage !== dismissedFormMessage) {
      setDismissedFormMessage(null);
    }
  }, [dismissedFormMessage, formMessage]);
  useEffect(() => {
    if (isSubmitting) {
      setDismissedFormMessage(null);
    }
  }, [isSubmitting]);
  // A changed initial payload is the authoritative response from a confirmed save.
  // Rehydrate the visible form so server-derived/calculated fields are shown immediately.
  useEffect(() => {
    if (!initialPayload) return;
    const authoritativeState = createEvidenceStateFromPayload(definition, initialPayload);
    const savedSections = JSON.stringify(
      assembleEvidencePayload(runtimeTemplate, definition, authoritativeState).sections
    );
    setState(authoritativeState);
    setRepeatableCounters(createInitialRepeatableCounters(definition));
    setExplicitValueKeys(createInitialExplicitValueKeys(definition, initialPayload));
    savedPayloadRef.current = savedSections;
    onDirtyChange?.(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPayload]);
  const renderedSections = useMemo(
    () => createRenderedSectionProjection(definition, state, fieldVisibilityPolicy),
    [definition, fieldVisibilityPolicy, state]
  );
  const fieldAuthorityIndex = useMemo(
    () => fieldAuthority ? buildFieldAuthorityIndex(definition, fieldAuthority) : undefined,
    [definition, fieldAuthority]
  );
  const hasNumericConstraintViolations = useMemo(
    () => containsNumericConstraintViolation(definition, state, fieldVisibilityPolicy),
    [definition, fieldVisibilityPolicy, state]
  );
  const effectiveSubmitDisabledReason = submitDisabledReason ??
    (hasNumericConstraintViolations
      ? "Correct the highlighted numeric values before saving."
      : null);
  const progressModel = useMemo(
    () =>
      deriveOetsProgress({
        sections: renderedSections.map(toProgressSectionInput),
        explicitValueKeys,
        attestations,
        attestationContext,
        attestationBaselineCurrent: !dirty,
        validation: backendValidation ?? null
      }),
    [
      attestationContext,
      attestations,
      backendValidation,
      dirty,
      explicitValueKeys,
      renderedSections
    ]
  );
  const actionPortalTarget = actionPortalId
    ? document.getElementById(actionPortalId)
    : null;

  return (
    <div className="space-y-5">
      {submitSuccess && dismissedSuccessChecksum !== (submitSuccess.payloadChecksum ?? submitSuccess.evidenceRecordId) ? (
        <div
          aria-live="polite"
          className="fixed right-4 top-4 z-[70] w-[min(28rem,calc(100vw-2rem))] rounded-component border border-state-success bg-white p-4 shadow-xl"
          role="status"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-state-success">{submitSuccessTitle}</p>
              <p className="mt-1 break-words text-sm leading-5 text-text-primary [overflow-wrap:anywhere]">{submitSuccessMessage}</p>
            </div>
            <button
              aria-label="Dismiss save confirmation"
              className="shrink-0 rounded-component px-2 py-1 text-lg leading-none text-text-muted hover:bg-elevated hover:text-text-primary"
              onClick={() => setDismissedSuccessChecksum(submitSuccess.payloadChecksum ?? submitSuccess.evidenceRecordId)}
              type="button"
            >
              ×
            </button>
          </div>
        </div>
      ) : null}
      {formMessage && dismissedFormMessage !== formMessage ? (
        <div
          aria-live="assertive"
          className="fixed right-4 top-4 z-[70] w-[min(28rem,calc(100vw-2rem))] rounded-component border border-state-error bg-white p-4 shadow-xl"
          role="alert"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-state-error">Draft could not be saved</p>
              <p className="mt-1 break-words text-sm leading-5 text-text-primary [overflow-wrap:anywhere]">{formMessage}</p>
            </div>
            <button
              aria-label="Dismiss save error"
              className="shrink-0 rounded-component px-2 py-1 text-lg leading-none text-text-muted hover:bg-elevated hover:text-text-primary"
              onClick={() => setDismissedFormMessage(formMessage)}
              type="button"
            >
              ×
            </button>
          </div>
          {backendValidation && Object.keys(backendValidation.fieldMessages).length > 0 ? (
            <button
              className="mt-3 text-sm font-semibold text-primary-blue underline-offset-2 hover:underline"
              onClick={() => {
                const firstInvalidField = document.querySelector<HTMLElement>("[data-oets-invalid='true']");
                firstInvalidField?.scrollIntoView({ behavior: "smooth", block: "center" });
                firstInvalidField?.focus({ preventScroll: true });
              }}
              type="button"
            >
              Review first highlighted field
            </button>
          ) : null}
        </div>
      ) : null}
      {/* AppShell's header is document-flow rather than sticky. This OETS-local
          strip therefore uses the viewport top after the shell header scrolls away. */}
      {!embedded ? <Surface className="sticky top-0 z-20 flex flex-col gap-3 border-l-4 border-l-accent-red bg-gradient-to-r from-blue-50/95 to-white/95 p-3 shadow-[0_2px_8px_rgba(15,45,95,0.08)] backdrop-blur-sm lg:flex-row lg:items-center lg:justify-between" data-testid="oets-action-strip">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Audit Template</p><h1 className="text-xl font-semibold text-primary-navy sm:text-2xl">{definition.template_metadata.template_name}</h1>
            <p className="text-sm text-text-muted">
              {runtimeTemplate.template_code} · Version{" "}
              {runtimeTemplate.template_version}
            </p>
          </div>
        <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between lg:justify-end">
          {readOnly ? (
            <span className="inline-flex w-fit rounded-component border border-border px-2 py-1 text-xs font-semibold uppercase text-text-muted">
              Read only
            </span>
          ) : null}
        {!readOnly && onSubmit ? (
          <>
            <div className="max-w-md text-sm text-text-muted lg:text-right">
              {effectiveSubmitDisabledReason ?? submitHelpText}
            </div>
            <Button
              disabled={isSubmitting || Boolean(effectiveSubmitDisabledReason)}
              onClick={() => onSubmit(payload)}
            >
              {isSubmitting ? submittingLabel : submitLabel}
            </Button>
          </>
        ) : null}
        </div>
      </Surface> : null}

      {embedded && actionPortalTarget
        ? createPortal(
            !readOnly && onSubmit ? (
              <Button
                disabled={isSubmitting || Boolean(effectiveSubmitDisabledReason)}
                onClick={() => onSubmit(payload)}
              >
                {isSubmitting ? submittingLabel : submitLabel}
              </Button>
            ) : null,
            actionPortalTarget
          )
        : null}

      <div className="space-y-3" data-testid="oets-flow-messages">
        {submitSuccess ? (
          <div
            className="mt-4 space-y-2 rounded-component border border-state-success bg-elevated p-3 text-sm text-text-primary"
            role="status"
          >
            <p>
              {submitSuccessMessage}
            </p>
            {submitSuccess.recordHref ? (
              <Link
                className="inline-flex font-semibold text-primary-blue underline-offset-2 hover:underline"
                to={submitSuccess.recordHref}
              >
                {submitSuccessLinkLabel}
              </Link>
            ) : null}
          </div>
        ) : null}
        {formMessage ? (
          <div
            className="mt-4 rounded-component border border-state-error bg-elevated p-3 text-sm text-text-primary"
            role="alert"
          >
            {formMessage}
          </div>
        ) : null}
        {diagnosticsEnabled && backendValidation ? (
          <details className="mt-4 rounded-component border border-border bg-elevated p-3 text-sm">
            <summary className="cursor-pointer font-semibold text-text-primary">
              Developer validation diagnostics
            </summary>
            <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap text-xs text-text-muted">
              {JSON.stringify(backendValidation, null, 2)}
            </pre>
          </details>
        ) : null}
      </div>

      <div className={embedded ? "space-y-3" : "space-y-4 lg:grid lg:grid-cols-[minmax(0,1fr)_17rem] lg:items-start lg:gap-5 lg:space-y-0"} data-testid="oets-workspace">
        {!embedded ? <div className="lg:sticky lg:top-[7.5rem] lg:col-start-2 lg:row-start-1 lg:pt-4" data-testid="oets-progress-column"><OetsProgressNavigator model={progressModel} /></div> : null}
        <div className={`space-y-5 rounded-panel bg-[#EEF3F9] p-3 sm:p-4 ${embedded ? "" : "lg:col-start-1 lg:row-start-1 lg:px-6"}`} data-testid="oets-section-stack">
      {renderedSections.map(({ domId, section, sourceSection, sectionState, sectionValues }) => {
        if (section.repeatable) {
          const constraints = repeatableConstraints(sourceSection);
          return (
            <div
              className="scroll-mt-[10.5rem] outline-none focus-visible:ring-2 focus-visible:ring-focus lg:scroll-mt-[8.5rem]"
              data-oets-section-id={section.section_id}
              id={domId}
              key={section.section_id}
              tabIndex={-1}
            >
            <RepeatableSection
              attestationContext={attestationContext}
              attestationErrorMessage={attestationErrorMessage}
              attestationPending={attestationPending}
              attestations={attestations}
              instances={Array.isArray(sectionState) ? sectionState : []}
              fixed={repeatableSectionControls?.[section.section_code]?.cardinality === "FIXED"}
              maximumInstances={constraints.maximumInstances}
              minimumInstances={constraints.minimumInstances}
              rowControl={repeatableRowControl?.sectionCode === section.section_code ? repeatableRowControl : undefined}
              onAdd={() => {
                const existing = state[section.section_code];
                if (constraints.maximumInstances !== null && Array.isArray(existing) && existing.length >= constraints.maximumInstances) return;
                const nextIndex = (repeatableCounters[section.section_code] ?? 1) + 1;

                setState((current) => {
                  const currentInstances = current[section.section_code];
                  const instances = Array.isArray(currentInstances)
                    ? currentInstances
                    : [];
                  if (constraints.maximumInstances !== null && instances.length >= constraints.maximumInstances) {
                    return current;
                  }

                  return {
                    ...current,
                    [section.section_code]: [
                      ...instances,
                      createRepeatableSectionInstance(sourceSection, nextIndex - 1)
                    ]
                  };
                });
                setRepeatableCounters((current) => ({
                  ...current,
                  [section.section_code]: nextIndex
                }));
              }}
              onRemove={(key) => {
                setState((current) => {
                  const currentInstances = current[section.section_code];

                  if (!Array.isArray(currentInstances)) {
                    return current;
                  }

                  return {
                    ...current,
                    [section.section_code]: currentInstances.filter(
                      (instance) => instance.key !== key
                    )
                  };
                });
              }}
              onValueChange={(key, fieldCode, value) => {
                setExplicitValueKeys((current) => addExplicitValueKey(
                  current,
                  progressValueKey(section.section_code, key, fieldCode)
                ));
                setState((current) => {
                  const currentInstances = current[section.section_code];

                  if (!Array.isArray(currentInstances)) {
                    return current;
                  }

                  return {
                    ...current,
                    [section.section_code]: currentInstances.map((instance) =>
                      instance.key === key
                        ? {
                            ...instance,
                            values: {
                              ...instance.values,
                              [fieldCode]: value
                            }
                          }
                        : instance
                    )
                  };
                });
              }}
              readOnly={readOnly}
              onAttest={onAttest}
              section={section}
              validation={backendValidation ?? null}
              developerDiagnostics={diagnosticsEnabled}
              fieldAuthorityIndex={fieldAuthorityIndex}
            />
            </div>
          );
        }

        return (
          <div
            className="scroll-mt-[10.5rem] outline-none focus-visible:ring-2 focus-visible:ring-focus lg:scroll-mt-[8.5rem]"
            data-oets-section-id={section.section_id}
            id={domId}
            key={section.section_id}
            tabIndex={-1}
          >
          <OetsSectionCard
            attestationContext={attestationContext}
            attestationErrorMessage={attestationErrorMessage}
            attestationPending={attestationPending}
            attestations={attestations}
            onValueChange={(fieldCode, value) => {
              setExplicitValueKeys((current) => addExplicitValueKey(
                current,
                progressValueKey(section.section_code, "single", fieldCode)
              ));
              setState((current) => {
                const currentValues = current[section.section_code];

                if (Array.isArray(currentValues)) {
                  return current;
                }

                return {
                  ...current,
                  [section.section_code]: {
                    ...(currentValues ?? {}),
                    [fieldCode]: value
                  }
                };
              });
            }}
            readOnly={readOnly}
            onAttest={onAttest}
            section={section}
            validation={backendValidation ?? null}
            developerDiagnostics={diagnosticsEnabled}
            fieldAuthorityIndex={fieldAuthorityIndex}
            values={sectionValues}
          />
          </div>
        );
      })}
        </div>
      </div>

      {diagnosticsEnabled ? (
        <Surface>
          <details>
            <summary className="cursor-pointer text-base font-semibold text-text-primary">
              Developer payload diagnostics
            </summary>
            <pre className="mt-3 max-h-96 overflow-auto rounded-component bg-elevated p-3 text-xs text-text-primary">
              {JSON.stringify(payload, null, 2)}
            </pre>
          </details>
        </Surface>
      ) : null}
    </div>
  );
}

type Section = OetsDefinition["sections"][number];

interface OetsSectionCardProps {
  section: Section;
  values: Record<string, OetsFieldValue>;
  readOnly: boolean;
  validation: OetsValidationSummary | null;
  onValueChange: (fieldCode: string, value: OetsFieldValue) => void;
  attestations: readonly EvidenceAttestation[];
  attestationContext?: GovernedAttestationContext;
  attestationPending: boolean;
  attestationErrorMessage?: string | null;
  onAttest?: (request: CreateEvidenceAttestationRequest) => Promise<unknown>;
  developerDiagnostics: boolean;
  fieldAuthorityIndex?: ReadonlyMap<string, OetsFieldAuthorityPresentationField>;
}

function OetsSectionCard({
  section,
  values,
  readOnly,
  validation,
  onValueChange,
  attestations,
  attestationContext,
  attestationPending,
  attestationErrorMessage,
  onAttest,
  developerDiagnostics,
  fieldAuthorityIndex
}: OetsSectionCardProps) {
  return (
    <Surface className="overflow-hidden border-[#CFDCEB] bg-white p-0 shadow-[0_2px_8px_rgba(15,45,95,0.06)]">
      <SectionHeader section={section} />
      <div className="bg-white p-5">
      {developerDiagnostics ? <ValidationMessages messages={validation?.sectionMessages[section.section_code]} /> : null}
      <div className="grid gap-x-6 gap-y-6 md:grid-cols-2">
        {renderableFields(section.fields).map((field) => (
          <OetsFieldControl
            attestationContext={attestationContext}
            attestationErrorMessage={attestationErrorMessage}
            attestationPending={attestationPending}
            attestations={attestations}
            errors={
              validation?.fieldMessages[
                fieldErrorKey(section.section_code, field.field_code)
              ]
            }
            localErrors={numericConstraintErrors(field, values[field.field_code])}
            field={field}
            authority={fieldAuthorityIndex?.get(fieldAuthorityKey(section.section_code, field.field_id, field.field_code))}
            key={field.field_id}
            onChange={(value) => onValueChange(field.field_code, value)}
            readOnly={field.field_type === "SIGNATURE"
              ? readOnly && !onAttest
              : readOnly || field.readonly || isGovernedAttestationProjection(field) || isAuthorityReadOnly(
                  fieldAuthorityIndex?.get(fieldAuthorityKey(section.section_code, field.field_id, field.field_code))
                )}
            sectionInstanceIndex={null}
            value={projectGovernedAttestationValue(field, values[field.field_code], attestations, null)}
            onAttest={onAttest}
            developerDiagnostics={developerDiagnostics}
          />
        ))}
      </div>
      </div>
    </Surface>
  );
}

interface RepeatableSectionProps {
  section: Section;
  instances: RepeatableSectionInstance[];
  readOnly: boolean;
  validation: OetsValidationSummary | null;
  onAdd: () => void;
  onRemove: (key: string) => void;
  onValueChange: (
    key: string,
    fieldCode: string,
    value: OetsFieldValue
  ) => void;
  attestations: readonly EvidenceAttestation[];
  attestationContext?: GovernedAttestationContext;
  attestationPending: boolean;
  attestationErrorMessage?: string | null;
  onAttest?: (request: CreateEvidenceAttestationRequest) => Promise<unknown>;
  developerDiagnostics: boolean;
  fixed?: boolean;
  maximumInstances: number | null;
  minimumInstances: number;
  rowControl?: {
    isLocked: (values: Record<string, OetsFieldValue>) => boolean;
    renderAction: (values: Record<string, OetsFieldValue>, index: number) => ReactNode;
  };
  fieldAuthorityIndex?: ReadonlyMap<string, OetsFieldAuthorityPresentationField>;
}

function RepeatableSection({
  section,
  instances,
  readOnly,
  validation,
  onAdd,
  onRemove,
  onValueChange,
  attestations,
  attestationContext,
  attestationPending,
  attestationErrorMessage,
  onAttest,
  developerDiagnostics,
  fixed = false,
  maximumInstances,
  minimumInstances,
  rowControl,
  fieldAuthorityIndex
}: RepeatableSectionProps) {
  return (
    <Surface className="overflow-hidden border-[#CFDCEB] bg-white p-0 shadow-[0_2px_8px_rgba(15,45,95,0.06)]">
      <div className="relative flex flex-col gap-3 bg-blue-50 sm:flex-row sm:items-center sm:justify-between">
        <SectionHeader section={section} />
        {!fixed ? <div className="px-5 pb-4 sm:pb-0">
          <Button disabled={readOnly || (maximumInstances !== null && instances.length >= maximumInstances)} onClick={onAdd} variant="secondary">
            Add entry
          </Button>
        </div> : null}
      </div>

      <div className="space-y-5 bg-white p-5">
        {developerDiagnostics ? <ValidationMessages messages={validation?.sectionMessages[section.section_code]} /> : null}
        {instances.map((instance, index) => (
          <div
            className="rounded-component border border-border bg-canvas p-4"
            key={instance.key}
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-text-primary">
                Entry {index + 1}
              </h3>
              <div className="flex items-center gap-2">
              {rowControl?.renderAction(instance.values, index)}
              {!fixed ? <Button
                disabled={readOnly || Boolean(rowControl?.isLocked(instance.values)) || instances.length <= minimumInstances}
                onClick={() => onRemove(instance.key)}
                variant="secondary"
              >
                Remove
              </Button> : null}
              </div>
            </div>
            <div className="grid gap-x-6 gap-y-6 md:grid-cols-2">
              {renderableFields(section.fields).map((field) => (
                <OetsFieldControl
                  attestationContext={attestationContext}
                  attestationErrorMessage={attestationErrorMessage}
                  attestationPending={attestationPending}
                  attestations={attestations}
                  field={field}
                  authority={fieldAuthorityIndex?.get(fieldAuthorityKey(section.section_code, field.field_id, field.field_code))}
                  key={field.field_id}
                  onChange={(value) =>
                    onValueChange(instance.key, field.field_code, value)
                  }
                  errors={
                    validation?.fieldMessages[
                      fieldErrorKey(section.section_code, field.field_code, index)
                    ]
                  }
                  localErrors={numericConstraintErrors(field, instance.values[field.field_code])}
                  readOnly={Boolean(rowControl?.isLocked(instance.values)) || (field.field_type === "SIGNATURE"
                    ? readOnly && !onAttest
                    : readOnly || field.readonly || isGovernedAttestationProjection(field) || isAuthorityReadOnly(
                        fieldAuthorityIndex?.get(fieldAuthorityKey(section.section_code, field.field_id, field.field_code))
                      ))}
                  sectionInstanceIndex={index}
                  value={projectGovernedAttestationValue(field, instance.values[field.field_code], attestations, index)}
                  onAttest={onAttest}
                  developerDiagnostics={developerDiagnostics}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </Surface>
  );
}

export function isAuthorityReadOnly(authority?: OetsFieldAuthorityPresentationField) {
  return authority?.presentation_editability === "READ_ONLY" ||
    authority?.presentation_editability === "UNAVAILABLE";
}

function visibleSectionFields(
  section: Section,
  values: Record<string, OetsFieldValue>,
  fieldVisibilityPolicy: OetsFieldVisibilityPolicy | undefined
) {
  const fields = renderableFields(section.fields);

  if (!fieldVisibilityPolicy) {
    return fields;
  }

  return fields.filter((field) =>
    fieldVisibilityPolicy({
      field,
      sectionCode: section.section_code,
      value: values[field.field_code]
    })
  );
}

function SectionHeader({ section }: { section: Section }) {
  const guidance = evidenceSectionGuidance(section.section_code);
  return (
    <div className="relative flex-1 border-b border-blue-100 bg-blue-50 px-5 py-4 before:absolute before:inset-y-0 before:left-0 before:w-1 before:bg-accent-red">
      <p className="text-xs font-semibold uppercase tracking-wide text-primary-blue">
        Section {section.sequence}
      </p>
      <h2 className="mt-1 text-xl font-semibold text-primary-navy">
        {formatEvidenceSectionTitle(section.title)}
      </h2>
      {section.description ? (
        <p className="mt-1 text-sm text-text-muted">
          {formatEvidenceSectionTitle(section.description)}
        </p>
      ) : null}
      {guidance ? (
        <p className="mt-3 rounded-component border border-blue-200 bg-white px-3 py-2 text-sm font-medium text-primary-navy">
          {guidance}
        </p>
      ) : null}
    </div>
  );
}

interface OetsFieldControlProps {
  field: OetsField;
  value: OetsFieldValue | undefined;
  readOnly: boolean;
  errors?: string[];
  localErrors?: string[];
  onChange: (value: OetsFieldValue) => void;
  attestations: readonly EvidenceAttestation[];
  attestationContext?: GovernedAttestationContext;
  attestationPending: boolean;
  attestationErrorMessage?: string | null;
  sectionInstanceIndex: number | null;
  onAttest?: (request: CreateEvidenceAttestationRequest) => Promise<unknown>;
  developerDiagnostics: boolean;
  authority?: OetsFieldAuthorityPresentationField;
}

function OetsFieldControl({
  field,
  value,
  readOnly,
  errors,
  localErrors,
  onChange,
  attestations,
  attestationContext,
  attestationPending,
  attestationErrorMessage,
  sectionInstanceIndex,
  onAttest,
  developerDiagnostics,
  authority
}: OetsFieldControlProps) {
  if (!isSupportedOetsFieldType(field.field_type)) {
    return <UnsupportedField field={field} reason="Unsupported field type" />;
  }

  if (field.field_type === "SIGNATURE") {
    return (
      <GovernedAttestationControl
        context={attestationContext}
        errorMessage={attestationErrorMessage}
        pending={attestationPending}
        attestations={attestations}
        field={field}
        onAttest={onAttest}
        readOnly={readOnly}
        sectionInstanceIndex={sectionInstanceIndex}
      />
    );
  }

  const id = sectionInstanceIndex === null
    ? `oets-${field.field_id}`
    : `oets-${field.field_id}-${sectionInstanceIndex}`;
  const authorityId = authority ? `${id}-authority` : undefined;

  if (field.field_type === "BOOLEAN" || field.field_type === "CHECKBOX") {
    return (
      <div data-oets-invalid={errors?.length || localErrors?.length ? "true" : undefined} tabIndex={errors?.length || localErrors?.length ? -1 : undefined} className={errors?.length || localErrors?.length ? "rounded-component border-l-2 border-state-error pl-3 text-sm" : "text-sm"}>
        <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-component border border-transparent bg-blue-50/30 px-3 py-2 text-primary-navy hover:border-blue-200 hover:bg-blue-50 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60" htmlFor={id}>
          {renderControl(field, id, value, readOnly, onChange, authorityId)}
          <span className="font-semibold">
            {normalizeDisplayAcronyms(field.label)}
            {field.required ? <span className="ml-1 text-state-error" aria-label="required">*</span> : null}
          </span>
        </label>
        {field.description ? <span className="mt-1 block text-xs text-text-muted">{normalizeDisplayAcronyms(field.description)}</span> : null}
        {authority ? <span className="mt-1 block text-xs font-medium text-primary-blue" id={authorityId}>{fieldAuthorityMessage(authority)}</span> : null}
        <ValidationMessages messages={localErrors} />
        {developerDiagnostics ? <ValidationMessages messages={errors} /> : errors?.length ? <span className="mt-2 block text-sm font-semibold text-state-error" role="alert">Review this field.</span> : null}
      </div>
    );
  }

  return (
    <div data-oets-invalid={errors?.length || localErrors?.length ? "true" : undefined} tabIndex={errors?.length || localErrors?.length ? -1 : undefined} className={errors?.length || localErrors?.length ? "rounded-component border-l-2 border-state-error pl-3 text-sm" : "block text-sm"}>
      <label htmlFor={id}><FieldLabel field={field} /></label>
      {renderControl(field, id, value, readOnly, onChange, authorityId)}
      {field.description ? (
        <span className="mt-1 block text-xs text-text-muted">
          {normalizeDisplayAcronyms(field.description)}
        </span>
      ) : null}
      {authority ? <span className="mt-1 block text-xs font-medium text-primary-blue" id={authorityId}>{fieldAuthorityMessage(authority)}</span> : null}
      <ValidationMessages messages={localErrors} />
      {developerDiagnostics ? <ValidationMessages messages={errors} /> : errors?.length ? <span className="mt-2 block text-sm font-semibold text-state-error" role="alert">Review this field.</span> : null}
    </div>
  );
}

function ValidationMessages({ messages }: { messages?: string[] }) {
  if (!messages?.length) {
    return null;
  }

  return (
    <span className="mt-2 block space-y-1 text-sm font-semibold text-state-error">
      {messages.map((message) => (
        <span className="block" key={message}>
          {message}
        </span>
      ))}
    </span>
  );
}

function FieldLabel({ field }: { field: OetsField }) {
  return (
    <span className="mb-2 block font-semibold text-primary-navy">
      {normalizeDisplayAcronyms(field.label)}
      {field.required ? (
        <span className="ml-1 text-state-error" aria-label="required">
          *
        </span>
      ) : null}
    </span>
  );
}

function renderControl(
  field: OetsField,
  id: string,
  value: OetsFieldValue | undefined,
  readOnly: boolean,
  onChange: (value: OetsFieldValue) => void,
  describedBy?: string
) {
  const stringValue =
    typeof value === "string" || typeof value === "number" ? String(value) : "";

  switch (field.field_type) {
    case "TEXTAREA":
      return (
        <textarea
          aria-describedby={describedBy}
          className={inputClassName}
          disabled={readOnly}
          id={id}
          onChange={(event) => onChange(event.target.value || null)}
          placeholder={field.placeholder ? normalizeDisplayAcronyms(field.placeholder) : undefined}
          rows={3}
          value={stringValue}
        />
      );
    case "BOOLEAN":
    case "CHECKBOX":
      return (
        <input
          aria-describedby={describedBy}
          checked={value === true}
          className="h-5 w-5 rounded border-border text-primary-blue focus:ring-focus disabled:opacity-70"
          disabled={readOnly}
          id={id}
          onChange={(event) => onChange(event.target.checked)}
          type="checkbox"
        />
      );
    case "RADIO":
      return renderRadioGroup(field, id, value, readOnly, onChange, describedBy);
    case "SELECT":
      return renderSelect(field, id, value, readOnly, onChange, describedBy);
    case "MULTISELECT":
      return renderMultiSelect(field, id, value, readOnly, onChange, describedBy);
    case "DATE":
      return renderInput(field, id, "date", stringValue, readOnly, onChange, describedBy);
    case "DECIMAL":
    case "NUMBER":
      return renderInput(field, id, "number", stringValue, readOnly, onChange, describedBy);
    case "EMAIL":
      return renderInput(field, id, "email", stringValue, readOnly, onChange, describedBy);
    case "PHONE":
      return renderInput(field, id, "tel", stringValue, readOnly, onChange, describedBy);
    case "TIME":
      return renderInput(field, id, "time", stringValue, readOnly, onChange, describedBy);
    case "URL":
      return renderInput(field, id, "url", stringValue, readOnly, onChange, describedBy);
    case "TEXT":
    default:
      return renderInput(field, id, "text", stringValue, readOnly, onChange, describedBy);
  }
}

function renderInput(
  field: OetsField,
  id: string,
  type: string,
  value: string,
  readOnly: boolean,
  onChange: (value: OetsFieldValue) => void,
  describedBy?: string
) {
  const minimum = numericValidationBound(field, "minimum");
  const maximum = numericValidationBound(field, "maximum");
  const numeric = type === "number";
  return (
    <input
      aria-describedby={describedBy}
      className={inputClassName}
      disabled={readOnly}
      id={id}
      max={numeric ? maximum : undefined}
      min={numeric ? minimum : undefined}
      onChange={(event) => onChange(event.target.value || null)}
      placeholder={field.placeholder ? normalizeDisplayAcronyms(field.placeholder) : undefined}
      step={numeric ? (field.field_type === "NUMBER" ? 1 : "any") : undefined}
      type={type}
      value={value}
    />
  );
}

function numericValidationBound(field: OetsField, key: "minimum" | "maximum") {
  const value = field.validation?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function numericConstraintErrors(field: OetsField, value: OetsFieldValue | undefined) {
  if ((field.field_type !== "NUMBER" && field.field_type !== "DECIMAL") || value === undefined || value === null || value === "") return [];
  const numericValue = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  if (!Number.isFinite(numericValue)) return [];
  const minimum = numericValidationBound(field, "minimum");
  const maximum = numericValidationBound(field, "maximum");
  if (minimum !== undefined && numericValue < minimum || maximum !== undefined && numericValue > maximum) {
    if (minimum !== undefined && maximum !== undefined) return [`Enter a value from ${minimum} through ${maximum}.`];
    if (minimum !== undefined) return [`Enter a value greater than or equal to ${minimum}.`];
    return [`Enter a value less than or equal to ${maximum}.`];
  }
  return [];
}

function containsNumericConstraintViolation(
  definition: OetsDefinition,
  state: EditableOetsState,
  fieldVisibilityPolicy: OetsFieldVisibilityPolicy | undefined
) {
  return orderedSections(definition).some((section) => {
    const sectionState = state[section.section_code];
    const editableNumericFields = (values: Record<string, OetsFieldValue>) =>
      orderedFields(section.fields).filter((field) =>
        !field.readonly &&
        (field.field_type === "NUMBER" || field.field_type === "DECIMAL") &&
        (!fieldVisibilityPolicy || fieldVisibilityPolicy({
          field,
          sectionCode: section.section_code,
          value: values[field.field_code]
        }))
      );
    if (Array.isArray(sectionState)) {
      return sectionState.some((instance) => editableNumericFields(instance.values).some((field) =>
        numericConstraintErrors(field, instance.values[field.field_code]).length > 0
      ));
    }
    const values = sectionState ?? {};
    return editableNumericFields(values).some((field) =>
      numericConstraintErrors(field, values[field.field_code]).length > 0
    );
  });
}

function renderSelect(
  field: OetsField,
  id: string,
  value: OetsFieldValue | undefined,
  readOnly: boolean,
  onChange: (value: OetsFieldValue) => void,
  describedBy?: string
) {
  if (!field.options?.length) {
    return <UnsupportedField field={field} reason="Options are required." />;
  }

  return (
    <select
      aria-describedby={describedBy}
      className={inputClassName}
      disabled={readOnly}
      id={id}
      onChange={(event) => onChange(event.target.value || null)}
      value={typeof value === "string" ? value : ""}
    >
      <option value="">Select...</option>
      {orderedOptions(field).map((option) => (
        <option key={option.value} value={option.value}>
          {normalizeDisplayAcronyms(option.label)}
        </option>
      ))}
    </select>
  );
}

function renderMultiSelect(
  field: OetsField,
  id: string,
  value: OetsFieldValue | undefined,
  readOnly: boolean,
  onChange: (value: OetsFieldValue) => void,
  describedBy?: string
) {
  if (!field.options?.length) {
    return <UnsupportedField field={field} reason="Options are required." />;
  }

  const selectedValues = Array.isArray(value) ? value : [];

  return (
    <fieldset aria-describedby={describedBy} aria-labelledby={`${id}-label`} className="grid gap-2 rounded-component border-2 border-[#9db3ca] bg-[#f3f7fc] p-3 shadow-sm sm:grid-cols-2" id={id}>
      <legend className="sr-only" id={`${id}-label`}>{normalizeDisplayAcronyms(field.label)}</legend>
      {orderedOptions(field).map((option) => {
        const checked = selectedValues.includes(option.value);
        return (
          <label className="flex min-h-10 cursor-pointer items-center gap-3 rounded-component border border-[#c2d0df] bg-white px-3 py-2 text-sm text-text-primary shadow-sm transition hover:border-primary-blue hover:bg-blue-50 has-[:focus-visible]:border-focus has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-focus has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60" key={option.value}>
            <input
              checked={checked}
              className="h-4 w-4 rounded border-border text-primary-blue focus:ring-focus"
              disabled={readOnly}
              onChange={() => onChange(checked ? selectedValues.filter((item) => item !== option.value) : [...selectedValues, option.value])}
              type="checkbox"
            />
            <span>{normalizeDisplayAcronyms(option.label)}</span>
          </label>
        );
      })}
    </fieldset>
  );
}

function renderRadioGroup(
  field: OetsField,
  id: string,
  value: OetsFieldValue | undefined,
  readOnly: boolean,
  onChange: (value: OetsFieldValue) => void,
  describedBy?: string
) {
  if (!field.options?.length) {
    return <UnsupportedField field={field} reason="Options are required." />;
  }

  return (
    <span className="flex flex-wrap gap-2 rounded-component border border-[#c2d0df] bg-[#f3f7fc] p-3">
      {orderedOptions(field).map((option) => {
        const checked = value === option.value;
        return (
          <label
            className={`inline-flex min-h-9 items-center gap-3 rounded-component border px-3 text-sm transition ${
              checked
                ? "border-primary-blue bg-blue-50 font-semibold text-primary-navy shadow-sm"
                : readOnly
                  ? "cursor-not-allowed border-transparent text-text-muted opacity-55"
                  : "cursor-pointer border-transparent font-normal text-text-primary hover:border-[#c2d0df] hover:bg-white"
            }`}
            key={option.value}
          >
            <input
              aria-describedby={describedBy}
              checked={checked}
              className="h-4 w-4 accent-primary-blue"
              disabled={readOnly}
              name={id}
              onChange={() => onChange(option.value)}
              type="radio"
            />
            {normalizeDisplayAcronyms(option.label)}
          </label>
        );
      })}
    </span>
  );
}

function UnsupportedField({
  field,
  reason
}: {
  field: OetsField;
  reason: string;
}) {
  return (
    <div className="rounded-component border border-state-warning bg-elevated p-3 text-sm">
      <p className="font-semibold text-text-primary">{normalizeDisplayAcronyms(field.label)}</p>
      <p className="mt-1 text-text-muted">
        {reason} Field code: {field.field_code}.
      </p>
    </div>
  );
}

function orderedOptions(field: OetsField) {
  return [...(field.options ?? [])].sort(
    (left, right) => (left.sequence ?? 0) - (right.sequence ?? 0)
  );
}

const inputClassName =
  "min-h-11 w-full rounded-component border-2 border-[#8faac8] bg-[#fbfdff] px-3 py-2 text-sm text-text-primary shadow-sm outline-none transition hover:border-primary-blue hover:bg-white focus:border-focus focus:bg-white focus:ring-2 focus:ring-focus disabled:cursor-not-allowed disabled:border-[#b8c8da] disabled:bg-elevated disabled:text-text-muted disabled:shadow-none";

function createInitialRepeatableCounters(
  definition: OetsDefinition
): RepeatableSectionCounters {
  return Object.fromEntries(
    orderedSections(definition)
      .filter((section) => section.repeatable)
      .map((section) => [section.section_code, 1])
  );
}

function projectGovernedAttestationValue(
  field: OetsField,
  fallback: OetsFieldValue | undefined,
  attestations: readonly EvidenceAttestation[],
  sectionInstanceIndex: number | null
) {
  if (isF048CredentialOfficerNumberProjection(field)) {
    return projectF048CredentialOfficerNumber(attestations,sectionInstanceIndex);
  }
  const projection = readGovernedAttestationProjection(field);
  if (!projection) return fallback;
  const current = attestations.find(
    (item) => item.status === "CURRENT" &&
      item.signature_field_id === projection.sourceSignatureFieldId &&
      item.section_instance_index === sectionInstanceIndex
  );
  if (!current) return null;
  return projection.value === "SUBJECT_NAME"
    ? current.subject_name_snapshot
    : current.signed_at.slice(0, 10);
}

function isGovernedAttestationProjection(field: OetsField) {
  return isF048CredentialOfficerNumberProjection(field)||readGovernedAttestationProjection(field) !== null;
}


function readGovernedAttestationProjection(field: OetsField): {
  sourceSignatureFieldId: string;
  value: "SUBJECT_NAME" | "SIGNED_AT_DATE";
} | null {
  const projection = field.metadata?.governed_attestation_projection;
  if (!projection || typeof projection !== "object" || Array.isArray(projection)) return null;
  const sourceSignatureFieldId = (projection as Record<string, unknown>).source_signature_field_id;
  const value = (projection as Record<string, unknown>).value;
  if (typeof sourceSignatureFieldId !== "string" || (value !== "SUBJECT_NAME" && value !== "SIGNED_AT_DATE")) return null;
  return { sourceSignatureFieldId, value };
}

function renderableFields(fields: OetsField[]) {
  return [...fields]
    .filter(
      (field) =>
        field.visible ||
        (field.field_type === "SIGNATURE" &&
          Boolean(field.metadata?.governed_attestation))
    )
    .sort((left, right) => left.sequence - right.sequence);
}

interface RenderedSectionProjection {
  domId: string;
  section: Section;
  sourceSection: Section;
  sectionState: EditableOetsState[string] | undefined;
  sectionValues: Record<string, OetsFieldValue>;
}

function createRenderedSectionProjection(
  definition: OetsDefinition,
  state: EditableOetsState,
  fieldVisibilityPolicy: OetsFieldVisibilityPolicy | undefined
): RenderedSectionProjection[] {
  const projections = orderedSections(definition).flatMap((section) => {
    const sectionState = state[section.section_code];
    const sectionValues =
      !Array.isArray(sectionState) && sectionState ? sectionState : {};
    const visibleFields = visibleSectionFields(
      section,
      sectionValues,
      fieldVisibilityPolicy
    );

    if (!section.repeatable && visibleFields.length === 0) return [];

    return [{
      domId: `oets-section-${section.section_id}`,
      section: { ...section, fields: visibleFields },
      sourceSection: section,
      sectionState,
      sectionValues
    }];
  });
  const ids = projections.map((item) => item.domId);

  if (new Set(ids).size !== ids.length) {
    throw new Error("OETS_SECTION_DOM_ID_DUPLICATE");
  }

  return projections;
}

function toProgressSectionInput(
  projection: RenderedSectionProjection
): OetsProgressSectionInput {
  const { domId, section, sectionState, sectionValues } = projection;

  return {
    section,
    domId,
    instances: section.repeatable
      ? (Array.isArray(sectionState) ? sectionState : []).map((instance, index) => ({
          instanceKey: instance.key,
          instanceIndex: index,
          values: instance.values
        }))
      : [{ instanceKey: "single", instanceIndex: null, values: sectionValues }]
  };
}

function createInitialExplicitValueKeys(
  definition: OetsDefinition,
  initialPayload: Pick<OetsEvidencePayload, "sections"> | undefined
) {
  const keys = new Set<string>();
  if (!initialPayload) return keys;

  for (const section of orderedSections(definition)) {
    const payloadSection = initialPayload.sections[section.section_code];
    if (section.repeatable) {
      if (!Array.isArray(payloadSection)) continue;
      payloadSection.forEach((values, index) => {
        for (const field of orderedFields(section.fields)) {
          if (Object.prototype.hasOwnProperty.call(values, field.field_code)) {
            keys.add(progressValueKey(
              section.section_code,
              `${section.section_code}-${index + 1}`,
              field.field_code
            ));
          }
        }
      });
      continue;
    }

    if (!payloadSection || Array.isArray(payloadSection)) continue;
    for (const field of orderedFields(section.fields)) {
      if (Object.prototype.hasOwnProperty.call(payloadSection, field.field_code)) {
        keys.add(progressValueKey(section.section_code, "single", field.field_code));
      }
    }
  }

  return keys;
}

function addExplicitValueKey(current: Set<string>, key: string) {
  if (current.has(key)) return current;
  const next = new Set(current);
  next.add(key);
  return next;
}
