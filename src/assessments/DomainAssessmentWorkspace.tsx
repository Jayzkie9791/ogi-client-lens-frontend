import { useEffect, useState } from "react";
import { Button } from "../ui/components/Button";
import { Link } from "react-router-dom";
import { routes } from "../app/routePaths";

import {
  approveDomainReview,
  bindDomainWorkforceSupport,
  bindDomainSource,
  createDomainAssessmentRevision,
  createDomainAssessmentSuccessor,
  determineDomainAssessment,
  DomainAssessmentWorkspaceRecord,
  DomainCandidate,
  DomainWorkforceSupport,
  listDomainCandidates,
  openDomainAssessment,
  readDomainAssessment,
  readDomainReviewContext,
  readDomainWorkforceSupport,
  requestDomainReview,
  resolveDomainApplicability,
  submitDomainAssessment,
  unbindDomainSource,
  returnDomainReview
} from "./domainAssessmentWorkspaceApi";

interface Props {
  readonly categoryCode: string;
  readonly categoryName: string;
  readonly facilityId: string;
  readonly onClose: () => void;
  readonly onFinalized: () => void;
}

export function DomainAssessmentWorkspace({ categoryCode, categoryName, facilityId, onClose, onFinalized }: Props) {
  const [assessment, setAssessment] = useState<DomainAssessmentWorkspaceRecord | null>(null);
  const [candidates, setCandidates] = useState<Record<string, readonly DomainCandidate[]>>({});
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [notApplicableRationale, setNotApplicableRationale] = useState<Record<string, string>>({});
  const [index, setIndex] = useState("");
  const [lmhc, setLmhc] = useState<"LOW" | "MODERATE" | "HIGH" | "CRITICAL">("LOW");
  const [synthesis, setSynthesis] = useState("");
  const [reviewId, setReviewId] = useState<string | null>(null);
  const [reviewSubjectId, setReviewSubjectId] = useState<string | null>(null);
  const [reviewRationale, setReviewRationale] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [workforceSupport,setWorkforceSupport]=useState<DomainWorkforceSupport|null>(null);

  useEffect(() => {
    let active = true;
    setBusy(true);
    openDomainAssessment(facilityId, categoryCode, categoryName)
      .then(async (value) => { if (!active) return; adopt(value); if (["TRAINING_COMPETENCY","LIFEGUARD_OPERATIONS"].includes(categoryCode)) { const support=await readDomainWorkforceSupport(value.id); if(active)setWorkforceSupport(support); } if (value.lifecycle === "SUBMITTED") { const context = await readDomainReviewContext(value.id); if (active) { setReviewSubjectId(context.subjectId); setReviewId(context.review?.decision ? null : context.review?.id ?? null); } } })
      .catch((cause) => { if (active) setError(message(cause)); })
      .finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [categoryCode, categoryName, facilityId]);

  function adopt(value: DomainAssessmentWorkspaceRecord) {
    setAssessment(value); setIndex(value.professionalDetermination.professionalCategoryIndex ?? ""); setLmhc((value.professionalDetermination.lmhc as typeof lmhc | null) ?? "LOW"); setSynthesis(value.professionalDetermination.synthesis ?? ""); setCandidates({}); setSelected({}); setReviewSubjectId(null); setReviewId(null); setReviewRationale(""); setWorkforceSupport(null);
  }

  async function act(action: () => Promise<DomainAssessmentWorkspaceRecord>) {
    setBusy(true); setError(null);
    try { const value = await action(); setAssessment(value); }
    catch (cause) {
      setError(message(cause));
      if (assessment) {
        try { setAssessment(await readDomainAssessment(assessment.id)); } catch { /* Preserve the actionable mutation error. */ }
      }
    } finally { setBusy(false); }
  }

  async function markApplicable(formCode: string) {
    setCandidates((current) => { const next = { ...current }; delete next[formCode]; return next; });
    setSelected((current) => { const next = { ...current }; delete next[formCode]; return next; });
    await act(() => resolveDomainApplicability(assessment!.id, formCode, { state: "APPLICABLE" }));
  }

  async function markNotApplicable(formCode: string) {
    const rationale = notApplicableRationale[formCode]?.trim();
    if (!rationale) { setError(`${formCode} requires a facility-specific not-applicable rationale.`); return; }
    setCandidates((current) => { const next = { ...current }; delete next[formCode]; return next; });
    setSelected((current) => { const next = { ...current }; delete next[formCode]; return next; });
    await act(() => resolveDomainApplicability(assessment!.id, formCode, { state: "NOT_APPLICABLE", reasonCode: "NOT_APPLICABLE_OTHER", rationale }));
  }

  async function loadCandidates(formCode: string) {
    if (!assessment) return;
    setBusy(true); setError(null);
    try { const result = await listDomainCandidates(assessment.id, formCode); setCandidates((current) => ({ ...current, [formCode]: result.candidates })); } catch (cause) { setError(message(cause)); } finally { setBusy(false); }
  }

  async function submit() {
    if (!assessment) return;
    setBusy(true); setError(null);
    try {
      const submitted = await submitDomainAssessment(assessment.id);
      setAssessment(submitted.assessment);
      setReviewSubjectId(submitted.reviewSubject.id);
      const requested = await requestDomainReview(submitted.reviewSubject.id);
      setReviewId(requested.review.id);
      window.localStorage.setItem(reviewStorageKey(assessment.id), requested.review.id);
    } catch (cause) { setError(message(cause)); } finally { setBusy(false); }
  }

  async function beginReview() {
    if (!reviewSubjectId) return;
    setBusy(true); setError(null);
    try { const requested = await requestDomainReview(reviewSubjectId); setReviewId(requested.review.id); }
    catch (cause) { setError(message(cause)); } finally { setBusy(false); }
  }

  async function approve() {
    if (!reviewId || !reviewRationale.trim()) return;
    setBusy(true); setError(null);
    try { await approveDomainReview(reviewId, reviewRationale.trim()); if (assessment) window.localStorage.removeItem(reviewStorageKey(assessment.id)); onFinalized(); } catch (cause) { setError(message(cause)); } finally { setBusy(false); }
  }

  async function returnForCorrection() {
    if (!reviewId || !reviewRationale.trim()) return;
    setBusy(true); setError(null);
    try { await returnDomainReview(reviewId, reviewRationale.trim()); const refreshed = await readDomainAssessment(assessment!.id); adopt(refreshed); }
    catch (cause) { setError(message(cause)); } finally { setBusy(false); }
  }

  async function beginSuccessor() {
    if (!assessment) return;
    setBusy(true); setError(null);
    try { adopt((await createDomainAssessmentSuccessor(assessment, categoryName)).assessment); }
    catch (cause) { setError(message(cause)); } finally { setBusy(false); }
  }

  async function beginRevision() {
    if (!assessment) return;
    setBusy(true); setError(null);
    try { adopt((await createDomainAssessmentRevision(assessment)).assessment); }
    catch (cause) { setError(message(cause)); } finally { setBusy(false); }
  }

  const editable = assessment?.lifecycle === "DRAFT";
  const readyToSubmit = Boolean(assessment
    && assessment.professionalDetermination.synthesis
    && (assessment.professionalDetermination.professionalCategoryIndex !== null || assessment.professionalDetermination.lmhc !== null)
    && assessment.applicability.every((item) => item.state !== "UNRESOLVED" && (item.state !== "APPLICABLE" || item.contributions.length > 0)));
  return <div aria-label={`${categoryName} Domain Assessment`} aria-modal="true" className="fixed inset-0 z-50 flex flex-col bg-workspace-canvas" role="dialog">
    <header className="flex items-center justify-between border-b border-workspace-border bg-surface px-6 py-4 shadow-sm"><div><p className="cl-data-label text-primary-blue">Facility-wide Domain Assessment</p><h2 className="text-xl font-semibold text-primary-navy">{categoryName}</h2></div><Button onClick={onClose} variant="secondary">← Back to Facility Assessment Journey</Button></header>
    <main className="flex-1 overflow-y-auto p-6"><div className="mx-auto max-w-6xl space-y-5">
      {busy && !assessment ? <p role="status">Opening governed assessment…</p> : null}
      {error ? <div className="rounded-component border border-state-error p-3 text-state-error" role="alert">{error}</div> : null}
      {assessment ? <>
        <section className="rounded-panel border border-primary-blue/30 border-l-4 border-l-primary-blue bg-blue-50 p-5"><div className="flex flex-wrap justify-between gap-3"><div><p className="text-lg font-semibold text-primary-navy">Assessment v{assessment.assessmentVersion}</p><span className="mt-1 inline-flex rounded-full border border-blue-300 bg-white px-3 py-1 text-xs font-bold uppercase tracking-wide text-primary-blue">{assessment.lifecycle}</span></div><div className="max-w-xl text-right"><p className="text-sm leading-6 text-text-muted">Select only evidence verified by the backend as eligible for this exact facility, category, and assessment cutoff.</p>{assessment.lifecycle === "FINAL" ? <Button className="mt-2" disabled={busy} onClick={() => void beginSuccessor()}>Start successor assessment</Button> : null}{assessment.lifecycle === "RETURNED" ? <Button className="mt-2" disabled={busy} onClick={() => void beginRevision()}>Create correction draft</Button> : null}</div></div></section>
        {workforceSupport?<section className="rounded-panel border border-teal-300 border-l-4 border-l-teal-600 bg-teal-50 p-5"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="cl-data-label text-teal-800">Facility workforce authority · supporting evidence</p><p className="mt-2 text-sm text-primary-navy">{workforceSupport.projection.counts.assignedPersonnel} assigned · {workforceSupport.projection.counts.activeCertification} actively certified · {workforceSupport.projection.counts.currentlyAuthorized} currently authorized · {workforceSupport.projection.counts.personnelWithGaps} with gaps</p><p className="mt-2 break-all text-xs text-text-muted">Cutoff {workforceSupport.evidenceCutoffAt} · checksum {workforceSupport.projection.checksum}</p></div>{workforceSupport.binding?<span className="rounded-full border border-teal-400 bg-white px-3 py-1 text-xs font-bold text-teal-800">Included in synthesis</span>:editable?<Button disabled={busy} onClick={()=>{setBusy(true);setError(null);bindDomainWorkforceSupport(assessment.id).then(setWorkforceSupport).catch((cause)=>setError(message(cause))).finally(()=>setBusy(false));}}>Include workforce snapshot</Button>:<span className="text-sm text-text-muted">Not included</span>}</div><div className="mt-4 border-t border-teal-200 pt-3"><p className="font-semibold text-primary-navy">F021 personnel coverage · {workforceSupport.personnelFormCompleteness.counts.eligible} of {workforceSupport.personnelFormCompleteness.counts.assignedPersonnel} eligible</p><ul className="mt-2 grid gap-2 md:grid-cols-3">{workforceSupport.personnelFormCompleteness.personnel.map((person)=><li className="rounded-component border border-teal-200 bg-white p-3" key={person.staffMemberId}><strong>{person.fullName}</strong><p className="mt-1 text-xs text-text-muted">{humanizeState(person.status)}</p>{person.eligibleEvidenceRecordId?<Link className="mt-2 block text-sm font-semibold text-primary-blue underline" to={routes.evidenceRecordPath(person.eligibleEvidenceRecordId)}>Eligible evidence</Link>:person.trainingEnrollmentId?<Link className="mt-2 block text-sm font-semibold text-primary-blue underline" to={routes.trainingJourneyPath(person.trainingEnrollmentId)}>Open training journey</Link>:<p className="mt-2 text-sm text-amber-800">Registration or enrollment required</p>}</li>)}</ul></div><p className="mt-3 text-xs text-text-muted">This factual snapshot informs professional judgment only. It does not calculate the category index or ORI.</p></section>:null}
        <section className="space-y-3">{assessment.applicability.map((item) => item.formCode ? <article className={`rounded-panel border bg-surface p-4 shadow-panel ${item.state === "APPLICABLE" ? "border-l-4 border-l-emerald-600" : item.state === "NOT_APPLICABLE" ? "border-l-4 border-l-amber-500" : "border-l-4 border-l-slate-400"}`} key={item.formCode}>
          <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-base font-bold text-primary-navy">{item.formCode}</h3><p className="mt-1 text-sm text-text-muted"><span className={`font-bold ${item.state === "APPLICABLE" ? "text-emerald-700" : item.state === "NOT_APPLICABLE" ? "text-amber-700" : "text-slate-600"}`}>{humanizeState(item.state)}</span> · {item.contributions.length} bound source{item.contributions.length === 1 ? "" : "s"}</p>{item.rationale ? <p className="mt-1 text-xs text-text-muted">{item.rationale}</p> : null}</div>{editable ? <div className="flex flex-wrap gap-2"><Button className="bg-emerald-700 text-white hover:bg-emerald-800 active:bg-emerald-900" disabled={busy || item.state === "APPLICABLE"} onClick={() => void markApplicable(item.formCode!)}>Mark applicable</Button><Button className="border-amber-600 bg-amber-50 text-amber-900 hover:bg-amber-100 active:bg-amber-200" disabled={busy || item.state === "NOT_APPLICABLE" || !notApplicableRationale[item.formCode!]?.trim()} onClick={() => void markNotApplicable(item.formCode!)} variant="secondary">Mark not applicable</Button><Button disabled={busy || item.state !== "APPLICABLE"} onClick={() => void loadCandidates(item.formCode!)} variant="secondary">Find eligible evidence</Button></div> : null}</div>
          {editable && item.state !== "APPLICABLE" ? <label className="mt-3 block text-sm font-semibold text-primary-navy">Not-applicable rationale<input className="mt-1 block min-h-10 w-full rounded-component border px-3 font-normal" onChange={(event) => setNotApplicableRationale((current) => ({ ...current, [item.formCode!]: event.target.value }))} placeholder="Explain why this form does not apply to this facility" value={notApplicableRationale[item.formCode] ?? item.rationale ?? ""} /></label> : null}
          {item.contributions.map((source) => <div className="mt-3 flex items-center justify-between rounded-component border border-emerald-200 bg-emerald-50 p-3 text-sm" key={source.sourceId}><span className="font-medium text-emerald-900">{source.sourceKind} · {source.sourceId}</span>{editable ? <Button className="border-red-600 bg-white text-red-700 hover:bg-red-50 active:bg-red-100" onClick={() => void act(() => unbindDomainSource(assessment.id, source.sourceId, source.sourceKind))} variant="secondary">Unbind</Button> : null}</div>)}
          {item.state === "APPLICABLE" && candidates[item.formCode] ? <div className="mt-3"><div className="flex gap-2"><select aria-label={`${item.formCode} eligible evidence`} className="min-h-10 flex-1 rounded-component border px-3" disabled={busy} onChange={(event) => setSelected((current) => ({ ...current, [item.formCode!]: event.target.value }))} value={selected[item.formCode] ?? ""}><option value="">Select eligible governed evidence</option>{candidates[item.formCode].filter((candidate) => !item.contributions.some((source) => source.sourceId === candidate.id)).map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.sourceKind} · {candidate.templateVersion ?? "assessment"} · {candidate.sourceAt ?? "no date"}</option>)}</select><Button className="min-w-24" disabled={busy || !selected[item.formCode]} onClick={() => { if (item.state !== "APPLICABLE") return; const candidate = candidates[item.formCode!].find((value) => value.id === selected[item.formCode!]); if (candidate) void act(() => bindDomainSource(assessment.id, candidate.id, candidate.sourceKind)); }}>Bind evidence</Button></div>{candidates[item.formCode].length === 0 ? <p className="mt-2 text-sm text-amber-800">No governed evidence is eligible at this assessment cutoff.</p> : null}</div> : null}
        </article> : null)}</section>
        {editable ? <section className="rounded-panel border border-border border-l-4 border-l-primary-blue bg-surface p-5"><h3 className="text-lg font-semibold text-primary-navy">Professional determination</h3><div className="mt-3 grid gap-3 md:grid-cols-2">{assessment.authority.professionalIndexContract === "PROFESSIONAL_CATEGORY_INDEX" ? <label className="text-sm font-semibold">Category index (0–100)<input className="mt-1 block min-h-10 w-full rounded-component border px-3" max="100" min="0" onChange={(event) => setIndex(event.target.value)} type="number" value={index} /></label> : <label className="text-sm font-semibold">LMHC<select className="mt-1 block min-h-10 w-full rounded-component border px-3" onChange={(event) => setLmhc(event.target.value as typeof lmhc)} value={lmhc}><option>LOW</option><option>MODERATE</option><option>HIGH</option><option>CRITICAL</option></select></label>}<label className="text-sm font-semibold md:col-span-2">Synthesis<textarea className="mt-1 block w-full rounded-component border p-3" onChange={(event) => setSynthesis(event.target.value)} rows={3} value={synthesis} /></label></div><div className="mt-4 flex flex-wrap gap-3"><Button disabled={busy || !synthesis.trim() || (assessment.authority.professionalIndexContract === "PROFESSIONAL_CATEGORY_INDEX" && !index)} onClick={() => void act(() => determineDomainAssessment(assessment.id, { ...(assessment.authority.professionalIndexContract === "PROFESSIONAL_CATEGORY_INDEX" ? { professionalCategoryIndex: index } : { lmhc }), synthesis: synthesis.trim() }))} variant="secondary">Save determination</Button><Button disabled={busy || !readyToSubmit} onClick={() => void submit()}>Submit for governed review</Button></div>{!readyToSubmit ? <p className="mt-3 text-sm font-medium text-amber-800">Resolve every member, bind evidence to each applicable member, and save the professional determination before submission.</p> : null}</section> : null}
        {assessment.lifecycle === "SUBMITTED" ? <section className="rounded-panel border border-emerald-300 border-l-4 border-l-emerald-600 bg-emerald-50 p-5"><h3 className="text-lg font-semibold text-emerald-900">Governance review</h3>{reviewId ? <><p className="mt-1 text-sm text-emerald-900">This submitted assessment and its active review were recovered from backend authority.</p><textarea aria-label="Review rationale" className="mt-3 w-full rounded-component border p-3" onChange={(event) => setReviewRationale(event.target.value)} placeholder="Record the governed review rationale" rows={3} value={reviewRationale} /><div className="mt-3 flex flex-wrap gap-3"><Button className="bg-emerald-700 text-white hover:bg-emerald-800 active:bg-emerald-900" disabled={busy || !reviewRationale.trim()} onClick={() => void approve()}>Approve category final</Button><Button disabled={busy || !reviewRationale.trim()} onClick={() => void returnForCorrection()} variant="secondary">Return for correction</Button></div></> : reviewSubjectId ? <><p className="mt-2 text-sm text-text-muted">The submitted snapshot is registered but its governed review has not started.</p><Button className="mt-3" disabled={busy} onClick={() => void beginReview()}>Start governed review</Button></> : <p className="mt-2 text-sm text-text-muted">Loading the governed review authority…</p>}</section> : null}
      </> : null}
    </div></main>
  </div>;
}

function message(error: unknown) { return error instanceof Error ? error.message : "The governed Domain Assessment action failed."; }
function reviewStorageKey(assessmentId: string) { return `client-lens:domain-assessment-review:${assessmentId}`; }
function humanizeState(value: string) { return value.toLowerCase().replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase()); }
