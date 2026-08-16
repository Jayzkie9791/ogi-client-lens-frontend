import { ReactNode } from "react";

import { RegistrationNavigation } from "./RegistrationNavigation";

interface RegistrationWorkspaceShellProps {
  readonly children: ReactNode;
  readonly description: string;
  readonly headingId: string;
  readonly title: string;
}

export function RegistrationWorkspaceShell({
  children,
  description,
  headingId,
  title
}: RegistrationWorkspaceShellProps) {
  return (
    <section aria-labelledby="registration-workspace-heading" className="space-y-5">
      <div className="space-y-4 border-b border-border pb-4">
        <div>
          <h1
            className="text-2xl font-semibold text-text-primary"
            id="registration-workspace-heading"
          >
            Registration
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-text-muted">
            Manage Client, Facility, and Personnel registration records through the authorized backend registration contracts.
          </p>
        </div>

        <RegistrationNavigation />
      </div>

      <section aria-labelledby={headingId} className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold text-text-primary" id={headingId}>
            {title}
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-text-muted">
            {description}
          </p>
        </div>

        {children}
      </section>
    </section>
  );
}
