import { ReactNode } from "react";
import { useQuery, UseQueryResult } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { isApiError } from "../../api/errors";
import {
  AdministrationUsersResponse,
  AdministrationUserSummary,
  listAdministrationUsers
} from "../../admin/usersApi";
import { routes } from "../routePaths";
import { useAuth } from "../../auth/useAuth";
import { Button } from "../../ui/components/Button";
import { Surface } from "../../ui/components/Surface";
import { WorkspaceShell } from "../../ui/components/WorkspaceShell";
import { RegistrationStatusBadge } from "../../registration/RegistrationWorkspaceUi";

const viewUsersPermission = "view_users";
const createUserPermission = "create_user";

export function AdministrationPage() {
  const auth = useAuth();
  const canViewUsers = auth.canUsePermission(viewUsersPermission);
  const canProvisionClientPoc = auth.canUsePermission(createUserPermission);
  const usersQuery = useQuery({
    queryKey: ["administration-users"],
    queryFn: () => listAdministrationUsers(),
    enabled: canViewUsers,
    retry: false
  });

  if (!canViewUsers && !canProvisionClientPoc) {
    return (
      <SafeState title="You are not authorized to use Administration.">
        Your current session does not include Administration authority.
      </SafeState>
    );
  }

  return (
    <WorkspaceShell
      description="Use the administrative capabilities available through your current server-authorized session."
      headerActions={canProvisionClientPoc ? <Button asChild><Link to={routes.administrationClientPocs}>Provision Client POC</Link></Button> : null}
      headingId="administration-users-heading"
      navigation={null}
      sectionDescription="Review the user accounts visible to your administrative authority."
      sectionTitle="Authorized users"
      showSectionHeader={false}
      title="Administration"
    >
      {canViewUsers ? <AuthorizedUsersPanel usersQuery={usersQuery} /> : null}
    </WorkspaceShell>
  );
}

function AuthorizedUsersPanel({
  usersQuery
}: {
  usersQuery: UseQueryResult<AdministrationUsersResponse, Error>;
}) {
  if (usersQuery.isLoading) {
    return (
      <SafeState title="Loading users." role="status">
        Please wait.
      </SafeState>
    );
  }

  if (usersQuery.isError) {
    return <UsersErrorState error={usersQuery.error} />;
  }

  const users = usersQuery.data ?? [];

  return users.length === 0 ? (
    <Surface>
      <h2 className="text-base font-semibold text-text-primary">
        No users were returned.
      </h2>
      <p className="mt-2 text-sm leading-6 text-text-muted">
        The backend did not return users for your current administrative authority.
      </p>
    </Surface>
  ) : (
    <ul aria-label="Authorized users" className="space-y-3">
      {users.map((user) => (
        <li key={user.id}>
          <UserSummaryCard user={user} />
        </li>
      ))}
    </ul>
  );
}

function UserSummaryCard({ user }: { user: AdministrationUserSummary }) {
  return (
    <article className="cl-record-card rounded-component border pl-1">
      <div className="cl-record-identity grid min-h-24 gap-4 px-5 py-4 sm:grid-cols-[minmax(0,2fr)_minmax(8rem,0.65fr)_minmax(12rem,0.85fr)] sm:items-center">
        <div className="min-w-0 self-center">
          <p className="text-xs font-bold uppercase tracking-wide text-primary-blue">User account</p>
          <h2 className="mt-1 text-lg font-semibold text-text-primary">
            {user.full_name}
          </h2>
          <p className="mt-1 break-words text-sm text-text-muted">{userIdentityLabel(user)}</p>
        </div>
        <MetadataItem label="Status" value={<RegistrationStatusBadge value={user.status} />} />
        <MetadataItem label="Created" value={formatAdministrationDateTime(user.created_at)} />
      </div>
    </article>
  );
}

function userIdentityLabel(user: AdministrationUserSummary) {
  return user.email ?? user.username ?? "No login identifier";
}
function MetadataItem({
  label,
  value
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">
        {label}
      </p>
      <div className="mt-1.5 break-words font-medium text-text-primary">
        {value}
      </div>
    </div>
  );
}

function formatAdministrationDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date unavailable";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function UsersErrorState({ error }: { error: Error }) {
  if (isApiError(error) && error.status === 403) {
    return (
      <SafeState title="You are not authorized to view users.">
        Your current session cannot retrieve the authorized user listing.
      </SafeState>
    );
  }

  return (
    <SafeState title="Users could not be loaded.">
      The authorized user listing returned an error.
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
