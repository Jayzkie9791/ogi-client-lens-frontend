import { FormEvent, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";

import { isApiError } from "../api/errors";
import { routes } from "../app/routePaths";
import { useAuth } from "../auth/useAuth";
import { createCertificationFromReadiness } from "../certifications/certificationsApi";
import {
  listRegistrationClients,
  RegistrationClient
} from "../registration/registrationClientApi";
import {
  listRegistrationFacilities,
  RegistrationFacility
} from "../registration/registrationFacilityApi";
import {
  listRegistrationPersonnel,
  RegistrationPersonnel
} from "../registration/registrationPersonnelApi";
import { formatRegistrationDateTime } from "../registration/registrationPresentation";
import {
  RegistrationDirectoryItem,
  RegistrationDirectoryPane,
  RegistrationEntityHeader,
  RegistrationMetadataGroup,
  RegistrationMetadataItem,
  RegistrationWorkspaceFrame,
  RegistrationWorkspaceSection
} from "../registration/RegistrationWorkspaceUi";
import { Button } from "../ui/components/Button";
import { Surface } from "../ui/components/Surface";
import {
  assignTrainingEnrollmentSession,
  createTrainingSession,
  createTrainingAttendanceEvidenceDraft,
  createTrainingEvidenceDraft,
  createTrainingEnrollment,
  createTrainingTrainee,
  getTrainingAttendanceEvidenceWorkspace,
  getTrainingEvidenceWorkspace,
  linkTrainingAttendanceEvidence,
  linkTrainingEnrollmentEvidence,
  linkTrainingTraineeStaffMember,
  listEligibleTrainingInstructors,
  getTrainingTrainee,
  listTrainingEnrollments,
  listTrainingPrograms,
  listTrainingSessions,
  listTrainingTrainees,
  recordTrainingAssessment,
  recordTrainingReadiness,
  TrainingAttendanceEvidenceRecord,
  TrainingAttendanceEvidenceWorkspace,
  TrainingEnrollment,
  TrainingEnrollmentSessionSummary,
  EligibleTrainingInstructor,
  TrainingEvidenceWorkspace,
  TrainingEvidenceWorkspaceRecord,
  TrainingEvidenceWorkspaceSlot,
  TrainingProgramCode,
  TrainingProgramAuthority,
  TrainingOperationalSkill,
  TrainingSession,
  trainingProgramOptions,
  TrainingTrainee
} from "./trainingApi";
import { RegisterTrainingWizard, type RegisterTrainingWizardResult } from "./RegisterTrainingWizard";
import { TrainingWorkspaceShell } from "./TrainingWorkspaceShell";

const permissions = {
  view: "view_training",
  registerTrainee: "register_trainee",
  linkPersonnel: "link_training_staff_member",
  createEnrollment: "create_training_enrollment",
  assignSession: "assign_training_session",
  createSession: "create_training_session",
  viewClients: "view_client",
  viewPersonnel: "view_staff_member",
  viewFacilities: "view_facility",
  viewCertifications: "view_certification",
  createCertification: "create_certification_draft",
  issueCertification: "issue_certification",
  linkEvidence: "link_training_evidence",
  recordAssessment: "record_training_assessment",
  decideReadiness: "decide_training_readiness"
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

interface SessionFormState {
  title: string;
  targetProgramCode: TrainingProgramCode | "";
  operationalSkill: TrainingOperationalSkill;
  startDate: string;
  endDate: string;
  durationMinutes: string;
  facilityId: string;
  instructorStaffMemberId: string;
  qualificationCertificationId: string;
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

const emptySessionForm: SessionFormState = {
  title: "",
  targetProgramCode: "",
  operationalSkill: "RESCUE_SKILLS",
  startDate: "",
  endDate: "",
  durationMinutes: "",
  facilityId: "",
  instructorStaffMemberId: "",
  qualificationCertificationId: "",
  notes: ""
};

export function RegistrationTrainingPage({ workspace = "trainees" }: { readonly workspace?: "trainees" | "sessions" | "register" }) {
  const auth = useAuth();
  const queryClient = useQueryClient();
  const canView = auth.canUsePermission(permissions.view);
  const canRegisterTrainee = auth.canUsePermission(permissions.registerTrainee);
  const canLinkPersonnel = auth.canUsePermission(permissions.linkPersonnel);
  const canCreateEnrollment = auth.canUsePermission(
    permissions.createEnrollment
  );
  const canAssignSession = auth.canUsePermission(permissions.assignSession);
  const canCreateSession = auth.canUsePermission(permissions.createSession);
  const canViewClients = auth.canUsePermission(permissions.viewClients);
  const canViewPersonnel = auth.canUsePermission(permissions.viewPersonnel);
  const canViewFacilities = auth.canUsePermission(permissions.viewFacilities);
  const canViewCertifications = auth.canUsePermission(
    permissions.viewCertifications
  );
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
  const [isCreatingSession, setIsCreatingSession] = useState(workspace === "sessions");
  const [sessionForm, setSessionForm] =
    useState<SessionFormState>(emptySessionForm);
  const [sessionIdempotencyKey, setSessionIdempotencyKey] = useState(() => workspace === "sessions" ? crypto.randomUUID() : "");
  const [isRegisteringTraining, setIsRegisteringTraining] = useState(workspace === "register");

  useEffect(() => {
    setIsCreatingSession(workspace === "sessions");
    setIsRegisteringTraining(workspace === "register");
    if (workspace === "sessions") {
      setSessionIdempotencyKey(crypto.randomUUID());
    }
  }, [workspace]);

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
    enabled:
      canView &&
      (isCreatingSession || isAddingEnrollment || assigningEnrollmentId !== null),
    retry: false
  });
  const sessions = useMemo(
    () => sessionsQuery.data?.sessions ?? [],
    [sessionsQuery.data]
  );
  const programsQuery = useQuery({
    queryKey: ["training-programs"],
    queryFn: listTrainingPrograms,
    enabled: canView && isCreatingSession,
    retry: false
  });
  const programs = programsQuery.data?.programs ?? [];

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

  const facilitiesQuery = useQuery({
    queryKey: ["registration-facilities", "training-session-create"],
    queryFn: () => listRegistrationFacilities(),
    enabled: canViewFacilities && isCreatingSession,
    retry: false
  });
  const activeFacilities = useMemo(
    () =>
      (facilitiesQuery.data?.facilities ?? []).filter(
        (facility) => facility.operational_status === "ACTIVE"
      ),
    [facilitiesQuery.data]
  );
  const eligibleInstructorsQuery = useQuery({
    queryKey: [
      "training-eligible-instructors",
      sessionForm.facilityId,
      sessionForm.targetProgramCode,
      sessionForm.startDate,
      "session-create"
    ],
    queryFn: () => listEligibleTrainingInstructors({
      facilityId: sessionForm.facilityId,
      targetProgramCodes: [requiredValue(sessionForm.targetProgramCode, "Target program is required.")],
      at: new Date(sessionForm.startDate).toISOString()
    }),
    enabled:
      canViewCertifications &&
      isCreatingSession &&
      Boolean(sessionForm.facilityId && sessionForm.targetProgramCode && sessionForm.startDate),
    retry: false
  });
  const eligibleInstructors = eligibleInstructorsQuery.data?.instructors ?? [];

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

  const createSessionMutation = useMutation({
    mutationFn: () =>
      createTrainingSession(
        buildCreateSessionRequest(sessionForm),
        sessionIdempotencyKey
      ),
    onSuccess: (session) => {
      setMessage(
        `Training Session ${session.business_identifier} created successfully.`
      );
      setSessionForm(emptySessionForm);
      setSessionIdempotencyKey("");
      setIsCreatingSession(false);
      void queryClient.invalidateQueries({ queryKey: ["training-sessions"] });
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

  function submitTrainingSession(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    createSessionMutation.mutate();
  }

  if (!canView) {
    return (
      <SafeState title="You are not authorized to view Training registration.">
        Your current session does not include Training registration authority.
      </SafeState>
    );
  }

  return (
    <TrainingWorkspaceShell
      description={workspace === "sessions" ? "Create governed Training Sessions with an eligible Instructor and qualification." : workspace === "register" ? "Guide a Trainee through program enrollment and assignment to an eligible Training Session." : "Manage Trainee identities, optional Personnel links, and Training Enrollments without implying completion or certification."}
      headingId="registration-training-heading"
      title={workspace === "sessions" ? "Training Sessions" : workspace === "register" ? "Register Training" : "Trainees"}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <p className="text-sm leading-6 text-text-muted">{workspace === "sessions" ? "Create a Session using exact Facility, Instructor, and active L6/L7 qualification authority." : workspace === "register" ? "Select or create a Trainee, choose the program, and assign an eligible Session through the guided workflow." : "Register trainees, link known Personnel records when appropriate, and review governed training enrollments."}</p>
        <div className="flex flex-wrap gap-2">
          {workspace === "trainees" && canRegisterTrainee ? (
            <Button
              aria-expanded={isCreatingTrainee}
              onClick={startRegisterTrainee}
              type="button"
            >
              Register Trainee
            </Button>
          ) : null}
          {workspace === "sessions" && canCreateSession && !isCreatingSession ? (
            <Button
              onClick={() => {
                setSessionIdempotencyKey(crypto.randomUUID());
                setIsCreatingSession(true);
              }}
              type="button"
            >
              Create Training Session
            </Button>
          ) : null}
          {workspace === "register" && canCreateEnrollment && !isRegisteringTraining ? (
            <Button onClick={() => setIsRegisteringTraining(true)} type="button">
              Register Training
            </Button>
          ) : null}
        </div>
      </div>

      {message ? (
        <Surface role="status">
          <p className="text-sm font-semibold text-text-primary">{message}</p>
        </Surface>
      ) : null}

      {workspace === "register" && isRegisteringTraining ? (
        <RegisterTrainingWizard
          canCreateSession={canCreateSession && canViewFacilities && canViewPersonnel && canViewCertifications}
          canLinkPersonnel={canLinkPersonnel && canViewPersonnel}
          canRegisterTrainee={canRegisterTrainee}
          canViewClients={canViewClients}
          canViewCertifications={canViewCertifications}
          canViewFacilities={canViewFacilities}
          canViewPersonnel={canViewPersonnel}
          onCancel={() => setIsRegisteringTraining(false)}
          onComplete={(result: RegisterTrainingWizardResult) => {
            setIsRegisteringTraining(false);
            setSelectedTraineeId(result.trainee.id);
            setMessage(`Training registration completed. ${result.trainee.student_number ?? "Student Number allocated"} is assigned to ${result.session.training_title}.`);
            queryClient.setQueryData(["training-trainee", result.trainee.id], result.trainee);
            void queryClient.invalidateQueries({ queryKey: ["training-trainees"] });
            void queryClient.invalidateQueries({ queryKey: ["training-enrollments", result.trainee.id] });
            void queryClient.invalidateQueries({ queryKey: ["training-sessions"] });
          }}
        />
      ) : null}

      <TrainingErrorAlert
        error={
          createTraineeMutation.error ??
          linkPersonnelMutation.error ??
          createEnrollmentMutation.error ??
          assignSessionMutation.error ??
          createSessionMutation.error
        }
      />

      {workspace === "sessions" && isCreatingSession ? (
        <TrainingSessionCreatePanel
          programs={programs}
          programsLoading={programsQuery.isLoading}
          instructors={eligibleInstructors}
          instructorsLoading={eligibleInstructorsQuery.isLoading}
          facilities={activeFacilities}
          facilitiesLoading={facilitiesQuery.isLoading}
          formState={sessionForm}
          isSubmitting={createSessionMutation.isPending}
          onCancel={() => {
            setIsCreatingSession(false);
            setSessionForm(emptySessionForm);
            setSessionIdempotencyKey("");
          }}
          onChange={(next) => setSessionForm(next)}
          onSubmit={submitTrainingSession}
        />
      ) : null}

      {workspace !== "trainees" ? null : traineesQuery.isLoading ? (
        <SafeState title="Loading Trainee records." role="status">
          Please wait.
        </SafeState>
      ) : traineesQuery.isError ? (
        <TrainingLoadErrorState error={traineesQuery.error} />
      ) : (
        <RegistrationWorkspaceFrame
          directory={<TraineeList
            onSelectTrainee={selectTrainee}
            selectedTraineeId={selectedTraineeId}
            trainees={trainees}
          />}
          workspace={isCreatingTrainee ? (
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
        />
      )}
    </TrainingWorkspaceShell>
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
    <RegistrationDirectoryPane
      description="Select a Trainee to review identity, Personnel link, and enrollments."
      title="Trainee Records"
      emptyState={
        <div className="rounded-component border border-dashed border-border p-4">
          <h3 className="text-sm font-semibold text-text-primary">No trainees registered.</h3>
        </div>
      }
    >
      {trainees.length === 0 ? (
        undefined
      ) : (
        <ul aria-label="Trainee records" className="space-y-2">
          {trainees.map((trainee) => {
            const isSelected = selectedTraineeId === trainee.id;

            return (
              <li key={trainee.id}>
                <RegistrationDirectoryItem isSelected={isSelected} onSelect={() => onSelectTrainee(trainee.id)}>
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
                </RegistrationDirectoryItem>
              </li>
            );
          })}
        </ul>
      )}
    </RegistrationDirectoryPane>
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
          <RegistrationEntityHeader
            identity={trainee.full_name}
            secondary={`Student number: ${studentNumberValue(trainee.student_number)}`}
          />

          <RegistrationMetadataGroup title="Trainee contact">
            <RegistrationMetadataItem
              label="Email"
              value={trainee.email ?? "Not specified"}
            />
            <RegistrationMetadataItem
              label="Phone"
              value={trainee.phone_number ?? "Not specified"}
            />
            <RegistrationMetadataItem
              label="Notes"
              value={trainee.notes ?? "Not specified"}
            />
          </RegistrationMetadataGroup>
          <RegistrationMetadataGroup
            description="Record history is secondary to the Trainee's operational identity."
          >
            <RegistrationMetadataItem label="Created" value={formatRegistrationDateTime(trainee.created_at)} />
            <RegistrationMetadataItem label="Updated" value={formatRegistrationDateTime(trainee.updated_at)} />
          </RegistrationMetadataGroup>
        </div>
      </Surface>

      <RegistrationWorkspaceSection
        description="Maintain the optional relationship between this Trainee and an existing Personnel record."
        headingId="training-personnel-link-heading"
        title="Personnel Link"
      >
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
      </RegistrationWorkspaceSection>

      <TrainingAttendanceEvidencePanel enrollments={enrollments} />

      <RegistrationWorkspaceSection
        description="Manage governed program enrollment and Training Session assignment without implying completion."
        headingId="training-enrollments-heading"
        title="Enrollments"
      >
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
      </RegistrationWorkspaceSection>
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
        <p className="text-sm text-text-muted">
          Explicitly link this Trainee to a known Personnel record when both identities represent the same person.
        </p>
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
        <p className="text-sm text-text-muted">
          Enrollment records show intended program registration only.
        </p>
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
                <MetadataItem label="Enrolled" value={formatRegistrationDateTime(enrollment.enrolled_at)} />
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
    <Surface className="overflow-hidden" data-registration-section="operational">
      <section aria-labelledby="training-attendance-evidence-heading" className="space-y-3">
        <div className="-mx-5 -mt-5 border-b border-l-4 border-b-border border-l-accent-red bg-elevated px-5 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary-blue">
            Attendance Evidence
          </p>
          <h3
            className="text-base font-semibold text-primary-navy"
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
  const auth = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [message, setMessage] = useState<string | null>(null);
  const [createdCertificationId, setCreatedCertificationId] = useState<string | null>(null);
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
  const traineeQuery = useQuery({
    queryKey: ["training-trainee", enrollment.trainee_id],
    queryFn: () => getTrainingTrainee(enrollment.trainee_id),
    retry: false
  });
  const readinessDecision = workspaceQuery.data?.slots
    .flatMap((slot) => slot.history)
    .map((record) => record.readiness_decision)
    .find((decision) => decision !== null &&
      (decision.readiness_outcome === "OPERATIONALLY_READY" || decision.readiness_outcome === "OPERATIONALLY_READY_WITH_RESTRICTIONS") &&
      decision.certification_review_required) ?? null;
  const linkedStaffMemberId = traineeQuery.data?.staff_member_links.find(
    (link) => link.ended_at === null
  )?.staff_member_id;
  const certificationMutation = useMutation({
    mutationFn: () => createCertificationFromReadiness({
      training_readiness_decision_id: requiredValue(readinessDecision?.id, "A current readiness decision is required."),
      certification_status: auth.canUsePermission(permissions.issueCertification) ? "ACTIVE" : "PENDING",
      ...(linkedStaffMemberId ? { staff_member_id: linkedStaffMemberId } : {})
    }),
    onSuccess(certification) {
      setCreatedCertificationId(certification.id);
      setMessage(`Certification ${certification.certification_number} created from Training readiness.`);
      void queryClient.invalidateQueries({ queryKey: ["credentials"] });
    },
    onError(error) {
      setMessage(trainingEvidenceErrorMessage(error));
    }
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
    onSuccess(draft) {
      setMessage("Training evidence draft created.");
      void queryClient.invalidateQueries({ queryKey: workspaceQueryKey });
      void navigate(routes.evidenceRecordPath(draft.evidence_record_id), {
        state: { returnTo: routes.registrationTraining }
      });
    }
  });

  return (
    <section
      aria-label={`${programLabel(enrollment.program)} Training Evidence`}
      className="mt-4 space-y-3 overflow-hidden rounded-component border border-border bg-surface p-3"
      data-registration-section="operational"
    >
      <div className="-mx-3 -mt-3 border-b border-l-4 border-b-border border-l-accent-red bg-elevated px-3 py-3">
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
        <>
          <TrainingEvidenceWorkspaceContent
            isCreatingDraft={createDraftMutation.isPending}
            onCreateDraft={(slot) => {
              setMessage(null);
              createDraftMutation.mutate(slot);
            }}
            workspace={workspaceQuery.data}
          />
          {readinessDecision && auth.canUsePermission(permissions.createCertification) ? (
            <form className="rounded-component border border-blue-200 bg-blue-50/60 p-4" onSubmit={(event) => { event.preventDefault(); setMessage(null); certificationMutation.mutate(); }}>
              <p className="text-xs font-semibold uppercase tracking-wide text-primary-blue">Certification authority</p>
              <h6 className="mt-1 text-sm font-semibold text-primary-navy">Create Certification from governed readiness</h6>
              <p className="mt-1 text-sm text-text-muted">Program, validity, score, Trainee, Enrollment, and readiness provenance are derived by the backend.</p>
              {!linkedStaffMemberId ? <p className="mt-2 text-sm font-semibold text-red-800" role="alert">Link this Trainee to an active Personnel record before Certification so the issued authority remains visible in the Certification Registry.</p> : null}
              <p className="mt-3 rounded-component border border-blue-200 bg-white/70 p-3 text-sm text-text-muted"><span className="font-semibold text-primary-navy">Certification number:</span> Assigned automatically after this Certification is saved.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button disabled={certificationMutation.isPending || !linkedStaffMemberId || Boolean(createdCertificationId)} type="submit">{certificationMutation.isPending ? "Creating Certification" : "Create from Readiness"}</Button>
                {createdCertificationId ? <Link className={buttonLinkClassName} to={routes.certifications}>Open Certification Registry</Link> : null}
              </div>
            </form>
          ) : null}
        </>
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
  const auth = useAuth();
  const queryClient = useQueryClient();
  const [score, setScore] = useState("100");
  const [resultStatus, setResultStatus] = useState<"PASS" | "CONDITIONAL_PASS" | "FAIL">("PASS");
  const [readinessOutcome, setReadinessOutcome] = useState<"OPERATIONALLY_READY" | "OPERATIONALLY_READY_WITH_RESTRICTIONS" | "REMEDIATION_REQUIRED" | "NOT_OPERATIONALLY_READY">("OPERATIONALLY_READY");
  const [actionError, setActionError] = useState<string | null>(null);
  const workspaceKey = ["training", "enrollment", record.evidence.training_enrollment_id, "evidence-workspace"] as const;
  const linkMutation = useMutation({
    mutationFn: () => linkTrainingEnrollmentEvidence(record.evidence.training_enrollment_id, {
      operational_evidence_record_id: record.evidence.evidence_record_id,
      evidence_purpose: evidencePurposeForTemplate(record.evidence.template_code)
    }),
    onSuccess: () => { setActionError(null); void queryClient.invalidateQueries({ queryKey: workspaceKey }); },
    onError: (error) => setActionError(trainingEvidenceErrorMessage(error))
  });
  const assessmentMutation = useMutation({
    mutationFn: () => recordTrainingAssessment(record.evidence.training_enrollment_id, {
      evidence_link_id: requiredValue(record.evidence_link?.id, "Linked Training evidence is required."),
      result_status: resultStatus,
      score: Number(score),
      remediation_required: resultStatus !== "PASS",
      reassessment_required: resultStatus === "FAIL"
    }),
    onSuccess: () => { setActionError(null); void queryClient.invalidateQueries({ queryKey: workspaceKey }); },
    onError: (error) => setActionError(trainingEvidenceErrorMessage(error))
  });
  const readinessMutation = useMutation({
    mutationFn: () => recordTrainingReadiness(record.evidence.training_enrollment_id, {
      readiness_evidence_link_id: requiredValue(record.evidence_link?.id, "Linked readiness evidence is required."),
      readiness_outcome: readinessOutcome,
      remediation_required: readinessOutcome === "REMEDIATION_REQUIRED" || readinessOutcome === "NOT_OPERATIONALLY_READY",
      certification_review_required: readinessOutcome === "OPERATIONALLY_READY" || readinessOutcome === "OPERATIONALLY_READY_WITH_RESTRICTIONS"
    }),
    onSuccess: () => { setActionError(null); void queryClient.invalidateQueries({ queryKey: workspaceKey }); },
    onError: (error) => setActionError(trainingEvidenceErrorMessage(error))
  });
  const isAssessment = record.evidence.template_code === "OGI_F023_OPERATIONAL_SKILLS_ASSESSMENT" || record.evidence.template_code === "OGI_F024_OPERATIONAL_KNOWLEDGE_ASSESSMENT_RECORD";
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
      {!record.evidence_link && record.evidence.submitted_at && auth.canUsePermission(permissions.linkEvidence) ? (
        <Button disabled={linkMutation.isPending} onClick={() => linkMutation.mutate()} type="button" variant="secondary">Link governed evidence</Button>
      ) : null}
      {record.evidence_link && isAssessment && !record.assessment_result && auth.canUsePermission(permissions.recordAssessment) ? (
        <form className="mt-3 grid gap-3 rounded-component border border-border bg-surface p-3 sm:grid-cols-2" onSubmit={(event) => { event.preventDefault(); assessmentMutation.mutate(); }}>
          <label className="text-sm font-semibold text-text-primary">Result<select className={inputClassName} onChange={(event) => setResultStatus(event.currentTarget.value as typeof resultStatus)} value={resultStatus}><option value="PASS">Pass</option><option value="CONDITIONAL_PASS">Conditional pass</option><option value="FAIL">Fail</option></select></label>
          <label className="text-sm font-semibold text-text-primary">Score<input className={inputClassName} max="100" min="0" onChange={(event) => setScore(event.currentTarget.value)} required type="number" value={score}/></label>
          <Button disabled={assessmentMutation.isPending || !score} type="submit">Record governed result</Button>
        </form>
      ) : null}
      {record.evidence_link && record.evidence.template_code === "OGI_F025_OPERATIONAL_READINESS_EVALUATION" && !record.readiness_decision && auth.canUsePermission(permissions.decideReadiness) ? (
        <form className="mt-3 space-y-3 rounded-component border border-border bg-surface p-3" onSubmit={(event) => { event.preventDefault(); readinessMutation.mutate(); }}>
          <label className="text-sm font-semibold text-text-primary">Readiness decision<select className={inputClassName} onChange={(event) => setReadinessOutcome(event.currentTarget.value as typeof readinessOutcome)} value={readinessOutcome}><option value="OPERATIONALLY_READY">Operationally ready</option><option value="OPERATIONALLY_READY_WITH_RESTRICTIONS">Ready with restrictions</option><option value="REMEDIATION_REQUIRED">Remediation required</option><option value="NOT_OPERATIONALLY_READY">Not operationally ready</option></select></label>
          <Button disabled={readinessMutation.isPending} type="submit">Record readiness decision</Button>
        </form>
      ) : null}
      {actionError ? <p className="mt-2 text-sm font-semibold text-red-800" role="alert">{actionError}</p> : null}
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

function TrainingSessionCreatePanel({
  programs,
  programsLoading,
  instructors,
  instructorsLoading,
  facilities,
  facilitiesLoading,
  formState,
  isSubmitting,
  onCancel,
  onChange,
  onSubmit,
}: {
  programs: readonly TrainingProgramAuthority[];
  programsLoading: boolean;
  instructors: readonly EligibleTrainingInstructor[];
  instructorsLoading: boolean;
  facilities: readonly RegistrationFacility[];
  facilitiesLoading: boolean;
  formState: SessionFormState;
  isSubmitting: boolean;
  onCancel: () => void;
  onChange: (state: SessionFormState) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const setField = <K extends keyof SessionFormState,>(
    field: K,
    value: SessionFormState[K]
  ) => onChange({ ...formState, [field]: value });
  const selectedProgram = programs.find(
    (program) => program.program_code === formState.targetProgramCode
  );
  const allowedFocuses = selectedProgram?.allowed_session_focuses ?? [];

  return (
    <Surface>
      <form aria-label="Create Training Session" className="space-y-4" onSubmit={onSubmit}>
        <div>
          <h2 className="text-lg font-semibold text-text-primary">
            Create qualified Training Session
          </h2>
          <p className="mt-1 text-sm text-text-muted">
            Select the program, Facility, and Session date first. Client Lens
            then resolves exact instructor qualification and operational scope
            from backend authority.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block text-sm font-semibold text-text-primary">
            Session title
            <input
              className={inputClassName}
              maxLength={255}
              onChange={(event) => setField("title", event.currentTarget.value)}
              required
              value={formState.title}
            />
          </label>
          <label className="block text-sm font-semibold text-text-primary">
            Target training program
            <select
              className={inputClassName}
              disabled={programsLoading}
              onChange={(event) => {
                const targetProgramCode = event.currentTarget.value as TrainingProgramCode | "";
                const program = programs.find((candidate) => candidate.program_code === targetProgramCode);
                onChange({
                  ...formState,
                  targetProgramCode,
                  operationalSkill: program?.allowed_session_focuses[0] ?? "RESCUE_SKILLS",
                  instructorStaffMemberId: "",
                  qualificationCertificationId: ""
                });
              }}
              required
              value={formState.targetProgramCode}
            >
              <option value="">{programsLoading ? "Loading governed programs…" : "Select a governed program"}</option>
              {programs.map((program) => (
                <option key={program.program_code} value={program.program_code}>{program.certification_level} · {program.display_name}</option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-semibold text-text-primary">
            Primary Session Focus
            <select
              className={inputClassName}
              disabled={!selectedProgram}
              onChange={(event) =>
                setField(
                  "operationalSkill",
                  event.currentTarget.value as TrainingOperationalSkill
                )
              }
              value={formState.operationalSkill}
            >
              {allowedFocuses.map((skill) => (
                <option key={skill} value={skill}>{humanizeCode(skill)}</option>
              ))}
            </select>
            <span className="mt-2 block font-normal text-text-muted">
              Classifies this Session only. It does not define Program coverage
              or prove competency completion.
            </span>
          </label>
          <label className="block text-sm font-semibold text-text-primary">
            Starts
            <input
              className={inputClassName}
              onChange={(event) => setField("startDate", event.currentTarget.value)}
              required
              type="datetime-local"
              value={formState.startDate}
            />
          </label>
          <label className="block text-sm font-semibold text-text-primary">
            Ends
            <input
              className={inputClassName}
              min={formState.startDate || undefined}
              onChange={(event) => setField("endDate", event.currentTarget.value)}
              type="datetime-local"
              value={formState.endDate}
            />
          </label>
          <label className="block text-sm font-semibold text-text-primary">
            Duration (minutes)
            <input
              className={inputClassName}
              min="1"
              onChange={(event) =>
                setField("durationMinutes", event.currentTarget.value)
              }
              type="number"
              value={formState.durationMinutes}
            />
          </label>
          <label className="block text-sm font-semibold text-text-primary">
            Facility
            <select
              className={inputClassName}
              disabled={facilitiesLoading}
              onChange={(event) =>
                onChange({
                  ...formState,
                  facilityId: event.currentTarget.value,
                  instructorStaffMemberId: "",
                  qualificationCertificationId: ""
                })
              }
              required
              value={formState.facilityId}
            >
              <option value="">Select active Facility</option>
              {facilities.map((facility) => (
                <option key={facility.id} value={facility.id}>
                  {facility.facility_name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-semibold text-text-primary">
            Eligible primary instructor
            <select
              className={inputClassName}
              disabled={!formState.facilityId || !formState.targetProgramCode || !formState.startDate || instructorsLoading}
              onChange={(event) => {
                const instructor = instructors.find((candidate) => instructorOptionValue(candidate) === event.currentTarget.value);
                onChange({ ...formState, instructorStaffMemberId: instructor?.personnel_id ?? "", qualificationCertificationId: instructor?.qualification.certification_id ?? "" });
              }}
              required
              value={instructorOptionValueOrEmpty(instructors, formState)}
            >
              <option value="">{instructorsLoading ? "Resolving eligible instructors…" : "Select an eligible instructor"}</option>
              {instructors.map((instructor) => (
                <option key={instructorOptionValue(instructor)} value={instructorOptionValue(instructor)}>
                  {instructor.display_name} — {instructor.qualification.title}
                </option>
              ))}
            </select>
            {formState.facilityId && formState.targetProgramCode && formState.startDate && !instructorsLoading && instructors.length === 0 ? (
              <span className="mt-2 block font-normal text-text-muted">
                No instructor has qualifying Certification and operational
                authority for this Facility, program, and Session date.
              </span>
            ) : null}
          </label>
        </div>
        {selectedProgram ? (
          <section aria-label="Required Program Coverage" className="rounded-component border border-blue-200 bg-blue-50 p-4">
            <h3 className="font-semibold text-primary-navy">Required Program Coverage</h3>
            <p className="mt-1 text-sm font-normal text-text-muted">
              Governed course coverage for {selectedProgram.certification_level} · {selectedProgram.display_name}. This does not record attendance, assessment, readiness, or completion.
            </p>
            {selectedProgram.required_program_coverage.length > 0 ? (
              <ul className="mt-3 grid gap-x-6 gap-y-1 text-sm font-normal text-text-primary sm:grid-cols-2">
                {selectedProgram.required_program_coverage.map((item) => <li key={item}>• {item}</li>)}
              </ul>
            ) : (
              <p className="mt-3 text-sm font-normal text-text-muted">
                Course coverage has not yet been published for this Program.
              </p>
            )}
          </section>
        ) : null}
        <label className="block text-sm font-semibold text-text-primary">
          Notes
          <textarea
            className={inputClassName}
            maxLength={10000}
            onChange={(event) => setField("notes", event.currentTarget.value)}
            rows={3}
            value={formState.notes}
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <Button
            disabled={
              isSubmitting ||
              !formState.targetProgramCode ||
              !formState.facilityId ||
              !formState.instructorStaffMemberId ||
              !formState.qualificationCertificationId
            }
            type="submit"
          >
            Create Training Session
          </Button>
          <Button disabled={isSubmitting} onClick={onCancel} type="button" variant="secondary">
            Cancel
          </Button>
        </div>
      </form>
    </Surface>
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

function buildCreateSessionRequest(formState: SessionFormState) {
  return {
    training_title: formState.title.trim(),
    operational_skill: formState.operationalSkill,
    training_start_date: new Date(formState.startDate).toISOString(),
    training_end_date: formState.endDate
      ? new Date(formState.endDate).toISOString()
      : null,
    duration_minutes: formState.durationMinutes
      ? Number(formState.durationMinutes)
      : null,
    facility_id: formState.facilityId,
    instructor_staff_member_id: formState.instructorStaffMemberId,
    instructor_qualification_certification_id:
      formState.qualificationCertificationId,
    target_program_codes: [formState.targetProgramCode as TrainingProgramCode],
    training_notes: nullableText(formState.notes)
  };
}

function requiredValue<T>(value: T | null | undefined | "", message: string): T {
  if (value === null || value === undefined || value === "") throw new Error(message);
  return value;
}

function evidencePurposeForTemplate(templateCode: TrainingEvidenceWorkspaceRecord["evidence"]["template_code"]): TrainingEvidenceWorkspaceSlot["evidence_purpose"] {
  if (templateCode === "OGI_F023_OPERATIONAL_SKILLS_ASSESSMENT") return "SKILLS_ASSESSMENT";
  if (templateCode === "OGI_F024_OPERATIONAL_KNOWLEDGE_ASSESSMENT_RECORD") return "KNOWLEDGE_ASSESSMENT";
  if (templateCode === "OGI_F025_OPERATIONAL_READINESS_EVALUATION") return "READINESS";
  throw new Error("Unsupported Training evidence template.");
}

function instructorOptionValue(instructor: EligibleTrainingInstructor) {
  return `${instructor.personnel_id}:${instructor.qualification.certification_id}`;
}

function instructorOptionValueOrEmpty(
  instructors: readonly EligibleTrainingInstructor[],
  form: SessionFormState
) {
  const instructor = instructors.find(
    (candidate) => candidate.personnel_id === form.instructorStaffMemberId &&
      candidate.qualification.certification_id === form.qualificationCertificationId
  );
  return instructor ? instructorOptionValue(instructor) : "";
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
  const qualification = session.instructor_qualification_certification
    ? `${session.instructor_qualification_certification.business_identifier} (${session.instructor_qualification_certification.certification_level})`
    : "Qualification not recorded";

  return [
    session.business_identifier,
    startDate,
    session.training_title,
    instructor,
    qualification,
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
