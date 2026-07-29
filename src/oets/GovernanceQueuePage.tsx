import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { routes } from "../app/routePaths";
import { Surface } from "../ui/components/Surface";
import { Button } from "../ui/components/Button";
import { isApiError } from "../api/errors";
import {
  displayLifecycleStatus,
  displayReviewAuthority
} from "./displayLabels";
import { listGovernanceQueue } from "./governanceApi";

export function GovernanceQueuePage() {
  const queueQuery = useQuery({
    queryKey: ["operational-evidence-governance-queue"],
    queryFn: () =>
      listGovernanceQueue({
        claim_status: "ANY"
      })
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
          Audit records ready for review are listed from the backend review
          queue using the approved template rules.
        </p>
      </div>

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
        <Surface className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border text-left text-sm">
              <thead className="bg-elevated text-xs font-semibold uppercase tracking-wide text-text-muted">
                <tr>
                  <th className="px-4 py-3" scope="col">Record</th>
                  <th className="px-4 py-3" scope="col">Template</th>
                  <th className="px-4 py-3" scope="col">Status</th>
                  <th className="px-4 py-3" scope="col">Reviewer</th>
                  <th className="px-4 py-3" scope="col">Assignment</th>
                  <th className="px-4 py-3" scope="col">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-surface">
                {items.map((item) => (
                  <tr key={`${item.evidence_record.id}:${item.transition_trigger}`}>
                    <td className="px-4 py-3 font-mono text-xs text-text-primary">
                      {item.evidence_record.id}
                    </td>
                    <td className="px-4 py-3 text-text-primary">
                      {item.evidence_record.template_provenance.template_code}
                    </td>
                    <td className="px-4 py-3 text-text-muted">
                      {displayLifecycleStatus(item.lifecycle_state)}
                    </td>
                    <td className="px-4 py-3 text-text-muted">
                      {displayReviewAuthority(item.governance_authority_code)}
                    </td>
                    <td className="px-4 py-3 text-text-muted">
                      {item.active_claim ? "Assigned" : "Unassigned"}
                    </td>
                    <td className="px-4 py-3">
                      <Button asChild variant="secondary">
                        <Link to={routes.evidenceRecordPath(item.evidence_record.id)}>
                          Open audit
                        </Link>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Surface>
      )}
    </section>
  );
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
