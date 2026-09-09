import { createRef, FormEvent } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SelectableCard } from "./SelectableCard";
import { WorkflowContentCard, WorkflowModal } from "./WorkflowModal";

describe("shared Client Lens workflow visual language", () => {
  it("renders one governed modal shell with progress, content, and submission footer", () => {
    const submit = vi.fn((event: FormEvent) => event.preventDefault());
    render(<WorkflowModal currentStep={1} dialogRef={createRef<HTMLDivElement>()} eyebrow="Test workflow" footer={<button type="submit">Continue</button>} onKeyDown={() => undefined} onSubmit={submit} steps={[{ key: "one", label: "One" }, { key: "two", label: "Two" }, { key: "three", label: "Three" }]} title="Shared workflow" titleId="shared-workflow-title">
      <WorkflowContentCard currentLabel="Two" stepNumber={2} totalSteps={3}>Governed content</WorkflowContentCard>
    </WorkflowModal>);

    expect(screen.getByRole("dialog", { name: "Shared workflow" })).toHaveAttribute("aria-modal", "true");
    expect(screen.getByRole("list", { name: "Registration progress" })).toBeInTheDocument();
    expect(screen.getByText("Current step: Two")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(submit).toHaveBeenCalledOnce();
  });

  it("keeps an entire selectable card associated with its native control", () => {
    render(<SelectableCard selected><input name="choice" type="radio" />Existing authority</SelectableCard>);
    expect(screen.getByRole("radio", { name: "Existing authority" })).toBeInTheDocument();
  });
});
