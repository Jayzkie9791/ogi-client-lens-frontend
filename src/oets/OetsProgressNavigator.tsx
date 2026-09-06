import { useEffect, useId, useRef, useState } from "react";
import type { RefObject } from "react";

import type {
  OetsProgressModel,
  OetsSectionProgress,
  OetsSectionProgressStatus
} from "./oetsProgress";

interface OetsProgressNavigatorProps {
  model: OetsProgressModel;
}

export function OetsProgressNavigator({ model }: OetsProgressNavigatorProps) {
  const [currentSectionId, setCurrentSectionId] = useState(
    model.sections[0]?.sectionId ?? ""
  );
  const [mobileExpanded, setMobileExpanded] = useState(false);
  const mobilePanelId = useId();
  const sectionListRef = useRef<HTMLOListElement>(null);
  const observedSectionsKey = model.sections
    .map((section) => `${section.sectionId}\u0000${section.domId}`)
    .join("\u0001");

  useEffect(() => {
    const observedSections = observedSectionsKey
      ? observedSectionsKey.split("\u0001").map((item) => {
          const [sectionId, domId] = item.split("\u0000");
          return { sectionId, domId };
        })
      : [];
    const sectionIds = observedSections.map((section) => section.sectionId);

    if (typeof IntersectionObserver === "undefined") return;
    const intersecting = new Set<string>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const sectionId = (entry.target as HTMLElement).dataset.oetsSectionId;
          if (!sectionId) continue;
          if (entry.isIntersecting) intersecting.add(sectionId);
          else intersecting.delete(sectionId);
        }
        const next = sectionIds.find((id) => intersecting.has(id));
        if (next) setCurrentSectionId(next);
      },
      { rootMargin: "-136px 0px -65% 0px", threshold: [0, 0.01, 0.25] }
    );

    for (const section of observedSections) {
      const target = document.getElementById(section.domId);
      if (target) observer.observe(target);
    }
    return () => observer.disconnect();
  }, [observedSectionsKey]);

  const current =
    model.sections.find((section) => section.sectionId === currentSectionId) ??
    model.sections[0];

  useEffect(() => {
    const list = sectionListRef.current;
    const active = list?.querySelector<HTMLElement>("[aria-current='location']");
    if (!list || !active) return;
    const activeTop = active.offsetTop;
    const activeBottom = activeTop + active.offsetHeight;
    if (activeTop < list.scrollTop) list.scrollTop = activeTop;
    else if (activeBottom > list.scrollTop + list.clientHeight) {
      list.scrollTop = activeBottom - list.clientHeight;
    }
  }, [current?.sectionId]);

  if (!current) return null;

  return (
    <aside className="self-start overflow-hidden rounded-panel border border-[#CFDCEB] bg-white shadow-[0_2px_8px_rgba(15,45,95,0.06)] lg:flex lg:max-h-[calc(100vh-8.5rem)] lg:flex-col" data-testid="oets-progress-rail">
      <button
        aria-controls={mobilePanelId}
        aria-expanded={mobileExpanded}
        className="flex w-full items-center justify-between gap-3 rounded-panel px-4 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus lg:hidden"
        onClick={() => setMobileExpanded((expanded) => !expanded)}
        type="button"
      >
        <span>
          <span className="block text-xs font-semibold uppercase tracking-wide text-primary-blue">
            Form progress
          </span>
          <span className="mt-1 block font-semibold text-primary-navy">
            Section {current.sequence}: {current.title}
          </span>
        </span>
        <ProgressValue model={model} />
      </button>
      <div className={`${mobileExpanded ? "block" : "hidden"} border-t border-border p-3 lg:flex lg:min-h-0 lg:flex-1 lg:flex-col lg:border-t-0 lg:p-4`} id={mobilePanelId}>
          <ProgressContents
            currentSectionId={current.sectionId}
            sectionListRef={sectionListRef}
            model={model}
          />
      </div>
    </aside>
  );
}

function ProgressContents({
  currentSectionId,
  sectionListRef,
  model
}: {
  currentSectionId: string;
  sectionListRef: RefObject<HTMLOListElement | null>;
  model: OetsProgressModel;
}) {
  return (
    <nav aria-label="Form sections" className="flex min-h-0 flex-col lg:h-full">
      <div className="shrink-0 bg-white" data-testid="oets-progress-summary">
      <p className="text-sm font-semibold text-primary-navy">Form progress</p>
      <p className="mt-1 text-xs leading-5 text-text-muted">
        Required input completion only. This does not indicate validation,
        approval, or lifecycle completion.
      </p>
      <div className="mt-3">
        {model.percentage === null ? (
          <p className="text-sm font-semibold text-text-muted">No required inputs</p>
        ) : (
          <>
            <div className="flex items-center justify-between gap-2 text-xs font-semibold text-text-muted">
              <span>Draft completion</span>
              <span>{model.percentage}%</span>
            </div>
            <progress
              aria-label="Draft completion"
              className="mt-2 h-2 w-full accent-primary-blue"
              max={100}
              value={model.percentage}
            />
            <p className="mt-1 text-xs text-text-muted">
              {model.fulfilledRequired} of {model.totalRequired} required inputs
            </p>
          </>
        )}
      </div>
      {model.hasUnmappedAttention ? (
        <p className="mt-3 rounded-component border-l-2 border-state-error bg-red-50 px-3 py-2 text-xs font-semibold text-state-error">
          This form needs attention.
        </p>
      ) : null}
      </div>
      <ol className="mt-4 min-h-0 space-y-1 overflow-y-auto overscroll-contain pr-1 lg:flex-1" data-testid="oets-progress-section-list" ref={sectionListRef}>
        {model.sections.map((section) => {
          const current = section.sectionId === currentSectionId;
          return (
            <li key={section.sectionId}>
              <button
                aria-current={current ? "location" : undefined}
                className={[
                  "flex w-full items-start gap-3 rounded-component px-2 py-2 text-left text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus",
                  current
                    ? "bg-blue-50 text-primary-navy"
                    : "text-text-primary hover:bg-blue-50/60"
                ].join(" ")}
                onClick={() => navigateToSection(section)}
                type="button"
              >
                <StatusMark status={section.status} />
                <span className="min-w-0">
                  <span className="block text-xs font-semibold uppercase tracking-wide text-primary-blue">
                    Section {section.sequence}
                  </span>
                  <span className="block font-semibold">{section.title}</span>
                  <span className="block text-xs text-text-muted">
                    {statusLabel(section.status)}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function ProgressValue({ model }: { model: OetsProgressModel }) {
  return (
    <span className="shrink-0 text-sm font-semibold text-primary-blue">
      {model.percentage === null ? "No required inputs" : `${model.percentage}%`}
    </span>
  );
}

function StatusMark({ status }: { status: OetsSectionProgressStatus }) {
  const className = status === "NEEDS_ATTENTION"
    ? "border-state-error bg-red-50 text-state-error"
    : status === "COMPLETE"
      ? "border-state-success bg-green-50 text-state-success"
      : status === "IN_PROGRESS"
        ? "border-primary-blue bg-blue-50 text-primary-blue"
        : "border-border bg-elevated text-text-muted";
  const symbol = status === "NEEDS_ATTENTION"
    ? "!"
    : status === "COMPLETE"
      ? "✓"
      : status === "IN_PROGRESS"
        ? "•"
        : "–";

  return (
    <span
      aria-hidden="true"
      className={`mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-bold ${className}`}
    >
      {symbol}
    </span>
  );
}

function statusLabel(status: OetsSectionProgressStatus) {
  switch (status) {
    case "NEEDS_ATTENTION": return "Needs attention";
    case "COMPLETE": return "Required inputs complete";
    case "IN_PROGRESS": return "In progress";
    default: return "Not started";
  }
}

function navigateToSection(section: OetsSectionProgress) {
  const target = document.getElementById(section.domId);
  if (!target) return;
  const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  target.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" });
  target.focus({ preventScroll: true });
}
