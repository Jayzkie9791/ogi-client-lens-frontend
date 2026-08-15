import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { isApiError } from "../api/errors";
import { routes } from "../app/routePaths";
import { useAuth } from "../auth/useAuth";
import { Button } from "../ui/components/Button";
import { Surface } from "../ui/components/Surface";
import {
  CredentialIssuanceResponse,
  getDevPreviewCredentialIssuance,
  getCredentialIssuance,
  getCredentialIssuanceCertificate,
  getDevPreviewCredentialCertificate
} from "./credentialsApi";

const certificateViewPermissions = [
  "view_certification",
  "issue_certification"
] as const;

const previewLevels = ["L1", "L2", "L3", "L4", "L5", "L6", "L7"] as const;

export function CertificatePage() {
  const { issuanceId } = useParams();

  return (
    <CertificateViewer
      mode="production"
      issuanceId={issuanceId}
    />
  );
}

export function CertificateDevPreviewPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const level = normalizePreviewLevel(searchParams.get("level"));

  return (
    <CertificateViewer
      mode="dev-preview"
      previewLevel={level}
      onPreviewLevelChange={(nextLevel) =>
        setSearchParams({ level: nextLevel }, { replace: true })
      }
    />
  );
}

function CertificateViewer(props:
  | {
      mode: "production";
      issuanceId: string | undefined;
    }
  | {
      mode: "dev-preview";
      previewLevel: PreviewLevel;
      onPreviewLevelChange: (level: PreviewLevel) => void;
    }
) {
  const auth = useAuth();
  const canView = certificateViewPermissions.some((permission) =>
    auth.canUsePermission(permission)
  );
  const isDevPreview = props.mode === "dev-preview";
  const productionIssuanceId =
    props.mode === "production" ? props.issuanceId : undefined;
  const devPreviewEnabled = isDevPreview && import.meta.env.DEV;
  const [showGuides, setShowGuides] = useState(false);

  const issuanceQuery = useQuery({
    queryKey: isDevPreview
      ? ["credential-issuance-dev-preview", props.previewLevel]
      : ["credential-issuance", productionIssuanceId],
    queryFn: () =>
      isDevPreview
        ? getDevPreviewCredentialIssuance(props.previewLevel)
        : getCredentialIssuance(productionIssuanceId ?? ""),
    enabled:
      canView &&
      (isDevPreview ? devPreviewEnabled : Boolean(productionIssuanceId)),
    retry: false
  });
  const certificateQuery = useQuery({
    queryKey: isDevPreview
      ? ["credential-certificate-dev-preview", props.previewLevel]
      : ["credential-certificate", productionIssuanceId],
    queryFn: () =>
      isDevPreview
        ? getDevPreviewCredentialCertificate(props.previewLevel)
        : getCredentialIssuanceCertificate(productionIssuanceId ?? ""),
    enabled:
      canView &&
      (isDevPreview ? devPreviewEnabled : Boolean(productionIssuanceId)),
    retry: false
  });
  const objectUrl = useObjectUrl(certificateQuery.data?.blob);
  const metadata = issuanceQuery.data;
  const filename = certificateQuery.data?.filename ?? fallbackFilename(metadata);

  if (!canView) {
    return (
      <SafeState title="Certificate viewer is not available with your current authorization.">
        Your current session does not include certificate viewing authority.
      </SafeState>
    );
  }

  if (isDevPreview && !devPreviewEnabled) {
    return (
      <SafeState title="Certificate preview is unavailable in this environment.">
        Development preview mode is disabled outside the development runtime.
      </SafeState>
    );
  }

  if (!isDevPreview && !productionIssuanceId) {
    return (
      <SafeState title="Certificate viewer is unavailable.">
        No credential issuance identifier was provided.
      </SafeState>
    );
  }

  const isLoading =
    certificateQuery.isLoading || (!isDevPreview && issuanceQuery.isLoading);
  const error =
    certificateQuery.error ?? (!isDevPreview ? issuanceQuery.error : null);

  return (
    <section aria-labelledby="certificate-heading" className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-primary-blue">
            Credentials
          </p>
          <h1
            className="mt-2 text-2xl font-semibold text-text-primary"
            id="certificate-heading"
          >
            Digital Certificate
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-text-muted">
            Authenticated certificate view rendered from the immutable credential issuance snapshot.
          </p>
        </div>
        <Button asChild variant="secondary">
          <Link to={routes.credentials}>Back to Credentials</Link>
        </Button>
      </div>

      {isDevPreview ? (
        <CertificatePreviewControls
          level={props.previewLevel}
          onChange={props.onPreviewLevelChange}
          showGuides={showGuides}
          onShowGuidesChange={setShowGuides}
        />
      ) : null}

      {metadata ? (
        <>
          <CertificateVisual
            issuance={metadata}
            showGuides={isDevPreview && showGuides}
          />
          <CertificateMetadata issuance={metadata} />
        </>
      ) : isLoading ? (
        <SafeState title="Loading certificate presentation.">
          Please wait while the credential issuance snapshot is loaded.
        </SafeState>
      ) : null}

      <Surface>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-base font-semibold text-text-primary">
            Certificate artifact
          </h2>
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={isLoading}
              onClick={() => {
                void certificateQuery.refetch();
                if (!isDevPreview) {
                  void issuanceQuery.refetch();
                }
              }}
              variant="secondary"
            >
              Refresh
            </Button>
            <Button
              disabled={!objectUrl}
              onClick={() => openPdf(objectUrl)}
              variant="secondary"
            >
              Open PDF
            </Button>
            <Button
              disabled={!objectUrl}
              onClick={() => downloadPdf(objectUrl, filename)}
            >
              Download PDF
            </Button>
          </div>
        </div>

        {certificateQuery.isLoading ? (
          <p className="mt-4 text-sm text-text-muted" role="status">
            Loading certificate artifact.
          </p>
        ) : error ? (
          <CertificateErrorState error={error} />
        ) : objectUrl ? (
          <p className="mt-4 text-sm text-text-muted">
            Canonical PDF artifact is ready for opening or download.
          </p>
        ) : (
          <p className="mt-4 text-sm text-text-muted">
            Certificate artifact was not returned.
          </p>
        )}
      </Surface>
    </section>
  );
}

function CertificatePreviewControls({
  level,
  onChange,
  showGuides,
  onShowGuidesChange
}: {
  level: PreviewLevel;
  onChange: (level: PreviewLevel) => void;
  showGuides: boolean;
  onShowGuidesChange: (showGuides: boolean) => void;
}) {
  return (
    <Surface className="flex flex-col gap-4 sm:flex-row sm:items-end">
      <label className="block max-w-xs text-sm font-semibold text-text-primary">
        Development preview level
        <select
          className="mt-2 w-full rounded-component border border-border bg-surface px-3 py-2 text-sm text-text-primary"
          onChange={(event) => onChange(event.currentTarget.value as PreviewLevel)}
          value={level}
        >
          {previewLevels.map((levelOption) => (
            <option key={levelOption} value={levelOption}>
              {levelOption}
            </option>
          ))}
        </select>
      </label>
      <label className="inline-flex items-center gap-2 text-sm font-semibold text-text-primary">
        <input
          checked={showGuides}
          className="h-4 w-4"
          onChange={(event) => onShowGuidesChange(event.currentTarget.checked)}
          type="checkbox"
        />
        Show Guides
      </label>
    </Surface>
  );
}

function CertificateVisual({
  issuance,
  showGuides
}: {
  issuance: CredentialIssuanceResponse;
  showGuides: boolean;
}) {
  const skills = issuance.certificate_display.skills;
  const qualifiedTo = issuance.certificate_display.qualified_to;
  const trainingStandards = [
    {
      key: "REQUIRED_TRAINING_HOURS",
      label: `Training Hours: ${issuance.required_training_hours}`
    },
    ...issuance.certificate_display.training_standards
  ];

  return (
    <Surface className="overflow-x-auto bg-elevated">
      <div className="mx-auto w-full max-w-[612px]">
        <div
          aria-label="Digital certificate visual preview"
          className={[
            "relative aspect-[612/792] w-full overflow-hidden bg-[#f3f7ff] text-[#071640] shadow-panel",
            showGuides ? "cert-guides" : ""
          ].join(" ")}
          data-cert-visual="universal-l1-l7"
        >
          {showGuides ? (
            <style>
              {`
                .cert-guides [data-cert-region] {
                  outline: 1px dashed rgba(220, 38, 38, 0.78);
                  outline-offset: -1px;
                }
                .cert-guides [data-cert-region]::after {
                  content: attr(data-cert-region);
                  position: absolute;
                  left: 2px;
                  top: 2px;
                  z-index: 20;
                  background: rgba(255, 255, 255, 0.88);
                  color: #b91c1c;
                  font-size: 6px;
                  font-weight: 700;
                  line-height: 1;
                  padding: 2px 3px;
                  text-transform: uppercase;
                }
              `}
            </style>
          ) : null}
          <div className="absolute inset-[2.6%] border-[6px] border-[#051744]" />
          <div className="absolute inset-[3.8%] border-2 border-[#d10514]" />
          <div className="absolute inset-[4.9%] border border-[#051744]" />

          <section
            className={regionClass(showGuides, "left-[6.2%] top-[5.3%] h-[17.4%] w-[87.6%]")}
            data-cert-region="header"
          >
            <img
              alt=""
              className="absolute left-[-6%] top-[15%] h-[145%] w-[45%] object-contain"
              data-cert-region="athlete"
              src="/brand/ogi-lifeguard-art.png"
            />
            <img
              alt="Ocean Guardian International Ltd."
              className="absolute left-[30%] top-[25%] h-[70%] w-[45%] object-contain"
              data-cert-region="master-logo"
              src="/brand/ogi-master-logo.png"
            />
            {/* <div className="absolute bottom-[16%] left-[37%] w-[38%] border-t border-[#d10514] pt-1 text-center text-[7px] font-semibold uppercase tracking-wide">
              {issuance.issuing_organization_snapshot}
            </div> */}
            <div
              className="absolute right-0 top-[30%] w-[22%] text-right"
              data-cert-region="certificate-meta"
            >
              <p className="text-[7px] font-bold uppercase">Certificate No.</p>
              <p className="mt-2 text-[9px] font-bold text-[#d10514]">
                {issuance.certification_number_snapshot}
              </p>
              <div className="my-3 border-t border-[#d10514]" />
              <p className="text-[7px] font-bold uppercase">Issue Date</p>
              <p className="mt-2 text-[8px] font-bold text-[#d10514]">
                {formatDate(issuance.issue_date_snapshot)}
              </p>
            </div>
          </section>

          <section
            className={regionClass(showGuides, "left-[6.2%] top-[25%] h-[22.2%] w-[87.6%] text-center")}
            data-cert-region="identity"
          >
            <h2 className="mt-[2%] text-[24px] font-bold uppercase">
              Certificate of Completion
            </h2>
            <div className="mt-[1%] flex items-center justify-center gap-[2%]">
              <div className="h-[1px] w-[18%] bg-[#d10514]" />

              <p className="whitespace-nowrap text-[10px] font-bold uppercase text-[#d10514]">
                This Certifies That
              </p>

              <div className="h-[1px] w-[18%] bg-[#d10514]" />
            </div>
            <p className="mt-[1%] font-serif text-[30px] text-[#051744]">
              {issuance.holder_name_snapshot}
            </p>

            <p className="mx-auto mt-[1%] w-[60%] text-[7px] leading-[1.5] text-[#051744]">
              has successfully completed all requirements and demonstrated the
              knowledge, skills, and abilities necessary to perform the duties of a
            </p>

            <p className="mt-[2%] text-[17px] font-bold uppercase text-[#d10514]">
              {issuance.certificate_display.qualification_title}
            </p>
          </section>

          <section
            className={regionClass(showGuides, "left-[6.2%] top-[47.2%] h-[27%] w-[21.9%]")}
            data-cert-region="skills"
          >
            <CertificatePanelHeading>Qualifications Earned</CertificatePanelHeading>
            <div className="mt-2 bg-[#051744] px-2 py-1 text-[7px] font-bold uppercase text-white">
              {issuance.certificate_display.qualification_title}
            </div>
            <CertificatePanelHeading className="mt-3">
              Key Skills & Training
            </CertificatePanelHeading>
            <CertificateItemList items={skills} uppercase />
          </section>

          <section
            className={regionClass(showGuides, "left-[31%] top-[47.2%] h-[27%] w-[37.6%]")}
            data-cert-region="center"
          >
            <div
              className="absolute left-[18%] top-[35%] w-[64%] text-center"
              data-cert-region="signatory"
            >
              <img
                alt="Braven Burrows signature"
                className="mx-auto h-auto w-[72%]"
                src="/brand/BravenSignature.png"
              />
              <div className="mx-auto mt-1 w-[70%] border-t border-[#d10514]" />
              <p className="mt-2 text-[7px] font-bold uppercase">
                DIRECTOR OF TRAINING
              </p>
              <p className="mt-1 text-[6px] font-semibold">
                Ocean Guardian International Ltd.
              </p>
            </div>
          </section>

          <section
            className={regionClass(showGuides, "left-[71.9%] top-[47.2%] h-[27%] w-[21.9%]")}
            data-cert-region="certification-details"
          >
            <CertificatePanelHeading>Certification Details</CertificatePanelHeading>
            <dl className="mt-2 space-y-[2.2%] text-[6px]">
              <CertificateDetail label="Level" value={`${issuance.certification_level_snapshot} ${issuance.qualification_label_snapshot}`} />
              <CertificateDetail label="Training Hours" value={`${issuance.required_training_hours} hours`} />
              <CertificateDetail label="Completion" value={formatDate(issuance.completion_date_snapshot ?? "")} />
              <CertificateDetail label="Expiration" value={formatDate(issuance.expiry_date_snapshot)} />
              <CertificateDetail label="Location" value={issuance.training_location_snapshot ?? "Not specified"} />
              <CertificateDetail label="Instructor" value={issuance.instructor_snapshot ?? "Not specified"} />
              <CertificateDetail label="Training Center" value={issuance.training_center_snapshot ?? "Not specified"} />
            </dl>
          </section>

          <div className="absolute left-[6.2%] top-[75%] w-[87.6%] border-t border-[#d10514]" />
          <section
            className={regionClass(showGuides, "left-[6.2%] top-[76%] h-[15.7%] w-[20.3%]")}
            data-cert-region="qualified-to"
          >
            <CertificateLowerHeading>The Holder Is Qualified To</CertificateLowerHeading>
            <CertificateItemList items={qualifiedTo} />
          </section>
          <section
            className={regionClass(showGuides, "left-[28.8%] top-[76%] h-[15.7%] w-[20.3%]")}
            data-cert-region="training-standards"
          >
            <CertificateLowerHeading>Training Standards</CertificateLowerHeading>
            <CertificateItemList items={trainingStandards} />
          </section>
          <section
            className={regionClass(showGuides, "left-[51.3%] top-[76%] h-[15.7%] w-[20.3%]")}
            data-cert-region="validity-verification"
          >
            <CertificateLowerHeading>Validity</CertificateLowerHeading>
            <p className="mt-2 text-[12px] font-bold text-[#d10514]">
              {issuance.validity_period.value} YEAR
            </p>
            <p className="text-[5px]">Valid through</p>
            <p className="text-[6px] font-bold">
              {formatDate(issuance.expiry_date_snapshot)}
            </p>
            <CertificateLowerHeading className="mt-2">
              Verify Certificate
            </CertificateLowerHeading>
            <div className="mt-1 flex items-center gap-2">
              <img
                alt=""
                className="h-[24px] w-[24px]"
                src="/brand/QRCode.png"
              />
              <p className="text-[5px] leading-tight">
                Client Lens verification capability reserved
              </p>
            </div>
          </section>
          <section
            className={regionClass(showGuides, "left-[73.8%] top-[76%] h-[15.7%] w-[20%]")}
            data-cert-region="ribbon"
          >
            <img
              alt="OGI certificate ribbon"
              className="mx-auto mt-[6%] h-[78%] w-auto object-contain"
              src="/brand/OGIRibbon.png"
            />
          </section>

          <footer
            className="absolute bottom-[3.8%] left-[4.9%] grid h-[3%] w-[90.2%] grid-cols-3 items-center bg-[#051744] px-[2%] text-[5px] text-white"
            data-cert-region="footer"
          >
            {/* LEFT */}
            <div className="text-left leading-[1.25]">
              <div className="font-bold uppercase">
                {issuance.issuing_organization_snapshot}
              </div>

              <div className="mt-[1px] uppercase">
                Protecting Life • Serving Oceans • Building Guardians
              </div>
            </div>

            {/* CENTER */}
            <div className="text-center">
              ogiofficial.com
            </div>

            {/* RIGHT */}
            <div className="text-right">
              Nassau, The Bahamas
            </div>
          </footer>
        </div>
      </div>
    </Surface>
  );
}

interface CertificateVisualItem {
  readonly key: string;
  readonly label: string;
}

function regionClass(_showGuides: boolean, position: string) {
  return `absolute ${position}`;
}

function CertificatePanelHeading({
  children,
  className = ""
}: {
  children: string;
  className?: string;
}) {
  return (
    <h3 className={`${className} bg-[#d10514] px-2 py-1 text-[7px] font-bold uppercase text-white`}>
      {children}
    </h3>
  );
}

function CertificateLowerHeading({
  children,
  className = ""
}: {
  children: string;
  className?: string;
}) {
  return (
    <h3 className={`${className} text-[7px] font-bold uppercase text-[#d10514]`}>
      {children}
    </h3>
  );
}

function CertificateItemList({
  items,
  uppercase = false
}: {
  items: readonly CertificateVisualItem[];
  uppercase?: boolean;
}) {
  return (
    <ul className="mt-2 space-y-1 text-[6px] leading-tight">
      {items.map((item) => (
        <li className="flex gap-1" key={item.key}>
          <span
            aria-hidden="true"
            className="mt-[2px] h-[5px] w-[5px] shrink-0 rounded-full border border-[#d10514]"
          />
          <span className={uppercase ? "font-semibold uppercase" : undefined}>
            {item.label}
          </span>
        </li>
      ))}
    </ul>
  );
}

function CertificateDetail({
  label,
  value
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <dt className="font-bold uppercase text-[#071640]">{label}</dt>
      <dd className="break-words font-semibold text-[#071640]">{value}</dd>
    </div>
  );
}

function CertificateMetadata({
  issuance
}: {
  issuance: CredentialIssuanceResponse;
}) {
  return (
    <Surface>
      <h2 className="text-base font-semibold text-text-primary">
        Issuance snapshot
      </h2>
      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <MetadataItem label="Holder" value={issuance.holder_name_snapshot} />
        <MetadataItem
          label="Certification"
          value={issuance.certification_number_snapshot}
        />
        <MetadataItem
          label="Program"
          value={issuance.program_display_name_snapshot}
        />
        <MetadataItem
          label="Level"
          value={issuance.certification_level_snapshot}
        />
        <MetadataItem
          label="Issue date"
          value={formatDate(issuance.issue_date_snapshot)}
        />
        <MetadataItem
          label="Expiry date"
          value={formatDate(issuance.expiry_date_snapshot)}
        />
        <MetadataItem
          label="Training center"
          value={issuance.training_center_snapshot ?? "Not specified"}
        />
        <MetadataItem
          label="Instructor"
          value={issuance.instructor_snapshot ?? "Not specified"}
        />
      </dl>
    </Surface>
  );
}

function CertificateErrorState({ error }: { error: Error }) {
  const message = isApiError(error)
    ? error.message
    : "Certificate artifact could not be loaded.";

  return (
    <p className="mt-4 text-sm text-red-700" role="alert">
      {message}
    </p>
  );
}

function SafeState({
  title,
  children
}: {
  title: string;
  children: string;
}) {
  return (
    <Surface>
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

function useObjectUrl(blob: Blob | undefined) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!blob) {
      setObjectUrl(null);
      return undefined;
    }

    const nextObjectUrl = URL.createObjectURL(blob);

    setObjectUrl(nextObjectUrl);

    return () => URL.revokeObjectURL(nextObjectUrl);
  }, [blob]);

  return objectUrl;
}

function openPdf(objectUrl: string | null) {
  if (!objectUrl) {
    return;
  }

  window.open(objectUrl, "_blank", "noopener,noreferrer");
}

function downloadPdf(objectUrl: string | null, filename: string) {
  if (!objectUrl) {
    return;
  }

  const link = document.createElement("a");

  link.href = objectUrl;
  link.download = filename;
  link.click();
}

function fallbackFilename(
  metadata: CredentialIssuanceResponse | undefined
) {
  return `${metadata?.certification_number_snapshot ?? "credential-certificate"}.pdf`;
}

function formatDate(value: string) {
  return value.slice(0, 10);
}

type PreviewLevel = (typeof previewLevels)[number];

function normalizePreviewLevel(value: string | null): PreviewLevel {
  return previewLevels.includes(value as PreviewLevel)
    ? (value as PreviewLevel)
    : "L3";
}
