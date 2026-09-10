export function humanizeEvidenceTemplateCode(value: string) {
  return value
    .replace(/^OGI_/, "")
    .split("_")
    .map((part) => (/^F\d+$/.test(part) ? part : `${part.charAt(0)}${part.slice(1).toLowerCase()}`))
    .join(" ");
}

export function formatEvidenceDateTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Date unavailable"
    : new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export function evidenceLifecycleStyle(value: string) {
  if (value === "DRAFT") {
    return { accent: "border-l-evidence-draft", surface: "bg-evidence-draft-bg", badge: "border-evidence-draft bg-white text-evidence-draft" };
  }
  if (["APPROVED", "GOVERNANCE_APPROVED", "INTAKE_APPROVED"].includes(value)) {
    return { accent: "border-l-evidence-approved", surface: "bg-evidence-approved-bg", badge: "border-evidence-approved bg-white text-evidence-approved" };
  }
  if (["REJECTED", "RETURNED", "VOID", "REVOKED"].includes(value)) {
    return { accent: "border-l-evidence-exception", surface: "bg-evidence-exception-bg", badge: "border-evidence-exception bg-white text-evidence-exception" };
  }
  return { accent: "border-l-evidence-review", surface: "bg-evidence-review-bg", badge: "border-evidence-review bg-white text-evidence-review" };
}
