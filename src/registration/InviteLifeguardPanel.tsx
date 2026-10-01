import {FormEvent,useEffect,useMemo,useState} from "react";
import {useMutation,useQuery,useQueryClient} from "@tanstack/react-query";
import {Button} from "../ui/components/Button";
import {RegistrationClient} from "./registrationClientApi";
import {listRegistrationFacilities} from "./registrationFacilityApi";
import {issuePersonnelRegistrationInvitation,listPersonnelRegistrationInvitations,revokePersonnelRegistrationInvitation} from "./personnelRegistrationInvitationApi";

export function InviteLifeguardPanel({clients,initialClientId=""}:{clients:RegistrationClient[];initialClientId?:string}){
  const queryClient=useQueryClient(),[open,setOpen]=useState(false),[clientId,setClientId]=useState(initialClientId),[facilityId,setFacilityId]=useState("");
  const[fullName,setFullName]=useState(""),[email,setEmail]=useState(""),[assignedFrom,setAssignedFrom]=useState(""),[activationLink,setActivationLink]=useState<string|null>(null),[notice,setNotice]=useState<string|null>(null);
  useEffect(()=>{if(initialClientId)setClientId(initialClientId)},[initialClientId]);
  const facilities=useQuery({queryKey:["registration-facilities",clientId,"invite-first"],queryFn:()=>listRegistrationFacilities({clientId}),enabled:open&&Boolean(clientId),retry:false});
  const history=useQuery({queryKey:["personnel-registration-invitations",clientId,facilityId],queryFn:()=>listPersonnelRegistrationInvitations(clientId,facilityId||undefined),enabled:open&&Boolean(clientId),retry:false});
  const live=useMemo(()=>history.data?.invitations.find(item=>item.status==="ISSUED")??null,[history.data]);
  const issue=useMutation({mutationFn:()=>issuePersonnelRegistrationInvitation({client_id:clientId,facility_id:facilityId,full_name:fullName.trim(),email:email.trim(),assigned_from:assignedFrom},crypto.randomUUID()),onSuccess:result=>{
    void queryClient.invalidateQueries({queryKey:["personnel-registration-invitations",clientId]});
    if(result.activation_token){setActivationLink(`${window.location.origin}/activate-personnel-account?registration_token=${encodeURIComponent(result.activation_token)}`);setNotice("Invitation created. Copy this one-time registration link before closing it.")}
    else{setNotice("The invitation already exists, but its one-time link is no longer available.");setActivationLink(null);}}});
  const revoke=useMutation({mutationFn:(id:string)=>revokePersonnelRegistrationInvitation(id),onSuccess:()=>{setActivationLink(null);setNotice("Invitation revoked.");void queryClient.invalidateQueries({queryKey:["personnel-registration-invitations",clientId]})}});
  function submit(event:FormEvent){event.preventDefault();setNotice(null);issue.mutate()}
  async function copy(){if(!activationLink)return;try{await navigator.clipboard.writeText(activationLink);setNotice("Registration link copied.")}catch{setNotice("Clipboard access failed. Select and copy the link manually.")}}
  if(!open)return <div><Button onClick={()=>setOpen(true)}>Invite New Lifeguard</Button></div>;
  return <section aria-label="Invite New Lifeguard" className="rounded-component border border-blue-200 bg-blue-50/60 p-4">
    <div className="flex items-start justify-between gap-3"><div><h2 className="text-lg font-bold text-primary-navy">Invite New Lifeguard</h2><p className="mt-1 text-sm text-text-muted">Freeze the person, Facility, and first covered workday. No Personnel or account is created until activation.</p></div><Button onClick={()=>{setOpen(false);setActivationLink(null)}} variant="secondary">Close</Button></div>
    <form className="mt-4 grid gap-3 md:grid-cols-2" onSubmit={submit}>
      <label className="text-sm font-semibold">Client<select className={inputClass} onChange={event=>{setClientId(event.currentTarget.value);setFacilityId("")}} required value={clientId}><option value="">Select Client</option>{clients.map(client=><option key={client.id} value={client.id}>{client.organization_name}</option>)}</select></label>
      <label className="text-sm font-semibold">Facility<select className={inputClass} disabled={!clientId||facilities.isLoading} onChange={event=>setFacilityId(event.currentTarget.value)} required value={facilityId}><option value="">Select Facility</option>{facilities.data?.facilities.map(facility=><option key={facility.id} value={facility.id}>{facility.facility_name}</option>)}</select></label>
      <label className="text-sm font-semibold">Full name<input className={inputClass} maxLength={255} onChange={event=>setFullName(event.currentTarget.value)} required value={fullName}/></label>
      <label className="text-sm font-semibold">Email<input className={inputClass} maxLength={255} onChange={event=>setEmail(event.currentTarget.value)} required type="email" value={email}/></label>
      <label className="text-sm font-semibold">Assignment effective date<input className={inputClass} onChange={event=>setAssignedFrom(event.currentTarget.value)} required type="date" value={assignedFrom}/></label>
      <div className="rounded-component border border-blue-100 bg-white p-3 text-sm"><p><strong>Account role:</strong> Lifeguard</p><p><strong>Governed duty:</strong> Operational Lifeguard</p><p><strong>Position:</strong> Lifeguard</p></div>
      <div className="md:col-span-2"><Button disabled={issue.isPending||!clientId||!facilityId||!fullName.trim()||!email.trim()||!assignedFrom} type="submit">Generate invitation link</Button></div>
    </form>
    {notice?<p className="mt-3 text-sm font-semibold" role="status">{notice}</p>:null}
    {activationLink?<div className="mt-3"><label className="text-sm font-semibold" htmlFor="invite-first-link">One-time registration link</label><input className={inputClass} id="invite-first-link" readOnly value={activationLink}/><div className="mt-2 flex gap-2"><Button onClick={copy}>Copy registration link</Button><Button onClick={()=>setActivationLink(null)} variant="secondary">Close one-time link</Button></div></div>:null}
    {live&&!activationLink?<div className="mt-3 flex items-center gap-3 text-sm"><span>Current invitation: {live.full_name} · {live.email}</span><Button disabled={revoke.isPending} onClick={()=>revoke.mutate(live.id)} variant="secondary">Revoke invitation</Button></div>:null}
    {issue.isError||history.isError||revoke.isError?<p className="mt-3 text-sm text-state-error" role="alert">The invitation could not be completed. Check for an existing account or Personnel record and verify your authorized scope.</p>:null}
  </section>;
}
const inputClass="mt-1 w-full rounded-component border border-blue-200 bg-white px-3 py-2";
