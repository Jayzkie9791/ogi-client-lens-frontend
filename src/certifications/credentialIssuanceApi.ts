import { apiRequest } from "../api/client";
import {
  CredentialIssuanceResponse,
  isCredentialIssuanceResponse
} from "../credentials/credentialsApi";

export interface CredentialIssuanceListResponse {
  readonly issuances: readonly CredentialIssuanceResponse[];
}

export interface IssueCredentialRequest {
  readonly certification_id: string;
  readonly source_evidence_record_id: string;
  readonly source_authorization_id?: string;
  readonly completion_date: string;
  readonly training_location: string;
  readonly instructor: string;
  readonly training_center: string;
}

export function listCredentialIssuancesByCertification(certificationId: string) {
  const searchParams = new URLSearchParams({ certificationId });

  return apiRequest<CredentialIssuanceListResponse>(
    `/api/v1/credentials/issuances?${searchParams.toString()}`,
    {
      validate: isCredentialIssuanceListResponse
    }
  );
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

function isCredentialIssuanceListResponse(
  value: unknown
): value is CredentialIssuanceListResponse {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Array.isArray((value as { readonly issuances?: unknown }).issuances) &&
    (value as { readonly issuances: readonly unknown[] }).issuances.every(
      isCredentialIssuanceResponse
    )
  );
}
