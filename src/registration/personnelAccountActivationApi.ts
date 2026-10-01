import {apiRequest} from "../api/client";

export type PersonnelActivationStatus="ISSUED"|"REVOKED"|"CONSUMED"|"EXPIRED";
export interface PersonnelActivationInvitation{id:string;personnel_id:string;client_id:string;email:string;status:PersonnelActivationStatus;
  issued_at:string;expires_at:string;consumed_at:string|null;revoked_at:string|null;superseded_by_invitation_id:string|null;
  issued_by_user_id:string;integrity_checksum:string}
export interface PersonnelActivationInvitationList{client_id:string;personnel_id:string|null;invitations:PersonnelActivationInvitation[]}
export interface PersonnelActivationIssueResult{invitation:PersonnelActivationInvitation;activation_token:string|null;idempotent_replay:boolean}
export interface PersonnelActivationRevokeResult{invitation:PersonnelActivationInvitation;unchanged:boolean}

export function listPersonnelActivationInvitations(clientId:string,personnelId:string){const query=new URLSearchParams({client_id:clientId,personnel_id:personnelId});
  return apiRequest<PersonnelActivationInvitationList>(`/api/v1/admin/personnel-account-activations/invitations?${query}`,{validate:isList});}
export function issuePersonnelActivationInvitation(personnelId:string,idempotencyKey:string){return apiRequest<PersonnelActivationIssueResult>(
  "/api/v1/admin/personnel-account-activations/invitations",{method:"POST",headers:{"Idempotency-Key":idempotencyKey},body:{personnel_id:personnelId},validate:isIssue});}
export function revokePersonnelActivationInvitation(invitationId:string){return apiRequest<PersonnelActivationRevokeResult>(
  `/api/v1/admin/personnel-account-activations/invitations/${encodeURIComponent(invitationId)}/revoke`,{method:"POST",validate:isRevoke});}

function record(value:unknown):value is Record<string,unknown>{return typeof value==="object"&&value!==null}
function nullable(value:unknown){return value===null||typeof value==="string"}
function isInvitation(value:unknown):value is PersonnelActivationInvitation{return record(value)&&typeof value.id==="string"&&typeof value.personnel_id==="string"&&
  typeof value.client_id==="string"&&typeof value.email==="string"&&["ISSUED","REVOKED","CONSUMED","EXPIRED"].includes(String(value.status))&&
  typeof value.issued_at==="string"&&typeof value.expires_at==="string"&&nullable(value.consumed_at)&&nullable(value.revoked_at)&&
  nullable(value.superseded_by_invitation_id)&&typeof value.issued_by_user_id==="string"&&typeof value.integrity_checksum==="string"}
function isList(value:unknown):value is PersonnelActivationInvitationList{return record(value)&&typeof value.client_id==="string"&&nullable(value.personnel_id)&&
  Array.isArray(value.invitations)&&value.invitations.every(isInvitation)}
function isIssue(value:unknown):value is PersonnelActivationIssueResult{return record(value)&&isInvitation(value.invitation)&&nullable(value.activation_token)&&typeof value.idempotent_replay==="boolean"}
function isRevoke(value:unknown):value is PersonnelActivationRevokeResult{return record(value)&&isInvitation(value.invitation)&&typeof value.unchanged==="boolean"}
