import { FormEvent, ReactNode, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { isApiError } from "../api/errors";
import { useAuth } from "../auth/useAuth";
import { Button } from "../ui/components/Button";
import { Surface } from "../ui/components/Surface";
import {
  CredentialsCertificationEndorsementProjection,
  CredentialsCertificationProjection,
  CredentialsPersonnelDetailProjection,
  CredentialsPersonnelProjection,
  getPersonnelCredentials,
  listCredentials
} from "../credentials/credentialsApi";
import {
  addCertificationEndorsement,
  CertificationEndorsement,
  certificationEndorsements,
  CertificationLevel,
  certificationLevels,
  createCertification
} from "./certificationsApi";
import { CertificationWorkspaceTabs } from "./CertificationWorkspaceTabs";

const viewCertificationPermission = "view_certification";
const viewPersonnelPermission = "view_staff_member";
const createDraftPermission = "create_certification_draft";
const issueCertificationPermission = "issue_certification";
const endorseCertificationPermission = "endorse_certification";

interface CertificationRegistryEntry {
  readonly certificationId: string;
  readonly staffMemberId: string;
  readonly personnelName: string;
  readonly clientName: string;
  readonly label: string;
  readonly status: string;
  readonly issueDate: string | null;
  readonly expiryDate: string | null;
}

interface CreateCertificationFormState {
  staffMemberId: string;
  certificationLevel: CertificationLevel;
  certificationNumber: string;
  issueDate: string;
  expiryDate: string;
  certificationStatus: "PENDING" | "ACTIVE";
  medicalClearanceProvided: boolean;
  fitnessStandardAchieved: boolean;
  trainingHoursCompleted: string;
  writtenExamScore: string;
}

interface EndorsementFormState {
  endorsement: CertificationEndorsement;
}

const emptyForm: CreateCertificationFormState = {
  staffMemberId: "",
  certificationLevel: "L1",
  certificationNumber: "",
  issueDate: "",
  expiryDate: "",
  certificationStatus: "PENDING",
  medicalClearanceProvided: false,
  fitnessStandardAchieved: false,
  trainingHoursCompleted: "",
  writtenExamScore: ""
};

const emptyEndorsementForm: EndorsementFormState = {
  endorsement: "POOL"
};

export function CertificationsPage() {
  const auth = useAuth();
  const queryClient = useQueryClient();
  const canViewCertifications = auth.canUsePermission(viewCertificationPermission);
  const canViewPersonnel = auth.canUsePermission(viewPersonnelPermission);
  const canCreateDraft = auth.canUsePermission(createDraftPermission);
  const canIssueCertification = auth.canUsePermission(issueCertificationPermission);
  const canEndorseCertification = auth.canUsePermission(endorseCertificationPermission);
  const [selectedCertificationId, setSelectedCertificationId] = useState<string | null>(null);
  const [createMode, setCreateMode] = useState(false);
  const [endorsementMode, setEndorsementMode] = useState(false);
  const [form, setForm] = useState<CreateCertificationFormState>(emptyForm);
  const [endorsementForm, setEndorsementForm] = useState<EndorsementFormState>(
    emptyEndorsementForm
  );
  const [endorsementSuccess, setEndorsementSuccess] = useState<string | null>(null);

  const credentialsQuery = useQuery({
    queryKey: ["credentials", "certifications-workspace"],
    queryFn: () => listCredentials(),
    enabled: canViewCertifications && canViewPersonnel,
    retry: false
  });

  const personnel = useMemo(
    () => credentialsQuery.data?.personnel ?? [],
    [credentialsQuery.data]
  );
  const registryEntries = useMemo(
    () => certificationEntriesFromPersonnel(personnel),
    [personnel]
  );
  const selectedEntry =
    registryEntries.find((entry) => entry.certificationId === selectedCertificationId) ?? null;
  const selectedDetailQueryKey = [
    "credentials-personnel",
    selectedEntry?.staffMemberId,
    "certification-detail"
  ] as const;

  const detailQuery = useQuery({
    queryKey: selectedDetailQueryKey,
    queryFn: () => getPersonnelCredentials(selectedEntry?.staffMemberId ?? ""),
    enabled: canViewCertifications && canViewPersonnel && Boolean(selectedEntry),
    retry: false
  });

  const createMutation = useMutation({
    mutationFn: () =>
      createCertification({
        certification_level: form.certificationLevel,
        certification_number: form.certificationNumber.trim(),
        issue_date: toIsoDate(form.issueDate),
        expiry_date: toIsoDate(form.expiryDate),
        medical_clearance_provided: form.medicalClearanceProvided,
        fitness_standard_achieved: form.fitnessStandardAchieved,
        ...(form.trainingHoursCompleted
          ? { training_hours_completed: Number(form.trainingHoursCompleted) }
          : {}),
        ...(form.writtenExamScore
          ? { written_exam_score: Number(form.writtenExamScore) }
          : {}),
        certification_status: form.certificationStatus,
        staff_member_id: form.staffMemberId
      }),
    onSuccess: async (certification) => {
      setCreateMode(false);
      setForm(emptyForm);
      setSelectedCertificationId(certification.id);
      await queryClient.invalidateQueries({ queryKey: ["credentials"] });
    }
  });

  const endorsementMutation = useMutation({
    mutationFn: (payload: {
      certificationId: string;
      endorsement: CertificationEndorsement;
    }) =>
      addCertificationEndorsement(payload.certificationId, {
        endorsement: payload.endorsement
      }),
    onSuccess: async (_endorsement, payload) => {
      setEndorsementMode(false);
      setEndorsementForm(emptyEndorsementForm);
      setEndorsementSuccess(
        `${displayCode(payload.endorsement)} endorsement added successfully.`
      );
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["credentials"] }),
        queryClient.invalidateQueries({ queryKey: selectedDetailQueryKey })
      ]);
    },
    onError: async () => {
      if (selectedEntry) {
        await queryClient.invalidateQueries({ queryKey: selectedDetailQueryKey });
      }
    }
  });

  const selectedCertification = detailQuery.data
    ? findCertification(detailQuery.data, selectedCertificationId)
    : null;

  if (!canViewCertifications) {
    return (
      <CertificationWorkspaceFrame>
        <SafeState title="Certifications are not available with your current authorization.">
          Your current session does not include Certification viewing authority.
        </SafeState>
      </CertificationWorkspaceFrame>
    );
  }

  if (!canViewPersonnel) {
    return (
      <CertificationWorkspaceFrame>
        <SafeState title="Certification records cannot be loaded from the current read projection.">
          The committed Certification read source requires Personnel credential viewing authority.
        </SafeState>
      </CertificationWorkspaceFrame>
    );
  }

  return (
    <CertificationWorkspaceFrame>
      <section aria-labelledby="certifications-heading" className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-primary-blue">
              Certifications
            </p>
            <h1
              className="mt-2 text-2xl font-semibold text-text-primary"
              id="certifications-heading"
            >
              Certification Registry
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-text-muted">
              View Personnel-linked Certification records and create governed Certification records without issuing credentials or changing Operational Authorizations.
            </p>
          </div>
          {canCreateDraft ? (
            <Button
              onClick={() => {
                setCreateMode(true);
                setEndorsementMode(false);
                setEndorsementSuccess(null);
                endorsementMutation.reset();
              }}
            >
              Create Certification
            </Button>
          ) : null}
        </div>

        {credentialsQuery.isLoading ? (
          <SafeState title="Loading certification records." role="status">
            Please wait.
          </SafeState>
        ) : credentialsQuery.isError ? (
          <CertificationErrorState error={credentialsQuery.error} />
        ) : (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(22rem,0.9fr)]">
            <CertificationRegistry
              entries={registryEntries}
              onSelect={(entry) => {
                setCreateMode(false);
                setEndorsementMode(false);
                setEndorsementSuccess(null);
                endorsementMutation.reset();
                setSelectedCertificationId(entry.certificationId);
              }}
              selectedCertificationId={selectedCertificationId}
            />
            {createMode ? (
              <CreateCertificationPanel
                canIssueCertification={canIssueCertification}
                form={form}
                mutationError={createMutation.error}
                onCancel={() => setCreateMode(false)}
                onChange={setForm}
                onSubmit={(event) => {
                  event.preventDefault();
                  createMutation.mutate();
                }}
                personnel={personnel}
                submitting={createMutation.isPending}
              />
            ) : selectedEntry ? (
              <CertificationDetailPanel
                canEndorseCertification={canEndorseCertification}
                certification={selectedCertification}
                detail={detailQuery.data ?? null}
                endorsementForm={endorsementForm}
                endorsementMode={endorsementMode}
                endorsementMutationError={endorsementMutation.error}
                endorsementSuccess={endorsementSuccess}
                endorsing={endorsementMutation.isPending}
                entry={selectedEntry}
                error={detailQuery.error}
                loading={detailQuery.isLoading}
                onCancelEndorsement={() => {
                  setEndorsementMode(false);
                  setEndorsementForm(emptyEndorsementForm);
                  endorsementMutation.reset();
                }}
                onChangeEndorsement={setEndorsementForm}
                onStartEndorsement={() => {
                  setEndorsementMode(true);
                  setEndorsementSuccess(null);
                  endorsementMutation.reset();
                }}
                onSubmitEndorsement={(event) => {
                  event.preventDefault();
                  if (!selectedCertificationId) {
                    return;
                  }
                  endorsementMutation.mutate({
                    certificationId: selectedCertificationId,
                    endorsement: endorsementForm.endorsement
                  });
                }}
              />
            ) : (
              <Surface>
                <h2 className="text-base font-semibold text-text-primary">
                  Select a Certification
                </h2>
                <p className="mt-2 text-sm leading-6 text-text-muted">
                  Choose a Certification record from the registry to view its Personnel context and read-only detail.
                </p>
              </Surface>
            )}
          </div>
        )}
      </section>
    </CertificationWorkspaceFrame>
  );
}

function CertificationWorkspaceFrame({ children }: { children: ReactNode }) {
  return (
    <div className="space-y-4">
      <CertificationWorkspaceTabs />
      {children}
    </div>
  );
}

function CertificationRegistry({
  entries,
  onSelect,
  selectedCertificationId
}: {
  entries: CertificationRegistryEntry[];
  onSelect: (entry: CertificationRegistryEntry) => void;
  selectedCertificationId: string | null;
}) {
  if (entries.length === 0) {
    return (
      <Surface>
        <h2 className="text-base font-semibold text-text-primary">
          No certifications found.
        </h2>
        <p className="mt-2 text-sm text-text-muted">
          The current Credentials projection did not return Certification records for your authority.
        </p>
      </Surface>
    );
  }

  return (
    <Surface>
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-border text-xs uppercase tracking-wide text-text-muted">
            <tr>
              <th className="px-3 py-3 font-semibold" scope="col">
                Personnel
              </th>
              <th className="px-3 py-3 font-semibold" scope="col">
                Certification
              </th>
              <th className="px-3 py-3 font-semibold" scope="col">
                Status
              </th>
              <th className="px-3 py-3 font-semibold" scope="col">
                Validity
              </th>
              <th className="px-3 py-3 font-semibold" scope="col">
                Detail
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {entries.map((entry) => (
              <tr key={entry.certificationId}>
                <th className="px-3 py-4 align-top font-semibold text-text-primary" scope="row">
                  <span className="block break-words">{entry.personnelName}</span>
                  <span className="mt-1 block text-xs font-normal text-text-muted">
                    {entry.clientName}
                  </span>
                </th>
                <td className="px-3 py-4 align-top text-text-primary">
                  {entry.label}
                </td>
                <td className="px-3 py-4 align-top">
                  <StatusBadge value={entry.status} />
                </td>
                <td className="px-3 py-4 align-top text-text-primary">
                  {formatDate(entry.issueDate)} to {formatDate(entry.expiryDate)}
                </td>
                <td className="px-3 py-4 align-top">
                  <Button
                    onClick={() => onSelect(entry)}
                    variant={
                      selectedCertificationId === entry.certificationId
                        ? "primary"
                        : "secondary"
                    }
                  >
                    View Certification
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Surface>
  );
}

function CertificationDetailPanel({
  canEndorseCertification,
  certification,
  detail,
  endorsementForm,
  endorsementMode,
  endorsementMutationError,
  endorsementSuccess,
  endorsing,
  entry,
  error,
  loading,
  onCancelEndorsement,
  onChangeEndorsement,
  onStartEndorsement,
  onSubmitEndorsement
}: {
  canEndorseCertification: boolean;
  certification: CredentialsCertificationProjection | null;
  detail: CredentialsPersonnelDetailProjection | null;
  endorsementForm: EndorsementFormState;
  endorsementMode: boolean;
  endorsementMutationError: Error | null;
  endorsementSuccess: string | null;
  endorsing: boolean;
  entry: CertificationRegistryEntry;
  error: Error | null;
  loading: boolean;
  onCancelEndorsement: () => void;
  onChangeEndorsement: (form: EndorsementFormState) => void;
  onStartEndorsement: () => void;
  onSubmitEndorsement: (event: FormEvent<HTMLFormElement>) => void;
}) {
  if (loading) {
    return (
      <SafeState title="Loading certification detail." role="status">
        Please wait.
      </SafeState>
    );
  }

  if (error) {
    return <CertificationErrorState error={error} />;
  }

  if (!detail || !certification) {
    return (
      <SafeState title="Certification detail was not returned.">
        The Credentials projection did not return detail for the selected Certification.
      </SafeState>
    );
  }

  return (
    <Surface>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-primary-blue">
            Selected Certification
          </p>
          <h2 className="mt-2 text-xl font-semibold text-text-primary">
            {programLabel(certification)}
          </h2>
          <p className="mt-1 text-sm text-text-muted">{detail.full_name}</p>
        </div>
        <StatusBadge value={certification.certification_status} />
      </div>
      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
        <MetadataItem label="Personnel" value={detail.full_name} />
        <MetadataItem label="Client" value={detail.client.organization_name} />
        <MetadataItem label="Certification number" value={certification.certification_number} />
        <MetadataItem label="Issue date" value={formatDate(certification.issue_date)} />
        <MetadataItem label="Expiry date" value={formatDate(certification.expiry_date)} />
        <MetadataItem label="Medical clearance" value={yesNo(certification.medical_clearance_provided)} />
        <MetadataItem label="Fitness standard" value={yesNo(certification.fitness_standard_achieved)} />
        <MetadataItem
          label="Training hours"
          value={certification.training_hours_completed?.toString() ?? "Not specified"}
        />
        <MetadataItem
          label="Written exam score"
          value={certification.written_exam_score?.toString() ?? "Not specified"}
        />
        <MetadataItem label="Certification ID" value={entry.certificationId} />
      </dl>
      <EndorsementsSection
        canEndorseCertification={canEndorseCertification}
        certification={certification}
        endorsementForm={endorsementForm}
        endorsementMode={endorsementMode}
        error={endorsementMutationError}
        onCancel={onCancelEndorsement}
        onChange={onChangeEndorsement}
        onStart={onStartEndorsement}
        onSubmit={onSubmitEndorsement}
        successMessage={endorsementSuccess}
        submitting={endorsing}
      />
      <p className="mt-4 text-xs text-text-muted">
        Operational Authorization lifecycle actions are read-only in this workspace slice.
      </p>
    </Surface>
  );
}

function EndorsementsSection({
  canEndorseCertification,
  certification,
  endorsementForm,
  endorsementMode,
  error,
  onCancel,
  onChange,
  onStart,
  onSubmit,
  successMessage,
  submitting
}: {
  canEndorseCertification: boolean;
  certification: CredentialsCertificationProjection;
  endorsementForm: EndorsementFormState;
  endorsementMode: boolean;
  error: Error | null;
  onCancel: () => void;
  onChange: (form: EndorsementFormState) => void;
  onStart: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  successMessage: string | null;
  submitting: boolean;
}) {
  const endorsements = endorsementsByMostRecent(certification.endorsements);

  return (
    <section aria-labelledby="certification-endorsements-heading" className="mt-5 border-t border-border pt-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3
            className="text-base font-semibold text-text-primary"
            id="certification-endorsements-heading"
          >
            Endorsements
          </h3>
          <p className="mt-1 text-sm text-text-muted">
            Endorsements are attached to the selected Certification record.
          </p>
        </div>
        {canEndorseCertification && !endorsementMode ? (
          <Button onClick={onStart} variant="secondary">
            Add Endorsement
          </Button>
        ) : null}
      </div>

      {successMessage ? (
        <p className="mt-3 rounded-component border border-border bg-elevated px-3 py-2 text-sm text-text-primary" role="status">
          {successMessage}
        </p>
      ) : null}

      {endorsements.length === 0 ? (
        <p className="mt-3 text-sm text-text-muted">No endorsements recorded.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {endorsements.map((endorsement) => (
            <li
              className="rounded-component border border-border bg-elevated px-3 py-2"
              key={`${certification.id}-${endorsement.endorsement}`}
            >
              <p className="text-sm font-semibold text-text-primary">
                {displayCode(endorsement.endorsement)}
              </p>
              <p className="mt-1 text-xs text-text-muted">
                Recorded {formatDate(endorsement.created_at)}
              </p>
            </li>
          ))}
        </ul>
      )}

      {endorsementMode ? (
        <form className="mt-4 space-y-4 rounded-component border border-border bg-surface p-4" onSubmit={onSubmit}>
          <div>
            <h4 className="text-sm font-semibold text-text-primary">
              Add Endorsement
            </h4>
            <p className="mt-1 text-sm text-text-muted">
              Endorsing {programLabel(certification)} certificate {certification.certification_number}.
            </p>
          </div>
          {error ? <CertificationErrorState compact error={error} operation="endorsement" /> : null}
          <label className="block text-sm font-semibold text-text-primary">
            Endorsement
            <select
              className={inputClassName}
              onChange={(event) =>
                onChange({
                  endorsement: event.currentTarget.value as CertificationEndorsement
                })
              }
              value={endorsementForm.endorsement}
            >
              {certificationEndorsements.map((endorsement) => (
                <option key={endorsement} value={endorsement}>
                  {displayCode(endorsement)}
                </option>
              ))}
            </select>
          </label>
          <div className="flex flex-wrap gap-2">
            <Button disabled={submitting} type="submit">
              {submitting ? "Adding Endorsement" : "Add Endorsement"}
            </Button>
            <Button disabled={submitting} onClick={onCancel} type="button" variant="secondary">
              Cancel
            </Button>
          </div>
        </form>
      ) : null}
    </section>
  );
}

function CreateCertificationPanel({
  canIssueCertification,
  form,
  mutationError,
  onCancel,
  onChange,
  onSubmit,
  personnel,
  submitting
}: {
  canIssueCertification: boolean;
  form: CreateCertificationFormState;
  mutationError: Error | null;
  onCancel: () => void;
  onChange: (form: CreateCertificationFormState) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  personnel: CredentialsPersonnelProjection[];
  submitting: boolean;
}) {
  return (
    <Surface>
      <h2 className="text-base font-semibold text-text-primary">
        Create Certification
      </h2>
      <p className="mt-2 text-sm leading-6 text-text-muted">
        Create a Personnel-linked Certification record through the governed backend command surface.
      </p>
      {mutationError ? <CertificationErrorState error={mutationError} compact /> : null}
      <form className="mt-4 space-y-4" onSubmit={onSubmit}>
        <label className="block text-sm font-semibold text-text-primary">
          Personnel
          <select
            className={inputClassName}
            onChange={(event) =>
              onChange({ ...form, staffMemberId: event.currentTarget.value })
            }
            required
            value={form.staffMemberId}
          >
            <option value="">Select Personnel</option>
            {personnel.map((person) => (
              <option key={person.id} value={person.id}>
                {person.full_name} / {person.client.organization_name}
              </option>
            ))}
          </select>
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm font-semibold text-text-primary">
            Certification level
            <select
              className={inputClassName}
              onChange={(event) =>
                onChange({
                  ...form,
                  certificationLevel: event.currentTarget.value as CertificationLevel
                })
              }
              value={form.certificationLevel}
            >
              {certificationLevels.map((level) => (
                <option key={level} value={level}>
                  {level}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-semibold text-text-primary">
            Status
            <select
              className={inputClassName}
              onChange={(event) =>
                onChange({
                  ...form,
                  certificationStatus: event.currentTarget.value as "PENDING" | "ACTIVE"
                })
              }
              value={form.certificationStatus}
            >
              <option value="PENDING">Draft</option>
              {canIssueCertification ? <option value="ACTIVE">Active</option> : null}
            </select>
          </label>
        </div>
        <label className="block text-sm font-semibold text-text-primary">
          Certification number
          <input
            className={inputClassName}
            onChange={(event) =>
              onChange({ ...form, certificationNumber: event.currentTarget.value })
            }
            required
            value={form.certificationNumber}
          />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm font-semibold text-text-primary">
            Issue date
            <input
              className={inputClassName}
              onChange={(event) =>
                onChange({ ...form, issueDate: event.currentTarget.value })
              }
              required
              type="date"
              value={form.issueDate}
            />
          </label>
          <label className="block text-sm font-semibold text-text-primary">
            Expiry date
            <input
              className={inputClassName}
              onChange={(event) =>
                onChange({ ...form, expiryDate: event.currentTarget.value })
              }
              required
              type="date"
              value={form.expiryDate}
            />
          </label>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex items-center gap-2 text-sm font-semibold text-text-primary">
            <input
              checked={form.medicalClearanceProvided}
              onChange={(event) =>
                onChange({
                  ...form,
                  medicalClearanceProvided: event.currentTarget.checked
                })
              }
              type="checkbox"
            />
            Medical clearance provided
          </label>
          <label className="flex items-center gap-2 text-sm font-semibold text-text-primary">
            <input
              checked={form.fitnessStandardAchieved}
              onChange={(event) =>
                onChange({
                  ...form,
                  fitnessStandardAchieved: event.currentTarget.checked
                })
              }
              type="checkbox"
            />
            Fitness standard achieved
          </label>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm font-semibold text-text-primary">
            Training hours
            <input
              className={inputClassName}
              min="0"
              onChange={(event) =>
                onChange({
                  ...form,
                  trainingHoursCompleted: event.currentTarget.value
                })
              }
              type="number"
              value={form.trainingHoursCompleted}
            />
          </label>
          <label className="block text-sm font-semibold text-text-primary">
            Written exam score
            <input
              className={inputClassName}
              min="0"
              onChange={(event) =>
                onChange({ ...form, writtenExamScore: event.currentTarget.value })
              }
              type="number"
              value={form.writtenExamScore}
            />
          </label>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button disabled={submitting} type="submit">
            {submitting ? "Creating Certification" : "Create Certification"}
          </Button>
          <Button onClick={onCancel} type="button" variant="secondary">
            Cancel
          </Button>
        </div>
      </form>
    </Surface>
  );
}

function certificationEntriesFromPersonnel(
  personnel: CredentialsPersonnelProjection[]
): CertificationRegistryEntry[] {
  return personnel.flatMap((person) =>
    person.qualifications
      .filter((qualification) => qualification.source_type === "CERTIFICATION")
      .map((qualification) => ({
        certificationId: qualification.source_id,
        staffMemberId: person.id,
        personnelName: person.full_name,
        clientName: person.client.organization_name,
        label: qualification.label,
        status: qualification.status,
        issueDate: qualification.issue_date,
        expiryDate: qualification.expiry_date
      }))
  );
}

function findCertification(
  detail: CredentialsPersonnelDetailProjection,
  certificationId: string | null
) {
  return detail.certifications.find((certification) => certification.id === certificationId) ?? null;
}

function CertificationErrorState({
  compact = false,
  error,
  operation = "certification"
}: {
  compact?: boolean;
  error: Error;
  operation?: "certification" | "endorsement";
}) {
  const title = certificationErrorTitle(error, operation);

  if (compact) {
    return (
      <div className="mt-3 rounded-component border border-border bg-elevated px-3 py-2 text-sm text-text-primary" role="alert">
        {title}
      </div>
    );
  }

  return <SafeState title={title}>The Certification workspace returned an error.</SafeState>;
}

function certificationErrorTitle(
  error: Error,
  operation: "certification" | "endorsement" = "certification"
) {
  if (!isApiError(error)) {
    return operation === "endorsement"
      ? "Certification endorsement could not be added."
      : "Certifications could not be loaded.";
  }

  if (error.status === 400 || error.status === 422) {
    return operation === "endorsement"
      ? "Certification endorsement input is invalid."
      : "Certification input is invalid.";
  }

  if (error.status === 403) {
    return operation === "endorsement"
      ? "Certification endorsement is not available with your current authorization."
      : "Certifications are not available with your current authorization.";
  }

  if (error.status === 404) {
    return operation === "endorsement"
      ? "Certification is unavailable or outside your scope."
      : "Certification or Personnel detail was not found.";
  }

  if (error.status === 409) {
    return operation === "endorsement"
      ? "Certification endorsement could not be added because of a conflict."
      : "Certification could not be created because of a conflict.";
  }

  return operation === "endorsement"
    ? "Certification endorsement could not be added."
    : "Certifications could not be loaded.";
}

function SafeState({
  title,
  children,
  role
}: {
  title: string;
  children: string;
  role?: "status";
}) {
  return (
    <Surface role={role}>
      <h1 className="text-xl font-semibold text-text-primary">{title}</h1>
      <p className="mt-2 text-sm text-text-muted">{children}</p>
    </Surface>
  );
}

function MetadataItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-semibold uppercase tracking-wide text-text-muted">
        {label}
      </dt>
      <dd className="mt-1 break-words text-text-primary">{value}</dd>
    </div>
  );
}

function StatusBadge({ value }: { value: string }) {
  return (
    <span className="inline-flex rounded-component border border-border bg-surface px-2 py-1 text-xs font-semibold uppercase tracking-wide text-text-primary">
      {displayCode(value)}
    </span>
  );
}

function programLabel(certification: CredentialsCertificationProjection) {
  return certification.program?.display_name ?? certification.certification_level;
}

function endorsementsByMostRecent(
  endorsements: CredentialsCertificationEndorsementProjection[]
) {
  return endorsements.slice().sort((left, right) =>
    right.created_at.localeCompare(left.created_at)
  );
}

function toIsoDate(value: string) {
  return `${value}T00:00:00.000Z`;
}

function formatDate(value: string | null) {
  if (!value) {
    return "Not specified";
  }

  return value.slice(0, 10);
}

function displayCode(value: string) {
  return value
    .split("_")
    .map((part) => `${part.slice(0, 1)}${part.slice(1).toLowerCase()}`)
    .join(" ");
}

function yesNo(value: boolean) {
  return value ? "Yes" : "No";
}

const inputClassName =
  "mt-2 min-h-10 w-full rounded-component border border-border bg-surface px-3 py-2 text-sm text-text-primary outline-none focus:border-focus focus:ring-2 focus:ring-focus";
