import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useParams, useSearchParams } from "react-router-dom";

import { Surface } from "../ui/components/Surface";
import { narrowOetsDefinition } from "./definitionGuards";
import { OetsRenderer } from "./OetsRenderer";
import { getCurrentRuntimeTemplate } from "./runtimeTemplateApi";

export function RuntimeTemplatePage() {
  const { templateCode } = useParams();
  const [searchParams] = useSearchParams();
  const readOnly = searchParams.get("mode") === "readonly";

  const query = useQuery({
    enabled: Boolean(templateCode),
    queryKey: ["oets-runtime-template", templateCode],
    queryFn: () => getCurrentRuntimeTemplate(templateCode ?? "")
  });
  const narrowing = useMemo(
    () =>
      query.data ? narrowOetsDefinition(query.data.definition_jsonb) : undefined,
    [query.data]
  );

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

  if (!query.data || !narrowing?.definition) {
    return (
      <SafeState title="Template definition is not renderable.">
        {(narrowing?.errors ?? ["definition_jsonb was not returned."]).join(" ")}
      </SafeState>
    );
  }

  return (
    <div className="space-y-4">
      {narrowing.warnings.length > 0 ? (
        <Surface className="border-state-warning">
          <h2 className="text-base font-semibold text-text-primary">
            Unsupported renderer metadata
          </h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-text-muted">
            {narrowing.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </Surface>
      ) : null}
      <OetsRenderer
        definition={narrowing.definition}
        readOnly={readOnly}
        runtimeTemplate={query.data}
      />
    </div>
  );
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
