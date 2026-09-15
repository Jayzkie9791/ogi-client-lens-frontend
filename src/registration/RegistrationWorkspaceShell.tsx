import { ReactNode } from "react";

import { WorkspaceShell } from "../ui/components/WorkspaceShell";
import { RegistrationNavigation } from "./RegistrationNavigation";

interface RegistrationWorkspaceShellProps {
  readonly children: ReactNode;
  readonly description: string;
  readonly headerActions?: ReactNode;
  readonly headingId: string;
  readonly title: string;
}

export function RegistrationWorkspaceShell({
  children,
  description,
  headerActions,
  headingId,
  title
}: RegistrationWorkspaceShellProps) {
  return <WorkspaceShell
    description={description}
    headerActions={headerActions}
    headingId={headingId}
    navigation={<RegistrationNavigation />}
    sectionDescription={description}
    sectionTitle={title}
    showSectionHeader={false}
    title="Registration"
  >
    {children}
  </WorkspaceShell>;
}
