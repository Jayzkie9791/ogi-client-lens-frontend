import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getPersonnelCredentials } from "../credentials/credentialsApi";
import { listCredentialIssuancesByCertification } from "../certifications/credentialIssuanceApi";
import { listTrainingEnrollments, listTrainingTrainees } from "../training/trainingApi";
import { PersonnelTrainingRecords } from "./RegistrationPersonnelPage";
import { routes } from "../app/routePaths";

vi.mock("../credentials/credentialsApi", async (importOriginal) => ({
  ...await importOriginal<typeof import("../credentials/credentialsApi")>(),
  getPersonnelCredentials: vi.fn()
}));
vi.mock("../certifications/credentialIssuanceApi", async (importOriginal) => ({
  ...await importOriginal<typeof import("../certifications/credentialIssuanceApi")>(),
  listCredentialIssuancesByCertification: vi.fn()
}));
vi.mock("../training/trainingApi", async (importOriginal) => ({
  ...await importOriginal<typeof import("../training/trainingApi")>(),
  listTrainingTrainees: vi.fn(),
  listTrainingEnrollments: vi.fn()
}));
vi.mock("../credentials/DigitalCertificateModal", () => ({
  DigitalCertificateModal: ({ issuanceId }: { issuanceId: string }) => <div role="dialog">Certificate {issuanceId}</div>
}));

describe("Workforce Personnel Certification visibility", () => {
  beforeEach(() => {
    vi.mocked(getPersonnelCredentials).mockResolvedValue(personnelCredentials as never);
    vi.mocked(listCredentialIssuancesByCertification).mockResolvedValue({ issuances: [] });
    vi.mocked(listTrainingEnrollments).mockResolvedValue({ enrollments: [] });
  });

  it("shows a Personnel-owned Certification without manufacturing a Trainee relationship", async () => {
    vi.mocked(listTrainingTrainees).mockResolvedValue({ trainees: [] });
    renderPanel();

    expect(await screen.findByText("No linked Training history")).toBeInTheDocument();
    expect(screen.getByText("This Personnel identity has no governed Trainee link. Certifications remain available independently below.")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Open Trainee Reconciliation" })).not.toBeInTheDocument();
    const certifications = await screen.findByRole("list", { name: "Personnel Certification records" });
    expect(within(certifications).getByText("L6 · Guardian Instructor")).toBeInTheDocument();
    expect(within(certifications).getByText("OGI-GI-2026-000027 · ACTIVE")).toBeInTheDocument();
    expect(within(certifications).getByText("Certification recorded. An issued digital certificate is not available.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "View Certificate" })).not.toBeInTheDocument();
    expect(listTrainingEnrollments).not.toHaveBeenCalled();
  });

  it("offers deliberate Trainee reconciliation only with its exact existing permission", async () => {
    vi.mocked(listTrainingTrainees).mockResolvedValue({ trainees: [] });
    renderPanel(true);

    expect(await screen.findByText("No linked Training history")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open Trainee Reconciliation" })).toHaveAttribute("href", routes.trainingTrainees);
    expect(screen.getByRole("list", { name: "Personnel Certification records" })).toBeInTheDocument();
  });

  it("keeps Enrollment history independent and offers a certificate only for an actual issuance", async () => {
    vi.mocked(listTrainingTrainees).mockResolvedValue({ trainees: [{
      id: "trainee-1",
      staff_member_links: [{ staff_member_id: personnel.id, ended_at: null }]
    }] } as never);
    vi.mocked(listTrainingEnrollments).mockResolvedValue({ enrollments: [{
      id: "enrollment-1",
      enrolled_at: "2026-01-01T00:00:00.000Z",
      program: { certification_level: "L5", display_name: "Assistant Guardian Instructor" },
      training_session: { training_title: "Instructor course" },
      journey_progress: null
    }] } as never);
    vi.mocked(listCredentialIssuancesByCertification).mockResolvedValue({
      issuances: [{ id: "issuance-1" }]
    } as never);
    const user = userEvent.setup();
    renderPanel();

    expect(await screen.findByRole("list", { name: "Personnel Training records" })).toBeInTheDocument();
    expect(screen.getByText("L5 · Assistant Guardian Instructor")).toBeInTheDocument();
    const certifications = await screen.findByRole("list", { name: "Personnel Certification records" });
    expect(within(certifications).getByText("L6 · Guardian Instructor")).toBeInTheDocument();
    await user.click(within(certifications).getByRole("button", { name: "View Certificate" }));
    expect(screen.getByRole("dialog")).toHaveTextContent("Certificate issuance-1");
  });
});

function renderPanel(canReconcileTrainee = false) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}><MemoryRouter><PersonnelTrainingRecords
    canReconcileTrainee={canReconcileTrainee}
    canRegisterTraining={false}
    canViewCertificates
    staffMember={personnel}
  /></MemoryRouter></QueryClientProvider>);
}

const personnel = {
  id: "7c02a783-b134-44dc-a325-bdbec86da723",
  client_id: null,
  user_id: "4349c054-85e3-4dce-936c-b88c168929d3",
  full_name: "Maria Hannah Khrisna Depacaquivo",
  email: "m.depacaquivo@ogiofficial.com",
  phone_number: null,
  employment_status: "ACTIVE",
  hire_date: null,
  notes: null,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
  deleted_at: null
} as const;

const personnelCredentials = {
  id: personnel.id,
  full_name: personnel.full_name,
  hire_date: null,
  employment_status: "ACTIVE",
  organizational_affiliation: "OGI",
  client: null,
  facilities: [],
  qualifications: [],
  email: personnel.email,
  phone_number: null,
  notes: null,
  operational_authorizations: [],
  certifications: [{
    id: "2fdfc3cf-8743-4887-ba9e-58d69f4f9d0f",
    business_identifier: "CERTIFICATION-2026-000027",
    certification_level: "L6",
    program: { display_name: "Guardian Instructor" },
    certification_number: "OGI-GI-2026-000027",
    certification_status: "ACTIVE",
    issue_date: "2026-09-09T00:00:00.000Z",
    expiry_date: "2027-09-09T00:00:00.000Z",
    medical_clearance_provided: true,
    fitness_standard_achieved: true,
    training_hours_completed: null,
    written_exam_score: null,
    endorsements: []
  }]
};
