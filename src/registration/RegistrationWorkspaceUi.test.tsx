import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { formatRegistrationDate, formatRegistrationDateTime } from "./registrationPresentation";
import {
  RegistrationDirectoryItem,
  RegistrationDirectoryPane,
  RegistrationEditableSection,
  RegistrationEntityHeader,
  RegistrationMetadataGroup,
  RegistrationMetadataItem,
  RegistrationStatusBadge,
  RegistrationWorkspaceFrame
} from "./RegistrationWorkspaceUi";

describe("Registration workspace presentation", () => {
  it.each([
    "Client Records",
    "Facility Records",
    "Personnel Records",
    "Trainee Records"
  ])("renders the approved Title Case collection heading %s", (title) => {
    render(
      <RegistrationDirectoryPane description="Choose a record." title={title}>
        <ul aria-label={`${title} list`}><li>Record</li></ul>
      </RegistrationDirectoryPane>
    );
    expect(screen.getByRole("heading", { name: title })).toBeVisible();
  });

  it("contains the directory independently on desktop and leaves the detail pane in normal flow", () => {
    render(
      <RegistrationWorkspaceFrame
        directory={
          <RegistrationDirectoryPane description="Choose a record." title="Client Records">
            <ul aria-label="Client records">
              <li>Ocean Guard International</li>
            </ul>
          </RegistrationDirectoryPane>
        }
        workspace={<section>Client details</section>}
      />
    );

    expect(screen.getByTestId("registration-workspace-frame")).toHaveClass("grid");
    expect(screen.getByTestId("registration-directory-scroll-region"))
      .toHaveClass("lg:overflow-y-auto", "overscroll-contain");
    expect(screen.getByTestId("registration-detail-pane"))
      .not.toHaveClass("sticky", "overflow-y-auto");
    const divider = screen.getByTestId("registration-workspace-divider");
    expect(divider).toHaveAttribute("aria-hidden", "true");
    expect(divider).toHaveClass("hidden", "lg:block");
  });

  it("exposes selected state independently from keyboard focus styling", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <RegistrationDirectoryItem isSelected onSelect={onSelect}>
        Ocean Guard International
      </RegistrationDirectoryItem>
    );

    const item = screen.getByRole("button", { name: "Ocean Guard International" });
    expect(item).toHaveAttribute("aria-pressed", "true");
    expect(item).not.toHaveAttribute("aria-current");
    expect(item).toHaveClass("border-l-4", "bg-[var(--cl-workspace-selected)]", "focus-visible:ring-2");
    await user.click(item);
    expect(onSelect).toHaveBeenCalledOnce();
  });

  it.each([
    ["ACTIVE", "Active", "healthy"],
    ["INACTIVE", "Inactive", "neutral"],
    ["SUSPENDED", "Suspended", "attention"],
    ["TERMINATED", "Terminated", "neutral"],
    ["SEASONAL", "Seasonal", "neutral"],
    ["UNDER_MAINTENANCE", "Under Maintenance", "warning"],
    ["PENDING_APPROVAL", "Pending Approval", "warning"]
  ])("renders %s as visible non-interactive %s status", (value, label, tone) => {
    render(<RegistrationStatusBadge value={value} />);
    const badge = screen.getByText(label);

    expect(badge).toBeVisible();
    expect(badge).toHaveAttribute("data-status-tone", tone);
    expect(badge).not.toHaveAttribute("role", "button");
    expect(badge).not.toHaveAttribute("tabindex");
  });

  it("keeps an unknown status visible with a safe neutral treatment", () => {
    render(<RegistrationStatusBadge value="FUTURE_STATE" />);
    const badge = screen.getByText("Future State");

    expect(badge).toBeVisible();
    expect(badge).toHaveAttribute("data-status-tone", "neutral");
  });

  it("humanizes display dates without changing the supplied authority value", () => {
    const timestamp = "2026-08-01T00:00:00.000Z";
    const dateOnly = "2026-08-01";
    const timestampDisplay = formatRegistrationDateTime(timestamp);
    const dateDisplay = formatRegistrationDate(dateOnly);

    expect(timestampDisplay).not.toContain("T00:00:00.000Z");
    expect(dateDisplay).not.toBe(dateOnly);
    expect(timestamp).toBe("2026-08-01T00:00:00.000Z");
    expect(dateOnly).toBe("2026-08-01");
  });

  it.each([
    ["2026-01-31", true],
    ["2024-02-29", true],
    ["2000-02-29", true],
    ["1900-02-29", false],
    ["2026-02-29", false],
    ["2026-02-31", false],
    ["2026-13-01", false],
    ["2026-00-10", false],
    ["2026-01-00", false],
    ["not-a-date", false],
    ["", false],
    [null, false]
  ])("validates the date-only calendar value %s", (value, valid) => {
    const display = formatRegistrationDate(value);
    expect(display === "Not recorded").toBe(!valid);
    if (valid) expect(value).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("labels the bounded record collection without owning domain controls", () => {
    render(
      <RegistrationDirectoryPane description="Choose a person." title="Personnel Records">
        <ul aria-label="Personnel records">
          <li>Marvin Alcantara</li>
        </ul>
      </RegistrationDirectoryPane>
    );
    const heading = screen.getByRole("heading", { name: "Personnel Records" });
    const region = screen.getByRole("region", { name: "Personnel Records directory" });
    expect(within(region).getByRole("list", { name: "Personnel records" })).toBeVisible();
    expect(region).not.toContainElement(heading);
    expect(region).not.toHaveTextContent(/save|deactivate|permission/i);
  });

  it("separates operational identity, administrative metadata, and editable content", () => {
    render(
      <div>
        <RegistrationEntityHeader
          heading="Personnel details"
          identity="Marvin Alcantara"
          secondary="Ocean Guard International · marvin@example.test"
          status="ACTIVE"
        />
        <RegistrationMetadataGroup>
          <RegistrationMetadataItem
            label="Administrative Personnel ID"
            subtle
            value="00000000-0000-4000-8000-000000000001"
          />
        </RegistrationMetadataGroup>
        <RegistrationEditableSection title="Employment profile">
          <label>
            Full name
            <input defaultValue="Marvin Alcantara" />
          </label>
        </RegistrationEditableSection>
      </div>
    );

    expect(screen.getByRole("heading", { name: "Marvin Alcantara" })).toBeVisible();
    const administrativeHeading = screen.getByText("Administrative details");
    expect(administrativeHeading).toBeVisible();
    expect(administrativeHeading.closest("[data-registration-section]"))
      .toHaveAttribute("data-registration-section", "administrative");
    expect(screen.getByText("00000000-0000-4000-8000-000000000001"))
      .not.toBe(screen.getByRole("heading", { name: "Marvin Alcantara" }));
    const operationalHeading = screen.getByRole("heading", { name: "Employment profile" });
    expect(operationalHeading).toBeVisible();
    expect(operationalHeading.closest("[data-registration-section]"))
      .toHaveAttribute("data-registration-section", "operational");
    expect(screen.getByLabelText("Full name")).toHaveValue("Marvin Alcantara");
  });
});
