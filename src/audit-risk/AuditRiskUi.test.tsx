import { readFile } from "node:fs/promises";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AuditRiskPageHeader, AuditRiskRecordCard, AuditRiskRecordCollection, AuditRiskStatusBadge } from "./AuditRiskUi";

describe("Audit & Risk shared visual primitives", () => {
  it("preserves a semantic page heading and visible status text", () => {
    render(<AuditRiskPageHeader eyebrow="Audit & Risk" headingId="audit-heading" status={<AuditRiskStatusBadge value="IN_PROGRESS" />} title="AUDIT-2026-000001" />);
    expect(screen.getByRole("heading", { level: 1, name: "AUDIT-2026-000001" })).toHaveAttribute("id", "audit-heading");
    expect(screen.getByText("In Progress")).toBeVisible();
  });

  it("renders unknown future status values visibly with a neutral treatment", () => {
    render(<AuditRiskStatusBadge value="FUTURE_AUTHORITY_STATE" />);
    expect(screen.getByText("Future Authority State")).toHaveClass("bg-elevated");
  });

  it("keeps record containment semantic", () => {
    render(<AuditRiskRecordCollection label="Governed records"><li><AuditRiskRecordCard labelledBy="record-heading"><h2 id="record-heading">Governed record</h2></AuditRiskRecordCard></li></AuditRiskRecordCollection>);
    expect(screen.getByRole("list", { name: "Governed records" })).toBeInTheDocument();
    expect(screen.getByRole("article", { name: "Governed record" })).toBeInTheDocument();
  });

  it("does not couple the Audit visual system to OETS or template-specific branches", async () => {
    const source = await readFile("src/audit-risk/AuditRiskUi.tsx", "utf8");
    expect(source).not.toMatch(/Oets|OETS|template_code\s*===|audit\.id\s*===/);
  });
});
