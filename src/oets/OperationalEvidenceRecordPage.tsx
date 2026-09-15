import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";

import { isApiError } from "../api/errors";
import { routes } from "../app/routePaths";
import { useAuth } from "../auth/useAuth";
import { Button } from "../ui/components/Button";
import { Surface } from "../ui/components/Surface";
import { narrowOetsDefinition } from "./definitionGuards";
import { isOetsDeveloperDiagnosticsEnabled } from "./developerDiagnostics";
import {
  displayLifecycleStatus,
  displayReviewAuthority,
  displayWorkflowActionLabel
} from "./displayLabels";
import {
  getOperationalEvidenceRecord,
  createOperationalEvidenceCorrectionDraft,
  createOperationalEvidenceRevisionDraft,
  discardOperationalEvidenceDraft,
  OperationalEvidenceRecord,
  transitionOperationalEvidenceRecord,
  updateDraftOperationalEvidencePayload
} from "./evidenceSubmissionApi";

import {
  claimGovernanceReview,
  getEvidenceRecordActionProjection,
  GovernanceReviewClaim,
  releaseGovernanceReviewClaim
} from "./governanceApi";
import {
  CurrentReviewConclusionResponse,
  getCurrentReviewConclusion,
  getReviewConclusion,
  listReviewConclusionHistory,
  ReviewConclusion,
  ReviewConclusionHistoryResponse,
  ReviewConclusionQueryContext,
  transitionClaimedGovernanceReviewWithConclusion
} from "./reviewConclusionApi";

import { OetsFieldVisibilityPolicy, OetsRenderer } from "./OetsRenderer";
import { OetsContextFieldPolicy } from "./contextApi";
import { mapBackendValidationDetails } from "./evidenceValidation";
import { getRuntimeTemplateVersion } from "./runtimeTemplateApi";
import { evidenceReturnDestination, evidenceReturnLabel, readEvidenceReturnContext } from "./evidenceReturnContext";
import { resolveGovernanceAuthorityCode } from "./governanceAuthorityResolver";
import { OetsDefinition, OetsEvidencePayload, OetsFieldValue } from "./types";
import {
  createEvidenceAttestation,
  CreateEvidenceAttestationRequest,
  EvidenceAttestation,
  listEvidenceAttestations
} from "./attestationApi";

const trainingAssessmentNumberFieldCode = "ASSESSMENT_NUMBER";
const trainingAssessmentNumberTemplateCodes = new Set([
  "OGI_F023_OPERATIONAL_SKILLS_ASSESSMENT",
  "OGI_F024_OPERATIONAL_KNOWLEDGE_ASSESSMENT_RECORD",
  "OGI_F025_OPERATIONAL_READINESS_EVALUATION"
]);
const f025ImportedFieldsBySection = new Map<string, ReadonlySet<string>>([
  ["PERSONNEL_INFORMATION", new Set(["PERSONNEL_NUMBER", "EMPLOYEE_ID", "PERSONNEL_NAME", "ORGANIZATION", "POSITION", "SUPERVISOR", "CLIENT_NUMBER", "FACILITY_NUMBER", "EVALUATION_DATE", "EVALUATOR"])],
  ["TRAINING_COMPLIANCE_REVIEW", new Set(["COURSE_NUMBER", "COURSE_TITLE", "ATTENDANCE_REQUIREMENT_MET", "ATTENDANCE_PERCENTAGE", "ATTENDANCE_STATUS_IMPORTED_FROM_F_022"])],
  ["OPERATIONAL_COMPETENCY_REVIEW", new Set(["OPERATIONAL_COMPETENCY_SCORE_OCS", "SKILLS_ASSESSMENT_STATUS", "CRITICAL_DEFICIENCIES_IDENTIFIED", "OPERATIONAL_RESTRICTIONS_RECOMMENDED"])],
  ["KNOWLEDGE_COMPETENCY_REVIEW", new Set(["OPERATIONAL_KNOWLEDGE_SCORE_OKS", "KNOWLEDGE_ASSESSMENT_STATUS", "KNOWLEDGE_DEFICIENCIES_IDENTIFIED"])],
  ["FINAL_AUTHORIZATION", new Set(["EVALUATOR_NAME", "EVALUATOR_NUMBER"])]
]);
const trainingAssessmentDerivedFieldCodes = new Set([
  trainingAssessmentNumberFieldCode,
  "COURSE_NUMBER",
  "PERSONNEL_NUMBER",
  "PERSONNEL_NAME",
  "CLIENT_NUMBER",
  "FACILITY_NUMBER",
  "ASSESSMENT_LOCATION",
  "ASSESSOR_NAME",
  "ASSESSOR_NUMBER",
  "PROCTOR_NAME",
  "PROCTOR_NUMBER"
]);
const trainingAssessmentCalculatedSectionsByTemplate = new Map<string, Set<string>>([
  [
    "OGI_F023_OPERATIONAL_SKILLS_ASSESSMENT",
    new Set(["OPERATIONAL_COMPETENCY_SCORE_OCS"])
  ],
  [
    "OGI_F024_OPERATIONAL_KNOWLEDGE_ASSESSMENT_RECORD",
    new Set(["OPERATIONAL_KNOWLEDGE_SCORE_OKS"])
  ]
]);

const emptyTrainingContextualFieldPolicyByTemplate = new Map<string, Set<string>>([
  [
    "OGI_F023_OPERATIONAL_SKILLS_ASSESSMENT",
    new Set([
      "COURSE_NUMBER",
      "PERSONNEL_NUMBER",
      "CLIENT_NUMBER",
      "FACILITY_NUMBER",
      "ASSESSOR_NUMBER",
      "ASSESSMENT_LOCATION"
    ])
  ],
  [
    "OGI_F024_OPERATIONAL_KNOWLEDGE_ASSESSMENT_RECORD",
    new Set([
      "COURSE_NUMBER",
      "PERSONNEL_NUMBER",
      "CLIENT_NUMBER",
      "FACILITY_NUMBER",
      "ASSESSMENT_LOCATION"
    ])
  ],
  [
    "OGI_F025_OPERATIONAL_READINESS_EVALUATION",
    new Set([
      "TRAINING_REQUEST_NUMBER",
      "COURSE_NUMBER",
      "PERSONNEL_NUMBER",
      "CLIENT_NUMBER",
      "FACILITY_NUMBER"
    ])
  ]
]);

interface WorkflowTransition {
  from: string;
  to: string;
  trigger: string;
  label: string;
}

interface GovernanceWorkflowTransition extends WorkflowTransition {
  governanceAuthorityCode: string;
}

interface GovernanceReviewActionState {
  transition: GovernanceWorkflowTransition;
  activeClaim: GovernanceReviewClaim | null;
  claimedByName: string | null;
}

interface ReviewConclusionContextState {
  governanceAuthorityCode: string;
  context: ReviewConclusionQueryContext;
}

interface ClaimedReviewConclusionInput {
  claim: GovernanceReviewClaim;
  transition: GovernanceWorkflowTransition;
  rationale: string;
}

export function OperationalEvidenceRecordPage({
  embeddedRecordId,
  onDirtyChange,
  actionPortalId = "training-journey-record-actions"
}: {
  readonly embeddedRecordId?: string;
  readonly onDirtyChange?: (dirty: boolean) => void;
  readonly actionPortalId?: string;
} = {}) {
  const location = useLocation();
  const [draftDirty, setDraftDirty] = useState(false);
  const [embeddedActionTarget, setEmbeddedActionTarget] = useState<HTMLElement | null>(null);
  const { recordId: routeRecordId } = useParams();
  const recordId = embeddedRecordId ?? routeRecordId;
  const durableReturnContext = !embeddedRecordId ? readEvidenceReturnContext(location.search) : null;
  const legacyReturnDestination = !embeddedRecordId && !durableReturnContext &&
    (location.state?.returnTo === routes.facilityAssessmentJourneys || location.state?.returnTo === routes.registrationTraining)
    ? (location.state.returnTo as typeof routes.facilityAssessmentJourneys | typeof routes.registrationTraining)
    : null;
  const auth = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [rationaleByTransitionKey, setRationaleByTransitionKey] = useState<
    Record<string, string>
  >({});
  const [selectedConclusionId, setSelectedConclusionId] = useState<string | null>(null);
  useEffect(() => {
    setEmbeddedActionTarget(
      embeddedRecordId ? document.getElementById(actionPortalId) : null
    );
  }, [actionPortalId, embeddedRecordId]);
  const recordQuery = useQuery({
    enabled: Boolean(recordId),
    queryKey: ["operational-evidence-record", recordId],
    queryFn: () => getOperationalEvidenceRecord(recordId ?? "")
  });
  const record = recordQuery.data;
  const actionProjectionQueryKey = ["operational-evidence-record-actions", record?.id] as const;
  const actionProjectionQuery = useQuery({
    enabled: Boolean(record?.id),
    queryKey: actionProjectionQueryKey,
    queryFn: () => getEvidenceRecordActionProjection(record?.id ?? "")
  });
  const templateVersionId = record?.template_provenance.template_version_id;
  const templateQuery = useQuery({
    enabled: Boolean(templateVersionId),
    queryKey: ["oets-runtime-template-version", templateVersionId],
    queryFn: () => getRuntimeTemplateVersion(templateVersionId ?? "")
  });
  const narrowing = templateQuery.data
    ? narrowOetsDefinition(templateQuery.data.definition_jsonb)
    : undefined;
  const availableTransitions =
    record && narrowing?.definition
      ? findAvailableTransitions(narrowing.definition, record.lifecycle_state)
      : [];

  const directTransitions = (actionProjectionQuery.data?.actions ?? [])
    .filter((action) => action.action === "TRANSITION" && action.transition_trigger && action.target_state)
    .map((action) => {
      // Availability is exclusively backend-authorized. The matching template
      // transition contributes presentation metadata only, because the action
      // projection intentionally contains governed identity rather than UI copy.
      const declared = availableTransitions.find((transition) =>
        transition.trigger === action.transition_trigger &&
        transition.to === action.target_state
      );
      return {
        from: record?.lifecycle_state ?? "",
        to: action.target_state!,
        trigger: action.transition_trigger!,
        label: declared?.label ?? action.transition_trigger!
      };
    });
  const correctionAction = (actionProjectionQuery.data?.actions ?? []).find((action) =>
    action.action === "CREATE_CORRECTION_DRAFT" || action.action === "CONTINUE_CORRECTION_DRAFT"
  );
  const revisionAction = (actionProjectionQuery.data?.actions ?? []).find((action) =>
    action.action === "CREATE_REVISION_DRAFT" || action.action === "CONTINUE_REVISION_DRAFT"
  );
  const correctionMutation = useMutation({
    mutationFn: () => {
      if (!record) throw new Error("Returned evidence is required.");
      return createOperationalEvidenceCorrectionDraft(record.id);
    },
    onSuccess: (draft) => navigate({ pathname: routes.evidenceRecordPath(draft.id), search: location.search }, { state: location.state })
  });
  const revisionMutation = useMutation({
    mutationFn: () => {
      if (!record) throw new Error("Submitted F-100 evidence is required.");
      return createOperationalEvidenceRevisionDraft(record.id);
    },
    onSuccess: (draft) => navigate({ pathname: routes.evidenceRecordPath(draft.id), search: location.search }, { state: location.state })
  });
  const governanceTransitions = Array.from(new Map(
    (actionProjectionQuery.data?.actions ?? [])
      .filter((action) => action.governance_authority_code && action.transition_trigger && action.target_state)
      .map((action) => {
        const transition: GovernanceWorkflowTransition = {
          from: record?.lifecycle_state ?? "",
          to: action.target_state!,
          trigger: action.transition_trigger!,
          label: action.transition_trigger!,
          governanceAuthorityCode: action.governance_authority_code!
        };
        return [`${transition.governanceAuthorityCode}:${transition.trigger}`, transition] as const;
      })
  ).values());
  const governanceActionStates = governanceTransitions.map((transition) => {
    const projected = actionProjectionQuery.data?.actions.find((action) =>
      action.governance_authority_code === transition.governanceAuthorityCode &&
      action.transition_trigger === transition.trigger
    );
    return {
      transition,
      activeClaim: projected?.review_claim ?? null,
      claimedByName: projected?.claimed_by_name ?? null
    };
  }).filter(() => !actionProjectionQuery.isError && Boolean(actionProjectionQuery.data));
  const governanceClaimOwnedByAnother = governanceActionStates.some(
    ({ activeClaim }) => activeClaim && activeClaim.claimed_by_user_id !== auth.session?.id
  );
  const reviewConclusionContext =
    record && narrowing?.definition
      ? findReviewConclusionContext(narrowing.definition, record)
      : null;
  const reviewConclusionQueryKeyPart = reviewConclusionContext
    ? reviewConclusionContextKeyPart(reviewConclusionContext.context)
    : null;
  const hasCompletedGovernanceContext = Boolean(
    record &&
      reviewConclusionContext &&
      record.lifecycle_state ===
        reviewConclusionContext.context.target_lifecycle_state
  );
  const shouldLoadReviewConclusions =
    Boolean(selectedConclusionId) || hasCompletedGovernanceContext;
  const canSubmitReviewConclusion =
    auth.canUsePermission("view_operational_evidence") &&
    auth.canUsePermission("transition_operational_evidence");
  const reviewConclusionHistoryQuery = useQuery({
    enabled: Boolean(record && reviewConclusionContext && reviewConclusionQueryKeyPart && shouldLoadReviewConclusions),
    queryKey: [
      "operational-evidence-review-conclusion-history",
      record?.id,
      reviewConclusionQueryKeyPart
    ],
    queryFn: () => {
      if (!record || !reviewConclusionContext) {
        throw new Error("Audit record and review context are required before loading Review Conclusions.");
      }

      return listReviewConclusionHistory(record.id, reviewConclusionContext.context);
    }
  });
  const currentReviewConclusionQuery = useQuery({
    enabled: Boolean(record && reviewConclusionContext && reviewConclusionQueryKeyPart && shouldLoadReviewConclusions),
    queryKey: [
      "operational-evidence-current-review-conclusion",
      record?.id,
      reviewConclusionQueryKeyPart
    ],
    queryFn: () => {
      if (!record || !reviewConclusionContext) {
        throw new Error("Audit record and review context are required before loading the current Review Conclusion.");
      }

      return getCurrentReviewConclusion(record.id, reviewConclusionContext.context);
    }
  });
  const selectedReviewConclusionQuery = useQuery({
    enabled: Boolean(record && selectedConclusionId),
    queryKey: [
      "operational-evidence-review-conclusion",
      record?.id,
      selectedConclusionId
    ],
    queryFn: () => {
      if (!record || !selectedConclusionId) {
        throw new Error("Audit record and Review Conclusion ID are required before loading the Review Conclusion.");
      }

      return getReviewConclusion(record.id, selectedConclusionId);
    }
  });
  const transitionMutation = useMutation({
    mutationFn: (transition: WorkflowTransition) =>
      transitionOperationalEvidenceRecord(recordId ?? "", {
        transition_trigger: transition.trigger
      }),
    onSuccess() {
      void queryClient.invalidateQueries({
        queryKey: ["operational-evidence-record", recordId]
      });
      void queryClient.invalidateQueries({ queryKey: ["operational-evidence-record-actions", recordId] });
    }
  });
  const discardMutation = useMutation({
    mutationFn: () => {
      if (!record) throw new Error("Draft record is unavailable.");
      return discardOperationalEvidenceDraft(record.id, {
        expected_payload_checksum: record.payload_checksum,
        idempotency_key: `discard:${record.id}:${record.payload_checksum}`
      });
    },
    onSuccess(discarded) {
      queryClient.setQueryData(["operational-evidence-record", recordId], discarded);
      void queryClient.invalidateQueries({ queryKey: ["operational-evidence-record", recordId] });
      void queryClient.invalidateQueries({ queryKey: ["operational-evidence-record-actions", recordId] });
    }
  });
  const attestationQueryKey = [
    "operational-evidence-attestations",
    record?.id,
    record?.payload_checksum
  ] as const;
  const attestationQuery = useQuery({
    enabled: Boolean(
      record?.id &&
      narrowing?.definition &&
      hasGovernedAttestationFields(narrowing.definition)
    ),
    queryKey: attestationQueryKey,
    queryFn: () => listEvidenceAttestations(record?.id ?? "")
  });
  const draftPayloadMutation = useMutation({
    mutationFn: (payload: OetsEvidencePayload) =>
      updateDraftOperationalEvidencePayload(recordId ?? "", { payload }),
    onSuccess(updatedRecord) {
      setDraftDirty(false);
      onDirtyChange?.(false);
      queryClient.setQueryData(
        ["operational-evidence-record", recordId],
        updatedRecord
      );
      void queryClient.invalidateQueries({
        queryKey: ["operational-evidence-attestations", updatedRecord.id]
      });
      void queryClient.invalidateQueries({ queryKey: ["operational-evidence-record-actions", updatedRecord.id] });
    }
  });
  const attestationMutation = useMutation({
    mutationFn: (request: CreateEvidenceAttestationRequest) =>
      createEvidenceAttestation(recordId ?? "", request),
    onSuccess(attestation) {
      queryClient.setQueryData<{ attestations: (typeof attestation)[] }>(
        attestationQueryKey,
        (current) => ({
          attestations: [
            ...(current?.attestations.filter((item) => item.id !== attestation.id) ?? []),
            attestation
          ]
        })
      );
      void queryClient.invalidateQueries({
        queryKey: ["operational-evidence-attestations", recordId]
      });
      void queryClient.invalidateQueries({ queryKey: ["operational-evidence-record-actions", recordId] });
    }
  });

  const claimMutation = useMutation({
    mutationFn: (transition: GovernanceWorkflowTransition) => {
      if (!record) {
        throw new Error("Audit record is required before assigning review.");
      }

      return claimGovernanceReview({
        evidence_record_id: record.id,
        governance_authority_code: transition.governanceAuthorityCode,
        transition_trigger: transition.trigger
      });
    },
    onError(error) {
      if (isApiError(error) && error.status === 409) {
        void queryClient.invalidateQueries({ queryKey: actionProjectionQueryKey });
      }
    },
    onSuccess() {
      void queryClient.invalidateQueries({ queryKey: actionProjectionQueryKey });
    }
  });
  const releaseClaimMutation = useMutation({
    mutationFn: (claim: GovernanceReviewClaim) =>
      releaseGovernanceReviewClaim(claim.id),
    onSuccess() {
      void queryClient.invalidateQueries({ queryKey: actionProjectionQueryKey });
    }
  });
  const claimedTransitionMutation = useMutation({
    mutationFn: ({ claim, transition, rationale }: ClaimedReviewConclusionInput) => {
      if (!record) {
        throw new Error("Audit record is required before submitting a Review Conclusion.");
      }

      return transitionClaimedGovernanceReviewWithConclusion(record.id, claim.id, {
        governance_authority_code: transition.governanceAuthorityCode,
        transition_trigger: transition.trigger,
        rationale
      });
    },
    onSuccess(result) {
      const context = reviewConclusionContextFromConclusion(result.conclusion);
      const keyPart = reviewConclusionContextKeyPart(context);

      setSelectedConclusionId(result.conclusion.id);
      queryClient.setQueryData<CurrentReviewConclusionResponse>(
        [
          "operational-evidence-current-review-conclusion",
          result.conclusion.reviewed_evidence_record_id,
          keyPart
        ],
        { conclusion: result.conclusion }
      );
      queryClient.setQueryData<ReviewConclusionHistoryResponse>(
        [
          "operational-evidence-review-conclusion-history",
          result.conclusion.reviewed_evidence_record_id,
          keyPart
        ],
        (existing) => ({
          conclusions: appendReviewConclusion(
            existing?.conclusions ?? [],
            result.conclusion
          )
        })
      );
      queryClient.setQueryData(
        [
          "operational-evidence-review-conclusion",
          result.conclusion.reviewed_evidence_record_id,
          result.conclusion.id
        ],
        result.conclusion
      );
      void queryClient.invalidateQueries({
        queryKey: ["operational-evidence-record", recordId]
      });
      void queryClient.invalidateQueries({
        queryKey: actionProjectionQueryKey
      });
    }
  });


  if (!recordId) {
    return (
      <SafeState title="Audit record ID is required.">
        Open an audit record route with a record ID.
      </SafeState>
    );
  }

  if (recordQuery.isLoading) {
    return <SafeState title="Loading audit record.">Please wait.</SafeState>;
  }

  if (recordQuery.isError) {
    return <RecordErrorState error={recordQuery.error} />;
  }

  if (!record) {
    return (
      <SafeState title="Audit record could not be loaded.">
        The backend did not return an audit record.
      </SafeState>
    );
  }

  if (templateQuery.isLoading) {
    return (
      <SafeState title="Loading audit template.">
        Please wait.
      </SafeState>
    );
  }

  if (templateQuery.isError) {
    return (
      <SafeState title="Audit record could not be displayed.">
        The audit template is unavailable.
      </SafeState>
    );
  }

  if (!templateQuery.data || !narrowing?.definition) {
    return (
      <SafeState title="Audit record could not be displayed.">
        {isOetsDeveloperDiagnosticsEnabled()
          ? (narrowing?.errors ?? ["definition_jsonb was not returned."]).join(" ")
          : "This audit definition cannot be displayed. Contact an administrator if the problem continues."}
      </SafeState>
    );
  }

  if (!templateMatchesRecord(record, templateQuery.data)) {
    return (
      <SafeState title="Audit record could not be displayed.">
        The audit template version does not match this record.
      </SafeState>
    );
  }

  const isDraftRecord = record.lifecycle_state === "DRAFT";
  const isDiscardedRecord = record.lifecycle_state === "DISCARDED";
  const renderedDefinition = applyExistingContextFieldPolicy(
    markTrainingAssessmentNumberReadonly(narrowing.definition, record),
    record.context?.field_policy
  );
  const fieldVisibilityPolicy = trainingContextualFieldVisibilityPolicy(record);
  const canEditDraft =
    isDraftRecord &&
    (record.template_provenance.template_code !==
      "OGI_F002_FACILITY_PROFILE_BASELINE_INTELLIGENCE_ASSESSMENT" ||
      record.created_by_user_id === auth.session?.id) &&
    (auth.canUsePermission("submit_operational_evidence") ||
      canEditOwnTrainingScopedDraft(record, auth));
  const isF002 = record.template_provenance.template_code ===
    "OGI_F002_FACILITY_PROFILE_BASELINE_INTELLIGENCE_ASSESSMENT";
  const f002ReadinessIssues = isF002
    ? readF002ReadinessIssues(record.payload, attestationQuery.data?.attestations ?? [], draftDirty)
    : [];
  const visibleDirectTransitions = isF002 && f002ReadinessIssues.length > 0
    ? directTransitions.filter((transition) => transition.trigger !== "FINALIZE_DRAFT")
    : directTransitions;
  const canAttestDraft =
    isDraftRecord && auth.canUsePermission("submit_operational_evidence");
  const canDiscardDraft = isDraftRecord && (
    record.created_by_user_id === auth.session?.id ||
    auth.canUsePermission("transition_operational_evidence")
  );
  const evidenceHeadingId = isDraftRecord
    ? "draft-evidence-heading"
    : "submitted-evidence-heading";
  const hasDeclaredOutgoingTransition = availableTransitions.length > 0;
  const lifecycleLabel = displayLifecycleStatus(record.lifecycle_state, {
    hasDeclaredOutgoingTransition
  });
  const evidenceHeading = isDraftRecord
    ? "Draft Evidence"
    : `${lifecycleLabel} Evidence`;
  const headerTransitions = draftDirty || draftPayloadMutation.isPending
    ? []
    : governanceClaimOwnedByAnother
      ? []
      : visibleDirectTransitions;
  const governanceReviewActions = (
    <GovernanceReviewActions
      actionStates={governanceActionStates}
      claimError={claimMutation.error}
      claimPending={claimMutation.isPending}
      claimedTransitionError={claimedTransitionMutation.error}
      claimedTransitionPending={claimedTransitionMutation.isPending}
      currentUserId={auth.session?.id ?? null}
      isLoadingClaimState={actionProjectionQuery.isLoading}
      loadClaimStateError={actionProjectionQuery.error}
      onClaim={(transition) => claimMutation.mutate(transition)}
      onRelease={(claim) => releaseClaimMutation.mutate(claim)}
      canSubmitConclusion={canSubmitReviewConclusion}
      currentConclusion={currentReviewConclusionQuery.data?.conclusion ?? null}
      onRationaleChange={(transition, rationale) =>
        setRationaleByTransitionKey((existing) => ({
          ...existing,
          [transitionKey(transition)]: rationale
        }))
      }
      onTransition={(claim, transition, rationale) =>
        claimedTransitionMutation.mutate({ claim, transition, rationale })
      }
      rationaleByTransitionKey={rationaleByTransitionKey}
      releaseError={releaseClaimMutation.error}
      releasePending={releaseClaimMutation.isPending}
    />
  );
  const standaloneReturnDestination = durableReturnContext
    ? evidenceReturnDestination(durableReturnContext)
    : legacyReturnDestination;
  const standaloneReturnLabel = durableReturnContext
    ? evidenceReturnLabel(durableReturnContext)
    : legacyReturnDestination === routes.registrationTraining
      ? "Back to Training"
      : "Back to Facility Assessment Journey";

  return (
    <div className="space-y-4">
      {standaloneReturnDestination && (!draftPayloadMutation.isSuccess || draftDirty) ? <div><Button onClick={() => { if (draftDirty && !window.confirm("Leave this evidence record with unsaved changes?")) return; navigate(standaloneReturnDestination); }} type="button" variant="secondary">← {standaloneReturnLabel}</Button></div> : null}
      {embeddedActionTarget ? createPortal(
        <>
          <span className={`inline-flex min-h-10 items-center rounded-component border px-3 text-sm font-semibold ${record.lifecycle_state === "GOVERNANCE_APPROVED" ? "border-green-300 bg-green-50 text-green-800" : "border-blue-200 bg-blue-50 text-primary-navy"}`}>
            {lifecycleLabel}
          </span>
          {headerTransitions.map((transition) => (
            <Button
              disabled={transitionMutation.isPending}
              key={`${transition.from}:${transition.trigger}:${transition.to}:header`}
              onClick={() => transitionMutation.mutate(transition)}
              variant={transition.to === "ARCHIVED" ? "secondary" : "primary"}
            >
              {transitionMutation.isPending ? "Updating…" : displayWorkflowActionLabel(transition)}
            </Button>
          ))}
          {correctionAction ? (
            <Button disabled={correctionMutation.isPending} onClick={() => correctionMutation.mutate()} variant="primary">
              {correctionMutation.isPending ? "Opening…" : correctionAction.action === "CONTINUE_CORRECTION_DRAFT" ? "Continue correction draft" : "Create correction draft"}
            </Button>
          ) : null}
          {revisionAction ? (
            <Button disabled={revisionMutation.isPending} onClick={() => revisionMutation.mutate()} variant="primary">
              {revisionMutation.isPending ? "Opening…" : revisionAction.action === "CONTINUE_REVISION_DRAFT" ? "Continue plan revision" : "Create plan revision"}
            </Button>
          ) : null}
          {governanceActionStates.length > 0 ? (
            <Button
              onClick={() => document.getElementById("embedded-governance-actions")?.scrollIntoView({ behavior: "smooth", block: "start" })}
              variant="primary"
            >
              Review Actions ↓
            </Button>
          ) : null}
        </>,
        embeddedActionTarget
      ) : null}
      {!embeddedRecordId ? <RecordIdentityPanel record={record} /> : null}
      {!embeddedRecordId && correctionAction ? (
        <Surface className="border-amber-300 bg-amber-50/60">
          <p className="font-semibold text-primary-navy">Correction successor required</p>
          <p className="mt-1 text-sm text-text-muted">This returned submission remains immutable. Continue in an editable correction draft.</p>
          <Button className="mt-3" disabled={correctionMutation.isPending} onClick={() => correctionMutation.mutate()}>
            {correctionMutation.isPending ? "Opening…" : correctionAction.action === "CONTINUE_CORRECTION_DRAFT" ? "Continue correction draft" : "Create correction draft"}
          </Button>
          {correctionMutation.error ? <p className="mt-2 text-sm text-red-700">{correctionMutation.error instanceof Error ? correctionMutation.error.message : "Correction draft could not be created."}</p> : null}
        </Surface>
      ) : null}
      {!embeddedRecordId && revisionAction ? (
        <Surface className="border-blue-300 bg-blue-50/60">
          <p className="font-semibold text-primary-navy">Plan revision available</p>
          <p className="mt-1 text-sm text-text-muted">The submitted F-100 remains immutable. Revise it in a linked Draft that preserves its governed Emergency Plan identity.</p>
          <Button className="mt-3" disabled={revisionMutation.isPending} onClick={() => revisionMutation.mutate()}>
            {revisionMutation.isPending ? "Opening…" : revisionAction.action === "CONTINUE_REVISION_DRAFT" ? "Continue plan revision" : "Create plan revision"}
          </Button>
          {revisionMutation.error ? <p className="mt-2 text-sm text-red-700">{revisionMutation.error instanceof Error ? revisionMutation.error.message : "Plan revision could not be created."}</p> : null}
        </Surface>
      ) : null}
      {!embeddedRecordId && record.lifecycle_state === "SUBMITTED" && record.template_provenance.template_code === "OGI_F100_EMERGENCY_PREPAREDNESS_OPERATIONAL_CONTINUITY_PLAN" ? (
        <Surface className="border-teal-300 bg-teal-50/60">
          <p className="font-semibold text-primary-navy">F-100 evidence is ready for assessment</p>
          <p className="mt-1 text-sm text-text-muted">Submission preserves the plan as evidence. The Emergency Preparedness Form Assessment and category final remain separate governed steps.</p>
          <Button asChild className="mt-3"><Link to={routes.facilityAssessmentJourneys}>Continue to Emergency Preparedness assessment →</Link></Button>
        </Surface>
      ) : null}
      {embeddedRecordId && governanceActionStates.length > 0 ? (
        <div className="scroll-mt-28" id="embedded-governance-actions">
          {governanceReviewActions}
        </div>
      ) : null}

      <section aria-labelledby={evidenceHeadingId} className="space-y-4">
        <div>
          {!embeddedRecordId ? (
            <p className="text-xs font-semibold uppercase tracking-wide text-primary-blue">
              Record Truth
            </p>
          ) : null}
          <h2
            className={`${embeddedRecordId ? "" : "mt-1"} text-xl font-semibold text-text-primary`}
            id={evidenceHeadingId}
          >
            {evidenceHeading}
          </h2>
          {!embeddedRecordId ? (
            <p className="mt-2 max-w-3xl text-sm leading-6 text-text-muted">
              {isDraftRecord
                ? "This Draft Operational Evidence record can be edited until it is submitted."
                : isDiscardedRecord
                  ? "This discarded Draft is preserved as read-only audit history and cannot be submitted or restored."
                  : "This read-only view presents the evidence payload submitted for this Operational Evidence record."}
            </p>
          ) : null}
        </div>

        {record.context ? <ExistingEvidenceContextBanner context={record.context} /> : null}
        {!record.context && record.scope_kind === "TRAINING_SCOPED" && record.training_context ? (
          <TrainingEvidenceContextBanner record={record} />
        ) : null}

        {isDraftRecord ? (
          <div aria-live="polite" className={`rounded-component border px-4 py-3 text-sm ${
            draftPayloadMutation.isError
              ? "border-red-300 bg-red-50 text-red-800"
              : draftDirty
                ? "border-amber-300 bg-amber-50 text-amber-900"
                : "border-blue-200 bg-blue-50 text-primary-navy"
          }`} data-testid="draft-save-state" role="status">
            {draftPayloadMutation.isPending
              ? "Saving Draft… Finalization is unavailable until the server confirms this save."
              : draftPayloadMutation.isError
                ? "Draft save failed. Your changes remain unsaved; correct the error and try again."
                : draftDirty
                  ? "Unsaved changes. Save Draft before finalizing."
                  : draftPayloadMutation.isSuccess
                    ? "Draft saved. No unsaved changes."
                    : "No unsaved changes."}
          </div>
        ) : null}

        {isDraftRecord && actionProjectionQuery.isLoading ? (
          <p className="text-sm text-text-muted" role="status">Loading available lifecycle actions…</p>
        ) : null}
        {isDraftRecord && actionProjectionQuery.isError ? (
          <div className="rounded-component border border-red-300 bg-red-50 p-3 text-sm text-red-800" role="alert">
            <p>Available lifecycle actions could not be loaded.</p>
            <Button className="mt-2" onClick={() => actionProjectionQuery.refetch()} variant="secondary">Retry actions</Button>
          </div>
        ) : null}
        {isDraftRecord && !draftDirty && !draftPayloadMutation.isPending && !actionProjectionQuery.isLoading && !actionProjectionQuery.isError && visibleDirectTransitions.length === 0 ? (
          <p className="rounded-component border border-border bg-elevated px-4 py-3 text-sm text-text-muted">No lifecycle action is currently available for this Draft and your authority.</p>
        ) : null}

        <OetsRenderer
          attestationContext={auth.session ? {
            evidenceRecordId: record.id,
            payloadChecksum: record.payload_checksum,
            templateVersionId: record.template_provenance.template_version_id,
            templateChecksum: record.template_provenance.checksum,
            actorDisplayName: auth.session.fullName
          } : undefined}
          attestationErrorMessage={
            attestationMutation.error
              ? attestationErrorMessage(attestationMutation.error)
              : attestationQuery.error
                ? "Governed attestation history could not be loaded."
                : undefined
          }
          attestationPending={attestationMutation.isPending}
          attestations={attestationQuery.data?.attestations ?? []}
          embedded={Boolean(embeddedRecordId)}
          actionPortalId={embeddedRecordId ? actionPortalId : undefined}
          definition={renderedDefinition}
          backendValidation={
            draftPayloadMutation.error &&
            isApiError(draftPayloadMutation.error) &&
            draftPayloadMutation.error.status === 422 &&
            draftPayloadMutation.error.code === "OEE_EVIDENCE_VALIDATION_FAILED"
              ? mapBackendValidationDetails(draftPayloadMutation.error.details)
              : null
          }
          formMessage={
            draftPayloadMutation.error
              ? draftPayloadErrorMessage(draftPayloadMutation.error)
              : undefined
          }
          initialPayload={record.payload}
          fieldVisibilityPolicy={fieldVisibilityPolicy}
          isSubmitting={draftPayloadMutation.isPending}
          onSubmit={canEditDraft ? (payload) => draftPayloadMutation.mutate(payload) : undefined}
          onAttest={canAttestDraft && !draftDirty && !draftPayloadMutation.isPending ? (request) => attestationMutation.mutateAsync(request) : undefined}
          onDirtyChange={(dirty) => { setDraftDirty(dirty); onDirtyChange?.(dirty); }}
          readOnly={!canEditDraft}
          runtimeTemplate={templateQuery.data}
          submitHelpText="Save Draft changes before submitting this Operational Evidence record."
          submitDisabledReason={!draftDirty ? "No unsaved changes." : null}
          submitLabel="Save Draft"
          submittingLabel="Saving..."
          submitSuccess={
            isDraftRecord && draftPayloadMutation.isSuccess
              ? {
                  evidenceRecordId: record.id,
                  lifecycleState: record.lifecycle_state,
                  payloadChecksum: record.payload_checksum,
                  ...(standaloneReturnDestination && !draftDirty ? { recordHref: standaloneReturnDestination } : {})
                }
              : null
          }
          submitSuccessMessage="Draft evidence saved."
          submitSuccessLinkLabel={`← ${standaloneReturnLabel}`}
        />
      </section>
      {isF002 && isDraftRecord ? <F002ReadinessPanel issues={f002ReadinessIssues} loadingAttestations={attestationQuery.isLoading} /> : null}
      {isF002 && !isDraftRecord ? <F002LifecyclePanel lifecycleState={record.lifecycle_state} /> : null}
      <WorkflowActions
        error={transitionMutation.error}
        isPending={transitionMutation.isPending}
        onTransition={(transition) => transitionMutation.mutate(transition)}

        transitions={embeddedRecordId ? [] : headerTransitions}
      />
      {canDiscardDraft ? (
        <Surface>
          <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Draft management</p>
          <p className="mt-1 text-sm text-text-muted">Discard this unsubmitted Draft without deleting its audit history.</p>
          <Button
            className="mt-3"
            disabled={draftDirty || draftPayloadMutation.isPending || discardMutation.isPending}
            onClick={() => {
              if (window.confirm("Discard this Draft? This preserves the record as read-only history and cannot be undone.")) {
                discardMutation.mutate();
              }
            }}
            type="button"
            variant="secondary"
          >
            {discardMutation.isPending ? "Discarding…" : "Discard Draft"}
          </Button>
          {discardMutation.isError ? <p className="mt-2 text-sm text-red-700" role="alert">Draft could not be discarded. Reload it and try again.</p> : null}
        </Surface>
      ) : null}
      <div className="scroll-mt-28" id={embeddedRecordId ? undefined : "embedded-governance-actions"}>
        {!embeddedRecordId ? governanceReviewActions : null}
        {shouldLoadReviewConclusions ? (
          <ReviewConclusionPanel
            context={reviewConclusionContext}
            currentConclusion={currentReviewConclusionQuery.data?.conclusion ?? null}
            currentError={currentReviewConclusionQuery.error}
            history={reviewConclusionHistoryQuery.data?.conclusions ?? []}
            historyError={reviewConclusionHistoryQuery.error}
            isLoadingCurrent={currentReviewConclusionQuery.isLoading}
            isLoadingHistory={reviewConclusionHistoryQuery.isLoading}
            onSelectConclusion={setSelectedConclusionId}
            selectedConclusion={selectedReviewConclusionQuery.data ?? null}
            selectedError={selectedReviewConclusionQuery.error}
            selectedId={selectedConclusionId}
          />
        ) : null}
      </div>

      {isOetsDeveloperDiagnosticsEnabled() && narrowing.warnings.length > 0 ? (
        <Surface className="border-state-warning">
          <h2 className="text-base font-semibold text-text-primary">
            Unsupported renderer metadata
          </h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-text-muted">
            {narrowing.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </Surface>
      ) : null}

      <RecordProvenanceDisclosure record={record} />
    </div>
  );
}

function TrainingEvidenceContextBanner({
  record
}: {
  record: Awaited<ReturnType<typeof getOperationalEvidenceRecord>>;
}) {
  const context = record.training_context;

  if (!context) {
    return null;
  }

  const enrollment = context.enrollment;
  const session = enrollment.training_session;
  const facility = session?.facility;

  return (
    <Surface className="space-y-4 border-primary-blue">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-primary-blue">
          Training Context
        </p>
        <h3 className="mt-1 text-lg font-semibold text-text-primary">
          {enrollment.trainee.full_name}
        </h3>
        <p className="mt-1 text-sm text-text-muted">
          {enrollment.trainee.student_number ?? "Student number pending"}
        </p>
      </div>
      <MetadataGrid
        entries={[
          ["Program", humanizeCode(enrollment.program_code)],
          ["Training Session", session?.training_title ?? "No assigned Training Session"],
          ["Session Dates", trainingSessionDateRange(session)],
          ["Client Sponsorship", enrollment.client?.organization_name ?? "OGI Direct / Independent"],
          ["Facility", facility?.facility_name ?? "None"],
          [
            "Primary Instructor",
            session?.instructor_staff_member?.full_name ?? "Not specified"
          ]
        ]}
      />
    </Surface>
  );
}

function ExistingEvidenceContextBanner({
  context
}: {
  context: NonNullable<OperationalEvidenceRecord["context"]>;
}) {
  return (
    <Surface className="space-y-3 border-primary-blue">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-primary-blue">Evidence Context</p>
        <h3 className="mt-1 text-lg font-semibold text-text-primary">{context.summary.primary_label}</h3>
        <p className="mt-1 text-sm text-text-muted">{context.summary.secondary_label}</p>
      </div>
      <MetadataGrid entries={[
        ["Context kind", humanizeCode(context.context_kind)],
        ["Selection", "Locked to this evidence record"],
        ["Snapshot source", "Evidence binding and payload"]
      ]} />
    </Surface>
  );
}

function applyExistingContextFieldPolicy(
  definition: OetsDefinition,
  policy: Record<string, OetsContextFieldPolicy> | undefined
) {
  if (!policy) return definition;
  return {
    ...definition,
    sections: definition.sections.map((section) => ({
      ...section,
      fields: section.fields.map((field) => {
        const authority = policy[`${section.section_code}.${field.field_code}`] ?? policy[field.field_code];
        return {
          ...field,
          readonly: field.readonly || authority === "READ_ONLY_DERIVED" || authority === "UNAVAILABLE_POST_ISSUANCE",
          description: authority === "UNAVAILABLE_POST_ISSUANCE"
            ? "Unavailable after governed issuance."
            : field.description
        };
      })
    }))
  };
}

function canEditOwnTrainingScopedDraft(
  record: OperationalEvidenceRecord,
  auth: ReturnType<typeof useAuth>
) {
  return (
    record.scope_kind === "TRAINING_SCOPED" &&
    Boolean(record.training_context) &&
    record.created_by_user_id === auth.session?.id &&
    auth.canUsePermission("view_training")
  );
}
function RecordIdentityPanel({
  record
}: {
  record: Awaited<ReturnType<typeof getOperationalEvidenceRecord>>;
}) {
  return (
    <Surface className="space-y-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">
            Record Detail
          </p>
          <h1 className="mt-1 break-words text-2xl font-semibold text-text-primary">
            {record.template_provenance.template_code}
          </h1>
          <p className="mt-2 break-all text-sm text-text-muted">
            Record {record.id}
          </p>
        </div>
        <div className="rounded-component border border-border bg-canvas px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">
            Current State
          </p>
          <p className="mt-1 text-lg font-semibold text-text-primary">
            {displayLifecycleStatus(record.lifecycle_state)}
          </p>
        </div>
      </div>
      <MetadataGrid
        entries={[
          ["Client ID", record.client_id ?? "OGI Direct / Independent"],
          ["Facility ID", record.facility_id ?? "No facility context"],
          [record.lifecycle_state === "REPLACED" ? "Replaced record timestamp" : "Submitted at", record.submitted_at],
          ["Template version", record.template_provenance.template_version]
        ]}
      />
      {record.lifecycle_state === "REPLACED" ? (
        <p className="rounded-component border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
          Historical record only. This record was replaced by a newer F-022 draft and cannot satisfy the active Training journey.
        </p>
      ) : null}
    </Surface>
  );
}

function RecordProvenanceDisclosure({
  record
}: {
  record: Awaited<ReturnType<typeof getOperationalEvidenceRecord>>;
}) {
  return (
    <Surface>
      <details className="group">
        <summary className="cursor-pointer text-base font-semibold text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-canvas">
          Provenance
        </summary>
        <p className="mt-2 text-sm leading-6 text-text-muted">
          Technical identifiers and integrity values for the submitted record.
        </p>
        <div className="mt-4">
          <MetadataGrid
            entries={[
              ["Evidence record ID", record.id],
              ["Template registry ID", record.template_provenance.template_registry_id],
              ["Template version ID", record.template_provenance.template_version_id],
              ["Template code", record.template_provenance.template_code],
              ["Template version", record.template_provenance.template_version],
              ["Schema version", record.template_provenance.schema_version],
              ["Payload checksum", record.payload_checksum],
              ["Template checksum", record.template_provenance.checksum],
              ["Created by", record.created_by_user_id],
              ["Submitted by", record.submitted_by_user_id],
              ["Created at", record.created_at],
              ["Submitted at", record.submitted_at],
              ["Updated at", record.updated_at]
            ]}
          />
        </div>
      </details>
    </Surface>
  );
}

function transitionKey(transition: GovernanceWorkflowTransition) {
  return `${transition.from}:${transition.trigger}:${transition.to}`;
}

function appendReviewConclusion(
  conclusions: ReviewConclusion[],
  conclusion: ReviewConclusion
) {
  return conclusions.some((item) => item.id === conclusion.id)
    ? conclusions
    : [...conclusions, conclusion];
}

function reviewConclusionContextFromConclusion(
  conclusion: ReviewConclusion
): ReviewConclusionQueryContext {
  return {
    reviewed_evidence_integrity_checksum:
      conclusion.reviewed_evidence_integrity_checksum,
    governing_template_version_id:
      conclusion.governing_template.template_version_id,
    reviewer_authority_code: conclusion.reviewer_authority_code,
    source_lifecycle_state: conclusion.workflow_context.source_lifecycle_state,
    transition_trigger: conclusion.workflow_context.transition_trigger,
    target_lifecycle_state: conclusion.workflow_context.target_lifecycle_state
  };
}

function reviewConclusionContextKeyPart(context: ReviewConclusionQueryContext) {
  return [
    context.reviewed_evidence_integrity_checksum,
    context.governing_template_version_id,
    context.reviewer_authority_code,
    context.source_lifecycle_state,
    context.transition_trigger,
    context.target_lifecycle_state
  ] as const;
}

function F002ReadinessPanel({
  issues,
  loadingAttestations
}: {
  issues: readonly string[];
  loadingAttestations: boolean;
}) {
  const ready = !loadingAttestations && issues.length === 0;
  return (
    <Surface className={`border-l-4 ${ready ? "border-l-state-success bg-green-50/40" : "border-l-state-warning bg-amber-50/40"}`}>
      <p className="text-xs font-bold uppercase tracking-wide text-primary-blue">F002 submission readiness</p>
      <h2 className="mt-1 text-base font-semibold text-primary-navy">
        {ready ? "Ready for governed finalization" : "Draft requirements remain"}
      </h2>
      {loadingAttestations ? (
        <p className="mt-2 text-sm text-text-muted" role="status">Checking governed attestations…</p>
      ) : ready ? (
        <p className="mt-2 text-sm text-text-muted">Minimum assessment evidence and both current attestations are present.</p>
      ) : (
        <ul className="mt-2 grid gap-1 text-sm text-text-muted sm:grid-cols-2">
          {issues.map((issue) => <li key={issue}>• {issue}</li>)}
        </ul>
      )}
    </Surface>
  );
}

function F002LifecyclePanel({ lifecycleState }: { lifecycleState: string }) {
  const approved = lifecycleState === "GOVERNANCE_APPROVED";
  return (
    <Surface className={`border-l-4 ${approved ? "border-l-state-success bg-green-50/40" : "border-l-primary-blue bg-blue-50/40"}`}>
      <p className="text-xs font-bold uppercase tracking-wide text-primary-blue">F002 governed lifecycle</p>
      <h2 className="mt-1 text-base font-semibold text-primary-navy">
        {approved ? "Governed approval complete" : displayLifecycleStatus(lifecycleState)}
      </h2>
      <p className="mt-2 text-sm text-text-muted">
        {approved
          ? "This evidence is immutable and approved. Archiving is an optional post-approval retention action."
          : "This evidence has left Draft and is read-only while its governed workflow continues."}
      </p>
    </Surface>
  );
}

function readF002ReadinessIssues(
  payload: Pick<OetsEvidencePayload, "sections">,
  attestations: readonly EvidenceAttestation[],
  dirty: boolean
) {
  const requirements = [
    ["FACILITY_IDENTIFICATION", "CLIENT_ID", "Client ID"],
    ["FACILITY_IDENTIFICATION", "FACILITY_ID", "Facility ID"],
    ["FACILITY_IDENTIFICATION", "FACILITY_NAME", "Facility Name"],
    ["FACILITY_IDENTIFICATION", "ORGANIZATION_NAME", "Organization Name"],
    ["FACILITY_IDENTIFICATION", "FACILITY_TYPE", "Facility Type"],
    ["FACILITY_IDENTIFICATION", "ASSESSMENT_DATE", "Assessment Date"],
    ["FACILITY_IDENTIFICATION", "ASSESSOR", "Appointed Assessor"],
    ["BASELINE_ARMAA_ASSESSMENT", "GOVERNANCE_MATURITY", "Governance Maturity"],
    ["BASELINE_ARMAA_ASSESSMENT", "DOCUMENTATION_INTEGRITY", "Documentation Integrity"],
    ["BASELINE_ARMAA_ASSESSMENT", "COMPLIANCE_MANAGEMENT", "Compliance Management"],
    ["BASELINE_ARMAA_ASSESSMENT", "TRAINING_ADMINISTRATION", "Training Administration"],
    ["BASELINE_ARMAA_ASSESSMENT", "CORRECTIVE_ACTION_MANAGEMENT", "Corrective Action Management"],
    ["BASELINE_ARMAA_ASSESSMENT", "RISK_MANAGEMENT_SYSTEMS", "Risk Management Systems"],
    ["BASELINE_ARMAA_ASSESSMENT", "ACCOUNTABILITY_AND_OVERSIGHT", "Accountability & Oversight"],
    ["BASELINE_ARMAA_ASSESSMENT", "ADMINISTRATIVE_RISK_SCORE", "Administrative Risk Score"],
    ["BASELINE_ARMAA_ASSESSMENT", "ADMINISTRATIVE_CLASSIFICATION", "Administrative Classification"]
  ] as const;
  const issues: string[] = requirements.flatMap(([sectionCode, fieldCode, label]) => {
    const section = payload.sections[sectionCode];
    const value = section && !Array.isArray(section) ? section[fieldCode] : undefined;
    return hasF002ReadinessValue(value) ? [] : [label];
  });
  for (const [signatureCode, label] of [
    ["ASSESSOR_NAME_SIGNATURE", "Current assessor attestation"],
    ["REVIEWING_MANAGER_SIGNATURE", "Current reviewing-manager attestation"]
  ] as const) {
    if (!attestations.some((item) => item.status === "CURRENT" && item.signature_field_code_snapshot === signatureCode)) {
      issues.push(label);
    }
  }
  if (dirty) issues.unshift("Save the current draft changes");
  return [...new Set(issues)];
}

function hasF002ReadinessValue(value: OetsFieldValue | undefined) {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

function WorkflowActions({
  error,
  isPending,
  onTransition,
  transitions
}: {
  error: Error | null;
  isPending: boolean;
  onTransition: (transition: WorkflowTransition) => void;
  transitions: WorkflowTransition[];
}) {
  if (transitions.length === 0 && !error) {
    return null;
  }

  return (
    <Surface className="space-y-3">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">
          Authorized Action
        </p>
        <h2 className="mt-1 text-base font-semibold text-text-primary">
          Available Workflow Actions
        </h2>
      </div>
      {transitions.length > 0 ? (
        <div className="flex flex-wrap gap-3">
          {transitions.map((transition) => (
            <Button
              disabled={isPending}
              key={`${transition.from}:${transition.trigger}:${transition.to}`}
              onClick={() => onTransition(transition)}
              variant="primary"
            >
              {isPending ? "Updating..." : displayWorkflowActionLabel(transition)}
            </Button>
          ))}
        </div>
      ) : null}
      {error ? (
        <div
          className="rounded-component border border-state-error bg-elevated p-3 text-sm text-text-primary"
          role="alert"
        >
          {transitionErrorMessage(error)}
        </div>
      ) : null}
    </Surface>
  );
}


function GovernanceReviewActions({
  actionStates,
  claimError,
  claimPending,
  claimedTransitionError,
  claimedTransitionPending,
  currentUserId,
  isLoadingClaimState,
  loadClaimStateError,
  onClaim,
  onRelease,
  canSubmitConclusion,
  currentConclusion,
  onRationaleChange,
  onTransition,
  rationaleByTransitionKey,
  releaseError,
  releasePending
}: {
  actionStates: GovernanceReviewActionState[];
  claimError: Error | null;
  claimPending: boolean;
  claimedTransitionError: Error | null;
  claimedTransitionPending: boolean;
  currentUserId: string | null;
  isLoadingClaimState: boolean;
  loadClaimStateError: Error | null;
  canSubmitConclusion: boolean;
  currentConclusion: ReviewConclusion | null;
  onClaim: (transition: GovernanceWorkflowTransition) => void;
  onRationaleChange: (
    transition: GovernanceWorkflowTransition,
    rationale: string
  ) => void;
  onRelease: (claim: GovernanceReviewClaim) => void;
  onTransition: (
    claim: GovernanceReviewClaim,
    transition: GovernanceWorkflowTransition,
    rationale: string
  ) => void;
  rationaleByTransitionKey: Record<string, string>;
  releaseError: Error | null;
  releasePending: boolean;
}) {
  const error = claimError ?? releaseError ?? claimedTransitionError;
  const governanceErrorMessage = claimedTransitionError
    ? reviewConclusionErrorMessage(claimedTransitionError)
    : error
      ? transitionErrorMessage(error)
      : null;

  if (actionStates.length === 0 && !error && !loadClaimStateError) {
    return null;
  }

  return (
    <section aria-labelledby="governance-review-heading">
      <Surface className="space-y-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-primary-blue">
          Governance Action
        </p>
        <h2
          className="mt-1 text-xl font-semibold text-text-primary"
          id="governance-review-heading"
        >
          Governance Review
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-text-muted">
          Review ownership and conclusion submission are governed actions for
          this submitted evidence record.
        </p>
      </div>

      {isLoadingClaimState ? (
        <p className="text-sm text-text-muted">Loading review assignment.</p>
      ) : loadClaimStateError ? (
        <div
          className="rounded-component border border-state-error bg-elevated p-3 text-sm text-text-primary"
          role="alert"
        >
          Review assignment could not be loaded.
        </div>
      ) : (
        <div className="space-y-4">
          {actionStates.map(({ transition, activeClaim, claimedByName }) => {
            const actionKey = transitionKey(transition);
            const authorityLabel = displayReviewAuthority(
              transition.governanceAuthorityCode
            );
            const claimState = reviewClaimStateLabel(activeClaim, currentUserId);

            if (activeClaim) {
              const isOwnedByCurrentUser =
                currentUserId !== null &&
                activeClaim.claimed_by_user_id === currentUserId;

              if (!isOwnedByCurrentUser) {
                return (
                  <div className="space-y-3" key={actionKey}>
                    <ReviewContextGrid
                      authorityLabel={authorityLabel}
                      claimState={claimState}
                      lifecycleLabel={displayLifecycleStatus(transition.from)}
                    />
                    <p className="rounded-component border border-border bg-canvas px-3 py-2 text-sm text-text-muted">
                      {claimedByName
                        ? `${authorityLabel} review is claimed by ${claimedByName}. That reviewer must release the claim before another authorized reviewer can claim and approve it.`
                        : `${authorityLabel} review is already claimed by another reviewer.`}
                    </p>
                  </div>
                );
              }

              const rationale = rationaleByTransitionKey[actionKey] ?? "";
              const rationaleId = `${actionKey}:rationale`;
              const rationaleHintId = `${actionKey}:rationale-hint`;

              return (
                <div className="space-y-4" key={actionKey}>
                  <ReviewContextGrid
                    authorityLabel={authorityLabel}
                    claimState={claimState}
                    lifecycleLabel={displayLifecycleStatus(transition.from)}
                  />
                  {currentConclusion ? (
                    <p className="rounded-component border border-border bg-canvas px-3 py-2 text-sm text-text-muted">
                      The current Review Conclusion is shown below.
                    </p>
                  ) : null}
                  <div className="rounded-component border border-border bg-canvas p-4">
                    <label
                      className="block text-sm font-semibold text-text-primary"
                      htmlFor={rationaleId}
                    >
                      Review Conclusion Rationale
                    </label>
                    <p
                      className="mt-1 text-sm leading-6 text-text-muted"
                      id={rationaleHintId}
                    >
                      Provide the governed rationale that will be submitted with
                      the Review Conclusion. Reviewer identity and target state
                      are resolved by the backend.
                    </p>
                    <textarea
                      aria-describedby={rationaleHintId}
                      className="mt-3 min-h-32 w-full rounded-component border border-border bg-surface px-3 py-2 text-sm text-text-primary outline-none focus:border-focus focus:ring-2 focus:ring-focus"
                      id={rationaleId}
                      onChange={(event) =>
                        onRationaleChange(transition, event.currentTarget.value)
                      }
                      value={rationale}
                    />
                    <p className="mt-2 text-xs text-text-muted">
                      A rationale is required before submitting the Review Conclusion.
                    </p>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    {canSubmitConclusion ? (
                      <Button
                        disabled={
                          claimedTransitionPending ||
                          releasePending ||
                          rationale.trim().length === 0
                        }
                        onClick={() =>
                          onTransition(activeClaim, transition, rationale.trim())
                        }
                        variant="primary"
                      >
                        {claimedTransitionPending
                          ? "Submitting Review Conclusion..."
                          : "Submit Review Conclusion"}
                      </Button>
                    ) : (
                      <p className="rounded-component border border-border bg-canvas px-3 py-2 text-sm text-text-muted">
                        You do not have permission to complete this review.
                      </p>
                    )}
                    <Button
                      disabled={claimedTransitionPending || releasePending}
                      onClick={() => onRelease(activeClaim)}
                      variant="secondary"
                    >
                      {releasePending ? "Releasing Claim..." : "Release Claim"}
                    </Button>
                  </div>
                </div>
              );
            }

            return (
              <div className="space-y-3" key={actionKey}>
                <ReviewContextGrid
                  authorityLabel={authorityLabel}
                  claimState={claimState}
                  lifecycleLabel={displayLifecycleStatus(transition.from)}
                />
                <div className="flex flex-wrap gap-3">
                  <Button
                    disabled={claimPending}
                    onClick={() => onClaim(transition)}
                    variant="primary"
                  >
                    {claimPending ? "Claiming Review..." : "Claim Review"}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {error ? (
        <div
          className="rounded-component border border-state-error bg-elevated p-3 text-sm text-text-primary"
          role="alert"
        >
          {governanceErrorMessage}
        </div>
      ) : null}
      </Surface>
    </section>
  );
}

function ReviewContextGrid({
  authorityLabel,
  claimState,
  lifecycleLabel
}: {
  authorityLabel: string;
  claimState: string;
  lifecycleLabel: string;
}) {
  return (
    <dl className="grid gap-3 sm:grid-cols-3">
      <ReviewContextItem label="Review authority" value={authorityLabel} />
      <ReviewContextItem label="Claim state" value={claimState} />
      <ReviewContextItem label="Lifecycle context" value={lifecycleLabel} />
    </dl>
  );
}

function ReviewContextItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-component border border-border bg-canvas p-3">
      <dt className="text-xs font-semibold uppercase tracking-wide text-text-muted">
        {label}
      </dt>
      <dd className="mt-1 text-sm font-semibold text-text-primary">{value}</dd>
    </div>
  );
}

function reviewClaimStateLabel(
  claim: GovernanceReviewClaim | null,
  currentUserId: string | null
) {
  if (!claim) {
    return "Available";
  }

  return currentUserId !== null && claim.claimed_by_user_id === currentUserId
    ? "Claimed by you"
    : "Claimed by another reviewer";
}

function ReviewConclusionPanel({
  context,
  currentConclusion,
  currentError,
  history,
  historyError,
  isLoadingCurrent,
  isLoadingHistory,
  onSelectConclusion,
  selectedConclusion,
  selectedError,
  selectedId
}: {
  context: ReviewConclusionContextState | null;
  currentConclusion: ReviewConclusion | null;
  currentError: Error | null;
  history: ReviewConclusion[];
  historyError: Error | null;
  isLoadingCurrent: boolean;
  isLoadingHistory: boolean;
  onSelectConclusion: (conclusionId: string) => void;
  selectedConclusion: ReviewConclusion | null;
  selectedError: Error | null;
  selectedId: string | null;
}) {
  if (!context) {
    return null;
  }

  const error = currentError ?? historyError ?? selectedError;

  return (
    <section aria-labelledby="review-conclusions-heading">
      <Surface className="space-y-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-primary-blue">
          Governed History
        </p>
        <h2
          className="mt-1 text-xl font-semibold text-text-primary"
          id="review-conclusions-heading"
        >
          Review Conclusions
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-text-muted">
          Current and historical Review Conclusions are backend-derived,
          read-only governed information for the {displayReviewAuthority(context.governanceAuthorityCode)} review.
        </p>
      </div>

      {isLoadingCurrent || isLoadingHistory ? (
        <p className="text-sm text-text-muted">Loading Review Conclusions.</p>
      ) : error ? (
        <div
          className="rounded-component border border-state-error bg-elevated p-3 text-sm text-text-primary"
          role="alert"
        >
          {reviewConclusionErrorMessage(error)}
        </div>
      ) : (
        <div className="space-y-4">
          <section
            aria-labelledby="current-review-conclusion-heading"
            className="rounded-component border border-border bg-canvas p-4"
          >
            <h3 className="text-sm font-semibold text-text-primary">
              <span id="current-review-conclusion-heading">
              Current Review Conclusion
              </span>
            </h3>
            {currentConclusion ? (
              <ReviewConclusionDetails conclusion={currentConclusion} />
            ) : (
              <p className="mt-2 text-sm text-text-muted">
                No current Review Conclusion has been recorded for this review context.
              </p>
            )}
          </section>

          <section
            aria-labelledby="conclusion-history-heading"
            className="space-y-2"
          >
            <h3
              className="text-sm font-semibold text-text-primary"
              id="conclusion-history-heading"
            >
              Conclusion History
            </h3>
            {history.length > 0 ? (
              <ul aria-label="Conclusion History" className="space-y-2">
                {history.map((conclusion) => (
                  <li
                    className="rounded-component border border-border bg-canvas p-4"
                    key={conclusion.id}
                  >
                    <ReviewConclusionDetails conclusion={conclusion} />
                    <Button
                      className="mt-3"
                      onClick={() => onSelectConclusion(conclusion.id)}
                      variant="secondary"
                    >
                      View Review Conclusion
                    </Button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-text-muted">
                No historical Review Conclusions have been recorded for this review context.
              </p>
            )}
          </section>

          {selectedId ? (
            <section className="rounded-component border border-border bg-canvas p-4">
              <h3 className="text-sm font-semibold text-text-primary">
                Selected Review Conclusion
              </h3>
              {selectedConclusion ? (
                <ReviewConclusionDetails conclusion={selectedConclusion} />
              ) : (
                <p className="mt-2 text-sm text-text-muted">
                  Loading selected Review Conclusion.
                </p>
              )}
            </section>
          ) : null}
        </div>
      )}
      </Surface>
    </section>
  );
}

function ReviewConclusionDetails({
  conclusion
}: {
  conclusion: ReviewConclusion;
}) {
  return (
    <dl className="mt-2 grid gap-2 text-sm md:grid-cols-2">
      <div>
        <dt className="font-semibold text-text-muted">Conclusion ID</dt>
        <dd className="break-all text-text-primary">{conclusion.id}</dd>
      </div>
      <div>
        <dt className="font-semibold text-text-muted">Authority</dt>
        <dd className="text-text-primary">
          {displayReviewAuthority(conclusion.reviewer_authority_code)}
        </dd>
      </div>
      <div className="md:col-span-2">
        <dt className="font-semibold text-text-muted">Rationale</dt>
        <dd className="whitespace-pre-wrap text-text-primary">
          {conclusion.rationale}
        </dd>
      </div>
      <div>
        <dt className="font-semibold text-text-muted">Created at</dt>
        <dd className="text-text-primary">{conclusion.created_at}</dd>
      </div>
      <div>
        <dt className="font-semibold text-text-muted">Review claim ID</dt>
        <dd className="break-all text-text-primary">{conclusion.review_claim_id}</dd>
      </div>
    </dl>
  );
}

function RecordErrorState({ error }: { error: Error }) {
  if (isApiError(error) && [401, 403, 404].includes(error.status)) {
    return (
      <SafeState title="Audit record is not available.">
        The record could not be opened with the current authorization context.
      </SafeState>
    );
  }

  return (
    <SafeState title="Audit record could not be loaded.">
      The backend record endpoint returned an error.
    </SafeState>
  );
}

function findReviewConclusionContext(
  definition: OetsDefinition,
  record: Awaited<ReturnType<typeof getOperationalEvidenceRecord>>
): ReviewConclusionContextState | null {
  const transitions = findWorkflowTransitions(definition);
  const matchingTransition = transitions.find((transition) => {
    const governanceAuthorityCode = resolveGovernanceAuthorityCode(
      transition.to
    );

    return Boolean(
      governanceAuthorityCode &&
        (transition.from === record.lifecycle_state ||
          transition.to === record.lifecycle_state)
    );
  });

  if (!matchingTransition) {
    return null;
  }

  const governanceAuthorityCode = resolveGovernanceAuthorityCode(
    matchingTransition.to
  );

  if (!governanceAuthorityCode) {
    return null;
  }

  return {
    governanceAuthorityCode,
    context: {
      reviewed_evidence_integrity_checksum: record.payload_checksum,
      governing_template_version_id:
        record.template_provenance.template_version_id,
      reviewer_authority_code: governanceAuthorityCode,
      source_lifecycle_state: matchingTransition.from,
      transition_trigger: matchingTransition.trigger,
      target_lifecycle_state: matchingTransition.to
    }
  };
}

function findAvailableTransitions(
  definition: OetsDefinition,
  lifecycleState: string
): WorkflowTransition[] {
  return findWorkflowTransitions(definition).filter(
    (transition) => transition.from === lifecycleState
  );
}

function findWorkflowTransitions(definition: OetsDefinition): WorkflowTransition[] {
  const workflow = definition.workflow;

  if (!isRecord(workflow) || !Array.isArray(workflow.transitions)) {
    return [];
  }

  const stateLabels = readWorkflowStateLabels(workflow.states);

  return workflow.transitions.flatMap((value) => {
    if (!isRecord(value)) {
      return [];
    }

    const from = readNonEmptyString(value.from);
    const to = readNonEmptyString(value.to);
    const trigger = readNonEmptyString(value.trigger);

    if (!from || !to || !trigger) {
      return [];
    }

    return [
      {
        from,
        to,
        trigger,
        label: readTransitionLabel(value) ?? `Move to ${stateLabels[to] ?? humanizeCode(to)}`
      }
    ];
  });
}

function readWorkflowStateLabels(value: unknown) {
  if (!Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    value.flatMap((state) => {
      if (!isRecord(state)) {
        return [];
      }

      const stateCode = readNonEmptyString(state.state_code);
      const label =
        readNonEmptyString(state.label) ??
        readNonEmptyString(state.name) ??
        (stateCode ? humanizeCode(stateCode) : undefined);

      return stateCode && label ? [[stateCode, label]] : [];
    })
  );
}

function readTransitionLabel(value: Record<string, unknown>) {
  return (
    readNonEmptyString(value.label) ??
    readNonEmptyString(value.name) ??
    readNonEmptyString(value.title)
  );
}

function reviewConclusionErrorMessage(error: Error) {
  if (isApiError(error)) {
    if (error.status === 400) {
      return "The Review Conclusion request was rejected by the backend contract.";
    }

    if ([401, 403].includes(error.status)) {
      return "You are not authorized to view or submit this Review Conclusion.";
    }

    if (error.status === 404) {
      return "The Review Conclusion context could not be found.";
    }

    if (error.status === 409) {
      return "The Review Conclusion is no longer current. Reload the record and try again.";
    }

    if (error.status === 422) {
      return "The Review Conclusion was rejected by backend validation.";
    }

    if (error.status >= 500) {
      return "The Review Conclusion could not be persisted by the backend.";
    }
  }

  return "The Review Conclusion could not be loaded.";
}

function draftPayloadErrorMessage(error: Error) {
  if (isApiError(error)) {
    if ([401, 403].includes(error.status)) {
      return error.message || "You are not authorized to edit this Draft Operational Evidence record.";
    }

    if (error.status === 409) {
      return "This Operational Evidence record is no longer editable as a Draft.";
    }

    if (error.status === 422) {
      return "The Draft payload was rejected by the backend. Review the validation details and try again.";
    }
  }

  return "The Draft evidence payload could not be saved.";
}

function attestationErrorMessage(error: Error) {
  if (isApiError(error)) {
    return error.message;
  }
  return "The governed attestation could not be recorded. Review the evidence context and try again.";
}

function transitionErrorMessage(error: Error) {
  if (isApiError(error)) {
    if (error.code === "OEE_REQUIRED_ATTESTATION_MISSING") {
      return "Required governed attestations are missing or stale. Review the attestation controls before finalizing this evidence.";
    }
    if ([401, 403].includes(error.status)) {
      return "You are not authorized to perform this review action.";
    }

    if (error.status === 409) {
      return "This review is already assigned. The latest assignment is shown.";
    }

    if (error.status === 422) {
      return "The review action was rejected by the backend. Reload the record and try again.";
    }
  }

  return "The review action could not be completed.";
}

function trainingSessionDateRange(
  session: NonNullable<
    Awaited<ReturnType<typeof getOperationalEvidenceRecord>>["training_context"]
  >["enrollment"]["training_session"]
) {
  if (!session?.training_start_date) {
    return "Not assigned";
  }

  const start = formatDateValue(session.training_start_date);
  const end = session.training_end_date
    ? formatDateValue(session.training_end_date)
    : null;

  return end ? `${start} to ${end}` : start;
}

function formatDateValue(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(
    new Date(value)
  );
}
function humanizeCode(value: string) {
  return value
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function readNonEmptyString(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function MetadataGrid({ entries }: { entries: Array<[string, string | null | undefined]> }) {
  return (
    <dl className="grid gap-3 md:grid-cols-2">
      {entries.map(([label, value]) => (
        <div className="rounded-component border border-border bg-canvas p-3" key={label}>
          <dt className="text-xs font-semibold uppercase tracking-wide text-text-muted">
            {label}
          </dt>
          <dd className="mt-1 break-words text-sm text-text-primary">{value ?? "None"}</dd>
        </div>
      ))}
    </dl>
  );
}

function trainingContextualFieldVisibilityPolicy(
  record: OperationalEvidenceRecord
): OetsFieldVisibilityPolicy | undefined {
  if (record.scope_kind !== "TRAINING_SCOPED") {
    return undefined;
  }

  const fieldsToHideWhenEmpty = emptyTrainingContextualFieldPolicyByTemplate.get(
    record.template_provenance.template_code
  );

  if (!fieldsToHideWhenEmpty) {
    return undefined;
  }

  return ({ field, value }) => {
    if (!fieldsToHideWhenEmpty.has(field.field_code)) {
      return true;
    }

    return !isEmptyOetsFieldValue(value);
  };
}

function isEmptyOetsFieldValue(value: OetsFieldValue | undefined) {
  if (value === undefined || value === null) {
    return true;
  }

  if (typeof value === "string") {
    return value.trim().length === 0;
  }

  if (Array.isArray(value)) {
    return value.length === 0;
  }

  return false;
}

function markTrainingAssessmentNumberReadonly(
  definition: OetsDefinition,
  record: OperationalEvidenceRecord
) {
  if (
    record.template_provenance.template_code ===
    "OGI_F002_FACILITY_PROFILE_BASELINE_INTELLIGENCE_ASSESSMENT"
  ) {
    const inputs = new Set([
      "GOVERNANCE_MATURITY",
      "DOCUMENTATION_INTEGRITY",
      "COMPLIANCE_MANAGEMENT",
      "TRAINING_ADMINISTRATION",
      "CORRECTIVE_ACTION_MANAGEMENT",
      "RISK_MANAGEMENT_SYSTEMS",
      "ACCOUNTABILITY_AND_OVERSIGHT"
    ]);
    const outputs = new Set([
      "ADMINISTRATIVE_RISK_SCORE",
      "ADMINISTRATIVE_CLASSIFICATION",
      "ODIS_SCORE",
      "DEFENSIBILITY_CLASSIFICATION",
      "ADMINISTRATIVE_RISK",
      "DEFENSIBILITY",
      "INSURANCE_READINESS",
      "ARI_SCORE",
      "ARI_CLASSIFICATION",
      "CLASSIFICATION"
    ]);
    const intelligenceInputs = new Set([
      "GOVERNANCE_SCORE", "DOCUMENTATION_INTEGRITY_SCORE", "OPERATIONAL_CONTROL_SCORE",
      "COMPETENCY_ASSURANCE_SCORE", "EMERGENCY_READINESS_SCORE", "CORRECTIVE_ACTION_EFFECTIVENESS_SCORE",
      "OPERATIONAL_RISK", "EMERGENCY_PREPAREDNESS", "TRAINING_AND_COMPETENCY", "INSURANCE_READINESS_INDEX"
    ]);
    return {
      ...definition,
      sections: definition.sections.map((section) => ({
        ...section,
        fields: section.fields.map((field) => ({
          ...field,
          readonly: field.readonly || outputs.has(field.field_code) || ["ASSESSOR", "ASSESSMENT_DATE", "DATE", "DATE_2"].includes(field.field_code),
          validation: inputs.has(field.field_code) || intelligenceInputs.has(field.field_code)
            ? { ...field.validation, minimum: 0, maximum: 100 }
            : field.validation
        }))
      }))
    };
  }
  if (
    record.scope_kind !== "TRAINING_SCOPED" ||
    !trainingAssessmentNumberTemplateCodes.has(
      record.template_provenance.template_code
    )
  ) {
    return definition;
  }

  return {
    ...definition,
    sections: definition.sections.map((section) => {
      const hasDerivedFields = section.fields.some((field) =>
        trainingAssessmentDerivedFieldCodes.has(field.field_code)
      );
      const calculatedSection = trainingAssessmentCalculatedSectionsByTemplate
        .get(record.template_provenance.template_code)
        ?.has(section.section_code);
      const skillsRatingSection =
        record.template_provenance.template_code ===
          "OGI_F023_OPERATIONAL_SKILLS_ASSESSMENT" &&
        section.fields.some((field) => /^SCORE(?:_\d+)?$/.test(field.field_code));
      const f025ImportedFields =
        record.template_provenance.template_code ===
          "OGI_F025_OPERATIONAL_READINESS_EVALUATION" &&
        f025ImportedFieldsBySection.get(section.section_code);
      if (!hasDerivedFields && !calculatedSection && !skillsRatingSection && !f025ImportedFields) {
        return section;
      }

      return {
        ...section,
        fields: section.fields.map((field) => {
          if (
            record.template_provenance.template_code ===
              "OGI_F023_OPERATIONAL_SKILLS_ASSESSMENT" &&
            !calculatedSection &&
            /^SCORE(?:_\d+)?$/.test(field.field_code)
          ) {
            return {
              ...field,
              validation: { ...field.validation, minimum: 0, maximum: 100 }
            };
          }
          return calculatedSection ||
            (f025ImportedFields && f025ImportedFields.has(field.field_code)) ||
            trainingAssessmentDerivedFieldCodes.has(field.field_code)
            ? { ...field, readonly: true }
            : field;
        })
      };
    })
  };
}

function hasGovernedAttestationFields(definition: OetsDefinition) {
  return definition.sections.some((section) =>
    section.fields.some(
      (field) =>
        field.field_type === "SIGNATURE" &&
        isRecord(field.metadata?.governed_attestation)
    )
  );
}

function templateMatchesRecord(
  record: Awaited<ReturnType<typeof getOperationalEvidenceRecord>>,
  template: Awaited<ReturnType<typeof getRuntimeTemplateVersion>>
) {
  return (
    template.template_registry_id ===
      record.template_provenance.template_registry_id &&
    template.template_version_id ===
      record.template_provenance.template_version_id &&
    template.template_code === record.template_provenance.template_code &&
    template.template_version === record.template_provenance.template_version &&
    template.schema_version === record.template_provenance.schema_version &&
    template.checksum === record.template_provenance.checksum
  );
}

function SafeState({
  title,
  children
}: {
  title: string;
  children: string;
}) {
  return (
    <Surface>
      <h1 className="text-xl font-semibold text-text-primary">{title}</h1>
      <p className="mt-2 text-sm text-text-muted">{children}</p>
    </Surface>
  );
}
