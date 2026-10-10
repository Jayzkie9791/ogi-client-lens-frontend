import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { AuthContext, AuthContextValue } from "../auth/AuthContext";
import { FacilityTeamMemberPage } from "../authorized-workforce/FacilityTeamPage";
import { MyCredentialsPage } from "../self-service/SelfServicePage";
import { getAuthorizedPersonnelCertificate } from "../authorized-workforce/authorizedWorkforceApi";
import { getMyCertificate } from "../self-service/selfServiceApi";

vi.mock("../self-service/selfServiceApi", async (importOriginal) => {
  const original = await importOriginal<typeof import("../self-service/selfServiceApi")>();
  return { ...original, getMyCredentials: vi.fn(), getMyCertificate: vi.fn() };
});

vi.mock("../authorized-workforce/authorizedWorkforceApi", async (importOriginal) => {
  const original = await importOriginal<typeof import("../authorized-workforce/authorizedWorkforceApi")>();
  return {
    ...original,
    getAuthorizedPersonnelCredentials: vi.fn(),
    getAuthorizedPersonnelCertificate: vi.fn()
  };
});

describe("certificate preview consumers", () => {
  beforeAll(() => {
    Object.defineProperties(URL, {
      createObjectURL: { configurable: true, value: vi.fn(() => "blob:authorized-certificate") },
      revokeObjectURL: { configurable: true, value: vi.fn() }
    });
  });

  it("opens an issued self certificate in place and omits the action without an issuance", async () => {
    const selfService = await import("../self-service/selfServiceApi");
    vi.mocked(selfService.getMyCredentials).mockResolvedValue(credentials("self-issuance"));
    vi.mocked(getMyCertificate).mockResolvedValue(certificateBlob());
    const user = userEvent.setup();
    const issuedPage = renderPage(<MyCredentialsPage />);

    await user.click(await screen.findByRole("button", { name: "View Certificate" }));
    expect(await screen.findByRole("dialog", { name: "My Digital Certificate" })).toBeInTheDocument();
    expect(getMyCertificate).toHaveBeenCalledWith("self-issuance");

    await user.click(screen.getByRole("button", { name: "Close" }));
    issuedPage.unmount();
    vi.mocked(selfService.getMyCredentials).mockResolvedValue(credentials(null));
    renderPage(<MyCredentialsPage />, "/my-credentials-without-issuance");
    expect(await screen.findByText("Certification recorded. An issued digital certificate is not yet available.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "View Certificate" })).not.toBeInTheDocument();
  });

  it("uses the authorized-workforce certificate endpoint without navigating away", async () => {
    const workforce = await import("../authorized-workforce/authorizedWorkforceApi");
    vi.mocked(workforce.getAuthorizedPersonnelCredentials).mockResolvedValue(credentials("team-issuance"));
    vi.mocked(getAuthorizedPersonnelCertificate).mockResolvedValue(certificateBlob());
    const user = userEvent.setup();
    renderPage(<FacilityTeamMemberPage />, "/facility-team/personnel/person-1", "/facility-team/personnel/:staffMemberId");

    await user.click(await screen.findByRole("button", { name: "View certificate" }));
    expect(await screen.findByRole("dialog", { name: "Jane Smith certificate" })).toBeInTheDocument();
    expect(getAuthorizedPersonnelCertificate).toHaveBeenCalledWith("team-issuance");
  });
});

function renderPage(element: React.ReactNode, initialPath = "/my-credentials", routePath = "*") {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<AuthContext.Provider value={auth}>
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialPath]}><Routes><Route element={element} path={routePath} /></Routes></MemoryRouter>
    </QueryClientProvider>
  </AuthContext.Provider>);
}

const auth: AuthContextValue = {
  status: "authenticated",
  session: null,
  errorMessage: null,
  login: async () => undefined,
  logout: () => undefined,
  clearAuthError: () => undefined,
  refreshAccessToken: async () => null,
  canUsePermission: () => true
};

function credentials(credentialIssuanceId: string | null) {
  return {
    personnel: {
      id: "person-1",
      client_employee_number: "EMP-1",
      full_name: "Jane Smith",
      first_name: "Jane",
      middle_name: null,
      last_name: "Smith",
      email: "jane@example.com",
      phone_number: null,
      employment_status: "ACTIVE",
      hire_date: "2026-01-01T00:00:00.000Z",
      client: { id: "client-1", organization_name: "Paradise Beach Club" },
      facilities: []
    },
    certifications: [{
      id: "certification-1",
      business_identifier: "CERT-1",
      certification_level: "L5",
      certification_number: "OGI-CERT-1",
      certification_status: "ACTIVE",
      issue_date: "2026-01-01T00:00:00.000Z",
      expiry_date: "2027-01-01T00:00:00.000Z",
      endorsements: [],
      credential_issuance_id: credentialIssuanceId
    }]
  };
}

function certificateBlob() {
  return { blob: new Blob(["certificate"], { type: "application/pdf" }), filename: "certificate.pdf" };
}
