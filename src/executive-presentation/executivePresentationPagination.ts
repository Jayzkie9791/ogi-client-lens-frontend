import type { ExecutivePresentationRecommendation, ExecutivePresentationSection } from "./executivePresentationTypes";

export interface PresentationCardPiece {
  readonly sectionIndex: number;
  readonly heading: string;
  readonly scope: string;
  readonly classification: string | null;
  readonly continuation: boolean;
  readonly findings: readonly PresentationTextPiece[];
  readonly recommendations: readonly PresentationRecommendationPiece[];
}

export interface PresentationTextPiece { readonly text: string; readonly continued: boolean }
export interface PresentationRecommendationPiece extends PresentationTextPiece { readonly kind: ExecutivePresentationRecommendation["kind"] }
export interface AuthoredPresentationPage { readonly key: string; readonly cards: readonly PresentationCardPiece[] }
export type CardFitMeasurer = (cards: readonly PresentationCardPiece[], columns: number) => boolean;

const MAXIMUM_COLUMNS = 2;

export function paginateProfessionalCards(sections: readonly ExecutivePresentationSection[], fits: CardFitMeasurer = estimatedCanonicalFit): readonly AuthoredPresentationPage[] {
  const queue = sections.map((section, sectionIndex) => wholeCard(section, sectionIndex));
  const pages: AuthoredPresentationPage[] = [];
  let cursor = 0;
  while (cursor < queue.length) {
    let packed: readonly PresentationCardPiece[] | null = null;
    for (let count = Math.min(MAXIMUM_COLUMNS, queue.length - cursor); count >= 1; count -= 1) {
      const candidate = queue.slice(cursor, cursor + count);
      if (fits(candidate, count)) { packed = candidate; break; }
    }
    if (packed) {
      pages.push({ key: pageKey(pages.length, packed), cards: packed });
      cursor += packed.length;
      continue;
    }
    const oversized = queue[cursor];
    if (!oversized) break;
    const fragments = splitOversizedCard(oversized, fits);
    for (const fragment of fragments) pages.push({ key: pageKey(pages.length, [fragment]), cards: [fragment] });
    cursor += 1;
  }
  return pages;
}

export function createCanonicalGeometryMeasurer(): CardFitMeasurer {
  return (cards, columns) => {
    if (typeof document === "undefined" || !document.body) return estimatedCanonicalFit(cards, columns);
    const host = document.createElement("div");
    host.className = "cl-presentation-measurement";
    host.setAttribute("aria-hidden", "true");
    const grid = document.createElement("div");
    grid.className = "cl-presentation-professional-grid";
    grid.style.setProperty("--cl-professional-columns", String(columns));
    for (const card of cards) grid.append(renderMeasurementCard(card));
    host.append(grid);
    document.body.append(host);
    const measurable = grid.clientHeight > 0 && [...grid.children].every((element) => (element as HTMLElement).clientHeight > 0);
    const result = measurable
      ? grid.scrollHeight <= grid.clientHeight + 1 && [...grid.children].every((element) => element.scrollHeight <= (element as HTMLElement).clientHeight + 1)
      : estimatedCanonicalFit(cards, columns);
    host.remove();
    return result;
  };
}

function splitOversizedCard(card: PresentationCardPiece, fits: CardFitMeasurer) {
  type Item = { type: "finding"; text: string; continued: boolean } | { type: "recommendation"; text: string; kind: ExecutivePresentationRecommendation["kind"]; continued: boolean };
  const pending: Item[] = [
    ...card.findings.map((item) => ({ type: "finding" as const, text: item.text, continued: false })),
    ...card.recommendations.map((item) => ({ type: "recommendation" as const, text: item.text, kind: item.kind, continued: false }))
  ];
  if (pending.length === 0) return [card];
  const output: PresentationCardPiece[] = [];
  while (pending.length) {
    let page = emptyPiece(card, output.length > 0);
    while (pending.length) {
      const next = pending[0];
      if (!next) break;
      const complete = appendItem(page, next);
      if (fits([complete], 1)) {
        page = complete;
        pending.shift();
        continue;
      }
      const prefixLength = largestFittingPrefix(page, next, fits);
      if (prefixLength > 0) {
        page = appendItem(page, { ...next, text: next.text.slice(0, prefixLength) });
        pending[0] = { ...next, text: next.text.slice(prefixLength), continued: true };
      }
      break;
    }
    if (page.findings.length === 0 && page.recommendations.length === 0) {
      const next = pending.shift();
      if (!next) break;
      const first = next.text.slice(0, 1);
      page = appendItem(page, { ...next, text: first });
      if (next.text.length > 1) pending.unshift({ ...next, text: next.text.slice(1), continued: true });
    }
    output.push(page);
  }
  return output;
}

function largestFittingPrefix(page: PresentationCardPiece, item: Parameters<typeof appendItem>[1], fits: CardFitMeasurer) {
  let low = 0;
  let high = item.text.length;
  while (low < high) {
    const midpoint = Math.ceil((low + high) / 2);
    if (fits([appendItem(page, { ...item, text: item.text.slice(0, midpoint) })], 1)) low = midpoint;
    else high = midpoint - 1;
  }
  if (low === item.text.length) return low;
  const boundary = item.text.slice(0, low).search(/\s+\S*$/);
  return boundary > 0 ? boundary : low;
}

function wholeCard(section: ExecutivePresentationSection, sectionIndex: number): PresentationCardPiece {
  return {
    sectionIndex, heading: section.heading, scope: section.scope, classification: section.classification ?? null, continuation: false,
    findings: section.findings.map((text) => ({ text, continued: false })),
    recommendations: section.recommendations.map((item) => ({ ...item, continued: false }))
  };
}

function emptyPiece(card: PresentationCardPiece, continuation: boolean): PresentationCardPiece {
  return { ...card, continuation, findings: [], recommendations: [] };
}

function appendItem(card: PresentationCardPiece, item: { type: "finding"; text: string; continued: boolean } | { type: "recommendation"; text: string; kind: ExecutivePresentationRecommendation["kind"]; continued: boolean }): PresentationCardPiece {
  return item.type === "finding"
    ? { ...card, findings: [...card.findings, { text: item.text, continued: item.continued }] }
    : { ...card, recommendations: [...card.recommendations, { kind: item.kind, text: item.text, continued: item.continued }] };
}

function estimatedCanonicalFit(cards: readonly PresentationCardPiece[], columns: number) {
  const charactersPerLine = columns === 2 ? 56 : 96;
  return cards.every((card) => estimatedLines(card, charactersPerLine) <= 21);
}

function estimatedLines(card: PresentationCardPiece, width: number) {
  const lines = (value: string) => value.split("\n").reduce((total, part) => total + Math.max(1, Math.ceil(Array.from(part).length / width)), 0);
  return 5 + lines(card.heading) + lines(card.scope) + (card.classification ? 1 : 0)
    + card.findings.reduce((total, item) => total + 1 + lines(item.text), 0)
    + card.recommendations.reduce((total, item) => total + 1 + lines(item.text), 0);
}

function renderMeasurementCard(card: PresentationCardPiece) {
  const article = document.createElement("article");
  article.className = "cl-presentation-professional-card";
  const header = document.createElement("div");
  header.className = "cl-presentation-professional-card-heading";
  const titleGroup = document.createElement("div");
  const eyebrow = document.createElement("p"); eyebrow.textContent = `Professional section ${card.sectionIndex + 1}`;
  const heading = document.createElement("h2");
  heading.textContent = `${card.heading}${card.continuation ? " — Continued" : ""}`;
  titleGroup.append(eyebrow, heading);
  header.append(titleGroup);
  if (card.classification) { const badge = document.createElement("span"); badge.className = "cl-presentation-professional-classification"; badge.textContent = card.classification; header.append(badge); }
  const scope = document.createElement("p");
  scope.className = "cl-presentation-professional-scope";
  scope.textContent = card.scope;
  article.append(header, scope);
  appendMeasurementList(article, "Findings", "finding", card.findings.map((item) => `${item.continued ? "Finding continued: " : ""}${item.text}`));
  appendMeasurementList(article, "Recommendations and actions", "action", card.recommendations.map((item) => `${item.kind === "ACTION" ? "Action" : "Recommendation"}${item.continued ? " continued" : ""}: ${item.text}`));
  return article;
}

function appendMeasurementList(parent: HTMLElement, title: string, tone: "finding" | "action", values: readonly string[]) {
  if (!values.length) return;
  const section = document.createElement("section"); section.className = `cl-presentation-professional-list cl-presentation-professional-list-${tone}`;
  const heading = document.createElement("h3"); heading.textContent = title;
  const list = document.createElement("ol");
  for (const [index, value] of values.entries()) { const item = document.createElement("li"); const marker = document.createElement("span"); marker.textContent = String(index + 1); const text = document.createElement("p"); text.textContent = value; item.append(marker, text); list.append(item); }
  section.append(heading, list); parent.append(section);
}

function pageKey(index: number, cards: readonly PresentationCardPiece[]) {
  return `professional-${index}-${cards.map((card) => `${card.sectionIndex}-${card.continuation ? "c" : "p"}`).join("-")}`;
}
