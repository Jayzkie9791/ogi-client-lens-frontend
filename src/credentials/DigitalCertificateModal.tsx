import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { isApiError } from "../api/errors";
import { CertificatePreviewModal } from "./CertificatePreviewModal";
import { CertificateVisual } from "./CertificatePage";
import { getCredentialIssuance, getCredentialIssuanceCertificate } from "./credentialsApi";

interface DigitalCertificateModalProps {
  issuanceId: string;
  onClose: () => void;
  returnFocusElement?: HTMLElement | null;
}

export function DigitalCertificateModal({
  issuanceId,
  onClose,
  returnFocusElement
}: DigitalCertificateModalProps) {
  const [certificateRequestId] = useState(() => crypto.randomUUID());
  const issuanceQuery = useQuery({
    queryKey: ["credential-issuance", issuanceId],
    queryFn: () => getCredentialIssuance(issuanceId),
    retry: false
  });
  const error=issuanceQuery.error;
  const errorMessage=isApiError(error)&&error.status===403?"The digital certificate is not available with your current authorization.":isApiError(error)&&error.status===404?"The digital certificate is unavailable or no longer visible to your current scope.":"The digital certificate could not be loaded. Try again later.";
  const description = issuanceQuery.data
    ? `${issuanceQuery.data.holder_name_snapshot} · ${issuanceQuery.data.certification_level_snapshot} · ${issuanceQuery.data.program_display_name_snapshot}`
    : "Issued certificate document";
  return <CertificatePreviewModal description={description} errorMessage={errorMessage} heading="Digital Certificate" loadCertificate={()=>getCredentialIssuanceCertificate(issuanceId,true)} onClose={onClose} previewContent={issuanceQuery.data ? <CertificateVisual issuance={issuanceQuery.data} showGuides={false} /> : undefined} queryKey={["credential-certificate",issuanceId,certificateRequestId]} returnFocusElement={returnFocusElement}/>;
}
