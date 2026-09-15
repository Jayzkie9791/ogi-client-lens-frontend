import { CSSProperties, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";

import { routes } from "../app/routePaths";
import { useAuth } from "../auth/useAuth";
import { OperationalEvidenceRecordPage } from "../oets/OperationalEvidenceRecordPage";
import { RuntimeTemplatePage } from "../oets/RuntimeTemplatePage";
import { evidencePathWithReturn } from "../oets/evidenceReturnContext";
import { listOperationalEvidenceRecords, OperationalEvidenceRecordSummary } from "../oets/recordsApi";
import { listOetsTemplateCatalog, OetsTemplateCatalogItem } from "../oets/templateCatalogApi";
import { listRegistrationClients } from "../registration/registrationClientApi";
import { listRegistrationFacilities } from "../registration/registrationFacilityApi";
import { Surface } from "../ui/components/Surface";
import { Button } from "../ui/components/Button";
import { WorkspaceShell } from "../ui/components/WorkspaceShell";
import { calculateFacilityOri, CertificationFormCompleteness, FacilityWorkforceAuthority, getCertificationFormCompleteness, getCurrentFacilityOri, getDomainAssessmentDetail, getFacilityOriHistory, getFacilityOriReadiness, getFacilityWorkforceAuthority, getPersonnelFormCompleteness, OriReadiness, OriReadinessSource, OriResult, PersonnelFormCompleteness } from "./facilityAssessmentApi";
import { DomainAssessmentWorkspace } from "./DomainAssessmentWorkspace";

interface CategoryDefinition { readonly code: string; readonly name: string; readonly weight: number; readonly forms: readonly string[] }
interface FormWorkspace { readonly formCode: string; readonly templateCode: string; readonly templateName: string; readonly categoryName: string; readonly recordId?: string; readonly contextId?: string }

const categories: readonly CategoryDefinition[] = [
  { code: "GOVERNANCE_DOCUMENTATION", name: "Governance & Documentation", weight: 10, forms: ["F002", "F003", "F005", "F903", "F905"] },
  { code: "LIFEGUARD_OPERATIONS", name: "Lifeguard Operations", weight: 15, forms: ["F021", "F023", "F024", "F025", "F041", "F044", "F045", "F047", "F049"] },
  { code: "EMERGENCY_PREPAREDNESS", name: "Emergency Preparedness", weight: 15, forms: ["F100", "F101", "F102", "F103", "F104", "F105", "F106", "F107", "F108", "F109"] },
  { code: "RESCUE_EQUIPMENT_ASSETS", name: "Rescue Equipment & Assets", weight: 15, forms: ["F081", "F082", "F083", "F084", "F085", "F086", "F087", "F088", "F089", "F063", "F064", "F065", "F066"] },
  { code: "TRAINING_COMPETENCY", name: "Training & Competency", weight: 10, forms: ["F022", "F023", "F024", "F025", "F026", "F027", "F028", "F029", "F090", "F091", "F092", "F093", "F094", "F095", "F096", "F097", "F098", "F099"] },
  { code: "FACILITY_ENVIRONMENTAL_SAFETY", name: "Facility & Environmental Safety", weight: 10, forms: ["F002", "F901", "F902", "F903", "F904", "F905", "F912"] },
  { code: "INCIDENT_MANAGEMENT", name: "Incident Management", weight: 10, forms: ["F060", "F061", "F062", "F063", "F064", "F065", "F066", "F067", "F068", "F069", "F802", "F803", "F804", "F805", "F806", "F809", "F810"] },
  { code: "PUBLIC_SAFETY_SYSTEMS", name: "Public Safety Systems", weight: 10, forms: ["F912", "F913", "F914", "F915", "F916", "F918", "F920"] },
  { code: "EQUIPMENT_INSPECTION_PROGRAMS", name: "Equipment Inspection Programs", weight: 5, forms: ["F081", "F082", "F083", "F084", "F085", "F086", "F087", "F904", "F905"] }
] as const;

const categoryTones = [
  { accent: "#0f766e", soft: "#e8f6f3", deep: "#115e59" },
  { accent: "#2563eb", soft: "#edf4ff", deep: "#1e40af" },
  { accent: "#4338ca", soft: "#f0efff", deep: "#3730a3" },
  { accent: "#7c3aed", soft: "#f5f0ff", deep: "#5b21b6" },
  { accent: "#b45309", soft: "#fff7e6", deep: "#92400e" },
  { accent: "#0369a1", soft: "#eaf7fd", deep: "#075985" },
  { accent: "#be123c", soft: "#fff0f3", deep: "#9f1239" },
  { accent: "#0e7490", soft: "#e9f8fb", deep: "#155e75" },
  { accent: "#4d7c0f", soft: "#f3f9e8", deep: "#3f6212" }
] as const;

export function FacilityAssessmentJourneysPage() {
  const auth = useAuth();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const restoredCategory = searchParams.get("category");
  const initialCategory = categories.some((category) => category.code === restoredCategory) ? restoredCategory : null;
  const [clientId, setClientId] = useState(() => searchParams.get("client")?.trim() ?? "");
  const [facilityId, setFacilityId] = useState(() => searchParams.get("facility")?.trim() ?? "");
  const [expanded, setExpanded] = useState<string | null>(initialCategory);
  const previousClientId = useRef(clientId);
  const previousFacilityId = useRef(facilityId);
  const [workspace, setWorkspace] = useState<FormWorkspace | null>(null);
  const [workspaceDirty, setWorkspaceDirty] = useState(false);
  const [assessmentWorkspace, setAssessmentWorkspace] = useState<CategoryDefinition | null>(null);
  const clientsQuery = useQuery({ queryKey: ["registration-clients", "assessment-journey"], queryFn: listRegistrationClients, retry: false });
  const facilitiesQuery = useQuery({ queryKey: ["registration-facilities", "assessment-journey", clientId], queryFn: () => listRegistrationFacilities({ clientId }), enabled: Boolean(clientId), retry: false });
  const readinessQuery = useQuery({ queryKey: ["facility-ori-readiness", clientId, facilityId], queryFn: () => getFacilityOriReadiness(clientId, facilityId), enabled: Boolean(clientId && facilityId), retry: false });
  const currentOriQuery = useQuery({ queryKey: ["facility-ori-current", clientId, facilityId], queryFn: () => getCurrentFacilityOri(clientId, facilityId), enabled: Boolean(clientId && facilityId), retry: false });
  const oriHistoryQuery = useQuery({ queryKey: ["facility-ori-history", clientId, facilityId], queryFn: () => getFacilityOriHistory(clientId, facilityId), enabled: Boolean(clientId && facilityId), retry: false });
  const workforceQuery = useQuery({ queryKey: ["facility-workforce-authority", clientId, facilityId], queryFn: () => getFacilityWorkforceAuthority(clientId, facilityId), enabled: Boolean(clientId && facilityId), retry: false });
  const personnelFormsQuery = useQuery({ queryKey: ["personnel-form-completeness", clientId, facilityId, "F021"], queryFn: () => getPersonnelFormCompleteness(clientId, facilityId), enabled: Boolean(clientId && facilityId), retry: false });
  const f041Query = useQuery({ queryKey:["certification-form-completeness",clientId,facilityId,"F041"],queryFn:()=>getCertificationFormCompleteness(clientId,facilityId,"F041"),enabled:Boolean(clientId&&facilityId),retry:false });
  const f044Query = useQuery({ queryKey:["certification-form-completeness",clientId,facilityId,"F044"],queryFn:()=>getCertificationFormCompleteness(clientId,facilityId,"F044"),enabled:Boolean(clientId&&facilityId),retry:false });
  const f047Query = useQuery({ queryKey:["certification-form-completeness",clientId,facilityId,"F047"],queryFn:()=>getCertificationFormCompleteness(clientId,facilityId,"F047"),enabled:Boolean(clientId&&facilityId),retry:false });
  const calculateOriMutation = useMutation({ mutationFn: () => calculateFacilityOri(clientId, facilityId), onSuccess: async () => { await Promise.all([queryClient.invalidateQueries({ queryKey: ["facility-ori-readiness", clientId, facilityId] }), queryClient.invalidateQueries({ queryKey: ["facility-ori-current", clientId, facilityId] }), queryClient.invalidateQueries({ queryKey: ["facility-ori-history", clientId, facilityId] })]); } });
  const templatesQuery = useQuery({ queryKey: ["oets-template-catalog", "assessment-journey"], queryFn: () => listOetsTemplateCatalog(), enabled: Boolean(facilityId), retry: false });
  const recordsQuery = useQuery({ queryKey: ["operational-evidence-records", "assessment-journey", clientId, facilityId], queryFn: () => listOperationalEvidenceRecords({ client_id: clientId, facility_id: facilityId, sort_by: "created_at", sort_direction: "desc", limit: 100 }), enabled: Boolean(clientId && facilityId), retry: false });
  const clients = clientsQuery.data?.clients ?? [];
  const facilities = facilitiesQuery.data?.facilities ?? [];
  const selectedClient = clients.find((item) => item.id === clientId);
  const selectedFacility = facilities.find((item) => item.id === facilityId);

  useEffect(() => {
    if (previousClientId.current === clientId) return;
    previousClientId.current = clientId;
    setFacilityId("");
    setExpanded(null);
  }, [clientId]);
  useEffect(() => {
    if (previousFacilityId.current === facilityId) return;
    previousFacilityId.current = facilityId;
    setExpanded(null);
  }, [facilityId]);

  return <WorkspaceShell title="Facility Assessment Journeys" description="Review each facility against the nine approved operational categories without leaving the assessment route." headingId="facility-assessment-journeys" navigation={null} sectionTitle="" sectionDescription="" showSectionHeader={false}>
    <div className="space-y-5">
      <Surface className="border-l-4 border-l-primary-blue p-4">
        <h2 className="mb-3 text-lg font-semibold text-primary-navy">Assessment route, <span className="text-sm font-normal text-text-muted">choose the exact Client and Facility. Category details load only when opened.</span></h2>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-sm font-semibold text-primary-navy">Client
            <select className="mt-1.5 min-h-10 w-full rounded-component border border-border bg-surface px-3 font-normal" disabled={clientsQuery.isLoading} onChange={(event) => setClientId(event.target.value)} value={clientId}>
              <option value="">Select a Client</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.organization_name}</option>)}
            </select>
          </label>
          <label className="text-sm font-semibold text-primary-navy">Facility
            <select className="mt-1.5 min-h-10 w-full rounded-component border border-border bg-surface px-3 font-normal" disabled={!clientId || facilitiesQuery.isLoading} onChange={(event) => setFacilityId(event.target.value)} value={facilityId}>
              <option value="">{clientId ? "Select a Facility" : "Select a Client first"}</option>{facilities.map((facility) => <option key={facility.id} value={facility.id}>{facility.facility_name}</option>)}
            </select>
          </label>
        </div>
        {clientsQuery.isError || facilitiesQuery.isError ? <p className="mt-3 text-sm text-state-error">The authorized Client or Facility list could not be loaded.</p> : null}
      </Surface>

      {!facilityId ? <Surface><p className="text-sm text-text-muted">Select a Client and Facility to load its nine-category assessment readiness.</p></Surface> : null}
      {facilityId && readinessQuery.isLoading ? <Surface role="status"><p className="text-sm text-text-muted">Loading facility assessment readiness…</p></Surface> : null}
      {facilityId && readinessQuery.isError ? <Surface role="alert" className="border-l-4 border-l-state-error"><p className="font-semibold text-state-error">Assessment readiness could not be loaded.</p><p className="mt-1 text-sm text-text-muted">Confirm that your account has Domain Assessment access for this facility.</p></Surface> : null}
      {facilityId && (templatesQuery.isError || recordsQuery.isError) ? <Surface role="alert" className="border-l-4 border-l-state-warning"><p className="font-semibold text-primary-navy">Form launch status could not be loaded.</p><p className="mt-1 text-sm text-text-muted">The category journey remains available, but starting or continuing forms is disabled until the template catalog and facility evidence records can be loaded.</p></Surface> : null}
      {readinessQuery.data ? <JourneySummary clientName={selectedClient?.organization_name ?? "Client"} facilityName={selectedFacility?.facility_name ?? "Facility"} finalized={readinessQuery.data.sources.length} /> : null}
      {facilityId ? <WorkforceAuthorityCard projection={workforceQuery.data ?? null} loading={workforceQuery.isLoading} error={workforceQuery.error} /> : null}
      {readinessQuery.data ? <OriWorkspace readiness={readinessQuery.data} current={currentOriQuery.data ?? null} history={oriHistoryQuery.data ?? []} loadingCurrent={currentOriQuery.isLoading} loadError={currentOriQuery.isError || oriHistoryQuery.isError} calculating={calculateOriMutation.isPending} calculationError={calculateOriMutation.isError} canCalculate={auth.canUsePermission?.("review_domain_assessment") ?? false} onCalculate={() => calculateOriMutation.mutate()} /> : null}
      {readinessQuery.data ? <div className="space-y-3">{categories.map((category, index) => {
        const source = readinessQuery.data.sources.find((item) => item.categoryCode === category.code);
        const blocker = readinessQuery.data.blockers.find((item) => item.categoryCode === category.code);
        const isOpen = expanded === category.code;
        return <CategoryRow category={category} certificationForms={{F041:f041Query.data??null,F044:f044Query.data??null,F047:f047Query.data??null}} clientId={clientId} facilityId={facilityId} index={index} isOpen={isOpen} key={category.code} onAssess={() => setAssessmentWorkspace(category)} onOpenForm={setWorkspace} onToggle={() => setExpanded(isOpen ? null : category.code)} source={source} blocker={blocker?.code} templates={templatesQuery.data?.templates ?? []} records={recordsQuery.data?.records ?? []} currentUserId={auth.session?.id ?? ""} personnelForms={personnelFormsQuery.data??null} />;
      })}</div> : null}
      {workspace ? <AssessmentFormWorkspace assessorName={auth.session?.fullName} clientName={selectedClient?.organization_name ?? "Client"} clientIdentifier={selectedClient?.business_identifier} facilityName={selectedFacility?.facility_name ?? "Facility"} facilityIdentifier={selectedFacility?.business_identifier} facilityType={selectedFacility?.facility_type} clientId={clientId} facilityId={facilityId} workspace={workspace} dirty={workspaceDirty} onDirtyChange={setWorkspaceDirty} onRecordCreated={(recordId) => { setWorkspaceDirty(false); setWorkspace((current) => current ? { ...current, recordId } : null); }} onClose={() => { if (workspaceDirty && !window.confirm("Close this form and discard unsaved changes?")) return; setWorkspaceDirty(false); setWorkspace(null); void Promise.all([queryClient.invalidateQueries({ queryKey: ["operational-evidence-records", "assessment-journey", clientId, facilityId] }),queryClient.invalidateQueries({ queryKey: ["certification-form-completeness", clientId, facilityId] })]); }} /> : null}
      {assessmentWorkspace ? <DomainAssessmentWorkspace categoryCode={assessmentWorkspace.code} categoryName={assessmentWorkspace.name} facilityId={facilityId} onClose={() => setAssessmentWorkspace(null)} onFinalized={() => { setAssessmentWorkspace(null); void queryClient.invalidateQueries({ queryKey: ["facility-ori-readiness", clientId, facilityId] }); }} /> : null}
    </div>
  </WorkspaceShell>;
}

function WorkforceAuthorityCard({projection,loading,error}:{projection:FacilityWorkforceAuthority|null;loading:boolean;error:Error|null}){
  if(loading)return <Surface role="status"><p className="text-sm text-text-muted">Loading facility workforce authority…</p></Surface>;
  if(error||!projection)return <Surface role="alert" className="border-l-4 border-l-state-warning"><p className="font-semibold text-primary-navy">Facility workforce authority could not be loaded.</p><p className="mt-1 text-sm text-text-muted">Refresh after confirming the backend is running. Server diagnostics retain the underlying failure.</p></Surface>;
  const metrics=[["Assigned",projection.counts.assignedPersonnel],["Active certification",projection.counts.activeCertification],["F-096 approved",projection.counts.f096Approved],["F-048 approved",projection.counts.f048Approved],["Credential issued",projection.counts.credentialIssued],["Currently authorized",projection.counts.currentlyAuthorized]] as const;
  return <Surface className="border-l-4 border-l-teal-600"><details><summary className="cursor-pointer"><span className="cl-data-label">Facility workforce authority</span><span className="ml-3 text-sm text-text-muted">{projection.counts.assignedPersonnel} assigned · {projection.counts.personnelWithGaps} with gaps</span></summary><div className="mt-4 grid gap-2 sm:grid-cols-3 lg:grid-cols-6">{metrics.map(([label,value])=><div className="rounded-component bg-elevated p-3" key={label}><p className="text-xl font-bold text-primary-navy">{value}</p><p className="text-xs text-text-muted">{label}</p></div>)}</div><ul className="mt-4 space-y-2">{projection.personnel.map((person)=><li className="rounded-component border border-workspace-border p-3" key={person.staffMemberId}><div className="flex flex-wrap justify-between gap-2"><strong className="text-primary-navy">{person.fullName}</strong><span className="text-sm text-text-muted">{person.certification?.certificationNumber??"No certification"}</span></div><p className={`mt-1 text-sm ${person.gaps.length?"text-amber-800":"text-teal-700"}`}>{person.gaps.length?person.gaps.map(humanize).join(" · "):"Current authority chain complete"}</p></li>)}</ul><p className="mt-3 break-all text-xs text-text-muted">Cutoff {formatDateTime(projection.cutoffAt)} · checksum {projection.checksum}</p></details></Surface>;
}

function OriWorkspace({ readiness, current, history, loadingCurrent, loadError, calculating, calculationError, canCalculate, onCalculate }: { readiness: OriReadiness; current: OriResult | null; history: readonly OriResult[]; loadingCurrent: boolean; loadError: boolean; calculating: boolean; calculationError: boolean; canCalculate: boolean; onCalculate: () => void }) {
  const actionLabel = current && readiness.updateAvailable ? "Calculate updated ORI" : "Calculate ORI";
  return <Surface className="border-l-4 border-l-primary-blue">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><p className="cl-data-label">Operational Risk Index</p><h3 className="mt-1 text-xl font-semibold text-primary-navy">{loadingCurrent ? "Loading current result…" : current ? `${formatScore(current.oriValue)} · ${humanize(current.lmhc)}` : "No ORI calculated yet"}</h3>{current ? <p className="mt-1 text-sm text-text-muted">Version {current.resultVersion} · calculated {formatDateTime(current.calculatedAt)}</p> : <p className="mt-1 text-sm text-text-muted">ORI becomes available after all nine facility-wide category assessments are final.</p>}</div>
      <Button disabled={!readiness.ready || !canCalculate || calculating} onClick={onCalculate}>{calculating ? "Calculating…" : actionLabel}</Button>
    </div>
    {!canCalculate && readiness.ready ? <p className="mt-3 text-sm text-text-muted">An authorized Domain Assessment reviewer must calculate the ORI.</p> : null}
    {!readiness.ready ? <div className="mt-4 rounded-component border border-amber-300 bg-amber-50 p-3"><p className="font-semibold text-amber-950">{readiness.blockers.length} categor{readiness.blockers.length === 1 ? "y" : "ies"} blocking ORI</p><ul className="mt-2 grid gap-1 text-sm text-amber-900 sm:grid-cols-2">{readiness.blockers.map((blocker) => <li key={blocker.categoryCode}>{categoryName(blocker.categoryCode)} — {blockerMessage(blocker.code)}</li>)}</ul></div> : null}
    {readiness.ready && !current ? <p className="mt-3 rounded-component border border-green-300 bg-green-50 p-3 text-sm font-semibold text-green-800">All nine category finals are eligible. ORI is ready to calculate.</p> : null}
    {readiness.updateAvailable && current ? <p className="mt-3 rounded-component border border-blue-300 bg-blue-50 p-3 text-sm font-semibold text-primary-blue">A category final changed after this result. Calculate a successor ORI; the current version will remain in history.</p> : null}
    {calculationError ? <p className="mt-3 text-sm text-state-error" role="alert">ORI calculation was not accepted. Refresh readiness and confirm all nine category finals remain eligible.</p> : null}
    {loadError ? <p className="mt-3 text-sm text-state-error" role="alert">The current ORI or its history could not be loaded.</p> : null}
    {current ? <OriContributions result={current} /> : null}
    {history.length ? <details className="mt-4 border-t border-workspace-border pt-3"><summary className="cursor-pointer font-semibold text-primary-blue">ORI history ({history.length})</summary><ol className="mt-3 space-y-2">{[...history].reverse().map((result) => <li className="flex flex-wrap justify-between gap-2 rounded-component bg-elevated px-3 py-2 text-sm" key={result.id}><span>Version {result.resultVersion} · <strong>{formatScore(result.oriValue)}</strong> · {humanize(result.lmhc)}</span><span className="text-text-muted">{formatDateTime(result.calculatedAt)}</span></li>)}</ol></details> : null}
  </Surface>;
}

function OriContributions({ result }: { result: OriResult }) {
  return <details className="mt-4" open><summary className="cursor-pointer font-semibold text-primary-navy">Nine category contributions</summary><div className="mt-3 overflow-x-auto"><table className="w-full min-w-[42rem] text-left text-sm"><thead><tr className="border-b border-workspace-border text-text-muted"><th className="p-2">Category</th><th className="p-2 text-right">Index</th><th className="p-2 text-right">Weight</th><th className="p-2 text-right">Contribution</th></tr></thead><tbody>{result.contributions.map((item) => <tr className="border-b border-workspace-border/70" key={item.categoryCode}><td className="p-2 font-medium text-primary-navy">{item.categoryName}</td><td className="p-2 text-right">{formatScore(item.source.professionalCategoryIndex)}</td><td className="p-2 text-right">{formatPercent(item.weight)}</td><td className="p-2 text-right font-semibold">{formatScore(item.weightedContribution)}</td></tr>)}</tbody></table></div></details>;
}

function JourneySummary({ clientName, facilityName, finalized }: { clientName: string; facilityName: string; finalized: number }) {
  return <Surface className="border-l-4 border-l-[var(--cl-catalog-accent)] bg-[linear-gradient(90deg,var(--cl-catalog-accent-soft),white_45%)]">
    <div className="flex flex-wrap items-center justify-between gap-4"><div><p className="cl-data-label">Selected facility</p><h3 className="mt-1 text-lg font-semibold text-primary-navy">{facilityName}</h3><p className="mt-1 text-sm text-text-muted">{clientName}</p></div><div className="text-right"><p className="text-2xl font-bold text-primary-navy">{finalized} of 9</p><p className="text-sm text-text-muted">current facility-wide finals</p></div></div>
  </Surface>;
}

function CategoryRow({ category, certificationForms,clientId,facilityId,index, isOpen, onToggle, onAssess, onOpenForm, source, blocker, templates, records, currentUserId,personnelForms }: { category: CategoryDefinition;certificationForms:Record<"F041"|"F044"|"F047",CertificationFormCompleteness|null>;clientId:string;facilityId:string; index: number; isOpen: boolean; onToggle: () => void; onAssess: () => void; onOpenForm: (workspace: FormWorkspace) => void; source?: OriReadinessSource; blocker?: string; templates: readonly OetsTemplateCatalogItem[]; records: readonly OperationalEvidenceRecordSummary[]; currentUserId: string;personnelForms:PersonnelFormCompleteness|null }) {
  const detailQuery = useQuery({ queryKey: ["domain-assessment-detail", source?.assessmentId], queryFn: () => source ? getDomainAssessmentDetail(source.assessmentId) : Promise.reject(new Error("No finalized category assessment is available.")), enabled: isOpen && Boolean(source), retry: false });
  const tone = categoryTones[index % categoryTones.length];
  const style = { "--journey-accent": tone.accent, "--journey-soft": tone.soft, "--journey-deep": tone.deep } as CSSProperties;
  return <article className="overflow-hidden rounded-panel border border-workspace-border bg-surface shadow-panel" style={style}>
    <button aria-expanded={isOpen} className="flex w-full items-center gap-4 border-l-4 border-l-[var(--journey-accent)] bg-[linear-gradient(90deg,var(--journey-soft),white_62%)] px-5 py-4 text-left outline-none transition-[background,box-shadow] hover:bg-[var(--journey-soft)] focus-visible:ring-2 focus-visible:ring-focus" onClick={onToggle} type="button">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--journey-deep)] text-sm font-bold text-white shadow-sm">{index + 1}</span>
      <span className="min-w-0 flex-1"><span className="block font-semibold text-primary-navy">{category.name}</span><span className="mt-1 block text-sm text-text-muted">{category.weight}% ORI weight · {category.forms.length} approved forms</span></span>
      <StatusBadge source={source} blocker={blocker} />
      <span aria-hidden="true" className={`text-2xl font-bold text-[var(--journey-deep)] transition-transform ${isOpen ? "rotate-180" : ""}`}>⌄</span>
    </button>
    {isOpen ? <div className="border-t border-workspace-border bg-workspace-canvas p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-component border border-[var(--journey-accent)] border-l-4 bg-[var(--journey-soft)] px-4 py-3"><p className="text-sm text-text-muted"><strong className="text-[var(--journey-deep)]">Approved category membership.</strong> Form evidence remains governed separately from the category final.</p><button className="rounded-component bg-[var(--journey-deep)] px-4 py-2 text-sm font-semibold text-white" onClick={onAssess} type="button">{source ? "Open or reassess category →" : "Assess category →"}</button></div>
      {source && detailQuery.isLoading ? <p role="status" className="text-sm text-text-muted">Loading governed category detail…</p> : null}
      {source && detailQuery.isError ? <p role="alert" className="text-sm text-state-error">The finalized assessment detail could not be loaded.</p> : null}
      <FormList category={category} certificationForms={certificationForms} source={source} applicability={detailQuery.data?.applicability ?? []} clientId={clientId} facilityId={facilityId} currentUserId={currentUserId} onOpenForm={onOpenForm} records={records} templates={templates} personnelForms={personnelForms} />
    </div> : null}
  </article>;
}

function FormList({ category,certificationForms, source, applicability, clientId, facilityId, currentUserId, onOpenForm, records, templates,personnelForms }: { category: CategoryDefinition;certificationForms:Record<"F041"|"F044"|"F047",CertificationFormCompleteness|null>; source?: OriReadinessSource; applicability: readonly { formCode: string | null; state: string; contributions: readonly { sourceId: string; sourceKind: string }[] }[]; clientId:string; facilityId:string; currentUserId: string; onOpenForm: (workspace: FormWorkspace) => void; records: readonly OperationalEvidenceRecordSummary[]; templates: readonly OetsTemplateCatalogItem[];personnelForms:PersonnelFormCompleteness|null }) {
  const byCode = useMemo(() => new Map(applicability.map((item) => [item.formCode, item])), [applicability]);
  return <ul className="grid gap-3 lg:grid-cols-2">{category.forms.map((formCode) => {
    const decision = byCode.get(formCode);
    const contribution = decision?.contributions[0];
    const template = templates.find((item) => templateMatchesFormCode(item, formCode));
    const formRecords = template ? records.filter((record) => record.template_code === template.template_code) : [];
    const currentVersionRecords = template
      ? formRecords.filter((record) => record.template_version_id === template.template_version_id)
      : [];
    const ownedDraft = currentVersionRecords.find((record) => record.lifecycle_state === "DRAFT" && record.created_by_user_id === currentUserId);
    const currentRecord = ownedDraft
      ?? currentVersionRecords.find((record) => !["DISCARDED", "REPLACED"].includes(record.lifecycle_state));
    const supersededRecord = formRecords.find((record) =>
      !["DISCARDED", "REPLACED"].includes(record.lifecycle_state)
      && record.template_version_id !== template?.template_version_id
    );
    const action = currentRecord ? currentRecord.lifecycle_state === "DRAFT" ? "Continue draft" : "View evidence" : supersededRecord ? "Start current form" : "Start form";
    if(formCode==="F021"&&personnelForms)return <PersonnelFormCoverage categoryCode={category.code} categoryName={category.name} clientId={clientId} facilityId={facilityId} key={formCode} onOpenForm={onOpenForm} projection={personnelForms} template={template}/>;
    if((formCode==="F041"||formCode==="F044"||formCode==="F047")&&certificationForms[formCode])return <CertificationFormCoverage categoryCode={category.code} categoryName={category.name} clientId={clientId} facilityId={facilityId} key={formCode} onOpenForm={onOpenForm} projection={certificationForms[formCode]!} template={template}/>;
    return <li className="flex min-h-20 items-center justify-between gap-4 rounded-component border border-[color:var(--cl-workflow-card-border)] border-l-4 border-l-[var(--journey-accent)] bg-[linear-gradient(90deg,var(--journey-soft),white_68%)] px-4 py-3 shadow-panel" key={formCode}>
      <div className="min-w-0"><p className="font-semibold text-primary-navy">{formCode}{template ? <span className="ml-2 font-normal text-text-muted">{template.template_name}</span> : null}</p><p className="mt-1 text-xs text-text-muted">{currentRecord ? humanize(currentRecord.lifecycle_state) : supersededRecord ? `Historical ${humanize(supersededRecord.lifecycle_state).toLowerCase()} v${supersededRecord.template_version} is preserved; start the current form` : source ? decision ? `${humanize(decision.state)}${decision.contributions.length ? ` · ${decision.contributions.length} bound source${decision.contributions.length === 1 ? "" : "s"}` : ""}` : "No member detail returned" : "No current facility-wide final"}</p></div>
      {template ? <button className="shrink-0 rounded-component border border-[var(--journey-deep)] bg-[var(--journey-deep)] px-3 py-2 text-sm font-semibold text-white shadow-sm hover:brightness-90 focus-visible:ring-2 focus-visible:ring-focus" onClick={() => onOpenForm({ formCode, templateCode: template.template_code, templateName: template.template_name, categoryName: category.name, ...(currentRecord ? { recordId: currentRecord.evidence_record_id } : {}) })} type="button">{action} →</button> : contribution?.sourceKind === "OPERATIONAL_EVIDENCE" ? <Link className="shrink-0 font-semibold text-primary-blue underline" to={evidencePathWithReturn(contribution.sourceId,{kind:"FACILITY_ASSESSMENT",clientId,facilityId,categoryCode:category.code})}>View evidence</Link> : <span className="shrink-0 rounded-full border border-[color:var(--cl-catalog-purpose-border)] bg-surface px-3 py-1 text-xs font-semibold uppercase tracking-wide text-text-muted">Unavailable</span>}
    </li>;
  })}</ul>;
}

function CertificationFormCoverage({categoryCode,categoryName,clientId,facilityId,onOpenForm,projection,template}:{categoryCode:string;categoryName:string;clientId:string;facilityId:string;onOpenForm:(workspace:FormWorkspace)=>void;projection:CertificationFormCompleteness;template?:OetsTemplateCatalogItem}){
  const [query,setQuery]=useState("");const[showExcluded,setShowExcluded]=useState(false);const normalized=query.trim().toLowerCase();const included=new Set(["ELIGIBLE_TO_REQUEST","REQUEST_EXISTS","AMBIGUOUS_CURRENTNESS"]);const subjects=projection.subjects.filter(subject=>(projection.formCode!=="F044"||showExcluded||included.has(subject.eligibility))&&(!normalized||`${subject.holderName} ${subject.certificationNumber} ${subject.certificationStatus}`.toLowerCase().includes(normalized)));
  const labels:Record<string,string>={RECORDABLE:"Available for certification record",RECORD_EXISTS:"Certification record exists",ELIGIBLE_TO_REQUEST:"Current — renewal may be requested",REQUEST_EXISTS:"Recertification request exists",PENDING_INITIAL_CERTIFICATION:"Pending initial certification — not eligible",AMBIGUOUS_CURRENTNESS:"Blocked — multiple current certifications at this level",EXPIRED:"Expired — eligibility decision required",SUSPENDED:"Suspended — use governed correction path",REVOKED:"Revoked — not eligible for ordinary renewal",VERIFIABLE:"Available for verification"};
  const label=(value:string)=>labels[value]??humanize(value);
  const title=projection.formCode==="F041"?"Certification Intelligence Record":projection.formCode==="F044"?"Recertification & Competency Renewal Assessment":"Certification Verification & Intelligence Report";
  const createLabel=projection.formCode==="F041"?"Create certification record":projection.formCode==="F044"?"Begin recertification application":"Create verification request";
  return <li className="rounded-component border border-[color:var(--cl-workflow-card-border)] border-l-4 border-l-[var(--journey-accent)] bg-white shadow-panel lg:col-span-2"><details><summary className="cursor-pointer list-none p-4"><div className="flex flex-wrap justify-between gap-3"><div><p className="font-semibold text-primary-navy">{projection.formCode} <span className="font-normal text-text-muted">{title}</span></p><p className="mt-1 text-xs text-text-muted">{projection.formCode==="F044"?`${projection.counts.eligibleToRequest} eligible to request · ${projection.counts.withCurrentEvidence} existing · ${projection.counts.dataIssues} data issue${projection.counts.dataIssues===1?"":"s"}`:`${projection.counts.withCurrentEvidence} of ${projection.counts.certifications} certification subjects have current evidence`}</p></div><span className="text-xs font-bold text-primary-blue">Certification-level evidence ▾</span></div></summary><div className="border-t border-workspace-border p-4"><div className="flex flex-wrap items-end justify-between gap-3"><label className="text-sm font-semibold text-primary-navy">Search certification holders<input className="mt-1 block min-h-10 w-full rounded-component border px-3 font-normal md:w-96" onChange={event=>setQuery(event.target.value)} placeholder="Holder, certification number, or status" type="search" value={query}/></label>{projection.formCode==="F044"&&projection.counts.excluded>0?<button className="rounded-component border border-primary-blue px-3 py-2 text-sm font-semibold text-primary-blue" onClick={()=>setShowExcluded(value=>!value)} type="button">{showExcluded?"Hide excluded":`Show excluded (${projection.counts.excluded})`}</button>:null}</div><ul className="mt-3 divide-y divide-workspace-border overflow-hidden rounded-component border">{subjects.map(subject=><li className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between" key={subject.certificationId}><div><strong>{subject.holderName}</strong><p className="text-xs text-text-muted">{subject.certificationNumber} · {humanize(subject.certificationStatus)} · expires {subject.expiryDate?new Date(subject.expiryDate).toLocaleDateString():"unknown"}</p><p className={subject.eligibility==="AMBIGUOUS_CURRENTNESS"?"mt-1 text-xs text-red-700":"mt-1 text-xs text-text-muted"}>{label(subject.eligibility)}</p></div>{subject.currentRecord?<div className="flex flex-wrap gap-3"><Link className="text-sm font-semibold text-primary-blue underline" to={evidencePathWithReturn(subject.currentRecord.evidenceRecordId,{kind:"FACILITY_ASSESSMENT",clientId,facilityId,categoryCode})}>{subject.currentRecord.lifecycleState==="DRAFT"?"Continue draft":"View evidence"}</Link>{projection.formCode==="F047"&&subject.currentRecord.lifecycleState==="GOVERNANCE_APPROVED"&&template?<button className="text-sm font-semibold text-primary-blue underline" onClick={()=>onOpenForm({formCode:projection.formCode,templateCode:template.template_code,templateName:template.template_name,categoryName,contextId:subject.certificationId})} type="button">Create another verification</button>:null}</div>:template&&((projection.formCode==="F041"&&subject.eligibility==="RECORDABLE")||(projection.formCode==="F044"&&subject.eligibility==="ELIGIBLE_TO_REQUEST")||projection.formCode==="F047")?<button className="text-sm font-semibold text-primary-blue underline" onClick={()=>onOpenForm({formCode:projection.formCode,templateCode:template.template_code,templateName:template.template_name,categoryName,contextId:subject.certificationId})} type="button">{createLabel}</button>:!template?<span className="text-sm text-text-muted">Template unavailable</span>:null}</li>)}</ul>{projection.formCode==="F044"?<p className="mt-3 text-xs text-amber-800">F-044 is created only by an explicit renewal request. Excluded records remain available for audit and are not deleted.</p>:projection.formCode==="F041"?<p className="mt-3 text-xs text-text-muted">Create one governed F-041 record for the exact certification subject. Authoritative identity fields are supplied by the registry.</p>:null}</div></details></li>;
}

function PersonnelFormCoverage({ categoryCode, categoryName, clientId, facilityId, onOpenForm, projection, template }: { categoryCode:string;categoryName:string;clientId:string;facilityId:string;onOpenForm:(workspace:FormWorkspace)=>void;projection: PersonnelFormCompleteness;template?:OetsTemplateCatalogItem }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"ALL" | "NEEDS_ACTION" | "ELIGIBLE" | "IN_PROGRESS">("ALL");
  const inProgressStatuses = new Set(["DRAFT", "SUBMITTED", "UNDER_REVIEW"]);
  const needsActionStatuses = new Set(["RETURNED", "SUPERSEDED", "MISSING_TRAINEE_LINK", "MISSING_ENROLLMENT", "MISSING_EVIDENCE"]);
  const normalizedQuery = query.trim().toLowerCase();
  const visiblePersonnel = projection.personnel.filter((person) => {
    const matchesQuery = !normalizedQuery || [person.fullName, person.studentNumber, person.status]
      .some((value) => value?.toLowerCase().includes(normalizedQuery));
    const matchesFilter = filter === "ALL"
      || (filter === "ELIGIBLE" && person.status === "ELIGIBLE")
      || (filter === "IN_PROGRESS" && inProgressStatuses.has(person.status))
      || (filter === "NEEDS_ACTION" && needsActionStatuses.has(person.status));
    return matchesQuery && matchesFilter;
  });
  const inProgress = projection.personnel.filter((person) => inProgressStatuses.has(person.status)).length;
  const needsAction = projection.personnel.filter((person) => needsActionStatuses.has(person.status)).length;

  return <li className="rounded-component border border-[color:var(--cl-workflow-card-border)] border-l-4 border-l-[var(--journey-accent)] bg-white shadow-panel lg:col-span-2">
    <details>
      <summary className="cursor-pointer list-none p-4 marker:content-none">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-semibold text-primary-navy">F021 <span className="font-normal text-text-muted">Personnel Registration & Competency Profile</span></p>
            <p className="mt-1 text-xs text-text-muted">{projection.counts.eligible} of {projection.counts.assignedPersonnel} assigned personnel have eligible governed evidence</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
            <span className="rounded-full border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-emerald-800">{projection.counts.eligible} eligible</span>
            <span className="rounded-full border border-blue-300 bg-blue-50 px-2.5 py-1 text-primary-blue">{inProgress} in progress</span>
            <span className="rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-amber-800">{needsAction} need action</span>
            <span className="ml-1 text-primary-blue">Personnel-level evidence ▾</span>
          </div>
        </div>
      </summary>
      <div className="border-t border-workspace-border p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <label className="text-sm font-semibold text-primary-navy">Search personnel
            <input className="mt-1 block min-h-10 w-full rounded-component border border-border px-3 font-normal md:w-80" onChange={(event) => setQuery(event.target.value)} placeholder="Name, student number, or status" type="search" value={query} />
          </label>
          <div aria-label="Filter personnel evidence" className="flex flex-wrap gap-2" role="group">
            {([
              ["ALL", "All"],
              ["NEEDS_ACTION", "Needs action"],
              ["ELIGIBLE", "Eligible"],
              ["IN_PROGRESS", "In progress"]
            ] as const).map(([value, label]) => <button aria-pressed={filter === value} className={`rounded-component border px-3 py-2 text-sm font-semibold ${filter === value ? "border-[var(--journey-deep)] bg-[var(--journey-deep)] text-white" : "border-workspace-border bg-white text-primary-navy"}`} key={value} onClick={() => setFilter(value)} type="button">{label}</button>)}
          </div>
        </div>
        <p className="mt-3 text-xs text-text-muted">Showing {visiblePersonnel.length} of {projection.counts.assignedPersonnel} assigned personnel</p>
        {visiblePersonnel.length ? <ul className="mt-2 divide-y divide-workspace-border overflow-hidden rounded-component border border-workspace-border">{visiblePersonnel.map((person) => <li className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between" key={person.staffMemberId}>
          <div><strong className="text-primary-navy">{person.fullName}</strong><p className="mt-1 text-xs text-text-muted">{humanize(person.status)} · {person.studentNumber ?? "Student link pending"}</p></div>
          <div>{person.eligibleEvidenceRecordId ? <Link className="text-sm font-semibold text-primary-blue underline" to={evidencePathWithReturn(person.eligibleEvidenceRecordId,{kind:"FACILITY_ASSESSMENT",clientId,facilityId,categoryCode})}>View eligible evidence</Link> : person.trainingEnrollmentId && template ? <button className="text-sm font-semibold text-primary-blue underline" onClick={()=>onOpenForm({formCode:"F021",templateCode:template.template_code,templateName:template.template_name,categoryName,contextId:person.trainingEnrollmentId ?? undefined})} type="button">{person.status==="SUPERSEDED"?"Create current F021":"Create F021"}</button> : <span className="text-sm font-medium text-amber-800">Registration or enrollment required</span>}</div>
        </li>)}</ul> : <p className="mt-3 rounded-component bg-elevated p-3 text-sm text-text-muted">No personnel match this search and filter.</p>}
      </div>
    </details>
  </li>;
}

function StatusBadge({ source, blocker }: { source?: OriReadinessSource; blocker?: string }) {
  if (source) return <span className="rounded-full border border-green-300 bg-green-50 px-3 py-1 text-xs font-bold text-green-800">Final</span>;
  const label = blocker === "CATEGORY_INDEX_MISSING" ? "Index missing" : blocker === "CATEGORY_AUTHORITY_INCOMPATIBLE" ? "Authority blocked" : blocker === "EMERGENCY_LEGACY_ONLY" ? "Legacy only" : "Final required";
  return <span className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-bold text-amber-800">{label}</span>;
}

function AssessmentFormWorkspace({ assessorName, clientName, clientIdentifier, facilityName, facilityIdentifier, facilityType, clientId, facilityId, workspace, dirty, onDirtyChange, onRecordCreated, onClose }: { assessorName?: string; clientName: string; clientIdentifier?: string; facilityName: string; facilityIdentifier?: string; facilityType?: string; clientId: string; facilityId: string; workspace: FormWorkspace; dirty: boolean; onDirtyChange: (dirty: boolean) => void; onRecordCreated: (recordId: string) => void; onClose: () => void }) {
  const f002FacilityType = mapRegistrationFacilityTypeToF002(facilityType);
  const scopeInitialFieldValues = useMemo(() => ({
    ...(clientIdentifier ? {
      CLIENT_ID: clientIdentifier,
      CLIENT_NUMBER: clientIdentifier,
      CLIENT_ORGANIZATION_ID: clientIdentifier
    } : {}),
    ...(facilityIdentifier ? {
      FACILITY_ID: facilityIdentifier,
      FACILITY_NUMBER: facilityIdentifier
    } : {}),
    FACILITY_NAME: facilityName,
    CLIENT_NAME: clientName,
    CLIENT_ORGANIZATION: clientName,
    ORGANIZATION_NAME: clientName,
    ...(workspace.templateCode === "OGI_F002_FACILITY_PROFILE_BASELINE_INTELLIGENCE_ASSESSMENT" && f002FacilityType
      ? { FACILITY_TYPE: [f002FacilityType] }
      : {}),
    ...(workspace.templateCode === "OGI_F002_FACILITY_PROFILE_BASELINE_INTELLIGENCE_ASSESSMENT" && assessorName
      ? { ASSESSOR: assessorName, ASSESSMENT_DATE: currentLocalDate() }
      : {})
  }), [assessorName, clientIdentifier, clientName, f002FacilityType, facilityIdentifier, facilityName, workspace.templateCode]);
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, []);
  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [dirty, onClose]);
  return <div aria-labelledby="assessment-form-workspace-title" aria-modal="true" className="fixed inset-0 z-[80] flex flex-col bg-workspace-canvas" role="dialog">
    <header className="flex shrink-0 flex-wrap items-center justify-between gap-4 border-b border-workspace-border bg-[linear-gradient(90deg,#e8f1fc,white)] px-5 py-4 shadow-sm">
      <div className="min-w-0"><p className="text-xs font-bold uppercase tracking-wide text-primary-blue">{workspace.categoryName} · {workspace.formCode}</p><h2 className="mt-1 truncate text-xl font-semibold text-primary-navy" id="assessment-form-workspace-title">{workspace.templateName}</h2><p className="mt-1 text-sm text-text-muted">{clientName} · {facilityName} · {workspace.recordId ? "Existing record" : "New form"}</p></div>
      <div className="flex items-center gap-3"><div className="flex flex-wrap items-center gap-2" id="assessment-journey-form-actions" />{dirty ? <span className="text-xs font-bold uppercase text-state-warning">Unsaved changes</span> : null}<button className="min-h-11 rounded-component border border-primary-blue bg-white px-4 font-semibold text-primary-blue hover:bg-blue-50" onClick={onClose} type="button">← Back to Facility Assessment Journey</button></div>
    </header>
    <main className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6" onChangeCapture={() => { if (!workspace.recordId) onDirtyChange(true); }} onInputCapture={() => { if (!workspace.recordId) onDirtyChange(true); }}>
      <div className="mx-auto max-w-[90rem]">{workspace.recordId ? <OperationalEvidenceRecordPage actionPortalId="assessment-journey-form-actions" embeddedRecordId={workspace.recordId} onDirtyChange={onDirtyChange} /> : <RuntimeTemplatePage actionPortalId="assessment-journey-form-actions" embeddedTemplateCode={workspace.templateCode} initialClientId={clientId} initialContextId={workspace.contextId} initialFacilityId={facilityId} initialFieldValues={scopeInitialFieldValues} lockInitialContext={Boolean(workspace.contextId)} lockInitialScope onDirtyChange={onDirtyChange} onDraftCreated={onRecordCreated} />}</div>
    </main>
  </div>;
}

function mapRegistrationFacilityTypeToF002(facilityType?: string) {
  // Only an exact vocabulary match is projected. Other registration types
  // require an explicit auditor choice because F002 uses a different taxonomy.
  return facilityType === "WATERPARK" ? "WATERPARK" : null;
}

function templateMatchesFormCode(template: OetsTemplateCatalogItem, formCode: string) {
  const digits = formCode.slice(1);
  return template.document_number?.toUpperCase().replaceAll("-", "").includes(formCode)
    || new RegExp(`(?:^|_)F0*${Number(digits)}(?:_|$)`, "i").test(template.template_code);
}

function humanize(value: string) { return value.toLowerCase().replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase()); }

function currentLocalDate() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

function categoryName(code: string) {
  return categories.find((category) => category.code === code)?.name ?? humanize(code);
}

function blockerMessage(code: string) {
  if (code === "MISSING_FACILITY_WIDE_FINAL") return "facility-wide final required";
  if (code === "CATEGORY_INDEX_MISSING") return "professional category index required";
  if (code === "CATEGORY_AUTHORITY_INCOMPATIBLE") return "approved category authority required";
  if (code === "EMERGENCY_LEGACY_ONLY") return "successor professional assessment required";
  return humanize(code);
}

function formatScore(value: string) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric.toFixed(2).replace(/\.00$/, "") : value;
}

function formatPercent(value: string) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? `${(numeric * 100).toFixed(0)}%` : value;
}

function formatDateTime(value: string | null) {
  if (!value) return "unknown time";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}
