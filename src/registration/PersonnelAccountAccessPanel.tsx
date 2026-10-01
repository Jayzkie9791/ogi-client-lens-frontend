import {useEffect,useMemo,useState} from "react";
import {useMutation,useQuery,useQueryClient} from "@tanstack/react-query";
import {Button} from "../ui/components/Button";
import {RegistrationPersonnel} from "./registrationPersonnelApi";
import {RegistrationFacilityAssignment} from "./registrationFacilityAssignmentApi";
import {issuePersonnelActivationInvitation,listPersonnelActivationInvitations,revokePersonnelActivationInvitation} from "./personnelAccountActivationApi";

export function PersonnelAccountAccessPanel({personnel,assignments}:{personnel:RegistrationPersonnel;assignments:RegistrationFacilityAssignment[]}){
  const queryClient=useQueryClient(),clientId=personnel.client_id;
  const[activationLink,setActivationLink]=useState<string|null>(null),[notice,setNotice]=useState<string|null>(null),[copyError,setCopyError]=useState(false);
  useEffect(()=>{setActivationLink(null);setNotice(null);setCopyError(false)},[personnel.id]);
  const query=useQuery({queryKey:["personnel-activation-invitations",clientId,personnel.id],queryFn:()=>listPersonnelActivationInvitations(clientId!,personnel.id),enabled:Boolean(clientId)&&!personnel.user_id,retry:false});
  const current=query.data?.invitations[0]??null;
  const blockers=useMemo(()=>eligibilityBlockers(personnel,assignments),[personnel,assignments]);
  const issue=useMutation({mutationFn:()=>issuePersonnelActivationInvitation(personnel.id,crypto.randomUUID()),onSuccess:result=>{
    setCopyError(false);void queryClient.invalidateQueries({queryKey:["personnel-activation-invitations",clientId,personnel.id]});
    if(result.activation_token){setActivationLink(`${window.location.origin}/activate-personnel-account?token=${encodeURIComponent(result.activation_token)}`);setNotice("Invitation issued. Copy this one-time activation link before closing it.")}
    else{setActivationLink(null);setNotice("This invitation was already issued, but its one-time link is no longer available. Generate a replacement link if another copy is required.")}
  }});
  const revoke=useMutation({mutationFn:(id:string)=>revokePersonnelActivationInvitation(id),onSuccess:()=>{setActivationLink(null);setNotice("Invitation revoked.");void queryClient.invalidateQueries({queryKey:["personnel-activation-invitations",clientId,personnel.id]})}});
  async function copy(){if(!activationLink)return;try{await navigator.clipboard.writeText(activationLink);setCopyError(false);setNotice("Activation link copied.")}catch{setCopyError(true)}}
  if(personnel.user_id)return <section className="rounded-component border border-emerald-200 bg-emerald-50 p-4" aria-label="Account access"><h3 className="font-semibold text-emerald-900">Account access: Active</h3><p className="mt-1 text-sm text-emerald-900">This Personnel record is linked to a Client Lens User account.</p></section>;
  return <section className="rounded-component border border-blue-200 bg-blue-50/60 p-4" aria-label="Account access">
    <h3 className="font-semibold text-primary-navy">Account access</h3>
    {blockers.length?<><p className="mt-2 text-sm text-text-muted">An activation invitation cannot be issued until:</p><ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-text-muted">{blockers.map(item=><li key={item}>{item}</li>)}</ul></>:null}
    {!blockers.length&&query.isLoading?<p className="mt-2 text-sm text-text-muted" role="status">Loading invitation status.</p>:null}
    {!blockers.length&&current?<div className="mt-3 text-sm"><p><strong>Status:</strong> {current.status}</p><p><strong>Issued:</strong> {new Date(current.issued_at).toLocaleString()}</p><p><strong>Expires:</strong> {new Date(current.expires_at).toLocaleString()}</p></div>:null}
    {notice?<p className="mt-3 text-sm font-semibold text-primary-navy" role="status">{notice}</p>:null}
    {activationLink?<div className="mt-3"><label className="text-sm font-semibold text-primary-navy" htmlFor={`activation-link-${personnel.id}`}>One-time activation link</label><input className="mt-2 w-full rounded-component border border-blue-200 bg-white px-3 py-2 text-sm" id={`activation-link-${personnel.id}`} readOnly value={activationLink}/><div className="mt-2 flex gap-2"><Button onClick={copy}>Copy activation link</Button><Button onClick={()=>setActivationLink(null)} variant="secondary">Close one-time link</Button></div>{copyError?<p className="mt-2 text-sm text-state-error" role="alert">Clipboard access failed. Select and copy the link manually.</p>:null}</div>:null}
    {!blockers.length&&!activationLink?<div className="mt-3 flex flex-wrap gap-2"><Button disabled={issue.isPending||query.isLoading} onClick={()=>issue.mutate()}>{current?.status==="ISSUED"?"Generate replacement link":"Issue activation invitation"}</Button>{current?.status==="ISSUED"?<Button disabled={revoke.isPending} onClick={()=>revoke.mutate(current.id)} variant="secondary">Revoke invitation</Button>:null}</div>:null}
    {issue.isError||revoke.isError||query.isError?<p className="mt-3 text-sm text-state-error" role="alert">Account activation administration could not be completed. Verify the Personnel eligibility and your authorized scope.</p>:null}
  </section>;
}

function eligibilityBlockers(personnel:RegistrationPersonnel,assignments:RegistrationFacilityAssignment[]){const result:string[]=[];
  if(personnel.employment_status!=="ACTIVE")result.push("Personnel status must be ACTIVE.");if(!personnel.email?.trim())result.push("A Personnel email is required.");
  if(!personnel.client_employee_number?.trim())result.push("A Personnel employee number is required.");
  const today=localDate();if(!assignments.some(a=>!a.deleted_at&&a.assignment_status==="ACTIVE"&&a.duty_code==="OPERATIONAL_LIFEGUARD"&&a.assigned_from<=today&&(!a.assigned_to||a.assigned_to>=today)))
    result.push("A current governed Operational Lifeguard Facility Assignment is required.");return result;}
function localDate(){const now=new Date(),pad=(value:number)=>String(value).padStart(2,"0");return `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}`}
