import { apiRequest } from "../api/client";
import {
  CredentialIssuanceResponse,
  isCredentialIssuanceResponse
} from "../credentials/credentialsApi";

export interface IssueCredentialRequest {
  readonly certification_id: string;
  readonly source_evidence_record_id: string;
  readonly source_authorization_id?: string;
  readonly completion_date: string;
  readonly training_location: string;
  readonly instructor: string;
  readonly training_center: string;
}

export function issueCredential(payload: IssueCredentialRequest) {
  return apiRequest<CredentialIssuanceResponse>(
    "/api/v1/credentials/issuances",
    {
      method: "POST",
      body: payload,
      validate: isCredentialIssuanceResponse
    }
  );
}
