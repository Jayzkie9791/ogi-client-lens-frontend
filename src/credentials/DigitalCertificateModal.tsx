import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";

import { isApiError } from "../api/errors";
import { Button } from "../ui/components/Button";
import { CertificateVisual } from "./CertificatePage";
import { getCredentialIssuance } from "./credentialsApi";

interface DigitalCertificateModalProps {
  issuanceId: string;
  onClose: () => void;
}

const focusableSelector = [
  "button:not([disabled])",
  "[href]",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])"
].join(",");

export function DigitalCertificateModal({
  issuanceId,
  onClose
}: DigitalCertificateModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  const [portalRoot] = useState(() => document.createElement("div"));
  const issuanceQuery = useQuery({
    queryKey: ["credential-issuance", issuanceId],
    queryFn: () => getCredentialIssuance(issuanceId),
    retry: false
  });

  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const trigger =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
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
    dialogRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeRef.current();
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const focusable = Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(focusableSelector) ?? []
      );
      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = priorOverflow;
      for (const item of background) {
        item.element.inert = item.inert;
        if (item.ariaHidden === null) item.element.removeAttribute("aria-hidden");
        else item.element.setAttribute("aria-hidden", item.ariaHidden);
      }
      portalRoot.remove();
      if (trigger?.isConnected) trigger.focus();
    };
  }, [portalRoot]);

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-primary-navy/70 p-2 sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          closeRef.current();
        }
      }}
    >
      <div
        aria-labelledby="digital-certificate-dialog-title"
        aria-modal="true"
        className="flex max-h-[96dvh] w-full max-w-6xl flex-col overflow-hidden rounded-component border border-border bg-surface shadow-panel sm:max-h-[90dvh]"
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
      >
        <div className="flex items-center justify-between gap-4 border-b border-border px-4 py-3 sm:px-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-primary-blue">
              Certification Details
            </p>
            <h2
              className="mt-1 text-xl font-semibold text-text-primary"
              id="digital-certificate-dialog-title"
            >
              Digital Certificate
            </h2>
          </div>
          <Button onClick={onClose} variant="secondary">
            Close
          </Button>
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
