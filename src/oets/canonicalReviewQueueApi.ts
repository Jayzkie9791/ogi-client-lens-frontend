import { apiRequest } from "../api/client";

export interface CanonicalReviewQueueItem {
  evidence_record_id: string;
  template: { version_id: string; code: string; version: string; checksum: string };
  payload_checksum: string;
  client: { id: string; name: string };
  facility: { id: string; name: string };
  creator: { user_id: string | null; name: string | null };
  assessor: { user_id: string; name: string; business_identifier: string; signed_at: string };
  created_at: string;
  updated_at: string;
  status: "AWAITING_REVIEWER";
}

export interface CanonicalReviewQueueResponse {
  items: CanonicalReviewQueueItem[];
  pagination: { limit: number; offset: number; count: number; total_count: number };
}

export function listCanonicalReviewQueue(input: { limit?: number; offset?: number } = {}) {
  const query = new URLSearchParams();
  if (input.limit !== undefined) query.set("limit", String(input.limit));
  if (input.offset !== undefined) query.set("offset", String(input.offset));
  const suffix=query.toString();
  return apiRequest<CanonicalReviewQueueResponse>(`/api/v1/operational-evidence/canonical-review-queue${suffix?`?${suffix}`:""}`,{validate:isResponse});
}

function isResponse(value:unknown):value is CanonicalReviewQueueResponse{
  if(!record(value)||!Array.isArray(value.items)||!value.items.every(isItem)||!record(value.pagination))return false;
  const page=value.pagination;
  return [page.limit,page.offset,page.count,page.total_count].every(item=>typeof item==="number");
}
function isItem(value:unknown):value is CanonicalReviewQueueItem{
  return record(value)&&typeof value.evidence_record_id==="string"&&value.status==="AWAITING_REVIEWER"&&
    record(value.template)&&typeof value.template.version_id==="string"&&typeof value.template.code==="string"&&typeof value.template.version==="string"&&typeof value.template.checksum==="string"&&
    typeof value.payload_checksum==="string"&&record(value.client)&&typeof value.client.id==="string"&&typeof value.client.name==="string"&&
    record(value.facility)&&typeof value.facility.id==="string"&&typeof value.facility.name==="string"&&record(value.creator)&&
    (typeof value.creator.user_id==="string"||value.creator.user_id===null)&&(typeof value.creator.name==="string"||value.creator.name===null)&&
    record(value.assessor)&&typeof value.assessor.user_id==="string"&&typeof value.assessor.name==="string"&&typeof value.assessor.business_identifier==="string"&&typeof value.assessor.signed_at==="string"&&
    typeof value.created_at==="string"&&typeof value.updated_at==="string";
}
function record(value:unknown):value is Record<string,unknown>{return typeof value==="object"&&value!==null&&!Array.isArray(value);}
