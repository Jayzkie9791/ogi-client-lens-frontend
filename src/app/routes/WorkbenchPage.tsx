import { Link } from "react-router-dom";

import { routes } from "../routePaths";
import { Button } from "../../ui/components/Button";
import { Surface } from "../../ui/components/Surface";

export function WorkbenchPage() {
  return (
    <section aria-labelledby="workbench-heading" className="space-y-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-primary-blue">
          Audit Review
        </p>
        <h1
          id="workbench-heading"
          className="mt-2 text-2xl font-semibold text-text-primary"
        >
          Audit Review Workbench
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-text-muted">
          Client Lens is ready for authenticated audit submission and review
          assignment workflows.
        </p>
      </div>

      <Surface>
        <h2 className="text-base font-semibold text-text-primary">
          Foundation status
        </h2>
        <p className="mt-2 text-sm leading-6 text-text-muted">
          Routing, provider composition, design tokens, responsive shell, and
          frontend test infrastructure are active for the audit review slice.
        </p>
        <div className="mt-4">
          <Button asChild variant="secondary">
            <Link to={routes.governanceQueue}>Open review queue</Link>
          </Button>
        </div>
      </Surface>
    </section>
  );
}
