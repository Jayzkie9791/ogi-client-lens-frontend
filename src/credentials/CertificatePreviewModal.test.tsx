import { useRef, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { CertificatePreviewModal } from "./CertificatePreviewModal";

describe("shared certificate preview modal", () => {
  beforeAll(() => {
    Object.defineProperties(URL, {
      createObjectURL: { configurable: true, value: vi.fn(() => "blob:issued-certificate") },
      revokeObjectURL: { configurable: true, value: vi.fn() }
    });
  });

  it("shows a pending state, previews the issued document, and restores focus after Escape", async () => {
    const user = userEvent.setup();
    let resolveCertificate!: (value: { blob: Blob; filename: string }) => void;
    const certificate = new Promise<{ blob: Blob; filename: string }>((resolve) => {
      resolveCertificate = resolve;
    });

    renderModal(() => certificate);
    const trigger = screen.getByRole("button", { name: "View Certificate" });
    await user.click(trigger);

    const dialog = screen.getByRole("dialog", { name: "Safety Certificate" });
    expect(dialog).toHaveFocus();
    expect(screen.getByRole("status")).toHaveTextContent("Loading digital certificate.");

    await act(async () => {
      resolveCertificate({ blob: new Blob(["certificate"], { type: "application/pdf" }), filename: "safety.pdf" });
      await certificate;
    });

    expect(await screen.findByTitle("Safety Certificate document preview")).toHaveAttribute(
      "src",
      "blob:issued-certificate"
    );
    expect(screen.getByRole("button", { name: "Download PDF" })).toBeEnabled();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:issued-certificate");
  });

  it("keeps focus inside the dialog and closes through its visible control", async () => {
    const user = userEvent.setup();
    renderModal(async () => ({
      blob: new Blob(["certificate"], { type: "application/pdf" }),
      filename: "safety.pdf"
    }));
    await user.click(screen.getByRole("button", { name: "View Certificate" }));

    const close = await screen.findByRole("button", { name: "Close" });
    const preview = screen.getByTitle("Safety Certificate document preview");
    preview.focus();
    await user.tab();
    expect(screen.getByRole("button", { name: "Download PDF" })).toHaveFocus();
    await user.click(close);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("presents retrieval failures without inventing a certificate preview", async () => {
    const user = userEvent.setup();
    renderModal(async () => { throw new Error("not authorized"); });
    await user.click(screen.getByRole("button", { name: "View Certificate" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("This issued certificate is unavailable.");
    expect(screen.queryByTitle(/document preview/i)).not.toBeInTheDocument();
  });
});

function renderModal(loadCertificate: () => Promise<{ blob: Blob; filename: string }>) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  function Harness() {
    const [open, setOpen] = useState(false);
    const triggerRef = useRef<HTMLButtonElement>(null);
    return <>
      <button onClick={() => setOpen(true)} ref={triggerRef} type="button">View Certificate</button>
      {open ? <CertificatePreviewModal
        errorMessage="This issued certificate is unavailable."
        heading="Safety Certificate"
        loadCertificate={loadCertificate}
        onClose={() => setOpen(false)}
        queryKey={["certificate-preview-test"]}
        returnFocusElement={triggerRef.current}
      /> : null}
    </>;
  }

  return render(<QueryClientProvider client={queryClient}><Harness /></QueryClientProvider>);
}
