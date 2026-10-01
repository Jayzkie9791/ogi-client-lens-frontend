import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams, useSearchParams } from "react-router-dom";

import { routes } from "../app/routePaths";
import { useAuth } from "../auth/useAuth";
import { getMyProfile, SelfProfile } from "../self-service/selfServiceApi";
import { Button } from "../ui/components/Button";
import { Surface } from "../ui/components/Surface";
import {
  getAuthorizedFacilityTeam,
  getAuthorizedPersonnelCertificate,
  getAuthorizedPersonnelCredentials
} from "./authorizedWorkforceApi";

export function FacilityTeamPage() {
  const auth = useAuth();
  const allowed = auth.canUsePermission("view_authorized_facility_personnel");
  const self = useQuery({ queryKey: ["facility-team-self"], queryFn: getMyProfile, enabled: allowed, retry: false });
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedFacility = searchParams.get("facility") ?? "";
  const facilities = self.data?.facilities ?? [];
  const facilityId = facilities.some(item => item.id === requestedFacility)
    ? requestedFacility
    : facilities[0]?.id ?? "";
  const team = useQuery({
    queryKey: ["authorized-facility-team", facilityId],
    queryFn: () => getAuthorizedFacilityTeam(facilityId),
    enabled: allowed && Boolean(facilityId),
    retry: false
  });

  if (!allowed) return <State title="Facility Team is unavailable.">Your account does not include authorized Facility-team access.</State>;
  if (self.isLoading) return <State title="Loading Facility Team.">Please wait.</State>;
  if (!self.data || facilities.length === 0) return <State title="Facility Team was not found.">An active linked Personnel identity and Facility assignment are required.</State>;

  return <section className="space-y-4">
    <div><p className="text-xs font-semibold uppercase tracking-wide text-primary-blue">Workforce</p><h1 className="mt-2 text-2xl font-semibold">Facility Team</h1><p className="mt-1 text-sm text-text-muted">Read-only Personnel visibility for your authorized active Facility assignments.</p></div>
    <Surface><label className="block font-semibold" htmlFor="facility-team-facility">Facility</label><select className="mt-2 w-full rounded-component border border-border bg-surface px-3 py-2" id="facility-team-facility" onChange={event => setSearchParams({ facility: event.target.value })} value={facilityId}>{facilities.map(facility => <option key={facility.id} value={facility.id}>{facility.facility_name}</option>)}</select></Surface>
    <Surface><h2 className="text-lg font-semibold">Active Personnel</h2>{team.isLoading ? <p className="mt-2 text-sm text-text-muted">Loading Personnel.</p> : !team.data ? <p className="mt-2 text-sm text-text-muted">The selected Facility is unavailable.</p> : team.data.personnel.length === 0 ? <p className="mt-2 text-sm text-text-muted">No active Personnel were found.</p> : <ul className="mt-4 space-y-3">{team.data.personnel.map(personnel => <li className="flex flex-wrap items-center justify-between gap-3 rounded-component border border-border p-4" key={personnel.id}><div><p className="font-semibold">{personnel.full_name}</p><p className="text-sm text-text-muted">{personnel.client_employee_number || "Employee number not specified"} · {position(personnel, facilityId)}</p></div><Button asChild variant="secondary"><Link to={routes.facilityTeamMemberPath(personnel.id)}>View profile</Link></Button></li>)}</ul>}</Surface>
  </section>;
}

export function FacilityTeamMemberPage() {
  const auth = useAuth();
  const { staffMemberId } = useParams();
  const allowed = auth.canUsePermission("view_authorized_facility_credentials");
  const query = useQuery({ queryKey: ["authorized-personnel-credentials", staffMemberId], queryFn: () => getAuthorizedPersonnelCredentials(staffMemberId ?? ""), enabled: allowed && Boolean(staffMemberId), retry: false });
  if (!allowed) return <State title="Personnel credentials are unavailable.">Your account does not include authorized Facility credential access.</State>;
  if (query.isLoading) return <State title="Loading Personnel profile.">Please wait.</State>;
  if (!query.data) return <State title="Personnel profile was not found.">Only active Personnel sharing an authorized Facility can be viewed.</State>;
  const { personnel, certifications } = query.data;
  return <section className="space-y-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wide text-primary-blue">Facility Team</p><h1 className="mt-2 text-2xl font-semibold">{personnel.full_name}</h1><p className="text-sm text-text-muted">Read-only Personnel profile</p></div><Button asChild variant="secondary"><Link to={routes.facilityTeam}>Back to Facility Team</Link></Button></div><Profile profile={personnel}/><Surface><h2 className="text-lg font-semibold">Credentials</h2>{certifications.length === 0 ? <p className="mt-2 text-sm text-text-muted">No certification records are available.</p> : <ul className="mt-4 space-y-3">{certifications.map(certification => <li className="rounded-component border border-border p-4" key={certification.id}><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold">{certification.certification_level}</p><p className="text-sm text-text-muted">{certification.certification_number} · {certification.certification_status}</p></div>{certification.credential_issuance_id ? <Button asChild><Link to={routes.facilityTeamCertificatePath(certification.credential_issuance_id)}>View certificate</Link></Button> : <span className="text-sm text-text-muted">No issued digital certificate.</span>}</div></li>)}</ul>}</Surface></section>;
}

export function FacilityTeamCertificatePage() {
  const auth = useAuth();
  const { issuanceId } = useParams();
  const allowed = auth.canUsePermission("view_authorized_facility_credentials");
  const query = useQuery({ queryKey: ["authorized-personnel-certificate", issuanceId], queryFn: () => getAuthorizedPersonnelCertificate(issuanceId ?? ""), enabled: allowed && Boolean(issuanceId), retry: false });
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => { if (!query.data) return; const next = URL.createObjectURL(query.data.blob); setUrl(next); return () => URL.revokeObjectURL(next); }, [query.data]);
  if (!allowed) return <State title="Certificate unavailable.">Your account does not include authorized Facility credential access.</State>;
  if (query.isLoading) return <State title="Loading certificate.">Please wait.</State>;
  if (!url) return <State title="Certificate was not found.">Only certificates for active Personnel sharing an authorized Facility can be viewed.</State>;
  return <section className="space-y-4"><div className="flex justify-between gap-3"><h1 className="text-2xl font-semibold">Personnel Certificate</h1><Button asChild variant="secondary"><Link to={routes.facilityTeam}>Back to Facility Team</Link></Button></div><iframe className="h-[75vh] w-full rounded-panel border border-border" src={url} title="Personnel issued certificate" /></section>;
}

function Profile({ profile }: { profile: SelfProfile }) { return <Surface><dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"><Item label="Employee number" value={profile.client_employee_number}/><Item label="Client" value={profile.client.organization_name}/><Item label="Employment status" value={profile.employment_status}/><Item label="Email" value={profile.email}/><Item label="Phone" value={profile.phone_number}/><Item label="Hire date" value={date(profile.hire_date)}/></dl><h2 className="mt-5 font-semibold">Shared active Facilities</h2><ul className="mt-2 space-y-2">{profile.facilities.map(facility => <li className="rounded-component border border-border p-3 text-sm" key={facility.assignment_id}><span className="font-semibold">{facility.facility_name}</span> · {facility.position ?? "Position not specified"}</li>)}</ul></Surface>; }
function Item({ label, value }: { label: string; value: string | null }) { return <div><dt className="text-xs font-semibold uppercase text-text-muted">{label}</dt><dd className="mt-1">{value || "Not specified"}</dd></div>; }
function State({ title, children }: { title: string; children: string }) { return <Surface><h1 className="text-xl font-semibold">{title}</h1><p className="mt-2 text-sm text-text-muted">{children}</p></Surface>; }
function position(personnel: SelfProfile, facilityId: string) { return personnel.facilities.find(item => item.id === facilityId)?.position ?? "Position not specified"; }
function date(value: string | null) { return value ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(value)) : "Not specified"; }
