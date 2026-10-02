import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "../api/errors";
import { AuthContext, type AuthContextValue } from "../auth/AuthContext";
import { executiveSummaryFixture } from "../executive-findings/executiveSummaryTestFixture";
import { ExecutivePresentationAuthoringPage } from "./ExecutivePresentationAuthoringPage";
import { emptyExecutivePresentationContent } from "./executivePresentationTypes";

const api = vi.hoisted(() => ({ summary: vi.fn(), read: vi.fn(), create: vi.fn(), save: vi.fn() }));
vi.mock("../executive-findings/executiveSummaryApi", async (original) => ({ ...(await original<typeof import("../executive-findings/executiveSummaryApi")>()), getExecutiveSummary: api.summary }));
vi.mock("./executivePresentationApi", () => ({ readExecutivePresentationDraft: api.read, createExecutivePresentationDraft: api.create, saveExecutivePresentationDraft: api.save }));

const resultId = "00000000-0000-4000-8000-000000000001";
const draft = { id: "00000000-0000-4000-8000-000000000002", ariResultId: resultId, schemaVersion: "1.0" as const, lifecycle: "WORKING_DRAFT" as const, content: emptyExecutivePresentationContent(), revision: 1, contentChecksum: "a".repeat(64), createdByUserId: "actor", createdAt: "2026-10-01T00:00:00Z", updatedByUserId: "actor", updatedAt: "2026-10-01T00:00:00Z" };

beforeEach(() => {
  Object.values(api).forEach((mock) => mock.mockReset());
  api.summary.mockResolvedValue(executiveSummaryFixture());
});

function renderPage(permissions = ["view_domain_assessment", "author_executive_presentation"]) {
  const auth: AuthContextValue = { status: "authenticated", session: { id: "actor", email: null, username: "operator", fullName: "Operator", status: "ACTIVE", clientId: null, facilityScopeMode: null, facilityIds: [], roles: [], permissions }, errorMessage: null, login: vi.fn(), logout: vi.fn(), clearAuthError: vi.fn(), refreshAccessToken: vi.fn(), canUsePermission: (permission) => permissions.includes(permission) };
  const router = createMemoryRouter([{ path: "/operational-risk-index/:ariResultId/presentation/author", element: <ExecutivePresentationAuthoringPage /> }, { path: "/workbench/assessments/facility-journeys", element: <p>Journey</p> }], { initialEntries: [`/operational-risk-index/${resultId}/presentation/author`] });
  return render(<AuthContext.Provider value={auth}><QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}><RouterProvider router={router} /></QueryClientProvider></AuthContext.Provider>);
}

describe("EPA5 Slides 4+ professional authoring", () => {
  it("does not manufacture a draft and creates one only on deliberate action", async () => {
    api.read.mockRejectedValue(new ApiError({ code: "EXECUTIVE_PRESENTATION_NOT_FOUND", message: "missing", status: 404 }));
    api.create.mockResolvedValue({ envelope: { draft }, etag: '"epa-draft-r1"' });
    const user = userEvent.setup();
    renderPage();
    expect(await screen.findByText("No Slides 4+ draft exists")).toBeInTheDocument();
    expect(api.create).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Start Slides 4+ draft" }));
    expect(await screen.findByRole("heading", { name: "Slides 4+ content" })).toBeInTheDocument();
    expect(api.create).toHaveBeenCalledTimes(1);
  });

  it("edits structured content and saves the complete document with the exact ETag", async () => {
    api.read.mockResolvedValue({ envelope: { draft }, etag: '"epa-draft-r1"' });
    api.save.mockImplementation(async (_projection, content) => ({ envelope: { draft: { ...draft, content, revision: 2, contentChecksum: "b".repeat(64) } }, etag: '"epa-draft-r2"' }));
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("button", { name: "Add section" }));
    await user.type(screen.getByLabelText("Heading"), "Zone observations");
    await user.type(screen.getByLabelText("Scope"), "Main pool and beach operations");
    await user.type(screen.getByLabelText("Classification (optional)"), "Professional attention area");
    await user.click(screen.getByRole("button", { name: "Add finding" }));
    await user.type(screen.getByLabelText("Findings 1"), "Emergency signage is inconsistent.");
    await user.click(screen.getByRole("button", { name: "Add recommendation or action" }));
    await user.selectOptions(screen.getByLabelText("Recommendation or action 1 kind"), "ACTION");
    await user.type(screen.getByLabelText("Recommendation or action 1"), "Standardize signage before opening.");
    expect(screen.getByText("Unsaved changes")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Save draft" }));
    await waitFor(() => expect(api.save).toHaveBeenCalledTimes(1));
    expect(api.save.mock.calls[0]?.[2]).toBe('"epa-draft-r1"');
    expect(api.save.mock.calls[0]?.[1]).toMatchObject({ sections: [{ heading: "Zone observations", findings: ["Emergency signage is inconsistent."], recommendations: [{ kind: "ACTION", text: "Standardize signage before opening." }] }] });
    expect(await screen.findByText("Draft saved as revision 2.")).toBeInTheDocument();
  });

  it("preserves the unsaved copy and blocks blind overwrite after a 412", async () => {
    api.read.mockResolvedValue({ envelope: { draft }, etag: '"epa-draft-r1"' });
    api.save.mockRejectedValue(new ApiError({ code: "EXECUTIVE_PRESENTATION_REVISION_CONFLICT", message: "stale", status: 412 }));
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("button", { name: "Add section" }));
    await user.type(screen.getByLabelText("Heading"), "Local unsaved heading");
    await user.type(screen.getByLabelText("Scope"), "Facility scope");
    await user.click(screen.getByRole("button", { name: "Save draft" }));
    expect(await screen.findByText("This draft was updated in another session.")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Local unsaved heading")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save draft" })).toBeDisabled();
  });

  it("keeps read-only viewers from creating or editing professional content", async () => {
    api.read.mockRejectedValue(new ApiError({ code: "EXECUTIVE_PRESENTATION_NOT_FOUND", message: "missing", status: 404 }));
    renderPage(["view_domain_assessment"]);
    expect(await screen.findByText(/cannot create or edit professional content/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Start Slides 4+ draft" })).not.toBeInTheDocument();
  });
});

