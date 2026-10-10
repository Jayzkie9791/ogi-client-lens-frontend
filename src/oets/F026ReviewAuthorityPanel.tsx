import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Surface } from "../ui/components/Surface";
import type { F026ReviewAuthoritySelection } from "./evidenceSubmissionApi";
import { getF026InstructorCandidates, getF026ReviewerAppointmentCandidates, getF026TrainingSessionCandidates } from "./f026ReviewAuthorityApi";

const reviewTypes=["Scheduled Review","Random Audit","New Instructor Review","Instructor Recertification Review","Corrective Action Review","Complaint Investigation","Incident Investigation Support","Litigation Support Review"] as const;
const sessionRequired=new Set<string>(["Scheduled Review","Random Audit","New Instructor Review","Instructor Recertification Review"]);

export function F026ReviewAuthorityPanel({clientId,facilityId,disabled,onChange}:{clientId:string;facilityId:string;disabled:boolean;onChange:(selection:F026ReviewAuthoritySelection|undefined)=>void}){
  const [reviewDate,setReviewDate]=useState("");
  const [types,setTypes]=useState<string[]>([]);
  const [instructorId,setInstructorId]=useState("");
  const [appointmentId,setAppointmentId]=useState("");
  const [sessionId,setSessionId]=useState("");
  const requiresSession=types.some(type=>sessionRequired.has(type));
  const sessionReviewType=types.find(type=>sessionRequired.has(type))??types[0]??"Complaint Investigation";
  const instructors=useQuery({queryKey:["f026","instructors",clientId,facilityId,reviewDate],queryFn:()=>getF026InstructorCandidates(clientId,facilityId,reviewDate),enabled:Boolean(clientId&&facilityId&&reviewDate),retry:false});
  const reviewers=useQuery({queryKey:["f026","reviewer-appointments",clientId,facilityId],queryFn:()=>getF026ReviewerAppointmentCandidates(clientId,facilityId),enabled:Boolean(clientId&&facilityId),retry:false});
  const sessions=useQuery({queryKey:["f026","sessions",clientId,facilityId,instructorId,sessionReviewType],queryFn:()=>getF026TrainingSessionCandidates(clientId,facilityId,instructorId,sessionReviewType),enabled:Boolean(instructorId&&types.length),retry:false});
  const selectedInstructor=instructors.data?.candidates.find(item=>item.personnel_id===instructorId);
  const selectedReviewer=reviewers.data?.candidates.find(item=>item.appointment_id===appointmentId);
  const selection=useMemo<F026ReviewAuthoritySelection|undefined>(()=>reviewDate&&types.length&&selectedInstructor&&selectedReviewer&&(!requiresSession||sessionId)?{reviewed_instructor_personnel_id:selectedInstructor.personnel_id,qa_reviewer_appointment_id:selectedReviewer.appointment_id,training_session_id:sessionId||null,review_types:types,review_date:reviewDate}:undefined,[appointmentId,instructorId,requiresSession,reviewDate,sessionId,selectedInstructor,selectedReviewer,types]);
  useEffect(()=>onChange(selection),[onChange,selection]);
  useEffect(()=>{setInstructorId("");setAppointmentId("");setSessionId("");setTypes([]);},[clientId,facilityId]);
  useEffect(()=>setSessionId(""),[instructorId,sessionReviewType]);
  const unavailable=instructors.isError||reviewers.isError;
  return <Surface className="border-blue-200 bg-blue-50/60">
    <p className="text-sm font-semibold text-primary-navy">Instructor QA Review authority</p>
    <p className="mt-1 text-sm text-text-muted">Select the exact review occurrence, governed Instructor, and appointed QA Reviewer before beginning the Draft.</p>
    {unavailable?<p className="mt-3 rounded-component border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">F026 selection authority is unavailable for this account or scope.</p>:null}
    <div className="mt-3 grid gap-4 md:grid-cols-2">
      <label className="text-sm font-semibold">Review date<input aria-label="F026 review date" className="mt-2 min-h-10 w-full rounded-component border border-border bg-white px-3 py-2" disabled={disabled} onChange={event=>setReviewDate(event.target.value)} type="date" value={reviewDate}/></label>
      <label className="text-sm font-semibold">Reviewed Instructor<select aria-label="F026 reviewed Instructor" className="mt-2 min-h-10 w-full rounded-component border border-border bg-white px-3 py-2" disabled={disabled||instructors.isLoading||instructors.isError} onChange={event=>setInstructorId(event.target.value)} value={instructorId}><option value="">Select an eligible Instructor…</option>{instructors.data?.candidates.map(item=><option key={item.personnel_id} value={item.personnel_id}>{item.display_name} — {item.instructor_number}</option>)}</select></label>
      <label className="text-sm font-semibold">QA Reviewer appointment<select aria-label="F026 QA Reviewer appointment" className="mt-2 min-h-10 w-full rounded-component border border-border bg-white px-3 py-2" disabled={disabled||reviewers.isLoading||reviewers.isError} onChange={event=>setAppointmentId(event.target.value)} value={appointmentId}><option value="">Select an effective appointment…</option>{reviewers.data?.candidates.filter(item=>item.personnel_id!==instructorId).map(item=><option key={item.appointment_id} value={item.appointment_id}>{item.display_name} — {item.business_identifier}</option>)}</select></label>
      <fieldset className="rounded-component border border-border bg-white p-3"><legend className="px-1 text-sm font-semibold">Review type</legend>{reviewTypes.map(type=><label className="mt-2 flex items-center gap-2 text-sm" key={type}><input checked={types.includes(type)} disabled={disabled} onChange={event=>setTypes(current=>event.target.checked?[...current,type]:current.filter(value=>value!==type))} type="checkbox"/>{type}</label>)}</fieldset>
      {types.length&&instructorId?<label className="text-sm font-semibold md:col-span-2">Training Session {requiresSession?"(required)":"(optional)"}<select aria-label="F026 Training Session" className="mt-2 min-h-10 w-full rounded-component border border-border bg-white px-3 py-2" disabled={disabled||sessions.isLoading||sessions.isError} onChange={event=>setSessionId(event.target.value)} value={sessionId}><option value="">{requiresSession?"Select the governed Training Session…":"No Training Session"}</option>{sessions.data?.candidates.map(item=><option key={item.training_session_id} value={item.training_session_id}>{item.course_number} — {item.course_title}</option>)}</select></label>:null}
    </div>
    {!selection&&!unavailable?<p className="mt-3 text-sm text-amber-800">Complete every required F026 authority selection before beginning evidence.</p>:null}
  </Surface>;
}
