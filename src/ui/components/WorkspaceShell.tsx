import { ReactNode } from "react";

interface WorkspaceShellProps {
  readonly children: ReactNode;
  readonly description: string;
  readonly headingId: string;
  readonly navigation: ReactNode;
  readonly sectionDescription: string;
  readonly sectionTitle: string;
  readonly title: string;
}

export function WorkspaceShell({
  children,
  description,
  headingId,
  navigation,
  sectionDescription,
  sectionTitle,
  title
}: WorkspaceShellProps) {
  return (
    <section aria-labelledby={`${headingId}-workspace`} className="cl-workspace-page">
      <header className="cl-workspace-header">
        <div className="cl-workspace-header-copy">
          <h1 className="text-2xl font-semibold text-primary-navy" id={`${headingId}-workspace`}>
            {title}
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-text-muted">{description}</p>
        </div>
        <div className="cl-workspace-navigation">{navigation}</div>
      </header>

      <section aria-labelledby={headingId} className="cl-workspace-content">
        <div className="cl-workspace-content-heading">
          <h2 className="text-xl font-semibold text-primary-navy" id={headingId}>
            {sectionTitle}
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-text-muted">{sectionDescription}</p>
        </div>
        {children}
      </section>
    </section>
  );
}
