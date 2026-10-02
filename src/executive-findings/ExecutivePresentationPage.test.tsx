import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "../api/errors";
import { AuthContext, type AuthContextValue } from "../auth/AuthContext";
import { ExecutivePresentationPage } from "./ExecutivePresentationPage";
import { formatContribution, formatWeight } from "./executivePresentationFormatting";
import { executiveSummaryFixture } from "./executiveSummaryTestFixture";

const getExecutiveSummary = vi.hoisted(() => vi.fn());
const readExecutivePresentationDraft = vi.hoisted(() => vi.fn());
vi.mock("./executiveSummaryApi", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./executiveSummaryApi")>()),
  getExecutiveSummary
}));
vi.mock("../executive-presentation/executivePresentationApi", () => ({ readExecutivePresentationDraft }));

const resultId = "00000000-0000-4000-8000-000000000001";

function renderPage(permissions = ["view_domain_assessment"], initialPath = `/operational-risk-index/${resultId}/presentation`) {
  const auth: AuthContextValue = {
    status: "authenticated" as const,
    session: { id: "actor", email: null, username: "operator", fullName: "Operator", status: "ACTIVE", clientId: null, facilityScopeMode: null, facilityIds: [], roles: [], permissions },
    errorMessage: null, login: vi.fn(), logout: vi.fn(), clearAuthError: vi.fn(), refreshAccessToken: vi.fn(),
    canUsePermission: (permission: string) => permissions.includes(permission)
  };
  return render(<AuthContext.Provider value={auth}><QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MemoryRouter initialEntries={[initialPath]}><Routes><Route path="/operational-risk-index/:ariResultId/presentation" element={<ExecutivePresentationPage />} /><Route path="/workbench/assessments/facility-journeys" element={<p>Journey</p>} /></Routes></MemoryRouter></QueryClientProvider></AuthContext.Provider>);
}

beforeEach(() => {
  getExecutiveSummary.mockReset();
  getExecutiveSummary.mockResolvedValue(executiveSummaryFixture());
  readExecutivePresentationDraft.mockReset();
  readExecutivePresentationDraft.mockRejectedValue(new ApiError({ message: "missing", status: 404, code: "EXECUTIVE_PRESENTATION_NOT_FOUND" }));
});

describe("EF6A exact-result executive presentation", () => {
  it("renders ARI 84.15 LOW and remains pinned to the route result", async () => {
    renderPage();
    const slide = await screen.findByLabelText("Slide 1 of 3: Executive Summary");
    expect(within(slide).getByText("84.15")).toBeInTheDocument();
    expect(within(slide).getByText("Low")).toBeInTheDocument();
    expect(within(screen.getByLabelText("Assessment scope")).getByRole("heading", { name: "Aia Private Club" })).toBeInTheDocument();
    expect(within(slide).getByText("9 of 9")).toBeInTheDocument();
    expect(getExecutiveSummary).toHaveBeenCalledWith(resultId);
    expect(getExecutiveSummary).toHaveBeenCalledTimes(1);
  });

  it("shows persisted composition and canonical category rows without semantic labels", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByLabelText("Slide 1 of 3: Executive Summary");
    await user.click(screen.getByRole("button", { name: "Next slide" }));
    const composition = screen.getByLabelText("Slide 2 of 3: ARI Composition");
    expect(within(composition).getByText("12.75")).toBeInTheDocument();
    expect(within(composition).getAllByText("15%", { exact: true })).toHaveLength(3);
    expect(within(composition).queryByText("0.15", { exact: true })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Next slide" }));
    const categories = screen.getByLabelText("Slide 3 of 3: Governed Category Indices");
    const rows = within(categories).getAllByRole("row").slice(1);
    expect(rows).toHaveLength(9);
    expect(within(requiredRow(rows, 0)).getByText("Governance & Documentation")).toBeInTheDocument();
    expect(within(requiredRow(rows, 8)).getByText("Equipment Inspection Programs")).toBeInTheDocument();
    expect(categories).not.toHaveTextContent(/strength|weakness|attention|priority|recommendation/i);
    expect(within(requiredRow(rows, 7)).getByText("96", { exact: true })).toBeInTheDocument();
    expect(within(requiredRow(rows, 7)).queryByText("96%", { exact: true })).not.toBeInTheDocument();
  });

  it("supports bounded button and keyboard navigation", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByLabelText("Slide 1 of 3: Executive Summary");
    const previous = screen.getByRole("button", { name: "Previous slide" });
    const next = screen.getByRole("button", { name: "Next slide" });
    expect(previous).toBeDisabled();
    fireEvent.keyDown(window, { key: "End" });
    expect(await screen.findByText("Slide 3 of 3")).toBeInTheDocument();
    expect(next).toBeDisabled();
    fireEvent.keyDown(window, { key: "Home" });
    expect(await screen.findByText("Slide 1 of 3")).toBeInTheDocument();
    await user.click(next);
    expect(await screen.findByText("Slide 2 of 3")).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "ArrowLeft" });
    expect(await screen.findByText("Slide 1 of 3")).toBeInTheDocument();
    const controls = screen.getByRole("navigation", { name: "Presentation controls" });
    expect(controls).toHaveClass("cl-presentation-overlay-controls", "cl-print-hidden");
    expect(within(controls).getByRole("link", { name: "Back to Assessment Journey" })).toHaveAttribute("href", "/workbench/assessments/facility-journeys");
  });

  it("isolates exactly one normal-mode slide while retaining one canonical three-slide print list", async () => {
    renderPage();
    await screen.findByLabelText("Slide 1 of 3: Executive Summary");
    const slots = [...document.querySelectorAll<HTMLElement>(".cl-presentation-slide-slot")];
    expect(slots).toHaveLength(3);
    expect(slots.filter((slot) => !slot.hidden)).toHaveLength(1);
    expect(slots[0]).toHaveAttribute("data-active", "true");
    expect(slots[1]).toHaveAttribute("data-active", "false");
    expect(document.querySelector(".cl-presentation-viewport")).toHaveAttribute("data-slide-count", "3");
  });

  it("uses deterministic presentation-only numeric formatting", () => {
    expect(formatWeight("0.1")).toBe("10%");
    expect(formatWeight("0.15")).toBe("15%");
    expect(formatWeight("0.05")).toBe("5%");
    expect(formatContribution("6")).toBe("6.00");
    expect(formatContribution("9.6")).toBe("9.60");
    expect(formatContribution("12.75")).toBe("12.75");
  });

  it("does not fetch when permission or result identity is unavailable", async () => {
    const { unmount } = renderPage([]);
    expect(screen.getByRole("alert")).toHaveTextContent("Domain Assessment viewing authority");
    expect(getExecutiveSummary).not.toHaveBeenCalled();
    unmount();
    renderPage(["view_domain_assessment"], "/operational-risk-index/not-a-uuid/presentation");
    expect(screen.getByRole("alert")).toHaveTextContent("valid immutable ARI result identifier");
    expect(getExecutiveSummary).not.toHaveBeenCalled();
  });

  it("presents not-found and network failure without substituting another ARI", async () => {
    getExecutiveSummary.mockRejectedValueOnce(new ApiError({ message: "missing", status: 404, code: "OPERATIONAL_RISK_INDEX_NOT_FOUND" }));
    const first = renderPage();
    expect(await screen.findByText("ARI result not found")).toBeInTheDocument();
    expect(getExecutiveSummary).toHaveBeenCalledTimes(1);
    first.unmount();
    getExecutiveSummary.mockRejectedValueOnce(new Error("network"));
    renderPage();
    expect(await screen.findByRole("button", { name: "Try again" })).toBeInTheDocument();
    expect(getExecutiveSummary).toHaveBeenCalledTimes(2);
  });

  it("registers isolated responsive, reduced-height, fullscreen, and page-bounded print geometry", async () => {
    renderPage();
    await waitFor(() => expect(document.querySelectorAll(".cl-presentation-slide")).toHaveLength(3));
    const source = await import("../app/routePaths");
    expect(source.routes.operationalRiskIndexPresentationPath(resultId)).toBe(`/operational-risk-index/${resultId}/presentation`);

    const stylesheet = readFileSync("src/styles/global.css", "utf8");
    expect(stylesheet).toContain("aspect-ratio: 16 / 9");
    expect(stylesheet).toContain("grid-template-rows: 15% minmax(0, 1fr)");
    expect(stylesheet).toContain(".cl-presentation-header-title { min-width: 0; text-align: center;");
    expect(stylesheet).not.toContain(".cl-presentation-slide-title {");
    expect(stylesheet).not.toContain(".cl-presentation-slide-footer");
    expect(stylesheet).toContain(".cl-presentation-slide-body { min-height: 0; overflow: hidden;");
    expect(stylesheet).toContain("grid-template-rows: repeat(9, minmax(0, 1fr))");
    expect(stylesheet).toContain("@media (max-height: 640px)");
    expect(stylesheet).toContain(".cl-presentation-page:fullscreen");
    expect(stylesheet).toContain(".cl-presentation-overlay-controls");
    expect(stylesheet).toContain("grid-template-rows: minmax(0, 1fr) 3.2rem");
    expect(stylesheet).toContain("background: rgb(255 255 255 / 0.88)");
    expect(stylesheet).toContain("@media print");
    expect(stylesheet).toContain(".cl-print-hidden { display: none !important;");
    expect(stylesheet).toContain(".cl-presentation-slide-slot[hidden]");
    expect(stylesheet).toContain("break-after: page");
    expect(stylesheet).not.toContain(".cl-presentation-toolbar");
  });

  it("contains no current-result, calculation, or Executive Findings mutation dependency", () => {
    const apiSource = readFileSync("src/executive-findings/executiveSummaryApi.ts", "utf8");
    const pageSource = readFileSync("src/executive-findings/ExecutivePresentationPage.tsx", "utf8");
    const combined = `${apiSource}\n${pageSource}`;

    expect(apiSource).toContain("/api/v1/operational-risk-index/${encodeURIComponent(ariResultId)}/executive-summary");
    expect(combined).not.toMatch(/current-operational-risk-index|calculateFacilityOri|calculateOperationalRiskIndex/i);
    expect(combined).not.toMatch(/executive-findings\/(draft|author|review)|method:\s*["'](?:POST|PUT|PATCH|DELETE)/i);
  });

  it("appends three compact saved professional cards as ordered two-card and centered single-card slides", async () => {
    readExecutivePresentationDraft.mockResolvedValue({
      etag: '"epa-draft-r3"',
      envelope: { draft: { id: "draft", ariResultId: resultId, schemaVersion: "1.0", lifecycle: "WORKING_DRAFT", revision: 3, contentChecksum: "a".repeat(64), createdByUserId: "actor", createdAt: "2026-10-02T00:00:00Z", updatedByUserId: "actor", updatedAt: "2026-10-02T00:00:00Z", content: { schemaVersion: "1.0", sections: ["Front Pool", "Back Pool", "Front Beach"].map((heading) => ({ heading, scope: `${heading} operational zone`, classification: null, findings: [`${heading} finding`], recommendations: [{ kind: "ACTION", text: `${heading} action` }] })) } } }
    });
    renderPage();
    expect(await screen.findByLabelText("Slide 1 of 5: Executive Summary")).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "End" });
    const finalSlide = await screen.findByLabelText("Slide 5 of 5: Professional Findings & Actions");
    expect(within(finalSlide).getByRole("heading", { level: 2, name: "Front Beach" })).toBeInTheDocument();
    expect(finalSlide.querySelectorAll(".cl-presentation-professional-card")).toHaveLength(1);
    fireEvent.keyDown(window, { key: "ArrowLeft" });
    const slideFour = await screen.findByLabelText("Slide 4 of 5: Professional Findings & Actions");
    expect(within(slideFour).getAllByRole("heading", { level: 2 }).map((element) => element.textContent)).toEqual(["Front Pool", "Back Pool"]);
    expect(slideFour.querySelectorAll(".cl-presentation-professional-card")).toHaveLength(2);
    expect(document.querySelector(".cl-presentation-viewport")).toHaveAttribute("data-slide-count", "5");
  });

  it("fails closed when saved professional content cannot be resolved", async () => {
    readExecutivePresentationDraft.mockRejectedValue(new Error("network"));
    renderPage();
    expect(await screen.findByText("Professional content unavailable")).toBeInTheDocument();
    expect(screen.queryByLabelText(/Slide 1 of 3/)).not.toBeInTheDocument();
  });
});

function requiredRow(rows: readonly HTMLElement[], index: number) {
  const row = rows.at(index);
  if (!row) throw new Error(`Expected governed category row ${index + 1}.`);
  return row;
}
