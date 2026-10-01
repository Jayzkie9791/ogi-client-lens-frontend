import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { isApiError } from "../api/errors";
import { listFeatureClients, listFeatureFacilities } from "../api/featureScopedDiscoveryApi";
import { Button } from "../ui/components/Button";
import { SelectableCard } from "../ui/components/SelectableCard";
import { RegistrationClient } from "./registrationClientApi";
import {
  closeOgiOperationalAuthorization,
  grantOgiOperationalAuthorization,
  listOgiOperationalAuthorizations,
  renewOgiOperationalAuthorization,
  type OgiOperationalAuthorization
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
  const [grantError, setGrantError] = useState<string | null>(null);
  const [closing, setClosing] = useState<{ id: string; action: "end" | "revoke" } | null>(null);
  const [closingReason, setClosingReason] = useState("");
  const [effectiveAt, setEffectiveAt] = useState("");
  const [renewing, setRenewing] = useState<OgiOperationalAuthorization | null>(null);
  const [renewUntil, setRenewUntil] = useState("");
  const [renewReason, setRenewReason] = useState("");

  const authorityQuery = useQuery({ queryKey: ["ogi-personnel-authorizations", personnelId], queryFn: () => listOgiOperationalAuthorizations(personnelId), retry: false });
  const clientsQuery = useQuery({ queryKey: ["feature-discovery", "ogi-personnel-operational-authority", "clients"], queryFn: () => listFeatureClients("ogi-personnel-operational-authority"), enabled: canManage, retry: false });
  const facilitiesQuery = useQuery({ queryKey: ["feature-discovery", "ogi-personnel-operational-authority", "facilities", clientId], queryFn: () => listFeatureFacilities("ogi-personnel-operational-authority", clientId), enabled: canManage && Boolean(clientId) && scopeMode === "EXPLICIT_FACILITIES", retry: false });
  const historyFacilitiesQuery = useQuery({ queryKey: ["feature-discovery", "ogi-personnel-operational-authority", "facilities", "all"], queryFn: () => listFeatureFacilities("ogi-personnel-operational-authority"), enabled: canManage, retry: false });
  const clients = clientsQuery.data?.clients ?? [];
  const clientNames = new Map(clients.map((client: RegistrationClient) => [client.id, client.organization_name]));
  const facilityNames = new Map((historyFacilitiesQuery.data?.facilities ?? []).map((facility) => [facility.id, facility.facility_name]));

  const grantMutation = useMutation({
    mutationFn: () => grantOgiOperationalAuthorization(personnelId, {
      client_id: clientId,
      scope_mode: scopeMode,
      facility_ids: scopeMode === "EXPLICIT_FACILITIES" ? facilityIds : [],
      valid_from: new Date(validFrom).toISOString(),
      valid_until: validUntil ? new Date(validUntil).toISOString() : null,
      reason: reason.trim()
    }, crypto.randomUUID()),
    onSuccess: (result) => {
      queryClient.setQueryData<{ authorizations: OgiOperationalAuthorization[] }>(
        ["ogi-personnel-authorizations", personnelId],
        (current) => ({
          authorizations: [
            result.authorization,
            ...(current?.authorizations ?? []).filter((item) => item.id !== result.authorization.id)
          ]
        })
      );
      setClientId(""); setScopeMode("CLIENT_WIDE"); setFacilityIds([]); setValidFrom(""); setValidUntil(""); setReason(""); setGrantError(null);
      void queryClient.invalidateQueries({ queryKey: ["ogi-personnel-authorizations", personnelId] });
    },
    onError: (error) => setGrantError(authorityErrorMessage(error, "Operational scope could not be granted."))
  });
  const closeMutation = useMutation({
    mutationFn: () => {
      if (!closing) throw new Error("No operational authorization is selected.");
      return closeOgiOperationalAuthorization(personnelId, closing.id, closing.action, { reason: closingReason.trim(), effective_at: new Date(effectiveAt).toISOString() }, crypto.randomUUID());
    },
    onSuccess: () => { setClosing(null); setClosingReason(""); setEffectiveAt(""); void queryClient.invalidateQueries({ queryKey: ["ogi-personnel-authorizations", personnelId] }); }
  });
  const renewMutation = useMutation({
    mutationFn: () => {
      if (!renewing) throw new Error("No operational authorization is selected.");
      return renewOgiOperationalAuthorization(personnelId, renewing.id, {
        scope_mode: renewing.scope_mode,
        facility_ids: renewing.scope_mode === "EXPLICIT_FACILITIES" ? renewing.facility_grants.map((grant) => grant.facility_id) : [],
        valid_until: renewUntil ? new Date(renewUntil).toISOString() : null,
        reason: renewReason.trim()
      }, crypto.randomUUID());
    },
    onSuccess: () => { setRenewing(null); setRenewUntil(""); setRenewReason(""); void queryClient.invalidateQueries({ queryKey: ["ogi-personnel-authorizations", personnelId] }); }
  });

  function submitGrant(event: FormEvent) {
    event.preventDefault();
    const missing = [
      !clientId ? "Client" : null,
      !validFrom ? "Valid from" : null,
      !reason.trim() ? "Business reason" : null,
      scopeMode === "EXPLICIT_FACILITIES" && facilityIds.length === 0 ? "at least one authorized Facility" : null
    ].filter((value): value is string => value !== null);
    if (missing.length > 0) {
      setGrantError(`Complete the required fields: ${missing.join(", ")}.`);
      return;
    }
    if ((authorityQuery.data?.authorizations ?? []).some((authorization) => authorization.client_id === clientId && authorization.status === "ACTIVE")) {
      setGrantError("An active operational scope already exists for this Personnel and Client. End or revoke it before granting a replacement.");
      return;
    }
    setGrantError(null);
    grantMutation.mutate();
  }
  function submitClose(event: FormEvent) { event.preventDefault(); closeMutation.mutate(); }
  return <RegistrationEditableSection title="Operational authorization" description="Manage the ongoing Client and Facility authority of this OGI Personnel member. Initial Personnel registration is handled separately.">
    <div className="space-y-5">
      {authorityQuery.isLoading ? <p className="text-sm text-text-muted" role="status">Loading operational authorization history.</p> : null}
      {authorityQuery.isError ? <p className="rounded-component border border-accent-red/30 bg-red-50 p-3 text-sm font-semibold text-state-error" role="alert">{authorityErrorMessage(authorityQuery.error, "Operational authorization history could not be loaded.")}</p> : null}
      <ul aria-label="Operational authorization history" className="space-y-3">
        {(authorityQuery.data?.authorizations ?? []).map((authorization) => <AuthorizationHistoryItem authorization={authorization} canManage={canManage} clientName={clientNames.get(authorization.client_id) ?? "Client name unavailable"} facilityNames={facilityNames} key={authorization.id} onClose={(action) => setClosing({ id: authorization.id, action })} onRenew={() => setRenewing(authorization)} />)}
      </ul>
      {!authorityQuery.isLoading && !authorityQuery.isError && (authorityQuery.data?.authorizations.length ?? 0) === 0 ? <p className="rounded-component border border-dashed border-border p-4 text-sm text-text-muted">No operational scope has been granted.</p> : null}

      {canManage ? <form aria-label="Grant OGI operational scope" className="space-y-4 border-t border-border pt-5" noValidate onSubmit={submitGrant}>
        <h4 className="font-semibold text-primary-navy">Grant operational scope</h4>
        <div className="grid gap-4 md:grid-cols-2"><label className="text-sm font-semibold">Client<select className={inputClassName} onChange={(event) => { setClientId(event.currentTarget.value); setFacilityIds([]); }} required value={clientId}><option value="">Select a Client</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.organization_name}</option>)}</select></label>
          <div><p className="text-sm font-semibold">Scope</p><div className="mt-2 grid gap-2 sm:grid-cols-2"><SelectableCard selected={scopeMode === "CLIENT_WIDE"}><input checked={scopeMode === "CLIENT_WIDE"} name="scope-mode" onChange={() => { setScopeMode("CLIENT_WIDE"); setFacilityIds([]); }} type="radio" />All facilities for selected Client</SelectableCard><SelectableCard selected={scopeMode === "EXPLICIT_FACILITIES"}><input checked={scopeMode === "EXPLICIT_FACILITIES"} name="scope-mode" onChange={() => setScopeMode("EXPLICIT_FACILITIES")} type="radio" />Selected Facilities</SelectableCard></div></div>
          <label className="text-sm font-semibold">Valid from<input className={inputClassName} onChange={(event) => setValidFrom(event.currentTarget.value)} required type="datetime-local" value={validFrom} /></label><label className="text-sm font-semibold">Valid until (optional)<input className={inputClassName} onChange={(event) => setValidUntil(event.currentTarget.value)} type="datetime-local" value={validUntil} /></label></div>
        {scopeMode === "EXPLICIT_FACILITIES" ? <fieldset><legend className="text-sm font-semibold">Authorized Facilities</legend><div className="mt-2 grid gap-2 sm:grid-cols-2">{(facilitiesQuery.data?.facilities ?? []).map((facility) => <label className="flex cursor-pointer items-center gap-3 rounded-component border border-border bg-surface p-3 text-sm" key={facility.id}><input checked={facilityIds.includes(facility.id)} onChange={(event) => { const checked = event.currentTarget.checked; setFacilityIds((current) => checked ? [...current, facility.id] : current.filter((id) => id !== facility.id)); }} type="checkbox" />{facility.facility_name}</label>)}</div></fieldset> : null}
        <label className="block text-sm font-semibold">Business reason<textarea className={`${inputClassName} min-h-20`} onChange={(event) => setReason(event.currentTarget.value)} required value={reason} /></label>
        {grantError ? <p className="rounded-component border border-accent-red/30 bg-red-50 p-3 text-sm font-semibold text-state-error" role="alert">{grantError}</p> : null}
        <Button disabled={grantMutation.isPending} type="submit">{grantMutation.isPending ? "Granting operational scope…" : "Grant operational scope"}</Button>
      </form> : null}

      {closing ? <form aria-label={`${closing.action === "end" ? "End" : "Revoke"} OGI operational scope`} className="space-y-3 rounded-component border border-red-200 bg-red-50 p-4" onSubmit={submitClose}><h4 className="font-semibold text-primary-navy">{closing.action === "end" ? "End" : "Revoke"} operational scope</h4><label className="block text-sm font-semibold">Effective at<input className={inputClassName} onChange={(event) => setEffectiveAt(event.currentTarget.value)} required type="datetime-local" value={effectiveAt} /></label><label className="block text-sm font-semibold">Reason<textarea className={`${inputClassName} min-h-20`} onChange={(event) => setClosingReason(event.currentTarget.value)} required value={closingReason} /></label><div className="flex gap-2"><Button disabled={!effectiveAt || !closingReason.trim() || closeMutation.isPending} type="submit">Confirm {closing.action}</Button><Button onClick={() => setClosing(null)} type="button" variant="secondary">Cancel</Button></div></form> : null}
      {renewing ? <form aria-label="Renew OGI operational scope" className="space-y-3 rounded-component border border-primary-blue/30 bg-blue-50 p-4" onSubmit={(event) => { event.preventDefault(); if (renewReason.trim()) renewMutation.mutate(); }}><h4 className="font-semibold text-primary-navy">Renew operational scope</h4><p className="text-sm text-text-muted">The successor will begin when the server accepts this renewal and will preserve the same Client and Facility scope.</p><label className="block text-sm font-semibold">New valid until (optional)<input className={inputClassName} min={localDateTimeNow()} onChange={(event) => setRenewUntil(event.currentTarget.value)} type="datetime-local" value={renewUntil} /></label><label className="block text-sm font-semibold">Business reason<textarea className={`${inputClassName} min-h-20`} onChange={(event) => setRenewReason(event.currentTarget.value)} required value={renewReason} /></label>{renewMutation.isError ? <p className="text-sm font-semibold text-state-error" role="alert">Renewal was not completed. Refresh the authorization history and verify that this scope has expired.</p> : null}<div className="flex gap-2"><Button disabled={!renewReason.trim() || renewMutation.isPending} type="submit">{renewMutation.isPending ? "Renewing…" : "Confirm renewal"}</Button><Button onClick={() => setRenewing(null)} type="button" variant="secondary">Cancel</Button></div></form> : null}
    </div>
  </RegistrationEditableSection>;
}

function AuthorizationHistoryItem({ authorization, canManage, clientName, facilityNames, onClose, onRenew }: { authorization: OgiOperationalAuthorization; canManage: boolean; clientName: string; facilityNames: Map<string, string>; onClose: (action: "end" | "revoke") => void; onRenew: () => void }) {
  const facilities = authorization.scope_mode === "CLIENT_WIDE"
    ? "All facilities for this Client"
    : authorization.facility_grants.map((grant) => facilityNames.get(grant.facility_id) ?? "Facility name unavailable").join(", ");
  const effectiveStatus = operationalAuthorizationEffectiveStatus(authorization);

  return <li className="rounded-component border border-border bg-elevated p-4">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold text-primary-navy">{clientName}</p><p className="mt-1 text-sm font-medium text-primary-blue">{authorization.scope_mode === "CLIENT_WIDE" ? "Client-wide authority" : "Explicit Facility authority"}</p></div><RegistrationStatusBadge value={effectiveStatus} /></div>
    <dl className="mt-4 grid gap-x-5 gap-y-3 text-sm sm:grid-cols-2">
      <div><dt className="cl-data-label">Authorized Facilities</dt><dd className="cl-data-value mt-1">{facilities}</dd></div>
      <div><dt className="cl-data-label">Valid from</dt><dd className="cl-data-value mt-1">{formatRegistrationDateTime(authorization.valid_from)}</dd></div>
      <div><dt className="cl-data-label">Valid until</dt><dd className="cl-data-value mt-1">{authorization.valid_until ? formatRegistrationDateTime(authorization.valid_until) : "No scheduled end"}</dd></div>
      <div><dt className="cl-data-label">Business reason</dt><dd className="cl-data-value mt-1">{authorization.reason ?? "Not specified"}</dd></div>
    </dl>
    <details className="mt-4 rounded-component border border-border bg-surface p-3"><summary className="cursor-pointer text-sm font-semibold text-primary-navy">Technical record details</summary>
      <dl className="mt-3 grid gap-x-5 gap-y-3 text-xs sm:grid-cols-2"><div><dt className="cl-data-label">Authorization ID</dt><dd className="mt-1 break-all">{authorization.id}</dd></div>
        <div><dt className="cl-data-label">Client ID</dt><dd className="mt-1 break-all">{authorization.client_id}</dd></div>
        {authorization.facility_grants.map((grant,index)=><div key={grant.facility_id}><dt className="cl-data-label">Facility ID {index+1}</dt><dd className="mt-1 break-all">{grant.facility_id}</dd></div>)}</dl>
    </details>
    {canManage && authorization.status === "ACTIVE" && effectiveStatus !== "SCHEDULED" ? <div className="mt-4 flex gap-2">{effectiveStatus === "EXPIRED" ? <Button onClick={onRenew} type="button">Renew scope</Button> : <Button onClick={() => onClose("end")} type="button" variant="secondary">End scope</Button>}<Button onClick={() => onClose("revoke")} type="button" variant="secondary">Revoke scope</Button></div> : null}
  </li>;
}

export function operationalAuthorizationEffectiveStatus(authorization: OgiOperationalAuthorization, now=Date.now()) {
  if(authorization.status!=="ACTIVE")return authorization.status;
  if(new Date(authorization.valid_from).getTime()>now)return "SCHEDULED";
  if(authorization.valid_until!==null&&new Date(authorization.valid_until).getTime()<=now)return "EXPIRED";
  return "ACTIVE";
}
function localDateTimeNow() { const now=new Date(Date.now()+60_000),offset=now.getTimezoneOffset()*60_000;return new Date(now.getTime()-offset).toISOString().slice(0,16); }
function authorityErrorMessage(error: unknown, fallback: string) {
  if (!isApiError(error)) return fallback;
  if (error.status === 403) return `${fallback} Your account does not have the required OGI operational-authorization permission.`;
  if (error.status === 409) return error.message;
  if (error.status >= 500) return `${fallback} The authorization service or database is not ready. Ask an administrator to verify the deployed migration and restart the backend.`;
  return error.message || fallback;
}
