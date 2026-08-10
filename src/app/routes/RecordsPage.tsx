import { FormEvent, useMemo, useState } from "react";
import { NavLink, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { isApiError } from "../../api/errors";
import { Button } from "../../ui/components/Button";
import { Surface } from "../../ui/components/Surface";
import { displayLifecycleStatus } from "../../oets/displayLabels";
import {
  listOperationalEvidenceRecords,
  OperationalEvidenceRecordSummary,
  OperationalEvidenceRecordsFilters
} from "../../oets/recordsApi";
import { routes } from "../routePaths";

const recordsPageSize = 25;

interface RecordFilterDraft {
  lifecycleState: string;
  templateCode: string;
  submittedFrom: string;
  submittedTo: string;
}

const initialFilterDraft: RecordFilterDraft = {
  lifecycleState: "",
  templateCode: "",
  submittedFrom: "",
  submittedTo: ""
};

export function RecordsPage() {
  const [filterDraft, setFilterDraft] = useState(initialFilterDraft);
  const [appliedFilters, setAppliedFilters] = useState(initialFilterDraft);
  const [offset, setOffset] = useState(0);
  const queryFilters = useMemo(
    () => buildRecordsQueryFilters(appliedFilters, offset),
    [appliedFilters, offset]
  );
  const recordsQuery = useQuery({
    queryKey: ["operational-evidence-records", queryFilters],
    queryFn: () => listOperationalEvidenceRecords(queryFilters),
    retry: false
  });
  const records = recordsQuery.data?.records ?? [];
  const pagination = recordsQuery.data?.pagination;

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAppliedFilters(filterDraft);
    setOffset(0);
  }

  return (
    <section aria-labelledby="records-heading" className="space-y-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-primary-blue">
          Operations
        </p>
        <h1
          className="mt-2 text-2xl font-semibold text-text-primary"
          id="records-heading"
        >
          Records
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-text-muted">
          Browse Operational Evidence records you are authorized to view.
        </p>
      </div>

      <OperationsChildNavigation />

      <RecordsFilters
        filterDraft={filterDraft}
        onApply={applyFilters}
        onChange={setFilterDraft}
      />

      {recordsQuery.isLoading ? (
        <SafeState title="Loading records." role="status">
          Please wait.
        </SafeState>
      ) : recordsQuery.isError ? (
        <RecordsErrorState error={recordsQuery.error} />
      ) : records.length === 0 ? (
        <Surface>
          <h2 className="text-base font-semibold text-text-primary">
            No records are currently available.
          </h2>
          <p className="mt-2 text-sm leading-6 text-text-muted">
            The Records query did not return any Operational Evidence records.
          </p>
        </Surface>
      ) : (
        <RecordsList records={records} />
      )}

      {pagination ? (
        <RecordsPagination
          onNext={() => setOffset(pagination.offset + pagination.limit)}
          onPrevious={() =>
            setOffset(Math.max(0, pagination.offset - pagination.limit))
          }
          pagination={pagination}
        />
      ) : null}
    </section>
  );
}

export function OperationsChildNavigation() {
  return (
    <nav aria-label="Operations navigation">
      <ul className="flex flex-wrap gap-2">
        <li>
          <NavLink
            className={childNavigationClassName}
            end
            to={routes.operations}
          >
            Forms & Audits
          </NavLink>
        </li>
        <li>
          <NavLink
            className={childNavigationClassName}
            to={routes.records}
          >
            Records
          </NavLink>
        </li>
      </ul>
    </nav>
  );
}

function RecordsFilters({
  filterDraft,
  onApply,
  onChange
}: {
  filterDraft: RecordFilterDraft;
  onApply: (event: FormEvent<HTMLFormElement>) => void;
  onChange: (filters: RecordFilterDraft) => void;
}) {
  return (
    <Surface>
      <form className="space-y-4" onSubmit={onApply}>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
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
            Template code
            <input
              className="mt-2 min-h-10 w-full rounded-component border border-border bg-surface px-3 py-2 text-sm text-text-primary outline-none focus:border-focus focus:ring-2 focus:ring-focus"
              onChange={(event) =>
                onChange({
                  ...filterDraft,
                  templateCode: event.currentTarget.value
                })
              }
              value={filterDraft.templateCode}
            />
          </label>
          <label className="block text-sm font-semibold text-text-primary">
            Submitted from
            <input
              className="mt-2 min-h-10 w-full rounded-component border border-border bg-surface px-3 py-2 text-sm text-text-primary outline-none focus:border-focus focus:ring-2 focus:ring-focus"
              onChange={(event) =>
                onChange({
                  ...filterDraft,
                  submittedFrom: event.currentTarget.value
                })
              }
              type="datetime-local"
              value={filterDraft.submittedFrom}
            />
          </label>
          <label className="block text-sm font-semibold text-text-primary">
            Submitted to
            <input
              className="mt-2 min-h-10 w-full rounded-component border border-border bg-surface px-3 py-2 text-sm text-text-primary outline-none focus:border-focus focus:ring-2 focus:ring-focus"
              onChange={(event) =>
                onChange({
                  ...filterDraft,
                  submittedTo: event.currentTarget.value
                })
              }
              type="datetime-local"
              value={filterDraft.submittedTo}
            />
          </label>
        </div>
        <Button type="submit" variant="secondary">
          Apply filters
        </Button>
      </form>
    </Surface>
  );
}

function RecordsList({
  records
}: {
  records: OperationalEvidenceRecordSummary[];
}) {
  return (
    <ul aria-label="Operational Evidence records" className="space-y-3">
      {records.map((record) => (
        <li key={record.evidence_record_id}>
          <Surface className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 space-y-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="break-words text-lg font-semibold text-text-primary">
                    {record.template_code}
                  </h2>
                  <p className="mt-1 break-all text-sm text-text-muted">
                    Record {record.evidence_record_id}
                  </p>
                </div>
                <span className="inline-flex w-fit rounded-component border border-border px-3 py-1 text-xs font-semibold uppercase text-text-muted">
                  {displayLifecycleStatus(record.lifecycle_state)}
                </span>
              </div>
              <dl className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-5">
                <MetadataItem label="Submitted at" value={record.submitted_at} />
                <MetadataItem label="Client ID" value={record.client_id} />
                <MetadataItem
                  label="Facility ID"
                  value={record.facility_id ?? "No facility context"}
                />
                <MetadataItem
                  label="Template version"
                  value={record.template_version}
                />
                <MetadataItem label="Created at" value={record.created_at} />
              </dl>
            </div>
            <div className="flex shrink-0 lg:pt-1">
              <Button asChild>
                <Link to={routes.evidenceRecordPath(record.evidence_record_id)}>
                  View Record
                </Link>
              </Button>
            </div>
          </Surface>
        </li>
      ))}
    </ul>
  );
}

function RecordsPagination({
  onNext,
  onPrevious,
  pagination
}: {
  onNext: () => void;
  onPrevious: () => void;
  pagination: { limit: number; offset: number; count: number; total_count: number };
}) {
  const start = pagination.total_count === 0 ? 0 : pagination.offset + 1;
  const end = pagination.offset + pagination.count;
  const canGoPrevious = pagination.offset > 0;
  const canGoNext = end < pagination.total_count;

  return (
    <Surface className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-text-muted">
        Showing {start}-{end} of {pagination.total_count}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button disabled={!canGoPrevious} onClick={onPrevious} variant="secondary">
          Previous
        </Button>
        <Button disabled={!canGoNext} onClick={onNext} variant="secondary">
          Next
        </Button>
      </div>
    </Surface>
  );
}

function RecordsErrorState({ error }: { error: Error }) {
  if (isApiError(error) && error.status === 403) {
    return (
      <SafeState title="Records are not available with your current authorization.">
        Your current session cannot open the Records query.
      </SafeState>
    );
  }

  return (
    <SafeState title="Records could not be loaded.">
      The backend Records query returned an error.
    </SafeState>
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

function buildRecordsQueryFilters(
  filters: RecordFilterDraft,
  offset: number
): OperationalEvidenceRecordsFilters {
  return {
    limit: recordsPageSize,
    offset,
    ...(filters.lifecycleState.trim()
      ? { lifecycle_state: filters.lifecycleState.trim() }
      : {}),
    ...(filters.templateCode.trim()
      ? { template_code: filters.templateCode.trim() }
      : {}),
    ...(filters.submittedFrom
      ? { submitted_from: toUtcDateTime(filters.submittedFrom) }
      : {}),
    ...(filters.submittedTo
      ? { submitted_to: toUtcDateTime(filters.submittedTo) }
      : {})
  };
}

function toUtcDateTime(value: string) {
  return value.length === 16 ? `${value}:00.000Z` : value;
}

function childNavigationClassName({ isActive }: { isActive: boolean }) {
  return [
    "inline-flex min-h-10 items-center rounded-component px-3 text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-canvas",
    isActive
      ? "bg-primary-navy text-text-inverse"
      : "border border-border bg-surface text-text-primary hover:bg-elevated"
  ].join(" ");
}

function SafeState({
  title,
  children,
  role
}: {
  title: string;
  children: string;
  role?: "status";
}) {
  return (
    <Surface role={role}>
      <h1 className="text-xl font-semibold text-text-primary">{title}</h1>
      <p className="mt-2 text-sm text-text-muted">{children}</p>
    </Surface>
  );
}
