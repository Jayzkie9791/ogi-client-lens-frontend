import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ClientPersonnelRegistrationWizard } from "./ClientPersonnelRegistrationWizard";

const api = vi.hoisted(() => ({
  open: vi.fn(), save: vi.fn(), facilities: vi.fn(), createPersonnel: vi.fn(),
  updatePersonnel: vi.fn(), assignments: vi.fn(), createAssignment: vi.fn()
}));
vi.mock("./personnelRegistrationJourneyApi", () => ({ openPersonnelRegistrationIntent: api.open, savePersonnelRegistrationIntent: api.save }));
vi.mock("./registrationFacilityApi", () => ({ listRegistrationFacilities: api.facilities }));
vi.mock("./registrationPersonnelApi", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./registrationPersonnelApi")>()),
  createRegistrationPersonnel: api.createPersonnel, updateRegistrationPersonnel: api.updatePersonnel
}));
vi.mock("./registrationFacilityAssignmentApi", () => ({
  listRegistrationFacilityAssignments: api.assignments, createRegistrationFacilityAssignment: api.createAssignment
}));

const draft = {
  personnelType: "CLIENT", clientId: "client-1", facilityIds: ["facility-1"], primaryFacilityId: "facility-1",
  facilityPositions: { "facility-1": "Operational Lifeguard" }, clientEmployeeNumber: "EMP-123",
  fullName: "Saved Person", email: "saved@example.test", phone: "", status: "ACTIVE",
  hireDate: "2026-09-01", personnelNotes: "Keep this note", assignedFrom: "2026-09-02",
  assignmentNotes: "Keep assignment note", platformAccess: "NOT_REQUIRED", platformUserId: "", createdPersonnelId: ""
};
const person = {
  id: "person-1", client_id: "client-1", user_id: null, full_name: "Saved Person",
  employment_status: "ACTIVE", created_at: "2026-09-01T00:00:00Z", updated_at: "2026-09-01T00:00:00Z"
};

function renderSavedReview(savedDraft: Record<string, unknown>) {
  api.open.mockResolvedValue({ id: "intent-1", personnel_id: null, client_id: "client-1", status: "IN_PROGRESS", current_step: "REVIEW", draft: savedDraft, version: 1, completed_at: null, created_at: "", updated_at: "" });
  const onComplete = vi.fn();
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <ClientPersonnelRegistrationWizard clients={[{ id: "client-1", organization_name: "Client One", status: "ACTIVE", created_at: "", updated_at: "" }]} initialClientId="client-1" onCancel={vi.fn()} onComplete={onComplete} />
  </QueryClientProvider>);
  return onComplete;
}

beforeEach(() => {
  vi.clearAllMocks();
  api.facilities.mockResolvedValue({ facilities: [{ id: "facility-1", client_id: "client-1", facility_name: "Facility One", facility_type: "POOL", operational_status: "ACTIVE", created_at: "", updated_at: "" }] });
  api.assignments.mockResolvedValue({ assignments: [] });
  api.createPersonnel.mockResolvedValue(person);
  api.createAssignment.mockResolvedValue({ id: "assignment-1" });
  api.save.mockImplementation(async (_id, input) => ({ id: "intent-1", personnel_id: input.personnel_id ?? null, client_id: "client-1", status: "IN_PROGRESS", current_step: input.current_step, draft: input.draft, version: input.version + 1, completed_at: null, created_at: "", updated_at: "" }));
});

describe("IS-1B saved Personnel registration duty revalidation", () => {
  it("blocks a legacy Review draft without duty, preserves data, and never infers duty from position title", async () => {
    const onComplete = renderSavedReview(draft);
    fireEvent.click(await screen.findByRole("button", { name: "Complete Registration" }));
    expect((await screen.findByRole("alert")).textContent).toContain("Choose an explicit governed duty");
    expect((screen.getByLabelText("Position") as HTMLInputElement).value).toBe("Operational Lifeguard");
    expect((screen.getByLabelText("Governed duty") as HTMLSelectElement).value).toBe("");
    expect(api.createPersonnel).not.toHaveBeenCalled();
    expect(api.createAssignment).not.toHaveBeenCalled();
    expect(onComplete).not.toHaveBeenCalled();
  });

  it.each(["OPERATIONAL_LIFEGUARD", "OTHER_DUTY"] as const)("preserves an explicit %s duty on completion", async duty => {
    const onComplete = renderSavedReview({ ...draft, facilityDuties: { "facility-1": duty } });
    fireEvent.click(await screen.findByRole("button", { name: "Complete Registration" }));
    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
    expect(api.createAssignment).toHaveBeenCalledWith("person-1", expect.objectContaining({
      duty_code: duty, position_title: "Operational Lifeguard", facility_id: "facility-1"
    }));
  });

  it("allows the operator to supply missing duty without losing the saved draft", async () => {
    const onComplete = renderSavedReview(draft);
    fireEvent.click(await screen.findByRole("button", { name: "Complete Registration" }));
    const duty = await screen.findByLabelText("Governed duty") as HTMLSelectElement;
    fireEvent.change(duty, { target: { value: "OTHER_DUTY" } });
    fireEvent.click(screen.getByRole("button", { name: "Next →" }));
    await screen.findByText("Login access is optional and separate from employment.");
    fireEvent.click(screen.getByRole("button", { name: "Next →" }));
    await screen.findByRole("button", { name: "Complete Registration" });
    fireEvent.click(screen.getByRole("button", { name: "Complete Registration" }));
    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
    expect(api.createPersonnel).toHaveBeenCalledWith(expect.objectContaining({
      client_employee_number: "EMP-123", full_name: "Saved Person", notes: "Keep this note"
    }));
    expect(api.createAssignment).toHaveBeenCalledWith("person-1", expect.objectContaining({
      duty_code: "OTHER_DUTY", position_title: "Operational Lifeguard", notes: "Keep assignment note"
    }));
  });
});
