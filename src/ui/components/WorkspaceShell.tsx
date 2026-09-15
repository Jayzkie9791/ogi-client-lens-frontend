import { ReactNode } from "react";

interface WorkspaceShellProps {
  readonly children: ReactNode;
  readonly description: string;
  readonly headerActions?: ReactNode;
  readonly headingId: string;
  readonly navigation: ReactNode;
  readonly sectionDescription: string;
  readonly sectionTitle: string;
  readonly showSectionHeader?: boolean;
  readonly title: string;
}

export function WorkspaceShell({
  children,
  description,
  headerActions,
  headingId,
  navigation,
  sectionDescription,
  sectionTitle,
  showSectionHeader = true,
  title
}: WorkspaceShellProps) {
  return (
    <section aria-labelledby={`${headingId}-workspace`} className="cl-workspace-page">
      <header className="cl-workspace-header">
        <div className="cl-workspace-header-copy flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold text-primary-navy" id={`${headingId}-workspace`}>
              {title}
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-text-muted">{description}</p>
          </div>
          {headerActions ? <div className="flex shrink-0 flex-wrap gap-2">{headerActions}</div> : null}
        </div>
        {navigation ? <div className="cl-workspace-navigation">{navigation}</div> : null}
      </header>

      <section aria-labelledby={showSectionHeader ? headingId : `${headingId}-workspace`} className="cl-workspace-content">
        {showSectionHeader ? <div className="cl-workspace-content-heading">
          <h2 className="text-xl font-semibold text-primary-navy" id={headingId}>
            {sectionTitle}
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-text-muted">{sectionDescription}</p>
        </div> : null}
        {children}
      </section>
    </section>
  );
}
