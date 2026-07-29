interface WorkflowLabelInput {
  label: string;
  to: string;
  trigger: string;
}

const lifecycleStatusLabels = new Map([
  ["DRAFT", "Draft"],
  ["SUBMITTED", "Awaiting Review"],
  ["UNDER_OGI_REVIEW", "Under Review"],
  ["INTAKE_APPROVED", "Audit Approved"],
  ["ROUTED_FOR_ASSESSMENT_OR_AUDIT", "Approved for Risk Assessment"],
  ["ACTIVATED_OR_CLOSED", "Completed"],
  ["ARCHIVED", "Archived"]
]);

const workflowActionLabels = new Map([
  ["submit_intake_request", "Submit Audit"],
  ["begin_ogi_review", "Start Review"],
  ["request_clarification", "Return for Clarification"],
  ["resubmit_clarified_intake", "Resubmit Audit"],
  ["approve_intake", "Approve Audit"],
  ["route_to_service_pathway", "Send to Risk Assessment"],
  ["activate_or_close_intake", "Complete"],
  ["archive_evidence", "Archive"]
]);

export function displayLifecycleStatus(stateCode: string) {
  return lifecycleStatusLabels.get(stateCode) ?? humanizeCode(stateCode);
}

export function displayWorkflowActionLabel(transition: WorkflowLabelInput) {
  return workflowActionLabels.get(transition.trigger) ?? transition.label;
}

export function displayReviewAuthority(authorityCode: string) {
  return authorityCode === "OGI" ? "OGI" : humanizeCode(authorityCode);
}

function humanizeCode(value: string) {
  return value
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}
