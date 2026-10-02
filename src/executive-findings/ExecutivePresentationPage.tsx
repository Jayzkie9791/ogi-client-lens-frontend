import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";

import { isApiError } from "../api/errors";
import { routes } from "../app/routePaths";
import { useAuth } from "../auth/useAuth";
import { Button } from "../ui/components/Button";
import { readExecutivePresentationDraft } from "../executive-presentation/executivePresentationApi";
import {
  createCanonicalGeometryMeasurer,
  paginateProfessionalCards,
  type AuthoredPresentationPage,
  type PresentationCardPiece
} from "../executive-presentation/executivePresentationPagination";
import {
  getExecutiveSummary,
  type ExecutiveSummaryCategory,
  type ExecutiveSummaryClassification,
  type ExecutiveSummaryProjection
} from "./executiveSummaryApi";
import { formatContribution, formatWeight } from "./executivePresentationFormatting";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function ExecutivePresentationPage() {
  const { ariResultId = "" } = useParams();
  const auth = useAuth();
  const authorized = auth.canUsePermission("view_domain_assessment");
  const validId = uuidPattern.test(ariResultId);
  const query = useQuery({
    queryKey: ["executive-summary", ariResultId],
    queryFn: () => getExecutiveSummary(ariResultId),
    enabled: authorized && validId,
    retry: false
  });
  const draft = useQuery({
    queryKey: ["executive-presentation-draft", ariResultId],
    queryFn: () => {
      const projection = query.data;
      if (!projection) throw new Error("The exact immutable ARI projection is unavailable.");
      return readExecutivePresentationDraft(projection);
    },
    enabled: authorized && validId && Boolean(query.data),
    retry: false
  });
  const [professionalPages, setProfessionalPages] = useState<readonly AuthoredPresentationPage[] | null>(null);

  useEffect(() => {
    if (!query.data) { setProfessionalPages(null); return; }
    if (draft.isError && isApiError(draft.error) && draft.error.status === 404) { setProfessionalPages([]); return; }
    if (!draft.data) { setProfessionalPages(null); return; }
    const savedDraft = draft.data.envelope.draft;
    if (savedDraft.ariResultId !== query.data.ari.resultId || savedDraft.schemaVersion !== "1.0" || savedDraft.lifecycle !== "WORKING_DRAFT") {
      setProfessionalPages(null);
      return;
    }
    let cancelled = false;
    const paginate = async () => {
      if (document.fonts?.ready) await document.fonts.ready;
      if (!cancelled) setProfessionalPages(paginateProfessionalCards(savedDraft.content.sections, createCanonicalGeometryMeasurer()));
    };
    void paginate();
    return () => { cancelled = true; };
  }, [draft.data, draft.error, draft.isError, query.data]);

  if (!authorized) return <PresentationState title="Presentation unavailable" message="Your current session does not include Domain Assessment viewing authority." />;
  if (!validId) return <PresentationState title="Invalid ARI result" message="The presentation link does not contain a valid immutable ARI result identifier." />;
  if (query.isLoading) return <PresentationState status title="Loading executive presentation" message="Loading the exact immutable ARI projection…" />;
  if (query.isError) return <PresentationError error={query.error} retry={() => void query.refetch()} />;
  if (!query.data) return <PresentationState title="Presentation unavailable" message="The exact ARI projection could not be loaded." />;
  if (draft.isLoading || (!draft.isError && draft.data && professionalPages === null)) return <PresentationState status title="Loading executive presentation" message="Composing the saved professional presentation content…" />;
  if (draft.isError && !(isApiError(draft.error) && draft.error.status === 404)) return <PresentationState title="Professional content unavailable" message="The saved Slides 4+ content could not be loaded safely. The presentation was not shown as an incomplete deck." action={<Button onClick={() => void draft.refetch()}>Try again</Button>} />;
  if (draft.data && (draft.data.envelope.draft.ariResultId !== query.data.ari.resultId || draft.data.envelope.draft.schemaVersion !== "1.0" || draft.data.envelope.draft.lifecycle !== "WORKING_DRAFT")) return <PresentationState title="Presentation integrity check failed" message="The professional content does not belong to this exact immutable ARI result." />;

  const slides: readonly PresentationSlide[] = [
    { key: "summary", title: "Executive Summary", render: (active, number, total) => <ExecutiveSummarySlide active={active} number={number} projection={query.data} total={total} /> },
    { key: "composition", title: "ARI Composition", render: (active, number, total) => <AriCompositionSlide active={active} number={number} projection={query.data} total={total} /> },
    { key: "categories", title: "Governed Category Indices", render: (active, number, total) => <CategoryIndicesSlide active={active} number={number} projection={query.data} total={total} /> },
    ...(professionalPages ?? []).map((page) => ({
      key: page.key,
      title: "Professional Findings & Actions",
      render: (active: boolean, number: number, total: number) => <ProfessionalContentSlide active={active} number={number} page={page} projection={query.data} total={total} />
    }))
  ];

  return <PresentationCarousel slides={slides} projection={query.data} />;
}

interface PresentationSlide {
  readonly key: string;
  readonly title: string;
  readonly render: (active: boolean, number: number, total: number) => ReactNode;
}

function PresentationCarousel({ slides, projection }: { readonly slides: readonly PresentationSlide[]; readonly projection: ExecutiveSummaryProjection }) {
  const [slide, setSlide] = useState(0);
  const [fullscreen, setFullscreen] = useState(Boolean(document.fullscreenElement));
  const presentationRef = useRef<HTMLElement>(null);
  const slideCount = slides.length;

  useEffect(() => {
    setSlide((value) => Math.min(value, Math.max(0, slideCount - 1)));
  }, [slideCount]);

  useEffect(() => {
    const onFullscreen = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFullscreen);
    return () => document.removeEventListener("fullscreenchange", onFullscreen);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey || isInteractive(event.target)) return;
      if (event.key === "ArrowRight" || event.key === "PageDown") setSlide((value) => Math.min(slideCount - 1, value + 1));
      else if (event.key === "ArrowLeft" || event.key === "PageUp") setSlide((value) => Math.max(0, value - 1));
      else if (event.key === "Home") setSlide(0);
      else if (event.key === "End") setSlide(slideCount - 1);
      else return;
      event.preventDefault();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [slideCount]);

  const toggleFullscreen = async () => {
    if (document.fullscreenElement) await document.exitFullscreen();
    else if (presentationRef.current?.requestFullscreen) await presentationRef.current.requestFullscreen();
  };

  return <main className="cl-presentation-page" ref={presentationRef}>
    <div className="cl-presentation-stage">
      <div className="cl-presentation-viewport" data-active-slide={slide + 1} data-slide-count={slideCount}>
        {slides.map((item, index) => <div className="cl-presentation-slide-slot" data-active={index === slide ? "true" : "false"} hidden={index !== slide} key={item.key}>{item.render(index === slide, index + 1, slideCount)}</div>)}
      </div>
      <nav aria-label="Presentation controls" className="cl-presentation-overlay-controls cl-print-hidden">
        <div className="cl-presentation-overlay-group cl-presentation-overlay-back"><Button asChild variant="secondary"><Link to={routes.facilityAssessmentJourneys}>Back to Assessment Journey</Link></Button></div>
        <div className="cl-presentation-overlay-group cl-presentation-overlay-navigation">
          <Button aria-label="Previous slide" disabled={slide === 0} onClick={() => setSlide((value) => Math.max(0, value - 1))} variant="secondary">Previous</Button>
          <p aria-live="polite">Slide {slide + 1} of {slideCount}</p>
          <Button aria-label="Next slide" disabled={slide === slideCount - 1} onClick={() => setSlide((value) => Math.min(slideCount - 1, value + 1))}>Next</Button>
        </div>
        {document.fullscreenEnabled ? <div className="cl-presentation-overlay-group cl-presentation-overlay-fullscreen"><Button aria-label={fullscreen ? "Exit full screen" : "Enter full screen"} onClick={() => void toggleFullscreen()} variant="secondary">{fullscreen ? "Exit full screen" : "Full screen"}</Button></div> : <span />}
      </nav>
    </div>

    <ProjectionDetails projection={projection} />
  </main>;
}

function ExecutiveSummarySlide({ active, number, total, projection }: SlideProps) {
  return <PresentationFrame active={active} number={number} total={total} title="Executive Summary" projection={projection}>
    <div className="cl-presentation-summary-grid">
      <section className="cl-presentation-kpi-panel" aria-label="Governed Aquatic Risk Index">
        <p className="cl-presentation-eyebrow">Governed Aquatic Risk Index</p>
        <p className="cl-presentation-hero-value">{projection.ari.value}</p>
        <RiskBadge classification={projection.ari.classification} />
        <dl className="cl-presentation-kpi-meta">
          <Kpi label="ARI version" value={String(projection.ari.resultVersion)} />
          <Kpi label="Calculated" value={formatDate(projection.ari.calculatedAt)} />
          <Kpi label="Category snapshots" value="9 of 9" />
        </dl>
      </section>
      <section className="cl-presentation-identity-panel" aria-label="Assessment scope">
        <p className="cl-presentation-eyebrow">Assessment scope</p>
        <h2>{projection.scope.facilityName}</h2>
        <p className="cl-presentation-client-name">{projection.scope.clientName}</p>
        <dl className="cl-presentation-identity-list">
          <div><dt>Facility</dt><dd>{projection.scope.facilityIdentifier}</dd></div>
          <div><dt>Client</dt><dd>{projection.scope.clientIdentifier}</dd></div>
          <div><dt>Result authority</dt><dd>Immutable ARI Version {projection.ari.resultVersion}</dd></div>
        </dl>
        <div className="cl-presentation-neutral-note"><strong>Numeric category order is available.</strong><span>It is presented without findings, priorities, or recommendations.</span></div>
      </section>
    </div>
  </PresentationFrame>;
}

function AriCompositionSlide({ active, number, total, projection }: SlideProps) {
  return <PresentationFrame active={active} number={number} total={total} title="ARI Composition" projection={projection}>
    <div className="cl-presentation-composition-layout"><div className="cl-presentation-composition-heading">
      <div><p className="cl-presentation-eyebrow">Persisted result</p><p className="cl-presentation-total">{projection.ari.value} <span>{titleCase(projection.ari.classification)}</span></p></div>
      <p>Each bar displays its persisted weighted contribution on a common 0–100 visual scale. No presentation value is used to calculate ARI.</p>
    </div>
    <div className="cl-presentation-contribution-list" role="list" aria-label="Nine persisted ARI contributions">
      {projection.categories.map((category) => <ContributionBar category={category} key={category.categoryCode} />)}
    </div></div>
  </PresentationFrame>;
}

function CategoryIndicesSlide({ active, number, total, projection }: SlideProps) {
  return <PresentationFrame active={active} number={number} total={total} title="Governed Category Indices" projection={projection}>
    <div className="cl-presentation-category-table" role="table" aria-label="Nine governed category indices">
      <div className="cl-presentation-category-header" role="row">
        <span role="columnheader">Category</span><span role="columnheader">Index</span><span role="columnheader">Classification</span><span role="columnheader">Weight</span><span role="columnheader">Contribution</span>
      </div>
      {projection.categories.map((category) => <CategoryRow category={category} key={category.categoryCode} />)}
    </div>
  </PresentationFrame>;
}

function ProfessionalContentSlide({ active, number, total, projection, page }: SlideProps & { readonly page: AuthoredPresentationPage }) {
  return <PresentationFrame active={active} number={number} total={total} title="Professional Findings & Actions" projection={projection}>
    <div className="cl-presentation-professional-grid" style={{ "--cl-professional-columns": page.cards.length } as CSSProperties}>
      {page.cards.map((card) => <ProfessionalCard card={card} key={`${card.sectionIndex}-${card.continuation ? "continued" : "primary"}`} />)}
    </div>
  </PresentationFrame>;
}

function ProfessionalCard({ card }: { readonly card: PresentationCardPiece }) {
  return <article className="cl-presentation-professional-card">
    <div className="cl-presentation-professional-card-heading">
      <div><p>Professional section {card.sectionIndex + 1}</p><h2>{card.heading}{card.continuation ? " — Continued" : ""}</h2></div>
      {card.classification ? <span className="cl-presentation-professional-classification">{card.classification}</span> : null}
    </div>
    <p className="cl-presentation-professional-scope">{card.scope}</p>
    {card.findings.length ? <ProfessionalList title="Findings" tone="finding" values={card.findings.map((item) => ({ label: item.continued ? "Finding continued" : null, text: item.text }))} /> : null}
    {card.recommendations.length ? <ProfessionalList title="Recommendations and actions" tone="action" values={card.recommendations.map((item) => ({ label: `${item.kind === "ACTION" ? "Action" : "Recommendation"}${item.continued ? " continued" : ""}`, text: item.text }))} /> : null}
  </article>;
}

function ProfessionalList({ title, tone, values }: { readonly title: string; readonly tone: "finding" | "action"; readonly values: readonly { readonly label: string | null; readonly text: string }[] }) {
  return <section className={`cl-presentation-professional-list cl-presentation-professional-list-${tone}`}><h3>{title}</h3><ol>{values.map((value, index) => <li key={index}><span aria-hidden="true">{index + 1}</span><p>{value.label ? <strong>{value.label}: </strong> : null}<span>{value.text}</span></p></li>)}</ol></section>;
}

interface SlideProps { readonly active: boolean; readonly number: number; readonly total: number; readonly projection: ExecutiveSummaryProjection }

function PresentationFrame({ active, number, total, title, projection, children }: SlideProps & { readonly title: string; readonly children: ReactNode }) {
  return <section aria-hidden={!active} aria-label={`Slide ${number} of ${total}: ${title}`} className="cl-presentation-slide">
    <header className="cl-presentation-slide-header">
      <div className="cl-presentation-brand"><img alt="Client Lens by OGI Ltd." src="/brand/client-lens-logo.png" /><div><p>Ocean Guardian International</p><span>Aquatic Risk Intelligence</span></div></div>
      <div className="cl-presentation-header-title"><p>Water Safety Assessment</p><h1>{title}</h1></div>
      <div className="cl-presentation-scope"><strong>{projection.scope.facilityName}</strong><span>{projection.scope.clientName}</span></div>
    </header>
    <div className="cl-presentation-slide-body">{children}</div>
  </section>;
}

function ContributionBar({ category }: { readonly category: ExecutiveSummaryCategory }) {
  const style = { "--cl-contribution-width": `${category.weightedContribution}%` } as CSSProperties;
  return <div className="cl-presentation-contribution-row" role="listitem">
    <span className="cl-presentation-contribution-order">{category.canonicalOrder}</span>
    <span className="cl-presentation-contribution-name">{category.categoryName}</span>
    <span className="cl-presentation-contribution-track" aria-label={`${category.categoryName}: persisted weighted contribution ${category.weightedContribution}`}><span style={style} /></span>
    <span>Index <strong>{category.index}</strong></span><span>Weight <strong>{formatWeight(category.weight)}</strong></span><span>Contribution <strong>{formatContribution(category.weightedContribution)}</strong></span>
  </div>;
}

function CategoryRow({ category }: { readonly category: ExecutiveSummaryCategory }) {
  return <div className="cl-presentation-category-row" role="row">
    <span className="cl-presentation-category-name" role="cell"><b>{category.canonicalOrder}</b>{category.categoryName}</span>
    <strong role="cell">{category.index}</strong>
    <span role="cell"><RiskBadge classification={category.classification} compact /></span>
    <span role="cell">{formatWeight(category.weight)}</span>
    <strong role="cell">{formatContribution(category.weightedContribution)}</strong>
  </div>;
}

function Kpi({ label, value }: { readonly label: string; readonly value: string }) {
  return <div><dt>{label}</dt><dd>{value}</dd></div>;
}

function RiskBadge({ classification, compact = false }: { readonly classification: ExecutiveSummaryClassification; readonly compact?: boolean }) {
  return <span className={`cl-presentation-risk-badge cl-presentation-risk-${classification.toLowerCase()} ${compact ? "cl-presentation-risk-compact" : ""}`}>{titleCase(classification)}</span>;
}

function ProjectionDetails({ projection }: { readonly projection: ExecutiveSummaryProjection }) {
  return <details className="cl-presentation-details cl-print-hidden">
    <summary>Projection details</summary>
    <dl><div><dt>ARI result ID</dt><dd>{projection.ari.resultId}</dd></div><div><dt>Result checksum</dt><dd>{projection.ari.resultChecksum}</dd></div><div><dt>Source-set checksum</dt><dd>{projection.ari.sourceSetChecksum}</dd></div><div><dt>Authority</dt><dd>{projection.ari.authorityVersion} · {projection.ari.authorityChecksum}</dd></div><div><dt>Numeric contract</dt><dd>{projection.ari.numericContract}</dd></div></dl>
  </details>;
}

function PresentationError({ error, retry }: { readonly error: Error; readonly retry: () => void }) {
  if (isApiError(error) && error.status === 403) return <PresentationState title="Presentation unavailable" message="You are not authorized to view this ARI result." />;
  if (isApiError(error) && error.status === 404) return <PresentationState title="ARI result not found" message="The exact immutable ARI result is unavailable or outside your authorized scope." />;
  if (isApiError(error) && (error.status === 409 || error.code === "MALFORMED_RESPONSE")) return <PresentationState title="Projection unavailable" message="The immutable ARI projection is incomplete or inconsistent. No substitute result was loaded." />;
  return <PresentationState title="Presentation could not be loaded" message="A network or service error prevented the exact ARI projection from loading." action={<Button onClick={retry}>Try again</Button>} />;
}

function PresentationState({ title, message, status = false, action }: { readonly title: string; readonly message: string; readonly status?: boolean; readonly action?: ReactNode }) {
  return <main className="cl-presentation-state"><img alt="Client Lens by OGI Ltd." src="/brand/client-lens-logo.png" /><div role={status ? "status" : "alert"}><h1>{title}</h1><p>{message}</p>{action ? <div className="mt-5">{action}</div> : null}<Link className="mt-6 inline-block font-semibold text-primary-blue underline" to={routes.facilityAssessmentJourneys}>Back to Facility Assessment Journey</Link></div></main>;
}

function isInteractive(target: EventTarget | null) {
  return target instanceof Element && Boolean(target.closest("button, a, input, select, textarea, [role='button']"));
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function titleCase(value: string) {
  return value.charAt(0) + value.slice(1).toLowerCase();
}
