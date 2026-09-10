import { FormEvent, useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";

import { Button } from "../ui/components/Button";
import { WorkflowContentCard, WorkflowModal } from "../ui/components/WorkflowModal";
import { createOgiPersonnel, listLinkablePersonnelUsers } from "./ogiPersonnelApi";
import { RegistrationPersonnel, RegistrationPersonnelEmploymentStatus, registrationPersonnelEmploymentStatuses } from "./registrationPersonnelApi";

const inputClassName = "mt-2 min-h-10 w-full rounded-component border border-border bg-surface px-3 py-2 text-sm text-text-primary outline-none focus:border-focus focus:ring-2 focus:ring-focus";

export function OgiPersonnelCreatePanel({ onCancel, onCreated }: { onCancel: () => void; onCreated: (personnel: RegistrationPersonnel) => void }) {
  const dialogRef = useRef<HTMLDivElement>(null);
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
  useEffect(() => { dialogRef.current?.focus(); }, []);

  const mutation = useMutation({
    mutationFn: () => createOgiPersonnel({ user_id: userId, full_name: fullName.trim(), email: email.trim() || null, phone_number: phoneNumber.trim() || null, employment_status: employmentStatus, hire_date: hireDate ? `${hireDate}T00:00:00.000Z` : null, notes: notes.trim() || null }, crypto.randomUUID()),
    onSuccess: (result) => onCreated(result.personnel)
  });

  function submit(event: FormEvent) { event.preventDefault(); mutation.mutate(); }

  return <WorkflowModal currentStep={0} dialogRef={dialogRef} eyebrow="OGI Personnel registration"
    footer={<><Button disabled={mutation.isPending} onClick={onCancel} type="button" variant="secondary">Cancel</Button><Button disabled={!userId || !fullName.trim() || mutation.isPending} form="register-ogi-personnel" type="submit">{mutation.isPending ? "Creating…" : "Create OGI Personnel"}</Button></>}
    onKeyDown={(event) => { if (event.key === "Escape" && !mutation.isPending) onCancel(); }} onSubmit={(event) => event.preventDefault()}
    steps={[{ key: "ACCOUNT", label: "Account" }, { key: "SCOPE", label: "Scope" }, { key: "QUALIFICATION", label: "Qualification" }]}
    title="Register OGI Personnel" titleId="register-ogi-personnel-title" wrapInForm={false}>
    <WorkflowContentCard currentLabel="Identity and platform account" stepNumber={1} totalSteps={3}>
    <p className="mb-5 text-sm leading-6 text-text-muted">Link an existing active platform account to one OGI Personnel identity. Operational scope and instructor qualification continue on the resulting profile.</p>
    {usersQuery.isError ? <p className="mt-4 text-sm font-semibold text-state-error" role="alert">Linkable platform users could not be loaded.</p> : null}
    <form aria-label="Register OGI Personnel" className="mt-5 space-y-4" id="register-ogi-personnel" onSubmit={submit}>
      <label className="block text-sm font-semibold">Platform user<select className={inputClassName} disabled={usersQuery.isLoading} onChange={(event) => setUserId(event.currentTarget.value)} required value={userId}><option value="">{usersQuery.isLoading ? "Loading available users…" : "Select an active unlinked user"}</option>{(usersQuery.data?.users ?? []).map((user) => <option key={user.id} value={user.id}>{user.full_name} · {user.email ?? user.username ?? user.id}</option>)}</select></label>
      <div className="grid gap-4 md:grid-cols-2"><label className="block text-sm font-semibold">Full name<input className={inputClassName} onChange={(event) => setFullName(event.currentTarget.value)} required value={fullName} /></label><label className="block text-sm font-semibold">Email<input className={inputClassName} onChange={(event) => setEmail(event.currentTarget.value)} type="email" value={email} /></label><label className="block text-sm font-semibold">Phone<input className={inputClassName} onChange={(event) => setPhoneNumber(event.currentTarget.value)} value={phoneNumber} /></label><label className="block text-sm font-semibold">Employment status<select className={inputClassName} onChange={(event) => setEmploymentStatus(event.currentTarget.value as RegistrationPersonnelEmploymentStatus)} value={employmentStatus}>{registrationPersonnelEmploymentStatuses.map((status) => <option key={status} value={status}>{status}</option>)}</select></label><label className="block text-sm font-semibold">Hire date<input className={inputClassName} onChange={(event) => setHireDate(event.currentTarget.value)} type="date" value={hireDate} /></label></div>
      <label className="block text-sm font-semibold">Notes<textarea className={`${inputClassName} min-h-24`} onChange={(event) => setNotes(event.currentTarget.value)} value={notes} /></label>
    </form>
    </WorkflowContentCard>
  </WorkflowModal>;
}
