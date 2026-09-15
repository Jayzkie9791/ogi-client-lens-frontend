import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";

import { DigitalCertificateModal } from "./DigitalCertificateModal";

afterEach(() => {
  vi.unstubAllGlobals();
});

it("closes from the full-page viewer without navigating away", async () => {
  const user = userEvent.setup();
  vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(new Response(
    JSON.stringify({ code: "NOT_FOUND", message: "Not found" }),
    { status: 404, headers: { "Content-Type": "application/json" } }
  ))));
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } }
  });
  const close = vi.fn();
  const originalLocation = window.location.href;
  const modal = (
    <QueryClientProvider client={queryClient}>
      <DigitalCertificateModal
        issuanceId="00000000-0000-4000-8000-000000900001"
        onClose={close}
      />
    </QueryClientProvider>
  );
  const rendered = render(modal);

  expect(await screen.findByRole("dialog", { name: "Digital Certificate" })).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Close" }));
  expect(close).toHaveBeenCalledOnce();
  expect(window.location.href).toBe(originalLocation);

  rendered.unmount();
});
