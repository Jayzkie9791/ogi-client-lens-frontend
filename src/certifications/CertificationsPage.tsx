import { FormEvent, ReactNode, useMemo, useState } from "react";
import { QueryClient, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { routes } from "../app/routePaths";
import { isApiError } from "../api/errors";
import { useAuth } from "../auth/useAuth";
import { Button } from "../ui/components/Button";
import { Surface } from "../ui/components/Surface";
import {
  CredentialsCertificationEndorsementProjection,
  CredentialsCertificationProjection,
  CredentialIssuanceResponse,
  CredentialsOperationalAuthorizationProjection,
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
import { issueCredential } from "./credentialIssuanceApi";
import {
  createOperationalAuthorization,
  GovernOperationalAuthorizationRequest,
  reinstateOperationalAuthorization,
  renewOperationalAuthorization,
  revokeOperationalAuthorization,
  suspendOperationalAuthorization
} from "./operationalAuthorizationApi";

const viewCertificationPermission = "view_certification";
const viewPersonnelPermission = "view_staff_member";
const createDraftPermission = "create_certification_draft";
const issueCertificationPermission = "issue_certification";
const endorseCertificationPermission = "endorse_certification";
const viewOperationalAuthorizationPermission = "view_operational_authorization";
const createOperationalAuthorizationPermission = "create_operational_authorization";
const renewOperationalAuthorizationPermission = "renew_operational_authorization";
const suspendOperationalAuthorizationPermission = "suspend_operational_authorization";
const reinstateOperationalAuthorizationPermission = "reinstate_operational_authorization";
const revokeOperationalAuthorizationPermission = "revoke_operational_authorization";

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

type AuthorizationMode = "create" | "renew" | "suspend" | "reinstate" | "revoke";

interface CreateAuthorizationFormState {
  authorizationNumber: string;
  authorizationLevel: CertificationLevel;
  issueDate: string;
  expiryDate: string;
}

interface AuthorizationGovernanceFormState {
  reason: string;
  notes: string;
}

interface CredentialIssuanceFormState {
  sourceEvidenceRecordId: string;
  completionDate: string;
  trainingLocation: string;
  instructor: string;
  trainingCenter: string;
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

const emptyCreateAuthorizationForm: CreateAuthorizationFormState = {
  authorizationNumber: "",
  authorizationLevel: "L1",
  issueDate: "",
  expiryDate: ""
};

const emptyAuthorizationGovernanceForm: AuthorizationGovernanceFormState = {
  reason: "",
  notes: ""
};

const emptyCredentialIssuanceForm: CredentialIssuanceFormState = {
  sourceEvidenceRecordId: "",
  completionDate: "",
  trainingLocation: "",
  instructor: "",
  trainingCenter: ""
};

export function CertificationsPage() {
  const auth = useAuth();
  const queryClient = useQueryClient();
  const canViewCertifications = auth.canUsePermission(viewCertificationPermission);
  const canViewPersonnel = auth.canUsePermission(viewPersonnelPermission);
  const canCreateDraft = auth.canUsePermission(createDraftPermission);
  const canIssueCertification = auth.canUsePermission(issueCertificationPermission);
  const canEndorseCertification = auth.canUsePermission(endorseCertificationPermission);
  const canViewOperationalAuthorization = auth.canUsePermission(viewOperationalAuthorizationPermission);
  const canCreateOperationalAuthorization = auth.canUsePermission(
    createOperationalAuthorizationPermission
  );
  const canRenewOperationalAuthorization = auth.canUsePermission(
    renewOperationalAuthorizationPermission
  );
  const canSuspendOperationalAuthorization = auth.canUsePermission(
    suspendOperationalAuthorizationPermission
  );
  const canReinstateOperationalAuthorization = auth.canUsePermission(
    reinstateOperationalAuthorizationPermission
  );
  const canRevokeOperationalAuthorization = auth.canUsePermission(
    revokeOperationalAuthorizationPermission
  );
  const [selectedCertificationId, setSelectedCertificationId] = useState<string | null>(null);
  const [createMode, setCreateMode] = useState(false);
  const [endorsementMode, setEndorsementMode] = useState(false);
  const [authorizationMode, setAuthorizationMode] = useState<AuthorizationMode | null>(null);
  const [form, setForm] = useState<CreateCertificationFormState>(emptyForm);
  const [endorsementForm, setEndorsementForm] = useState<EndorsementFormState>(
    emptyEndorsementForm
  );
  const [endorsementSuccess, setEndorsementSuccess] = useState<string | null>(null);
  const [authorizationSuccess, setAuthorizationSuccess] = useState<string | null>(null);
  const [createAuthorizationForm, setCreateAuthorizationForm] =
    useState<CreateAuthorizationFormState>(emptyCreateAuthorizationForm);
  const [authorizationGovernanceForm, setAuthorizationGovernanceForm] =
    useState<AuthorizationGovernanceFormState>(emptyAuthorizationGovernanceForm);
  const [credentialIssuanceMode, setCredentialIssuanceMode] = useState(false);
  const [credentialIssuanceForm, setCredentialIssuanceForm] =
    useState<CredentialIssuanceFormState>(emptyCredentialIssuanceForm);
  const [credentialIssuanceSuccess, setCredentialIssuanceSuccess] =
    useState<string | null>(null);
  const [issuedCredential, setIssuedCredential] =
    useState<CredentialIssuanceResponse | null>(null);

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

  const createAuthorizationMutation = useMutation({
    mutationFn: () =>
      createOperationalAuthorization({
        authorization_number: createAuthorizationForm.authorizationNumber.trim(),
        authorization_level: createAuthorizationForm.authorizationLevel,
        issue_date: toIsoDate(createAuthorizationForm.issueDate),
        expiry_date: toIsoDate(createAuthorizationForm.expiryDate),
        certification_id: selectedCertificationId ?? "",
        staff_member_id: selectedEntry?.staffMemberId ?? ""
      }),
    onSuccess: async () => {
      setAuthorizationMode(null);
      setCreateAuthorizationForm(emptyCreateAuthorizationForm);
      setAuthorizationSuccess("Operational Authorization created successfully.");
      await invalidateAuthorizationQueries(queryClient, selectedDetailQueryKey);
    },
    onError: async () => {
      if (selectedEntry) {
        await queryClient.invalidateQueries({ queryKey: selectedDetailQueryKey });
      }
    }
  });

  const authorizationCommandMutation = useMutation({
    mutationFn: (payload: {
      authorizationId: string;
      mode: Exclude<AuthorizationMode, "create">;
    }) => {
      if (payload.mode === "renew") {
        return renewOperationalAuthorization(payload.authorizationId, {
          authorization_number: createAuthorizationForm.authorizationNumber.trim(),
          issue_date: toIsoDate(createAuthorizationForm.issueDate),
          expiry_date: toIsoDate(createAuthorizationForm.expiryDate)
        });
      }

      const governancePayload = governanceRequestBody(authorizationGovernanceForm);

      if (payload.mode === "suspend") {
        return suspendOperationalAuthorization(payload.authorizationId, governancePayload);
      }

      if (payload.mode === "reinstate") {
        return reinstateOperationalAuthorization(payload.authorizationId, governancePayload);
      }

      return revokeOperationalAuthorization(payload.authorizationId, governancePayload);
    },
    onSuccess: async (_authorization, payload) => {
      setAuthorizationMode(null);
      setCreateAuthorizationForm(emptyCreateAuthorizationForm);
      setAuthorizationGovernanceForm(emptyAuthorizationGovernanceForm);
      setAuthorizationSuccess(authorizationSuccessMessage(payload.mode));
      await invalidateAuthorizationQueries(queryClient, selectedDetailQueryKey);
    },
    onError: async () => {
      if (selectedEntry) {
        await queryClient.invalidateQueries({ queryKey: selectedDetailQueryKey });
      }
    }
  });
  const credentialIssuanceMutation = useMutation({
    mutationFn: (payload: { sourceAuthorizationId?: string }) =>
      issueCredential({
        certification_id: selectedCertificationId ?? "",
        source_evidence_record_id:
          credentialIssuanceForm.sourceEvidenceRecordId.trim(),
        ...(payload.sourceAuthorizationId
          ? { source_authorization_id: payload.sourceAuthorizationId }
          : {}),
        completion_date: credentialIssuanceForm.completionDate,
        training_location: credentialIssuanceForm.trainingLocation.trim(),
        instructor: credentialIssuanceForm.instructor.trim(),
        training_center: credentialIssuanceForm.trainingCenter.trim()
      }),
    onSuccess: async (issuance) => {
      setCredentialIssuanceMode(false);
      setCredentialIssuanceForm(emptyCredentialIssuanceForm);
      setIssuedCredential(issuance);
      setCredentialIssuanceSuccess("Credential issued successfully.");
      await invalidateAuthorizationQueries(queryClient, selectedDetailQueryKey);
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
                setCredentialIssuanceMode(false);
                setCredentialIssuanceSuccess(null);
                setIssuedCredential(null);
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
                authorizationCommandError={authorizationCommandMutation.error}
                authorizationCommandPending={authorizationCommandMutation.isPending}
                authorizationGovernanceForm={authorizationGovernanceForm}
                authorizationMode={authorizationMode}
                authorizationSuccess={authorizationSuccess}
                canCreateOperationalAuthorization={canCreateOperationalAuthorization}
                canEndorseCertification={canEndorseCertification}
                canIssueCertification={canIssueCertification}
                canReinstateOperationalAuthorization={canReinstateOperationalAuthorization}
                canRenewOperationalAuthorization={canRenewOperationalAuthorization}
                canRevokeOperationalAuthorization={canRevokeOperationalAuthorization}
                canSuspendOperationalAuthorization={canSuspendOperationalAuthorization}
                canViewOperationalAuthorization={canViewOperationalAuthorization}
                certification={selectedCertification}
                credentialIssuanceError={credentialIssuanceMutation.error}
                credentialIssuanceForm={credentialIssuanceForm}
                credentialIssuanceMode={credentialIssuanceMode}
                credentialIssuancePending={credentialIssuanceMutation.isPending}
                credentialIssuanceSuccess={credentialIssuanceSuccess}
                createAuthorizationError={createAuthorizationMutation.error}
                createAuthorizationForm={createAuthorizationForm}
                createAuthorizationPending={createAuthorizationMutation.isPending}
                detail={detailQuery.data ?? null}
                endorsementForm={endorsementForm}
                endorsementMode={endorsementMode}
                endorsementMutationError={endorsementMutation.error}
                endorsementSuccess={endorsementSuccess}
                endorsing={endorsementMutation.isPending}
                entry={selectedEntry}
                error={detailQuery.error}
                loading={detailQuery.isLoading}
                onCancelAuthorization={() => {
                  setAuthorizationMode(null);
                  setCreateAuthorizationForm(emptyCreateAuthorizationForm);
                  setAuthorizationGovernanceForm(emptyAuthorizationGovernanceForm);
                  createAuthorizationMutation.reset();
                  authorizationCommandMutation.reset();
                }}
                onCancelEndorsement={() => {
                  setEndorsementMode(false);
                  setEndorsementForm(emptyEndorsementForm);
                  endorsementMutation.reset();
                }}
                onChangeAuthorizationGovernance={setAuthorizationGovernanceForm}
                onChangeCreateAuthorization={setCreateAuthorizationForm}
                onChangeCredentialIssuance={setCredentialIssuanceForm}
                onChangeEndorsement={setEndorsementForm}
                onStartAuthorization={(mode) => {
                  setAuthorizationMode(mode);
                  setAuthorizationSuccess(null);
                  createAuthorizationMutation.reset();
                  authorizationCommandMutation.reset();
                }}
                onStartEndorsement={() => {
                  setEndorsementMode(true);
                  setEndorsementSuccess(null);
                  endorsementMutation.reset();
                }}
                onCancelCredentialIssuance={() => {
                  setCredentialIssuanceMode(false);
                  setCredentialIssuanceForm(emptyCredentialIssuanceForm);
                  credentialIssuanceMutation.reset();
                }}
                onStartCredentialIssuance={() => {
                  setCredentialIssuanceMode(true);
                  setCredentialIssuanceSuccess(null);
                  credentialIssuanceMutation.reset();
                }}
                onSubmitAuthorization={(event, authorization) => {
                  event.preventDefault();
                  if (authorizationMode === "create") {
                    createAuthorizationMutation.mutate();
                    return;
                  }

                  if (!authorization || !authorizationMode) {
                    return;
                  }

                  authorizationCommandMutation.mutate({
                    authorizationId: authorization.id,
                    mode: authorizationMode
                  });
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
                onSubmitCredentialIssuance={(event, authorization) => {
                  event.preventDefault();
                  credentialIssuanceMutation.mutate({
                    ...(authorization ? { sourceAuthorizationId: authorization.id } : {})
                  });
                }}
                issuedCredential={issuedCredential}
              />            ) : (
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
  authorizationCommandError,
  authorizationCommandPending,
  authorizationGovernanceForm,
  authorizationMode,
  authorizationSuccess,
  canCreateOperationalAuthorization,
  canEndorseCertification,
  canIssueCertification,
  canReinstateOperationalAuthorization,
  canRenewOperationalAuthorization,
  canRevokeOperationalAuthorization,
  canSuspendOperationalAuthorization,
  canViewOperationalAuthorization,
  certification,
  credentialIssuanceError,
  credentialIssuanceForm,
  credentialIssuanceMode,
  credentialIssuancePending,
  credentialIssuanceSuccess,
  createAuthorizationError,
  createAuthorizationForm,
  createAuthorizationPending,
  detail,
  endorsementForm,
  endorsementMode,
  endorsementMutationError,
  endorsementSuccess,
  endorsing,
  entry,
  error,
  loading,
  onCancelAuthorization,
  onCancelCredentialIssuance,
  onCancelEndorsement,
  onChangeAuthorizationGovernance,
  onChangeCreateAuthorization,
  onChangeCredentialIssuance,
  onChangeEndorsement,
  onStartAuthorization,
  onStartCredentialIssuance,
  onStartEndorsement,
  onSubmitAuthorization,
  onSubmitCredentialIssuance,
  issuedCredential,
  onSubmitEndorsement
}: {
  authorizationCommandError: Error | null;
  authorizationCommandPending: boolean;
  authorizationGovernanceForm: AuthorizationGovernanceFormState;
  authorizationMode: AuthorizationMode | null;
  authorizationSuccess: string | null;
  canCreateOperationalAuthorization: boolean;
  canEndorseCertification: boolean;
  canIssueCertification: boolean;
  canReinstateOperationalAuthorization: boolean;
  canRenewOperationalAuthorization: boolean;
  canRevokeOperationalAuthorization: boolean;
  canSuspendOperationalAuthorization: boolean;
  canViewOperationalAuthorization: boolean;
  certification: CredentialsCertificationProjection | null;
  credentialIssuanceError: Error | null;
  credentialIssuanceForm: CredentialIssuanceFormState;
  credentialIssuanceMode: boolean;
  credentialIssuancePending: boolean;
  credentialIssuanceSuccess: string | null;
  createAuthorizationError: Error | null;
  createAuthorizationForm: CreateAuthorizationFormState;
  createAuthorizationPending: boolean;
  detail: CredentialsPersonnelDetailProjection | null;
  endorsementForm: EndorsementFormState;
  endorsementMode: boolean;
  endorsementMutationError: Error | null;
  endorsementSuccess: string | null;
  endorsing: boolean;
  entry: CertificationRegistryEntry;
  error: Error | null;
  loading: boolean;
  onCancelAuthorization: () => void;
  onCancelCredentialIssuance: () => void;
  onCancelEndorsement: () => void;
  onChangeAuthorizationGovernance: (form: AuthorizationGovernanceFormState) => void;
  onChangeCreateAuthorization: (form: CreateAuthorizationFormState) => void;
  onChangeCredentialIssuance: (form: CredentialIssuanceFormState) => void;
  onChangeEndorsement: (form: EndorsementFormState) => void;
  onStartAuthorization: (mode: AuthorizationMode) => void;
  onStartCredentialIssuance: () => void;
  onStartEndorsement: () => void;
  onSubmitAuthorization: (
    event: FormEvent<HTMLFormElement>,
    authorization: CredentialsOperationalAuthorizationProjection | null
  ) => void;
  onSubmitCredentialIssuance: (
    event: FormEvent<HTMLFormElement>,
    authorization: CredentialsOperationalAuthorizationProjection | null
  ) => void;
  issuedCredential: CredentialIssuanceResponse | null;
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

  const linkedAuthorizations = authorizationsForCertification(
    detail.operational_authorizations,
    certification.id
  );
  const currentAuthorization = currentOperationalAuthorization(linkedAuthorizations);
  const knownIssuance =
    issuedCredential?.source_certification_id === certification.id
      ? issuedCredential
      : null;

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
      {canViewOperationalAuthorization ? (
        <OperationalAuthorizationSection
          authorizationCommandError={authorizationCommandError}
          authorizationCommandPending={authorizationCommandPending}
          authorizationGovernanceForm={authorizationGovernanceForm}
          authorizationMode={authorizationMode}
          authorizationSuccess={authorizationSuccess}
          authorizations={linkedAuthorizations}
          canCreate={canCreateOperationalAuthorization}
          canReinstate={canReinstateOperationalAuthorization}
          canRenew={canRenewOperationalAuthorization}
          canRevoke={canRevokeOperationalAuthorization}
          canSuspend={canSuspendOperationalAuthorization}
          certification={certification}
          createAuthorizationError={createAuthorizationError}
          createAuthorizationForm={createAuthorizationForm}
          createAuthorizationPending={createAuthorizationPending}
          detail={detail}
          onCancel={onCancelAuthorization}
          onChangeCreate={onChangeCreateAuthorization}
          onChangeGovernance={onChangeAuthorizationGovernance}
          onStart={onStartAuthorization}
          onSubmit={onSubmitAuthorization}
        />
      ) : null}
      <CredentialIssuanceSection
        authorization={canViewOperationalAuthorization ? currentAuthorization : null}
        canIssueCredential={canIssueCertification}
        certification={certification}
        error={credentialIssuanceError}
        form={credentialIssuanceForm}
        issuedCredential={knownIssuance}
        issueMode={credentialIssuanceMode}
        onCancel={onCancelCredentialIssuance}
        onChange={onChangeCredentialIssuance}
        onStart={onStartCredentialIssuance}
        onSubmit={onSubmitCredentialIssuance}
        successMessage={credentialIssuanceSuccess}
        submitting={credentialIssuancePending}
      />
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
  const existingEndorsements = endorsementsByMostRecent(certification.endorsements);

  return (
    <section
      aria-labelledby="certification-endorsements-heading"
      className="mt-5 border-t border-border pt-4"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3
            className="text-base font-semibold text-text-primary"
            id="certification-endorsements-heading"
          >
            Endorsements
          </h3>
          <p className="mt-1 text-sm text-text-muted">
            Endorsements extend the existing Certification record without issuing credentials.
          </p>
        </div>
        {canEndorseCertification && !endorsementMode ? (
          <Button onClick={onStart} variant="secondary">
            Add Endorsement
          </Button>
        ) : null}
      </div>

      {successMessage ? (
        <p
          className="mt-3 rounded-component border border-border bg-elevated px-3 py-2 text-sm text-text-primary"
          role="status"
        >
          {successMessage}
        </p>
      ) : null}

      {existingEndorsements.length === 0 ? (
        <p className="mt-3 text-sm text-text-muted">No endorsements recorded.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {existingEndorsements.map((endorsement) => (
              <li
                className="rounded-component border border-border bg-elevated px-3 py-2 text-sm"
              key={`${endorsement.endorsement}-${endorsement.created_at}`}
              >
              <span className="font-semibold text-text-primary">
                {displayCode(endorsement.endorsement)}
              </span>
              <span className="ml-2 text-text-muted">
                Recorded {formatDate(endorsement.created_at)}
              </span>
            </li>
          ))}
        </ul>
      )}

      {endorsementMode ? (
        <form className="mt-4 space-y-4" onSubmit={onSubmit}>
          <p className="text-sm text-text-muted">
            Endorsing {programLabel(certification)} certificate {certification.certification_number}.
          </p>
          {error ? (
            <CertificationErrorState error={error} operation="endorsement" compact />
          ) : null}
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

function CredentialIssuanceSection({
  authorization,
  canIssueCredential,
  certification,
  error,
  form,
  issuedCredential,
  issueMode,
  onCancel,
  onChange,
  onStart,
  onSubmit,
  successMessage,
  submitting
}: {
  authorization: CredentialsOperationalAuthorizationProjection | null;
  canIssueCredential: boolean;
  certification: CredentialsCertificationProjection;
  error: Error | null;
  form: CredentialIssuanceFormState;
  issuedCredential: CredentialIssuanceResponse | null;
  issueMode: boolean;
  onCancel: () => void;
  onChange: (form: CredentialIssuanceFormState) => void;
  onStart: () => void;
  onSubmit: (
    event: FormEvent<HTMLFormElement>,
    authorization: CredentialsOperationalAuthorizationProjection | null
  ) => void;
  successMessage: string | null;
  submitting: boolean;
}) {
  return (
    <section
      aria-labelledby="credential-issuance-heading"
      className="mt-5 border-t border-border pt-4"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3
            className="text-base font-semibold text-text-primary"
            id="credential-issuance-heading"
          >
            Credential Issuance
          </h3>
          <p className="mt-1 text-sm text-text-muted">
            Issuance creates a governed credential record and immutable certificate snapshot.
          </p>
        </div>
        {canIssueCredential && !issueMode ? (
          <Button onClick={onStart} variant="secondary">
            Issue Credential
          </Button>
        ) : null}
      </div>

      {successMessage ? (
        <p
          className="mt-3 rounded-component border border-border bg-elevated px-3 py-2 text-sm text-text-primary"
          role="status"
        >
          {successMessage}
        </p>
      ) : null}

      {issuedCredential ? (
        <div className="mt-3 rounded-component border border-border bg-elevated px-3 py-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-text-primary">
                Issued Credential
              </p>
              <dl className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
                <MetadataItem
                  label="Credential number"
                  value={issuedCredential.certification_number_snapshot}
                />
                <MetadataItem
                  label="Issued date"
                  value={formatDate(issuedCredential.issue_date_snapshot)}
                />
                <MetadataItem
                  label="Expiry date"
                  value={formatDate(issuedCredential.expiry_date_snapshot)}
                />
                <MetadataItem
                  label="Status at issuance"
                  value={displayCode(issuedCredential.certification_status_at_issuance)}
                />
                <MetadataItem
                  label="Training center"
                  value={issuedCredential.training_center_snapshot ?? "Not specified"}
                />
                <MetadataItem
                  label="Issuing organization"
                  value={issuedCredential.issuing_organization_snapshot}
                />
              </dl>
            </div>
            <Link
              className="inline-flex items-center justify-center rounded-component bg-primary-blue px-3 py-2 text-sm font-semibold text-text-inverse outline-none transition-colors hover:bg-primary-navy focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-canvas active:bg-primary-navy"
              to={routes.credentialCertificatePath(issuedCredential.id)}
            >
              View Certificate
            </Link>
          </div>
        </div>
      ) : (
        <p className="mt-3 text-sm text-text-muted">
          No issuance is available in the current credential view.
        </p>
      )}

      {issueMode ? (
        <form
          className="mt-4 space-y-4 rounded-component border border-border bg-surface p-4"
          onSubmit={(event) => onSubmit(event, authorization)}
        >
          <div>
            <h4 className="text-sm font-semibold text-text-primary">
              Issue Credential
            </h4>
            <p className="mt-1 text-sm text-text-muted">
              Issuing from selected certificate {certification.certification_number}
              {authorization
                ? ` with authorization ${authorization.authorization_number}.`
                : "."}
            </p>
          </div>
          {error ? (
            <CertificationErrorState compact error={error} operation="issuance" />
          ) : null}
          <label className="block text-sm font-semibold text-text-primary">
            F-048 evidence record ID
            <input
              className={inputClassName}
              onChange={(event) =>
                onChange({
                  ...form,
                  sourceEvidenceRecordId: event.currentTarget.value
                })
              }
              required
              value={form.sourceEvidenceRecordId}
            />
          </label>
          <label className="block text-sm font-semibold text-text-primary">
            Completion date
            <input
              className={inputClassName}
              onChange={(event) =>
                onChange({
                  ...form,
                  completionDate: event.currentTarget.value
                })
              }
              required
              type="date"
              value={form.completionDate}
            />
          </label>
          <label className="block text-sm font-semibold text-text-primary">
            Training location
            <input
              className={inputClassName}
              maxLength={255}
              onChange={(event) =>
                onChange({
                  ...form,
                  trainingLocation: event.currentTarget.value
                })
              }
              required
              value={form.trainingLocation}
            />
          </label>
          <label className="block text-sm font-semibold text-text-primary">
            Instructor
            <input
              className={inputClassName}
              maxLength={255}
              onChange={(event) =>
                onChange({
                  ...form,
                  instructor: event.currentTarget.value
                })
              }
              required
              value={form.instructor}
            />
          </label>
          <label className="block text-sm font-semibold text-text-primary">
            Training center
            <input
              className={inputClassName}
              maxLength={255}
              onChange={(event) =>
                onChange({
                  ...form,
                  trainingCenter: event.currentTarget.value
                })
              }
              required
              value={form.trainingCenter}
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <Button disabled={submitting} type="submit">
              {submitting ? "Issuing Credential" : "Confirm Issue Credential"}
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

function OperationalAuthorizationSection({
  authorizationCommandError,
  authorizationCommandPending,
  authorizationGovernanceForm,
  authorizationMode,
  authorizationSuccess,
  authorizations,
  canCreate,
  canReinstate,
  canRenew,
  canRevoke,
  canSuspend,
  certification,
  createAuthorizationError,
  createAuthorizationForm,
  createAuthorizationPending,
  detail,
  onCancel,
  onChangeCreate,
  onChangeGovernance,
  onStart,
  onSubmit
}: {
  authorizationCommandError: Error | null;
  authorizationCommandPending: boolean;
  authorizationGovernanceForm: AuthorizationGovernanceFormState;
  authorizationMode: AuthorizationMode | null;
  authorizationSuccess: string | null;
  authorizations: CredentialsOperationalAuthorizationProjection[];
  canCreate: boolean;
  canReinstate: boolean;
  canRenew: boolean;
  canRevoke: boolean;
  canSuspend: boolean;
  certification: CredentialsCertificationProjection;
  createAuthorizationError: Error | null;
  createAuthorizationForm: CreateAuthorizationFormState;
  createAuthorizationPending: boolean;
  detail: CredentialsPersonnelDetailProjection;
  onCancel: () => void;
  onChangeCreate: (form: CreateAuthorizationFormState) => void;
  onChangeGovernance: (form: AuthorizationGovernanceFormState) => void;
  onStart: (mode: AuthorizationMode) => void;
  onSubmit: (
    event: FormEvent<HTMLFormElement>,
    authorization: CredentialsOperationalAuthorizationProjection | null
  ) => void;
}) {
  const currentAuthorization = currentOperationalAuthorization(authorizations);

  return (
    <section aria-labelledby="operational-authorization-heading" className="mt-5 border-t border-border pt-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3
            className="text-base font-semibold text-text-primary"
            id="operational-authorization-heading"
          >
            Operational Authorization
          </h3>
          <p className="mt-1 text-sm text-text-muted">
            Authorization state is linked to the selected Personnel and Certification context.
          </p>
        </div>
        {authorizations.length === 0 && canCreate && authorizationMode !== "create" ? (
          <Button onClick={() => onStart("create")} variant="secondary">
            Create Operational Authorization
          </Button>
        ) : null}
      </div>

      {authorizationSuccess ? (
        <p className="mt-3 rounded-component border border-border bg-elevated px-3 py-2 text-sm text-text-primary" role="status">
          {authorizationSuccess}
        </p>
      ) : null}

      {authorizations.length === 0 ? (
        <p className="mt-3 text-sm text-text-muted">No operational authorization recorded.</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {authorizations.map((authorization) => (
            <li
              className="rounded-component border border-border bg-elevated px-3 py-3"
              key={authorization.id}
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-text-primary">
                    {authorization.authorization_number}
                  </p>
                  <p className="mt-1 text-xs text-text-muted">
                    {displayCode(authorization.authorization_level)} / {formatDate(authorization.issue_date)} to {formatDate(authorization.expiry_date)}
                  </p>
                  {authorization.renewal_date ? (
                    <p className="mt-1 text-xs text-text-muted">
                      Renewed {formatDate(authorization.renewal_date)}
                    </p>
                  ) : null}
                  {authorization.previous_authorization_id ? (
                    <p className="mt-1 text-xs text-text-muted">
                      Previous authorization retained as metadata.
                    </p>
                  ) : null}
                </div>
                <StatusBadge value={authorization.authorization_status} />
              </div>
              {authorization.id === currentAuthorization?.id ? (
                <AuthorizationActions
                  authorization={authorization}
                  canReinstate={canReinstate}
                  canRenew={canRenew}
                  canRevoke={canRevoke}
                  canSuspend={canSuspend}
                  disabled={authorizationCommandPending || createAuthorizationPending}
                  onStart={onStart}
                />
              ) : null}
              {authorizationMode && authorization.id === currentAuthorization?.id ? (
                <AuthorizationLifecycleForm
                  authorization={authorization}
                  createAuthorizationForm={createAuthorizationForm}
                  createError={createAuthorizationError}
                  governanceError={authorizationCommandError}
                  governanceForm={authorizationGovernanceForm}
                  mode={authorizationMode}
                  onCancel={onCancel}
                  onChangeCreate={onChangeCreate}
                  onChangeGovernance={onChangeGovernance}
                  onSubmit={onSubmit}
                  submitting={authorizationCommandPending || createAuthorizationPending}
                />
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {authorizationMode === "create" ? (
        <AuthorizationLifecycleForm
          authorization={null}
          certification={certification}
          createAuthorizationForm={createAuthorizationForm}
          createError={createAuthorizationError}
          detail={detail}
          governanceError={authorizationCommandError}
          governanceForm={authorizationGovernanceForm}
          mode="create"
          onCancel={onCancel}
          onChangeCreate={onChangeCreate}
          onChangeGovernance={onChangeGovernance}
          onSubmit={onSubmit}
          submitting={authorizationCommandPending || createAuthorizationPending}
        />
      ) : null}
    </section>
  );
}

function AuthorizationActions({
  authorization,
  canReinstate,
  canRenew,
  canRevoke,
  canSuspend,
  disabled,
  onStart
}: {
  authorization: CredentialsOperationalAuthorizationProjection;
  canReinstate: boolean;
  canRenew: boolean;
  canRevoke: boolean;
  canSuspend: boolean;
  disabled: boolean;
  onStart: (mode: AuthorizationMode) => void;
}) {
  const actions = authorizationActionsForStatus(authorization.authorization_status);

  if (actions.length === 0) {
    return null;
  }

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {actions.includes("renew") && canRenew ? (
        <Button disabled={disabled} onClick={() => onStart("renew")} type="button" variant="secondary">
          Renew
        </Button>
      ) : null}
      {actions.includes("suspend") && canSuspend ? (
        <Button disabled={disabled} onClick={() => onStart("suspend")} type="button" variant="secondary">
          Suspend
        </Button>
      ) : null}
      {actions.includes("reinstate") && canReinstate ? (
        <Button disabled={disabled} onClick={() => onStart("reinstate")} type="button" variant="secondary">
          Reinstate
        </Button>
      ) : null}
      {actions.includes("revoke") && canRevoke ? (
        <Button disabled={disabled} onClick={() => onStart("revoke")} type="button" variant="secondary">
          Revoke
        </Button>
      ) : null}
    </div>
  );
}

function AuthorizationLifecycleForm({
  authorization,
  certification,
  createAuthorizationForm,
  createError,
  detail,
  governanceError,
  governanceForm,
  mode,
  onCancel,
  onChangeCreate,
  onChangeGovernance,
  onSubmit,
  submitting
}: {
  authorization: CredentialsOperationalAuthorizationProjection | null;
  certification?: CredentialsCertificationProjection;
  createAuthorizationForm: CreateAuthorizationFormState;
  createError: Error | null;
  detail?: CredentialsPersonnelDetailProjection;
  governanceError: Error | null;
  governanceForm: AuthorizationGovernanceFormState;
  mode: AuthorizationMode;
  onCancel: () => void;
  onChangeCreate: (form: CreateAuthorizationFormState) => void;
  onChangeGovernance: (form: AuthorizationGovernanceFormState) => void;
  onSubmit: (
    event: FormEvent<HTMLFormElement>,
    authorization: CredentialsOperationalAuthorizationProjection | null
  ) => void;
  submitting: boolean;
}) {
  const isDateForm = mode === "create" || mode === "renew";
  const error = mode === "create" ? createError : governanceError;

  return (
    <form className="mt-4 space-y-4 rounded-component border border-border bg-surface p-4" onSubmit={(event) => onSubmit(event, authorization)}>
      <div>
        <h4 className="text-sm font-semibold text-text-primary">
          {authorizationFormTitle(mode)}
        </h4>
        <p className="mt-1 text-sm text-text-muted">
          {mode === "create" && certification && detail
            ? `Authorizing ${detail.full_name} from ${programLabel(certification)} certificate ${certification.certification_number}.`
            : authorization
            ? `Updating authorization ${authorization.authorization_number}.`
            : "Updating Operational Authorization."}
        </p>
      </div>
      {error ? <CertificationErrorState compact error={error} operation="authorization" /> : null}
      {isDateForm ? (
        <>
          <label className="block text-sm font-semibold text-text-primary">
            Authorization number
            <input
              className={inputClassName}
              onChange={(event) =>
                onChangeCreate({
                  ...createAuthorizationForm,
                  authorizationNumber: event.currentTarget.value
                })
              }
              required
              value={createAuthorizationForm.authorizationNumber}
            />
          </label>
          {mode === "create" ? (
            <label className="block text-sm font-semibold text-text-primary">
              Authorization level
              <select
                className={inputClassName}
                onChange={(event) =>
                  onChangeCreate({
                    ...createAuthorizationForm,
                    authorizationLevel: event.currentTarget.value as CertificationLevel
                  })
                }
                value={createAuthorizationForm.authorizationLevel}
              >
                {certificationLevels.map((level) => (
                  <option key={level} value={level}>{level}</option>
                ))}
              </select>
            </label>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm font-semibold text-text-primary">
              Issue date
              <input
                className={inputClassName}
                onChange={(event) =>
                  onChangeCreate({
                    ...createAuthorizationForm,
                    issueDate: event.currentTarget.value
                  })
                }
                required
                type="date"
                value={createAuthorizationForm.issueDate}
              />
            </label>
            <label className="block text-sm font-semibold text-text-primary">
              Expiry date
              <input
                className={inputClassName}
                onChange={(event) =>
                  onChangeCreate({
                    ...createAuthorizationForm,
                    expiryDate: event.currentTarget.value
                  })
                }
                required
                type="date"
                value={createAuthorizationForm.expiryDate}
              />
            </label>
          </div>
        </>
      ) : (
        <>
          <label className="block text-sm font-semibold text-text-primary">
            Reason
            <input
              className={inputClassName}
              onChange={(event) =>
                onChangeGovernance({
                  ...governanceForm,
                  reason: event.currentTarget.value
                })
              }
              required
              value={governanceForm.reason}
            />
          </label>
          <label className="block text-sm font-semibold text-text-primary">
            Notes
            <textarea
              className={inputClassName}
              onChange={(event) =>
                onChangeGovernance({
                  ...governanceForm,
                  notes: event.currentTarget.value
                })
              }
              value={governanceForm.notes}
            />
          </label>
        </>
      )}
      <div className="flex flex-wrap gap-2">
        <Button disabled={submitting} type="submit">
          {submitting ? authorizationPendingLabel(mode) : authorizationFormTitle(mode)}
        </Button>
        <Button disabled={submitting} onClick={onCancel} type="button" variant="secondary">
          Cancel
        </Button>
      </div>
    </form>
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
  operation?: "certification" | "endorsement" | "authorization" | "issuance";
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
  operation: "certification" | "endorsement" | "authorization" | "issuance" = "certification"
) {
  if (!isApiError(error)) {
    if (operation === "issuance") {
      return "Credential issuance could not be completed.";
    }

    if (operation === "authorization") {
      return "Operational Authorization could not be updated.";
    }

    return operation === "endorsement"
      ? "Certification endorsement could not be added."
      : "Certifications could not be loaded.";
  }

  if (error.status === 400 || error.status === 422) {
    if (operation === "issuance") {
      return "Credential issuance input is invalid.";
    }

    if (operation === "authorization") {
      return "Operational Authorization input is invalid.";
    }

    return operation === "endorsement"
      ? "Certification endorsement input is invalid."
      : "Certification input is invalid.";
  }

  if (error.status === 403) {
    if (operation === "issuance") {
      return "Credential issuance is not available with your current authorization.";
    }

    if (operation === "authorization") {
      return "Operational Authorization is not available with your current authorization.";
    }

    return operation === "endorsement"
      ? "Certification endorsement is not available with your current authorization."
      : "Certifications are not available with your current authorization.";
  }

  if (error.status === 404) {
    if (operation === "issuance") {
      return "Credential issuance source is unavailable or outside your scope.";
    }

    if (operation === "authorization") {
      return "Operational Authorization is unavailable or outside your scope.";
    }

    return operation === "endorsement"
      ? "Certification is unavailable or outside your scope."
      : "Certification or Personnel detail was not found.";
  }

  if (error.status === 409) {
    if (operation === "issuance") {
      return "Credential issuance could not be completed because of a conflict.";
    }

    if (operation === "authorization") {
      return "Operational Authorization lifecycle action could not be completed because of a conflict.";
    }

    return operation === "endorsement"
      ? "Certification endorsement could not be added because of a conflict."
      : "Certification could not be created because of a conflict.";
  }

  if (operation === "issuance") {
    return "Credential issuance could not be completed.";
  }

  if (operation === "authorization") {
    return "Operational Authorization could not be updated.";
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

function authorizationsForCertification(
  authorizations: CredentialsOperationalAuthorizationProjection[],
  certificationId: string
) {
  return authorizations
    .filter((authorization) => authorization.certification_id === certificationId)
    .slice()
    .sort((left, right) => right.issue_date.localeCompare(left.issue_date));
}

function currentOperationalAuthorization(
  authorizations: CredentialsOperationalAuthorizationProjection[]
) {
  return (
    authorizations.find(
      (authorization) => authorization.authorization_status !== "REVOKED"
    ) ?? authorizations[0] ?? null
  );
}

function authorizationActionsForStatus(status: string): AuthorizationMode[] {
  if (status === "REVOKED") {
    return [];
  }

  if (status === "SUSPENDED") {
    return ["reinstate", "revoke"];
  }

  if (status === "ACTIVE") {
    return ["renew", "suspend", "revoke"];
  }

  return ["renew", "suspend", "reinstate", "revoke"];
}

function governanceRequestBody(
  form: AuthorizationGovernanceFormState
): GovernOperationalAuthorizationRequest {
  return {
    reason: form.reason.trim(),
    ...(form.notes.trim() ? { notes: form.notes.trim() } : {})
  };
}

async function invalidateAuthorizationQueries(
  queryClient: QueryClient,
  detailQueryKey: readonly unknown[]
) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ["credentials"] }),
    queryClient.invalidateQueries({ queryKey: detailQueryKey })
  ]);
}

function authorizationFormTitle(mode: AuthorizationMode) {
  if (mode === "create") {
    return "Create Operational Authorization";
  }

  if (mode === "renew") {
    return "Renew Authorization";
  }

  if (mode === "suspend") {
    return "Suspend Authorization";
  }

  if (mode === "reinstate") {
    return "Reinstate Authorization";
  }

  return "Revoke Authorization";
}

function authorizationPendingLabel(mode: AuthorizationMode) {
  if (mode === "create") {
    return "Creating Operational Authorization";
  }

  if (mode === "renew") {
    return "Renewing";
  }

  if (mode === "suspend") {
    return "Suspending";
  }

  if (mode === "reinstate") {
    return "Reinstating";
  }

  return "Revoking";
}

function authorizationSuccessMessage(mode: Exclude<AuthorizationMode, "create">) {
  if (mode === "renew") {
    return "Operational Authorization renewed successfully.";
  }

  if (mode === "suspend") {
    return "Operational Authorization suspended successfully.";
  }

  if (mode === "reinstate") {
    return "Operational Authorization reinstated successfully.";
  }

  return "Operational Authorization revoked successfully.";
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
