import { FormEvent, KeyboardEvent, ReactNode, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { listRegistrationClients, type RegistrationClient } from "../registration/registrationClientApi";
import { listRegistrationFacilities, type RegistrationFacility } from "../registration/registrationFacilityApi";
import { listRegistrationPersonnel, type RegistrationPersonnel } from "../registration/registrationPersonnelApi";
import { Button } from "../ui/components/Button";
import { SelectableCard } from "../ui/components/SelectableCard";
import { WorkflowContentCard, WorkflowModal } from "../ui/components/WorkflowModal";
import {
  createTrainingEnrollment,
  createTrainingSession,
  createTrainingTrainee,
  getTrainingTrainee,
  linkTrainingTraineeStaffMember,
  listEligibleTrainingInstructors,
  listTrainingEnrollments,
  listTrainingPrograms,
  listTrainingSessions,
  listTrainingTrainees,
  type EligibleTrainingInstructor,
  type TrainingEnrollment,
  type TrainingOperationalSkill,
  type TrainingProgramAuthority,
  type TrainingProgramCode,
  type TrainingSession,
  type TrainingTrainee
} from "./trainingApi";

type TraineeMode = "EXISTING" | "NEW";
type SessionMode = "EXISTING" | "NEW";
type Step = "TRAINEE" | "PROGRAM" | "SESSION" | "TRAINER" | "SCHEDULE" | "REVIEW";

interface WizardState {
  traineeMode: TraineeMode;
  traineeId: string;
  fullName: string;
  email: string;
  phoneNumber: string;
  notes: string;
  staffMemberId: string;
  programCode: TrainingProgramCode | "";
  clientId: string;
  facilityId: string;
  sessionMode: SessionMode;
  sessionId: string;
  instructorStaffMemberId: string;
  qualificationCertificationId: string;
  title: string;
  operationalSkill: TrainingOperationalSkill;
  startDate: string;
  endDate: string;
  durationMinutes: string;
  sessionNotes: string;
}

interface FrozenIntent extends WizardState {
  traineeIdsBefore: readonly string[];
  sessionIdempotencyKey: string;
}

interface IntentProgress {
  trainee?: TrainingTrainee;
  traineeCreationAttempted?: boolean;
  session?: TrainingSession;
  enrollment?: TrainingEnrollment;
  enrollmentCreationAttempted?: boolean;
  enrollmentIdsBefore?: readonly string[];
}

const initialState: WizardState = {
  traineeMode: "EXISTING", traineeId: "", fullName: "", email: "", phoneNumber: "", notes: "", staffMemberId: "",
  programCode: "", clientId: "", facilityId: "", sessionMode: "EXISTING", sessionId: "", instructorStaffMemberId: "",
  qualificationCertificationId: "", title: "", operationalSkill: "RESCUE_SKILLS", startDate: "", endDate: "",
  durationMinutes: "", sessionNotes: ""
};

export interface RegisterTrainingWizardResult {
  trainee: TrainingTrainee;
  enrollment: TrainingEnrollment;
  session: TrainingSession;
}

export function RegisterTrainingWizard({
  canCreateSession,
  canLinkPersonnel,
  canRegisterTrainee,
  canViewClients,
  canViewCertifications,
  canViewFacilities,
  canViewPersonnel,
  onCancel,
  onComplete
}: {
  canCreateSession: boolean;
  canLinkPersonnel: boolean;
  canRegisterTrainee: boolean;
  canViewClients: boolean;
  canViewCertifications: boolean;
  canViewFacilities: boolean;
  canViewPersonnel: boolean;
  onCancel: () => void;
  onComplete: (result: RegisterTrainingWizardResult) => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const intentRef = useRef<FrozenIntent | null>(null);
  const progressRef = useRef<IntentProgress>({});
  const [state, setState] = useState(initialState);
  const [step, setStep] = useState<Step>("TRAINEE");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const traineesQuery = useQuery({ queryKey: ["training-trainees", "register-wizard"], queryFn: listTrainingTrainees, retry: false });
  const clientsQuery = useQuery({ queryKey: ["registration-clients", "register-wizard"], queryFn: listRegistrationClients, enabled: canViewClients, retry: false });
  const facilitiesQuery = useQuery({ queryKey: ["registration-facilities", "register-wizard"], queryFn: () => listRegistrationFacilities(), enabled: canViewFacilities, retry: false });
  const sessionsQuery = useQuery({ queryKey: ["training-sessions", "register-wizard"], queryFn: listTrainingSessions, retry: false });
  const programsQuery = useQuery({ queryKey: ["training-programs"], queryFn: listTrainingPrograms, retry: false });
  const personnelQuery = useQuery({ queryKey: ["registration-personnel", "register-wizard"], queryFn: () => listRegistrationPersonnel(), enabled: canViewPersonnel, retry: false });
  const eligibleInstructorsQuery = useQuery({
    queryKey: ["training-eligible-instructors", state.facilityId, state.programCode, state.startDate, "register-wizard"],
    queryFn: () => listEligibleTrainingInstructors({
      facilityId: state.facilityId,
      targetProgramCodes: [required(state.programCode, "Training program is required for instructor authority.")],
      at: toIsoDateTime(state.startDate)
    }),
    enabled: canViewCertifications && state.sessionMode === "NEW" && Boolean(state.facilityId && state.programCode && state.startDate),
    retry: false
  });
  useEffect(() => { dialogRef.current?.focus(); }, []);

  const trainees = traineesQuery.data?.trainees ?? [];
  const clients = (clientsQuery.data?.clients ?? []).filter((client) => client.status === "ACTIVE");
  const facilities = (facilitiesQuery.data?.facilities ?? []).filter((facility) =>
    facility.operational_status === "ACTIVE" && (!state.clientId || facility.client_id === state.clientId)
  );
  const personnel = (personnelQuery.data?.personnel ?? []).filter((person) =>
    person.employment_status === "ACTIVE" &&
    (!state.clientId ||
      person.client_id === state.clientId ||
      (person.organizational_affiliation === "OGI" && person.client_id === null))
  );
  const currentTime = Date.now();
  const eligibleInstructors = eligibleInstructorsQuery.data?.instructors ?? [];
  const programs = programsQuery.data?.programs ?? [];
  const eligibleSessions = (sessionsQuery.data?.sessions ?? []).filter((session) => {
    const qualification = session.instructor_qualification_certification;
    if (!session.instructor_staff_member_id || !session.instructor_qualification_certification_id || !session.instructor_staff_member || !qualification) return false;
    if ((qualification.certification_level !== "L6" && qualification.certification_level !== "L7") || qualification.certification_status !== "ACTIVE") return false;
    if (new Date(qualification.issue_date).getTime() > currentTime || new Date(qualification.expiry_date).getTime() <= currentTime) return false;
    if (state.facilityId && session.facility_id !== state.facilityId) return false;
    if (state.clientId && session.facility?.client_id !== state.clientId) return false;
    return true;
  });
  const steps: Step[] = state.sessionMode === "NEW"
    ? ["TRAINEE", "PROGRAM", "SESSION", "SCHEDULE", "TRAINER", "REVIEW"]
    : ["TRAINEE", "PROGRAM", "SESSION", "REVIEW"];
  const index = steps.indexOf(step);
  const dirty = JSON.stringify(state) !== JSON.stringify(initialState);

  function update(patch: Partial<WizardState>) { setState((current) => ({ ...current, ...patch })); setError(null); }
  function cancel() {
    if (intentRef.current) {
      setError("This submitted registration intent must be reconciled here before the dialog can close.");
      return;
    }
    if (!dirty || window.confirm("Discard the unfinished Training registration?")) onCancel();
  }
  function changeClient(clientId: string) {
    update({ clientId, facilityId: "", sessionId: "", instructorStaffMemberId: "", qualificationCertificationId: "" });
  }
  function changeFacility(facilityId: string) { update({ facilityId, sessionId: "", instructorStaffMemberId: "", qualificationCertificationId: "" }); }
  function changeProgram(programCode: TrainingProgramCode | "") {
    const program = programs.find((candidate) => candidate.program_code === programCode);
    update({
      programCode,
      operationalSkill: program?.allowed_session_focuses[0] ?? "RESCUE_SKILLS",
      sessionId: "",
      instructorStaffMemberId: "",
      qualificationCertificationId: ""
    });
  }
  function changeSessionMode(sessionMode: SessionMode) { update({ sessionMode, sessionId: "", instructorStaffMemberId: "", qualificationCertificationId: "" }); }
  function changeTrainer(selector: string) {
    const instructor = eligibleInstructors.find((candidate) => instructorSelector(candidate) === selector);
    update({ instructorStaffMemberId: instructor?.personnel_id ?? "", qualificationCertificationId: instructor?.qualification.certification_id ?? "" });
  }
  function next() {
    if (!validStep(step, state)) return;
    setStep(required(steps[Math.min(index + 1, steps.length - 1)], "The next registration step is unavailable."));
  }
  function back() { if (index > 0) setStep(required(steps[index - 1], "The previous registration step is unavailable.")); }
  async function complete(event: FormEvent) {
    event.preventDefault();
    if (step !== "REVIEW" || pending) return;
    const frozen = intentRef.current ?? {
      ...state,
      traineeIdsBefore: trainees.map((trainee) => trainee.id),
      sessionIdempotencyKey: crypto.randomUUID()
    };
    intentRef.current = frozen;
    setPending(true);
    setError(null);
    try {
      const result = await executeIntent(frozen, trainees, eligibleSessions, progressRef.current);
      onComplete(result);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Training registration could not be completed safely.");
    } finally {
      setPending(false);
    }
  }
  function key(event: KeyboardEvent) {
    if (event.key === "Escape") { event.preventDefault(); cancel(); }
  }

  const footer = <><Button disabled={pending || Boolean(intentRef.current)} onClick={cancel} type="button" variant="secondary">Cancel</Button><div className="flex gap-2">{index > 0 ? <Button disabled={pending || Boolean(intentRef.current)} onClick={back} type="button" variant="secondary">← Back</Button> : null}<Button disabled={pending || !validStep(step, state)} onClick={step === "REVIEW" ? undefined : next} type={step === "REVIEW" ? "submit" : "button"}>{pending ? "Completing…" : step === "REVIEW" ? "Complete Training Registration" : "Next →"}</Button></div></>;
  return <WorkflowModal currentStep={index} dialogRef={dialogRef} eyebrow="Training registration" footer={footer} onKeyDown={key} onSubmit={complete} steps={steps.map((item) => ({ key: item, label: label(item) }))} title="Register Training" titleId="register-training-title">
          <WorkflowContentCard currentLabel={label(step)} stepNumber={index + 1} totalSteps={steps.length}>
          {step === "TRAINEE" ? <TraineeStep state={state} trainees={trainees} personnel={personnel} canLinkPersonnel={canLinkPersonnel} canRegisterTrainee={canRegisterTrainee} update={update}/> : null}
          {step === "PROGRAM" ? <ProgramStep state={state} programs={programs} programsLoading={programsQuery.isLoading} programsFailed={programsQuery.isError} clients={clients} facilities={facilities} changeClient={changeClient} changeFacility={changeFacility} changeProgram={changeProgram}/> : null}
          {step === "SESSION" ? <SessionStep state={state} sessions={eligibleSessions} canCreateSession={canCreateSession} changeMode={changeSessionMode} update={update}/> : null}
          {step === "TRAINER" ? <TrainerStep state={state} instructors={eligibleInstructors} loading={eligibleInstructorsQuery.isLoading} failed={eligibleInstructorsQuery.isError} changeTrainer={changeTrainer}/> : null}
          {step === "SCHEDULE" ? <ScheduleStep state={state} program={programs.find((candidate) => candidate.program_code === state.programCode)} update={update}/> : null}
          {step === "REVIEW" ? <Review state={state} programs={programs} trainees={trainees} clients={clients} facilities={facilities} sessions={eligibleSessions} personnel={personnel} instructors={eligibleInstructors}/> : null}
          {error ? <p className="mt-5 rounded-component border border-accent-red/30 bg-red-50 p-3 text-sm font-medium text-red-800" role="alert">{error} Retry uses the same frozen registration intent.</p> : null}
          </WorkflowContentCard>
  </WorkflowModal>;
}

async function executeIntent(intent: FrozenIntent, initialTrainees: readonly TrainingTrainee[], initialSessions: readonly TrainingSession[], progress: IntentProgress): Promise<RegisterTrainingWizardResult> {
  const trainee = progress.trainee ?? (intent.traineeMode === "EXISTING"
    ? required(initialTrainees.find((item) => item.id === intent.traineeId), "The selected Trainee is no longer available.")
    : await createOrReconcileTrainee(intent, progress));
  progress.trainee = trainee;
  if (intent.staffMemberId && !trainee.staff_member_links.some((link) => link.staff_member_id === intent.staffMemberId)) {
    try { await linkTrainingTraineeStaffMember(trainee.id, { staff_member_id: intent.staffMemberId }); }
    catch { const current = await getTrainingTrainee(trainee.id); if (!current.staff_member_links.some((link) => link.staff_member_id === intent.staffMemberId)) throw new Error("Personnel linking failed and could not be reconciled."); }
  }
  const session = progress.session ?? (intent.sessionMode === "EXISTING"
    ? required(initialSessions.find((item) => item.id === intent.sessionId), "The selected Training Session is no longer eligible.")
    : await createTrainingSession(buildSession(intent), intent.sessionIdempotencyKey));
  progress.session = session;
  if (progress.enrollment) return { trainee: await getTrainingTrainee(trainee.id), enrollment: progress.enrollment, session };
  if (progress.enrollmentCreationAttempted) {
    const enrollment = await reconcileEnrollment(intent, trainee.id, session.id, progress.enrollmentIdsBefore ?? []);
    progress.enrollment = enrollment;
    return { trainee: await getTrainingTrainee(trainee.id), enrollment, session };
  }
  const before = await listTrainingEnrollments(trainee.id);
  progress.enrollmentIdsBefore = before.enrollments.map((item) => item.id);
  progress.enrollmentCreationAttempted = true;
  let enrollment: TrainingEnrollment;
  try {
    enrollment = await createTrainingEnrollment(trainee.id, { program_code: required(intent.programCode, "Program is required."), client_id: intent.clientId || null, training_session_id: session.id, notes: intent.notes || null });
  } catch {
    enrollment = await reconcileEnrollment(intent, trainee.id, session.id, progress.enrollmentIdsBefore ?? []);
  }
  if (enrollment.training_session_id !== session.id) throw new Error("Enrollment was not assigned to the reviewed Training Session.");
  progress.enrollment = enrollment;
  return { trainee: await getTrainingTrainee(trainee.id), enrollment, session };
}

async function createOrReconcileTrainee(intent: FrozenIntent, progress: IntentProgress) {
  if (progress.traineeCreationAttempted) return reconcileTrainee(intent);
  progress.traineeCreationAttempted = true;
  try { return await createTrainingTrainee({ full_name: intent.fullName.trim(), email: intent.email.trim() || null, phone_number: intent.phoneNumber.trim() || null, notes: intent.notes.trim() || null }); }
  catch {
    return reconcileTrainee(intent);
  }
}

async function reconcileTrainee(intent: FrozenIntent) {
  const after = await listTrainingTrainees();
  const matches = after.trainees.filter((item) => !intent.traineeIdsBefore.includes(item.id) && item.full_name === intent.fullName.trim() && item.email === (intent.email.trim() || null) && item.phone_number === (intent.phoneNumber.trim() || null));
  if (matches.length !== 1) throw new Error("Trainee creation outcome is ambiguous and could not be reconciled uniquely.");
  return required(matches[0], "Trainee reconciliation did not return its exact result.");
}

async function reconcileEnrollment(intent: FrozenIntent, traineeId: string, sessionId: string, enrollmentIdsBefore: readonly string[]) {
  const after = await listTrainingEnrollments(traineeId);
  const matches = after.enrollments.filter((item) => !enrollmentIdsBefore.includes(item.id) && item.program_code === intent.programCode && item.client_id === (intent.clientId || null) && item.training_session_id === sessionId);
  if (matches.length !== 1) throw new Error("Enrollment outcome is ambiguous and could not be reconciled uniquely.");
  return required(matches[0], "Enrollment reconciliation did not return its exact result.");
}

function buildSession(state: WizardState) { return { training_title: state.title.trim(), operational_skill: state.operationalSkill, training_start_date: toIsoDateTime(state.startDate), training_end_date: state.endDate ? toIsoDateTime(state.endDate) : null, duration_minutes: state.durationMinutes ? Number(state.durationMinutes) : null, facility_id: state.facilityId || null, instructor_staff_member_id: state.instructorStaffMemberId, instructor_qualification_certification_id: state.qualificationCertificationId, target_program_codes: [required(state.programCode,"Training program is required for Session authority.")], training_notes: state.sessionNotes.trim() || null }; }
function required<T>(value: T | null | undefined | "", message: string): T { if (value === null || value === undefined || value === "") throw new Error(message); return value; }
function toIsoDateTime(value: string) { const result = new Date(value); if (Number.isNaN(result.getTime())) throw new Error("A valid Session start date is required for instructor authority."); return result.toISOString(); }
function instructorSelector(instructor: EligibleTrainingInstructor) { return `${instructor.personnel_id}:${instructor.qualification.certification_id}`; }
function label(step: Step) { return ({ TRAINEE: "Trainee", PROGRAM: "Program", SESSION: "Session", TRAINER: "Trainer", SCHEDULE: "Schedule", REVIEW: "Review" } as const)[step]; }
function validStep(step: Step, state: WizardState) {
  if (step === "TRAINEE") return state.traineeMode === "EXISTING" ? Boolean(state.traineeId) : Boolean(state.fullName.trim());
  if (step === "PROGRAM") return Boolean(state.programCode);
  if (step === "SESSION") return state.sessionMode === "EXISTING" ? Boolean(state.sessionId) : Boolean(state.facilityId);
  if (step === "TRAINER") return Boolean(state.instructorStaffMemberId && state.qualificationCertificationId);
  if (step === "SCHEDULE") return Boolean(state.title.trim() && state.startDate && state.operationalSkill && state.facilityId);
  return true;
}

function Field({ label: text, children }: { label: string; children: ReactNode }) { return <label className="block text-sm font-semibold text-text-primary">{text}<span className="mt-2 block">{children}</span></label>; }
const control = "min-h-10 w-full rounded-component border border-border bg-white px-3 py-2 text-sm";
function TraineeStep({state,trainees,personnel,canLinkPersonnel,canRegisterTrainee,update}:{state:WizardState;trainees:readonly TrainingTrainee[];personnel:readonly RegistrationPersonnel[];canLinkPersonnel:boolean;canRegisterTrainee:boolean;update:(patch:Partial<WizardState>)=>void}) { return <div className="space-y-5"><fieldset><legend className="text-sm font-semibold text-primary-navy">Trainee source</legend><div className="mt-3 grid gap-3 sm:grid-cols-2"><SelectableCard selected={state.traineeMode==="EXISTING"}><input checked={state.traineeMode==="EXISTING"} className="h-4 w-4 accent-primary-blue" name="trainee-mode" onChange={()=>update({traineeMode:"EXISTING",staffMemberId:""})} type="radio"/> Existing Trainee</SelectableCard>{canRegisterTrainee?<SelectableCard selected={state.traineeMode==="NEW"}><input checked={state.traineeMode==="NEW"} className="h-4 w-4 accent-primary-blue" name="trainee-mode" onChange={()=>update({traineeMode:"NEW",traineeId:""})} type="radio"/> Register New Trainee</SelectableCard>:null}</div></fieldset>{state.traineeMode==="EXISTING"?<Field label="Existing Trainee"><select className={control} onChange={e=>update({traineeId:e.target.value})} value={state.traineeId}><option value="">Select a Trainee</option>{trainees.map(x=><option key={x.id} value={x.id}>{x.full_name} · {x.student_number ?? "Student number pending"}</option>)}</select></Field>:<div className="grid gap-4 sm:grid-cols-2"><Field label="Full name"><input className={control} onChange={e=>update({fullName:e.target.value})} value={state.fullName}/></Field><Field label="Email"><input className={control} onChange={e=>update({email:e.target.value})} type="email" value={state.email}/></Field><Field label="Phone number"><input className={control} onChange={e=>update({phoneNumber:e.target.value})} value={state.phoneNumber}/></Field><Field label="Notes"><input className={control} onChange={e=>update({notes:e.target.value})} value={state.notes}/></Field>{canLinkPersonnel?<Field label="Link Personnel (optional)"><select className={control} onChange={e=>update({staffMemberId:e.target.value})} value={state.staffMemberId}><option value="">No Personnel link</option>{personnel.map(x=><option key={x.id} value={x.id}>{x.full_name}</option>)}</select></Field>:null}</div>}</div>; }
function ProgramStep({state,programs,programsLoading,programsFailed,clients,facilities,changeClient,changeFacility,changeProgram}:{state:WizardState;programs:readonly TrainingProgramAuthority[];programsLoading:boolean;programsFailed:boolean;clients:readonly RegistrationClient[];facilities:readonly RegistrationFacility[];changeClient:(id:string)=>void;changeFacility:(id:string)=>void;changeProgram:(code:TrainingProgramCode|"")=>void}) { const selected=programs.find(x=>x.program_code===state.programCode);return <div className="space-y-5"><div className="grid gap-4 sm:grid-cols-2"><Field label="Program"><select className={control} disabled={programsLoading||programsFailed} onChange={e=>changeProgram(e.target.value as TrainingProgramCode|"")} value={state.programCode}><option value="">{programsLoading?"Loading governed Programs…":"Select a Program"}</option>{programs.map(x=><option key={x.program_code} value={x.program_code}>{x.certification_level} · {x.display_name}</option>)}</select></Field><Field label="Sponsoring Client (optional)"><select className={control} onChange={e=>changeClient(e.target.value)} value={state.clientId}><option value="">No sponsoring Client</option>{clients.map(x=><option key={x.id} value={x.id}>{x.organization_name}</option>)}</select></Field><Field label="Facility (required for a new Session)"><select className={control} disabled={!state.clientId} onChange={e=>changeFacility(e.target.value)} value={state.facilityId}><option value="">No Facility</option>{facilities.map(x=><option key={x.id} value={x.id}>{x.facility_name}</option>)}</select></Field></div>{programsFailed?<p role="alert">Governed Program coverage could not be loaded. Training registration remains unavailable.</p>:null}{selected?<ProgramCoverage program={selected}/>:null}</div>; }
function SessionStep({state,sessions,canCreateSession,changeMode,update}:{state:WizardState;sessions:readonly TrainingSession[];canCreateSession:boolean;changeMode:(mode:SessionMode)=>void;update:(patch:Partial<WizardState>)=>void}) { return <div className="space-y-5"><fieldset><legend className="text-sm font-semibold text-primary-navy">Training Session source</legend><div className="mt-3 grid gap-3 sm:grid-cols-2"><SelectableCard selected={state.sessionMode==="EXISTING"}><input checked={state.sessionMode==="EXISTING"} className="h-4 w-4 accent-primary-blue" name="session-mode" onChange={()=>changeMode("EXISTING")} type="radio"/> Use Existing Training Session</SelectableCard>{canCreateSession?<SelectableCard selected={state.sessionMode==="NEW"}><input checked={state.sessionMode==="NEW"} className="h-4 w-4 accent-primary-blue" name="session-mode" onChange={()=>changeMode("NEW")} type="radio"/> Create New Training Session</SelectableCard>:null}</div></fieldset>{state.sessionMode==="EXISTING"?<><Field label="Eligible Training Session"><select className={control} onChange={e=>update({sessionId:e.target.value})} value={state.sessionId}><option value="">Select a Session</option>{sessions.map(x=><option key={x.id} value={x.id}>{x.training_title}</option>)}</select></Field>{sessions.length===0?<div className="rounded-component border border-dashed border-border bg-blue-50/40 p-4"><p>No eligible Training Session is available for this Program and Facility context.</p>{canCreateSession?<Button className="mt-3" onClick={()=>changeMode("NEW")} type="button" variant="secondary">Create New Training Session</Button>:null}</div>:null}</>:state.facilityId?<p className="rounded-component border border-blue-100 bg-blue-50 p-4 text-sm text-text-muted">The new Session will be created only when you complete the reviewed registration.</p>:<p className="rounded-component border border-accent-red/30 bg-red-50 p-4 text-sm font-medium text-red-800" role="alert">Select an exact Facility on the Program step before creating a new Session. Instructor eligibility cannot be resolved without Facility scope.</p>}</div>; }
function TrainerStep({state,instructors,loading,failed,changeTrainer}:{state:WizardState;instructors:readonly EligibleTrainingInstructor[];loading:boolean;failed:boolean;changeTrainer:(selector:string)=>void}) { const selected=instructors.find(candidate=>candidate.personnel_id===state.instructorStaffMemberId&&candidate.qualification.certification_id===state.qualificationCertificationId);return <div className="space-y-4"><Field label="Eligible Primary Instructor"><select className={control} disabled={loading} onChange={e=>changeTrainer(e.target.value)} value={selected?instructorSelector(selected):""}><option value="">{loading?"Resolving eligible instructors…":"Select an eligible instructor"}</option>{instructors.map(x=><option key={instructorSelector(x)} value={instructorSelector(x)}>{x.display_name} · {x.qualification.title}</option>)}</select></Field>{selected?<div className="rounded-component border border-blue-200 bg-blue-50 p-4 text-sm"><p className="font-semibold text-primary-navy">Exact qualifying Certification</p><p className="mt-1 text-text-muted">{selected.qualification.title} · {selected.qualification.certification_level}</p><p className="mt-1 text-text-muted">Operational scope: {selected.organizational_affiliation === "OGI" ? selected.operational_scope.scope_mode ?? "Authorized facility scope" : "Client affiliation"}</p></div>:null}{failed?<p role="alert">Eligible instructors could not be resolved from authoritative Training scope.</p>:null}{!loading&&!failed&&instructors.length===0?<p role="alert">No instructor has a current qualifying Certification and operational authority for this Facility, program, and Session date.</p>:null}</div>; }
function ScheduleStep({state,program,update}:{state:WizardState;program:TrainingProgramAuthority|undefined;update:(patch:Partial<WizardState>)=>void}) { const focuses=program?.allowed_session_focuses??[];return <div className="grid gap-4 sm:grid-cols-2"><Field label="Session title"><input className={control} onChange={e=>update({title:e.target.value})} value={state.title}/></Field><Field label="Primary Session Focus"><select className={control} disabled={!program} onChange={e=>update({operationalSkill:e.target.value as TrainingOperationalSkill})} value={state.operationalSkill}>{focuses.map(x=><option key={x} value={x}>{x.replaceAll("_"," ")}</option>)}</select><span className="mt-2 block text-xs font-normal text-text-muted">Classifies this Session only. It does not define Program coverage or prove competency completion.</span></Field><Field label="Start date"><input className={control} onChange={e=>update({startDate:e.target.value})} type="datetime-local" value={state.startDate}/></Field><Field label="End date"><input className={control} onChange={e=>update({endDate:e.target.value})} type="datetime-local" value={state.endDate}/></Field><Field label="Duration minutes"><input className={control} min="1" onChange={e=>update({durationMinutes:e.target.value})} type="number" value={state.durationMinutes}/></Field><Field label="Session notes"><input className={control} onChange={e=>update({sessionNotes:e.target.value})} value={state.sessionNotes}/></Field></div>; }
function ProgramCoverage({program}:{program:TrainingProgramAuthority}) { return <section aria-label="Required Program Coverage" className="rounded-component border border-blue-200 bg-blue-50 p-4"><h3 className="font-semibold text-primary-navy">Required Program Coverage</h3><p className="mt-1 text-sm text-text-muted">Governed course coverage for {program.certification_level} · {program.display_name}. This does not record attendance, assessment, readiness, or completion.</p>{program.required_program_coverage.length>0?<ul className="mt-3 grid gap-x-6 gap-y-1 text-sm text-text-primary sm:grid-cols-2">{program.required_program_coverage.map(item=><li key={item}>• {item}</li>)}</ul>:<p className="mt-3 text-sm text-text-muted">Course coverage has not yet been published for this Program.</p>}</section>; }
function Review({state,programs,trainees,clients,facilities,sessions,personnel,instructors}:{state:WizardState;programs:readonly TrainingProgramAuthority[];trainees:readonly TrainingTrainee[];clients:readonly RegistrationClient[];facilities:readonly RegistrationFacility[];sessions:readonly TrainingSession[];personnel:readonly RegistrationPersonnel[];instructors:readonly EligibleTrainingInstructor[]}) { const trainee=trainees.find(x=>x.id===state.traineeId),program=programs.find(x=>x.program_code===state.programCode),session=sessions.find(x=>x.id===state.sessionId),trainer=personnel.find(x=>x.id===state.instructorStaffMemberId),instructor=instructors.find(x=>x.personnel_id===state.instructorStaffMemberId&&x.qualification.certification_id===state.qualificationCertificationId);return <dl className="grid gap-3 rounded-component bg-elevated p-4 text-sm sm:grid-cols-2"><Summary label="Trainee" value={state.traineeMode==="EXISTING"?`${trainee?.full_name} · ${trainee?.student_number??"No Student Number"}`:`${state.fullName} · new Student Number will be allocated`}/><Summary label="Program" value={program?`${program.certification_level} · ${program.display_name}`:""}/><Summary label="Primary Session Focus" value={state.sessionMode==="EXISTING"?(session?.operational_skill.replaceAll("_"," ")??""):state.operationalSkill.replaceAll("_"," ")}/><Summary label="Sponsorship" value={`${clients.find(x=>x.id===state.clientId)?.organization_name??"None"} · ${facilities.find(x=>x.id===state.facilityId)?.facility_name??"No Facility"}`}/><Summary label="Training Session" value={state.sessionMode==="EXISTING"?`${session?.training_title} · existing record reused`:`${state.title} · new record`}/><Summary label="Primary Instructor" value={state.sessionMode==="EXISTING"?(session?.instructor_staff_member?.full_name??""):(instructor?.display_name??trainer?.full_name??"")}/><Summary label="Qualification" value={state.sessionMode==="EXISTING"?(session?.instructor_qualification_certification?.business_identifier??""):(instructor?`${instructor.qualification.title} · ${instructor.qualification.certification_level}`:"")}/><Summary label="Enrollment" value="A new governed Enrollment will be created and assigned to this Session."/></dl>; }
function Summary({label:term,value}:{label:string;value:string}) { return <div><dt className="font-semibold text-primary-navy">{term}</dt><dd className="mt-1 text-text-muted">{value}</dd></div>; }
