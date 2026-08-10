import { useQuery } from "@tanstack/react-query";

import { isApiError } from "../../api/errors";
import {
  AdministrationUserSummary,
  listAdministrationUsers
} from "../../admin/usersApi";
import { useAuth } from "../../auth/useAuth";
import { Surface } from "../../ui/components/Surface";

const viewUsersPermission = "view_users";

export function AdministrationPage() {
  const auth = useAuth();
  const canViewUsers = auth.canUsePermission(viewUsersPermission);
  const usersQuery = useQuery({
    queryKey: ["administration-users"],
    queryFn: () => listAdministrationUsers(),
    enabled: canViewUsers,
    retry: false
  });

  if (!canViewUsers) {
    return (
      <SafeState title="You are not authorized to view users.">
        Your current session does not include user-listing authority.
      </SafeState>
    );
  }

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

  return (
    <section aria-labelledby="administration-users-heading" className="space-y-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-primary-blue">
          Administration
        </p>
        <h1
          className="mt-2 text-2xl font-semibold text-text-primary"
          id="administration-users-heading"
        >
          Users
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-text-muted">
          View users available through your current administrative authority.
        </p>
      </div>

      {users.length === 0 ? (
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
      )}
    </section>
  );
}

function UserSummaryCard({ user }: { user: AdministrationUserSummary }) {
  return (
    <Surface className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div className="min-w-0">
        <h2 className="text-lg font-semibold text-text-primary">
          {user.full_name}
        </h2>
        <p className="mt-1 break-words text-sm text-text-muted">{user.email}</p>
      </div>
      <dl className="grid gap-3 text-sm text-text-muted sm:grid-cols-2 lg:min-w-[32rem] lg:grid-cols-3">
        <MetadataItem label="Status" value={user.status} />
        <MetadataItem label="Created" value={user.created_at} />
        <MetadataItem label="User ID" lowEmphasis value={user.id} />
      </dl>
    </Surface>
  );
}

function MetadataItem({
  label,
  lowEmphasis = false,
  value
}: {
  label: string;
  lowEmphasis?: boolean;
  value: string;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-semibold uppercase tracking-wide text-text-muted">
        {label}
      </dt>
      <dd
        className={[
          "mt-1 break-words text-text-primary",
          lowEmphasis ? "text-xs text-text-muted" : ""
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {value}
      </dd>
    </div>
  );
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