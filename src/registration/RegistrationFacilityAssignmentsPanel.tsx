import { FormEvent, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { isApiError } from "../api/errors";
import { useAuth } from "../auth/useAuth";
import { Button } from "../ui/components/Button";
import { Surface } from "../ui/components/Surface";
import {
  listRegistrationFacilities,
  RegistrationFacility
} from "./registrationFacilityApi";
import {
  createRegistrationFacilityAssignment,
  endRegistrationFacilityAssignment,
  listRegistrationFacilityAssignments,
  RegistrationFacilityAssignment,
  setPrimaryRegistrationFacilityAssignment
} from "./registrationFacilityAssignmentApi";
import { RegistrationPersonnel } from "./registrationPersonnelApi";

const permissions = {
  view: "view_facility_assignment",
  create: "create_facility_assignment",
  update: "update_facility_assignment",
  viewFacilities: "view_facility"
} as const;

interface AddAssignmentFormState {
  facilityId: string;
  assignedFrom: string;
  isPrimaryAssignment: boolean;
  notes: string;
}

interface EndAssignmentFormState {
  assignedTo: string;
  notes: string;
}

const emptyAddForm: AddAssignmentFormState = {
  facilityId: "",
  assignedFrom: "",
  isPrimaryAssignment: false,
  notes: ""
};

const emptyEndForm: EndAssignmentFormState = {
  assignedTo: "",
  notes: ""
};

export function RegistrationFacilityAssignmentsPanel({
  staffMember
}: {
  staffMember: RegistrationPersonnel;
}) {
  const auth = useAuth();
  const queryClient = useQueryClient();
  const canView = auth.canUsePermission(permissions.view);
  const canCreate = auth.canUsePermission(permissions.create);
  const canUpdate = auth.canUsePermission(permissions.update);
  const canViewFacilities = auth.canUsePermission(permissions.viewFacilities);
  const assignmentQueryKey = [
    "registration-facility-assignments",
    staffMember.id
  ] as const;
  const [addForm, setAddForm] = useState<AddAssignmentFormState>(emptyAddForm);
  const [endingAssignmentId, setEndingAssignmentId] = useState<string | null>(null);
  const [endForm, setEndForm] = useState<EndAssignmentFormState>(emptyEndForm);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const assignmentsQuery = useQuery({
    queryKey: assignmentQueryKey,
    queryFn: () => listRegistrationFacilityAssignments(staffMember.id),
    enabled: canView,
    retry: false
  });
  const assignments = assignmentsQuery.data?.assignments ?? [];

  const facilitiesQuery = useQuery({
    queryKey: ["registration-facilities", staffMember.client_id],
    queryFn: () => listRegistrationFacilities({ clientId: staffMember.client_id }),
    enabled: canView && canViewFacilities,
    retry: false
  });
  const facilities = useMemo(
    () => facilitiesQuery.data?.facilities ?? [],
    [facilitiesQuery.data]
  );
  const facilityNameById = useMemo(
    () => new Map(facilities.map((facility) => [facility.id, facility.facility_name])),
    [facilities]
  );

  const createMutation = useMutation({
    mutationFn: () =>
      createRegistrationFacilityAssignment(
        staffMember.id,
        buildCreateAssignmentRequest(addForm)
      ),
    onError: (error) => {
      setMessage(null);
      setErrorMessage(facilityAssignmentErrorMessage(error));
      if (isApiError(error) && error.status === 409) {
        void queryClient.invalidateQueries({ queryKey: assignmentQueryKey });
      }
    },
    onSuccess: () => {
      setErrorMessage(null);
      setMessage("Facility Assignment created successfully.");
      setAddForm(emptyAddForm);
      void queryClient.invalidateQueries({ queryKey: assignmentQueryKey });
      void queryClient.invalidateQueries({ queryKey: ["registration-personnel"] });
    }
  });

  const endMutation = useMutation({
    mutationFn: (assignmentId: string) =>
      endRegistrationFacilityAssignment(
        staffMember.id,
        assignmentId,
        buildEndAssignmentRequest(endForm)
      ),
    onError: (error) => {
      setMessage(null);
      setErrorMessage(facilityAssignmentErrorMessage(error));
      if (isApiError(error) && error.status === 409) {
        void queryClient.invalidateQueries({ queryKey: assignmentQueryKey });
      }
    },
    onSuccess: () => {
      setErrorMessage(null);
      setMessage("Facility Assignment ended. Assignment history is preserved.");
      setEndingAssignmentId(null);
      setEndForm(emptyEndForm);
      void queryClient.invalidateQueries({ queryKey: assignmentQueryKey });
      void queryClient.invalidateQueries({ queryKey: ["registration-personnel"] });
    }
  });

  const primaryMutation = useMutation({
    mutationFn: (assignmentId: string) =>
      setPrimaryRegistrationFacilityAssignment(staffMember.id, assignmentId),
    onError: (error) => {
      setMessage(null);
      setErrorMessage(facilityAssignmentErrorMessage(error));
      if (isApiError(error) && error.status === 409) {
        void queryClient.invalidateQueries({ queryKey: assignmentQueryKey });
      }
    },
    onSuccess: () => {
      setErrorMessage(null);
      setMessage("Primary Facility Assignment updated.");
      void queryClient.invalidateQueries({ queryKey: assignmentQueryKey });
    }
  });

  if (!canView) {
    return null;
  }

  function submitAddAssignment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setErrorMessage(null);
    createMutation.mutate();
  }

  function submitEndAssignment(
    event: FormEvent<HTMLFormElement>,
    assignmentId: string
  ) {
    event.preventDefault();
    setMessage(null);
    setErrorMessage(null);
    endMutation.mutate(assignmentId);
  }

  function openEndForm(assignmentId: string) {
    setMessage(null);
    setErrorMessage(null);
    setEndingAssignmentId(assignmentId);
    setEndForm(emptyEndForm);
  }

  return (
    <Surface aria-label="Facility assignment" className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-text-primary">
          Facility Assignments
        </h2>
        <p className="mt-1 text-sm leading-6 text-text-muted">
          Track where this Personnel record works. This panel records workforce placement history only.
        </p>
      </div>

      {message ? (
        <div role="status">
          <p className="text-sm font-semibold text-text-primary">{message}</p>
        </div>
      ) : null}

      {errorMessage ? (
        <div role="alert">
          <p className="text-sm font-semibold text-text-primary">{errorMessage}</p>
        </div>
      ) : null}

      {assignmentsQuery.isLoading ? (
        <p className="text-sm text-text-muted" role="status">
          Loading Facility Assignments.
        </p>
      ) : assignmentsQuery.isError ? (
        <p className="text-sm text-text-muted">
          Facility Assignment history could not be loaded.
        </p>
      ) : assignments.length === 0 ? (
        <p className="text-sm text-text-muted">
          No Facility Assignment history is currently recorded.
        </p>
      ) : (
        <FacilityAssignmentHistory
          assignments={assignments}
          canUpdate={canUpdate}
          endingAssignmentId={endingAssignmentId}
          endForm={endForm}
          endMutationPending={endMutation.isPending}
          facilityNameById={facilityNameById}
          onCancelEnd={() => {
            setEndingAssignmentId(null);
            setEndForm(emptyEndForm);
          }}
          onEndFormChange={setEndForm}
          onOpenEndForm={openEndForm}
          onSetPrimary={(assignmentId) => primaryMutation.mutate(assignmentId)}
          onSubmitEnd={submitEndAssignment}
          primaryMutationPending={primaryMutation.isPending}
        />
      )}

      {canCreate ? (
        canViewFacilities ? (
          <AddFacilityAssignmentForm
            facilities={facilities}
            facilitiesLoading={facilitiesQuery.isLoading}
            formState={addForm}
            isSubmitting={createMutation.isPending}
            onChange={setAddForm}
            onSubmit={submitAddAssignment}
          />
        ) : (
          <p className="text-sm text-text-muted">
            Facility Assignment creation requires Facility visibility for this Personnel Client.
          </p>
        )
      ) : null}
    </Surface>
  );
}

function FacilityAssignmentHistory({
  assignments,
  canUpdate,
  endingAssignmentId,
  endForm,
  endMutationPending,
  facilityNameById,
  onCancelEnd,
  onEndFormChange,
  onOpenEndForm,
  onSetPrimary,
  onSubmitEnd,
  primaryMutationPending
}: {
  assignments: RegistrationFacilityAssignment[];
  canUpdate: boolean;
  endingAssignmentId: string | null;
  endForm: EndAssignmentFormState;
  endMutationPending: boolean;
  facilityNameById: Map<string, string>;
  onCancelEnd: () => void;
  onEndFormChange: (formState: EndAssignmentFormState) => void;
  onOpenEndForm: (assignmentId: string) => void;
  onSetPrimary: (assignmentId: string) => void;
  onSubmitEnd: (
    event: FormEvent<HTMLFormElement>,
    assignmentId: string
  ) => void;
  primaryMutationPending: boolean;
}) {
  return (
    <ul aria-label="Facility Assignment history" className="space-y-3">
      {assignments.map((assignment) => {
        const facilityLabel = assignmentFacilityLabel(assignment, facilityNameById);
        const isActive = assignment.assignment_status === "ACTIVE";
        const canEnd = canUpdate && isActive;
        const canSetPrimary =
          canUpdate && isActive && !assignment.is_primary_assignment;

        return (
          <li key={assignment.id}>
            <div
              aria-label={`Facility Assignment ${facilityLabel}`}
              className="rounded-component border border-border bg-elevated p-3"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 space-y-3">
                  <div>
                    <h3 className="break-words text-sm font-semibold text-text-primary">
                      {facilityLabel}
                    </h3>
                    <p className="mt-1 break-all text-xs text-text-muted">
                      Assignment ID {assignment.id}
                    </p>
                  </div>
                  <dl className="grid gap-2 text-sm sm:grid-cols-2">
                    <MetadataItem
                      label="Status"
                      value={displayCode(assignment.assignment_status)}
                    />
                    <MetadataItem
                      label="Assigned from"
                      value={assignment.assigned_from}
                    />
                    <MetadataItem
                      label="Assigned to"
                      value={assignment.assigned_to ?? "Currently active"}
                    />
                    <MetadataItem
                      label="Primary"
                      value={
                        assignment.is_primary_assignment ? "Primary" : "Not primary"
                      }
                    />
                    <MetadataItem
                      label="Notes"
                      value={assignment.notes ?? "Not specified"}
                    />
                  </dl>
                </div>
                <div className="flex flex-wrap gap-2 sm:justify-end">
                  {assignment.is_primary_assignment ? (
                    <span className="inline-flex rounded-component border border-border bg-surface px-3 py-2 text-sm font-semibold text-text-primary">
                      Primary
                    </span>
                  ) : null}
                  {canSetPrimary ? (
                    <Button
                      disabled={primaryMutationPending}
                      onClick={() => onSetPrimary(assignment.id)}
                      variant="secondary"
                    >
                      Set Primary
                    </Button>
                  ) : null}
                  {canEnd ? (
                    <Button
                      disabled={endMutationPending}
                      onClick={() => onOpenEndForm(assignment.id)}
                      variant="secondary"
                    >
                      End Assignment
                    </Button>
                  ) : null}
                </div>
              </div>

              {endingAssignmentId === assignment.id ? (
                <form
                  aria-label={`End Assignment for ${facilityLabel}`}
                  className="mt-4 space-y-3 border-t border-border pt-4"
                  onSubmit={(event) => onSubmitEnd(event, assignment.id)}
                >
                  <p className="text-sm text-text-muted">
                    Ending an assignment preserves the historical workforce placement row.
                  </p>
                  <label className="block text-sm font-semibold text-text-primary">
                    Assigned To
                    <input
                      className={inputClassName}
                      onChange={(event) =>
                        onEndFormChange({
                          ...endForm,
                          assignedTo: event.currentTarget.value
                        })
                      }
                      required
                      type="date"
                      value={endForm.assignedTo}
                    />
                  </label>
                  <label className="block text-sm font-semibold text-text-primary">
                    Notes
                    <textarea
                      className="mt-2 min-h-20 w-full rounded-component border border-border bg-surface px-3 py-2 text-sm text-text-primary outline-none focus:border-focus focus:ring-2 focus:ring-focus"
                      onChange={(event) =>
                        onEndFormChange({
                          ...endForm,
                          notes: event.currentTarget.value
                        })
                      }
                      value={endForm.notes}
                    />
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      disabled={endMutationPending || !endForm.assignedTo}
                      type="submit"
                    >
                      End Assignment
                    </Button>
                    <Button
                      disabled={endMutationPending}
                      onClick={onCancelEnd}
                      variant="secondary"
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function AddFacilityAssignmentForm({
  facilities,
  facilitiesLoading,
  formState,
  isSubmitting,
  onChange,
  onSubmit
}: {
  facilities: RegistrationFacility[];
  facilitiesLoading: boolean;
  formState: AddAssignmentFormState;
  isSubmitting: boolean;
  onChange: (formState: AddAssignmentFormState) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const activeFacilities = facilities.filter(
    (facility) => facility.operational_status === "ACTIVE"
  );
  const canSubmit =
    formState.facilityId.trim().length > 0 &&
    formState.assignedFrom.trim().length > 0;

  return (
    <form
      aria-label="Add Facility Assignment"
      className="space-y-4 border-t border-border pt-4"
      onSubmit={onSubmit}
    >
      <h3 className="text-base font-semibold text-text-primary">
        Add Facility Assignment
      </h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm font-semibold text-text-primary">
          Facility
          <select
            className={inputClassName}
            disabled={facilitiesLoading || activeFacilities.length === 0}
            onChange={(event) =>
              onChange({ ...formState, facilityId: event.currentTarget.value })
            }
            required
            value={formState.facilityId}
          >
            <option value="">Select an authorized Facility</option>
            {activeFacilities.map((facility) => (
              <option key={facility.id} value={facility.id}>
                {facility.facility_name}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-semibold text-text-primary">
          Assigned From
          <input
            className={inputClassName}
            onChange={(event) =>
              onChange({ ...formState, assignedFrom: event.currentTarget.value })
            }
            required
            type="date"
            value={formState.assignedFrom}
          />
        </label>
      </div>
      <label className="flex items-center gap-2 text-sm font-semibold text-text-primary">
        <input
          checked={formState.isPrimaryAssignment}
          className="h-4 w-4 rounded border-border text-primary-blue focus:ring-focus"
          onChange={(event) =>
            onChange({
              ...formState,
              isPrimaryAssignment: event.currentTarget.checked
            })
          }
          type="checkbox"
        />
        Primary assignment
      </label>
      <label className="block text-sm font-semibold text-text-primary">
        Notes
        <textarea
          className="mt-2 min-h-20 w-full rounded-component border border-border bg-surface px-3 py-2 text-sm text-text-primary outline-none focus:border-focus focus:ring-2 focus:ring-focus"
          onChange={(event) =>
            onChange({ ...formState, notes: event.currentTarget.value })
          }
          value={formState.notes}
        />
      </label>
      {activeFacilities.length === 0 && !facilitiesLoading ? (
        <p className="text-sm text-text-muted">
          No active authorized Facilities are available for assignment.
        </p>
      ) : null}
      <Button disabled={isSubmitting || !canSubmit} type="submit">
        Add Facility Assignment
      </Button>
    </form>
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

function buildCreateAssignmentRequest(formState: AddAssignmentFormState) {
  return {
    facility_id: formState.facilityId,
    assigned_from: formState.assignedFrom,
    ...(formState.isPrimaryAssignment ? { is_primary_assignment: true } : {}),
    ...optionalNotes(formState.notes)
  };
}

function buildEndAssignmentRequest(formState: EndAssignmentFormState) {
  return {
    assigned_to: formState.assignedTo,
    ...optionalNotes(formState.notes)
  };
}

function optionalNotes(notes: string) {
  const trimmed = notes.trim();

  return trimmed ? { notes: trimmed } : {};
}

function assignmentFacilityLabel(
  assignment: RegistrationFacilityAssignment,
  facilityNameById: Map<string, string>
) {
  return facilityNameById.get(assignment.facility_id) ?? assignment.facility_id;
}

function displayCode(value: string) {
  return value
    .split("_")
    .map((part) => `${part.slice(0, 1)}${part.slice(1).toLowerCase()}`)
    .join(" ");
}

function facilityAssignmentErrorMessage(error: unknown) {
  if (!isApiError(error)) {
    return "Facility Assignment request failed.";
  }

  if (error.status === 400) {
    return "Facility Assignment request could not be accepted. Check required fields and dates.";
  }

  if (error.status === 403) {
    return "You are not authorized to perform this Facility Assignment action.";
  }

  if (error.status === 404) {
    return "The Personnel, Facility, or Assignment is unavailable with your current scope.";
  }

  if (error.status === 409) {
    return "Facility Assignment conflict detected. Assignment history has been refreshed.";
  }

  if (error.status >= 500) {
    return "Facility Assignment request failed. Please try again.";
  }

  return error.message;
}

const inputClassName =
  "mt-2 min-h-10 w-full rounded-component border border-border bg-surface px-3 py-2 text-sm text-text-primary outline-none focus:border-focus focus:ring-2 focus:ring-focus";
