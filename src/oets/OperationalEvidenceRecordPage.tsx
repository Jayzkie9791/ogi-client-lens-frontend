import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useParams } from "react-router-dom";

import { isApiError } from "../api/errors";
import { useAuth } from "../auth/useAuth";
import { Button } from "../ui/components/Button";
import { Surface } from "../ui/components/Surface";
import { narrowOetsDefinition } from "./definitionGuards";
import {
  displayLifecycleStatus,
  displayReviewAuthority,
  displayWorkflowActionLabel
} from "./displayLabels";
import {
  getOperationalEvidenceRecord,
  transitionOperationalEvidenceRecord,
  updateDraftOperationalEvidencePayload
} from "./evidenceSubmissionApi";

import { resolveGovernanceAuthorityCode } from "./governanceAuthorityResolver";
import {
  claimGovernanceReview,
  GovernanceQueueItem,
  GovernanceReviewClaim,
  listGovernanceQueue,
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

import { OetsRenderer } from "./OetsRenderer";
import { getRuntimeTemplateVersion } from "./runtimeTemplateApi";
import { OetsDefinition, OetsEvidencePayload } from "./types";

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

export function OperationalEvidenceRecordPage() {
  const { recordId } = useParams();
  const auth = useAuth();
  const queryClient = useQueryClient();
  const [rationaleByTransitionKey, setRationaleByTransitionKey] = useState<
    Record<string, string>
  >({});
  const [selectedConclusionId, setSelectedConclusionId] = useState<string | null>(null);
  const recordQuery = useQuery({
    enabled: Boolean(recordId),
    queryKey: ["operational-evidence-record", recordId],
    queryFn: () => getOperationalEvidenceRecord(recordId ?? "")
  });
  const record = recordQuery.data;
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

  const directTransitions = availableTransitions.filter(
    (transition) => !resolveGovernanceAuthorityCode(transition.to)
  );
  const governanceTransitions = availableTransitions.flatMap((transition) => {
    const governanceAuthorityCode = resolveGovernanceAuthorityCode(
      transition.to
    );

    return governanceAuthorityCode
      ? [{ ...transition, governanceAuthorityCode }]
      : [];
  });
  const governanceClaimQueryKey = [
    "operational-evidence-governance-claim-state",
    record?.id,
    record?.lifecycle_state,
    governanceTransitions.map((transition) => [
      transition.governanceAuthorityCode,
      transition.trigger,
      transition.to
    ])
  ] as const;
  const governanceQueueQuery = useQuery({
    enabled: Boolean(record && governanceTransitions.length > 0),
    queryKey: governanceClaimQueryKey,
    queryFn: () => {
      if (!record) {
        throw new Error("Audit record is required before loading review assignments.");
      }

      return listGovernanceQueue({
        claim_status: "ANY",
        client_id: record.client_id ?? undefined,
        facility_id: record.facility_id ?? undefined,
        governance_authority_code:
          governanceTransitions.length === 1
            ? governanceTransitions[0].governanceAuthorityCode
            : undefined,
        lifecycle_state: record.lifecycle_state
      });
    }
  });
  const governanceActionStates = governanceTransitions.map((transition) => ({
    transition,
    activeClaim:
      findQueueItemForTransition(
        governanceQueueQuery.data ?? [],
        record?.id,
        transition
      )?.active_claim ?? null
  }));
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
    }
  });
  const draftPayloadMutation = useMutation({
    mutationFn: (payload: OetsEvidencePayload) =>
      updateDraftOperationalEvidencePayload(recordId ?? "", { payload }),
    onSuccess(updatedRecord) {
      queryClient.setQueryData(
        ["operational-evidence-record", recordId],
        updatedRecord
      );
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
        void queryClient.invalidateQueries({
          queryKey: governanceClaimQueryKey
        });
      }
    },
    onSuccess(claim) {
      setClaimStateInCache(
        queryClient,
        governanceClaimQueryKey,
        record?.id,
        claim
      );
    }
  });
  const releaseClaimMutation = useMutation({
    mutationFn: (claim: GovernanceReviewClaim) =>
      releaseGovernanceReviewClaim(claim.id),
    onSuccess(claim) {
      setClaimStateInCache(
        queryClient,
        governanceClaimQueryKey,
        record?.id,
        claim
      );
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
        queryKey: governanceClaimQueryKey
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
        {(narrowing?.errors ?? ["definition_jsonb was not returned."]).join(" ")}
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
  const canEditDraft =
    isDraftRecord && auth.canUsePermission("submit_operational_evidence");
  const evidenceHeadingId = isDraftRecord
    ? "draft-evidence-heading"
    : "submitted-evidence-heading";

  return (
    <div className="space-y-4">
      <RecordIdentityPanel record={record} />

      <section aria-labelledby={evidenceHeadingId} className="space-y-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-primary-blue">
            Record Truth
          </p>
          <h2
            className="mt-1 text-xl font-semibold text-text-primary"
            id={evidenceHeadingId}
          >
            {isDraftRecord ? "Draft Evidence" : "Submitted Evidence"}
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-text-muted">
            {isDraftRecord
              ? "This Draft Operational Evidence record can be edited until it is submitted."
              : "This read-only view presents the evidence payload submitted for this Operational Evidence record."}
          </p>
        </div>

        {record.scope_kind === "TRAINING_SCOPED" && record.training_context ? (
          <TrainingEvidenceContextBanner record={record} />
        ) : null}

        <OetsRenderer
          definition={narrowing.definition}
          formMessage={
            draftPayloadMutation.error
              ? draftPayloadErrorMessage(draftPayloadMutation.error)
              : undefined
          }
          initialPayload={record.payload}
          isSubmitting={draftPayloadMutation.isPending}
          onSubmit={canEditDraft ? (payload) => draftPayloadMutation.mutate(payload) : undefined}
          readOnly={!canEditDraft}
          runtimeTemplate={templateQuery.data}
          submitHelpText="Save Draft changes before submitting this Operational Evidence record."
          submitLabel="Save Draft"
          submittingLabel="Saving..."
          submitSuccess={
            draftPayloadMutation.isSuccess
              ? {
                  evidenceRecordId: record.id,
                  lifecycleState: record.lifecycle_state
                }
              : null
          }
          submitSuccessMessage="Draft evidence saved."
        />
      </section>
      <WorkflowActions
        error={transitionMutation.error}
        isPending={transitionMutation.isPending}
        onTransition={(transition) => transitionMutation.mutate(transition)}

        transitions={directTransitions}
      />

      <GovernanceReviewActions
        actionStates={governanceActionStates}
        claimError={claimMutation.error}
        claimPending={claimMutation.isPending}
        claimedTransitionError={claimedTransitionMutation.error}
        claimedTransitionPending={claimedTransitionMutation.isPending}
        currentUserId={auth.session?.id ?? null}
        isLoadingClaimState={governanceQueueQuery.isLoading}
        loadClaimStateError={governanceQueueQuery.error}
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

      {narrowing.warnings.length > 0 ? (
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
          ["Instructor", "Not specified"]
        ]}
      />
    </Surface>
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
          ["Submitted at", record.submitted_at],
          ["Template version", record.template_provenance.template_version]
        ]}
      />
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

function findQueueItemForTransition(
  items: GovernanceQueueItem[],
  evidenceRecordId: string | undefined,
  transition: GovernanceWorkflowTransition
) {
  if (!evidenceRecordId) {
    return undefined;
  }

  return items.find(
    (item) =>
      item.evidence_record.id === evidenceRecordId &&
      item.governance_authority_code === transition.governanceAuthorityCode &&
      item.lifecycle_state === transition.from &&
      item.transition_trigger === transition.trigger
  );
}

function setClaimStateInCache(
  queryClient: ReturnType<typeof useQueryClient>,
  queryKey: readonly unknown[],
  evidenceRecordId: string | undefined,
  claim: GovernanceReviewClaim
) {
  queryClient.setQueryData<GovernanceQueueItem[]>(queryKey, (items) => {
    if (!items || !evidenceRecordId) {
      return items;
    }

    return items.map((item) => {
      const isClaimScope =
        item.evidence_record.id === evidenceRecordId &&
        item.governance_authority_code === claim.governance_authority_code &&
        item.lifecycle_state === claim.lifecycle_state &&
        item.transition_trigger === claim.transition_trigger;

      if (!isClaimScope) {
        return item;
      }

      return {
        ...item,
        active_claim: claim.claim_status === "ACTIVE" ? claim : null
      };
    });
  });
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
              variant="secondary"
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
          {actionStates.map(({ transition, activeClaim }) => {
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
                      {authorityLabel} review is already claimed by another reviewer.
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
                        variant="secondary"
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
                    variant="secondary"
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
      return "You are not authorized to edit this Draft Operational Evidence record.";
    }

    if (error.status === 409) {
      return "This Operational Evidence record is no longer editable as a Draft.";
    }

    if (error.status === 422) {
      return "The Draft payload was rejected by the backend. Review the highlighted fields and try again.";
    }
  }

  return "The Draft evidence payload could not be saved.";
}
function transitionErrorMessage(error: Error) {
  if (isApiError(error)) {
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
