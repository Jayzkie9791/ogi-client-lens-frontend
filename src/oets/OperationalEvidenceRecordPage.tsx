import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

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
  transitionOperationalEvidenceRecord
} from "./evidenceSubmissionApi";

import { resolveGovernanceAuthorityCode } from "./governanceAuthorityResolver";
import {
  claimGovernanceReview,
  GovernanceQueueItem,
  GovernanceReviewClaim,
  listGovernanceQueue,
  releaseGovernanceReviewClaim,
  transitionClaimedGovernanceReview
} from "./governanceApi";

import { OetsRenderer } from "./OetsRenderer";
import { getRuntimeTemplateVersion } from "./runtimeTemplateApi";
import { OetsDefinition } from "./types";

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

export function OperationalEvidenceRecordPage() {
  const { recordId } = useParams();
  const auth = useAuth();
  const queryClient = useQueryClient();
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
        client_id: record.client_id,
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
    mutationFn: (claim: GovernanceReviewClaim) =>
      transitionClaimedGovernanceReview(claim.id),
    onSuccess() {
      void queryClient.invalidateQueries({
        queryKey: ["operational-evidence-record", recordId]
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

  return (
    <div className="space-y-4">
      <Surface className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">
              Audit Record
            </p>
            <h1 className="mt-1 break-all text-2xl font-semibold text-text-primary">
              {record.id}
            </h1>
          </div>
          <span className="inline-flex w-fit rounded-component border border-border px-3 py-1 text-xs font-semibold uppercase text-text-muted">
            {displayLifecycleStatus(record.lifecycle_state)}
          </span>
        </div>
        <MetadataGrid
          entries={[
            ["Template code", record.template_provenance.template_code],
            ["Template version", record.template_provenance.template_version],
            [
              "Template version ID",
              record.template_provenance.template_version_id
            ],
            ["Schema version", record.template_provenance.schema_version],
            ["Client ID", record.client_id],
            ["Facility ID", record.facility_id ?? "No facility context"],
            ["Payload checksum", record.payload_checksum],
            ["Template checksum", record.template_provenance.checksum],
            ["Created by", record.created_by_user_id],
            ["Submitted by", record.submitted_by_user_id],
            ["Created at", record.created_at],
            ["Submitted at", record.submitted_at],
            ["Updated at", record.updated_at]
          ]}
        />
      </Surface>

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
        onTransition={(claim) => claimedTransitionMutation.mutate(claim)}
        releaseError={releaseClaimMutation.error}
        releasePending={releaseClaimMutation.isPending}
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

      <OetsRenderer
        definition={narrowing.definition}
        initialPayload={record.payload}
        readOnly
        runtimeTemplate={templateQuery.data}
      />
    </div>
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
          Review
        </p>
        <h2 className="mt-1 text-base font-semibold text-text-primary">
          Available Actions
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
  onTransition,
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
  onClaim: (transition: GovernanceWorkflowTransition) => void;
  onRelease: (claim: GovernanceReviewClaim) => void;
  onTransition: (claim: GovernanceReviewClaim) => void;
  releaseError: Error | null;
  releasePending: boolean;
}) {
  const error = claimError ?? releaseError ?? claimedTransitionError;

  if (actionStates.length === 0 && !error && !loadClaimStateError) {
    return null;
  }

  return (
    <Surface className="space-y-3">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">
          Review Assignment
        </p>
        <h2 className="mt-1 text-base font-semibold text-text-primary">
          Assigned Review Actions
        </h2>
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
        <div className="flex flex-wrap gap-3">
          {actionStates.map(({ transition, activeClaim }) => {
            if (activeClaim) {
              const isOwnedByCurrentUser =
                currentUserId !== null &&
                activeClaim.claimed_by_user_id === currentUserId;

              if (!isOwnedByCurrentUser) {
                return (
                  <p
                    className="rounded-component border border-border bg-canvas px-3 py-2 text-sm text-text-muted"
                    key={transitionKey(transition)}
                  >
                    {displayReviewAuthority(transition.governanceAuthorityCode)} review is already assigned.
                  </p>
                );
              }

              return (
                <div className="flex flex-wrap gap-3" key={transitionKey(transition)}>
                  <Button
                    disabled={claimedTransitionPending || releasePending}
                    onClick={() => onTransition(activeClaim)}
                    variant="secondary"
                  >
                    {claimedTransitionPending ? "Starting review..." : "Start Review"}
                  </Button>
                  <Button
                    disabled={claimedTransitionPending || releasePending}
                    onClick={() => onRelease(activeClaim)}
                    variant="secondary"
                  >
                    {releasePending ? "Returning..." : "Return to Queue"}
                  </Button>
                </div>
              );
            }

            return (
              <Button
                disabled={claimPending}
                key={transitionKey(transition)}
                onClick={() => onClaim(transition)}
                variant="secondary"
              >
                {claimPending
                  ? "Assigning..."
                  : "Assign to Me"}
              </Button>
            );
          })}
        </div>
      )}

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

function findAvailableTransitions(
  definition: OetsDefinition,
  lifecycleState: string
): WorkflowTransition[] {
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

    if (!from || !to || !trigger || from !== lifecycleState) {
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

function MetadataGrid({ entries }: { entries: Array<[string, string]> }) {
  return (
    <dl className="grid gap-3 md:grid-cols-2">
      {entries.map(([label, value]) => (
        <div className="rounded-component border border-border bg-canvas p-3" key={label}>
          <dt className="text-xs font-semibold uppercase tracking-wide text-text-muted">
            {label}
          </dt>
          <dd className="mt-1 break-all text-sm text-text-primary">{value}</dd>
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
