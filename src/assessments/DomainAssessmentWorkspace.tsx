import { useEffect, useState } from "react";
import { Button } from "../ui/components/Button";
import { Link } from "react-router-dom";
import { routes } from "../app/routePaths";
import { humanizeDisplaySentence } from "../ui/displayText";

import {
  approveDomainReview,
  bindDomainWorkforceSupport,
  bindDomainSource,
  createDomainAssessmentRevision,
  createDomainAssessmentSuccessor,
  determineDomainAssessment,
  deriveEmergencyDomainCandidate,
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
  const [derivationNotice, setDerivationNotice] = useState<Record<string, string>>({});
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
    setAssessment(value); setIndex(value.professionalDetermination.professionalCategoryIndex ?? ""); setLmhc((value.professionalDetermination.lmhc as typeof lmhc | null) ?? "LOW"); setSynthesis(value.professionalDetermination.synthesis ?? ""); setCandidates({}); setSelected({}); setDerivationNotice({}); setReviewSubjectId(null); setReviewId(null); setReviewRationale(""); setWorkforceSupport(null);
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
    const reasonCode = formCode === "F102" || formCode === "F109" ? "NOT_TRIGGERED" : "NOT_APPLICABLE_OTHER";
    await act(() => resolveDomainApplicability(assessment!.id, formCode, { state: "NOT_APPLICABLE", reasonCode, rationale }));
  }

  async function loadCandidates(formCode: string) {
    if (!assessment) return;
    setBusy(true); setError(null);
    try { const result = await listDomainCandidates(assessment.id, formCode); setCandidates((current) => ({ ...current, [formCode]: result.candidates })); } catch (cause) { setError(message(cause)); } finally { setBusy(false); }
  }

  async function deriveEmergencyCandidate(formCode: "F100" | "F104") {
    if (!assessment) return;
    setBusy(true); setError(null);
    try {
      const result = await deriveEmergencyDomainCandidate(assessment.id, formCode);
      setDerivationNotice((current) => ({ ...current, [formCode]: result.cutoffRefreshRequired
        ? `${formCode} governed assessment is prepared. It will become eligible after the assessment cutoff is refreshed.`
        : `${formCode} governed assessment is prepared and ready for eligibility refresh.` }));
      const refreshed = await listDomainCandidates(assessment.id, formCode);
      setCandidates((current) => ({ ...current, [formCode]: refreshed.candidates }));
    } catch (cause) { setError(message(cause)); } finally { setBusy(false); }
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
  const determinationState = assessment ? professionalDeterminationReadiness(assessment, index, lmhc, synthesis) : null;
  const readyToSubmit = Boolean(determinationState?.readyToSubmit);
  return <div aria-label={`${categoryName} Domain Assessment`} aria-modal="true" className="fixed inset-0 z-50 flex flex-col bg-workspace-canvas" role="dialog">
    <header className="flex items-center justify-between border-b border-workspace-border bg-surface px-6 py-4 shadow-sm"><div><p className="cl-data-label text-primary-blue">Facility-wide Domain Assessment</p><h2 className="text-xl font-semibold text-primary-navy">{categoryName}</h2></div><Button onClick={onClose} variant="secondary">← Back to Facility Assessment Journey</Button></header>
    <main className="flex-1 overflow-y-auto p-6"><div className="mx-auto max-w-6xl space-y-5">
      {busy && !assessment ? <p role="status">Opening governed assessment…</p> : null}
      {error ? <div className="rounded-component border border-state-error p-3 text-state-error" role="alert">{error}</div> : null}
      {assessment ? <>
        <section className="rounded-panel border border-primary-blue/30 border-l-4 border-l-primary-blue bg-blue-50 p-5"><div className="flex flex-wrap justify-between gap-3"><div><p className="text-lg font-semibold text-primary-navy">Assessment v{assessment.assessmentVersion}</p><span className="mt-1 inline-flex rounded-full border border-blue-300 bg-white px-3 py-1 text-xs font-bold uppercase tracking-wide text-primary-blue">{assessment.lifecycle}</span>{assessment.period ? <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2"><div><dt className="font-semibold text-primary-navy">Assessment period</dt><dd className="mt-1 text-text-muted">{formatAssessmentDateTime(assessment.period.start)} through {formatAssessmentDateTime(assessment.period.end)}</dd></div><div><dt className="font-semibold text-primary-navy">Evidence cutoff</dt><dd className="mt-1 text-text-muted">{formatAssessmentDateTime(assessment.period.evidenceCutoffAt)}</dd></div></dl> : null}</div><div className="max-w-xl text-right"><p className="text-sm leading-6 text-text-muted">Select only evidence verified by the backend as eligible for this exact facility, category, and assessment cutoff.</p>{assessment.period ? <p className="mt-2 rounded-component border border-amber-300 bg-amber-50 p-3 text-left text-sm font-medium text-amber-900">Applicability decisions must cover this complete persisted period, including continuing conditions that began earlier.</p> : null}{assessment.lifecycle === "FINAL" ? <Button className="mt-2" disabled={busy} onClick={() => void beginSuccessor()}>Start successor assessment</Button> : null}{assessment.lifecycle === "RETURNED" ? <Button className="mt-2" disabled={busy} onClick={() => void beginRevision()}>Create correction draft</Button> : null}</div></div></section>
        {workforceSupport?<section className="rounded-panel border border-teal-300 border-l-4 border-l-teal-600 bg-teal-50 p-5"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="cl-data-label text-teal-800">Facility workforce authority · supporting evidence</p><p className="mt-2 text-sm text-primary-navy">{workforceSupport.projection.counts.assignedPersonnel} assigned · {workforceSupport.projection.counts.activeCertification} actively certified · {workforceSupport.projection.counts.currentlyAuthorized} currently authorized · {workforceSupport.projection.counts.personnelWithGaps} with gaps</p><p className="mt-2 text-xs text-text-muted">Evidence cutoff {formatAssessmentDateTime(workforceSupport.evidenceCutoffAt)}</p></div>{workforceSupport.binding?<span className="rounded-full border border-teal-400 bg-white px-3 py-1 text-xs font-bold text-teal-800">Included in synthesis</span>:editable?<Button disabled={busy} onClick={()=>{setBusy(true);setError(null);bindDomainWorkforceSupport(assessment.id).then(setWorkforceSupport).catch((cause)=>setError(message(cause))).finally(()=>setBusy(false));}}>Include workforce snapshot</Button>:<span className="text-sm text-text-muted">Not included</span>}</div><details className="mt-3 text-xs text-text-muted"><summary className="w-fit cursor-pointer font-semibold">Technical evidence provenance</summary><p className="mt-2 break-all">Exact cutoff: {workforceSupport.evidenceCutoffAt??"Not recorded"}</p><p className="break-all">Projection checksum: {workforceSupport.projection.checksum}</p></details><div className="mt-4 border-t border-teal-200 pt-3"><p className="font-semibold text-primary-navy">F021 personnel coverage · {workforceSupport.personnelFormCompleteness.counts.eligible} of {workforceSupport.personnelFormCompleteness.counts.assignedPersonnel} eligible</p><ul className="mt-2 grid gap-2 md:grid-cols-3">{workforceSupport.personnelFormCompleteness.personnel.map((person)=><li className="rounded-component border border-teal-200 bg-white p-3" key={person.staffMemberId}><strong>{person.fullName}</strong><p className="mt-1 text-xs text-text-muted">{humanizeState(person.status)}</p>{person.eligibleEvidenceRecordId?<Link className="mt-2 block text-sm font-semibold text-primary-blue underline" to={routes.evidenceRecordPath(person.eligibleEvidenceRecordId)}>Eligible evidence</Link>:person.trainingEnrollmentId?<Link className="mt-2 block text-sm font-semibold text-primary-blue underline" to={routes.trainingJourneyPath(person.trainingEnrollmentId)}>Open training journey</Link>:<p className="mt-2 text-sm text-amber-800">Registration or enrollment required</p>}</li>)}</ul></div><p className="mt-3 text-xs text-text-muted">This factual snapshot informs professional judgment only. It does not calculate the category index or ARI.</p></section>:null}
        <section className="space-y-3">{assessment.applicability.map((item) => item.formCode ? <article className={`rounded-panel border bg-surface p-4 shadow-panel ${item.state === "APPLICABLE" ? "border-l-4 border-l-emerald-600" : item.state === "NOT_APPLICABLE" ? "border-l-4 border-l-amber-500" : "border-l-4 border-l-slate-400"}`} key={item.formCode}>
          <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-base font-bold text-primary-navy">{item.formCode}</h3><p className="mt-1 text-sm text-text-muted"><span className={`font-bold ${item.state === "APPLICABLE" ? "text-emerald-700" : item.state === "NOT_APPLICABLE" ? "text-amber-700" : "text-slate-600"}`}>{humanizeState(item.state)}</span> · {item.contributions.length} bound source{item.contributions.length === 1 ? "" : "s"}</p>{item.rationale ? <p className="mt-1 text-xs text-text-muted">{item.rationale}</p> : null}</div>{editable ? <div className="flex flex-wrap gap-2"><Button className="bg-emerald-700 text-white hover:bg-emerald-800 active:bg-emerald-900" disabled={busy || item.state === "APPLICABLE"} onClick={() => void markApplicable(item.formCode!)}>Mark applicable</Button><Button className="border-amber-600 bg-amber-50 text-amber-900 hover:bg-amber-100 active:bg-amber-200" disabled={busy || item.state === "NOT_APPLICABLE" || !(notApplicableRationale[item.formCode!] ?? item.rationale ?? "").trim()} onClick={() => void markNotApplicable(item.formCode!)} variant="secondary">Mark not applicable</Button><Button disabled={busy || item.state !== "APPLICABLE"} onClick={() => void loadCandidates(item.formCode!)} variant="secondary">Find eligible evidence</Button></div> : null}</div>
          {editable && item.state !== "NOT_APPLICABLE" ? <label className="mt-3 block text-sm font-semibold text-primary-navy">Not-applicable rationale<input className="mt-1 block min-h-10 w-full rounded-component border px-3 font-normal" onChange={(event) => setNotApplicableRationale((current) => ({ ...current, [item.formCode!]: event.target.value }))} placeholder="Explain why this form does not apply to this facility" value={notApplicableRationale[item.formCode] ?? item.rationale ?? ""} /></label> : null}
          {item.contributions.map((source,index) => {
            const presentation = describeBoundDomainEvidence(item.formCode!, source);
            return <div className="mt-3 rounded-component border border-emerald-200 bg-emerald-50 p-3 text-sm" key={source.sourceId}><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold text-emerald-900">{item.formCode} · Bound governed evidence {index + 1}</p><p className="mt-1 text-text-muted">{presentation.summary}</p><p className="mt-1 text-xs text-text-muted">Evidence reference {presentation.reference}</p>{source.sourceKind === "OPERATIONAL_EVIDENCE" ? <Link className="mt-2 inline-block font-semibold text-primary-blue underline" to={routes.evidenceRecordPath(source.sourceId)}>View bound evidence</Link> : null}</div>{editable ? <Button className="border-red-600 bg-white text-red-700 hover:bg-red-50 active:bg-red-100" onClick={() => void act(() => unbindDomainSource(assessment.id, source.sourceId, source.sourceKind))} variant="secondary">Unbind</Button> : null}</div></div>;
          })}
          {derivationNotice[item.formCode] ? <p className="mt-3 rounded-component border border-blue-300 bg-blue-50 p-3 text-sm font-medium text-primary-navy" role="status">{derivationNotice[item.formCode]}</p> : null}
          {item.state === "APPLICABLE" && candidates[item.formCode] ? <EligibleEvidenceChoices busy={busy} candidates={candidates[item.formCode]} formCode={item.formCode} onBind={(candidate) => void act(() => bindDomainSource(assessment.id, candidate.id, candidate.sourceKind))} onDerive={categoryCode === "EMERGENCY_PREPAREDNESS" && (item.formCode === "F100" || item.formCode === "F104") ? () => void deriveEmergencyCandidate(item.formCode as "F100" | "F104") : undefined} onSelect={(candidateId) => setSelected((current) => ({ ...current, [item.formCode!]: candidateId }))} selectedId={selected[item.formCode] ?? ""} unavailableIds={item.contributions.map((source) => source.sourceId)} /> : null}
        </article> : null)}</section>
        {editable && determinationState ? <section className="rounded-panel border border-border border-l-4 border-l-primary-blue bg-surface p-5"><h3 className="text-lg font-semibold text-primary-navy">Professional determination</h3><p className="mt-1 text-sm leading-6 text-text-muted">Use professional judgment after reviewing the bound evidence. A higher category index means stronger performance and lower aquatic risk; Client Lens does not calculate or recommend the score.</p>{assessment.authority.professionalIndexContract === "PROFESSIONAL_CATEGORY_INDEX" ? <><div aria-label="Category index guidance" className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{professionalIndexBands.map((band) => <div className={`rounded-component border p-3 ${determinationState.preview?.classification === band.classification ? band.activeClassName : "border-workspace-border bg-elevated"}`} key={band.classification}><p className="font-bold text-primary-navy">{band.range} · {humanizeState(band.classification)}</p><p className="mt-1 text-xs leading-5 text-text-muted">{band.guidance}</p></div>)}</div><label className="mt-4 block text-sm font-semibold" htmlFor="professional-category-index">Category index (0–100)<span className="mt-1 block text-xs font-normal text-text-muted">Choose the exact value supported by your professional review. The bands guide judgment; they do not generate the score.</span></label><input aria-describedby="professional-index-preview" className="mt-1 block min-h-10 w-full rounded-component border px-3 md:max-w-xl" id="professional-category-index" max="100" min="0" onChange={(event) => setIndex(event.target.value)} step="any" type="number" value={index} />{determinationState.preview ? <p className={`mt-2 text-sm font-semibold ${determinationState.preview.valid ? "text-primary-navy" : "text-state-error"}`} id="professional-index-preview" role="status">{determinationState.preview.valid ? <>Proposed index <strong>{determinationState.preview.normalized}</strong> · derived aquatic risk classification <strong>{humanizeState(determinationState.preview.classification!)}</strong></> : determinationState.preview.message}</p> : <p className="mt-2 text-sm text-text-muted" id="professional-index-preview">Enter an index to preview its backend-governed aquatic risk classification.</p>}</> : <label className="mt-4 block text-sm font-semibold">Aquatic risk classification<select className="mt-1 block min-h-10 w-full rounded-component border px-3 md:max-w-xl" onChange={(event) => setLmhc(event.target.value as typeof lmhc)} value={lmhc}><option>LOW</option><option>MODERATE</option><option>HIGH</option><option>CRITICAL</option></select></label>}<label className="mt-4 block text-sm font-semibold" htmlFor="professional-synthesis">Evidence synthesis<span className="mt-1 block text-xs font-normal leading-5 text-text-muted">Explain how the bound evidence supports the selected index. Summarize the evidence reviewed, strengths, material gaps, corrective actions or monitoring required, and your overall conclusion.</span></label><textarea className="mt-1 block w-full rounded-component border p-3" id="professional-synthesis" onChange={(event) => setSynthesis(event.target.value)} placeholder="Evidence reviewed: …\nStrengths: …\nGaps or concerns: …\nRequired actions or monitoring: …\nOverall conclusion and reason for the selected index: …" rows={7} value={synthesis} /><div className="mt-4 rounded-component border border-workspace-border bg-elevated p-3"><p className="font-semibold text-primary-navy">Submission readiness</p><ul className="mt-2 space-y-1 text-sm">{determinationState.checks.map((check) => <li className={check.complete ? "text-emerald-800" : "text-amber-800"} key={check.label}>{check.complete ? "✓" : "○"} {check.label}</li>)}</ul></div><div className="mt-4 flex flex-wrap gap-3"><Button disabled={busy || !determinationState.canSave} onClick={() => void act(() => determineDomainAssessment(assessment.id, { ...(assessment.authority.professionalIndexContract === "PROFESSIONAL_CATEGORY_INDEX" ? { professionalCategoryIndex: index } : { lmhc }), synthesis: synthesis.trim() }))} variant="secondary">Save determination</Button><Button disabled={busy || !readyToSubmit} onClick={() => void submit()}>Submit for governed review</Button></div>{determinationState.readyToSubmit ? <p className="mt-3 text-sm font-semibold text-emerald-800">Ready to submit for governed review.</p> : determinationState.determinationSaved ? <p className="mt-3 text-sm font-medium text-amber-800">Resolve the remaining evidence requirements before submission.</p> : determinationState.canSave ? <p className="mt-3 text-sm font-medium text-amber-800">Save the professional determination to enable submission.</p> : <p className="mt-3 text-sm font-medium text-amber-800">Complete the category index and evidence synthesis before saving.</p>}</section> : null}
        {assessment.lifecycle === "SUBMITTED" ? <section className="rounded-panel border border-emerald-300 border-l-4 border-l-emerald-600 bg-emerald-50 p-5"><h3 className="text-lg font-semibold text-emerald-900">Governance review</h3>{reviewId ? <><p className="mt-1 text-sm text-emerald-900">This submitted assessment and its active review were recovered from backend authority.</p><textarea aria-label="Review rationale" className="mt-3 w-full rounded-component border p-3" onChange={(event) => setReviewRationale(event.target.value)} placeholder="Record the governed review rationale" rows={3} value={reviewRationale} /><div className="mt-3 flex flex-wrap gap-3"><Button className="bg-emerald-700 text-white hover:bg-emerald-800 active:bg-emerald-900" disabled={busy || !reviewRationale.trim()} onClick={() => void approve()}>Approve category final</Button><Button disabled={busy || !reviewRationale.trim()} onClick={() => void returnForCorrection()} variant="secondary">Return for correction</Button></div></> : reviewSubjectId ? <><p className="mt-2 text-sm text-text-muted">The submitted snapshot is registered but its governed review has not started.</p><Button className="mt-3" disabled={busy} onClick={() => void beginReview()}>Start governed review</Button></> : <p className="mt-2 text-sm text-text-muted">Loading the governed review authority…</p>}</section> : null}
      </> : null}
    </div></main>
  </div>;
}

interface EligibleEvidenceChoicesProps {
  readonly busy: boolean;
  readonly candidates: readonly DomainCandidate[];
  readonly formCode: string;
  readonly selectedId: string;
  readonly unavailableIds: readonly string[];
  readonly onSelect: (candidateId: string) => void;
  readonly onBind: (candidate: DomainCandidate) => void;
  readonly onDerive?: () => void;
}

export function EligibleEvidenceChoices({ busy, candidates, formCode, selectedId, unavailableIds, onSelect, onBind, onDerive }: EligibleEvidenceChoicesProps) {
  const available = candidates.filter((candidate) => !unavailableIds.includes(candidate.id));
  const selectedCandidate = available.find((candidate) => candidate.id === selectedId);
  return <fieldset className="mt-3 rounded-component border border-blue-200 bg-blue-50/50 p-3">
    <legend className="px-1 text-sm font-semibold text-primary-navy">Eligible governed evidence for {formCode}</legend>
    {available.length ? <div className="space-y-2">{available.map((candidate) => {
      const presentation = describeDomainCandidate(formCode, candidate);
      return <div className={`rounded-component border bg-white p-3 ${selectedId === candidate.id ? "border-primary-blue ring-2 ring-primary-blue/20" : "border-workspace-border"}`} key={candidate.id}>
        <div className="flex items-start gap-3"><input aria-label={`Select ${presentation.heading} ${presentation.reference}`} checked={selectedId === candidate.id} className="mt-1 h-4 w-4" disabled={busy} name={`${formCode}-eligible-evidence`} onChange={() => onSelect(candidate.id)} type="radio" value={candidate.id} /><div className="min-w-0 flex-1"><p className="font-semibold text-primary-navy">{presentation.heading}</p>{presentation.context ? <p className="mt-1 text-sm text-primary-navy">{presentation.context}</p> : null}<p className="mt-1 text-sm text-text-muted">{presentation.summary}</p><p className="mt-1 text-xs text-text-muted">Evidence reference {presentation.reference}</p>{candidate.sourceKind === "OPERATIONAL_EVIDENCE" ? <Link className="mt-2 inline-block text-sm font-semibold text-primary-blue underline" to={routes.evidenceRecordPath(candidate.id)}>View evidence before binding</Link> : null}</div></div>
      </div>;
    })}</div> : <div><p className="text-sm text-amber-800">{candidates.length === 0 ? "No governed evidence is eligible at this assessment cutoff." : "All eligible evidence is already bound."}</p>{candidates.length === 0 && onDerive ? <Button className="mt-3" disabled={busy} onClick={onDerive} variant="secondary">Prepare governed {formCode} assessment</Button> : null}</div>}
    <div className="mt-3 flex items-center justify-between gap-3"><p className="text-xs text-text-muted">Select the exact record above, review it if needed, then bind it to this category member.</p><Button className="min-w-36" disabled={busy || !selectedCandidate} onClick={() => { if (selectedCandidate) onBind(selectedCandidate); }}>Bind selected evidence</Button></div>
  </fieldset>;
}

function message(error: unknown) { return error instanceof Error ? error.message : "The governed Domain Assessment action failed."; }
function reviewStorageKey(assessmentId: string) { return `client-lens:domain-assessment-review:${assessmentId}`; }
function humanizeState(value: string) { return humanizeDisplaySentence(value); }
export function shortEvidenceReference(value: string) { return value.length <= 8 ? value : `…${value.slice(-8)}`; }
export function describeDomainCandidate(formCode: string, candidate: DomainCandidate) {
  const lifecycle = candidate.lifecycleState ? humanizeState(candidate.lifecycleState) : humanizeState(candidate.sourceKind);
  const version = candidate.templateVersion ? `Template v${candidate.templateVersion}` : candidate.assessmentVersion ? `Assessment v${candidate.assessmentVersion}` : "Version unavailable";
  const subject = candidate.subjectKind && candidate.subjectKey ? ` · ${humanizeState(candidate.subjectKind)} ${candidate.subjectKey}` : "";
  const presentation=candidate.presentation;
  const timestampLabel=presentation?.timestamp.label??(candidate.sourceKind==="EMERGENCY_FORM_ASSESSMENT"?"Finalized":"Submitted");
  const timestampValue=presentation?.timestamp.value??candidate.sourceAt;
  return { heading: presentation?.primaryLabel??`${formCode} governed evidence`, context:presentation?.secondaryLabel??null,
    summary: `${lifecycle} · ${version} · ${timestampLabel} ${formatAssessmentDateTime(timestampValue)}${subject}`,
    reference: shortEvidenceReference(presentation?.contextReference??candidate.id) };
}
export function describeBoundDomainEvidence(formCode: string, source: DomainAssessmentWorkspaceRecord["applicability"][number]["contributions"][number]) {
  return describeDomainCandidate(formCode, { id: source.sourceId, sourceKind: source.sourceKind, sourceAt: source.sourceAt, templateVersion: source.templateVersion, lifecycleState: source.lifecycleState, assessmentVersion: source.assessmentVersion, subjectKind: source.subjectKind, subjectKey: source.subjectKey, presentation:source.presentation });
}
export const professionalIndexBands = Object.freeze([
  { classification: "LOW", range: "80–100", guidance: "Controls are generally strong and effective; aquatic risk is low.", activeClassName: "border-emerald-500 bg-emerald-50" },
  { classification: "MODERATE", range: "70–<80", guidance: "Controls are generally adequate, with material improvements needed.", activeClassName: "border-amber-400 bg-amber-50" },
  { classification: "HIGH", range: "60–<70", guidance: "Significant weaknesses require corrective action.", activeClassName: "border-orange-500 bg-orange-50" },
  { classification: "CRITICAL", range: "0–<60", guidance: "Serious or systemic control failures require urgent action.", activeClassName: "border-red-500 bg-red-50" }
] as const);

const professionalCategoryIndexPattern = /^(?:100(?:\.0{1,24})?|(?:[0-9]|[1-9][0-9])(?:\.[0-9]{1,24})?)$/;

export function previewProfessionalCategoryIndex(value: string) {
  const candidate = value.trim();
  if (!candidate) return null;
  if (!professionalCategoryIndexPattern.test(candidate)) return { valid: false as const, normalized: candidate, classification: null, message: "Enter a category index from 0 to 100, using no more than 24 decimal places." };
  const [whole, fraction] = candidate.split(".");
  const significantFraction = fraction?.replace(/0+$/, "") ?? "";
  const normalized = significantFraction ? `${whole}.${significantFraction}` : whole;
  const wholeNumber = Number(whole);
  const classification = wholeNumber < 60 ? "CRITICAL" : wholeNumber < 70 ? "HIGH" : wholeNumber < 80 ? "MODERATE" : "LOW";
  return { valid: true as const, normalized, classification, message: null };
}

export function professionalDeterminationReadiness(assessment: DomainAssessmentWorkspaceRecord, index: string, lmhc: "LOW" | "MODERATE" | "HIGH" | "CRITICAL", synthesis: string) {
  const resolvedCount = assessment.applicability.filter((item) => item.state !== "UNRESOLVED").length;
  const applicable = assessment.applicability.filter((item) => item.state === "APPLICABLE");
  const boundApplicableCount = applicable.filter((item) => item.contributions.length > 0).length;
  const allMembersResolved = resolvedCount === assessment.applicability.length;
  const allApplicableMembersBound = boundApplicableCount === applicable.length;
  const preview = assessment.authority.professionalIndexContract === "PROFESSIONAL_CATEGORY_INDEX" ? previewProfessionalCategoryIndex(index) : null;
  const determinationEntered = assessment.authority.professionalIndexContract === "PROFESSIONAL_CATEGORY_INDEX" ? preview?.valid === true : Boolean(lmhc);
  const canSave = determinationEntered && Boolean(synthesis.trim());
  const persistedValueMatches = assessment.authority.professionalIndexContract === "PROFESSIONAL_CATEGORY_INDEX"
    ? preview?.valid === true && assessment.professionalDetermination.professionalCategoryIndex !== null && previewProfessionalCategoryIndex(assessment.professionalDetermination.professionalCategoryIndex)?.normalized === preview.normalized
    : assessment.professionalDetermination.lmhc === lmhc;
  const determinationSaved = Boolean(canSave && persistedValueMatches && assessment.professionalDetermination.synthesis === synthesis.trim());
  const checks = [
    { complete: allMembersResolved, label: `${resolvedCount} of ${assessment.applicability.length} category members resolved` },
    { complete: allApplicableMembersBound, label: `${boundApplicableCount} of ${applicable.length} applicable members have bound evidence` },
    { complete: determinationEntered, label: assessment.authority.professionalIndexContract === "PROFESSIONAL_CATEGORY_INDEX" ? "Valid category index entered" : "Aquatic risk classification selected" },
    { complete: Boolean(synthesis.trim()), label: "Evidence synthesis entered" },
    { complete: determinationSaved, label: determinationSaved ? "Professional determination saved" : canSave ? "Professional determination has unsaved changes" : "Professional determination not yet saved" }
  ];
  return { preview, canSave, determinationSaved, checks, readyToSubmit: allMembersResolved && allApplicableMembersBound && determinationSaved };
}
export function formatAssessmentDateTime(value: string | null | undefined) {
  if (!value) return "Date unavailable";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Date unavailable" : new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium", timeStyle: "short"
  }).format(date);
}
