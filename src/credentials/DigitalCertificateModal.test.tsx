import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";

import { DigitalCertificateModal } from "./DigitalCertificateModal";

afterEach(() => {
  vi.unstubAllGlobals();
});

it("retains the original focus trigger across rerenders and uses the latest close callback", async () => {
  const user = userEvent.setup();
  const trigger = document.createElement("button");
  trigger.textContent = "Original trigger";
  document.body.appendChild(trigger);
  trigger.focus();
  vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(new Response(
    JSON.stringify({ code: "NOT_FOUND", message: "Not found" }),
    { status: 404, headers: { "Content-Type": "application/json" } }
  ))));
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } }
  });
  const firstClose = vi.fn();
  const latestClose = vi.fn();
  const modal = (onClose: () => void) => (
    <QueryClientProvider client={queryClient}>
      <DigitalCertificateModal
        issuanceId="00000000-0000-4000-8000-000000900001"
        onClose={onClose}
      />
    </QueryClientProvider>
  );
  const rendered = render(modal(firstClose));

  expect(await screen.findByRole("dialog", { name: "Digital Certificate" })).toHaveFocus();
  rendered.rerender(modal(latestClose));
  await user.keyboard("{Escape}");
  expect(firstClose).not.toHaveBeenCalled();
  expect(latestClose).toHaveBeenCalledOnce();

  rendered.unmount();
  await waitFor(() => expect(trigger).toHaveFocus());
  trigger.remove();
});
