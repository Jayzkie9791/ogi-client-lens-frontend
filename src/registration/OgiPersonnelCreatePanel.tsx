import { FormEvent, useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";

import { Button } from "../ui/components/Button";
import { Surface } from "../ui/components/Surface";
import { createOgiPersonnel, listLinkablePersonnelUsers } from "./ogiPersonnelApi";
import { RegistrationPersonnel, RegistrationPersonnelEmploymentStatus, registrationPersonnelEmploymentStatuses } from "./registrationPersonnelApi";

const inputClassName = "mt-2 min-h-10 w-full rounded-component border border-border bg-surface px-3 py-2 text-sm text-text-primary outline-none focus:border-focus focus:ring-2 focus:ring-focus";

export function OgiPersonnelCreatePanel({ onCancel, onCreated }: { onCancel: () => void; onCreated: (personnel: RegistrationPersonnel) => void }) {
  const [userId, setUserId] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [employmentStatus, setEmploymentStatus] = useState<RegistrationPersonnelEmploymentStatus>("ACTIVE");
  const [hireDate, setHireDate] = useState("");
  const [notes, setNotes] = useState("");
  const usersQuery = useQuery({ queryKey: ["registration-personnel-linkable-users"], queryFn: listLinkablePersonnelUsers, retry: false });
  const selectedUser = usersQuery.data?.users.find((user) => user.id === userId);

  useEffect(() => {
    if (selectedUser) {
      setFullName(selectedUser.full_name);
      setEmail(selectedUser.email ?? "");
    }
  }, [selectedUser]);

  const mutation = useMutation({
    mutationFn: () => createOgiPersonnel({ user_id: userId, full_name: fullName.trim(), email: email.trim() || null, phone_number: phoneNumber.trim() || null, employment_status: employmentStatus, hire_date: hireDate ? `${hireDate}T00:00:00.000Z` : null, notes: notes.trim() || null }, crypto.randomUUID()),
    onSuccess: (result) => onCreated(result.personnel)
  });

  function submit(event: FormEvent) { event.preventDefault(); mutation.mutate(); }

  return <Surface>
    <div className="border-l-4 border-accent-red pl-4"><p className="text-xs font-bold uppercase tracking-wide text-primary-blue">OGI Personnel</p><h2 className="mt-1 text-lg font-semibold text-primary-navy">Register OGI Personnel</h2><p className="mt-1 text-sm text-text-muted">Link an existing active platform account to one OGI-affiliated Personnel identity.</p></div>
    {usersQuery.isError ? <p className="mt-4 text-sm font-semibold text-state-error" role="alert">Linkable platform users could not be loaded.</p> : null}
    <form aria-label="Register OGI Personnel" className="mt-5 space-y-4" onSubmit={submit}>
      <label className="block text-sm font-semibold">Platform user<select className={inputClassName} disabled={usersQuery.isLoading} onChange={(event) => setUserId(event.currentTarget.value)} required value={userId}><option value="">{usersQuery.isLoading ? "Loading available users…" : "Select an active unlinked user"}</option>{(usersQuery.data?.users ?? []).map((user) => <option key={user.id} value={user.id}>{user.full_name} · {user.email ?? user.username ?? user.id}</option>)}</select></label>
      <div className="grid gap-4 md:grid-cols-2"><label className="block text-sm font-semibold">Full name<input className={inputClassName} onChange={(event) => setFullName(event.currentTarget.value)} required value={fullName} /></label><label className="block text-sm font-semibold">Email<input className={inputClassName} onChange={(event) => setEmail(event.currentTarget.value)} type="email" value={email} /></label><label className="block text-sm font-semibold">Phone<input className={inputClassName} onChange={(event) => setPhoneNumber(event.currentTarget.value)} value={phoneNumber} /></label><label className="block text-sm font-semibold">Employment status<select className={inputClassName} onChange={(event) => setEmploymentStatus(event.currentTarget.value as RegistrationPersonnelEmploymentStatus)} value={employmentStatus}>{registrationPersonnelEmploymentStatuses.map((status) => <option key={status} value={status}>{status}</option>)}</select></label><label className="block text-sm font-semibold">Hire date<input className={inputClassName} onChange={(event) => setHireDate(event.currentTarget.value)} type="date" value={hireDate} /></label></div>
      <label className="block text-sm font-semibold">Notes<textarea className={`${inputClassName} min-h-24`} onChange={(event) => setNotes(event.currentTarget.value)} value={notes} /></label>
      <div className="flex gap-2"><Button disabled={!userId || !fullName.trim() || mutation.isPending} type="submit">Create OGI Personnel</Button><Button disabled={mutation.isPending} onClick={onCancel} type="button" variant="secondary">Cancel</Button></div>
    </form>
  </Surface>;
}
