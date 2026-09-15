import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";

import { isApiError } from "../api/errors";
import { Button } from "../ui/components/Button";
import { CertificateVisual } from "./CertificatePage";
import { getCredentialIssuance, getCredentialIssuanceCertificate } from "./credentialsApi";

interface DigitalCertificateModalProps {
  issuanceId: string;
  onClose: () => void;
}

export function DigitalCertificateModal({
  issuanceId,
  onClose
}: DigitalCertificateModalProps) {
  const [portalRoot] = useState(() => document.createElement("div"));
  const [certificateRequestId] = useState(() => crypto.randomUUID());
  const issuanceQuery = useQuery({
    queryKey: ["credential-issuance", issuanceId],
    queryFn: () => getCredentialIssuance(issuanceId),
    retry: false
  });
  const certificateQuery = useQuery({
    queryKey: ["credential-certificate", issuanceId, certificateRequestId],
    queryFn: () => getCredentialIssuanceCertificate(issuanceId, true),
    retry: false
  });
  const certificateUrl = useCertificateObjectUrl(certificateQuery.data?.blob);
  const certificateFilename = certificateQuery.data?.filename ?? `${issuanceQuery.data?.certification_number_snapshot ?? "digital-certificate"}.pdf`;

  useEffect(() => {
    const priorOverflow = document.body.style.overflow;
    const background = Array.from(document.body.children).map((element) => ({
      element: element as HTMLElement,
      ariaHidden: element.getAttribute("aria-hidden"),
      inert: (element as HTMLElement).inert
    }));
    portalRoot.dataset.digitalCertificatePortal = "true";
    document.body.appendChild(portalRoot);
    for (const item of background) {
      item.element.inert = true;
      item.element.setAttribute("aria-hidden", "true");
    }
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = priorOverflow;
      for (const item of background) {
        item.element.inert = item.inert;
        if (item.ariaHidden === null) item.element.removeAttribute("aria-hidden");
        else item.element.setAttribute("aria-hidden", item.ariaHidden);
      }
      portalRoot.remove();
    };
  }, [portalRoot]);

  return createPortal(
    <div
      className="fixed inset-0 z-50 bg-canvas"
    >
      <div
        aria-labelledby="digital-certificate-dialog-title"
        aria-modal="true"
        className="flex h-dvh w-full flex-col overflow-hidden bg-surface"
        role="dialog"
      >
        <div className="flex flex-col gap-4 border-b border-border bg-surface px-4 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-primary-blue">
              Certification Details
            </p>
            <h2
              className="mt-1 text-xl font-semibold text-text-primary"
              id="digital-certificate-dialog-title"
            >
              {issuanceQuery.data?.holder_name_snapshot ?? "Digital Certificate"}
            </h2>
            {issuanceQuery.data ? <p className="mt-1 text-sm text-text-muted">{issuanceQuery.data.certification_level_snapshot} · {issuanceQuery.data.program_display_name_snapshot}</p> : null}
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button disabled={!certificateUrl} onClick={() => downloadCertificate(certificateUrl, certificateFilename)}>Download PDF</Button>
            <Button onClick={onClose} variant="secondary">Close</Button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-auto bg-canvas p-3 sm:p-6">
          {issuanceQuery.isLoading ? (
            <p className="text-sm text-text-muted" role="status">
              Loading digital certificate.
            </p>
          ) : issuanceQuery.error ? (
            <DigitalCertificateError error={issuanceQuery.error} />
          ) : issuanceQuery.data ? (
            <CertificateVisual issuance={issuanceQuery.data} showGuides={false} />
          ) : (
            <p className="text-sm text-text-muted">
              The digital certificate was not returned.
            </p>
          )}
        </div>
      </div>
    </div>,
    portalRoot
  );
}

function useCertificateObjectUrl(blob: Blob | undefined) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!blob) { setObjectUrl(null); return undefined; }
    const nextObjectUrl = URL.createObjectURL(blob);
    setObjectUrl(nextObjectUrl);
    return () => URL.revokeObjectURL(nextObjectUrl);
  }, [blob]);
  return objectUrl;
}

function downloadCertificate(objectUrl: string | null, filename: string) {
  if (!objectUrl) return;
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename;
  link.click();
}

function DigitalCertificateError({ error }: { error: Error }) {
  if (isApiError(error) && error.status === 403) {
    return (
      <p className="text-sm text-text-muted">
        The digital certificate is not available with your current authorization.
      </p>
    );
  }

  if (isApiError(error) && error.status === 404) {
    return (
      <p className="text-sm text-text-muted">
        The digital certificate is unavailable or no longer visible to your current scope.
      </p>
    );
  }

  return (
    <p className="text-sm text-text-muted">
      The digital certificate could not be loaded. Try again later.
    </p>
  );
}
