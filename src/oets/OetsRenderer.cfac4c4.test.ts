import { describe, expect, it } from "vitest";
import type { EvidenceAttestation } from "./attestationApi";
import { isF048CredentialOfficerNumberProjection, projectF048CredentialOfficerNumber } from "./f048CredentialOfficerProjection";

const numberField={field_id:"00000000-0000-4000-8000-000001048248",field_code:"CREDENTIAL_OFFICER_NUMBER"} as never;
const attestation={status:"CURRENT",signature_field_id:"00000000-0000-4000-8000-000001048249",section_instance_index:null,subject_business_identifier_snapshot:"OGI-STAFF-0042"} as EvidenceAttestation;

describe("CFAC-4C4 F048 Credential Officer projection",()=>{
  it("projects the exact governed OGI Personnel number snapshot and makes the field read-only",()=>{
    expect(isF048CredentialOfficerNumberProjection(numberField)).toBe(true);
    expect(projectF048CredentialOfficerNumber([attestation],null)).toBe("OGI-STAFF-0042");
  });
  it("fails closed when no current exact Credential Officer attestation exists",()=>{
    expect(projectF048CredentialOfficerNumber([],null)).toBeNull();
    expect(projectF048CredentialOfficerNumber([{...attestation,status:"STALE"}],null)).toBeNull();
  });
});
