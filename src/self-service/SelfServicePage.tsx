import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";

import { routes } from "../app/routePaths";
import { useAuth } from "../auth/useAuth";
import { Button } from "../ui/components/Button";
import { Surface } from "../ui/components/Surface";
import { getMyCertificate, getMyCredentials, getMyProfile, SelfProfile } from "./selfServiceApi";

export function MyProfilePage() {
  const auth = useAuth();
  const allowed = auth.canUsePermission("view_own_personnel_profile");
  const query = useQuery({ queryKey: ["my-profile"], queryFn: getMyProfile, enabled: allowed, retry: false });
  if (!allowed) return <State title="My Profile is unavailable.">Your account does not include self-profile access.</State>;
  if (query.isLoading) return <State title="Loading My Profile.">Please wait.</State>;
  if (!query.data) return <State title="My Profile was not found.">An active linked Personnel identity and Facility assignment are required.</State>;
  return <Profile profile={query.data} />;
}

export function MyCredentialsPage() {
  const auth = useAuth();
  const allowed = auth.canUsePermission("view_own_credentials");
  const query = useQuery({ queryKey: ["my-credentials"], queryFn: getMyCredentials, enabled: allowed, retry: false });
  if (!allowed) return <State title="My Credentials is unavailable.">Your account does not include self-credential access.</State>;
  if (query.isLoading) return <State title="Loading My Credentials.">Please wait.</State>;
  if (!query.data) return <State title="My Credentials was not found.">An active linked Personnel identity and Facility assignment are required.</State>;
  return <section className="space-y-4"><Profile profile={query.data.personnel} compact /><Surface><h2 className="text-lg font-semibold">Certifications</h2>{query.data.certifications.length === 0 ? <p className="mt-2 text-sm text-text-muted">No certification records are available.</p> : <ul className="mt-4 space-y-3">{query.data.certifications.map(certification => <li className="rounded-component border border-border p-4" key={certification.id}><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-semibold">{certification.certification_level}</h3><p className="text-sm text-text-muted">{certification.certification_number} · {certification.certification_status}</p><p className="mt-1 text-sm">Issued {date(certification.issue_date)} · Expires {date(certification.expiry_date)}</p></div>{certification.credential_issuance_id ? <Button asChild><Link to={routes.myCredentialCertificatePath(certification.credential_issuance_id)}>View Certificate</Link></Button> : <span className="text-sm text-text-muted">Certification recorded. An issued digital certificate is not yet available.</span>}</div></li>)}</ul>}</Surface></section>;
}

export function MyCertificatePage() {
  const auth = useAuth(); const { issuanceId } = useParams();
  const allowed = auth.canUsePermission("view_own_credentials");
  const query = useQuery({ queryKey: ["my-certificate", issuanceId], queryFn: () => getMyCertificate(issuanceId ?? ""), enabled: allowed && Boolean(issuanceId), retry: false });
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => { if (!query.data) return; const next = URL.createObjectURL(query.data.blob); setUrl(next); return () => URL.revokeObjectURL(next); }, [query.data]);
  if (!allowed) return <State title="Certificate unavailable.">Your account does not include self-credential access.</State>;
  if (query.isLoading) return <State title="Loading certificate.">Please wait.</State>;
  if (!url) return <State title="Certificate was not found.">Only your own issued certificate can be opened.</State>;
  return <section className="space-y-4"><div className="flex justify-between gap-3"><h1 className="text-2xl font-semibold">My Certificate</h1><Button asChild variant="secondary"><Link to={routes.myCredentials}>Back to My Credentials</Link></Button></div><iframe className="h-[75vh] w-full rounded-panel border border-border" src={url} title="My issued certificate" /></section>;
}

function Profile({ profile, compact = false }: { profile: SelfProfile; compact?: boolean }) { return <section className="space-y-4"><div><p className="text-xs font-semibold uppercase tracking-wide text-primary-blue">My Account</p><h1 className="mt-2 text-2xl font-semibold">{compact ? "My Credentials" : "My Profile"}</h1></div><Surface><h2 className="text-lg font-semibold">{profile.full_name}</h2><dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3"><Item label="Employee number" value={profile.client_employee_number}/><Item label="Client" value={profile.client.organization_name}/><Item label="Employment status" value={profile.employment_status}/><Item label="Email" value={profile.email}/><Item label="Phone" value={profile.phone_number}/><Item label="Hire date" value={date(profile.hire_date)}/></dl><h3 className="mt-5 font-semibold">Active Facility assignments</h3><ul className="mt-2 space-y-2">{profile.facilities.map(facility => <li className="rounded-component border border-border p-3 text-sm" key={facility.assignment_id}><span className="font-semibold">{facility.facility_name}</span> · {facility.position ?? "Position not specified"}{facility.is_primary ? " · Primary assignment" : ""}</li>)}</ul></Surface></section>; }
function Item({ label, value }: { label: string; value: string | null }) { return <div><dt className="text-xs font-semibold uppercase text-text-muted">{label}</dt><dd className="mt-1">{value || "Not specified"}</dd></div>; }
function State({ title, children }: { title: string; children: string }) { return <Surface><h1 className="text-xl font-semibold">{title}</h1><p className="mt-2 text-sm text-text-muted">{children}</p></Surface>; }
function date(value: string | null) { return value ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(value)) : "Not specified"; }
