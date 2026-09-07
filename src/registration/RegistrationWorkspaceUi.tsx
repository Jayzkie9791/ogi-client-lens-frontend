import { ReactNode } from "react";

import { Surface } from "../ui/components/Surface";
import { displayRegistrationCode } from "./registrationPresentation";

export function RegistrationWorkspaceFrame({
  directory,
  workspace
}: {
  directory: ReactNode;
  workspace: ReactNode;
}) {
  return (
    <div
      className="grid items-start gap-5 rounded-panel border border-border bg-elevated p-3 sm:p-4 lg:grid-cols-[minmax(17rem,0.8fr)_1px_minmax(0,1.2fr)]"
      data-testid="registration-workspace-frame"
    >
      {directory}
      <div
        aria-hidden="true"
        className="hidden h-full min-h-full bg-border lg:block lg:self-stretch"
        data-testid="registration-workspace-divider"
      />
      <div className="min-w-0" data-testid="registration-detail-pane">
        {workspace}
      </div>
    </div>
  );
}

export function RegistrationDirectoryPane({
  children,
  description,
  emptyState,
  title
}: {
  children?: ReactNode;
  description: string;
  emptyState?: ReactNode;
  title: string;
}) {
  const headingId = `registration-directory-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

  return (
    <aside className="min-w-0 lg:sticky lg:top-4" aria-labelledby={headingId}>
      <Surface className="shadow-sm">
        <div className="-mx-5 -mt-5 mb-4 rounded-t-panel border-b border-border bg-elevated px-5 py-4">
          <h2 className="text-base font-semibold text-primary-navy" id={headingId}>
            {title}
          </h2>
          <p className="mt-1 text-sm leading-5 text-text-muted">{description}</p>
        </div>
        {children ? (
          <div
            aria-label={`${title} directory`}
            className="overscroll-contain lg:max-h-[70dvh] lg:min-h-48 lg:overflow-y-auto lg:pr-1"
            data-testid="registration-directory-scroll-region"
            role="region"
            tabIndex={0}
          >
            {children}
          </div>
        ) : (
          emptyState
        )}
      </Surface>
    </aside>
  );
}

export function RegistrationDirectoryItem({
  children,
  isSelected,
  onSelect
}: {
  children: ReactNode;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      aria-pressed={isSelected}
      className={[
        "min-h-11 w-full rounded-component border py-3 pl-4 pr-3 text-left text-primary-navy outline-none transition",
        "focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
        isSelected
          ? "border-primary-blue border-l-4 bg-elevated shadow-sm"
          : "border-border border-l-4 border-l-transparent bg-surface hover:border-l-primary-blue hover:bg-elevated"
      ].join(" ")}
      onClick={onSelect}
      type="button"
    >
      {children}
    </button>
  );
}

export function RegistrationEntityHeader({
  heading,
  identity,
  secondary,
  status
}: {
  heading?: string;
  identity: string;
  secondary?: ReactNode;
  status?: string;
}) {
  return (
    <div
      className="flex flex-col gap-3 rounded-component border border-border bg-elevated px-4 py-4 sm:flex-row sm:items-start sm:justify-between"
      data-registration-section="identity"
    >
      <div className="min-w-0">
        {heading ? (
          <>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-primary-blue">{heading}</h2>
            <h3 className="mt-1 break-words text-lg font-semibold text-primary-navy">{identity}</h3>
          </>
        ) : (
          <h2 className="break-words text-lg font-semibold text-primary-navy">{identity}</h2>
        )}
        {secondary ? <div className="mt-1 break-words text-sm text-text-muted">{secondary}</div> : null}
      </div>
      {status ? <RegistrationStatusBadge value={status} /> : null}
    </div>
  );
}

export function RegistrationStatusBadge({ value }: { value: string }) {
  const tone = registrationStatusTone(value);

  return (
    <span
      className={[
        "inline-flex w-fit shrink-0 cursor-default rounded-full border px-2.5 py-1 text-xs font-semibold",
        registrationStatusToneClassNames[tone]
      ].join(" ")}
      data-status-tone={tone}
    >
      {displayRegistrationCode(value)}
    </span>
  );
}

export function RegistrationMetadataItem({
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
      <dt className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</dt>
      <dd className={`mt-1.5 break-words leading-5 ${subtle ? "text-xs text-slate-500" : "text-sm font-medium text-primary-navy"}`}>
        {value}
      </dd>
    </div>
  );
}

export function RegistrationMetadataGroup({
  children,
  description,
  title = "Administrative details"
}: {
  children: ReactNode;
  description?: string;
  title?: string;
}) {
  return (
    <section
      className="rounded-component border border-border bg-canvas p-4"
      data-registration-section="administrative"
    >
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-primary-navy">{title}</h3>
        {description ? <p className="mt-1 text-xs leading-5 text-text-muted">{description}</p> : null}
      </div>
      <dl className="grid gap-x-5 gap-y-4 text-sm sm:grid-cols-2">{children}</dl>
    </section>
  );
}

export function RegistrationEditableSection({
  children,
  description,
  title
}: {
  children: ReactNode;
  description?: string;
  title: string;
}) {
  return (
    <section
      className="overflow-hidden rounded-component border border-border bg-surface shadow-sm"
      data-registration-section="operational"
    >
      <div className="border-b border-l-4 border-b-border border-l-accent-red bg-elevated px-4 py-3">
        <h3 className="text-base font-semibold text-primary-navy">{title}</h3>
        {description ? <p className="mt-1 text-sm text-text-muted">{description}</p> : null}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

export function RegistrationWorkspaceSection({
  children,
  description,
  headingId,
  title
}: {
  children: ReactNode;
  description?: string;
  headingId?: string;
  title: string;
}) {
  return (
    <Surface data-registration-section="operational">
      <div className="space-y-4">
        <div className="-mx-5 -mt-5 border-b border-l-4 border-b-border border-l-accent-red bg-elevated px-5 py-3">
          <h3 className="text-base font-semibold text-primary-navy" id={headingId}>{title}</h3>
          {description ? <p className="mt-1 text-sm text-text-muted">{description}</p> : null}
        </div>
        {children}
      </div>
    </Surface>
  );
}

type RegistrationStatusTone = "attention" | "healthy" | "neutral" | "warning";

const registrationStatusToneClassNames: Record<RegistrationStatusTone, string> = {
  attention: "border-red-200 bg-red-50 text-red-800",
  healthy: "border-emerald-200 bg-emerald-50 text-emerald-800",
  neutral: "border-slate-200 bg-slate-50 text-slate-700",
  warning: "border-amber-200 bg-amber-50 text-amber-800"
};

function registrationStatusTone(value: string): RegistrationStatusTone {
  switch (value) {
    case "ACTIVE":
      return "healthy";
    case "PENDING_APPROVAL":
    case "UNDER_MAINTENANCE":
      return "warning";
    case "SUSPENDED":
      return "attention";
    case "INACTIVE":
    case "SEASONAL":
    case "TERMINATED":
    default:
      return "neutral";
  }
}
