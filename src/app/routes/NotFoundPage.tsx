import { Link } from "react-router-dom";

import { Button } from "../../ui/components/Button";
import { Surface } from "../../ui/components/Surface";
import { routes } from "../routePaths";

export function NotFoundPage() {
  return (
    <Surface className="max-w-2xl">
      <p className="text-xs font-semibold uppercase tracking-wide text-accent-red">
        Not found
      </p>
      <h1 className="mt-2 text-2xl font-semibold text-text-primary">
        This workspace page is not available.
      </h1>
      <p className="mt-2 text-sm leading-6 text-text-muted">
        The route does not match an implemented Client Lens workspace page.
      </p>
      <Button asChild className="mt-5">
        <Link to={routes.workbench}>Return to workbench</Link>
      </Button>
    </Surface>
  );
}
