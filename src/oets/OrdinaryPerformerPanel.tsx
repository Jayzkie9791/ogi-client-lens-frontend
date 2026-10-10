import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "../ui/components/Button";
import { Surface } from "../ui/components/Surface";
import { createOrdinaryPerformerBinding, getOrdinaryPerformerBinding, listOrdinaryPerformerCandidates, ordinaryPerformerBindingQueryKey, type OrdinaryPerformerCandidate } from "./ordinaryPerformerApi";

export function OrdinaryPerformerPanel({ recordId, correction, dirty }: { recordId: string; correction: boolean; dirty: boolean }) {
  const queryClient = useQueryClient();
  const [date, setDate] = useState(""); const [selected, setSelected] = useState<OrdinaryPerformerCandidate | null>(null);
  const binding = useQuery({ queryKey: ordinaryPerformerBindingQueryKey(recordId), queryFn: () => getOrdinaryPerformerBinding(recordId) });
  const candidates = useQuery({ enabled: Boolean(date && !binding.data?.binding && !correction), queryKey: ["ordinary-performer-candidates", recordId, date], queryFn: () => listOrdinaryPerformerCandidates(recordId, date) });
  const create = useMutation({ mutationFn: () => { if (!selected || !date) throw new Error("Select a performer and occurrence date."); return createOrdinaryPerformerBinding(recordId, selected, date); }, onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ordinaryPerformerBindingQueryKey(recordId) }); } });
  const current = binding.data?.binding;
  return <Surface className="space-y-4 border-primary-blue">
    <div><p className="text-xs font-semibold uppercase tracking-wide text-primary-blue">Governed evidence performer</p><h3 className="mt-1 text-lg font-semibold">Audit or assessment performer</h3></div>
    {binding.isLoading ? <p role="status">Loading performer authority…</p> : current ? <div className="rounded-component border border-green-200 bg-green-50 p-4">
      <p className="font-semibold">{current.performer_name} · {current.business_identifier}</p>
      <p className="mt-1 text-sm">{current.qualification_level} · Occurred {current.occurrence_local_date} ({current.facility_timezone})</p>
      <p className="mt-1 text-sm font-medium">{current.performer_source === "EFFECTIVE_QA_ASSIGNMENT" ? "Performed through an effective profile-specific QA assignment." : "Selected ordinary L4+ operational performer."}</p>
    </div> : correction ? <p className="rounded-component border border-red-300 bg-red-50 p-3 text-red-800">Performer authority unavailable. A correction must clone the exact predecessor performer binding.</p> : <>
      <p className="text-sm text-text-muted">No performer has been selected. Select the person who will perform this exact occurrence; a QA assignment is eligibility only and is never selected automatically.</p>
      <label className="block max-w-sm text-sm font-semibold">Facility-local occurrence date<input className="mt-1 w-full rounded-component border border-border px-3 py-2" disabled={dirty} onChange={event => { setDate(event.target.value); setSelected(null); }} type="date" value={date} /></label>
      {candidates.data ? <fieldset className="space-y-2"><legend className="font-semibold">Eligible performers</legend>{candidates.data.candidates.length ? candidates.data.candidates.map(candidate => <label className="flex gap-3 rounded-component border border-border p-3" key={`${candidate.performer_source}:${candidate.qualification_certification_id}:${candidate.ordinary_qa_assignment_id ?? "ordinary"}`}><input checked={selected === candidate} name="ordinary-performer" onChange={() => setSelected(candidate)} type="radio" /><span><strong>{candidate.display_name}</strong> · {candidate.business_identifier} · {candidate.qualification_level}<br/><span className="text-sm text-text-muted">{candidate.performer_source === "EFFECTIVE_QA_ASSIGNMENT" ? "Effective QA assignment" : "Ordinary L4+ operational authority"}</span></span></label>) : <p>No eligible performer is available for this occurrence date.</p>}</fieldset> : null}
      <Button disabled={!selected || dirty || create.isPending} onClick={() => create.mutate()} type="button">{create.isPending ? "Binding performer…" : "Bind selected performer"}</Button>
    </>}
    {(binding.isError || candidates.isError || create.isError) ? <p className="text-sm text-red-700" role="alert">Performer authority could not be established. Verify scope, qualification and occurrence date, then retry.</p> : null}
  </Surface>;
}
