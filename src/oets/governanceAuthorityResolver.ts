export function resolveGovernanceAuthorityCode(stateCode: string) {
  // Compatibility convention for frozen OETS v1.0 workflow metadata. The
  // canonical schema does not expose an explicit workflow authority field.
  const underReview = /^UNDER_([A-Z0-9]+)_REVIEW$/.exec(stateCode);

  if (underReview) {
    return underReview[1];
  }

  const review = /^([A-Z0-9]+)_REVIEW$/.exec(stateCode);

  return review?.[1] ?? null;
}
