import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { isApiError } from "../api/errors";
import { routes } from "../app/routePaths";
import { CertificationWorkspaceTabs } from "../certifications/CertificationWorkspaceTabs";
import { useAuth } from "../auth/useAuth";
import { Button } from "../ui/components/Button";
import { Surface } from "../ui/components/Surface";
import {
  credentialsCertificationStatuses,
  CredentialsCertificationStatus,
  CredentialsEmploymentStatus,
  credentialsEmploymentStatuses,
  CredentialsFacilityProjection,
  CredentialsPersonnelDetailProjection,
  CredentialsPersonnelProjection,
  CredentialsQualificationProjection,
  getPersonnelCredentials,
  listCredentials
} from "./credentialsApi";

const viewCredentialsPermission = "view_staff_member";

interface CredentialsFilterState {
  clientId: string;
  facilityId: string;
  employmentStatus: CredentialsEmploymentStatus | "";
  certificationStatus: CredentialsCertificationStatus | "";
}

const emptyFilters: CredentialsFilterState = {
  clientId: "",
  facilityId: "",
  employmentStatus: "",
  certificationStatus: ""
};

export function CredentialsListPage() {
  const auth = useAuth();
  const canView = auth.canUsePermission(viewCredentialsPermission);
  const [filters, setFilters] = useState<CredentialsFilterState>(emptyFilters);

  const credentialsQuery = useQuery({
    queryKey: ["credentials", filters],
    queryFn: () =>
      listCredentials({
        ...(filters.clientId ? { clientId: filters.clientId } : {}),
        ...(filters.facilityId ? { facilityId: filters.facilityId } : {}),
        ...(filters.employmentStatus
          ? { employmentStatus: filters.employmentStatus }
          : {}),
        ...(filters.certificationStatus
          ? { certificationStatus: filters.certificationStatus }
          : {})
      }),
    enabled: canView,
    retry: false
  });

  const personnel = useMemo(
    () => credentialsQuery.data?.personnel ?? [],
    [credentialsQuery.data]
  );
  const availableClients = useMemo(
    () => uniqueClients(personnel),
    [personnel]
  );
  const availableFacilities = useMemo(
    () => uniqueFacilities(personnel),
    [personnel]
  );

  if (!canView) {
    return (
      <SafeState title="Credentials are not available with your current authorization.">
        Your current session does not include Personnel credential viewing authority.
      </SafeState>
    );
  }

  return (
    <section aria-labelledby="credentials-heading" className="space-y-4">
      <CertificationWorkspaceTabs />
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-primary-blue">
          Credentials
        </p>
        <h1
          className="mt-2 text-2xl font-semibold text-text-primary"
          id="credentials-heading"
        >
          Personnel Credentials
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-text-muted">
          View authoritative Personnel identity, employment status, and returned qualification projections without issuing or modifying credentials.
        </p>
      </div>

      <CredentialsFilters
        availableClients={availableClients}
        availableFacilities={availableFacilities}
        filters={filters}
        onChange={setFilters}
      />

      {credentialsQuery.isLoading ? (
        <SafeState title="Loading personnel credential records." role="status">
          Please wait.
        </SafeState>
      ) : credentialsQuery.isError ? (
        <CredentialsErrorState error={credentialsQuery.error} />
      ) : personnel.length === 0 ? (
        <Surface>
          <h2 className="text-base font-semibold text-text-primary">
            No personnel credential records are available.
          </h2>
          <p className="mt-2 text-sm leading-6 text-text-muted">
            The Credentials projection did not return any Personnel records for your current filters and authority.
          </p>
        </Surface>
      ) : (
        <CredentialsPersonnelTable personnel={personnel} />
      )}
    </section>
  );
}

export function CredentialsDetailPage() {
  const auth = useAuth();
  const canView = auth.canUsePermission(viewCredentialsPermission);
  const { staffMemberId } = useParams();

  const credentialsQuery = useQuery({
    queryKey: ["credentials-personnel", staffMemberId],
    queryFn: () => getPersonnelCredentials(staffMemberId ?? ""),
    enabled: canView && Boolean(staffMemberId),
    retry: false
  });

  if (!canView) {
    return (
      <SafeState title="Credentials are not available with your current authorization.">
        Your current session does not include Personnel credential viewing authority.
      </SafeState>
    );
  }

  if (!staffMemberId) {
    return (
      <SafeState title="Personnel credential detail is unavailable.">
        No Personnel identifier was provided.
      </SafeState>
    );
  }

  if (credentialsQuery.isLoading) {
    return (
      <SafeState title="Loading personnel credential detail." role="status">
        Please wait.
      </SafeState>
    );
  }

  if (credentialsQuery.isError) {
    return <CredentialsErrorState error={credentialsQuery.error} />;
  }

  if (!credentialsQuery.data) {
    return (
      <SafeState title="Personnel credential detail was not returned.">
        The Credentials service did not return detail data for this Personnel identifier.
      </SafeState>
    );
  }

  return <CredentialsPersonnelDetail detail={credentialsQuery.data} />;
}

function CredentialsFilters({
  availableClients,
  availableFacilities,
  filters,
  onChange
}: {
  availableClients: Array<{ id: string; organization_name: string }>;
  availableFacilities: CredentialsFacilityProjection[];
  filters: CredentialsFilterState;
  onChange: (filters: CredentialsFilterState) => void;
}) {
  return (
    <Surface>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <label className="block text-sm font-semibold text-text-primary">
          Client filter
          <select
            className={inputClassName}
            onChange={(event) =>
              onChange({
                ...filters,
                clientId: event.currentTarget.value,
                facilityId: ""
              })
            }
            value={filters.clientId}
          >
            <option value="">All returned clients</option>
            {availableClients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.organization_name}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-semibold text-text-primary">
          Facility filter
          <select
            className={inputClassName}
            onChange={(event) =>
              onChange({ ...filters, facilityId: event.currentTarget.value })
            }
            value={filters.facilityId}
          >
            <option value="">All returned facilities</option>
            {availableFacilities.map((facility) => (
              <option key={facility.id} value={facility.id}>
                {facility.facility_name}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-semibold text-text-primary">
          Employment status filter
          <select
            className={inputClassName}
            onChange={(event) =>
              onChange({
                ...filters,
                employmentStatus: event.currentTarget
                  .value as CredentialsEmploymentStatus | ""
              })
            }
            value={filters.employmentStatus}
          >
            <option value="">All employment statuses</option>
            {credentialsEmploymentStatuses.map((status) => (
              <option key={status} value={status}>
                {displayCode(status)}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-semibold text-text-primary">
          Certification status filter
          <select
            className={inputClassName}
            onChange={(event) =>
              onChange({
                ...filters,
                certificationStatus: event.currentTarget
                  .value as CredentialsCertificationStatus | ""
              })
            }
            value={filters.certificationStatus}
          >
            <option value="">All certification statuses</option>
            {credentialsCertificationStatuses.map((status) => (
              <option key={status} value={status}>
                {displayCode(status)}
              </option>
            ))}
          </select>
        </label>
      </div>
    </Surface>
  );
}

function CredentialsPersonnelTable({
  personnel
}: {
  personnel: CredentialsPersonnelProjection[];
}) {
  return (
    <Surface>
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-border text-xs uppercase tracking-wide text-text-muted">
            <tr>
              <th className="px-3 py-3 font-semibold" scope="col">
                Personnel / Lifeguard Name
              </th>
              <th className="px-3 py-3 font-semibold" scope="col">
                Hire Date
              </th>
              <th className="px-3 py-3 font-semibold" scope="col">
                Employment Status
              </th>
              <th className="px-3 py-3 font-semibold" scope="col">
                Qualifications
              </th>
              <th className="px-3 py-3 font-semibold" scope="col">
                Detail
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {personnel.map((person) => (
              <tr key={person.id}>
                <th className="px-3 py-4 align-top font-semibold text-text-primary" scope="row">
                  <span className="block break-words">{person.full_name}</span>
                  <span className="mt-1 block text-xs font-normal text-text-muted">
                    {person.client.organization_name}
                  </span>
                </th>
                <td className="px-3 py-4 align-top text-text-primary">
                  {formatDate(person.hire_date)}
                </td>
                <td className="px-3 py-4 align-top">
                  <StatusBadge value={person.employment_status} />
                </td>
                <td className="max-w-md px-3 py-4 align-top">
                  <QualificationList qualifications={person.qualifications} />
                </td>
                <td className="px-3 py-4 align-top">
                  <Button asChild variant="secondary">
                    <Link to={routes.credentialsPersonnelPath(person.id)}>
                      Open Credentials
                    </Link>
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Surface>
  );
}

function CredentialsPersonnelDetail({
  detail
}: {
  detail: CredentialsPersonnelDetailProjection;
}) {
  return (
    <section aria-labelledby="credentials-detail-heading" className="space-y-4">
      <CertificationWorkspaceTabs />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-primary-blue">
            Credentials
          </p>
          <h1
            className="mt-2 text-2xl font-semibold text-text-primary"
            id="credentials-detail-heading"
          >
            {detail.full_name}
          </h1>
          <p className="mt-2 text-sm leading-6 text-text-muted">
            Read-only Personnel credential projection.
          </p>
        </div>
        <Button asChild variant="secondary">
          <Link to={routes.credentials}>Back to Credentials</Link>
        </Button>
      </div>

      <Surface>
        <h2 className="text-base font-semibold text-text-primary">Personnel</h2>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <MetadataItem label="Full name" value={detail.full_name} />
          <MetadataItem label="Hire date" value={formatDate(detail.hire_date)} />
          <MetadataItem
            label="Employment status"
            value={displayCode(detail.employment_status)}
          />
          <MetadataItem label="Email" value={detail.email ?? "Not specified"} />
          <MetadataItem
            label="Phone"
            value={detail.phone_number ?? "Not specified"}
          />
          <MetadataItem label="Client" value={detail.client.organization_name} />
        </dl>
        <div className="mt-4">
          <h3 className="text-sm font-semibold text-text-primary">
            Facility context
          </h3>
          {detail.facilities.length === 0 ? (
            <p className="mt-2 text-sm text-text-muted">
              No facility context was returned in this projection.
            </p>
          ) : (
            <ul className="mt-2 grid gap-2 sm:grid-cols-2">
              {detail.facilities.map((facility) => (
                <li
                  className="rounded-component border border-border bg-elevated px-3 py-2 text-sm"
                  key={facility.id}
                >
                  <span className="block font-semibold text-text-primary">
                    {facility.facility_name}
                  </span>
                  <span className="text-text-muted">
                    {displayCode(facility.assignment_status)}
                    {facility.is_primary_assignment ? " / Primary" : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Surface>

      <Surface>
        <h2 className="text-base font-semibold text-text-primary">
          Qualifications
        </h2>
        <div className="mt-3">
          <QualificationList qualifications={detail.qualifications} />
        </div>
      </Surface>

      <Surface>
        <h2 className="text-base font-semibold text-text-primary">
          Certifications
        </h2>
        {detail.certifications.length === 0 ? (
          <p className="mt-2 text-sm text-text-muted">
            Certification records are not available in this projection.
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {detail.certifications.map((certification) => (
              <li
                className="rounded-component border border-border bg-elevated p-4"
                key={certification.id}
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h3 className="font-semibold text-text-primary">
                      {certification.certification_level}
                    </h3>
                    <p className="text-sm text-text-muted">
                      {certification.certification_number}
                    </p>
                  </div>
                  <StatusBadge value={certification.certification_status} />
                </div>
                <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
                  <MetadataItem
                    label="Issue date"
                    value={formatDate(certification.issue_date)}
                  />
                  <MetadataItem
                    label="Expiry date"
                    value={formatDate(certification.expiry_date)}
                  />
                  <MetadataItem
                    label="Medical clearance"
                    value={yesNo(certification.medical_clearance_provided)}
                  />
                  <MetadataItem
                    label="Fitness standard"
                    value={yesNo(certification.fitness_standard_achieved)}
                  />
                </dl>
                <div className="mt-3">
                  <h4 className="text-sm font-semibold text-text-primary">
                    Endorsements
                  </h4>
                  {certification.endorsements.length === 0 ? (
                    <p className="mt-1 text-sm text-text-muted">
                      No endorsements were returned for this certification.
                    </p>
                  ) : (
                    <ul className="mt-2 flex flex-wrap gap-2">
                      {certification.endorsements.map((endorsement) => (
                        <li
                          className="rounded-component border border-border bg-surface px-2 py-1 text-xs font-semibold text-text-primary"
                          key={`${certification.id}-${endorsement.endorsement}`}
                        >
                          {endorsement.endorsement}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Surface>

      <Surface>
        <h2 className="text-base font-semibold text-text-primary">
          Operational Authorizations
        </h2>
        {detail.operational_authorizations.length === 0 ? (
          <p className="mt-2 text-sm text-text-muted">
            Operational Authorization records are not available in this projection.
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {detail.operational_authorizations.map((authorization) => (
              <li
                className="rounded-component border border-border bg-elevated p-4"
                key={authorization.id}
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h3 className="font-semibold text-text-primary">
                      {authorization.authorization_level}
                    </h3>
                    <p className="text-sm text-text-muted">
                      {authorization.authorization_number}
                    </p>
                  </div>
                  <StatusBadge value={authorization.authorization_status} />
                </div>
                <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
                  <MetadataItem
                    label="Issue date"
                    value={formatDate(authorization.issue_date)}
                  />
                  <MetadataItem
                    label="Expiry date"
                    value={formatDate(authorization.expiry_date)}
                  />
                  <MetadataItem
                    label="Renewal date"
                    value={formatDate(authorization.renewal_date)}
                  />
                  <MetadataItem
                    label="Certification link"
                    value={authorization.certification_id ?? "Not specified"}
                  />
                </dl>
              </li>
            ))}
          </ul>
        )}
      </Surface>
    </section>
  );
}

function QualificationList({
  qualifications
}: {
  qualifications: CredentialsQualificationProjection[];
}) {
  if (qualifications.length === 0) {
    return (
      <p className="text-sm text-text-muted">
        Qualification projection is unavailable or not returned.
      </p>
    );
  }

  return (
    <ul className="flex flex-wrap gap-2">
      {qualifications.map((qualification) => (
        <li
          className="rounded-component border border-border bg-elevated px-2 py-1 text-xs font-semibold text-text-primary"
          key={`${qualification.source_type}-${qualification.source_id}`}
        >
          {qualification.label}
          <span className="ml-1 text-text-muted">
            {displayCode(qualification.status)}
          </span>
        </li>
      ))}
    </ul>
  );
}

function CredentialsErrorState({ error }: { error: Error }) {
  if (isApiError(error) && error.status === 403) {
    return (
      <SafeState title="Credentials are not available with your current authorization.">
        Your current session cannot open Personnel credential records.
      </SafeState>
    );
  }

  if (isApiError(error) && error.status === 404) {
    return (
      <SafeState title="Personnel credential detail was not found.">
        The Credentials service did not return a record for this Personnel identifier.
      </SafeState>
    );
  }

  return (
    <SafeState title="Credentials could not be loaded.">
      The Credentials service returned an error.
    </SafeState>
  );
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

function StatusBadge({ value }: { value: string }) {
  return (
    <span className="inline-flex rounded-component border border-border bg-surface px-2 py-1 text-xs font-semibold uppercase tracking-wide text-text-primary">
      {displayCode(value)}
    </span>
  );
}

function MetadataItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-semibold uppercase tracking-wide text-text-muted">
        {label}
      </dt>
      <dd className="mt-1 break-words text-text-primary">{value}</dd>
    </div>
  );
}

function uniqueClients(personnel: CredentialsPersonnelProjection[]) {
  return Array.from(
    new Map(personnel.map((person) => [person.client.id, person.client])).values()
  );
}

function uniqueFacilities(personnel: CredentialsPersonnelProjection[]) {
  return Array.from(
    new Map(
      personnel.flatMap((person) =>
        person.facilities.map((facility) => [facility.id, facility])
      )
    ).values()
  );
}

function formatDate(value: string | null) {
  if (!value) {
    return "Not specified";
  }

  return value.slice(0, 10);
}

function displayCode(value: string) {
  return value
    .split("_")
    .map((part) => `${part.slice(0, 1)}${part.slice(1).toLowerCase()}`)
    .join(" ");
}

function yesNo(value: boolean) {
  return value ? "Yes" : "No";
}

const inputClassName =
  "mt-2 min-h-10 w-full rounded-component border border-border bg-surface px-3 py-2 text-sm text-text-primary outline-none focus:border-focus focus:ring-2 focus:ring-focus";
