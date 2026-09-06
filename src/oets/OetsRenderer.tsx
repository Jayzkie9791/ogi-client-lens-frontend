import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";

import { Button } from "../ui/components/Button";
import { Surface } from "../ui/components/Surface";
import {
  assembleEvidencePayload,
  createEvidenceStateFromPayload,
  createFieldValues,
  createInitialEvidenceState,
  EditableOetsState,
  orderedFields,
  orderedSections,
  RepeatableSectionInstance
} from "./evidenceState";
import { isSupportedOetsFieldType } from "./definitionGuards";
import { isOetsDeveloperDiagnosticsEnabled } from "./developerDiagnostics";
import { CreateEvidenceAttestationRequest, EvidenceAttestation } from "./attestationApi";
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
  OetsFieldValue,
  OetsTemplateRuntimeDefinition
} from "./types";
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
  submitSuccessLinkLabel?: string;
  submitSuccess?: {
    evidenceRecordId: string;
    lifecycleState: string;
    recordHref?: string;
  } | null;
  attestations?: readonly EvidenceAttestation[];
  attestationContext?: GovernedAttestationContext;
  attestationPending?: boolean;
  attestationErrorMessage?: string | null;
  onAttest?: (request: CreateEvidenceAttestationRequest) => Promise<unknown>;
  onDirtyChange?: (dirty: boolean) => void;
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
  submitSuccessLinkLabel = "Open Audit",
  submitSuccess,
  attestations = [],
  attestationContext,
  attestationPending = false,
  attestationErrorMessage,
  onAttest,
  onDirtyChange
}: OetsRendererProps) {
  const diagnosticsEnabled = isOetsDeveloperDiagnosticsEnabled();
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
  // The server payload object changes only after a confirmed save; the current assembled
  // payload is intentionally captured at that boundary as the new visual signing baseline.
  useEffect(() => {
    savedPayloadRef.current = JSON.stringify(payload.sections);
    onDirtyChange?.(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPayload]);
  const renderedSections = useMemo(
    () => createRenderedSectionProjection(definition, state, fieldVisibilityPolicy),
    [definition, fieldVisibilityPolicy, state]
  );
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

  return (
    <div className="space-y-5">
      {/* AppShell's header is document-flow rather than sticky. This OETS-local
          strip therefore uses the viewport top after the shell header scrolls away. */}
      <Surface className="sticky top-0 z-20 flex flex-col gap-3 border-l-4 border-l-accent-red bg-gradient-to-r from-blue-50/95 to-white/95 p-3 shadow-[0_2px_8px_rgba(15,45,95,0.08)] backdrop-blur-sm lg:flex-row lg:items-center lg:justify-between" data-testid="oets-action-strip">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">
              Audit Template
            </p>
            <h1 className="text-xl font-semibold text-primary-navy sm:text-2xl">
              {definition.template_metadata.template_name}
            </h1>
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
              {submitDisabledReason ?? submitHelpText}
            </div>
            <Button
              disabled={isSubmitting || Boolean(submitDisabledReason)}
              onClick={() => onSubmit(payload)}
            >
              {isSubmitting ? submittingLabel : submitLabel}
            </Button>
          </>
        ) : null}
        </div>
      </Surface>

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

      <div className="space-y-4 lg:grid lg:grid-cols-[minmax(0,1fr)_17rem] lg:items-start lg:gap-5 lg:space-y-0" data-testid="oets-workspace">
        <div className="lg:sticky lg:top-[7.5rem] lg:col-start-2 lg:row-start-1 lg:pt-4" data-testid="oets-progress-column">
          <OetsProgressNavigator model={progressModel} />
        </div>
        <div className="space-y-5 rounded-panel bg-[#EEF3F9] p-3 sm:p-4 lg:col-start-1 lg:row-start-1 lg:px-6" data-testid="oets-section-stack">
      {renderedSections.map(({ domId, section, sourceSection, sectionState, sectionValues }) => {
        if (section.repeatable) {
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
              onAdd={() => {
                const nextIndex = (repeatableCounters[section.section_code] ?? 1) + 1;

                setState((current) => {
                  const currentInstances = current[section.section_code];
                  const instances = Array.isArray(currentInstances)
                    ? currentInstances
                    : [];

                  return {
                    ...current,
                    [section.section_code]: [
                      ...instances,
                      {
                        key: `${section.section_code}-${nextIndex}`,
                        values: createFieldValues(sourceSection.fields)
                      }
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
  developerDiagnostics
}: OetsSectionCardProps) {
  return (
    <Surface className="overflow-hidden border-[#CFDCEB] bg-white p-0 shadow-[0_2px_8px_rgba(15,45,95,0.06)]">
      <SectionHeader section={section} />
      <div className="bg-white p-5">
      {developerDiagnostics ? <ValidationMessages messages={validation?.sectionMessages[section.section_code]} /> : null}
      <div className="grid gap-x-6 gap-y-6 md:grid-cols-2">
        {orderedFields(section.fields).map((field) => (
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
            field={field}
            key={field.field_id}
            onChange={(value) => onValueChange(field.field_code, value)}
            readOnly={readOnly || field.readonly}
            sectionInstanceIndex={null}
            value={values[field.field_code]}
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
  developerDiagnostics
}: RepeatableSectionProps) {
  return (
    <Surface className="overflow-hidden border-[#CFDCEB] bg-white p-0 shadow-[0_2px_8px_rgba(15,45,95,0.06)]">
      <div className="relative flex flex-col gap-3 bg-blue-50 sm:flex-row sm:items-center sm:justify-between">
        <SectionHeader section={section} />
        <div className="px-5 pb-4 sm:pb-0">
          <Button disabled={readOnly} onClick={onAdd} variant="secondary">
            Add entry
          </Button>
        </div>
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
              <Button
                disabled={readOnly || instances.length <= 1}
                onClick={() => onRemove(instance.key)}
                variant="secondary"
              >
                Remove
              </Button>
            </div>
            <div className="grid gap-x-6 gap-y-6 md:grid-cols-2">
              {orderedFields(section.fields).map((field) => (
                <OetsFieldControl
                  attestationContext={attestationContext}
                  attestationErrorMessage={attestationErrorMessage}
                  attestationPending={attestationPending}
                  attestations={attestations}
                  field={field}
                  key={field.field_id}
                  onChange={(value) =>
                    onValueChange(instance.key, field.field_code, value)
                  }
                  errors={
                    validation?.fieldMessages[
                      fieldErrorKey(section.section_code, field.field_code, index)
                    ]
                  }
                  readOnly={readOnly || field.readonly}
                  sectionInstanceIndex={index}
                  value={instance.values[field.field_code]}
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

function visibleSectionFields(
  section: Section,
  values: Record<string, OetsFieldValue>,
  fieldVisibilityPolicy: OetsFieldVisibilityPolicy | undefined
) {
  const fields = orderedFields(section.fields);

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
  return (
    <div className="relative flex-1 border-b border-blue-100 bg-blue-50 px-5 py-4 before:absolute before:inset-y-0 before:left-0 before:w-1 before:bg-accent-red">
      <p className="text-xs font-semibold uppercase tracking-wide text-primary-blue">
        Section {section.sequence}
      </p>
      <h2 className="mt-1 text-xl font-semibold text-primary-navy">{section.title}</h2>
      {section.description ? (
        <p className="mt-1 text-sm text-text-muted">{section.description}</p>
      ) : null}
    </div>
  );
}

interface OetsFieldControlProps {
  field: OetsField;
  value: OetsFieldValue | undefined;
  readOnly: boolean;
  errors?: string[];
  onChange: (value: OetsFieldValue) => void;
  attestations: readonly EvidenceAttestation[];
  attestationContext?: GovernedAttestationContext;
  attestationPending: boolean;
  attestationErrorMessage?: string | null;
  sectionInstanceIndex: number | null;
  onAttest?: (request: CreateEvidenceAttestationRequest) => Promise<unknown>;
  developerDiagnostics: boolean;
}

function OetsFieldControl({
  field,
  value,
  readOnly,
  errors,
  onChange,
  attestations,
  attestationContext,
  attestationPending,
  attestationErrorMessage,
  sectionInstanceIndex,
  onAttest,
  developerDiagnostics
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

  if (field.field_type === "BOOLEAN" || field.field_type === "CHECKBOX") {
    return (
      <div className={errors?.length ? "rounded-component border-l-2 border-state-error pl-3 text-sm" : "text-sm"}>
        <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-component border border-transparent bg-blue-50/30 px-3 py-2 text-primary-navy hover:border-blue-200 hover:bg-blue-50 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60" htmlFor={id}>
          {renderControl(field, id, value, readOnly, onChange)}
          <span className="font-semibold">
            {field.label}
            {field.required ? <span className="ml-1 text-state-error" aria-label="required">*</span> : null}
          </span>
        </label>
        {field.description ? <span className="mt-1 block text-xs text-text-muted">{field.description}</span> : null}
        {developerDiagnostics ? <ValidationMessages messages={errors} /> : errors?.length ? <span className="mt-2 block text-sm font-semibold text-state-error" role="alert">Review this field.</span> : null}
      </div>
    );
  }

  return (
    <div className={errors?.length ? "rounded-component border-l-2 border-state-error pl-3 text-sm" : "block text-sm"}>
      <label htmlFor={id}><FieldLabel field={field} /></label>
      {renderControl(field, id, value, readOnly, onChange)}
      {field.description ? (
        <span className="mt-1 block text-xs text-text-muted">
          {field.description}
        </span>
      ) : null}
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
      {field.label}
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
  onChange: (value: OetsFieldValue) => void
) {
  const stringValue =
    typeof value === "string" || typeof value === "number" ? String(value) : "";

  switch (field.field_type) {
    case "TEXTAREA":
      return (
        <textarea
          className={inputClassName}
          disabled={readOnly}
          id={id}
          onChange={(event) => onChange(event.target.value || null)}
          placeholder={field.placeholder}
          rows={3}
          value={stringValue}
        />
      );
    case "BOOLEAN":
    case "CHECKBOX":
      return (
        <input
          checked={value === true}
          className="h-5 w-5 rounded border-border text-primary-blue focus:ring-focus disabled:opacity-70"
          disabled={readOnly}
          id={id}
          onChange={(event) => onChange(event.target.checked)}
          type="checkbox"
        />
      );
    case "RADIO":
      return renderRadioGroup(field, id, value, readOnly, onChange);
    case "SELECT":
      return renderSelect(field, id, value, readOnly, onChange);
    case "MULTISELECT":
      return renderMultiSelect(field, id, value, readOnly, onChange);
    case "DATE":
      return renderInput(field, id, "date", stringValue, readOnly, onChange);
    case "DECIMAL":
    case "NUMBER":
      return renderInput(field, id, "number", stringValue, readOnly, onChange);
    case "EMAIL":
      return renderInput(field, id, "email", stringValue, readOnly, onChange);
    case "PHONE":
      return renderInput(field, id, "tel", stringValue, readOnly, onChange);
    case "TIME":
      return renderInput(field, id, "time", stringValue, readOnly, onChange);
    case "URL":
      return renderInput(field, id, "url", stringValue, readOnly, onChange);
    case "TEXT":
    default:
      return renderInput(field, id, "text", stringValue, readOnly, onChange);
  }
}

function renderInput(
  field: OetsField,
  id: string,
  type: string,
  value: string,
  readOnly: boolean,
  onChange: (value: OetsFieldValue) => void
) {
  return (
    <input
      className={inputClassName}
      disabled={readOnly}
      id={id}
      onChange={(event) => onChange(event.target.value || null)}
      placeholder={field.placeholder}
      type={type}
      value={value}
    />
  );
}

function renderSelect(
  field: OetsField,
  id: string,
  value: OetsFieldValue | undefined,
  readOnly: boolean,
  onChange: (value: OetsFieldValue) => void
) {
  if (!field.options?.length) {
    return <UnsupportedField field={field} reason="Options are required." />;
  }

  return (
    <select
      className={inputClassName}
      disabled={readOnly}
      id={id}
      onChange={(event) => onChange(event.target.value || null)}
      value={typeof value === "string" ? value : ""}
    >
      <option value="">Select...</option>
      {orderedOptions(field).map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
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
  onChange: (value: OetsFieldValue) => void
) {
  if (!field.options?.length) {
    return <UnsupportedField field={field} reason="Options are required." />;
  }

  const selectedValues = Array.isArray(value) ? value : [];

  return (
    <fieldset aria-labelledby={`${id}-label`} className="grid gap-2 rounded-component border border-border bg-blue-50/40 p-3 sm:grid-cols-2" id={id}>
      <legend className="sr-only" id={`${id}-label`}>{field.label}</legend>
      {orderedOptions(field).map((option) => {
        const checked = selectedValues.includes(option.value);
        return (
          <label className="flex min-h-10 cursor-pointer items-center gap-3 rounded-component border border-transparent bg-white px-3 py-2 text-sm text-text-primary transition hover:border-blue-200 hover:bg-blue-50 has-[:focus-visible]:border-focus has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-focus has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60" key={option.value}>
            <input
              checked={checked}
              className="h-4 w-4 rounded border-border text-primary-blue focus:ring-focus"
              disabled={readOnly}
              onChange={() => onChange(checked ? selectedValues.filter((item) => item !== option.value) : [...selectedValues, option.value])}
              type="checkbox"
            />
            <span>{option.label}</span>
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
  onChange: (value: OetsFieldValue) => void
) {
  if (!field.options?.length) {
    return <UnsupportedField field={field} reason="Options are required." />;
  }

  return (
    <span className="flex flex-wrap gap-x-6 gap-y-3 rounded-component border border-transparent bg-blue-50/30 p-3">
      {orderedOptions(field).map((option) => (
        <label
          className="inline-flex min-h-9 cursor-pointer items-center gap-3 rounded-component px-2 text-sm font-normal text-text-primary hover:bg-blue-50 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60"
          key={option.value}
        >
          <input
            checked={value === option.value}
            disabled={readOnly}
            name={id}
            onChange={() => onChange(option.value)}
            type="radio"
          />
          {option.label}
        </label>
      ))}
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
      <p className="font-semibold text-text-primary">{field.label}</p>
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
  "min-h-11 w-full rounded-component border border-blue-200 bg-blue-50/30 px-3 py-2 text-sm text-text-primary outline-none transition hover:border-primary-blue focus:border-focus focus:bg-white focus:ring-2 focus:ring-focus disabled:cursor-not-allowed disabled:border-border disabled:bg-elevated disabled:text-text-muted";

function createInitialRepeatableCounters(
  definition: OetsDefinition
): RepeatableSectionCounters {
  return Object.fromEntries(
    orderedSections(definition)
      .filter((section) => section.repeatable)
      .map((section) => [section.section_code, 1])
  );
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
