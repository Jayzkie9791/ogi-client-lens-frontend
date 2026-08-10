import { Link } from "react-router-dom";

import { routes } from "../routePaths";
import { Button } from "../../ui/components/Button";
import { Surface } from "../../ui/components/Surface";

export function WorkbenchPage() {
  return (
    <section aria-labelledby="workbench-heading" className="space-y-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-primary-blue">
          Client Lens
        </p>
        <h1
          id="workbench-heading"
          className="mt-2 text-2xl font-semibold text-text-primary"
        >
          Client Lens Overview
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-text-muted">
          Client Lens is ready for authenticated operational evidence and
          review workflows.
        </p>
      </div>

      <Surface>
        <h2 className="text-base font-semibold text-text-primary">
          Foundation status
        </h2>
        <p className="mt-2 text-sm leading-6 text-text-muted">
          Routing, provider composition, design tokens, responsive shell, and
          frontend test infrastructure are active for the current Client Lens
          workflow slice.
        </p>
        <div className="mt-4">
          <Button asChild variant="secondary">
            <Link to={routes.governanceQueue}>Open reviews</Link>
          </Button>
        </div>
      </Surface>
    </section>
  );
}
