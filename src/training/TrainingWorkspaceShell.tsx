import { ReactNode } from "react";
import { NavLink } from "react-router-dom";

import { routes } from "../app/routePaths";
import { useAuth } from "../auth/useAuth";
import { WorkspaceShell } from "../ui/components/WorkspaceShell";

export function TrainingWorkspaceShell({ children, description, headingId, title }: {
  readonly children: ReactNode;
  readonly description: string;
  readonly headingId: string;
  readonly title: string;
}) {
  const auth = useAuth();
  const items = [
    { label: "Trainees", permission: "view_training", to: routes.trainingTrainees },
    { label: "Training Sessions", permission: "view_training", to: routes.trainingSessions },
    { label: "Register Training", permission: "create_training_enrollment", to: routes.trainingRegister },
    { label: "Trainer Evaluations", permission: "record_training_assessment", to: routes.trainerCommercialEvaluations }
  ];

  const navigation = <nav aria-label="Training workspaces"><ul className="flex flex-wrap gap-2">
    {items.filter((item) => auth.canUsePermission(item.permission)).map((item) => <li key={item.to}><NavLink className={({ isActive }) => ["cl-workspace-navigation-link", isActive ? "cl-workspace-navigation-link-active" : ""].filter(Boolean).join(" ")} end to={item.to}>{item.label}</NavLink></li>)}
  </ul></nav>;

  return <WorkspaceShell
    description="Manage Trainees, Training Sessions, governed registration, and Trainer evaluations."
    headingId={headingId}
    navigation={navigation}
    sectionDescription={description}
    sectionTitle={title}
    title="Training"
  >
    {children}
  </WorkspaceShell>;
}
