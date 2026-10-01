import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import type { DomainAssessmentWorkspaceRecord } from "./domainAssessmentWorkspaceApi";

const api = vi.hoisted(() => ({
  openDomainAssessment: vi.fn(),
  resolveDomainApplicability: vi.fn()
}));

vi.mock("./domainAssessmentWorkspaceApi", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./domainAssessmentWorkspaceApi")>()),
  openDomainAssessment: api.openDomainAssessment,
  resolveDomainApplicability: api.resolveDomainApplicability
}));

import { DomainAssessmentWorkspace } from "./DomainAssessmentWorkspace";

const applicableF045: DomainAssessmentWorkspaceRecord = {
  id: "00000000-0000-4000-8000-000000000045",
  assessmentVersion: 1,
  lifecycle: "DRAFT",
  root: { domainCode: "CERTIFICATION_INTELLIGENCE" },
  scope: { id: "00000000-0000-4000-8000-000000000001", displayName: "Facility-wide" },
  professionalDetermination: { professionalCategoryIndex: null, lmhc: null, synthesis: null },
  authority: { professionalIndexContract: "PROFESSIONAL_CATEGORY_INDEX" },
  applicability: [{ formCode: "F045", canonicalOrder: 45, state: "APPLICABLE", contributions: [] }]
};

describe("Domain Assessment applicability", () => {
  it("allows an applicable unbound F045 member to be marked not applicable with a rationale", async () => {
    const user = userEvent.setup();
    api.openDomainAssessment.mockResolvedValue(applicableF045);
    api.resolveDomainApplicability.mockResolvedValue({
      ...applicableF045,
      applicability: [{
        ...applicableF045.applicability[0],
        state: "NOT_APPLICABLE",
        rationale: "No certification suspension or risk-control action occurred during the assessment period."
      }]
    });

    render(<MemoryRouter><DomainAssessmentWorkspace categoryCode="CERTIFICATION_INTELLIGENCE" categoryName="Certification Intelligence" facilityId="00000000-0000-4000-8000-000000000002" onClose={vi.fn()} onFinalized={vi.fn()} /></MemoryRouter>);

    const rationale = await screen.findByLabelText("Not-applicable rationale");
    const exclude = screen.getByRole("button", { name: "Mark not applicable" });
    expect(exclude).toBeDisabled();

    await user.type(rationale, "No certification suspension or risk-control action occurred during the assessment period.");
    expect(exclude).toBeEnabled();
    await user.click(exclude);

    await waitFor(() => expect(api.resolveDomainApplicability).toHaveBeenCalledWith(
      applicableF045.id,
      "F045",
      {
        state: "NOT_APPLICABLE",
        reasonCode: "NOT_APPLICABLE_OTHER",
        rationale: "No certification suspension or risk-control action occurred during the assessment period."
      }
    ));
    expect(await screen.findByText("Not applicable")).toBeVisible();
  });

  it.each(["F102", "F109"])("marks untriggered Emergency member %s with governed NOT_TRIGGERED authority", async (formCode) => {
    const user = userEvent.setup();
    const assessment: DomainAssessmentWorkspaceRecord = {
      ...applicableF045,
      root: { domainCode: "EMERGENCY_PREPAREDNESS" },
      applicability: [{ formCode, canonicalOrder: Number(formCode.slice(1)), state: "APPLICABLE", contributions: [] }]
    };
    const rationale = `Initial assessment; no qualifying ${formCode} trigger occurred during the assessment period.`;
    api.openDomainAssessment.mockResolvedValue(assessment);
    api.resolveDomainApplicability.mockResolvedValue({ ...assessment, applicability: [{ ...assessment.applicability[0], state: "NOT_APPLICABLE", reasonCode: "NOT_TRIGGERED", rationale }] });

    render(<MemoryRouter><DomainAssessmentWorkspace categoryCode="EMERGENCY_PREPAREDNESS" categoryName="Emergency Preparedness" facilityId="00000000-0000-4000-8000-000000000002" onClose={vi.fn()} onFinalized={vi.fn()} /></MemoryRouter>);
    const input = await screen.findByLabelText("Not-applicable rationale");
    const exclude = screen.getByRole("button", { name: "Mark not applicable" });
    expect(exclude).toBeDisabled();
    await user.type(input, rationale);
    await user.click(exclude);

    await waitFor(() => expect(api.resolveDomainApplicability).toHaveBeenCalledWith(assessment.id, formCode, { state: "NOT_APPLICABLE", reasonCode: "NOT_TRIGGERED", rationale }));
  });

  it("keeps ordinary Emergency members on NOT_APPLICABLE_OTHER", async () => {
    const user = userEvent.setup();
    const assessment: DomainAssessmentWorkspaceRecord = { ...applicableF045, root: { domainCode: "EMERGENCY_PREPAREDNESS" }, applicability: [{ formCode: "F105", canonicalOrder: 105, state: "APPLICABLE", contributions: [] }] };
    const rationale = "Initial assessment; no qualifying resource deployment occurred during the assessment period.";
    api.openDomainAssessment.mockResolvedValue(assessment);
    api.resolveDomainApplicability.mockResolvedValue({ ...assessment, applicability: [{ ...assessment.applicability[0], state: "NOT_APPLICABLE", reasonCode: "NOT_APPLICABLE_OTHER", rationale }] });
    render(<MemoryRouter><DomainAssessmentWorkspace categoryCode="EMERGENCY_PREPAREDNESS" categoryName="Emergency Preparedness" facilityId="00000000-0000-4000-8000-000000000002" onClose={vi.fn()} onFinalized={vi.fn()} /></MemoryRouter>);
    await user.type(await screen.findByLabelText("Not-applicable rationale"), rationale);
    await user.click(screen.getByRole("button", { name: "Mark not applicable" }));
    await waitFor(() => expect(api.resolveDomainApplicability).toHaveBeenCalledWith(assessment.id, "F105", { state: "NOT_APPLICABLE", reasonCode: "NOT_APPLICABLE_OTHER", rationale }));
  });
});
