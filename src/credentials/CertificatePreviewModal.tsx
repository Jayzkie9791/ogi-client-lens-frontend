import { ReactNode, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";

import type { ApiBlobResponse } from "../api/client";
import { Button } from "../ui/components/Button";

interface CertificatePreviewModalProps {
  queryKey: readonly unknown[];
  loadCertificate: () => Promise<ApiBlobResponse>;
  onClose: () => void;
  returnFocusElement?: HTMLElement | null;
  heading?: string;
  description?: string;
  errorMessage?: string;
  previewContent?: ReactNode;
}

export function CertificatePreviewModal({
  queryKey,
  loadCertificate,
  onClose,
  returnFocusElement,
  heading = "Digital Certificate",
  description = "Issued certificate document",
  errorMessage = "The digital certificate could not be loaded.",
  previewContent
}: CertificatePreviewModalProps) {
  const [portalRoot] = useState(() => document.createElement("div"));
  const dialogRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  const titleId = useId();
  onCloseRef.current = onClose;
  const query = useQuery({ queryKey, queryFn: loadCertificate, retry: false });
  const objectUrl = useCertificateObjectUrl(query.data?.blob);

  useLayoutEffect(()=>{
    const previous = returnFocusElement ?? (
      document.activeElement instanceof HTMLElement ? document.activeElement : null
    );
    const overflow = document.body.style.overflow;
    const background = Array.from(document.body.children).map((element) => ({
      element: element as HTMLElement,
      ariaHidden: element.getAttribute("aria-hidden"),
      inert: (element as HTMLElement).inert
    }));
    document.body.appendChild(portalRoot);
    background.forEach((item) => {
      item.element.inert = true;
      item.element.setAttribute("aria-hidden", "true");
    });
    document.body.style.overflow = "hidden";
    dialogRef.current?.focus();
    const dismiss = () => onCloseRef.current();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        dismiss();
      } else if (event.key === "Tab") {
        const focusable = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]),iframe,[href],[tabindex]:not([tabindex="-1"])'
        ) ?? []);
        if (!focusable.length) return;
        const first = focusable[0]!;
        const last = focusable.at(-1)!;
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", keydown);
    return () => {
      document.removeEventListener("keydown", keydown);
      document.body.style.overflow = overflow;
      background.forEach((item) => {
        item.element.inert = item.inert;
        if (item.ariaHidden === null) item.element.removeAttribute("aria-hidden");
        else item.element.setAttribute("aria-hidden", item.ariaHidden);
      });
      portalRoot.remove();
      if (previous?.isConnected) previous.focus();
    };
  }, [portalRoot, returnFocusElement]);

  return createPortal(<div className="fixed inset-0 z-50 bg-primary-navy/55 p-0 sm:p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) onCloseRef.current(); }}>
    <div aria-labelledby={titleId} aria-modal="true" className="mx-auto flex h-dvh w-full max-w-[96rem] flex-col overflow-hidden bg-surface shadow-2xl sm:h-[calc(100dvh-2rem)] sm:rounded-panel sm:border sm:border-border" ref={dialogRef} role="dialog" tabIndex={-1}>
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-6"><div><p className="text-xs font-bold uppercase tracking-wide text-primary-blue">Certificate preview</p><h2 className="mt-1 text-xl font-semibold text-primary-navy" id={titleId}>{heading}</h2><p className="mt-1 text-sm text-text-muted">{description}</p></div><div className="flex gap-2"><Button disabled={!objectUrl} onClick={()=>download(objectUrl,query.data?.filename??"digital-certificate.pdf")}>Download PDF</Button><Button onClick={()=>onCloseRef.current()} variant="secondary">Close</Button></div></header>
      <div className="min-h-0 flex-1 overflow-auto bg-canvas p-2 sm:p-4">{previewContent ?? (query.isLoading ? <div className="grid h-full place-items-center text-sm text-text-muted" role="status">Loading digital certificate.</div> : query.error || !objectUrl ? <div className="grid h-full place-items-center p-6 text-center text-sm text-text-muted" role="alert">{errorMessage}</div> : <iframe aria-label="Digital certificate visual preview" className="h-full w-full rounded-component border border-border bg-white" src={objectUrl} title={`${heading} document preview`} />)}</div>
    </div>
  </div>,portalRoot);
}

function useCertificateObjectUrl(blob: Blob | undefined) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!blob) {
      setUrl(null);
      return;
    }
    const next = URL.createObjectURL(blob);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [blob]);
  return url;
}

function download(url: string | null, filename: string) {
  if (!url) return;
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
}
