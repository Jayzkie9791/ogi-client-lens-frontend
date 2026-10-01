import { useEffect, useRef, useState, type RefObject } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../auth/useAuth";
import { isApiError } from "../api/errors";
import { inserviceApi, type Interval, type PendingTrainingEvent, type TrainingEventDraft, type TrainingEventInput,
  type ClaimReview, type MonthlyEvaluation } from "./inserviceApi";

const categories = ["GOVERNANCE_DOCUMENTATION", "LIFEGUARD_OPERATIONS", "EMERGENCY_PREPAREDNESS",
  "RESCUE_EQUIPMENT_ASSETS", "TRAINING_COMPETENCY", "FACILITY_ENVIRONMENTAL_SAFETY",
  "INCIDENT_MANAGEMENT", "PUBLIC_SAFETY_SYSTEMS", "EQUIPMENT_INSPECTION_PROGRAMS"];
const control = "w-full rounded-component border border-border bg-surface px-3 py-2 text-text-primary";
const button = "rounded-component border border-primary-blue px-3 py-2 font-semibold text-primary-blue disabled:opacity-50";
const primary = "rounded-component bg-primary-blue px-3 py-2 font-semibold text-white disabled:opacity-50";
const validInstant = (value: string) => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) &&
  Number.isFinite(Date.parse(value));
const deviceTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "device local time";
function localDateTimeValue(value:string){
  if(!value)return "";const date=new Date(value);if(!Number.isFinite(date.getTime()))return "";
  const part=(number:number)=>String(number).padStart(2,"0");
  return `${date.getFullYear()}-${part(date.getMonth()+1)}-${part(date.getDate())}T${part(date.getHours())}:${part(date.getMinutes())}`;
}
function localDateTimeInstant(value:string){
  if(!value)return "";const date=new Date(value);return Number.isFinite(date.getTime())?date.toISOString():"";
}
function unfinishedAttendanceEnd(intervals:Interval[],now:number){
  return intervals.map(interval=>Date.parse(interval.ends_at)).filter(end=>Number.isFinite(end)&&end>now)
    .sort((left,right)=>left-right)[0]??null;
}
function displayedInstant(value:string|number){
  const instant=typeof value==="number"?value:Date.parse(value);
  return Number.isFinite(instant)
    ?new Intl.DateTimeFormat(undefined,{dateStyle:"medium",timeStyle:"short",timeZone:deviceTimezone}).format(instant)
    :"Date and time unavailable";
}
function displayedDate(value:string){
  const instant=Date.parse(value);return Number.isFinite(instant)
    ?new Intl.DateTimeFormat(undefined,{dateStyle:"medium",timeZone:deviceTimezone}).format(instant):null;
}
const errorText = (error: unknown) => isApiError(error) ? error.message :
  error instanceof Error ? error.message : "The operation could not be completed.";
const emptyProposal = (facility_id: string): TrainingEventInput => ({ facility_id, topic_title: "",
  topic_description: null, related_category_code: null, starts_at: "", ends_at: "",
  conducting_user_id: null });
type PendingCommand = { signature: string; key: string } | null;
function commandKey(ref: RefObject<PendingCommand>, signature: string): string {
  if (ref.current?.signature === signature) return ref.current.key;
  const key = crypto.randomUUID();
  ref.current = { signature, key };
  return key;
}

export function InserviceWorkspacePage() {
  const auth = useAuth();
  const [facilityId, setFacilityId] = useState(auth.session?.facilityIds[0] ?? "");
  const roles=auth.session?.roles??[];
  const canPropose=auth.canUsePermission("create_training_log")&&
    (auth.session?.clientId===null||roles.some(role=>["CLIENT_ADMIN","CLIENT_LEAD_LIFEGUARD"].includes(role)));
  const canEnter = auth.canUsePermission("create_training_log");
  const canView=auth.canUsePermission("view_training_log");
  const canApproveEvent=auth.canUsePermission("approve_inservice_event")&&auth.session?.clientId===null;
  const canReview=auth.canUsePermission("approve_training_log")&&auth.session?.clientId===null;
  const canEvaluate = auth.canUsePermission("evaluate_inservice_monthly_result") && auth.session?.clientId === null;
  const [tab, setTab] = useState<"proposal"|"hours"|"history"|"approval"|"review"|"monthly">(() =>
    canPropose?"proposal":canEnter?"hours":canApproveEvent?"approval":canReview?"review":canEvaluate?"monthly":"history");
  const facilities = useQuery({ queryKey: ["inservice-facilities"],
    queryFn: () => inserviceApi.facilities(), enabled: canView, retry: false });
  useEffect(() => { if (!facilityId && facilities.data?.facilities.length) {
    setFacilityId(facilities.data.facilities[0]?.id ?? "");
  } }, [facilityId, facilities.data]);
  return <div className="space-y-6">
    <header><p className="text-sm font-bold uppercase tracking-wide text-primary-blue">Workforce training</p>
      <h1 className="text-2xl font-bold text-primary-navy">In-service training</h1>
      <p className="text-text-muted">Recommended topics, participant evidence, independent OGI review, and facility-local monthly evaluation.</p></header>
    <section className="rounded-panel border border-border bg-surface px-4 py-3">
      {facilities.data?.facilities.length===1?<p><span className="font-semibold">Facility:</span> {facilities.data.facilities[0]!.facility_name}</p>:
      facilities.data?.facilities.length ? <><label className="block text-sm font-semibold" htmlFor="inservice-facility">Facility</label><select className={control} id="inservice-facility"
        onChange={(event) => setFacilityId(event.target.value)} value={facilityId}>
        {facilities.data.facilities.map((facility) => <option key={facility.id} value={facility.id}>
          {facility.facility_name}</option>)}</select></> : facilities.isLoading?<p className="text-sm text-text-muted">Loading authorized Facility…</p>:
        facilities.isError?<p role="alert">Facility name is temporarily unavailable.</p>:
        <p role="status">No active Facility is available in your authorized scope.</p>}
    </section>
    <nav aria-label="In-service workflow" className="flex flex-wrap gap-2">
      {canPropose ? <button aria-current={tab === "proposal" ? "page" : undefined} className={tab === "proposal" ? primary : button}
        onClick={() => setTab("proposal")}>Recommended topics</button> : null}
      {canEnter ? <button aria-current={tab === "hours" ? "page" : undefined} className={tab === "hours" ? primary : button}
        onClick={() => setTab("hours")}>Participant hours</button> : null}
      {canView ? <button aria-current={tab === "history" ? "page" : undefined} className={tab === "history" ? primary : button}
        onClick={() => setTab("history")}>Training history</button> : null}
      {canApproveEvent ? <button aria-current={tab === "approval" ? "page" : undefined} className={tab === "approval" ? primary : button}
        onClick={() => setTab("approval")}>Topic approval</button> : null}
      {canReview ? <button aria-current={tab === "review" ? "page" : undefined} className={tab === "review" ? primary : button}
        onClick={() => setTab("review")}>Attendance review</button> : null}
      {canEvaluate ? <button aria-current={tab === "monthly" ? "page" : undefined} className={tab === "monthly" ? primary : button}
        onClick={() => setTab("monthly")}>Monthly evaluation</button> : null}
    </nav>
    {!facilityId ? <p role="status">Select an authorized Facility to continue.</p> :
      tab === "proposal" && canPropose ? <EventProposalDesk facilityId={facilityId} /> :
      tab === "hours" && canEnter ? <ParticipantClaimDesk facilityId={facilityId} /> :
      tab === "history" && canView ? <ClaimHistoryDesk facilityId={facilityId} /> :
      tab === "approval" && canApproveEvent ? <EventApprovalDesk facilityId={facilityId} /> :
      tab === "review" && canReview ? <ClaimReviewDesk facilityId={facilityId} /> :
      tab === "monthly" && canEvaluate ? <MonthlyDesk facilityId={facilityId} /> :
      <p role="alert">You do not have authority for this in-service workflow.</p>}
  </div>;
}

function EventProposalDesk({ facilityId }: { facilityId: string }) {
  const [draft, setDraft] = useState<TrainingEventDraft | null>(null);
  const [form, setForm] = useState<TrainingEventInput>(() => emptyProposal(facilityId));
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const createCommand = useRef<PendingCommand>(null);
  const submitCommand = useRef<PendingCommand>(null);
  const [refresh, setRefresh] = useState(0);
  const list = useQuery({ queryKey: ["inservice-proposal-drafts", facilityId, refresh],
    queryFn: () => inserviceApi.proposalDrafts(facilityId), retry: false });
  useEffect(() => { setDraft(null); setForm(emptyProposal(facilityId)); setMessage(""); }, [facilityId]);
  function load(value: TrainingEventDraft) {
    setDraft(value); setForm({ facility_id:value.facility_id,topic_title:value.topic_title,
      topic_description:value.topic_description,related_category_code:value.related_category_code,
      starts_at:value.starts_at,ends_at:value.ends_at,conducting_user_id:value.conducting_user_id });setMessage("");
  }
  async function save() {
    setBusy(true); setMessage("");
    try {
      const result = draft ? await inserviceApi.updateProposal(draft.id, draft.revision, form) :
        await inserviceApi.createProposal(form, commandKey(createCommand, JSON.stringify(form)));
      createCommand.current = null;
      load(result); setRefresh((n) => n + 1); setMessage("Draft saved. No training credit has been awarded.");
    } catch (error) { setMessage(errorText(error)); } finally { setBusy(false); }
  }
  async function submit() {
    if (!draft) return;
    setBusy(true); setMessage("");
    try { await inserviceApi.submitProposal(draft.id, draft.revision,
      commandKey(submitCommand, `${draft.id}:${draft.revision}`));
      submitCommand.current = null;setDraft(null);setForm(emptyProposal(facilityId));setRefresh((n)=>n+1);
      setMessage("Recommended topic submitted for separate OGI approval. No attendance or credit was created.");
    } catch (error) { setMessage(errorText(error)); } finally { setBusy(false); }
  }
  async function abandon(){if(!draft)return;setBusy(true);setMessage("");try{await inserviceApi.abandonProposal(draft.id,draft.revision);
    setDraft(null);setForm(emptyProposal(facilityId));setRefresh(n=>n+1);setMessage("Recommended-topic Draft abandoned.");
  }catch(error){setMessage(errorText(error));}finally{setBusy(false);}
  }
  return <div className="grid gap-5 xl:grid-cols-[1fr_2fr]">
    <section className="rounded-panel border border-border bg-surface p-5">
      <h2 className="text-lg font-bold">Recommended-topic Drafts</h2>
      <button className={button} onClick={() => { setDraft(null); setForm(emptyProposal(facilityId)); setMessage(""); }}>New recommended topic</button>
      {list.isError ? <p role="alert">{errorText(list.error)}</p> : null}
      <ul className="mt-3 space-y-2">{list.data?.drafts.map((item) => <li key={item.id}>
        <button className={button} onClick={() => load(item)}>{item.topic_title} · revision {item.revision}</button>
      </li>)}</ul>
    </section>
    <section className="space-y-4 rounded-panel border border-border bg-surface p-5">
      <h2 className="text-lg font-bold">{draft ? "Edit recommended topic" : "New recommended topic"}</h2>
      <p className="text-sm text-text-muted">Personnel may complete this topic opportunistically during the completion period and record their actual attendance separately after OGI approval.</p>
      <p className="text-sm text-text-muted">Choose the completion-period dates and times using this device ({deviceTimezone}). Confirm both values before saving.
        {draft ? ` The governed Facility timezone is ${draft.facility_timezone}.` : ""}</p>
      <label className="block">Topic title *<input className={control} maxLength={255} onChange={(e) =>
        setForm({ ...form, topic_title: e.target.value })} value={form.topic_title} /></label>
      <label className="block">Description<textarea className={control} onChange={(e) =>
        setForm({ ...form, topic_description: e.target.value || null })} value={form.topic_description ?? ""} /></label>
      <label className="block">Related evaluation category (informational)<select className={control}
        onChange={(e) => setForm({ ...form, related_category_code: e.target.value || null })}
        value={form.related_category_code ?? ""}><option value="">None</option>
        {categories.map((value) => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}</select></label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label>Completion period start *<input className={control} type="datetime-local" value={localDateTimeValue(form.starts_at)}
          onChange={(e) => setForm({ ...form, starts_at: localDateTimeInstant(e.target.value) })} /></label>
        <label>Completion period end *<input className={control} type="datetime-local" value={localDateTimeValue(form.ends_at)}
          onChange={(e) => setForm({ ...form, ends_at: localDateTimeInstant(e.target.value) })} /></label>
      </div>
      <div className="flex flex-wrap gap-2"><button className={primary} disabled={busy || !form.topic_title.trim() ||
        !validInstant(form.starts_at) || !validInstant(form.ends_at)||new Date(form.ends_at)<=new Date(form.starts_at)} onClick={() => void save()}>Save topic Draft</button>
        {draft ? <button className={button} disabled={busy} onClick={() => void submit()}>Submit topic for approval</button> : null}</div>
      {draft ? <button className={button} disabled={busy} onClick={()=>void abandon()}>Abandon Draft</button> : null}
      {!validInstant(form.starts_at)||!validInstant(form.ends_at)?<p className="text-sm text-text-muted">Select the completion period start and end to enable saving.</p>:
        new Date(form.ends_at)<=new Date(form.starts_at)?<p role="alert">Completion period end must be later than its start.</p>:null}
      {message ? <p role="status">{message}</p> : null}
    </section>
  </div>;
}

function EventApprovalDesk({facilityId}:{facilityId:string}){
  const [selected,setSelected]=useState<PendingTrainingEvent|null>(null);const [note,setNote]=useState("");
  const [message,setMessage]=useState("");const [busy,setBusy]=useState(false);const [refresh,setRefresh]=useState(0);
  const decisionCommand=useRef<PendingCommand>(null);
  const queue=useQuery({queryKey:["inservice-event-approval",facilityId,refresh],
    queryFn:()=>inserviceApi.eventApprovalQueue(facilityId),retry:false});
  useEffect(()=>{setSelected(null);setNote("");setMessage("");},[facilityId]);
  async function decide(decision:"APPROVED"|"REJECTED"){if(!selected)return;setBusy(true);setMessage("");try{
    await inserviceApi.decideEvent(selected.event_id,selected.revision_id,decision,note.trim()||null,
      selected.revision_checksum,commandKey(decisionCommand,`${selected.revision_id}:${decision}:${note.trim()}`));
    decisionCommand.current=null;setSelected(null);setNote("");setRefresh(n=>n+1);
    setMessage(decision==="APPROVED"?"Topic approved for participant entry. No attendance or credit was created.":"Recommended topic rejected.");
  }catch(error){setMessage(errorText(error));}finally{setBusy(false);}}
  return <div className="grid gap-5 xl:grid-cols-[1fr_2fr]"><section className="rounded-panel border border-border bg-surface p-5">
    <h2 className="text-lg font-bold">Topics awaiting OGI approval</h2>{queue.isError?<p role="alert">{errorText(queue.error)}</p>:null}
    <ul className="mt-3 space-y-2">{queue.data?.events.map(item=><li key={item.revision_id}><button className={button}
      onClick={()=>{setSelected(item);setNote("");setMessage("");}}>{item.topic_title} · revision {item.revision_number}</button></li>)}</ul>
  </section><section className="space-y-4 rounded-panel border border-border bg-surface p-5"><h2 className="text-lg font-bold">Exact submitted topic revision</h2>
    {selected?<><dl><dt className="font-semibold">Topic</dt><dd>{selected.topic_title}</dd><dt className="font-semibold">Description</dt>
      <dd>{selected.topic_description??"None"}</dd><dt className="font-semibold">Informational category</dt><dd>{selected.related_category_code??"None"}</dd>
      <dt className="font-semibold">Completion period</dt><dd>{displayedInstant(selected.starts_at)} – {displayedInstant(selected.ends_at)}</dd>
      <dd className="text-sm text-text-muted">Shown in this device timezone ({deviceTimezone}).</dd></dl>
      <details><summary className="cursor-pointer font-semibold">Governance integrity details</summary>
        <p className="break-all font-mono text-xs">Revision checksum: {selected.revision_checksum}</p></details><label className="block">Decision note (optional)
      <textarea className={control} maxLength={10000} value={note} onChange={e=>setNote(e.target.value)}/></label><div className="flex gap-2">
      <button className={primary} disabled={busy} onClick={()=>void decide("APPROVED")}>Approve topic</button>
      <button className={button} disabled={busy} onClick={()=>void decide("REJECTED")}>Reject topic</button></div>
      <p className="text-sm text-text-muted">This decision permits participant entry only. It does not verify attendance or award credit.</p></>:<p>Select a pending proposal to inspect its frozen revision.</p>}
    {message?<p role="status">{message}</p>:null}</section></div>;
}

function validIntervals(intervals:Interval[]){return intervals.length>0&&intervals.length<=32&&intervals.every((value,index)=>
  validInstant(value.starts_at)&&validInstant(value.ends_at)&&new Date(value.ends_at)>new Date(value.starts_at)&&
  (index===0||new Date(value.starts_at)>=new Date(intervals[index-1]!.ends_at)));}
function AttendanceIntervals({intervals,setIntervals}:{intervals:Interval[];setIntervals:(value:Interval[])=>void}){
  function change(index:number,field:keyof Interval,value:string){setIntervals(intervals.map((item,i)=>i===index?{...item,[field]:localDateTimeInstant(value)}:item));}
  return <div className="space-y-3"><h3 className="font-bold">Actual attendance intervals</h3>{intervals.map((interval,index)=><div
    className="grid gap-3 rounded-component border border-border p-3 sm:grid-cols-[1fr_1fr_auto]" key={index}>
    <label>Attendance start {index+1}<input className={control} type="datetime-local" value={localDateTimeValue(interval.starts_at)}
      onChange={event=>change(index,"starts_at",event.target.value)}/></label>
    <label>Attendance end {index+1}<input className={control} type="datetime-local" value={localDateTimeValue(interval.ends_at)}
      onChange={event=>change(index,"ends_at",event.target.value)}/></label>
    <button className={button} disabled={intervals.length===1} onClick={()=>setIntervals(intervals.filter((_,i)=>i!==index))}>Remove</button>
  </div>)}<button className={button} disabled={intervals.length>=32} onClick={()=>setIntervals([...intervals,{starts_at:"",ends_at:""}])}>
    Add attendance interval</button>{!validIntervals(intervals)?<p className="text-sm text-text-muted">Intervals must be complete, positive, ordered, and non-overlapping.</p>:null}</div>;
}

function ParticipantClaimDesk({facilityId}:{facilityId:string}) {
  const [claim,setClaim]=useState<import("./inserviceApi").ParticipantClaimDraft|null>(null);
  const [eventId,setEventId]=useState("");
  const [participant,setParticipant]=useState<{staff_member_id:string;facility_assignment_id:string}|null>(null);
  const [intervals,setIntervals]=useState<Interval[]>([{starts_at:"",ends_at:""}]);
  const [file,setFile]=useState<File|null>(null);
  const [accepted,setAccepted]=useState(false);
  const [submitted,setSubmitted]=useState<import("./inserviceApi").ClaimRevision|null>(null);
  const [message,setMessage]=useState("");const [busy,setBusy]=useState(false);const [refresh,setRefresh]=useState(0);
  const [now,setNow]=useState(()=>Date.now());
  const createCommand=useRef<PendingCommand>(null),uploadCommand=useRef<PendingCommand>(null),submitCommand=useRef<PendingCommand>(null);
  const approved=useQuery({queryKey:["inservice-approved-events",facilityId],queryFn:()=>inserviceApi.approvedEvents(facilityId),retry:false});
  const drafts=useQuery({queryKey:["inservice-claim-drafts",facilityId,refresh],queryFn:()=>inserviceApi.claimDrafts(facilityId),retry:false});
  const selected=approved.data?.events.find(event=>event.revision_id===eventId)??null;
  const eligibilityInterval=intervals[0];
  const eligible=useQuery({queryKey:["inservice-claim-eligible",facilityId,selected?.revision_id,
      eligibilityInterval?.starts_at,eligibilityInterval?.ends_at],
    queryFn:()=>inserviceApi.eligible(facilityId,eligibilityInterval!.starts_at,eligibilityInterval!.ends_at),
    enabled:!!selected&&!!eligibilityInterval&&validInstant(eligibilityInterval.starts_at)&&
      validInstant(eligibilityInterval.ends_at)&&new Date(eligibilityInterval.ends_at)>new Date(eligibilityInterval.starts_at),retry:false});
  const evidence=useQuery({queryKey:["inservice-claim-evidence",claim?.id,refresh],
    queryFn:()=>inserviceApi.claimEvidence(claim!.id),enabled:!!claim,retry:false});
  const claimTopic=claim?approved.data?.events.find(event=>event.revision_id===claim.event_revision_id)?.topic_title:null;
  const claimDate=claim?.intervals[0]?.starts_at?displayedDate(claim.intervals[0].starts_at):null;
  useEffect(()=>{const timer=window.setInterval(()=>setNow(Date.now()),30_000);return()=>window.clearInterval(timer);},[]);
  useEffect(()=>{setClaim(null);setEventId("");setParticipant(null);setIntervals([{starts_at:"",ends_at:""}]);
    setFile(null);setSubmitted(null);setMessage("");},[facilityId]);
  function selectEvent(revisionId:string){const event=approved.data?.events.find(item=>item.revision_id===revisionId);
    setEventId(revisionId);setParticipant(null);setIntervals(event?[{starts_at:event.starts_at,ends_at:event.ends_at}]:[{starts_at:"",ends_at:""}]);}
  async function createClaim(){if(!selected||!participant)return;setBusy(true);setMessage("");try{
    const body={event_id:selected.event_id,event_revision_id:selected.revision_id,
      staff_member_id:participant.staff_member_id,facility_assignment_id:participant.facility_assignment_id,intervals};
    const value=await inserviceApi.createClaim(body,commandKey(createCommand,JSON.stringify(body)));
    createCommand.current=null;setClaim(value);setRefresh(n=>n+1);setMessage("Participant claim Draft created. Evidence remains unverified.");
  }catch(error){setMessage(errorText(error));}finally{setBusy(false);}}
  async function saveAttendance(){if(!claim)return;setBusy(true);setMessage("");try{
    const value=await inserviceApi.updateClaim(claim.id,claim.revision,{event_id:claim.event_id,
      event_revision_id:claim.event_revision_id,staff_member_id:claim.staff_member_id,
      facility_assignment_id:claim.facility_assignment_id,intervals});
    setClaim(value);setMessage("Attendance Draft saved. No verified credit was created.");
  }catch(error){setMessage(errorText(error));}finally{setBusy(false);}}
  async function upload(){if(!claim||!file)return;setBusy(true);setMessage("");try{
    await inserviceApi.uploadClaimEvidence(claim.id,file,commandKey(uploadCommand,`${claim.id}:${file.name}:${file.size}:${file.lastModified}`));
    uploadCommand.current=null;setFile(null);setRefresh(n=>n+1);setMessage("Private evidence uploaded as UNSCANNED.");
  }catch(error){setMessage(errorText(error));}finally{setBusy(false);}}
  async function remove(fileId:string,revision:number){if(!claim)return;setBusy(true);setMessage("");try{
    await inserviceApi.removeClaimEvidence(claim.id,fileId,revision);setRefresh(n=>n+1);setMessage("Evidence removed from the Draft.");
  }catch(error){setMessage(errorText(error));}finally{setBusy(false);}}
  async function download(fileId:string,name:string){if(!claim)return;setMessage("");try{const value=await inserviceApi.downloadClaimEvidence(claim.id,fileId);
    const url=URL.createObjectURL(value.blob),anchor=document.createElement("a");anchor.href=url;anchor.download=value.filename??name;
    anchor.click();URL.revokeObjectURL(url);}catch(error){setMessage(errorText(error));}}
  async function submit(){if(!claim||!accepted)return;setBusy(true);setMessage("");try{const value=await inserviceApi.submitClaim(claim.id,claim.revision,
    commandKey(submitCommand,`${claim.id}:${claim.revision}`));submitCommand.current=null;setSubmitted(value);setClaim(null);
    setAccepted(false);setRefresh(n=>n+1);setMessage("Claim submitted with an immutable evidence manifest. Verified credit remains zero.");
  }catch(error){setMessage(errorText(error));}finally{setBusy(false);}}
  return <section className="space-y-4 rounded-panel border border-border bg-surface p-5 xl:col-span-2">
    <h2 className="text-lg font-bold">Participant hours and private evidence</h2>
    <p className="text-sm text-text-muted">Choose an OGI-approved topic, record actual attendance within its completion period, and optionally attach JPEG, PNG, or PDF evidence up to 10 MiB.</p>
    {!claim&&!submitted?<><label className="block">Approved topic<select className={control} value={eventId}
      onChange={e=>selectEvent(e.target.value)}><option value="">Select an approved topic</option>{approved.data?.events.map(event=><option
        key={event.revision_id} value={event.revision_id}>{event.topic_title} · {event.starts_at}</option>)}</select></label>
      {drafts.data?.drafts.length?<div><h3 className="text-sm font-bold">Or resume a saved claim Draft</h3><div className="mt-2 flex flex-wrap gap-2">{drafts.data.drafts.map((item,index)=>{
        const topic=approved.data?.events.find(event=>event.revision_id===item.event_revision_id)?.topic_title;
        const attendanceDate=item.intervals[0]?.starts_at?displayedDate(item.intervals[0].starts_at):null;
        const label=topic?`${topic}${attendanceDate?` · ${attendanceDate}`:""}`:`saved attendance Draft ${index+1}`;
        return <button className={button} key={item.id}
          onClick={()=>{setClaim(item);setIntervals(item.intervals);setSubmitted(null);setMessage("");}}>Resume {label}</button>;})}</div></div>:null}
      {selected?<><p className="text-sm text-text-muted">Attendance is shown in this device timezone ({deviceTimezone}). Enter actual training intervals, not the full topic period.</p>
      <AttendanceIntervals intervals={intervals} setIntervals={setIntervals}/>
        <div><h3 className="font-bold">Participant</h3>{eligible.data?.participants.map(choice=><button className={button}
          key={choice.facility_assignment_id} onClick={()=>setParticipant(choice)}>{choice.full_name} · {choice.duty_code??"Unclassified"}</button>)}</div>
        <button className={primary} disabled={busy||!participant||!validIntervals(intervals)}
          onClick={()=>void createClaim()}>Create participant claim Draft</button></>:null}</>:null}
    {claim?<div className="space-y-3"><p className="font-semibold">Attendance Draft{claimTopic?` · ${claimTopic}`:""}{claimDate?` · ${claimDate}`:""} · Revision {claim.revision}</p>
      <AttendanceIntervals intervals={intervals} setIntervals={setIntervals}/>
      <button className={button} disabled={busy||!validIntervals(intervals)} onClick={()=>void saveAttendance()}>Save attendance Draft</button>
      <p className="rounded-component border border-warning bg-warning/10 p-3 font-semibold">Attachments are private and UNSCANNED. Download only files you expect and trust.</p>
      <label className="block">Evidence file<input accept="image/jpeg,image/png,application/pdf" className={control} type="file"
        onChange={e=>setFile(e.target.files?.[0]??null)}/></label>
      <button className={button} disabled={busy||!file||file.size>10*1024*1024} onClick={()=>void upload()}>Upload private evidence</button>
      {file&&file.size>10*1024*1024?<p role="alert">The selected file exceeds the 10 MiB limit.</p>:null}
      <ul className="space-y-2">{evidence.data?.files.map(item=><li className="rounded-component border border-border p-3" key={item.id}>
        <p>{item.ordinal}. {item.original_file_name} · {(item.file_size_bytes/1024).toFixed(1)} KiB · UNSCANNED</p>
        <details><summary className="cursor-pointer text-sm">Technical integrity details</summary>
          <p className="break-all text-xs">SHA-256: {item.content_sha256}</p></details><button className={button} onClick={()=>void download(item.id,item.original_file_name)}>Download privately</button>
        <button className={button} disabled={busy} onClick={()=>void remove(item.id,item.revision)}>Remove from Draft</button></li>)}</ul>
      <label className="flex gap-2"><input checked={accepted} type="checkbox" onChange={e=>setAccepted(e.target.checked)}/>
        I reviewed the attendance and attachment list. Submission freezes their metadata but does not verify credit.</label>
      {unfinishedAttendanceEnd(intervals,now)!==null?<p role="status" className="text-sm text-text-muted">
        Attendance and evidence can be saved now. Submission becomes available after the recorded interval ending {displayedInstant(unfinishedAttendanceEnd(intervals,now)!)}.
      </p>:<p className="text-sm text-text-muted">All recorded attendance intervals have ended. The claim may now be submitted for OGI review.</p>}
      <button className={primary} disabled={busy||!accepted||unfinishedAttendanceEnd(intervals,now)!==null}
        onClick={()=>void submit()}>Submit participant claim</button></div>:null}
    {submitted?<div className="rounded-component border border-primary-blue p-3"><h3 className="font-bold">Submitted immutable evidence manifest</h3>
      <p>{submitted.snapshot_payload.evidence_manifest.files.length} attachment(s)</p>
      <details><summary className="cursor-pointer text-sm">Technical integrity details</summary><p>Manifest checksum: <code className="break-all">{submitted.snapshot_payload.evidence_manifest.integrity_checksum}</code></p></details>
      <p>Verification and monthly credit remain pending.</p></div>:null}
    {approved.isError||drafts.isError||eligible.isError||evidence.isError?<p role="alert">{errorText(approved.error??drafts.error??eligible.error??evidence.error)}</p>:null}
    {message?<p role="status">{message}</p>:null}
  </section>;
}

function ClaimHistoryDesk({facilityId}:{facilityId:string}){
  const [selected,setSelected]=useState<{claimId:string;revisionId:string}|null>(null);
  const [message,setMessage]=useState("");const [busy,setBusy]=useState(false);const [refresh,setRefresh]=useState(0);
  const correctionCommand=useRef<PendingCommand>(null);
  const history=useQuery({queryKey:["inservice-claim-history",facilityId,refresh],
    queryFn:()=>inserviceApi.claimHistory(facilityId),retry:false});
  const evidence=useQuery({queryKey:["inservice-submitted-evidence",selected?.claimId,selected?.revisionId],
    queryFn:()=>inserviceApi.submittedEvidence(selected!.claimId,selected!.revisionId),enabled:!!selected,retry:false});
  useEffect(()=>{setSelected(null);setMessage("");},[facilityId]);
  async function download(fileId:string,name:string){if(!selected)return;try{const value=await inserviceApi.downloadSubmittedEvidence(
    selected.claimId,selected.revisionId,fileId);const url=URL.createObjectURL(value.blob),anchor=document.createElement("a");
    anchor.href=url;anchor.download=value.filename??name;anchor.click();URL.revokeObjectURL(url);}catch(error){setMessage(errorText(error));}}
  async function correct(claimId:string,revisionId:string){setBusy(true);setMessage("");try{await inserviceApi.correctionClaim(claimId,revisionId,
    commandKey(correctionCommand,`${claimId}:${revisionId}`));correctionCommand.current=null;setRefresh(n=>n+1);
    setMessage("Correction Draft created. Prior review and credit are not inherited.");}catch(error){setMessage(errorText(error));}finally{setBusy(false);}}
  return <section className="space-y-4 rounded-panel border border-border bg-surface p-5"><h2 className="text-lg font-bold">Training history</h2>
    <p className="text-sm text-text-muted">Submitted attendance remains pending until separately reviewed by authorized OGI personnel.</p>
    {history.data?.has_more?<p role="status">More history exists than this page displays.</p>:null}
    <ul className="space-y-3">{history.data?.claims.map(item=><li className="rounded-component border border-border p-4" key={item.claim_revision_id}>
      <h3 className="font-bold">{item.topic.title} · {item.personnel.current_display_name}</h3>
      <p>Revision {item.revision_number} · {item.review.status} · {item.effective_verified_minutes} verified minutes</p>
      <p>{item.attendance_intervals.map(interval=>`${displayedInstant(interval.starts_at)} – ${displayedInstant(interval.ends_at)}`).join("; ")}</p>
      <p className="text-sm text-text-muted">Shown in this device timezone ({deviceTimezone}).</p>
      {item.review.review_note?<p>OGI review note: {item.review.review_note}</p>:null}
      <p>{item.evidence.file_count} evidence attachment(s) · <span className="font-semibold">UNSCANNED</span></p>
      <div className="flex flex-wrap gap-2"><button className={button} onClick={()=>setSelected({claimId:item.claim_id,revisionId:item.claim_revision_id})}>View evidence</button>
      {item.correction_available?<button className={button} disabled={busy} onClick={()=>void correct(item.claim_id,item.claim_revision_id)}>Create correction Draft</button>:null}</div>
    </li>)}</ul>
    {selected?<div className="rounded-component border border-warning p-3"><h3 className="font-bold">Frozen private evidence</h3>
      <p>Attachments are private and UNSCANNED. Download only expected files.</p><ul>{evidence.data?.files.map(file=><li key={file.id}>
        {file.original_file_name} · {(file.file_size_bytes/1024).toFixed(1)} KiB <button className={button}
          onClick={()=>void download(file.id,file.original_file_name)}>Download privately</button></li>)}</ul></div>:null}
    {history.isError||evidence.isError?<p role="alert">{errorText(history.error??evidence.error)}</p>:null}{message?<p role="status">{message}</p>:null}
  </section>;
}

function ClaimReviewDesk({facilityId}:{facilityId:string}){
  const [selected,setSelected]=useState<ClaimReview|null>(null);const [note,setNote]=useState("");
  const [message,setMessage]=useState("");const [busy,setBusy]=useState(false);const [refresh,setRefresh]=useState(0);
  const decisionCommand=useRef<PendingCommand>(null);
  const queue=useQuery({queryKey:["inservice-claim-review-queue",facilityId,refresh],
    queryFn:()=>inserviceApi.claimReviewQueue(facilityId),retry:false});
  const history=useQuery({queryKey:["inservice-review-history-display",facilityId,refresh],
    queryFn:()=>inserviceApi.claimHistory(facilityId),retry:false});
  const evidence=useQuery({queryKey:["inservice-review-evidence",selected?.claim_id,selected?.claim_revision_id],
    queryFn:()=>inserviceApi.submittedEvidence(selected!.claim_id,selected!.claim_revision_id),enabled:!!selected,retry:false});
  useEffect(()=>{setSelected(null);setNote("");setMessage("");},[facilityId]);
  async function inspect(claimId:string,revisionId:string){setMessage("");setNote("");try{setSelected(await inserviceApi.claimReview(claimId,revisionId));}
    catch(error){setMessage(errorText(error));}}
  async function decide(decision:"APPROVED"|"REJECTED"){if(!selected)return;setBusy(true);setMessage("");try{
    await inserviceApi.decideClaim(selected.claim_id,selected.claim_revision_id,decision,note.trim()||null,selected,
      commandKey(decisionCommand,`${selected.claim_revision_id}:${decision}:${note.trim()}`));decisionCommand.current=null;
    setSelected(null);setNote("");setRefresh(n=>n+1);setMessage(decision==="APPROVED"?
      "Attendance approved. Exact verified participant minutes were created.":"Attendance rejected. No verified minutes were created.");
  }catch(error){setMessage(errorText(error));}finally{setBusy(false);}}
  async function download(fileId:string,name:string){if(!selected)return;try{const value=await inserviceApi.downloadSubmittedEvidence(
    selected.claim_id,selected.claim_revision_id,fileId);const url=URL.createObjectURL(value.blob),anchor=document.createElement("a");
    anchor.href=url;anchor.download=value.filename??name;anchor.click();URL.revokeObjectURL(url);}catch(error){setMessage(errorText(error));}}
  return <div className="grid gap-5 xl:grid-cols-[1fr_2fr]"><section className="rounded-panel border border-border bg-surface p-5">
    <h2 className="text-lg font-bold">Attendance awaiting OGI review</h2><ul className="mt-3 space-y-2">{queue.data?.claims.map(item=>{
      const display=history.data?.claims.find(value=>value.claim_revision_id===item.claim_revision_id);return <li key={item.claim_revision_id}>
        <button className={button} onClick={()=>void inspect(item.claim_id,item.claim_revision_id)}>{display?.topic.title??"Training attendance"} · {display?.personnel.current_display_name??"Personnel name unavailable"} · {item.review_status}</button></li>;})}</ul>
    {queue.data?.has_more?<p role="status">More claims exist than this page displays.</p>:null}</section>
    <section className="space-y-4 rounded-panel border border-border bg-surface p-5"><h2 className="text-lg font-bold">Exact frozen participant claim</h2>
      {selected?<><p>Personnel: {history.data?.claims.find(value=>value.claim_revision_id===selected.claim_revision_id)?.personnel.current_display_name??"Personnel name unavailable"}</p>
      <ul>{selected.snapshot.intervals.map((interval,index)=><li key={index}>{displayedInstant(interval.starts_at)} – {displayedInstant(interval.ends_at)}</li>)}</ul>
      <p className="text-sm text-text-muted">Shown in this device timezone ({deviceTimezone}).</p>
      <details><summary className="cursor-pointer font-semibold">Governance integrity details</summary>
        <p>Evidence-manifest checksum: <code className="break-all">{selected.expected_evidence_manifest_checksum}</code></p></details>
      <p className="font-semibold">Private attachments are UNSCANNED.</p><ul>{evidence.data?.files.map(file=><li key={file.id}>{file.original_file_name}
        <button className={button} onClick={()=>void download(file.id,file.original_file_name)}>Download privately</button></li>)}</ul>
      {selected.review_status==="PENDING"?<><label className="block">Review note (optional)<textarea className={control} maxLength={4000}
        value={note} onChange={event=>setNote(event.target.value)}/></label><div className="flex gap-2"><button className={primary} disabled={busy}
        onClick={()=>void decide("APPROVED")}>Approve attendance</button><button className={button} disabled={busy}
        onClick={()=>void decide("REJECTED")}>Reject attendance</button></div></>:<p>Terminal review: {selected.review_status}</p>}</>:<p>Select a participant claim to inspect.</p>}
      {queue.isError||history.isError||evidence.isError?<p role="alert">{errorText(queue.error??history.error??evidence.error)}</p>:null}
      {message?<p role="status">{message}</p>:null}</section></div>;
}

function MonthlyDesk({ facilityId }: { facilityId: string }) {
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)).toISOString().slice(0, 7);
  });
  const [selected, setSelected] = useState<{ staff_member_id: string; full_name: string } | null>(null);
  const [evaluation, setEvaluation] = useState<MonthlyEvaluation | null>(null);
  const [feedback, setFeedback] = useState({ feedback: "", observations: "", recommended_follow_up: "" });
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const finalizeCommand = useRef<PendingCommand>(null);
  const [message, setMessage] = useState("");
  const [refresh, setRefresh] = useState(0);
  const targets = useQuery({ queryKey: ["inservice-monthly-targets", facilityId, month, refresh],
    queryFn: () => inserviceApi.targets(facilityId, month), retry: false });
  const progress = useQuery({ queryKey: ["inservice-progress", facilityId, month, selected?.staff_member_id, refresh],
    queryFn: () => inserviceApi.progress(selected?.staff_member_id ?? "", facilityId, month),
    enabled: !!selected, retry: false });
  useEffect(() => { setSelected(null); setEvaluation(null); setMessage(""); }, [facilityId, month]);
  const scope = selected ? { staff_member_id: selected.staff_member_id, facility_id: facilityId,
    local_month: month } : null;
  async function open() {
    if (!scope) return;
    setBusy(true); setMessage("");
    try { const value = await inserviceApi.openMonth(scope.staff_member_id, scope.facility_id, scope.local_month);
      setEvaluation(value); setFeedback({ feedback: value.feedback.feedback ?? "",
        observations: value.feedback.observations ?? "",
        recommended_follow_up: value.feedback.recommended_follow_up ?? "" });
      setAccepted(false); setRefresh((n) => n + 1);
    } catch (error) { setMessage(errorText(error)); } finally { setBusy(false); }
  }
  async function save() {
    if (!scope || !evaluation) return;
    setBusy(true); setMessage("");
    try { setEvaluation(await inserviceApi.saveFeedback(evaluation.determination.id, scope,
      evaluation.feedback.version, feedback.feedback, feedback.observations, feedback.recommended_follow_up));
      setMessage("Evaluator feedback saved. System-calculated facts remain unchanged.");
    } catch (error) { setMessage(errorText(error)); } finally { setBusy(false); }
  }
  async function finalize() {
    if (!scope || !evaluation || !accepted) return;
    setBusy(true); setMessage("");
    try { setEvaluation(await inserviceApi.finalizeMonth(evaluation.determination.id, scope,
      evaluation.determination.integrity_checksum, evaluation.feedback.version,
      commandKey(finalizeCommand, `${evaluation.determination.id}:${evaluation.determination.integrity_checksum}:${evaluation.feedback.version}`)));
      finalizeCommand.current = null;
      setAccepted(false); setMessage("Monthly evaluator review finalized."); setRefresh((n) => n + 1);
    } catch (error) { setMessage(errorText(error)); } finally { setBusy(false); }
  }
  return <section className="space-y-4 rounded-panel border border-border bg-surface p-5">
    <h2 className="text-lg font-bold">Facility-local monthly evaluation</h2>
    <p className="text-sm text-text-muted">The next month continues independently. Only a closed month may be frozen for review.</p>
    <label className="block">Calendar month<input className={control} type="month" onChange={(e) => setMonth(e.target.value)} value={month} /></label>
    {targets.isError ? <p role="alert">{errorText(targets.error)}</p> : null}
    {targets.data?.has_more ? <p role="status">More Personnel exist than this page displays.</p> : null}
    <ul className="space-y-2">{targets.data?.targets.map((target) => <li key={target.staff_member_id}>
      <button className={button} onClick={() => { setSelected(target); setEvaluation(null); setMessage(""); }}>
        {target.full_name} · stored review: {target.stored_review_status}</button></li>)}</ul>
    {selected ? <div className="rounded-component border border-border p-4">
      <h3 className="font-bold">{selected.full_name}</h3>
      {progress.isError ? <p role="alert">{errorText(progress.error)}</p> : null}
      {progress.data ? <p>Provisional: {progress.data.applicability} · {progress.data.verified_minutes} verified minutes ·
        requirement {progress.data.required_minutes ?? "not applicable"} · {progress.data.progress_status}</p> : null}
      <button className={primary} disabled={busy} onClick={() => void open()}>Open or refresh system determination</button>
      {evaluation ? <div className="mt-4 space-y-3">
        <p className="font-semibold">{evaluation.status} · {evaluation.determination.applicability} ·
          {Number(evaluation.determination.verified_microseconds) / 60_000_000} verified minutes ·
          {evaluation.determination.calculated_outcome}</p>
        <p className="text-sm">Required: {evaluation.determination.required_minutes ?? "not applicable"}. Calculated fields are read-only.</p>
        <details><summary>Exact determination provenance</summary><pre className="overflow-x-auto text-xs">{
          JSON.stringify({ assignment_references: evaluation.determination.assignment_references,
            credit_references: evaluation.determination.credit_references,
            checksum: evaluation.determination.integrity_checksum }, null, 2)}</pre></details>
        {evaluation.status !== "FINALIZED" ? <>
          {(["feedback", "observations", "recommended_follow_up"] as const).map((field) =>
            <label className="block" key={field}>{field.replaceAll("_", " ")}
              <textarea className={control} onChange={(e) => setFeedback({ ...feedback, [field]: e.target.value })}
                value={feedback[field]} /></label>)}
          <button className={button} disabled={busy} onClick={() => void save()}>Save feedback</button>
          <label className="flex gap-2"><input checked={accepted} onChange={(e) => setAccepted(e.target.checked)}
            type="checkbox" />I reviewed this exact frozen calculation, provenance, and feedback.</label>
          <button className={primary} disabled={busy || !accepted ||
            feedback.feedback !== (evaluation.feedback.feedback ?? "") ||
            feedback.observations !== (evaluation.feedback.observations ?? "") ||
            feedback.recommended_follow_up !== (evaluation.feedback.recommended_follow_up ?? "")}
            onClick={() => void finalize()}>Finalize review</button>
        </> : <p>Finalized feedback is immutable. Later evidence corrections require a new determination and review.</p>}
      </div> : null}
    </div> : null}
    {message ? <p role="status">{message}</p> : null}
  </section>;
}
