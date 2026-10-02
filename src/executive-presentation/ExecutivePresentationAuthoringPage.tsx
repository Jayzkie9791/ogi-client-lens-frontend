import { useCallback, useEffect, useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useBeforeUnload, useBlocker, useParams } from "react-router-dom";

import { isApiError } from "../api/errors";
import { routes } from "../app/routePaths";
import { useAuth } from "../auth/useAuth";
import { getExecutiveSummary } from "../executive-findings/executiveSummaryApi";
import { Button } from "../ui/components/Button";
import { Surface } from "../ui/components/Surface";
import { createExecutivePresentationDraft, readExecutivePresentationDraft, saveExecutivePresentationDraft } from "./executivePresentationApi";
import type { ExecutivePresentationContent, ExecutivePresentationRecommendation, ExecutivePresentationSection } from "./executivePresentationTypes";
import { validateForSave } from "./executivePresentationValidation";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function ExecutivePresentationAuthoringPage() {
  const { ariResultId = "" } = useParams();
  const auth = useAuth();
  const queryClient = useQueryClient();
  const canView = auth.canUsePermission("view_domain_assessment");
  const canAuthor = auth.canUsePermission("author_executive_presentation");
  const validId = uuidPattern.test(ariResultId);
  const summary = useQuery({ queryKey: ["executive-summary", ariResultId], queryFn: () => getExecutiveSummary(ariResultId), enabled: canView && validId, retry: false });
  const draft = useQuery({
    queryKey: ["executive-presentation-draft", ariResultId],
    queryFn: () => {
      const projection = summary.data;
      if (!projection) throw new Error("The exact ARI projection is unavailable.");
      return readExecutivePresentationDraft(projection);
    },
    enabled: Boolean(summary.data), retry: false
  });
  const [content, setContent] = useState<ExecutivePresentationContent | null>(null);
  const [savedContent, setSavedContent] = useState<ExecutivePresentationContent | null>(null);
  const [etag, setEtag] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [conflicted, setConflicted] = useState(false);
  const [integrityBlocked, setIntegrityBlocked] = useState(false);

  useEffect(() => {
    if (!draft.data) return;
    setContent(structuredClone(draft.data.envelope.draft.content));
    setSavedContent(structuredClone(draft.data.envelope.draft.content));
    setEtag(draft.data.etag);
    setConflicted(false);
    setIntegrityBlocked(false);
  }, [draft.data]);

  const dirty = Boolean(content && savedContent && JSON.stringify(content) !== JSON.stringify(savedContent));
  useBeforeUnload(useCallback((event) => { if (dirty) event.preventDefault(); }, [dirty]));
  const blocker = useBlocker(dirty);
  useEffect(() => {
    if (blocker.state !== "blocked") return;
    if (window.confirm("Leave Executive Presentation authoring and discard unsaved changes?")) blocker.proceed();
    else blocker.reset();
  }, [blocker]);

  const create = useMutation({
    mutationFn: () => {
      const projection = summary.data;
      if (!projection) throw new Error("The exact ARI projection is unavailable.");
      return createExecutivePresentationDraft(projection);
    },
    onSuccess: (result) => {
      queryClient.setQueryData(["executive-presentation-draft", ariResultId], result);
      setMessage(result.envelope.replayed ? "The existing working draft was recovered." : "Slides 4+ working draft created.");
    }
  });
  const save = useMutation({
    mutationFn: async () => {
      if (!summary.data || !content || !etag) throw new Error("The exact presentation context is unavailable.");
      const validation = validateForSave(content);
      if (validation) throw new ClientValidationError(validation);
      return saveExecutivePresentationDraft(summary.data, content, etag);
    },
    onSuccess: (result) => {
      queryClient.setQueryData(["executive-presentation-draft", ariResultId], result);
      setContent(structuredClone(result.envelope.draft.content));
      setSavedContent(structuredClone(result.envelope.draft.content));
      setEtag(result.etag);
      setConflicted(false);
      setIntegrityBlocked(false);
      setMessage(result.envelope.unchanged ? "Draft already matched the saved content." : `Draft saved as revision ${result.envelope.draft.revision}.`);
    },
    onError: (error) => {
      setMessage(null);
      if (isApiError(error) && error.status === 412) setConflicted(true);
      if (isApiError(error) && error.status === 409) setIntegrityBlocked(true);
    }
  });

  if (!canView) return <State title="Authoring unavailable">Your current session cannot view Domain Assessments.</State>;
  if (!validId) return <State title="Invalid ARI result">The authoring link does not contain a valid immutable ARI result identifier.</State>;
  if (summary.isLoading) return <State status title="Loading exact ARI context">Resolving the immutable ARI result.</State>;
  if (summary.isError || !summary.data) return <State title="ARI context unavailable">The exact immutable ARI result is absent, concealed, or inconsistent.</State>;
  if (draft.isLoading) return <State status title="Loading Slides 4+ draft">Checking for the exact ARI presentation draft.</State>;

  const missing = draft.isError && isApiError(draft.error) && draft.error.status === 404;
  if (missing) return <AuthoringShell summary={summary.data} dirty={false}>
    <Surface className="mx-auto max-w-3xl text-center">
      <h2 className="text-xl font-semibold text-primary-navy">No Slides 4+ draft exists</h2>
      <p className="mt-2 text-sm text-text-muted">Opening this page does not create presentation data. Start a working draft only when professional authoring is ready.</p>
      {canAuthor ? <Button className="mt-5" disabled={create.isPending} onClick={() => create.mutate()}>{create.isPending ? "Creating…" : "Start Slides 4+ draft"}</Button> : <p className="mt-5 text-sm font-semibold text-text-muted">You may view presentations but cannot create or edit professional content.</p>}
      {create.isError ? <ErrorMessage error={create.error} /> : null}
    </Surface>
  </AuthoringShell>;
  if (draft.isError || !content || !savedContent || !etag) return <State title="Draft unavailable">The working draft could not be loaded safely.</State>;
  const loadedDraft = draft.data;
  if (!loadedDraft) return <State title="Draft unavailable">The working draft could not be loaded safely.</State>;

  const reloadLatest = async () => {
    if (dirty && !window.confirm("Reload the latest saved draft and discard your unsaved copy?")) return;
    const result = await draft.refetch();
    if (result.data) {
      setContent(structuredClone(result.data.envelope.draft.content));
      setSavedContent(structuredClone(result.data.envelope.draft.content));
      setEtag(result.data.etag);
      setConflicted(false);
      setIntegrityBlocked(false);
      setMessage("Latest saved draft loaded.");
    }
  };

  return <AuthoringShell summary={summary.data} dirty={dirty}>
    {message ? <p className="rounded-component border border-green-300 bg-green-50 p-3 text-sm font-semibold text-green-800" role="status">{message}</p> : null}
    {conflicted ? <div className="rounded-component border border-amber-300 bg-amber-50 p-4" role="alert"><p className="font-semibold text-amber-950">This draft was updated in another session.</p><p className="mt-1 text-sm text-amber-900">Your unsaved copy is preserved. Reload the latest saved draft before reconciling and saving again.</p><Button className="mt-3" onClick={() => void reloadLatest()} variant="secondary">Reload latest draft</Button></div> : null}
    {save.isError && !conflicted ? <ErrorMessage error={save.error} /> : null}
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(22rem,.85fr)]">
      <Surface>
        <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-semibold text-primary-navy">Slides 4+ content</h2><p className="mt-1 text-sm text-text-muted">Professional-authored working content · revision {loadedDraft.envelope.draft.revision}</p></div><div className="flex gap-2"><Button disabled={!canAuthor || save.isPending || conflicted || integrityBlocked || !dirty} onClick={() => save.mutate()}>{save.isPending ? "Saving…" : "Save draft"}</Button></div></div>
        {!canAuthor ? <p className="mt-4 rounded-component bg-elevated p-3 text-sm">Read-only. Your account does not have Executive Presentation authoring authority.</p> : null}
        <ExecutivePresentationEditor content={content} disabled={!canAuthor || save.isPending || conflicted || integrityBlocked} onChange={(next) => { setMessage(null); setContent(next); }} />
      </Surface>
      <ExecutivePresentationPreview content={content} />
    </div>
  </AuthoringShell>;
}

function ExecutivePresentationEditor({ content, disabled, onChange }: { content: ExecutivePresentationContent; disabled: boolean; onChange: (content: ExecutivePresentationContent) => void }) {
  const updateSection = (index: number, section: ExecutivePresentationSection) => onChange({ ...content, sections: content.sections.map((item, itemIndex) => itemIndex === index ? section : item) });
  const moveSection = (index: number, offset: number) => onChange({ ...content, sections: move(content.sections, index, index + offset) });
  return <div className="mt-5 space-y-4">
    {content.sections.length === 0 ? <div className="rounded-component border border-dashed border-workspace-border p-6 text-center text-sm text-text-muted">No professional sections have been added.</div> : null}
    {content.sections.map((section, index) => <section className="rounded-component border border-workspace-border p-4" key={index}>
      <div className="flex items-center justify-between gap-2"><h3 className="font-semibold text-primary-navy">Section {index + 1}</h3><div className="flex gap-2"><MiniButton disabled={disabled || index === 0} onClick={() => moveSection(index, -1)}>Move up</MiniButton><MiniButton disabled={disabled || index === content.sections.length - 1} onClick={() => moveSection(index, 1)}>Move down</MiniButton><MiniButton disabled={disabled} onClick={() => onChange({ ...content, sections: content.sections.filter((_, itemIndex) => itemIndex !== index) })}>Remove</MiniButton></div></div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2"><TextField disabled={disabled} label="Heading" maxLength={160} value={section.heading} onChange={(heading) => updateSection(index, { ...section, heading })} /><TextField disabled={disabled} label="Classification (optional)" maxLength={100} value={section.classification ?? ""} onChange={(classification) => updateSection(index, { ...section, classification: classification || null })} /></div>
      <TextArea disabled={disabled} label="Scope" maxLength={500} value={section.scope} onChange={(scope) => updateSection(index, { ...section, scope })} />
      <StringItems disabled={disabled} label="Findings" values={section.findings} onChange={(findings) => updateSection(index, { ...section, findings })} />
      <RecommendationItems disabled={disabled} values={section.recommendations} onChange={(recommendations) => updateSection(index, { ...section, recommendations })} />
    </section>)}
    <Button disabled={disabled || content.sections.length >= 50} onClick={() => onChange({ ...content, sections: [...content.sections, { heading: "", scope: "", classification: null, findings: [], recommendations: [] }] })} variant="secondary">Add section</Button>
  </div>;
}

function StringItems({ label, values, disabled, onChange }: { label: string; values: string[]; disabled: boolean; onChange: (values: string[]) => void }) {
  return <fieldset className="mt-4"><legend className="text-sm font-semibold text-primary-navy">{label}</legend>{values.map((value, index) => <div className="mt-2 flex gap-2" key={index}><textarea aria-label={`${label} ${index + 1}`} className="min-h-20 flex-1 rounded-component border border-border p-2 text-sm" disabled={disabled} maxLength={2000} value={value} onChange={(event) => onChange(values.map((item, itemIndex) => itemIndex === index ? event.target.value : item))} /><ItemButtons disabled={disabled} index={index} length={values.length} moveItem={(offset) => onChange(move(values, index, index + offset))} remove={() => onChange(values.filter((_, itemIndex) => itemIndex !== index))} /></div>)}<Button className="mt-2" disabled={disabled || values.length >= 50} onClick={() => onChange([...values, ""])} variant="secondary">Add finding</Button></fieldset>;
}

function RecommendationItems({ values, disabled, onChange }: { values: ExecutivePresentationRecommendation[]; disabled: boolean; onChange: (values: ExecutivePresentationRecommendation[]) => void }) {
  return <fieldset className="mt-4"><legend className="text-sm font-semibold text-primary-navy">Recommendations and actions</legend>{values.map((value, index) => <div className="mt-2 grid gap-2 sm:grid-cols-[10rem_minmax(0,1fr)_auto]" key={index}><select aria-label={`Recommendation or action ${index + 1} kind`} className="rounded-component border border-border p-2 text-sm" disabled={disabled} value={value.kind} onChange={(event) => onChange(values.map((item, itemIndex) => itemIndex === index ? { ...item, kind: event.target.value as ExecutivePresentationRecommendation["kind"] } : item))}><option value="RECOMMENDATION">Recommendation</option><option value="ACTION">Action</option></select><textarea aria-label={`Recommendation or action ${index + 1}`} className="min-h-20 rounded-component border border-border p-2 text-sm" disabled={disabled} maxLength={2000} value={value.text} onChange={(event) => onChange(values.map((item, itemIndex) => itemIndex === index ? { ...item, text: event.target.value } : item))} /><ItemButtons disabled={disabled} index={index} length={values.length} moveItem={(offset) => onChange(move(values, index, index + offset))} remove={() => onChange(values.filter((_, itemIndex) => itemIndex !== index))} /></div>)}<Button className="mt-2" disabled={disabled || values.length >= 50} onClick={() => onChange([...values, { kind: "RECOMMENDATION", text: "" }])} variant="secondary">Add recommendation or action</Button></fieldset>;
}

function ItemButtons({ disabled, index, length, moveItem, remove }: { disabled: boolean; index: number; length: number; moveItem: (offset: number) => void; remove: () => void }) { return <div className="flex flex-col gap-1"><MiniButton disabled={disabled || index === 0} onClick={() => moveItem(-1)}>Up</MiniButton><MiniButton disabled={disabled || index === length - 1} onClick={() => moveItem(1)}>Down</MiniButton><MiniButton disabled={disabled} onClick={remove}>Remove</MiniButton></div>; }
function MiniButton({ children, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) { return <button className="rounded border border-border px-2 py-1 text-xs font-semibold text-primary-blue disabled:opacity-40" type="button" {...props}>{children}</button>; }
function TextField({ label, value, maxLength, disabled, onChange }: FieldProps) { return <label className="block text-sm font-semibold text-primary-navy">{label}<input aria-label={label} className="mt-1 w-full rounded-component border border-border p-2 font-normal" disabled={disabled} maxLength={maxLength} value={value} onChange={(event) => onChange(event.target.value)} /><span className="mt-1 block text-right text-xs font-normal text-text-muted">{value.length}/{maxLength}</span></label>; }
function TextArea({ label, value, maxLength, disabled, onChange }: FieldProps) { return <label className="mt-4 block text-sm font-semibold text-primary-navy">{label}<textarea aria-label={label} className="mt-1 min-h-24 w-full rounded-component border border-border p-2 font-normal" disabled={disabled} maxLength={maxLength} value={value} onChange={(event) => onChange(event.target.value)} /><span className="mt-1 block text-right text-xs font-normal text-text-muted">{value.length}/{maxLength}</span></label>; }
interface FieldProps { label: string; value: string; maxLength: number; disabled: boolean; onChange: (value: string) => void }

function ExecutivePresentationPreview({ content }: { content: ExecutivePresentationContent }) { return <Surface className="self-start xl:sticky xl:top-4"><p className="cl-data-label">Authoring preview</p><h2 className="mt-1 text-xl font-semibold text-primary-navy">Structured Slides 4+ content</h2><p className="mt-1 text-sm text-text-muted">Final slide numbering, pagination, and combined presentation rendering are not applied here.</p><div className="mt-4 space-y-3">{content.sections.length === 0 ? <p className="rounded-component bg-elevated p-4 text-sm text-text-muted">No authored sections yet.</p> : content.sections.map((section, index) => <article className="rounded-component border border-workspace-border p-4" key={index}><p className="text-xs font-semibold uppercase tracking-wide text-primary-blue">Section {index + 1}{section.classification ? ` · ${section.classification}` : ""}</p><h3 className="mt-1 font-semibold text-primary-navy">{section.heading || "Untitled section"}</h3><p className="mt-1 text-sm text-text-muted">{section.scope || "Scope not yet supplied"}</p>{section.findings.length ? <PreviewList title="Findings" items={section.findings} /> : null}{section.recommendations.length ? <PreviewList title="Recommendations and actions" items={section.recommendations.map((item) => `${item.kind === "ACTION" ? "Action" : "Recommendation"}: ${item.text}`)} /> : null}</article>)}</div></Surface>; }
function PreviewList({ title, items }: { title: string; items: string[] }) { return <div className="mt-3"><h4 className="text-sm font-semibold text-primary-navy">{title}</h4><ul className="mt-1 list-disc space-y-1 pl-5 text-sm">{items.map((item, index) => <li key={index}>{item || "Not yet supplied"}</li>)}</ul></div>; }

function AuthoringShell({ summary, dirty, children }: { summary: Awaited<ReturnType<typeof getExecutiveSummary>>; dirty: boolean; children: ReactNode }) { return <main className="min-h-screen bg-canvas p-4 sm:p-6"><header className="mx-auto mb-5 flex max-w-[100rem] flex-wrap items-start justify-between gap-4"><div><p className="cl-data-label">Executive Presentation · Slides 4+ Authoring</p><h1 className="mt-1 text-2xl font-semibold text-primary-navy">{summary.scope.facilityName}</h1><p className="mt-1 text-sm text-text-muted">{summary.scope.clientName} · ARI Version {summary.ari.resultVersion} · {summary.ari.value} {summary.ari.classification}</p><p className={`mt-2 text-sm font-semibold ${dirty ? "text-amber-800" : "text-green-700"}`}>{dirty ? "Unsaved changes" : "Saved working draft"}</p></div><div className="flex flex-wrap gap-2"><Button asChild variant="secondary"><Link to={routes.operationalRiskIndexPresentationPath(summary.ari.resultId)}>View Slides 1–3</Link></Button><Button asChild variant="secondary"><Link to={routes.facilityAssessmentJourneys}>Back to Assessment Journey</Link></Button></div></header><div className="mx-auto max-w-[100rem] space-y-4">{children}</div></main>; }
function State({ title, children, status = false }: { title: string; children: ReactNode; status?: boolean }) { return <main className="min-h-screen bg-canvas p-6"><Surface className="mx-auto max-w-2xl" role={status ? "status" : "alert"}><h1 className="text-xl font-semibold text-primary-navy">{title}</h1><p className="mt-2 text-sm text-text-muted">{children}</p><Button asChild className="mt-5" variant="secondary"><Link to={routes.facilityAssessmentJourneys}>Back to Assessment Journey</Link></Button></Surface></main>; }
function ErrorMessage({ error }: { error: unknown }) { let message = "The draft request failed. Your local edits have been retained."; if (error instanceof ClientValidationError) message = error.message; else if (isApiError(error) && error.status === 413) message = "The complete presentation exceeds the 1 MiB limit."; else if (isApiError(error) && error.status === 403) message = "Your session is not authorized to edit Executive Presentations."; else if (isApiError(error) && error.status === 409) message = "The persisted presentation authority is inconsistent. Saving has been stopped."; return <p className="mt-4 rounded-component border border-red-300 bg-red-50 p-3 text-sm font-semibold text-state-error" role="alert">{message}</p>; }
class ClientValidationError extends Error {}

function move<T>(items: T[], from: number, to: number): T[] { if (to < 0 || to >= items.length) return items; const next = [...items]; const [item] = next.splice(from, 1); next.splice(to, 0, item); return next; }
