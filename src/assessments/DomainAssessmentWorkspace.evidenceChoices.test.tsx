import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { routes } from "../app/routePaths";
import { EligibleEvidenceChoices } from "./DomainAssessmentWorkspace";
import type { DomainCandidate } from "./domainAssessmentWorkspaceApi";

const candidates: readonly DomainCandidate[] = [
  { id: "00000000-0000-4000-8000-000000000001", sourceKind: "OPERATIONAL_EVIDENCE", templateCode: "OGI_F002_FACILITY_PROFILE", templateVersion: "3.5", lifecycleState: "GOVERNANCE_APPROVED", sourceAt: "2026-09-25T00:51:00.000Z", presentation: { schemaVersion:"DOMAIN_EVIDENCE_PRESENTATION_V1",mode:"GENERIC",primaryLabel:"F002 governed evidence",secondaryLabel:"OGI_F002_FACILITY_PROFILE",contextKind:"OPERATIONAL_EVIDENCE",contextReference:"00000000-0000-4000-8000-000000000001",timestamp:{label:"Submitted",value:"2026-09-25T00:51:00.000Z"} } },
  { id: "00000000-0000-4000-8000-000000000002", sourceKind: "OPERATIONAL_EVIDENCE", templateCode: "OGI_F002_FACILITY_PROFILE", templateVersion: "3.5", lifecycleState: "GOVERNANCE_APPROVED", sourceAt: "2026-09-26T01:52:00.000Z" }
];

describe("eligible Domain evidence choices", () => {
  it("shows distinguishable governed records, supports preview, and binds only the deliberate selection", async () => {
    const user = userEvent.setup();
    const onBind = vi.fn();
    function Harness() {
      const [selectedId, setSelectedId] = useState("");
      return <EligibleEvidenceChoices busy={false} candidates={candidates} formCode="F002" onBind={onBind} onSelect={setSelectedId} selectedId={selectedId} unavailableIds={[]} />;
    }

    render(<MemoryRouter><Harness /></MemoryRouter>);

    expect(screen.getAllByText("F002 governed evidence")).toHaveLength(2);
    expect(screen.getAllByText(/Governance approved · Template v3\.5/)).toHaveLength(2);
    expect(screen.getByText("OGI_F002_FACILITY_PROFILE")).toBeVisible();
    expect(screen.getAllByText(/Submitted/)).toHaveLength(2);
    expect(screen.getAllByRole("link", { name: "View evidence before binding" })[1]).toHaveAttribute("href", routes.evidenceRecordPath(candidates[1].id));
    expect(screen.getByRole("button", { name: "Bind selected evidence" })).toBeDisabled();

    await user.click(screen.getByRole("radio", { name: /00000002/ }));
    await user.click(screen.getByRole("button", { name: "Bind selected evidence" }));

    expect(onBind).toHaveBeenCalledOnce();
    expect(onBind).toHaveBeenCalledWith(candidates[1]);
  });

  it("removes already-bound candidates and explains when all eligible evidence is bound", () => {
    render(<MemoryRouter><EligibleEvidenceChoices busy={false} candidates={candidates} formCode="F002" onBind={vi.fn()} onSelect={vi.fn()} selectedId="" unavailableIds={candidates.map((candidate) => candidate.id)} /></MemoryRouter>);
    expect(screen.getByText("All eligible evidence is already bound.")).toBeVisible();
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
  });

  it("offers explicit Emergency derivation when no derived candidate exists", async () => {
    const user = userEvent.setup(), onDerive = vi.fn();
    render(<MemoryRouter><EligibleEvidenceChoices busy={false} candidates={[]} formCode="F100" onBind={vi.fn()} onDerive={onDerive} onSelect={vi.fn()} selectedId="" unavailableIds={[]} /></MemoryRouter>);
    expect(screen.getByText("No governed evidence is eligible at this assessment cutoff.")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Prepare governed F100 assessment" }));
    expect(onDerive).toHaveBeenCalledOnce();
  });
});
