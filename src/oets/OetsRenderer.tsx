import { ChangeEvent, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { Button } from "../ui/components/Button";
import { Surface } from "../ui/components/Surface";
import {
  assembleEvidencePayload,
  createEvidenceStateFromPayload,
  createFieldValues,
  createInitialEvidenceState,
  orderedFields,
  orderedSections,
  RepeatableSectionInstance
} from "./evidenceState";
import { isSupportedOetsFieldType } from "./definitionGuards";
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
  submitSuccess
}: OetsRendererProps) {
  const [state, setState] = useState(() =>
    initialPayload
      ? createEvidenceStateFromPayload(definition, initialPayload)
      : createInitialEvidenceState(definition)
  );
  const [repeatableCounters, setRepeatableCounters] =
    useState<RepeatableSectionCounters>(() => createInitialRepeatableCounters(definition));
  const payload = useMemo(
    () => assembleEvidencePayload(runtimeTemplate, definition, state),
    [definition, runtimeTemplate, state]
  );

  return (
    <div className="space-y-5">
      <Surface className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">
          Audit Template
        </p>
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-text-primary">
              {definition.template_metadata.template_name}
            </h1>
            <p className="text-sm text-text-muted">
              {runtimeTemplate.template_code} · Version{" "}
              {runtimeTemplate.template_version}
            </p>
          </div>
          {readOnly ? (
            <span className="inline-flex w-fit rounded-component border border-border px-2 py-1 text-xs font-semibold uppercase text-text-muted">
              Read only
            </span>
          ) : null}
        </div>
        {!readOnly && onSubmit ? (
          <div className="mt-4 flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-text-muted">
              {submitDisabledReason ?? submitHelpText}
            </div>
            <Button
              disabled={isSubmitting || Boolean(submitDisabledReason)}
              onClick={() => onSubmit(payload)}
            >
              {isSubmitting ? submittingLabel : submitLabel}
            </Button>
          </div>
        ) : null}
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
        {backendValidation?.formMessages.map((message) => (
          <div
            className="mt-4 rounded-component border border-state-error bg-elevated p-3 text-sm text-text-primary"
            key={message}
            role="alert"
          >
            {message}
          </div>
        ))}
      </Surface>

      {orderedSections(definition).map((section) => {
        const sectionState = state[section.section_code];
        const sectionValues = !Array.isArray(sectionState) && sectionState ? sectionState : {};
        const visibleFields = visibleSectionFields(
          section,
          sectionValues,
          fieldVisibilityPolicy
        );

        if (section.repeatable) {
          return (
            <RepeatableSection
              instances={Array.isArray(sectionState) ? sectionState : []}
              key={section.section_id}
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
                        values: createFieldValues(section.fields)
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
              section={{ ...section, fields: visibleFields }}
              validation={backendValidation ?? null}
            />
          );
        }

        if (visibleFields.length === 0) {
          return null;
        }

        return (
          <OetsSectionCard
            key={section.section_id}
            onValueChange={(fieldCode, value) => {
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
            section={{ ...section, fields: visibleFields }}
            validation={backendValidation ?? null}
            values={sectionValues}
          />
        );
      })}

      <Surface>
        <h2 className="text-base font-semibold text-text-primary">
          Current Audit Payload
        </h2>
        <pre className="mt-3 max-h-96 overflow-auto rounded-component bg-elevated p-3 text-xs text-text-primary">
          {JSON.stringify(payload, null, 2)}
        </pre>
      </Surface>
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
}

function OetsSectionCard({
  section,
  values,
  readOnly,
  validation,
  onValueChange
}: OetsSectionCardProps) {
  return (
    <Surface className="space-y-4">
      <SectionHeader section={section} />
      <ValidationMessages messages={validation?.sectionMessages[section.section_code]} />
      <div className="grid gap-4 md:grid-cols-2">
        {orderedFields(section.fields).map((field) => (
          <OetsFieldControl
            errors={
              validation?.fieldMessages[
                fieldErrorKey(section.section_code, field.field_code)
              ]
            }
            field={field}
            key={field.field_id}
            onChange={(value) => onValueChange(field.field_code, value)}
            readOnly={readOnly || field.readonly}
            value={values[field.field_code]}
          />
        ))}
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
}

function RepeatableSection({
  section,
  instances,
  readOnly,
  validation,
  onAdd,
  onRemove,
  onValueChange
}: RepeatableSectionProps) {
  return (
    <Surface className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <SectionHeader section={section} />
        <Button disabled={readOnly} onClick={onAdd} variant="secondary">
          Add entry
        </Button>
      </div>

      <div className="space-y-4">
        <ValidationMessages messages={validation?.sectionMessages[section.section_code]} />
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
            <div className="grid gap-4 md:grid-cols-2">
              {orderedFields(section.fields).map((field) => (
                <OetsFieldControl
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
                  value={instance.values[field.field_code]}
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
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">
        Section {section.sequence}
      </p>
      <h2 className="text-lg font-semibold text-text-primary">{section.title}</h2>
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
}

function OetsFieldControl({
  field,
  value,
  readOnly,
  errors,
  onChange
}: OetsFieldControlProps) {
  if (!isSupportedOetsFieldType(field.field_type)) {
    return <UnsupportedField field={field} reason="Unsupported field type" />;
  }

  if (field.field_type === "SIGNATURE") {
    return (
      <UnsupportedField
        field={field}
        reason="Signature capture is not available in Phase 2."
      />
    );
  }

  const id = `oets-${field.field_id}`;

  return (
    <label className="block text-sm" htmlFor={id}>
      <FieldLabel field={field} />
      {renderControl(field, id, value, readOnly, onChange)}
      {field.description ? (
        <span className="mt-1 block text-xs text-text-muted">
          {field.description}
        </span>
      ) : null}
      <ValidationMessages messages={errors} />
    </label>
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
    <span className="mb-1 block font-semibold text-text-primary">
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
      return renderRadioGroup(field, value, readOnly, onChange);
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
    <select
      className="min-h-24 w-full rounded-component border border-border bg-surface px-3 py-2 text-sm text-text-primary outline-none focus:border-focus focus:ring-2 focus:ring-focus disabled:bg-elevated disabled:text-text-muted"
      disabled={readOnly}
      id={id}
      multiple
      onChange={(event) => onChange(readSelectedOptions(event))}
      value={selectedValues}
    >
      {orderedOptions(field).map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

function renderRadioGroup(
  field: OetsField,
  value: OetsFieldValue | undefined,
  readOnly: boolean,
  onChange: (value: OetsFieldValue) => void
) {
  if (!field.options?.length) {
    return <UnsupportedField field={field} reason="Options are required." />;
  }

  return (
    <span className="flex flex-wrap gap-3">
      {orderedOptions(field).map((option) => (
        <label
          className="inline-flex items-center gap-2 text-sm font-normal text-text-primary"
          key={option.value}
        >
          <input
            checked={value === option.value}
            disabled={readOnly}
            name={field.field_id}
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

function readSelectedOptions(event: ChangeEvent<HTMLSelectElement>) {
  return Array.from(event.target.selectedOptions).map((option) => option.value);
}

const inputClassName =
  "min-h-10 w-full rounded-component border border-border bg-surface px-3 py-2 text-sm text-text-primary outline-none focus:border-focus focus:ring-2 focus:ring-focus disabled:bg-elevated disabled:text-text-muted";

function createInitialRepeatableCounters(
  definition: OetsDefinition
): RepeatableSectionCounters {
  return Object.fromEntries(
    orderedSections(definition)
      .filter((section) => section.repeatable)
      .map((section) => [section.section_code, 1])
  );
}
