import { FormEvent, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { isApiError } from "../../api/errors";
import { useAuth } from "../../auth/useAuth";
import { ClientPocInvitation, issueClientPocInvitation, listClientPocInvitations, revokeClientPocInvitation } from "../../admin/clientPocInvitationApi";
import { listRegistrationClients } from "../../registration/registrationClientApi";
import { listRegistrationFacilities, RegistrationFacility } from "../../registration/registrationFacilityApi";
import { Button } from "../../ui/components/Button";
import { Surface } from "../../ui/components/Surface";
import { routes } from "../routePaths";

type ScopeMode = "EXPLICIT" | "CLIENT_WIDE";
const permission = "create_user";
const inputClass = "mt-1 block min-h-10 w-full rounded-component border border-border bg-surface px-3 py-2 text-sm text-text-primary outline-none focus:border-primary-blue focus:ring-2 focus:ring-focus";

export function ClientPocProvisioningPage() {
  const auth = useAuth(), queryClient = useQueryClient();
  const allowed = auth.canUsePermission(permission) && !auth.session?.clientId;
  const [clientId, setClientId] = useState(""), [fullName, setFullName] = useState(""), [email, setEmail] = useState("");
  const [scopeMode, setScopeMode] = useState<ScopeMode>("EXPLICIT"), [facilityIds, setFacilityIds] = useState<string[]>([]);
  const [activationLink, setActivationLink] = useState<string | null>(null), [notice, setNotice] = useState<string | null>(null);
  const clientsQuery = useQuery({ queryKey: ["registration-clients"], queryFn: listRegistrationClients, enabled: allowed, retry: false });
  const clients = useMemo(() => (clientsQuery.data?.clients ?? []).filter(item => item.status === "ACTIVE"), [clientsQuery.data]);
  useEffect(() => { if (!clientId && clients[0]) setClientId(clients[0].id); }, [clientId, clients]);
  const facilitiesQuery = useQuery({ queryKey: ["registration-facilities", clientId], queryFn: () => listRegistrationFacilities({ clientId }), enabled: allowed && scopeMode === "EXPLICIT" && Boolean(clientId), retry: false });
  const facilities = useMemo(() => (facilitiesQuery.data?.facilities ?? []).filter(item => item.operational_status === "ACTIVE"), [facilitiesQuery.data]);
  const invitationsQuery = useQuery({ queryKey: ["client-poc-invitations"], queryFn: listClientPocInvitations, enabled: allowed, retry: false });
  const issue = useMutation({ mutationFn: () => issueClientPocInvitation({ client_id: clientId, full_name: fullName.trim(), email: email.trim(), facility_scope: scopeMode === "CLIENT_WIDE" ? { mode: "CLIENT_WIDE" } : { mode: "EXPLICIT", facility_ids: facilityIds } }, crypto.randomUUID()), onSuccess: result => {
    void queryClient.invalidateQueries({ queryKey: ["client-poc-invitations"] });
    if (result.activation_token) { setActivationLink(`${window.location.origin}${routes.activatePersonnelAccount}?client_poc_token=${encodeURIComponent(result.activation_token)}`); setNotice("Invitation created. Copy this one-time registration link before leaving this page."); }
    else { setActivationLink(null); setNotice("This invitation already exists, but its one-time link is no longer available. Issue a replacement if another copy is required."); }
  }});
  const revoke = useMutation({ mutationFn: revokeClientPocInvitation, onSuccess: () => { setActivationLink(null); setNotice("Invitation revoked."); void queryClient.invalidateQueries({ queryKey: ["client-poc-invitations"] }); } });

  if (!auth.canUsePermission(permission)) return <SafeState title="You are not authorized to invite Client POC accounts.">Your current session does not include Client POC invitation authority.</SafeState>;
  if (auth.session?.clientId) return <SafeState title="You are not authorized to invite Client POC accounts.">Client-bound sessions cannot use this OGI invitation workflow.</SafeState>;
  function submit(event: FormEvent) { event.preventDefault(); setNotice(null); setActivationLink(null); issue.mutate(); }
  function toggleFacility(id: string) { setFacilityIds(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id]); }
  async function copyLink() { if (!activationLink) return; try { await navigator.clipboard.writeText(activationLink); setNotice("Registration link copied."); } catch { setNotice("Clipboard access failed. Select and copy the link manually."); } }

  return <section aria-labelledby="client-poc-invitation-heading" className="space-y-4">
    <div><p className="text-xs font-semibold uppercase tracking-wide text-primary-blue">Administration</p><h1 className="mt-2 text-2xl font-semibold text-text-primary" id="client-poc-invitation-heading">Invite Client POC</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-text-muted">Create a one-time registration link. The invited Client POC confirms their business email and chooses their own password; no account is created until activation.</p></div>
    <Button asChild variant="secondary"><Link to={routes.administration}>Back to Administration</Link></Button>
    <Surface><form aria-label="Invite Client POC" className="space-y-5" onSubmit={submit}>
      <div className="grid gap-4 lg:grid-cols-2">
        <label className="block text-sm font-semibold text-text-primary">Client<select className={inputClass} disabled={clientsQuery.isLoading || issue.isPending} value={clientId} onChange={event => { setClientId(event.currentTarget.value); setFacilityIds([]); }} required><option value="">Select a Client</option>{clients.map(client => <option key={client.id} value={client.id}>{client.organization_name}</option>)}</select></label>
        <FormInput label="Full name" value={fullName} onChange={setFullName} disabled={issue.isPending} />
        <FormInput label="Business email" value={email} onChange={setEmail} disabled={issue.isPending} type="email" />
        <div className="rounded-component border border-blue-100 bg-blue-50 p-3 text-sm"><p><strong>Server-assigned role:</strong> Client Administrator</p><p className="mt-1 text-text-muted">The recipient creates the password during activation.</p></div>
      </div>
      <fieldset className="space-y-3"><legend className="text-sm font-semibold text-text-primary">Facility scope</legend><div className="flex flex-col gap-3 sm:flex-row"><ScopeOption label="Specific Facilities" checked={scopeMode === "EXPLICIT"} disabled={issue.isPending} onChange={() => { setScopeMode("EXPLICIT"); setFacilityIds([]); }} /><ScopeOption label="Client-wide Access" checked={scopeMode === "CLIENT_WIDE"} disabled={issue.isPending} onChange={() => { setScopeMode("CLIENT_WIDE"); setFacilityIds([]); }} /></div></fieldset>
      {scopeMode === "EXPLICIT" ? <FacilitySelection facilities={facilities} selected={facilityIds} loading={facilitiesQuery.isLoading} disabled={issue.isPending} onToggle={toggleFacility} /> : <p className="rounded-component border border-border bg-elevated p-3 text-sm text-text-muted">The activated account will have Client-wide authority without per-Facility access rows.</p>}
      <Button type="submit" disabled={issue.isPending || !clientId || !fullName.trim() || !email.trim() || (scopeMode === "EXPLICIT" && facilityIds.length === 0)}>{issue.isPending ? "Creating invitation..." : "Generate invitation link"}</Button>
    </form>
    {notice ? <p className="mt-4 text-sm font-semibold text-text-primary" role="status">{notice}</p> : null}
    {activationLink ? <div className="mt-4"><label className="text-sm font-semibold" htmlFor="client-poc-activation-link">One-time registration link</label><input className={inputClass} id="client-poc-activation-link" readOnly value={activationLink}/><div className="mt-2 flex flex-wrap gap-2"><Button onClick={copyLink}>Copy registration link</Button><Button onClick={() => setActivationLink(null)} variant="secondary">Close one-time link</Button></div></div> : null}
    {issue.isError || facilitiesQuery.isError || clientsQuery.isError ? <p className="mt-4 text-sm text-state-error" role="alert">{invitationError(issue.error)}</p> : null}
    </Surface>
    <InvitationHistory invitations={(invitationsQuery.data?.invitations ?? []).filter(item => item.client_id === clientId)} facilities={facilities} loading={invitationsQuery.isLoading} error={invitationsQuery.isError} revoking={revoke.isPending} onRevoke={id => revoke.mutate(id)} />
  </section>;
}

function FormInput({ label, value, onChange, disabled, type = "text" }: { label: string; value: string; onChange: (value: string) => void; disabled: boolean; type?: "text" | "email" }) { return <label className="block text-sm font-semibold text-text-primary">{label}<input className={inputClass} disabled={disabled} maxLength={255} required type={type} value={value} onChange={event => onChange(event.currentTarget.value)} /></label>; }
function ScopeOption({ label, checked, disabled, onChange }: { label: string; checked: boolean; disabled: boolean; onChange: () => void }) { return <label className="inline-flex min-h-10 items-center gap-2 rounded-component border border-border bg-surface px-3 py-2 text-sm font-semibold"><input checked={checked} disabled={disabled} name="facility-scope" onChange={onChange} type="radio" />{label}</label>; }
function FacilitySelection({ facilities, selected, loading, disabled, onToggle }: { facilities: RegistrationFacility[]; selected: string[]; loading: boolean; disabled: boolean; onToggle: (id: string) => void }) { if (loading) return <p role="status" className="text-sm text-text-muted">Loading Client Facilities.</p>; return <fieldset className="space-y-3"><legend className="text-sm font-semibold">Specific Facilities</legend>{facilities.length ? <div className="grid gap-3 md:grid-cols-2">{facilities.map(facility => <label className="flex items-center gap-3 rounded-component border border-border p-3 text-sm" key={facility.id}><input checked={selected.includes(facility.id)} disabled={disabled} onChange={() => onToggle(facility.id)} type="checkbox"/><span className="font-semibold">{facility.facility_name}</span></label>)}</div> : <p className="text-sm text-text-muted">No active Facilities are available for this Client.</p>}</fieldset>; }
function InvitationHistory({ invitations, facilities, loading, error, revoking, onRevoke }: { invitations: ClientPocInvitation[]; facilities: RegistrationFacility[]; loading: boolean; error: boolean; revoking: boolean; onRevoke: (id: string) => void }) { const names = new Map(facilities.map(item => [item.id, item.facility_name])); return <Surface><h2 className="text-lg font-semibold text-text-primary">Client POC invitations</h2>{loading ? <p className="mt-3 text-sm text-text-muted" role="status">Loading invitations.</p> : error ? <p className="mt-3 text-sm text-state-error" role="alert">Invitation history could not be loaded.</p> : invitations.length === 0 ? <p className="mt-3 text-sm text-text-muted">No Client POC invitations have been issued.</p> : <ul className="mt-4 space-y-3">{invitations.map(invitation => <li className="rounded-component border border-border p-4" key={invitation.id}><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold text-text-primary">{invitation.full_name}</p><p className="text-sm text-text-muted">{invitation.email}</p><p className="mt-1 text-sm text-text-muted">{invitation.facility_scope.mode === "CLIENT_WIDE" ? "Client-wide Access" : invitation.facility_scope.facility_ids.map(id => names.get(id) ?? "Facility name unavailable").join(", ")}</p><p className="mt-1 text-xs text-text-muted">Issued {formatDate(invitation.issued_at)} · Expires {formatDate(invitation.expires_at)}</p></div><div className="flex items-center gap-2"><span className="rounded-full border border-border px-3 py-1 text-xs font-semibold">{invitation.status}</span>{invitation.status === "ISSUED" ? <Button disabled={revoking} onClick={() => onRevoke(invitation.id)} variant="secondary">Revoke</Button> : null}</div></div></li>)}</ul>}</Surface>; }
function formatDate(value: string) { const date = new Date(value); return Number.isNaN(date.getTime()) ? "date unavailable" : new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date); }
function invitationError(error: Error | null) { if (!error) return "The invitation could not be completed."; if (isApiError(error) && error.status === 403) return "You are not authorized to invite Client POC accounts."; if (isApiError(error) && error.status === 409) return "That email already has an account or an active registration invitation."; return "The invitation could not be completed. Verify the selected Client and Facility scope."; }
function SafeState({ title, children }: { title: string; children: string }) { return <Surface><h1 className="text-xl font-semibold text-text-primary">{title}</h1><p className="mt-2 text-sm text-text-muted">{children}</p></Surface>; }
