import { ReactNode } from "react";

import { WorkspaceShell } from "../ui/components/WorkspaceShell";
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
  return <WorkspaceShell
    description="Manage organizations, facilities, and personnel registered with Client Lens."
    headingId={headingId}
    navigation={<RegistrationNavigation />}
    sectionDescription={description}
    sectionTitle={title}
    title="Registration"
  >
    {children}
  </WorkspaceShell>;
}
