import { FormEvent, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { isApiError } from "../api/errors";
import {
  CertificationLevel,
  CertificationStatus,
  createCertification,
  listPersonnelInstructorQualifications
} from "../certifications/certificationsApi";
import { Button } from "../ui/components/Button";
import { Surface } from "../ui/components/Surface";
import { formatRegistrationDate } from "./registrationPresentation";
import {
  allocateInstructorRegistryIdentity,
  getInstructorRegistryIdentity
} from "./instructorRegistryApi";

interface QualificationForm {
  level: Extract<CertificationLevel, "L6" | "L7">;
  issueDate: string;
  expiryDate: string;
  status: Extract<CertificationStatus, "PENDING" | "ACTIVE">;
  medicalClearance: boolean;
  fitnessStandard: boolean;
  trainingHours: string;
  examScore: string;
}

const inputClassName =
  "mt-2 min-h-11 w-full rounded-component border border-border bg-white px-3 py-2 text-sm text-text-primary outline-none focus:border-primary-blue focus:ring-2 focus:ring-primary-blue/20";

export function OgiInstructorQualificationPanel({
  canCreate,
  canIssue,
  canManageRegistry = false,
  canView,
  canViewRegistry = false,
  personnelId
}: {
  canCreate: boolean;
  canIssue: boolean;
  canManageRegistry?: boolean;
  canView: boolean;
  canViewRegistry?: boolean;
  personnelId: string;
}) {
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<QualificationForm>(() => emptyForm(canIssue));
  const [message, setMessage] = useState<string | null>(null);
  const queryKey = ["personnel-instructor-qualifications", personnelId] as const;
  const qualificationsQuery = useQuery({
    queryKey,
    queryFn: () => listPersonnelInstructorQualifications(personnelId),
    enabled: canView,
    retry: false
  });
  const registryQueryKey = ["instructor-registry", personnelId] as const;
  const registryQuery = useQuery({
    queryKey: registryQueryKey,
    queryFn: () => getInstructorRegistryIdentity(personnelId),
    enabled: canViewRegistry,
    retry: false
  });
  const qualifications = useMemo(
    () => qualificationsQuery.data?.certifications ?? [],
    [qualificationsQuery.data?.certifications]
  );
  const currentLevels = useMemo(
    () => new Set(
      qualifications
        .filter((item) =>
          item.certification_status === "PENDING" ||
          (item.certification_status === "ACTIVE" && new Date(item.expiry_date).getTime() > Date.now())
        )
        .map((item) => item.certification_level)
    ),
    [qualifications]
  );
  const duplicateLevel = currentLevels.has(form.level);

  const mutation = useMutation({
    mutationFn: () => createCertification({
      certification_level: form.level,
      issue_date: asUtcDate(form.issueDate),
      expiry_date: asUtcDate(form.expiryDate),
      certification_status: form.status,
      staff_member_id: personnelId,
      medical_clearance_provided: form.medicalClearance,
      fitness_standard_achieved: form.fitnessStandard,
      ...(form.trainingHours ? { training_hours_completed: Number(form.trainingHours) } : {}),
      ...(form.examScore ? { written_exam_score: Number(form.examScore) } : {})
    }),
    onSuccess: async (certification) => {
      setMessage(`${certification.certification_level} instructor qualification recorded successfully.`);
      setCreating(false);
      setForm(emptyForm(canIssue));
      await queryClient.invalidateQueries({ queryKey });
    }
  });
  const registryMutation = useMutation({
    mutationFn: () => allocateInstructorRegistryIdentity(personnelId),
    onSuccess: async (identity) => {
      queryClient.setQueryData(registryQueryKey, identity);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["oets-context-candidates"] }),
        queryClient.invalidateQueries({ queryKey: ["training-eligible-instructors"] })
      ]);
    }
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    if (duplicateLevel || mutation.isPending) return;
    mutation.mutate();
  }

  if (!canView) return null;

  return (
    <Surface aria-label="Instructor Qualification" className="space-y-4">
      <header className="border-l-4 border-accent-red bg-elevated px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-primary-blue">Certification authority</p>
        <h3 className="mt-1 text-lg font-semibold text-primary-navy">Instructor Qualification</h3>
        <p className="mt-1 text-sm leading-6 text-text-muted">
          Record an existing L6 or L7 Certification for this OGI Personnel profile. Certification remains the governing system of record.
        </p>
      </header>

      {qualificationsQuery.isLoading ? <p role="status">Loading instructor qualifications…</p> : null}
      {qualificationsQuery.isError ? <p className="rounded-component border border-accent-red/30 bg-red-50 p-3 text-sm font-medium text-red-800" role="alert">Instructor qualifications could not be loaded.</p> : null}
      {!qualificationsQuery.isLoading && !qualificationsQuery.isError && qualifications.length === 0 ? (
        <p className="rounded-component border border-dashed border-border bg-elevated p-4 text-sm text-text-muted">No L6 or L7 instructor qualification has been recorded.</p>
      ) : null}
      {qualifications.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {qualifications.map((item) => (
            <article className="rounded-component border border-border bg-elevated p-4" key={item.id}>
              <div className="flex items-start justify-between gap-3">
                <div><p className="font-semibold text-primary-navy">{qualificationTitle(item.certification_level)}</p><p className="mt-1 text-sm text-text-muted">{item.certification_number}</p></div>
                <span className="rounded-full border border-border bg-white px-2 py-1 text-xs font-semibold text-text-primary">{item.certification_status}</span>
              </div>
              <p className="mt-3 text-sm text-text-muted">Valid {formatRegistrationDate(item.issue_date.slice(0, 10))} – {formatRegistrationDate(item.expiry_date.slice(0, 10))}</p>
            </article>
          ))}
        </div>
      ) : null}

      {canViewRegistry ? (
        <section aria-label="Instructor Registry" className="rounded-component border border-blue-200 bg-blue-50/60 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-primary-blue">Permanent instructor identity</p>
              <h4 className="mt-1 font-semibold text-primary-navy">Instructor Registry</h4>
            </div>
            {registryQuery.data ? <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800">{registryQuery.data.status}</span> : null}
          </div>
          {registryQuery.isLoading ? <p className="mt-3 text-sm text-text-muted" role="status">Checking Instructor Registry…</p> : null}
          {registryQuery.isError ? <p className="mt-3 text-sm font-medium text-red-800" role="alert">Instructor Registry could not be loaded.</p> : null}
          {!registryQuery.isLoading && !registryQuery.isError && registryQuery.data ? (
            <div className="mt-3">
              <p className="cl-data-label">Instructor Registry Number</p>
              <p className="mt-1 text-lg font-semibold text-primary-navy">{registryQuery.data.instructor_number}</p>
              <p className="mt-2 text-sm text-text-muted">This permanent number identifies this Personnel member as an instructor across qualification changes.</p>
            </div>
          ) : null}
          {!registryQuery.isLoading && !registryQuery.isError && registryQuery.data === null ? (
            <div className="mt-3">
              <p className="text-sm text-text-muted">No Instructor Registry Number has been allocated. An active L5, L6, or L7 Certification is required.</p>
              {canManageRegistry ? <Button className="mt-3" disabled={registryMutation.isPending || qualifications.length === 0} onClick={() => registryMutation.mutate()} type="button">{registryMutation.isPending ? "Allocating…" : "Allocate Instructor Registry Number"}</Button> : null}
            </div>
          ) : null}
          {registryMutation.isError ? <p className="mt-3 text-sm font-medium text-red-800" role="alert">{registryError(registryMutation.error)}</p> : null}
        </section>
      ) : null}

      {message ? <p className="rounded-component border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-800" role="status">{message}</p> : null}
      {mutation.isError ? <p className="rounded-component border border-accent-red/30 bg-red-50 p-3 text-sm font-medium text-red-800" role="alert">{certificationError(mutation.error)}</p> : null}

      {canCreate && !creating ? <Button onClick={() => { setMessage(null); mutation.reset(); setCreating(true); }} type="button">Record Existing L6/L7 Certification</Button> : null}
      {creating ? (
        <form aria-label="Record instructor qualification" className="space-y-4 border-t border-border pt-4" onSubmit={submit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-semibold text-text-primary">Instructor level<select className={inputClassName} onChange={(event) => setForm({ ...form, level: event.currentTarget.value as QualificationForm["level"] })} value={form.level}><option value="L6">L6 · Guardian Instructor</option><option value="L7">L7 · Master Guardian Instructor</option></select></label>
            <label className="text-sm font-semibold text-text-primary">Status<select className={inputClassName} onChange={(event) => setForm({ ...form, status: event.currentTarget.value as QualificationForm["status"] })} value={form.status}><option value="PENDING">Draft</option>{canIssue ? <option value="ACTIVE">Active</option> : null}</select></label>
            <div className="rounded-component border border-blue-200 bg-blue-50 p-3 text-sm text-text-muted sm:col-span-2"><span className="font-semibold text-primary-navy">Certification number:</span>{" "}Assigned automatically after this qualification is saved.</div>
            <label className="text-sm font-semibold text-text-primary">Issue date<input className={inputClassName} onChange={(event) => setForm({ ...form, issueDate: event.currentTarget.value })} required type="date" value={form.issueDate} /></label>
            <label className="text-sm font-semibold text-text-primary">Expiry date<input className={inputClassName} onChange={(event) => setForm({ ...form, expiryDate: event.currentTarget.value })} required type="date" value={form.expiryDate} /></label>
            <label className="text-sm font-semibold text-text-primary">Training hours (optional)<input className={inputClassName} min="0" onChange={(event) => setForm({ ...form, trainingHours: event.currentTarget.value })} type="number" value={form.trainingHours} /></label>
            <label className="text-sm font-semibold text-text-primary">Written exam score (optional)<input className={inputClassName} min="0" onChange={(event) => setForm({ ...form, examScore: event.currentTarget.value })} type="number" value={form.examScore} /></label>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex items-center gap-2 rounded-component border border-border p-3 text-sm font-semibold text-text-primary"><input checked={form.medicalClearance} onChange={(event) => setForm({ ...form, medicalClearance: event.currentTarget.checked })} type="checkbox" />Medical clearance provided</label>
            <label className="flex items-center gap-2 rounded-component border border-border p-3 text-sm font-semibold text-text-primary"><input checked={form.fitnessStandard} onChange={(event) => setForm({ ...form, fitnessStandard: event.currentTarget.checked })} type="checkbox" />Fitness standard achieved</label>
          </div>
          {duplicateLevel ? <p className="rounded-component border border-amber-200 bg-amber-50 p-3 text-sm font-medium text-amber-900" role="alert">This person already has a current {form.level} Certification. Historical expired records remain preserved.</p> : null}
          <div className="flex flex-wrap gap-2"><Button disabled={mutation.isPending || duplicateLevel} type="submit">{mutation.isPending ? "Recording Qualification…" : "Record Qualification"}</Button><Button disabled={mutation.isPending} onClick={() => { setCreating(false); mutation.reset(); }} type="button" variant="secondary">Cancel</Button></div>
        </form>
      ) : null}
    </Surface>
  );
}

function emptyForm(canIssue: boolean): QualificationForm {
  const issueDate = new Date();
  const expiryDate = new Date(issueDate);
  expiryDate.setUTCFullYear(expiryDate.getUTCFullYear() + 1);
  return { level: "L6", issueDate: isoDay(issueDate), expiryDate: isoDay(expiryDate), status: canIssue ? "ACTIVE" : "PENDING", medicalClearance: false, fitnessStandard: false, trainingHours: "", examScore: "" };
}

function isoDay(value: Date) { return value.toISOString().slice(0, 10); }
function asUtcDate(value: string) { return `${value}T00:00:00.000Z`; }
function qualificationTitle(level: CertificationLevel) { return level === "L7" ? "L7 · Master Guardian Instructor" : "L6 · Guardian Instructor"; }
function certificationError(error: unknown) { return isApiError(error) ? error.message : "Instructor qualification could not be recorded. Review the certification inputs and try again."; }
function registryError(error: unknown) { return isApiError(error) ? error.message : "Instructor Registry Number could not be allocated. Confirm the active instructor qualification and try again."; }
