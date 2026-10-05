import type { EvidenceAttestation } from "./attestationApi";
import type { OetsField } from "./types";

const numberFieldId="00000000-0000-4000-8000-000001048248";
const signatureFieldId="00000000-0000-4000-8000-000001048249";

export function isF048CredentialOfficerNumberProjection(field:OetsField){
  return field.field_id===numberFieldId&&field.field_code==="CREDENTIAL_OFFICER_NUMBER";
}

export function projectF048CredentialOfficerNumber(attestations:readonly EvidenceAttestation[],sectionInstanceIndex:number|null){
  const current=attestations.find((item)=>item.status==="CURRENT"&&item.signature_field_id===signatureFieldId&&item.section_instance_index===sectionInstanceIndex);
  return current?.subject_business_identifier_snapshot ?? null;
}
