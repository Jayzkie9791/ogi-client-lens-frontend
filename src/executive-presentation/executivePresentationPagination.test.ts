import { describe, expect, it } from "vitest";
import { paginateProfessionalCards, type CardFitMeasurer } from "./executivePresentationPagination";
import type { ExecutivePresentationSection } from "./executivePresentationTypes";

const section = (heading: string, finding = `${heading} finding`): ExecutivePresentationSection => ({ heading, scope: `${heading} scope`, classification: null, findings: [finding], recommendations: [{ kind: "ACTION", text: `${heading} action` }] });

describe("EPA6 deterministic professional-card pagination", () => {
  it("packs at most two ordered cards and leaves the third card on a centered-page model", () => {
    const pages = paginateProfessionalCards([section("Front Pool"), section("Back Pool"), section("Front Beach")], () => true);
    expect(pages).toHaveLength(2);
    expect(pages[0]?.cards.map((card) => card.heading)).toEqual(["Front Pool", "Back Pool"]);
    expect(pages[1]?.cards.map((card) => card.heading)).toEqual(["Front Beach"]);
  });

  it("selects the greatest fitting ordered prefix without moving later cards ahead", () => {
    const fits: CardFitMeasurer = (cards, columns) => columns <= 2 && cards.every((card) => card.heading !== "Large" || columns === 1);
    const pages = paginateProfessionalCards([section("First"), section("Large"), section("Third"), section("Fourth")], fits);
    expect(pages.map((page) => page.cards.map((card) => card.heading))).toEqual([["First"], ["Large"], ["Third", "Fourth"]]);
  });

  it("continues an oversized item in place and preserves every authored character exactly", () => {
    const original = "Alpha beta gamma delta epsilon zeta eta theta iota kappa lambda";
    const fits: CardFitMeasurer = (cards) => cards.every((card) => card.findings.every((item) => item.text.length <= 18));
    const pages = paginateProfessionalCards([section("Oversized", original), section("Later")], fits);
    const oversized = pages.flatMap((page) => page.cards).filter((card) => card.heading === "Oversized");
    expect(oversized.length).toBeGreaterThan(1);
    expect(oversized.flatMap((card) => card.findings).map((item) => item.text).join("")).toBe(original);
    expect(pages.flatMap((page) => page.cards).map((card) => card.heading).at(-1)).toBe("Later");
    expect(oversized.slice(1).every((card) => card.continuation)).toBe(true);
  });

  it("does not mutate persisted section content while deriving pages", () => {
    const source = [section("Front Pool")];
    const before = JSON.stringify(source);
    paginateProfessionalCards(source, () => true);
    expect(JSON.stringify(source)).toBe(before);
  });
});
