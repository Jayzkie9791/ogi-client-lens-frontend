import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { isApiError } from "../../api/errors";
import { useAuth } from "../../auth/useAuth";
import { Button } from "../../ui/components/Button";
import { Surface } from "../../ui/components/Surface";
import { routes } from "../routePaths";
import { OperationsChildNavigation } from "./RecordsPage";
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
        : templates,
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
          Choose an operational form or audit to open.
        </p>
      </div>

      <OperationsChildNavigation />

      {modules.length > 1 ? (
        <Surface>
          <label className="block text-sm font-semibold text-text-primary">
            Module
            <select
              className="mt-2 min-h-10 w-full rounded-component border border-border bg-surface px-3 py-2 text-sm text-text-primary outline-none focus:border-focus focus:ring-2 focus:ring-focus"
              onChange={(event) => setModuleFilter(event.target.value)}
              value={moduleFilter}
            >
              <option value="">All modules</option>
              {modules.map((module) => (
                <option key={module} value={module}>
                  {module}
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
  const description =
    template.description ??
    template.business_context?.description ??
    template.business_context?.business_process;
  const actionLabel = canSubmitEvidence ? "Open Form" : "View Form";
  const href = canSubmitEvidence
    ? routes.oetsTemplatePath(template.template_code)
    : `${routes.oetsTemplatePath(template.template_code)}?mode=readonly`;

  return (
    <Surface className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div className="min-w-0 space-y-3">
        <div>
          <h2 className="text-lg font-semibold text-text-primary">
            {template.template_name}
          </h2>
          {description ? (
            <p className="mt-1 max-w-3xl text-sm leading-6 text-text-muted">
              {description}
            </p>
          ) : null}
        </div>
        <dl className="grid gap-2 text-sm text-text-muted sm:grid-cols-2 lg:grid-cols-4">
          <MetadataItem label="Module" value={template.module} />
          <MetadataItem label="Template code" value={template.template_code} />
          <MetadataItem label="Document" value={readDocumentLabel(template)} />
          <MetadataItem label="Version" value={template.template_version} />
        </dl>
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
