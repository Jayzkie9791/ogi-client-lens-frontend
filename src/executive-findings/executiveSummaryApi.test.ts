import { afterEach, describe, expect, it, vi } from "vitest";

import { getExecutiveSummary, isExecutiveSummaryProjection } from "./executiveSummaryApi";
import { executiveSummaryFixture } from "./executiveSummaryTestFixture";

afterEach(() => vi.unstubAllGlobals());

describe("EF6A exact-result API consumer", () => {
  it("requests only the exact EF4A projection and accepts its complete contract", async () => {
    const fixture = executiveSummaryFixture();
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(fixture), { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(getExecutiveSummary(fixture.ari.resultId)).resolves.toEqual(fixture);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const requestedUrl = new URL(String(fetchMock.mock.calls[0]?.[0]));
    expect(requestedUrl.pathname).toBe(`/api/v1/operational-risk-index/${fixture.ari.resultId}/executive-summary`);
    expect(requestedUrl.search).toBe("");
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ method: "GET" });
  });

  it("fails closed on incomplete, reordered, or malformed EF4A material", () => {
    const incomplete = executiveSummaryFixture() as unknown as { categories: unknown[] };
    incomplete.categories = incomplete.categories.slice(0, 8);
    expect(isExecutiveSummaryProjection(incomplete)).toBe(false);
    const reordered = structuredClone(executiveSummaryFixture()) as unknown as { categories: Array<{ canonicalOrder: number }> };
    const firstCategory = reordered.categories.at(0);
    if (!firstCategory) throw new Error("Expected the complete executive-summary fixture.");
    firstCategory.canonicalOrder = 2;
    expect(isExecutiveSummaryProjection(reordered)).toBe(false);
    const malformed = structuredClone(executiveSummaryFixture()) as unknown as { ari: { value: string } };
    malformed.ari.value = "calculated-client-side";
    expect(isExecutiveSummaryProjection(malformed)).toBe(false);
  });
});
