import { Surface } from "../../ui/components/Surface";

export function WorkbenchPage() {
  return (
    <section aria-labelledby="workbench-heading" className="space-y-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-primary-blue">
          Phase 0 foundation
        </p>
        <h1
          id="workbench-heading"
          className="mt-2 text-2xl font-semibold text-text-primary"
        >
          Operational Governance Workbench
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-text-muted">
          Client Lens is ready for the authenticated Operational Evidence
          vertical slice. No backend-dependent feature behavior is active in
          this foundation.
        </p>
      </div>

      <Surface>
        <h2 className="text-base font-semibold text-text-primary">
          Foundation status
        </h2>
        <p className="mt-2 text-sm leading-6 text-text-muted">
          Routing, provider composition, design tokens, responsive shell, and
          frontend test infrastructure are established for later phases.
        </p>
      </Surface>
    </section>
  );
}
