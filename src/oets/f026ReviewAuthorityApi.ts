import { apiRequest } from "../api/client";

export interface F026InstructorCandidate {
  personnel_id: string;
  user_id: string | null;
  affiliation: "CLIENT" | "OGI";
  display_name: string;
  instructor_number: string;
  instructor_registry_identity_id: string;
}

export interface F026ReviewerAppointmentCandidate {
  appointment_id: string;
  personnel_id: string;
  user_id: string;
  display_name: string;
  business_identifier: string;
  valid_from: string;
  valid_until: string | null;
}

export interface F026TrainingSessionCandidate {
  training_session_id: string;
  course_number: string;
  course_title: string;
  starts_at: string;
  ends_at: string | null;
}

export function getF026InstructorCandidates(clientId: string, facilityId: string, reviewDate: string) {
  return apiRequest<{ review_date: string; candidates: F026InstructorCandidate[] }>(
    `/api/v1/instructor-qa-reviewers/instructor-candidates?${query({ client_id:clientId, facility_id:facilityId, review_date:reviewDate })}`,
    { validate:isInstructorEnvelope }
  );
}

export function getF026ReviewerAppointmentCandidates(clientId: string, facilityId: string) {
  return apiRequest<{ decision_at: string; candidates: F026ReviewerAppointmentCandidate[] }>(
    `/api/v1/instructor-qa-reviewers/appointment-candidates?${query({ client_id:clientId, facility_id:facilityId })}`,
    { validate:isAppointmentEnvelope }
  );
}

export function getF026TrainingSessionCandidates(clientId:string,facilityId:string,instructorId:string,reviewType:string){
  return apiRequest<{ training_session_required:boolean;candidates:F026TrainingSessionCandidate[] }>(
    `/api/v1/instructor-qa-reviewers/training-session-candidates?${query({client_id:clientId,facility_id:facilityId,instructor_personnel_id:instructorId,review_type:reviewType})}`,
    {validate:isSessionEnvelope}
  );
}

function query(input:Record<string,string>){return new URLSearchParams(input).toString();}
function object(value:unknown):value is Record<string,unknown>{return Boolean(value)&&typeof value==="object"&&!Array.isArray(value);}
function isInstructorEnvelope(value:unknown):value is {review_date:string;candidates:F026InstructorCandidate[]}{return object(value)&&typeof value.review_date==="string"&&Array.isArray(value.candidates)&&value.candidates.every(isInstructor);}
function isAppointmentEnvelope(value:unknown):value is {decision_at:string;candidates:F026ReviewerAppointmentCandidate[]}{return object(value)&&typeof value.decision_at==="string"&&Array.isArray(value.candidates)&&value.candidates.every(isAppointment);}
function isSessionEnvelope(value:unknown):value is {training_session_required:boolean;candidates:F026TrainingSessionCandidate[]}{return object(value)&&typeof value.training_session_required==="boolean"&&Array.isArray(value.candidates)&&value.candidates.every(isSession);}
function isInstructor(value:unknown):value is F026InstructorCandidate{return object(value)&&typeof value.personnel_id==="string"&&(value.user_id===null||typeof value.user_id==="string")&&(value.affiliation==="CLIENT"||value.affiliation==="OGI")&&typeof value.display_name==="string"&&typeof value.instructor_number==="string"&&typeof value.instructor_registry_identity_id==="string";}
function isAppointment(value:unknown):value is F026ReviewerAppointmentCandidate{return object(value)&&["appointment_id","personnel_id","user_id","display_name","business_identifier","valid_from"].every(key=>typeof value[key]==="string")&&(value.valid_until===null||typeof value.valid_until==="string");}
function isSession(value:unknown):value is F026TrainingSessionCandidate{return object(value)&&["training_session_id","course_number","course_title","starts_at"].every(key=>typeof value[key]==="string")&&(value.ends_at===null||typeof value.ends_at==="string");}
