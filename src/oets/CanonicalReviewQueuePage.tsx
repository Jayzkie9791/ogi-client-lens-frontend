import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import { Button } from "../ui/components/Button";
import { Surface } from "../ui/components/Surface";
import { formatEvidenceDateTime, humanizeEvidenceTemplateCode } from "./evidencePresentation";
import { evidencePathWithReturn } from "./evidenceReturnContext";
import { listCanonicalReviewQueue } from "./canonicalReviewQueueApi";

const pageSize=25;

export function CanonicalReviewQueuePage(){
  const auth=useAuth();
  const [offset,setOffset]=useState(0);
  const authorized=auth.canUsePermission("review_operational_assessment")&&auth.canUsePermission("view_operational_evidence");
  const query=useQuery({enabled:authorized,queryKey:["canonical-review-queue",offset],queryFn:()=>listCanonicalReviewQueue({limit:pageSize,offset}),retry:false});
  if(!authorized)return <QueueState title="Reviewer authority unavailable.">This workspace requires governed Operational Evidence review authority.</QueueState>;
  if(query.isLoading)return <QueueState title="Loading drafts awaiting review." role="status">Please wait.</QueueState>;
  if(query.isError)return <QueueState title="The reviewer queue is unavailable." role="alert"><Button className="mt-3" onClick={()=>query.refetch()} variant="secondary">Retry</Button></QueueState>;
  const items=query.data?.items??[],page=query.data?.pagination;
  return <section aria-labelledby="canonical-review-queue-heading" className="space-y-4">
    <header><p className="text-xs font-semibold uppercase tracking-wide text-primary-blue">Canonical assessment authority</p><h1 className="mt-2 text-2xl font-semibold text-text-primary" id="canonical-review-queue-heading">Awaiting My Review</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-text-muted">Review saved Draft payloads assessed by another eligible person. Opening an item from this queue is read-only; reviewing never grants editing authority.</p></header>
    {items.length===0?<Surface><h2 className="font-semibold text-text-primary">No Drafts are awaiting your review.</h2><p className="mt-2 text-sm text-text-muted">A Draft appears here after a different eligible Assessor attests to its exact saved payload.</p></Surface>:
      <ul aria-label="Drafts awaiting canonical review" className="space-y-3">{items.map(item=><li key={item.evidence_record_id}><Surface><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start"><div><div className="flex flex-wrap items-center gap-2"><h2 className="font-semibold text-primary-navy">{humanizeEvidenceTemplateCode(item.template.code)}</h2><span className="rounded-full border border-blue-300 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-primary-blue">Awaiting reviewer</span></div><p className="mt-1 text-sm text-text-muted">{item.client.name} · {item.facility.name} · Version {item.template.version}</p><dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2"><div><dt className="text-xs font-semibold uppercase text-text-muted">Assessor</dt><dd>{item.assessor.name} · {item.assessor.business_identifier}</dd></div><div><dt className="text-xs font-semibold uppercase text-text-muted">Assessed</dt><dd>{formatEvidenceDateTime(item.assessor.signed_at)}</dd></div><div><dt className="text-xs font-semibold uppercase text-text-muted">Draft owner</dt><dd>{item.creator.name??"Unavailable"}</dd></div><div><dt className="text-xs font-semibold uppercase text-text-muted">Last saved</dt><dd>{formatEvidenceDateTime(item.updated_at)}</dd></div></dl></div><Button asChild><Link to={evidencePathWithReturn(item.evidence_record_id,{kind:"REVIEW_QUEUE"})}>Review Draft</Link></Button></div></Surface></li>)}</ul>}
    {page?<nav aria-label="Reviewer queue pagination" className="flex items-center justify-between"><Button disabled={page.offset===0} onClick={()=>setOffset(Math.max(0,page.offset-page.limit))} variant="secondary">Previous</Button><span className="text-sm text-text-muted">{page.total_count===0?"0 items":`${page.offset+1}–${page.offset+page.count} of ${page.total_count}`}</span><Button disabled={page.offset+page.count>=page.total_count} onClick={()=>setOffset(page.offset+page.limit)} variant="secondary">Next</Button></nav>:null}
  </section>;
}

function QueueState({title,children,role}:{title:string;children:React.ReactNode;role?:"alert"|"status"}){return <Surface><div role={role}><h1 className="text-xl font-semibold text-text-primary">{title}</h1><div className="mt-2 text-sm text-text-muted">{children}</div></div></Surface>;}
