import {apiRequest} from "../api/client";

export type PersonnelRegistrationInvitationStatus="ISSUED"|"REVOKED"|"CONSUMED"|"EXPIRED";
export interface PersonnelRegistrationInvitation{id:string;client_id:string;facility_id:string;full_name:string;email:string;assigned_from:string;
  role_name:"CLIENT_LIFEGUARD";duty_code:"OPERATIONAL_LIFEGUARD";position_title:"Lifeguard";status:PersonnelRegistrationInvitationStatus;
  issued_by_user_id:string;issued_at:string;expires_at:string;consumed_at:string|null;revoked_at:string|null;
  superseded_by_invitation_id:string|null;integrity_checksum:string}
export interface IssuePersonnelRegistrationInvitationRequest{client_id:string;facility_id:string;full_name:string;email:string;assigned_from:string}
export interface IssuePersonnelRegistrationInvitationResult{invitation:PersonnelRegistrationInvitation;activation_token:string|null;idempotent_replay:boolean}
export interface PersonnelRegistrationInvitationList{client_id:string;facility_id:string|null;status:PersonnelRegistrationInvitationStatus|null;invitations:PersonnelRegistrationInvitation[]}

export function issuePersonnelRegistrationInvitation(request:IssuePersonnelRegistrationInvitationRequest,idempotencyKey:string){return apiRequest<IssuePersonnelRegistrationInvitationResult>(
  "/api/v1/admin/personnel-registration-invitations",{method:"POST",headers:{"Idempotency-Key":idempotencyKey},body:request,validate:isIssue});}
export function listPersonnelRegistrationInvitations(clientId:string,facilityId?:string){const query=new URLSearchParams({client_id:clientId});if(facilityId)query.set("facility_id",facilityId);
  return apiRequest<PersonnelRegistrationInvitationList>(`/api/v1/admin/personnel-registration-invitations?${query}`,{validate:isList});}
export function revokePersonnelRegistrationInvitation(id:string){return apiRequest<{invitation:PersonnelRegistrationInvitation;unchanged:boolean}>(
  `/api/v1/admin/personnel-registration-invitations/${encodeURIComponent(id)}/revoke`,{method:"POST",validate:isRevoke});}

function record(value:unknown):value is Record<string,unknown>{return typeof value==="object"&&value!==null}
function nullableString(value:unknown){return value===null||typeof value==="string"}
function isInvitation(value:unknown):value is PersonnelRegistrationInvitation{return record(value)&&typeof value.id==="string"&&typeof value.client_id==="string"&&
  typeof value.facility_id==="string"&&typeof value.full_name==="string"&&typeof value.email==="string"&&typeof value.assigned_from==="string"&&
  value.role_name==="CLIENT_LIFEGUARD"&&value.duty_code==="OPERATIONAL_LIFEGUARD"&&value.position_title==="Lifeguard"&&
  ["ISSUED","REVOKED","CONSUMED","EXPIRED"].includes(String(value.status))&&typeof value.issued_at==="string"&&typeof value.expires_at==="string"&&
  nullableString(value.consumed_at)&&nullableString(value.revoked_at)&&nullableString(value.superseded_by_invitation_id)&&typeof value.integrity_checksum==="string"}
function isIssue(value:unknown):value is IssuePersonnelRegistrationInvitationResult{return record(value)&&isInvitation(value.invitation)&&nullableString(value.activation_token)&&typeof value.idempotent_replay==="boolean"}
function isList(value:unknown):value is PersonnelRegistrationInvitationList{return record(value)&&typeof value.client_id==="string"&&nullableString(value.facility_id)&&
  (value.status===null||["ISSUED","REVOKED","CONSUMED","EXPIRED"].includes(String(value.status)))&&Array.isArray(value.invitations)&&value.invitations.every(isInvitation)}
function isRevoke(value:unknown):value is {invitation:PersonnelRegistrationInvitation;unchanged:boolean}{return record(value)&&isInvitation(value.invitation)&&typeof value.unchanged==="boolean"}
