import { ReactNode } from "react";

export function RecordAccordion({ id, expanded, onToggle, summary, children }: { id:string; expanded:boolean; onToggle:()=>void; summary:ReactNode; children:ReactNode }) {
  const panelId = `${id}-panel`;
  return <article className="cl-record-card rounded-component border pl-1">
    <button aria-controls={panelId} aria-expanded={expanded} className="cl-record-identity flex min-h-24 w-full items-center gap-4 px-5 py-4 text-left outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-inset" onClick={onToggle} type="button">
      <div className="min-w-0 flex-1">{summary}</div>
      <span aria-hidden="true" className={`shrink-0 text-xl text-primary-navy transition-transform ${expanded ? "rotate-180" : ""}`}>⌄</span>
    </button>
    {expanded ? <div className="p-5" id={panelId}>{children}</div> : null}
  </article>;
}
