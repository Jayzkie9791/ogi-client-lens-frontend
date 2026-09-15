import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { routes } from "../app/routePaths";
import { useAuth } from "../auth/useAuth";
import { Button } from "../ui/components/Button";
import { Surface } from "../ui/components/Surface";
import { ClientPersonnelRegistrationWizard } from "./ClientPersonnelRegistrationWizard";
import { OgiPersonnelCreatePanel } from "./OgiPersonnelCreatePanel";
import { getCurrentPersonnelRegistrationIntent } from "./personnelRegistrationJourneyApi";
import { listRegistrationClients } from "./registrationClientApi";
import { RegistrationWorkspaceShell } from "./RegistrationWorkspaceShell";

type RegistrationMode = "CLIENT" | "OGI" | null;

export function PersonnelRegistrationPage() {
  const auth = useAuth();
  const queryClient = useQueryClient();
  const canCreate = auth.canUsePermission("create_staff_member");
  const canCreateOgi = auth.canUsePermission("manage_personnel_operational_authorization") && auth.session?.clientId === null;
  const canViewClients = auth.canUsePermission("view_client");
  const [mode, setMode] = useState<RegistrationMode>(null);
  const [message, setMessage] = useState<string | null>(null);
  const clientsQuery = useQuery({ queryKey: ["registration-clients"], queryFn: listRegistrationClients, enabled: canViewClients, retry: false });
  const journeyQuery = useQuery({ queryKey: ["personnel-registration-intent", "current"], queryFn: getCurrentPersonnelRegistrationIntent, enabled: canCreate, retry: false });
  const clients = useMemo(() => clientsQuery.data?.clients ?? [], [clientsQuery.data]);

  if (!canCreate && !canCreateOgi) {
    return <Surface><h1 className="text-lg font-semibold text-primary-navy">You are not authorized to register Personnel.</h1><p className="mt-2 text-sm text-text-muted">Your current session does not include Personnel registration authority.</p></Surface>;
  }

  const finish = (personnelId: string, text: string) => {
    setMode(null);
    setMessage(text);
    void queryClient.invalidateQueries({ queryKey: ["registration-personnel"] });
    void queryClient.invalidateQueries({ queryKey: ["personnel-registration-intent"] });
    queryClient.setQueryData(["latest-registered-personnel"], personnelId);
  };

  return <RegistrationWorkspaceShell
    description="Create Personnel records through the authorized registration workflow."
    headerActions={<>{canCreate ? <Button aria-expanded={mode === "CLIENT"} onClick={() => { setMessage(null); setMode("CLIENT"); }} type="button">{journeyQuery.data?.intent ? "Continue Registration" : "Register Personnel"}</Button> : null}{canCreateOgi ? <Button aria-expanded={mode === "OGI"} onClick={() => { setMessage(null); setMode("OGI"); }} type="button" variant="secondary">Register OGI Personnel</Button> : null}</>}
    headingId="registration-personnel-heading"
    title="Register Personnel"
  >
    {message ? <Surface role="status"><p className="font-semibold text-text-primary">{message}</p><Link className="mt-3 inline-flex font-semibold text-primary-blue underline" to={routes.personnelMasterlist}>Open Personnel Masterlist</Link></Surface> : null}
    {!mode ? <Surface><h2 className="text-lg font-semibold text-primary-navy">Choose a registration action</h2><p className="mt-2 text-sm leading-6 text-text-muted">Registration creates a Personnel record. Existing Personnel records are reviewed and maintained in the Workforce masterlist.</p></Surface> : null}
    {mode === "CLIENT" ? <ClientPersonnelRegistrationWizard clients={clients} initialClientId={auth.session?.clientId ?? clients[0]?.id ?? ""} onCancel={() => setMode(null)} onComplete={(personnel) => finish(personnel.id, "Personnel registration completed successfully.")} /> : null}
    {mode === "OGI" ? <OgiPersonnelCreatePanel onCancel={() => setMode(null)} onCreated={(personnel) => finish(personnel.id, "OGI Personnel registration completed successfully.")} /> : null}
  </RegistrationWorkspaceShell>;
}
