import { FormEvent, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { routes } from "../app/routePaths";
import { useAuth } from "../auth/useAuth";
import { isApiError } from "../api/errors";
import { Button } from "../ui/components/Button";
import { Surface } from "../ui/components/Surface";
import {
  displayLifecycleStatus,
  displayReviewAuthority
} from "./displayLabels";
import {
  claimGovernanceReview,
  GovernanceQueueClaimFilter,
  GovernanceQueueFilter,
  GovernanceQueueItem,
  listGovernanceQueue
} from "./governanceApi";

interface QueueFilterDraft {
  governanceAuthorityCode: string;
  lifecycleState: string;
  claimStatus: GovernanceQueueClaimFilter;
}

const initialFilterDraft: QueueFilterDraft = {
  governanceAuthorityCode: "",
  lifecycleState: "",
  claimStatus: "ANY"
};

export function GovernanceQueuePage() {
  const auth = useAuth();
  const queryClient = useQueryClient();
  const [filterDraft, setFilterDraft] = useState(initialFilterDraft);
  const [appliedFilters, setAppliedFilters] = useState(initialFilterDraft);
  const [claimConflictMessage, setClaimConflictMessage] = useState<string | null>(null);
  const queryFilters = useMemo(
    () => buildQueueFilters(appliedFilters),
    [appliedFilters]
  );
  const queueQueryKey = [
    "operational-evidence-governance-queue",
    queryFilters
  ] as const;
  const queueQuery = useQuery({
    queryKey: queueQueryKey,
    queryFn: () => listGovernanceQueue(queryFilters)
  });
  const claimMutation = useMutation({
    mutationFn: (item: GovernanceQueueItem) =>
      claimGovernanceReview({
        evidence_record_id: item.evidence_record.id,
        governance_authority_code: item.governance_authority_code,
        transition_trigger: item.transition_trigger
      }),
    onError(error) {
      if (isApiError(error) && error.status === 409) {
        setClaimConflictMessage(
          "This review is already claimed. The queue has been refreshed."
        );
        void queryClient.invalidateQueries({ queryKey: queueQueryKey });
      }
    },
    onSuccess() {
      setClaimConflictMessage(null);
      void queryClient.invalidateQueries({ queryKey: queueQueryKey });
    }
  });

  if (queueQuery.isLoading) {
    return (
      <SafeState title="Loading review queue.">Please wait.</SafeState>
    );
  }

  if (queueQuery.isError) {
    return <QueueErrorState error={queueQuery.error} />;
  }

  const items = queueQuery.data ?? [];

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAppliedFilters(filterDraft);
  }

  return (
    <section aria-labelledby="governance-queue-heading" className="space-y-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-primary-blue">
          Audit Review
        </p>
        <h1
          className="mt-2 text-2xl font-semibold text-text-primary"
          id="governance-queue-heading"
        >
          Review Queue
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-text-muted">
          Find governed review work available to you or already claimed by you.
        </p>
      </div>

      <QueueFilters
        filterDraft={filterDraft}
        onApply={applyFilters}
        onChange={setFilterDraft}
      />

      {claimConflictMessage ? (
        <div
          className="rounded-component border border-state-warning bg-elevated p-3 text-sm text-text-primary"
          role="alert"
        >
          {claimConflictMessage}
        </div>
      ) : null}

      {items.length === 0 ? (
        <Surface>
          <h2 className="text-base font-semibold text-text-primary">
            No review-ready evidence
          </h2>
          <p className="mt-2 text-sm leading-6 text-text-muted">
            There are no audit records currently ready for review in your
            authorized scope.
          </p>
        </Surface>
      ) : (
        <QueueItems
          claimPending={claimMutation.isPending}
          currentUserId={auth.session?.id ?? null}
          items={items}
          onClaim={(item) => claimMutation.mutate(item)}
        />
      )}
    </section>
  );
}

function QueueFilters({
  filterDraft,
  onApply,
  onChange
}: {
  filterDraft: QueueFilterDraft;
  onApply: (event: FormEvent<HTMLFormElement>) => void;
  onChange: (filters: QueueFilterDraft) => void;
}) {
  return (
    <Surface>
      <form className="space-y-4" onSubmit={onApply}>
        <div className="grid gap-3 md:grid-cols-3">
          <label className="block text-sm font-semibold text-text-primary">
            Governance authority
            <input
              className="mt-2 min-h-10 w-full rounded-component border border-border bg-surface px-3 py-2 text-sm text-text-primary outline-none focus:border-focus focus:ring-2 focus:ring-focus"
              onChange={(event) =>
                onChange({
                  ...filterDraft,
                  governanceAuthorityCode: event.currentTarget.value
                })
              }
              value={filterDraft.governanceAuthorityCode}
            />
          </label>
          <label className="block text-sm font-semibold text-text-primary">
            Lifecycle state
            <input
              className="mt-2 min-h-10 w-full rounded-component border border-border bg-surface px-3 py-2 text-sm text-text-primary outline-none focus:border-focus focus:ring-2 focus:ring-focus"
              onChange={(event) =>
                onChange({
                  ...filterDraft,
                  lifecycleState: event.currentTarget.value
                })
              }
              value={filterDraft.lifecycleState}
            />
          </label>
          <label className="block text-sm font-semibold text-text-primary">
            Claim status
            <select
              className="mt-2 min-h-10 w-full rounded-component border border-border bg-surface px-3 py-2 text-sm text-text-primary outline-none focus:border-focus focus:ring-2 focus:ring-focus"
              onChange={(event) =>
                onChange({
                  ...filterDraft,
                  claimStatus: event.currentTarget.value as GovernanceQueueClaimFilter
                })
              }
              value={filterDraft.claimStatus}
            >
              <option value="ANY">Any</option>
              <option value="UNCLAIMED">Available</option>
              <option value="CLAIMED">Claimed</option>
            </select>
          </label>
        </div>
        <Button type="submit" variant="secondary">
          Apply filters
        </Button>
      </form>
    </Surface>
  );
}

function QueueItems({
  claimPending,
  currentUserId,
  items,
  onClaim
}: {
  claimPending: boolean;
  currentUserId: string | null;
  items: GovernanceQueueItem[];
  onClaim: (item: GovernanceQueueItem) => void;
}) {
  return (
    <ul aria-label="Governance review queue" className="space-y-3">
      {items.map((item) => (
        <li key={`${item.evidence_record.id}:${item.transition_trigger}`}>
          <Surface className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 space-y-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="break-words text-lg font-semibold text-text-primary">
                    {item.evidence_record.template_provenance.template_code}
                  </h2>
                  <p className="mt-1 break-all text-sm text-text-muted">
                    Record {item.evidence_record.id}
                  </p>
                </div>
                <span className="inline-flex w-fit rounded-component border border-border px-3 py-1 text-xs font-semibold uppercase text-text-muted">
                  {displayLifecycleStatus(item.lifecycle_state)}
                </span>
              </div>
              <dl className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
                <MetadataItem
                  label="Governance authority"
                  value={displayReviewAuthority(item.governance_authority_code)}
                />
                <MetadataItem
                  label="Claim state"
                  value={claimStateLabel(item, currentUserId)}
                />
                <MetadataItem label="Client ID" value={item.evidence_record.client_id} />
                <MetadataItem
                  label="Facility ID"
                  value={item.evidence_record.facility_id ?? "No facility context"}
                />
              </dl>
              {item.active_claim ? (
                <p className="text-sm text-text-muted">
                  Claimed by {item.active_claim.claimed_by_user_id}.
                </p>
              ) : null}
            </div>
            <QueueItemAction
              claimPending={claimPending}
              currentUserId={currentUserId}
              item={item}
              onClaim={onClaim}
            />
          </Surface>
        </li>
      ))}
    </ul>
  );
}

function QueueItemAction({
  claimPending,
  currentUserId,
  item,
  onClaim
}: {
  claimPending: boolean;
  currentUserId: string | null;
  item: GovernanceQueueItem;
  onClaim: (item: GovernanceQueueItem) => void;
}) {
  const recordPath = routes.evidenceRecordPath(item.evidence_record.id);

  if (!item.active_claim) {
    return (
      <div className="flex shrink-0 flex-wrap gap-2 lg:justify-end">
        <Button disabled={claimPending} onClick={() => onClaim(item)}>
          {claimPending ? "Claiming..." : "Claim Review"}
        </Button>
        <Button asChild variant="secondary">
          <Link to={recordPath}>Open Record</Link>
        </Button>
      </div>
    );
  }

  if (
    currentUserId !== null &&
    item.active_claim.claimed_by_user_id === currentUserId
  ) {
    return (
      <div className="flex shrink-0 lg:justify-end">
        <Button asChild>
          <Link to={recordPath}>Continue Review</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex shrink-0 flex-col gap-2 lg:items-end">
      <p className="rounded-component border border-border bg-canvas px-3 py-2 text-sm text-text-muted">
        Claimed by another reviewer.
      </p>
      <Button asChild variant="secondary">
        <Link to={recordPath}>View Record</Link>
      </Button>
    </div>
  );
}

function MetadataItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-text-muted">
        {label}
      </dt>
      <dd className="mt-1 break-words text-text-primary">{value}</dd>
    </div>
  );
}

function claimStateLabel(
  item: GovernanceQueueItem,
  currentUserId: string | null
) {
  if (!item.active_claim) {
    return "Available";
  }

  return currentUserId !== null &&
    item.active_claim.claimed_by_user_id === currentUserId
    ? "Claimed by you"
    : "Claimed by another reviewer";
}

function buildQueueFilters(filters: QueueFilterDraft): GovernanceQueueFilter {
  return {
    claim_status: filters.claimStatus,
    ...(filters.governanceAuthorityCode.trim()
      ? { governance_authority_code: filters.governanceAuthorityCode.trim() }
      : {}),
    ...(filters.lifecycleState.trim()
      ? { lifecycle_state: filters.lifecycleState.trim() }
      : {})
  };
}

function QueueErrorState({ error }: { error: Error }) {
  if (isApiError(error) && [401, 403].includes(error.status)) {
    return (
      <SafeState title="Review queue is not available.">
        The queue could not be opened with the current authorization context.
      </SafeState>
    );
  }

  return (
    <SafeState title="Review queue could not be loaded.">
      The backend review queue endpoint returned an error.
    </SafeState>
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
