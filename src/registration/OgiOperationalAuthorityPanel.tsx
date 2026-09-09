import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Button } from "../ui/components/Button";
import { SelectableCard } from "../ui/components/SelectableCard";
import { RegistrationClient, listRegistrationClients } from "./registrationClientApi";
import { listRegistrationFacilities } from "./registrationFacilityApi";
import {
  closeOgiOperationalAuthorization,
  grantOgiOperationalAuthorization,
  listOgiOperationalAuthorizations
} from "./ogiPersonnelApi";
import { RegistrationEditableSection, RegistrationStatusBadge } from "./RegistrationWorkspaceUi";
import { formatRegistrationDateTime } from "./registrationPresentation";

const inputClassName = "mt-2 min-h-10 w-full rounded-component border border-border bg-surface px-3 py-2 text-sm text-text-primary outline-none focus:border-focus focus:ring-2 focus:ring-focus";

export function OgiOperationalAuthorityPanel({ canManage, personnelId }: { canManage: boolean; personnelId: string }) {
  const queryClient = useQueryClient();
  const [clientId, setClientId] = useState("");
  const [scopeMode, setScopeMode] = useState<"CLIENT_WIDE" | "EXPLICIT_FACILITIES">("CLIENT_WIDE");
  const [facilityIds, setFacilityIds] = useState<string[]>([]);
  const [validFrom, setValidFrom] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [reason, setReason] = useState("");
  const [closing, setClosing] = useState<{ id: string; action: "end" | "revoke" } | null>(null);
  const [closingReason, setClosingReason] = useState("");
  const [effectiveAt, setEffectiveAt] = useState("");

  const authorityQuery = useQuery({ queryKey: ["ogi-personnel-authorizations", personnelId], queryFn: () => listOgiOperationalAuthorizations(personnelId), retry: false });
  const clientsQuery = useQuery({ queryKey: ["registration-clients"], queryFn: () => listRegistrationClients(), enabled: canManage, retry: false });
  const facilitiesQuery = useQuery({ queryKey: ["registration-facilities", clientId], queryFn: () => listRegistrationFacilities({ clientId }), enabled: canManage && Boolean(clientId) && scopeMode === "EXPLICIT_FACILITIES", retry: false });
  const clients = clientsQuery.data?.clients ?? [];
  const clientNames = new Map(clients.map((client: RegistrationClient) => [client.id, client.organization_name]));

  const grantMutation = useMutation({
    mutationFn: () => grantOgiOperationalAuthorization(personnelId, {
      client_id: clientId,
      scope_mode: scopeMode,
      facility_ids: scopeMode === "EXPLICIT_FACILITIES" ? facilityIds : [],
      valid_from: new Date(validFrom).toISOString(),
      valid_until: validUntil ? new Date(validUntil).toISOString() : null,
      reason: reason.trim()
    }, crypto.randomUUID()),
    onSuccess: () => {
      setClientId(""); setFacilityIds([]); setValidFrom(""); setValidUntil(""); setReason("");
      void queryClient.invalidateQueries({ queryKey: ["ogi-personnel-authorizations", personnelId] });
    }
  });
  const closeMutation = useMutation({
    mutationFn: () => {
      if (!closing) throw new Error("No operational authorization is selected.");
      return closeOgiOperationalAuthorization(personnelId, closing.id, closing.action, { reason: closingReason.trim(), effective_at: new Date(effectiveAt).toISOString() }, crypto.randomUUID());
    },
    onSuccess: () => { setClosing(null); setClosingReason(""); setEffectiveAt(""); void queryClient.invalidateQueries({ queryKey: ["ogi-personnel-authorizations", personnelId] }); }
  });

  function submitGrant(event: FormEvent) { event.preventDefault(); grantMutation.mutate(); }
  function submitClose(event: FormEvent) { event.preventDefault(); closeMutation.mutate(); }
  const canGrant = Boolean(clientId && validFrom && reason.trim() && (scopeMode === "CLIENT_WIDE" || facilityIds.length));

  return <RegistrationEditableSection title="OGI operational scope" description="Authorize this OGI Personnel member to operate for an exact Client or selected Facilities.">
    <div className="space-y-5">
      {authorityQuery.isLoading ? <p className="text-sm text-text-muted" role="status">Loading operational authorization history.</p> : null}
      {authorityQuery.isError ? <p className="text-sm font-semibold text-state-error" role="alert">Operational authorization history could not be loaded.</p> : null}
      <ul aria-label="Operational authorization history" className="space-y-3">
        {(authorityQuery.data?.authorizations ?? []).map((authorization) => <li className="rounded-component border border-border bg-elevated p-4" key={authorization.id}>
          <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold text-primary-navy">{clientNames.get(authorization.client_id) ?? authorization.client_id}</p><p className="mt-1 text-sm text-text-muted">{authorization.scope_mode === "CLIENT_WIDE" ? "All Client Facilities" : `${authorization.facility_grants.length} explicit Facilit${authorization.facility_grants.length === 1 ? "y" : "ies"}`} · From {formatRegistrationDateTime(authorization.valid_from)}</p></div><RegistrationStatusBadge value={authorization.status} /></div>
          {canManage && authorization.status === "ACTIVE" ? <div className="mt-3 flex gap-2"><Button onClick={() => setClosing({ id: authorization.id, action: "end" })} type="button" variant="secondary">End scope</Button><Button onClick={() => setClosing({ id: authorization.id, action: "revoke" })} type="button" variant="secondary">Revoke scope</Button></div> : null}
        </li>)}
      </ul>
      {!authorityQuery.isLoading && (authorityQuery.data?.authorizations.length ?? 0) === 0 ? <p className="rounded-component border border-dashed border-border p-4 text-sm text-text-muted">No operational scope has been granted.</p> : null}

      {canManage ? <form aria-label="Grant OGI operational scope" className="space-y-4 border-t border-border pt-5" onSubmit={submitGrant}>
        <h4 className="font-semibold text-primary-navy">Grant operational scope</h4>
        <div className="grid gap-4 md:grid-cols-2"><label className="text-sm font-semibold">Client<select className={inputClassName} onChange={(event) => { setClientId(event.currentTarget.value); setFacilityIds([]); }} required value={clientId}><option value="">Select a Client</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.organization_name}</option>)}</select></label>
          <div><p className="text-sm font-semibold">Scope</p><div className="mt-2 grid gap-2 sm:grid-cols-2"><SelectableCard selected={scopeMode === "CLIENT_WIDE"}><input checked={scopeMode === "CLIENT_WIDE"} name="scope-mode" onChange={() => { setScopeMode("CLIENT_WIDE"); setFacilityIds([]); }} type="radio" />All Client Facilities</SelectableCard><SelectableCard selected={scopeMode === "EXPLICIT_FACILITIES"}><input checked={scopeMode === "EXPLICIT_FACILITIES"} name="scope-mode" onChange={() => setScopeMode("EXPLICIT_FACILITIES")} type="radio" />Selected Facilities</SelectableCard></div></div>
          <label className="text-sm font-semibold">Valid from<input className={inputClassName} onChange={(event) => setValidFrom(event.currentTarget.value)} required type="datetime-local" value={validFrom} /></label><label className="text-sm font-semibold">Valid until (optional)<input className={inputClassName} onChange={(event) => setValidUntil(event.currentTarget.value)} type="datetime-local" value={validUntil} /></label></div>
        {scopeMode === "EXPLICIT_FACILITIES" ? <fieldset><legend className="text-sm font-semibold">Authorized Facilities</legend><div className="mt-2 grid gap-2 sm:grid-cols-2">{(facilitiesQuery.data?.facilities ?? []).map((facility) => <label className="flex cursor-pointer items-center gap-3 rounded-component border border-border bg-surface p-3 text-sm" key={facility.id}><input checked={facilityIds.includes(facility.id)} onChange={(event) => setFacilityIds((current) => event.currentTarget.checked ? [...current, facility.id] : current.filter((id) => id !== facility.id))} type="checkbox" />{facility.facility_name}</label>)}</div></fieldset> : null}
        <label className="block text-sm font-semibold">Business reason<textarea className={`${inputClassName} min-h-20`} onChange={(event) => setReason(event.currentTarget.value)} required value={reason} /></label>
        <Button disabled={!canGrant || grantMutation.isPending} type="submit">Grant operational scope</Button>
      </form> : null}

      {closing ? <form aria-label={`${closing.action === "end" ? "End" : "Revoke"} OGI operational scope`} className="space-y-3 rounded-component border border-red-200 bg-red-50 p-4" onSubmit={submitClose}><h4 className="font-semibold text-primary-navy">{closing.action === "end" ? "End" : "Revoke"} operational scope</h4><label className="block text-sm font-semibold">Effective at<input className={inputClassName} onChange={(event) => setEffectiveAt(event.currentTarget.value)} required type="datetime-local" value={effectiveAt} /></label><label className="block text-sm font-semibold">Reason<textarea className={`${inputClassName} min-h-20`} onChange={(event) => setClosingReason(event.currentTarget.value)} required value={closingReason} /></label><div className="flex gap-2"><Button disabled={!effectiveAt || !closingReason.trim() || closeMutation.isPending} type="submit">Confirm {closing.action}</Button><Button onClick={() => setClosing(null)} type="button" variant="secondary">Cancel</Button></div></form> : null}
    </div>
  </RegistrationEditableSection>;
}
