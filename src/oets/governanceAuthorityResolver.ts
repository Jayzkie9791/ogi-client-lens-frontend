export function resolveGovernanceAuthorityCode(stateCode: string) {
  if (stateCode === "GOVERNANCE_APPROVED") {
    return "OETS_GOVERNANCE_APPROVER";
  }

  // UNDER_REVIEW is the ordinary review lifecycle state, not an authority
  // named "UNDER". It must be entered through the direct workflow action.
  if (stateCode === "UNDER_REVIEW") {
    return null;
  }

  // Compatibility convention for frozen OETS v1.0 workflow metadata. The
  // canonical schema does not expose an explicit workflow authority field.
  const underReview = /^UNDER_([A-Z0-9]+)_REVIEW$/.exec(stateCode);

  if (underReview) {
    return underReview[1];
  }

  const review = /^([A-Z0-9]+)_REVIEW$/.exec(stateCode);

  return review?.[1] ?? null;
}
