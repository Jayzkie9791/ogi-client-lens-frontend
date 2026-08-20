import { FormEvent, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { isApiError } from "../api/errors";
import { routes } from "../app/routePaths";
import { useAuth } from "../auth/useAuth";
import {
  listRegistrationClients,
  RegistrationClient
} from "../registration/registrationClientApi";
import {
  listRegistrationPersonnel,
  RegistrationPersonnel
} from "../registration/registrationPersonnelApi";
import { RegistrationWorkspaceShell } from "../registration/RegistrationWorkspaceShell";
import { Button } from "../ui/components/Button";
import { Surface } from "../ui/components/Surface";
import {
  assignTrainingEnrollmentSession,
  createTrainingAttendanceEvidenceDraft,
  createTrainingEvidenceDraft,
  createTrainingEnrollment,
  createTrainingTrainee,
  getTrainingAttendanceEvidenceWorkspace,
  getTrainingEvidenceWorkspace,
  linkTrainingAttendanceEvidence,
  linkTrainingTraineeStaffMember,
  getTrainingTrainee,
  listTrainingEnrollments,
  listTrainingSessions,
  listTrainingTrainees,
  TrainingAttendanceEvidenceRecord,
  TrainingAttendanceEvidenceWorkspace,
  TrainingEnrollment,
  TrainingEnrollmentSessionSummary,
  TrainingEvidenceWorkspace,
  TrainingEvidenceWorkspaceRecord,
  TrainingEvidenceWorkspaceSlot,
  TrainingProgramCode,
  TrainingSession,
  trainingProgramOptions,
  TrainingTrainee
} from "./trainingApi";

const permissions = {
  view: "view_training",
  registerTrainee: "register_trainee",
  linkPersonnel: "link_training_staff_member",
  createEnrollment: "create_training_enrollment",
  assignSession: "assign_training_session",
  viewClients: "view_client",
  viewPersonnel: "view_staff_member"
} as const;

interface TraineeFormState {
  fullName: string;
  email: string;
  phoneNumber: string;
  notes: string;
}

interface EnrollmentFormState {
  programCode: TrainingProgramCode | "";
  clientId: string;
  trainingSessionId: string;
  notes: string;
}

const emptyTraineeForm: TraineeFormState = {
  fullName: "",
  email: "",
  phoneNumber: "",
  notes: ""
};

const emptyEnrollmentForm: EnrollmentFormState = {
  programCode: "",
  clientId: "",
  trainingSessionId: "",
  notes: ""
};

export function RegistrationTrainingPage() {
  const auth = useAuth();
  const queryClient = useQueryClient();
  const canView = auth.canUsePermission(permissions.view);
  const canRegisterTrainee = auth.canUsePermission(permissions.registerTrainee);
  const canLinkPersonnel = auth.canUsePermission(permissions.linkPersonnel);
  const canCreateEnrollment = auth.canUsePermission(
    permissions.createEnrollment
  );
  const canAssignSession = auth.canUsePermission(permissions.assignSession);
  const canViewClients = auth.canUsePermission(permissions.viewClients);
  const canViewPersonnel = auth.canUsePermission(permissions.viewPersonnel);
  const [selectedTraineeId, setSelectedTraineeId] = useState<string | null>(null);
  const [traineeIdBeforeCreate, setTraineeIdBeforeCreate] = useState<
    string | null
  >(null);
  const [isCreatingTrainee, setIsCreatingTrainee] = useState(false);
  const [isLinkingPersonnel, setIsLinkingPersonnel] = useState(false);
  const [isAddingEnrollment, setIsAddingEnrollment] = useState(false);
  const [assigningEnrollmentId, setAssigningEnrollmentId] = useState<
    string | null
  >(null);
  const [assignmentSessionId, setAssignmentSessionId] = useState("");
  const [selectedStaffMemberId, setSelectedStaffMemberId] = useState("");
  const [traineeForm, setTraineeForm] =
    useState<TraineeFormState>(emptyTraineeForm);
  const [enrollmentForm, setEnrollmentForm] =
    useState<EnrollmentFormState>(emptyEnrollmentForm);
  const [message, setMessage] = useState<string | null>(null);

  const traineesQuery = useQuery({
    queryKey: ["training-trainees"],
    queryFn: () => listTrainingTrainees(),
    enabled: canView,
    retry: false
  });
  const trainees = useMemo(
    () => traineesQuery.data?.trainees ?? [],
    [traineesQuery.data]
  );

  useEffect(() => {
    if (!selectedTraineeId && trainees.length > 0) {
      setSelectedTraineeId(trainees[0].id);
    }

    if (
      selectedTraineeId &&
      trainees.length > 0 &&
      !trainees.some((trainee) => trainee.id === selectedTraineeId)
    ) {
      setSelectedTraineeId(trainees[0].id);
    }

    if (selectedTraineeId && trainees.length === 0) {
      setSelectedTraineeId(null);
    }
  }, [selectedTraineeId, trainees]);

  const selectedTraineeQuery = useQuery({
    queryKey: ["training-trainee", selectedTraineeId],
    queryFn: () => getTrainingTrainee(selectedTraineeId ?? ""),
    enabled: canView && selectedTraineeId !== null,
    retry: false
  });

  const enrollmentsQuery = useQuery({
    queryKey: ["training-enrollments", selectedTraineeId],
    queryFn: () => listTrainingEnrollments(selectedTraineeId ?? ""),
    enabled: canView && selectedTraineeId !== null && !isCreatingTrainee,
    retry: false
  });

  const clientsQuery = useQuery({
    queryKey: ["registration-clients"],
    queryFn: () => listRegistrationClients(),
    enabled: canViewClients && isAddingEnrollment,
    retry: false
  });
  const clients = useMemo(
    () => clientsQuery.data?.clients ?? [],
    [clientsQuery.data]
  );

  const sessionsQuery = useQuery({
    queryKey: ["training-sessions"],
    queryFn: () => listTrainingSessions(),
    enabled: canView && (isAddingEnrollment || assigningEnrollmentId !== null),
    retry: false
  });
  const sessions = useMemo(
    () => sessionsQuery.data?.sessions ?? [],
    [sessionsQuery.data]
  );

  const personnelQuery = useQuery({
    queryKey: ["registration-personnel"],
    queryFn: () => listRegistrationPersonnel(),
    enabled: canViewPersonnel && isLinkingPersonnel,
    retry: false
  });
  const personnel = useMemo(
    () => personnelQuery.data?.personnel ?? [],
    [personnelQuery.data]
  );

  const createTraineeMutation = useMutation({
    mutationFn: () => createTrainingTrainee(buildCreateTraineeRequest(traineeForm)),
    onSuccess: (trainee) => {
      setMessage("Trainee registered successfully.");
      setTraineeForm(emptyTraineeForm);
      setIsCreatingTrainee(false);
      setTraineeIdBeforeCreate(null);
      setSelectedTraineeId(trainee.id);
      void queryClient.invalidateQueries({ queryKey: ["training-trainees"] });
      queryClient.setQueryData(["training-trainee", trainee.id], trainee);
    }
  });

  const linkPersonnelMutation = useMutation({
    mutationFn: () => {
      if (!selectedTraineeId) {
        throw new Error("No Trainee is selected.");
      }

      return linkTrainingTraineeStaffMember(selectedTraineeId, {
        staff_member_id: selectedStaffMemberId
      });
    },
    onSuccess: () => {
      setMessage("Linked Personnel record successfully.");
      setIsLinkingPersonnel(false);
      setSelectedStaffMemberId("");
      void queryClient.invalidateQueries({
        queryKey: ["training-trainee", selectedTraineeId]
      });
    }
  });

  const createEnrollmentMutation = useMutation({
    mutationFn: () => {
      if (!selectedTraineeId) {
        throw new Error("No Trainee is selected.");
      }

      return createTrainingEnrollment(
        selectedTraineeId,
        buildCreateEnrollmentRequest(enrollmentForm)
      );
    },
    onSuccess: () => {
      setMessage("Training enrollment added successfully.");
      setEnrollmentForm(emptyEnrollmentForm);
      setIsAddingEnrollment(false);
      void queryClient.invalidateQueries({
        queryKey: ["training-enrollments", selectedTraineeId]
      });
    }
  });

  const assignSessionMutation = useMutation({
    mutationFn: () => {
      if (!assigningEnrollmentId) {
        throw new Error("No Enrollment is selected.");
      }

      return assignTrainingEnrollmentSession(assigningEnrollmentId, {
        training_session_id: assignmentSessionId
      });
    },
    onSuccess: () => {
      setMessage("Training Session assigned successfully.");
      setAssigningEnrollmentId(null);
      setAssignmentSessionId("");
      void queryClient.invalidateQueries({
        queryKey: ["training-enrollments", selectedTraineeId]
      });
    }
  });

  function startRegisterTrainee() {
    setMessage(null);
    setTraineeIdBeforeCreate(selectedTraineeId);
    setTraineeForm(emptyTraineeForm);
    setIsCreatingTrainee(true);
    setIsLinkingPersonnel(false);
    setIsAddingEnrollment(false);
    setAssigningEnrollmentId(null);
    setAssignmentSessionId("");
  }

  function cancelRegisterTrainee() {
    setMessage(null);
    setTraineeForm(emptyTraineeForm);
    setSelectedTraineeId(traineeIdBeforeCreate);
    setTraineeIdBeforeCreate(null);
    setIsCreatingTrainee(false);
  }

  function selectTrainee(traineeId: string) {
    setMessage(null);
    setSelectedTraineeId(traineeId);
    setTraineeIdBeforeCreate(null);
    setIsCreatingTrainee(false);
    setIsLinkingPersonnel(false);
    setIsAddingEnrollment(false);
    setAssigningEnrollmentId(null);
    setAssignmentSessionId("");
  }

  function submitRegisterTrainee(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    createTraineeMutation.mutate();
  }

  function submitPersonnelLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    linkPersonnelMutation.mutate();
  }

  function submitEnrollment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    createEnrollmentMutation.mutate();
  }

  function submitSessionAssignment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    assignSessionMutation.mutate();
  }

  if (!canView) {
    return (
      <SafeState title="You are not authorized to view Training registration.">
        Your current session does not include Training registration authority.
      </SafeState>
    );
  }

  return (
    <RegistrationWorkspaceShell
      description="Manage Trainee identities, optional Personnel links, and Training Enrollments without implying completion or certification."
      headingId="registration-training-heading"
      title="Training"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <p className="text-sm leading-6 text-text-muted">
          Register trainees, link known Personnel records when appropriate, and add governed training enrollments.
        </p>
        {canRegisterTrainee ? (
          <Button
            aria-expanded={isCreatingTrainee}
            onClick={startRegisterTrainee}
            type="button"
          >
            Register Trainee
          </Button>
        ) : null}
      </div>

      {message ? (
        <Surface role="status">
          <p className="text-sm font-semibold text-text-primary">{message}</p>
        </Surface>
      ) : null}

      <TrainingErrorAlert
        error={
          createTraineeMutation.error ??
          linkPersonnelMutation.error ??
          createEnrollmentMutation.error ??
          assignSessionMutation.error
        }
      />

      {traineesQuery.isLoading ? (
        <SafeState title="Loading Trainee records." role="status">
          Please wait.
        </SafeState>
      ) : traineesQuery.isError ? (
        <TrainingLoadErrorState error={traineesQuery.error} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(16rem,0.8fr)_minmax(0,1.2fr)]">
          <TraineeList
            onSelectTrainee={selectTrainee}
            selectedTraineeId={selectedTraineeId}
            trainees={trainees}
          />

          {isCreatingTrainee ? (
            <TraineeCreatePanel
              formState={traineeForm}
              isSubmitting={createTraineeMutation.isPending}
              onCancel={cancelRegisterTrainee}
              onChange={setTraineeForm}
              onSubmit={submitRegisterTrainee}
            />
          ) : trainees.length === 0 ? (
            <TrainingEmptyDetailPanel canCreate={canRegisterTrainee} />
          ) : (
            <TraineeDetailsPanel
              canCreateEnrollment={canCreateEnrollment}
              canAssignSession={canAssignSession}
              canLinkPersonnel={canLinkPersonnel}
              canViewClients={canViewClients}
              canViewPersonnel={canViewPersonnel}
              assigningEnrollmentId={assigningEnrollmentId}
              assignmentSessionId={assignmentSessionId}
              clients={clients}
              clientsLoading={clientsQuery.isLoading}
              enrollmentForm={enrollmentForm}
              enrollments={enrollmentsQuery.data?.enrollments ?? []}
              enrollmentsLoading={enrollmentsQuery.isLoading}
              isAddingEnrollment={isAddingEnrollment}
              isAssigningSession={assignSessionMutation.isPending}
              isLinkingPersonnel={isLinkingPersonnel}
              isSubmittingEnrollment={createEnrollmentMutation.isPending}
              isSubmittingLink={linkPersonnelMutation.isPending}
              onCancelEnrollment={() => {
                setIsAddingEnrollment(false);
                setEnrollmentForm(emptyEnrollmentForm);
              }}
              onCancelSessionAssignment={() => {
                setAssigningEnrollmentId(null);
                setAssignmentSessionId("");
              }}
              onCancelLink={() => setIsLinkingPersonnel(false)}
              onChangeAssignmentSessionId={setAssignmentSessionId}
              onChangeEnrollment={setEnrollmentForm}
              onChangeSelectedStaffMember={setSelectedStaffMemberId}
              onStartSessionAssignment={(enrollmentId) => {
                setMessage(null);
                setAssigningEnrollmentId(enrollmentId);
                setAssignmentSessionId("");
                setIsAddingEnrollment(false);
                setIsLinkingPersonnel(false);
              }}
              onStartEnrollment={() => {
                setMessage(null);
                setEnrollmentForm(emptyEnrollmentForm);
                setIsAddingEnrollment(true);
                setIsLinkingPersonnel(false);
                setAssigningEnrollmentId(null);
                setAssignmentSessionId("");
              }}
              onStartLink={() => {
                setMessage(null);
                setSelectedStaffMemberId("");
                setIsLinkingPersonnel(true);
                setIsAddingEnrollment(false);
                setAssigningEnrollmentId(null);
                setAssignmentSessionId("");
              }}
              onSubmitEnrollment={submitEnrollment}
              onSubmitSessionAssignment={submitSessionAssignment}
              onSubmitLink={submitPersonnelLink}
              personnel={personnel}
              personnelLoading={personnelQuery.isLoading}
              selectedStaffMemberId={selectedStaffMemberId}
              sessions={sessions}
              sessionsLoading={sessionsQuery.isLoading}
              trainee={selectedTraineeQuery.data ?? null}
              traineeLoading={selectedTraineeQuery.isLoading}
            />
          )}
        </div>
      )}
    </RegistrationWorkspaceShell>
  );
}

function TraineeList({
  onSelectTrainee,
  selectedTraineeId,
  trainees
}: {
  onSelectTrainee: (traineeId: string) => void;
  selectedTraineeId: string | null;
  trainees: readonly TrainingTrainee[];
}) {
  return (
    <Surface>
      <div className="mb-3">
        <h2 className="text-base font-semibold text-text-primary">Trainees</h2>
        <p className="mt-1 text-sm text-text-muted">
          Select a Trainee to review identity, Personnel link, and enrollments.
        </p>
      </div>
      {trainees.length === 0 ? (
        <div className="rounded-component border border-dashed border-border p-4">
          <h3 className="text-sm font-semibold text-text-primary">
            No trainees registered.
          </h3>
        </div>
      ) : (
        <ul aria-label="Trainee records" className="space-y-2">
          {trainees.map((trainee) => {
            const isSelected = selectedTraineeId === trainee.id;

            return (
              <li key={trainee.id}>
                <button
                  aria-current={isSelected ? "true" : undefined}
                  className={[
                    "w-full rounded-component border px-3 py-3 text-left outline-none transition focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
                    isSelected
                      ? "border-primary-navy bg-elevated shadow-sm"
                      : "border-border bg-surface hover:bg-elevated"
                  ].join(" ")}
                  onClick={() => onSelectTrainee(trainee.id)}
                  type="button"
                >
                  <span className="block break-words text-sm font-semibold text-text-primary">
                    {trainee.full_name}
                  </span>
                  <span className="mt-2 block text-xs font-semibold uppercase tracking-wide text-text-muted">
                    {studentNumberLabel(trainee.student_number)}
                  </span>
                  {trainee.email ? (
                    <span className="mt-2 block break-words text-sm text-text-muted">
                      {trainee.email}
                    </span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Surface>
  );
}

function TraineeDetailsPanel({
  assigningEnrollmentId,
  assignmentSessionId,
  canAssignSession,
  canCreateEnrollment,
  canLinkPersonnel,
  canViewClients,
  canViewPersonnel,
  clients,
  clientsLoading,
  enrollmentForm,
  enrollments,
  enrollmentsLoading,
  isAddingEnrollment,
  isAssigningSession,
  isLinkingPersonnel,
  isSubmittingEnrollment,
  isSubmittingLink,
  onCancelEnrollment,
  onCancelSessionAssignment,
  onCancelLink,
  onChangeAssignmentSessionId,
  onChangeEnrollment,
  onChangeSelectedStaffMember,
  onStartSessionAssignment,
  onStartEnrollment,
  onStartLink,
  onSubmitEnrollment,
  onSubmitSessionAssignment,
  onSubmitLink,
  personnel,
  personnelLoading,
  selectedStaffMemberId,
  sessions,
  sessionsLoading,
  trainee,
  traineeLoading
}: {
  assigningEnrollmentId: string | null;
  assignmentSessionId: string;
  canAssignSession: boolean;
  canCreateEnrollment: boolean;
  canLinkPersonnel: boolean;
  canViewClients: boolean;
  canViewPersonnel: boolean;
  clients: readonly RegistrationClient[];
  clientsLoading: boolean;
  enrollmentForm: EnrollmentFormState;
  enrollments: readonly TrainingEnrollment[];
  enrollmentsLoading: boolean;
  isAddingEnrollment: boolean;
  isAssigningSession: boolean;
  isLinkingPersonnel: boolean;
  isSubmittingEnrollment: boolean;
  isSubmittingLink: boolean;
  onCancelEnrollment: () => void;
  onCancelSessionAssignment: () => void;
  onCancelLink: () => void;
  onChangeAssignmentSessionId: (trainingSessionId: string) => void;
  onChangeEnrollment: (formState: EnrollmentFormState) => void;
  onChangeSelectedStaffMember: (staffMemberId: string) => void;
  onStartSessionAssignment: (enrollmentId: string) => void;
  onStartEnrollment: () => void;
  onStartLink: () => void;
  onSubmitEnrollment: (event: FormEvent<HTMLFormElement>) => void;
  onSubmitSessionAssignment: (event: FormEvent<HTMLFormElement>) => void;
  onSubmitLink: (event: FormEvent<HTMLFormElement>) => void;
  personnel: readonly RegistrationPersonnel[];
  personnelLoading: boolean;
  selectedStaffMemberId: string;
  sessions: readonly TrainingSession[];
  sessionsLoading: boolean;
  trainee: TrainingTrainee | null;
  traineeLoading: boolean;
}) {
  if (traineeLoading) {
    return (
      <SafeState title="Loading Trainee details." role="status">
        Please wait.
      </SafeState>
    );
  }

  if (!trainee) {
    return (
      <SafeState title="Select a Trainee.">
        Choose a Training registration record to view its details.
      </SafeState>
    );
  }

  return (
    <div className="space-y-4">
      <Surface>
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-text-primary">
              {trainee.full_name}
            </h2>
            <p className="mt-1 text-sm text-text-muted">
              Student number: {studentNumberValue(trainee.student_number)}
            </p>
          </div>

          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <MetadataItem label="Email" value={trainee.email ?? "Not specified"} />
            <MetadataItem
              label="Phone"
              value={trainee.phone_number ?? "Not specified"}
            />
            <MetadataItem label="Notes" value={trainee.notes ?? "Not specified"} />
            <MetadataItem label="Created" value={trainee.created_at} />
            <MetadataItem label="Updated" value={trainee.updated_at} />
          </dl>
        </div>
      </Surface>

      <Surface>
        <PersonnelLinkSection
          canLinkPersonnel={canLinkPersonnel}
          canViewPersonnel={canViewPersonnel}
          isLinkingPersonnel={isLinkingPersonnel}
          isSubmitting={isSubmittingLink}
          onCancel={onCancelLink}
          onChangeSelectedStaffMember={onChangeSelectedStaffMember}
          onStartLink={onStartLink}
          onSubmit={onSubmitLink}
          personnel={personnel}
          personnelLoading={personnelLoading}
          selectedStaffMemberId={selectedStaffMemberId}
          trainee={trainee}
        />
      </Surface>

      <TrainingAttendanceEvidencePanel enrollments={enrollments} />

      <Surface>
        <EnrollmentSection
          assigningEnrollmentId={assigningEnrollmentId}
          assignmentSessionId={assignmentSessionId}
          canAssignSession={canAssignSession}
          canCreateEnrollment={canCreateEnrollment}
          canViewClients={canViewClients}
          clients={clients}
          clientsLoading={clientsLoading}
          enrollmentForm={enrollmentForm}
          enrollments={enrollments}
          isAddingEnrollment={isAddingEnrollment}
          isAssigningSession={isAssigningSession}
          isLoading={enrollmentsLoading}
          isSubmitting={isSubmittingEnrollment}
          onCancel={onCancelEnrollment}
          onCancelSessionAssignment={onCancelSessionAssignment}
          onChangeAssignmentSessionId={onChangeAssignmentSessionId}
          onChange={onChangeEnrollment}
          onStartSessionAssignment={onStartSessionAssignment}
          onStartEnrollment={onStartEnrollment}
          onSubmit={onSubmitEnrollment}
          onSubmitSessionAssignment={onSubmitSessionAssignment}
          sessions={sessions}
          sessionsLoading={sessionsLoading}
        />
      </Surface>
    </div>
  );
}

function PersonnelLinkSection({
  canLinkPersonnel,
  canViewPersonnel,
  isLinkingPersonnel,
  isSubmitting,
  onCancel,
  onChangeSelectedStaffMember,
  onStartLink,
  onSubmit,
  personnel,
  personnelLoading,
  selectedStaffMemberId,
  trainee
}: {
  canLinkPersonnel: boolean;
  canViewPersonnel: boolean;
  isLinkingPersonnel: boolean;
  isSubmitting: boolean;
  onCancel: () => void;
  onChangeSelectedStaffMember: (staffMemberId: string) => void;
  onStartLink: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  personnel: readonly RegistrationPersonnel[];
  personnelLoading: boolean;
  selectedStaffMemberId: string;
  trainee: TrainingTrainee;
}) {
  const activeLink = trainee.staff_member_links.find(
    (link) => link.ended_at === null
  );

  return (
    <section aria-labelledby="training-personnel-link-heading" className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3
            className="text-base font-semibold text-text-primary"
            id="training-personnel-link-heading"
          >
            Personnel Link
          </h3>
          <p className="mt-1 text-sm text-text-muted">
            Explicitly link this Trainee to a known Personnel record when both identities represent the same person.
          </p>
        </div>
        {!activeLink && canLinkPersonnel ? (
          <Button
            aria-expanded={isLinkingPersonnel}
            onClick={onStartLink}
            type="button"
            variant="secondary"
          >
            Link Personnel
          </Button>
        ) : null}
      </div>

      {activeLink ? (
        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <MetadataItem
            label="Linked Personnel record"
            value={activeLink.staff_member.full_name}
          />
          <MetadataItem
            label="Personnel email"
            value={activeLink.staff_member.email ?? "Not specified"}
          />
        </dl>
      ) : (
        <p className="text-sm text-text-muted">
          No linked Personnel record.
        </p>
      )}

      {isLinkingPersonnel ? (
        !canViewPersonnel ? (
          <p className="text-sm text-text-muted">
            Personnel selector unavailable with your current view authority.
          </p>
        ) : (
          <form
            aria-label="Link Personnel"
            className="space-y-3"
            onSubmit={onSubmit}
          >
            <label className="block text-sm font-semibold text-text-primary">
              Personnel record
              <select
                className={inputClassName}
                disabled={personnelLoading}
                onChange={(event) =>
                  onChangeSelectedStaffMember(event.currentTarget.value)
                }
                required
                value={selectedStaffMemberId}
              >
                <option value="">Select Personnel</option>
                {personnel.map((staffMember) => (
                  <option key={staffMember.id} value={staffMember.id}>
                    {personnelOptionLabel(staffMember)}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex flex-wrap gap-2">
              <Button
                disabled={isSubmitting || !selectedStaffMemberId}
                type="submit"
              >
                Save Personnel Link
              </Button>
              <Button
                disabled={isSubmitting}
                onClick={onCancel}
                type="button"
                variant="secondary"
              >
                Cancel
              </Button>
            </div>
          </form>
        )
      ) : null}
    </section>
  );
}

function EnrollmentSection({
  assigningEnrollmentId,
  assignmentSessionId,
  canAssignSession,
  canCreateEnrollment,
  canViewClients,
  clients,
  clientsLoading,
  enrollmentForm,
  enrollments,
  isAddingEnrollment,
  isAssigningSession,
  isLoading,
  isSubmitting,
  onCancel,
  onCancelSessionAssignment,
  onChangeAssignmentSessionId,
  onChange,
  onStartSessionAssignment,
  onStartEnrollment,
  onSubmit,
  onSubmitSessionAssignment,
  sessions,
  sessionsLoading
}: {
  assigningEnrollmentId: string | null;
  assignmentSessionId: string;
  canAssignSession: boolean;
  canCreateEnrollment: boolean;
  canViewClients: boolean;
  clients: readonly RegistrationClient[];
  clientsLoading: boolean;
  enrollmentForm: EnrollmentFormState;
  enrollments: readonly TrainingEnrollment[];
  isAddingEnrollment: boolean;
  isAssigningSession: boolean;
  isLoading: boolean;
  isSubmitting: boolean;
  onCancel: () => void;
  onCancelSessionAssignment: () => void;
  onChangeAssignmentSessionId: (trainingSessionId: string) => void;
  onChange: (formState: EnrollmentFormState) => void;
  onStartSessionAssignment: (enrollmentId: string) => void;
  onStartEnrollment: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onSubmitSessionAssignment: (event: FormEvent<HTMLFormElement>) => void;
  sessions: readonly TrainingSession[];
  sessionsLoading: boolean;
}) {
  return (
    <section aria-labelledby="training-enrollments-heading" className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3
            className="text-base font-semibold text-text-primary"
            id="training-enrollments-heading"
          >
            Enrollments
          </h3>
          <p className="mt-1 text-sm text-text-muted">
            Enrollment records show intended program registration only.
          </p>
        </div>
        {canCreateEnrollment ? (
          <Button
            aria-expanded={isAddingEnrollment}
            onClick={onStartEnrollment}
            type="button"
            variant="secondary"
          >
            Add Enrollment
          </Button>
        ) : null}
      </div>

      {isLoading ? (
        <p role="status" className="text-sm text-text-muted">
          Loading enrollments.
        </p>
      ) : enrollments.length === 0 ? (
        <p className="text-sm text-text-muted">
          No training enrollments recorded.
        </p>
      ) : (
        <ul aria-label="Training enrollments" className="space-y-2">
          {enrollments.map((enrollment) => (
            <li
              className="rounded-component border border-border p-3"
              key={enrollment.id}
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <h4 className="text-sm font-semibold text-text-primary">
                  {programLabel(enrollment.program)}
                </h4>
                {!enrollment.training_session && canAssignSession ? (
                  <Button
                    aria-expanded={assigningEnrollmentId === enrollment.id}
                    onClick={() => onStartSessionAssignment(enrollment.id)}
                    type="button"
                    variant="secondary"
                  >
                    Assign Training Session
                  </Button>
                ) : null}
              </div>
              <dl className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
                <MetadataItem label="Enrolled" value={enrollment.enrolled_at} />
                <MetadataItem
                  label="Sponsoring Client"
                  value={enrollment.client?.organization_name ?? "None"}
                />
                <MetadataItem
                  label="Training Session"
                  value={enrollment.training_session?.training_title ?? "None"}
                />
                <MetadataItem
                  label="Notes"
                  value={enrollment.notes ?? "Not specified"}
                />
              </dl>
              {assigningEnrollmentId === enrollment.id ? (
                <form
                  aria-label="Assign Training Session"
                  className="mt-3 space-y-3"
                  onSubmit={onSubmitSessionAssignment}
                >
                  <label className="block text-sm font-semibold text-text-primary">
                    Training Session
                    <select
                      className={inputClassName}
                      disabled={sessionsLoading}
                      onChange={(event) =>
                        onChangeAssignmentSessionId(event.currentTarget.value)
                      }
                      required
                      value={assignmentSessionId}
                    >
                      <option value="">Select Training Session</option>
                      {sessions.map((session) => (
                        <option key={session.id} value={session.id}>
                          {sessionOptionLabel(session)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      disabled={
                        isAssigningSession ||
                        sessionsLoading ||
                        !assignmentSessionId
                      }
                      type="submit"
                    >
                      Save Session Assignment
                    </Button>
                    <Button
                      disabled={isAssigningSession}
                      onClick={onCancelSessionAssignment}
                      type="button"
                      variant="secondary"
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              ) : null}
              <TrainingEvidenceWorkspacePanel enrollment={enrollment} />
            </li>
          ))}
        </ul>
      )}

      {isAddingEnrollment ? (
        <form aria-label="Add Enrollment" className="space-y-3" onSubmit={onSubmit}>
          <label className="block text-sm font-semibold text-text-primary">
            Program
            <select
              className={inputClassName}
              onChange={(event) =>
                onChange({
                  ...enrollmentForm,
                  programCode: event.currentTarget.value as TrainingProgramCode
                })
              }
              required
              value={enrollmentForm.programCode}
            >
              <option value="">Select a governed program</option>
              {trainingProgramOptions.map((program) => (
                <option key={program.program_code} value={program.program_code}>
                  {programSelectLabel(program)}
                </option>
              ))}
            </select>
          </label>

          {canViewClients ? (
            <label className="block text-sm font-semibold text-text-primary">
              Sponsoring Client (optional)
              <select
                className={inputClassName}
                disabled={clientsLoading}
                onChange={(event) =>
                  onChange({
                    ...enrollmentForm,
                    clientId: event.currentTarget.value
                  })
                }
                value={enrollmentForm.clientId}
              >
                <option value="">No sponsoring Client</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.organization_name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <label className="block text-sm font-semibold text-text-primary">
            Training Session (optional)
            <select
              className={inputClassName}
              disabled={sessionsLoading}
              onChange={(event) =>
                onChange({
                  ...enrollmentForm,
                  trainingSessionId: event.currentTarget.value
                })
              }
              value={enrollmentForm.trainingSessionId}
            >
              <option value="">No Training Session</option>
              {sessions.map((session) => (
                <option key={session.id} value={session.id}>
                  {sessionOptionLabel(session)}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm font-semibold text-text-primary">
            Notes
            <textarea
              className="mt-2 min-h-24 w-full rounded-component border border-border bg-surface px-3 py-2 text-sm text-text-primary outline-none focus:border-focus focus:ring-2 focus:ring-focus"
              onChange={(event) =>
                onChange({
                  ...enrollmentForm,
                  notes: event.currentTarget.value
                })
              }
              value={enrollmentForm.notes}
            />
          </label>

          <div className="flex flex-wrap gap-2">
            <Button
              disabled={isSubmitting || !enrollmentForm.programCode}
              type="submit"
            >
              Save Enrollment
            </Button>
            <Button
              disabled={isSubmitting}
              onClick={onCancel}
              type="button"
              variant="secondary"
            >
              Cancel
            </Button>
          </div>
        </form>
      ) : null}
    </section>
  );
}

function TrainingAttendanceEvidencePanel({
  enrollments
}: {
  enrollments: readonly TrainingEnrollment[];
}) {
  const queryClient = useQueryClient();
  const [selectedSessionId, setSelectedSessionId] = useState("");
  const [selectedEnrollmentIds, setSelectedEnrollmentIds] = useState<string[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const sessionOptions = useMemo(
    () => uniqueEnrollmentSessionSummaries(enrollments),
    [enrollments]
  );
  const workspaceQueryKey = [
    "training",
    "session",
    selectedSessionId,
    "attendance-evidence-workspace"
  ] as const;
  const workspaceQuery = useQuery({
    queryKey: workspaceQueryKey,
    queryFn: () => getTrainingAttendanceEvidenceWorkspace(selectedSessionId),
    enabled: selectedSessionId !== "",
    retry: false
  });
  const workspace = workspaceQuery.data ?? null;
  const createDraftMutation = useMutation({
    mutationFn: () =>
      createTrainingAttendanceEvidenceDraft(selectedSessionId, {
        enrollment_ids: selectedEnrollmentIds
      }),
    onError(error) {
      if (isApiError(error) && error.status === 409) {
        setMessage(attendanceEvidenceConflictMessage(error));
        void queryClient.invalidateQueries({ queryKey: workspaceQueryKey });
        return;
      }

      setMessage(attendanceEvidenceErrorMessage(error, "create"));
    },
    onSuccess() {
      setMessage("Attendance evidence draft created.");
      setSelectedEnrollmentIds([]);
      void queryClient.invalidateQueries({ queryKey: workspaceQueryKey });
    }
  });
  const linkEvidenceMutation = useMutation({
    mutationFn: (record: TrainingAttendanceEvidenceRecord) =>
      linkTrainingAttendanceEvidence(
        selectedSessionId,
        record.evidence.evidence_record_id
      ),
    onError(error) {
      if (isApiError(error) && error.status === 409) {
        setMessage("Evidence is not currently eligible for linking. Workspace refreshed.");
        void queryClient.invalidateQueries({ queryKey: workspaceQueryKey });
        return;
      }

      setMessage(attendanceEvidenceErrorMessage(error, "link"));
    },
    onSuccess(_result, record) {
      setMessage("Attendance evidence linked to persisted roster.");
      void queryClient.invalidateQueries({ queryKey: workspaceQueryKey });
      record.roster.forEach((enrollment) => {
        void queryClient.invalidateQueries({
          queryKey: [
            "training",
            "enrollment",
            enrollment.id,
            "evidence-workspace"
          ]
        });
      });
    }
  });

  const eligibleEnrollmentIds =
    workspace?.eligible_enrollments.map((item) => item.enrollment.id) ?? [];
  const canCreateAttendanceDraft = Boolean(
    workspace &&
      workspace.can_create_draft &&
      selectedEnrollmentIds.length > 0 &&
      !createDraftMutation.isPending &&
      !workspace.active_draft
  );

  function selectSession(trainingSessionId: string) {
    setSelectedSessionId(trainingSessionId);
    setSelectedEnrollmentIds([]);
    setMessage(null);
  }

  function toggleEnrollment(enrollmentId: string) {
    setSelectedEnrollmentIds((current) =>
      current.includes(enrollmentId)
        ? current.filter((id) => id !== enrollmentId)
        : [...current, enrollmentId]
    );
  }

  return (
    <Surface>
      <section aria-labelledby="training-attendance-evidence-heading" className="space-y-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-primary-blue">
            Attendance Evidence
          </p>
          <h3
            className="text-base font-semibold text-text-primary"
            id="training-attendance-evidence-heading"
          >
            F-022 Session Roster
          </h3>
          <p className="mt-1 text-sm text-text-muted">
            Session-level shared roster evidence for enrolled Trainees.
          </p>
        </div>

        {sessionOptions.length === 0 ? (
          <p className="rounded-component border border-dashed border-border p-3 text-sm text-text-muted">
            Select a Training Session to manage attendance evidence.
          </p>
        ) : (
          <label className="block text-sm font-semibold text-text-primary">
            Attendance Training Session
            <select
              className={inputClassName}
              onChange={(event) => selectSession(event.currentTarget.value)}
              value={selectedSessionId}
            >
              <option value="">Select a Training Session</option>
              {sessionOptions.map((session) => (
                <option key={session.id} value={session.id}>
                  {sessionSummaryOptionLabel(session)}
                </option>
              ))}
            </select>
          </label>
        )}

        {!selectedSessionId ? (
          <p className="text-sm text-text-muted">
            Select a Training Session to manage attendance evidence.
          </p>
        ) : workspaceQuery.isLoading ? (
          <p className="text-sm text-text-muted" role="status">
            Loading Attendance Evidence workspace.
          </p>
        ) : workspaceQuery.isError ? (
          <p className="text-sm text-text-muted" role="alert">
            {attendanceEvidenceErrorMessage(workspaceQuery.error, "workspace")}
          </p>
        ) : workspace ? (
          <div className="space-y-4">
            <TrainingAttendanceSessionSummary workspace={workspace} />
            <TrainingAttendanceRosterSelection
              canCreate={canCreateAttendanceDraft}
              isCreating={createDraftMutation.isPending}
              onClearSelection={() => setSelectedEnrollmentIds([])}
              onCreate={() => {
                setMessage(null);
                createDraftMutation.mutate();
              }}
              onSelectAll={() => setSelectedEnrollmentIds(eligibleEnrollmentIds)}
              onToggleEnrollment={toggleEnrollment}
              selectedEnrollmentIds={selectedEnrollmentIds}
              workspace={workspace}
            />
            <TrainingAttendanceHistory
              isLinking={linkEvidenceMutation.isPending}
              onLink={(record) => {
                setMessage(null);
                linkEvidenceMutation.mutate(record);
              }}
              workspace={workspace}
            />
          </div>
        ) : null}

        {message ? (
          <p className="text-sm font-semibold text-text-primary" role="status">
            {message}
          </p>
        ) : null}
      </section>
    </Surface>
  );
}

function TrainingAttendanceSessionSummary({
  workspace
}: {
  workspace: TrainingAttendanceEvidenceWorkspace;
}) {
  return (
    <dl className="grid gap-2 text-sm sm:grid-cols-2">
      <MetadataItem label="Session" value={workspace.session.training_title} />
      <MetadataItem
        label="Session Dates"
        value={sessionRecordDateRange(workspace.session)}
      />
      <MetadataItem
        label="Instructor"
        value={
          workspace.session.instructor_name ??
          workspace.session.instructor_staff_member?.full_name ??
          "Not specified"
        }
      />
      <MetadataItem
        label="Facility"
        value={workspace.session.facility?.facility_name ?? "None"}
      />
      <MetadataItem
        label="Client context"
        value={attendanceClientContextLabel(workspace)}
      />
      <MetadataItem
        label="Roster context"
        value={`${workspace.eligible_enrollments.length} eligible enrollments`}
      />
    </dl>
  );
}

function TrainingAttendanceRosterSelection({
  canCreate,
  isCreating,
  onClearSelection,
  onCreate,
  onSelectAll,
  onToggleEnrollment,
  selectedEnrollmentIds,
  workspace
}: {
  canCreate: boolean;
  isCreating: boolean;
  onClearSelection: () => void;
  onCreate: () => void;
  onSelectAll: () => void;
  onToggleEnrollment: (enrollmentId: string) => void;
  selectedEnrollmentIds: readonly string[];
  workspace: TrainingAttendanceEvidenceWorkspace;
}) {
  if (workspace.eligible_enrollments.length === 0) {
    return (
      <div className="rounded-component border border-dashed border-border p-3">
        <p className="text-sm text-text-muted">
          No eligible enrollments are assigned to this Training Session.
        </p>
        <Button disabled type="button" variant="secondary">
          Create Attendance Evidence
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Button onClick={onSelectAll} type="button" variant="secondary">
          Select All
        </Button>
        <Button onClick={onClearSelection} type="button" variant="secondary">
          Clear Selection
        </Button>
        <Button disabled={!canCreate || isCreating} onClick={onCreate} type="button">
          Create Attendance Evidence
        </Button>
      </div>

      {workspace.active_draft ? (
        <div className="rounded-component border border-border bg-canvas p-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-text-primary">
                Active Attendance Draft
              </p>
              <p className="mt-1 text-sm text-text-muted">
                {workspace.active_draft.evidence.document_number ?? "OGI F-022"} - {humanizeCode(workspace.active_draft.evidence.lifecycle_state)}
              </p>
              <p className="mt-1 text-sm text-text-muted">
                Roster: {workspace.active_draft.roster_count} enrollments
              </p>
            </div>
            <Link
              className={buttonLinkClassName}
              state={{ returnTo: routes.registrationTraining }}
              to={routes.evidenceRecordPath(
                workspace.active_draft.evidence.evidence_record_id
              )}
            >
              Open Attendance Draft
            </Link>
          </div>
        </div>
      ) : null}

      <ul aria-label="Eligible attendance roster" className="space-y-2">
        {workspace.eligible_enrollments.map((item) => {
          const enrollment = item.enrollment;
          const checked = selectedEnrollmentIds.includes(enrollment.id);

          return (
            <li
              className="rounded-component border border-border bg-surface p-3"
              key={enrollment.id}
            >
              <label className="flex items-start gap-3 text-sm text-text-primary">
                <input
                  checked={checked}
                  className="mt-1 size-4"
                  onChange={() => onToggleEnrollment(enrollment.id)}
                  type="checkbox"
                />
                <span className="min-w-0">
                  <span className="block font-semibold">
                    {enrollment.trainee.full_name}
                  </span>
                  <span className="mt-1 block text-text-muted">
                    {studentNumberValue(enrollment.trainee.student_number)} - {programLabel(enrollment.program)}
                  </span>
                  <span className="mt-1 block text-text-muted">
                    Client: {enrollment.client?.organization_name ?? "OGI Direct / Independent"}
                  </span>
                </span>
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function TrainingAttendanceHistory({
  isLinking,
  onLink,
  workspace
}: {
  isLinking: boolean;
  onLink: (record: TrainingAttendanceEvidenceRecord) => void;
  workspace: TrainingAttendanceEvidenceWorkspace;
}) {
  if (workspace.history.length === 0) {
    return <p className="text-sm text-text-muted">No F-022 attendance evidence history yet.</p>;
  }

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-semibold text-text-primary">
        F-022 History
      </h4>
      <ul aria-label="F-022 attendance evidence history" className="space-y-2">
        {workspace.history.map((record) => (
          <TrainingAttendanceHistoryItem
            isLinking={isLinking}
            key={record.evidence.evidence_record_id}
            onLink={onLink}
            record={record}
          />
        ))}
      </ul>
    </div>
  );
}

function TrainingAttendanceHistoryItem({
  isLinking,
  onLink,
  record
}: {
  isLinking: boolean;
  onLink: (record: TrainingAttendanceEvidenceRecord) => void;
  record: TrainingAttendanceEvidenceRecord;
}) {
  return (
    <li className="rounded-component border border-border bg-canvas p-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-text-primary">
            {record.evidence.document_number ?? "OGI F-022"}
          </p>
          <p className="mt-1 text-sm text-text-muted">
            {record.evidence.template_name ?? "Course Attendance Verification"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            className={buttonLinkClassName}
            state={{ returnTo: routes.registrationTraining }}
            to={routes.evidenceRecordPath(record.evidence.evidence_record_id)}
          >
            {record.evidence.lifecycle_state === "DRAFT"
              ? "Open Attendance Draft"
              : "View Attendance Evidence"}
          </Link>
          {record.can_link ? (
            <Button
              disabled={isLinking}
              onClick={() => onLink(record)}
              type="button"
              variant="secondary"
            >
              Link Attendance Evidence
            </Button>
          ) : null}
        </div>
      </div>
      <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
        <MetadataItem label="Lifecycle" value={humanizeCode(record.evidence.lifecycle_state)} />
        <MetadataItem label="Created" value={formatDateTime(record.evidence.created_at)} />
        <MetadataItem label="Submitted" value={formatDateTime(record.evidence.submitted_at)} />
        <MetadataItem label="Link Status" value={attendanceLinkStatus(record)} />
      </dl>
      <details className="mt-3 rounded-component border border-border bg-surface p-3">
        <summary className="cursor-pointer text-sm font-semibold text-text-primary">
          Persisted roster
        </summary>
        <ul className="mt-3 space-y-2">
          {record.roster.map((enrollment) => (
            <li className="text-sm text-text-muted" key={enrollment.id}>
              <span className="font-semibold text-text-primary">
                {enrollment.trainee.full_name}
              </span>{" "}
              - {studentNumberValue(enrollment.trainee.student_number)} - {programLabel(enrollment.program)} - {record.linked_enrollment_ids.includes(enrollment.id) ? "Linked" : "Not yet linked"}
            </li>
          ))}
        </ul>
      </details>
    </li>
  );
}
function TrainingEvidenceWorkspacePanel({
  enrollment
}: {
  enrollment: TrainingEnrollment;
}) {
  const queryClient = useQueryClient();
  const [message, setMessage] = useState<string | null>(null);
  const workspaceQueryKey = [
    "training",
    "enrollment",
    enrollment.id,
    "evidence-workspace"
  ] as const;
  const workspaceQuery = useQuery({
    queryKey: workspaceQueryKey,
    queryFn: () => getTrainingEvidenceWorkspace(enrollment.id),
    retry: false
  });
  const createDraftMutation = useMutation({
    mutationFn: (slot: TrainingEvidenceWorkspaceSlot) =>
      createTrainingEvidenceDraft(enrollment.id, {
        template_code: slot.template_code
      }),
    onError(error) {
      if (isApiError(error) && error.status === 409) {
        setMessage("An active draft already exists. Workspace refreshed.");
        void queryClient.invalidateQueries({ queryKey: workspaceQueryKey });
        return;
      }

      setMessage(trainingEvidenceErrorMessage(error));
    },
    onSuccess() {
      setMessage("Training evidence draft created.");
      void queryClient.invalidateQueries({ queryKey: workspaceQueryKey });
    }
  });

  return (
    <section
      aria-label={`${programLabel(enrollment.program)} Training Evidence`}
      className="mt-4 space-y-3 rounded-component border border-border bg-canvas p-3"
    >
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-primary-blue">
          Training Evidence
        </p>
        <h5 className="mt-1 text-sm font-semibold text-text-primary">
          Skills, Knowledge, and Readiness
        </h5>
      </div>

      {workspaceQuery.isLoading ? (
        <p className="text-sm text-text-muted" role="status">
          Loading Training Evidence workspace.
        </p>
      ) : workspaceQuery.isError ? (
        <p className="text-sm text-text-muted" role="alert">
          {trainingEvidenceErrorMessage(workspaceQuery.error)}
        </p>
      ) : workspaceQuery.data ? (
        <TrainingEvidenceWorkspaceContent
          isCreatingDraft={createDraftMutation.isPending}
          onCreateDraft={(slot) => {
            setMessage(null);
            createDraftMutation.mutate(slot);
          }}
          workspace={workspaceQuery.data}
        />
      ) : null}

      {message ? (
        <p className="text-sm font-semibold text-text-primary" role="status">
          {message}
        </p>
      ) : null}
    </section>
  );
}

function TrainingEvidenceWorkspaceContent({
  isCreatingDraft,
  onCreateDraft,
  workspace
}: {
  isCreatingDraft: boolean;
  onCreateDraft: (slot: TrainingEvidenceWorkspaceSlot) => void;
  workspace: TrainingEvidenceWorkspace;
}) {
  return (
    <div className="space-y-3">
      <dl className="grid gap-2 text-sm sm:grid-cols-2">
        <MetadataItem
          label="Trainee"
          value={workspace.enrollment.trainee.full_name}
        />
        <MetadataItem
          label="Student Number"
          value={studentNumberValue(workspace.enrollment.trainee.student_number)}
        />
        <MetadataItem
          label="Program"
          value={programLabel(workspace.enrollment.program)}
        />
        <MetadataItem
          label="Enrolled"
          value={formatDateTime(workspace.enrollment.enrolled_at)}
        />
        <MetadataItem
          label="Client"
          value={
            workspace.enrollment.client?.organization_name ??
            "OGI Direct / Independent"
          }
        />
        <MetadataItem
          label="Facility"
          value={
            workspace.enrollment.training_session?.facility_id
              ? "Assigned training facility"
              : "None"
          }
        />
        <MetadataItem
          label="Training Session"
          value={
            workspace.enrollment.training_session?.training_title ??
            "No Training Session assigned"
          }
        />
        <MetadataItem
          label="Session Dates"
          value={sessionDateRange(workspace.enrollment.training_session)}
        />
      </dl>

      <div className="grid gap-3 xl:grid-cols-3">
        {workspace.slots.map((slot) => (
          <TrainingEvidenceSlotCard
            isCreatingDraft={isCreatingDraft}
            key={slot.slot}
            onCreateDraft={onCreateDraft}
            slot={slot}
          />
        ))}
      </div>
    </div>
  );
}

function TrainingEvidenceSlotCard({
  isCreatingDraft,
  onCreateDraft,
  slot
}: {
  isCreatingDraft: boolean;
  onCreateDraft: (slot: TrainingEvidenceWorkspaceSlot) => void;
  slot: TrainingEvidenceWorkspaceSlot;
}) {
  const title = trainingEvidenceSlotTitle(slot);

  return (
    <article className="space-y-3 rounded-component border border-border bg-surface p-3">
      <div>
        <h6 className="text-sm font-semibold text-text-primary">{title}</h6>
        <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-text-muted">
          Template: {slot.document_number}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {slot.active_draft ? (
          <Link
            className={buttonLinkClassName}
            state={{ returnTo: routes.registrationTraining }}
            to={routes.evidenceRecordPath(
              slot.active_draft.evidence.evidence_record_id
            )}
          >
            Open Draft
          </Link>
        ) : slot.can_create_draft ? (
          <Button
            disabled={isCreatingDraft}
            onClick={() => onCreateDraft(slot)}
            type="button"
            variant="secondary"
          >
            Create Draft
          </Button>
        ) : (
          <p className="rounded-component border border-border px-3 py-2 text-sm text-text-muted">
            Draft creation unavailable.
          </p>
        )}
      </div>

      {slot.history.length === 0 ? (
        <p className="text-sm text-text-muted">
          No {title.toLowerCase()} evidence yet.
        </p>
      ) : (
        <ul aria-label={`${title} history`} className="space-y-2">
          {slot.history.map((record) => (
            <TrainingEvidenceHistoryItem
              key={record.evidence.evidence_record_id}
              record={record}
            />
          ))}
        </ul>
      )}
    </article>
  );
}

function TrainingEvidenceHistoryItem({
  record
}: {
  record: TrainingEvidenceWorkspaceRecord;
}) {
  return (
    <li className="rounded-component border border-border bg-canvas p-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-text-primary">
            {record.evidence.document_number ?? "Training Evidence"}
          </p>
          <p className="mt-1 text-sm text-text-muted">
            {record.evidence.template_name ?? record.evidence.template_code}
          </p>
        </div>
        <Link
          className={buttonLinkClassName}
          state={{ returnTo: routes.registrationTraining }}
          to={routes.evidenceRecordPath(record.evidence.evidence_record_id)}
        >
          {record.evidence.lifecycle_state === "DRAFT"
            ? "Open Draft"
            : "View Evidence"}
        </Link>
      </div>
      <dl className="mt-3 grid gap-2 text-sm">
        <MetadataItem
          label="Lifecycle"
          value={humanizeCode(record.evidence.lifecycle_state)}
        />
        <MetadataItem
          label="Created"
          value={formatDateTime(record.evidence.created_at)}
        />
        <MetadataItem
          label="Submitted"
          value={formatDateTime(record.evidence.submitted_at)}
        />
        <MetadataItem
          label="Link Status"
          value={
            record.evidence_link
              ? "Linked to Enrollment"
              : "Not yet linked"
          }
        />
      </dl>
      <TrainingEvidenceResultSummary record={record} />
    </li>
  );
}

function TrainingEvidenceResultSummary({
  record
}: {
  record: TrainingEvidenceWorkspaceRecord;
}) {
  if (record.assessment_result) {
    return (
      <div className="mt-3 rounded-component border border-border bg-surface p-3 text-sm">
        <p className="font-semibold text-text-primary">
          {humanizeCode(record.assessment_result.assessment_type)} result:{" "}
          {humanizeCode(record.assessment_result.result_status)}
        </p>
        <p className="mt-1 text-text-muted">
          Recorded {formatDateTime(record.assessment_result.recorded_at)}
        </p>
      </div>
    );
  }

  if (record.readiness_decision) {
    return (
      <div className="mt-3 rounded-component border border-border bg-surface p-3 text-sm">
        <p className="font-semibold text-text-primary">
          Readiness: {humanizeCode(record.readiness_decision.readiness_outcome)}
        </p>
        <p className="mt-1 text-text-muted">
          Certification review required:{" "}
          {record.readiness_decision.certification_review_required
            ? "Yes"
            : "No"}
        </p>
        <p className="mt-1 text-text-muted">
          Decided {formatDateTime(record.readiness_decision.decided_at)}
        </p>
      </div>
    );
  }

  return (
    <p className="mt-3 text-sm text-text-muted">
      Result not recorded.
    </p>
  );
}

function TraineeCreatePanel({
  formState,
  isSubmitting,
  onCancel,
  onChange,
  onSubmit
}: {
  formState: TraineeFormState;
  isSubmitting: boolean;
  onCancel: () => void;
  onChange: (formState: TraineeFormState) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <Surface>
      <h2 className="text-lg font-semibold text-text-primary">
        Register Trainee
      </h2>
      <p className="mt-1 text-sm text-text-muted">
        Create a standalone Training identity. Enrollment remains explicit.
      </p>
      <form
        aria-label="Create Trainee"
        className="mt-4 space-y-4"
        onSubmit={onSubmit}
      >
        <div className="grid gap-3 md:grid-cols-2">
          <FormInput
            label="Full name"
            onChange={(fullName) => onChange({ ...formState, fullName })}
            required
            value={formState.fullName}
          />
          <FormInput
            label="Email"
            onChange={(email) => onChange({ ...formState, email })}
            type="email"
            value={formState.email}
          />
          <FormInput
            label="Phone number"
            onChange={(phoneNumber) =>
              onChange({ ...formState, phoneNumber })
            }
            value={formState.phoneNumber}
          />
        </div>
        <label className="block text-sm font-semibold text-text-primary">
          Notes
          <textarea
            className="mt-2 min-h-24 w-full rounded-component border border-border bg-surface px-3 py-2 text-sm text-text-primary outline-none focus:border-focus focus:ring-2 focus:ring-focus"
            onChange={(event) =>
              onChange({ ...formState, notes: event.currentTarget.value })
            }
            value={formState.notes}
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <Button disabled={isSubmitting || !formState.fullName.trim()} type="submit">
            Create Trainee
          </Button>
          <Button
            disabled={isSubmitting}
            onClick={onCancel}
            type="button"
            variant="secondary"
          >
            Cancel
          </Button>
        </div>
      </form>
    </Surface>
  );
}

function TrainingEmptyDetailPanel({ canCreate }: { canCreate: boolean }) {
  return (
    <Surface>
      <h2 className="text-base font-semibold text-text-primary">
        No Trainee selected.
      </h2>
      <p className="mt-2 text-sm leading-6 text-text-muted">
        {canCreate
          ? "Use Register Trainee to create the first Training identity."
          : "No Training Trainee records are currently available for your authority."}
      </p>
    </Surface>
  );
}

function FormInput({
  label,
  onChange,
  required = false,
  type = "text",
  value
}: {
  label: string;
  onChange: (value: string) => void;
  required?: boolean;
  type?: "email" | "text";
  value: string;
}) {
  return (
    <label className="block text-sm font-semibold text-text-primary">
      {label}
      <input
        className={inputClassName}
        onChange={(event) => onChange(event.currentTarget.value)}
        required={required}
        type={type}
        value={value}
      />
    </label>
  );
}

function MetadataItem({
  label,
  subtle = false,
  value
}: {
  label: string;
  subtle?: boolean;
  value: string;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-semibold uppercase tracking-wide text-text-muted">
        {label}
      </dt>
      <dd
        className={[
          "mt-1 break-words",
          subtle ? "text-xs text-text-muted" : "text-text-primary"
        ].join(" ")}
      >
        {value}
      </dd>
    </div>
  );
}

function TrainingErrorAlert({ error }: { error: Error | null }) {
  if (!error) {
    return null;
  }

  return (
    <Surface role="alert">
      <p className="text-sm font-semibold text-text-primary">
        {isApiError(error) ? error.message : "Training request failed."}
      </p>
    </Surface>
  );
}

function TrainingLoadErrorState({ error }: { error: Error }) {
  if (isApiError(error) && error.status === 403) {
    return (
      <SafeState title="Training registration is not available with your current authorization.">
        Your current session cannot open Training registration records.
      </SafeState>
    );
  }

  return (
    <SafeState title="Training registration could not be loaded.">
      The Training service returned an error.
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

function buildCreateTraineeRequest(formState: TraineeFormState) {
  return {
    full_name: formState.fullName.trim(),
    email: nullableText(formState.email),
    phone_number: nullableText(formState.phoneNumber),
    notes: nullableText(formState.notes)
  };
}

function buildCreateEnrollmentRequest(formState: EnrollmentFormState) {
  return {
    program_code: formState.programCode as TrainingProgramCode,
    client_id: nullableText(formState.clientId),
    training_session_id: nullableText(formState.trainingSessionId),
    notes: nullableText(formState.notes)
  };
}

function studentNumberLabel(value: string | null) {
  return value ?? "Student number pending";
}

function studentNumberValue(value: string | null) {
  return value ?? "Pending";
}

function programSelectLabel(
  program: (typeof trainingProgramOptions)[number]
) {
  return `${program.certification_level} - ${program.display_name}`;
}

function programLabel(program: {
  readonly certification_level: string;
  readonly display_name: string;
}) {
  return `${program.certification_level} - ${program.display_name}`;
}

function personnelOptionLabel(staffMember: RegistrationPersonnel) {
  return [
    staffMember.full_name,
    staffMember.email ?? "no email",
    `Client ${staffMember.client_id}`
  ].join(" - ");
}

function uniqueEnrollmentSessionSummaries(
  enrollments: readonly TrainingEnrollment[]
): TrainingEnrollmentSessionSummary[] {
  const sessions = new Map<string, TrainingEnrollmentSessionSummary>();

  enrollments.forEach((enrollment) => {
    if (enrollment.training_session) {
      sessions.set(enrollment.training_session.id, enrollment.training_session);
    }
  });

  return [...sessions.values()];
}

function sessionSummaryOptionLabel(session: TrainingEnrollmentSessionSummary) {
  const startDate = new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium"
  }).format(new Date(session.training_start_date));

  return [startDate, session.training_title].join(" - ");
}

function sessionRecordDateRange(session: TrainingSession) {
  const startDate = formatDateTime(session.training_start_date);

  if (!session.training_end_date) {
    return startDate;
  }

  return `${startDate} to ${formatDateTime(session.training_end_date)}`;
}

function attendanceClientContextLabel(
  workspace: TrainingAttendanceEvidenceWorkspace
) {
  const clientNames = new Set(
    workspace.eligible_enrollments
      .map((item) => item.enrollment.client?.organization_name)
      .filter((name): name is string => Boolean(name))
  );

  if (clientNames.size === 1) {
    return [...clientNames][0];
  }

  return "OGI Direct / Independent";
}

function attendanceLinkStatus(record: TrainingAttendanceEvidenceRecord) {
  if (record.linked_count === 0) {
    return "Not yet linked";
  }

  return `Linked ${record.linked_count} / ${record.roster_count}`;
}

function attendanceEvidenceConflictMessage(error: unknown) {
  const message = isApiError(error) ? error.message : "";

  if (/mixed|scope|compatible/i.test(message)) {
    return "The selected roster cannot be represented by one attendance evidence record because the enrollments do not share a compatible evidence scope.";
  }

  return "Attendance evidence is no longer available for this Session. Workspace refreshed.";
}

function attendanceEvidenceErrorMessage(
  error: unknown,
  operation: "workspace" | "create" | "link"
) {
  if (isApiError(error)) {
    if (error.status === 403) {
      return operation === "link"
        ? "Not authorized to link attendance evidence."
        : "Not authorized to manage attendance evidence.";
    }

    if (error.status === 404) {
      return "Attendance evidence or Session unavailable.";
    }

    if (error.status === 409) {
      return operation === "link"
        ? "Evidence is not currently eligible for linking."
        : attendanceEvidenceConflictMessage(error);
    }
  }

  return operation === "link"
    ? "Unable to link attendance evidence."
    : "Attendance Evidence workspace request failed.";
}
function sessionOptionLabel(session: TrainingSession) {
  const startDate = new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium"
  }).format(new Date(session.training_start_date));
  const instructor =
    session.instructor_name ??
    session.instructor_staff_member?.full_name ??
    "Instructor not specified";

  return [
    startDate,
    session.training_title,
    instructor,
    session.facility?.facility_name ?? "No facility"
  ].join(" - ");
}

function trainingEvidenceSlotTitle(slot: TrainingEvidenceWorkspaceSlot) {
  switch (slot.slot) {
    case "SKILLS":
      return "Skills Assessment";
    case "KNOWLEDGE":
      return "Knowledge Assessment";
    case "READINESS":
      return "Readiness Evaluation";
  }
}

function trainingEvidenceErrorMessage(error: unknown) {
  if (isApiError(error)) {
    return error.message;
  }

  return "Training Evidence workspace request failed.";
}

function sessionDateRange(session: TrainingEnrollment["training_session"]) {
  if (!session) {
    return "Not scheduled";
  }

  const startDate = formatDateTime(session.training_start_date);

  if (!session.training_end_date) {
    return startDate;
  }

  return `${startDate} to ${formatDateTime(session.training_end_date)}`;
}

function formatDateTime(value: string | null) {
  if (!value) {
    return "Not recorded";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function humanizeCode(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function nullableText(value: string) {
  const trimmed = value.trim();

  return trimmed ? trimmed : null;
}

const buttonLinkClassName =
  "inline-flex min-h-10 items-center justify-center rounded-component border border-border bg-surface px-3 py-2 text-sm font-semibold text-text-primary transition hover:border-primary-blue hover:text-primary-blue focus:outline-none focus:ring-2 focus:ring-focus";

const inputClassName =
  "mt-2 min-h-10 w-full rounded-component border border-border bg-surface px-3 py-2 text-sm text-text-primary outline-none focus:border-focus focus:ring-2 focus:ring-focus";
