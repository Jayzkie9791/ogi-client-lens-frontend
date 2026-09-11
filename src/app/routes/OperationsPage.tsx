import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { isApiError } from "../../api/errors";
import { useAuth } from "../../auth/useAuth";
import { Button } from "../../ui/components/Button";
import { Surface } from "../../ui/components/Surface";
import { routes } from "../routePaths";
import {
  listOetsTemplateCatalog,
  OetsTemplateCatalogItem
} from "../../oets/templateCatalogApi";

const submitPermission = "submit_operational_evidence";
const emptyTemplates: OetsTemplateCatalogItem[] = [];

export function OperationsPage() {
  const auth = useAuth();
  const canSubmitEvidence = auth.canUsePermission(submitPermission);
  const [moduleFilter, setModuleFilter] = useState("");
  const catalogQuery = useQuery({
    queryKey: ["oets-template-catalog"],
    queryFn: () => listOetsTemplateCatalog(),
    retry: false
  });
  const templates = catalogQuery.data?.templates ?? emptyTemplates;
  const modules = useMemo(() => readDistinctModules(templates), [templates]);
  const visibleTemplates = useMemo(
    () =>
      moduleFilter
        ? templates.filter((template) => template.module === moduleFilter)
        : emptyTemplates,
    [moduleFilter, templates]
  );

  if (catalogQuery.isLoading) {
    return (
      <SafeState title="Loading forms and audits." role="status">
        Please wait.
      </SafeState>
    );
  }

  if (catalogQuery.isError) {
    return <CatalogErrorState error={catalogQuery.error} />;
  }

  return (
    <section aria-labelledby="forms-audits-heading" className="space-y-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-primary-blue">
          Operations
        </p>
        <h1
          className="mt-2 text-2xl font-semibold text-text-primary"
          id="forms-audits-heading"
        >
          Forms & Audits
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-text-muted">
          Choose a work area, then open the form that matches what you need to do.
        </p>
      </div>

      {modules.length > 0 ? (
        <Surface>
          <label className="block text-sm font-semibold text-text-primary">
            Module
            <select
              className="mt-2 min-h-10 w-full rounded-component border border-border bg-surface px-3 py-2 text-sm text-text-primary outline-none focus:border-focus focus:ring-2 focus:ring-focus"
              onChange={(event) => setModuleFilter(event.target.value)}
              value={moduleFilter}
            >
              <option value="">Select a module</option>
              {modules.map((module) => (
                <option key={module} value={module}>
                  {readModuleLabel(module)}
                </option>
              ))}
            </select>
          </label>
        </Surface>
      ) : null}

      {templates.length === 0 ? (
        <Surface>
          <h2 className="text-base font-semibold text-text-primary">
            No forms or audits are currently available.
          </h2>
          <p className="mt-2 text-sm leading-6 text-text-muted">
            The canonical template catalog did not return any discoverable
            forms or audits.
          </p>
        </Surface>
      ) : !moduleFilter ? (
        <Surface>
          <h2 className="text-base font-semibold text-text-primary">
            Choose a module to view available forms and audits.
          </h2>
          <p className="mt-2 text-sm leading-6 text-text-muted">
            Select an operational module above to begin.
          </p>
        </Surface>
      ) : visibleTemplates.length === 0 ? (
        <Surface>
          <h2 className="text-base font-semibold text-text-primary">
            No forms or audits are available for this module.
          </h2>
          <p className="mt-2 text-sm leading-6 text-text-muted">
            Choose another module to continue browsing.
          </p>
        </Surface>
      ) : (
        <ul className="space-y-3" aria-label="Forms and audits catalog">
          {visibleTemplates.map((template) => (
            <li key={template.template_version_id}>
              <TemplateCatalogEntry
                canSubmitEvidence={canSubmitEvidence}
                template={template}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function TemplateCatalogEntry({
  canSubmitEvidence,
  template
}: {
  canSubmitEvidence: boolean;
  template: OetsTemplateCatalogItem;
}) {
  const purpose = readPlainLanguagePurpose(template);
  const formNumber = readFormNumber(template);
  const actionLabel = canSubmitEvidence ? "Open Form" : "View Form";
  const href = canSubmitEvidence
    ? routes.oetsTemplatePath(template.template_code)
    : `${routes.oetsTemplatePath(template.template_code)}?mode=readonly`;

  return (
    <Surface className="cl-catalog-card flex flex-col gap-5 pl-6 lg:flex-row lg:items-start lg:justify-between">
      <div className="min-w-0 flex-1 space-y-4">
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-text-label">
              {readArchetypeLabel(template.template_archetype)}
            </span>
            {formNumber ? (
              <span className="cl-catalog-form-number">{formNumber}</span>
            ) : null}
          </div>
          <h2 className="cl-catalog-title text-xl font-semibold">
            {template.template_name}
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-text-muted">
            {purpose}
          </p>
        </div>
        <div className="cl-catalog-purpose px-4 py-3">
          <p className="cl-data-label">Work area</p>
          <p className="mt-1 text-sm font-semibold text-text-primary">
            {readModuleLabel(template.module)}
          </p>
        </div>
        <details className="text-xs text-text-subtle">
          <summary className="w-fit cursor-pointer font-semibold text-text-label">
            Technical details
          </summary>
          <dl className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MetadataItem label="Module code" value={template.module} />
            <MetadataItem label="Template code" value={template.template_code} />
            <MetadataItem label="Document" value={readDocumentLabel(template)} />
            <MetadataItem label="Template version" value={template.template_version} />
          </dl>
        </details>
      </div>
      <div className="flex shrink-0 lg:pt-1">
        <Button asChild>
          <Link to={href}>{actionLabel}</Link>
        </Button>
      </div>
    </Surface>
  );
}

function MetadataItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-text-muted">
        {label}
      </dt>
      <dd className="mt-1 break-words text-text-primary">{value}</dd>
    </div>
  );
}

function readDocumentLabel(template: OetsTemplateCatalogItem) {
  if (template.document_number && template.document_revision) {
    return `${template.document_number} / ${template.document_revision}`;
  }

  return template.document_number ?? template.document_revision ?? "Not specified";
}

function readDistinctModules(templates: OetsTemplateCatalogItem[]) {
  return Array.from(new Set(templates.map((template) => template.module))).sort();
}

function readModuleLabel(moduleCode: string) {
  const withoutPrefix = moduleCode
    .replace(/^OGI_APP_MODULE_\d+_/, "")
    .replace(/^MODULE_/, "Module ");

  return humanizeCode(withoutPrefix);
}

function readArchetypeLabel(archetype: string) {
  const label = humanizeCode(archetype);

  return label || "Operational form";
}

function readFormNumber(template: OetsTemplateCatalogItem) {
  if (template.document_number) {
    const documentMatch = template.document_number.match(/^OGI[ _-]?F[ _-]?(\d{3})$/i);
    return documentMatch
      ? `OGI F-${documentMatch[1]}`
      : template.document_number;
  }

  const match = template.template_code.match(/(?:^|_)F(\d{3})(?:_|$)/);
  return match ? `OGI F-${match[1]}` : null;
}

function readPlainLanguagePurpose(template: OetsTemplateCatalogItem) {
  const descriptions = [
    template.description,
    template.business_context?.description
  ];
  const plainDescription = descriptions.find(
    (description): description is string =>
      Boolean(description?.trim()) && !isTechnicalDescription(description ?? "")
  );

  if (plainDescription) {
    return plainDescription.trim();
  }

  return purposeFromTitle(template.template_name);
}

function isTechnicalDescription(description: string) {
  return /\b(?:canonical|OETS|representation|renderer|schema|semantics|template|implementation|json|immutable operational)\b/i.test(
    description
  );
}

function purposeFromTitle(title: string) {
  const normalizedTitle = title.trim();
  const lowerTitle = normalizedTitle.toLocaleLowerCase();

  if (/digital credential.*verification/i.test(normalizedTitle)) {
    return "Use this form to issue, verify, and manage the digital credential linked to a selected certification.";
  }
  if (/application$/i.test(normalizedTitle)) {
    return `Use this form to submit and review a ${lowerTitle}.`;
  }
  if (/checklist$/i.test(normalizedTitle)) {
    return `Use this checklist to complete and document the ${lowerTitle.replace(/ checklist$/, "")} process.`;
  }
  if (/report$/i.test(normalizedTitle)) {
    return `Use this form to document and review the ${lowerTitle.replace(/ report$/, "")}.`;
  }
  if (/log$/i.test(normalizedTitle)) {
    return `Use this form to record and track ${lowerTitle.replace(/ log$/, "")}.`;
  }
  if (/record$/i.test(normalizedTitle)) {
    return `Use this form to create and maintain the ${lowerTitle}.`;
  }

  return `Use this form to complete the ${normalizedTitle} process and keep its official record.`;
}

function humanizeCode(value: string) {
  return value
    .replace(/[_-]+/g, " ")
    .trim()
    .toLocaleLowerCase()
    .replace(/\b\w/g, (character) => character.toLocaleUpperCase());
}

function CatalogErrorState({ error }: { error: Error }) {
  if (isApiError(error) && error.status === 403) {
    return (
      <SafeState title="Forms and audits are not available with your current authorization.">
        Your current session cannot open the canonical template catalog.
      </SafeState>
    );
  }

  return (
    <SafeState title="Forms and audits could not be loaded.">
      The canonical template catalog returned an error.
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
