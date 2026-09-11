import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { OgiInstructorQualificationPanel } from "./OgiInstructorQualificationPanel";

const personnelId = "00000000-0000-4000-8000-000000300077";

afterEach(() => vi.unstubAllGlobals());

describe("OGI Personnel instructor qualification", () => {
  it("records an active L6 Certification through Certification authority", async () => {
    const user = userEvent.setup();
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    let qualifications: unknown[] = [];
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      calls.push({ url, init });
      if (url.endsWith(`/certifications/personnel/${personnelId}/instructor-qualifications`)) return response({ certifications: qualifications });
      if (url.endsWith("/api/v1/certifications") && init?.method === "POST") {
        const body = JSON.parse(String(init.body));
        const created = certification(body);
        qualifications = [created];
        return response({ success: true, data: created }, 201);
      }
      throw new Error(`Unexpected request: ${init?.method ?? "GET"} ${url}`);
    }));
    renderPanel();

    await screen.findByText("No L6 or L7 instructor qualification has been recorded.");
    await user.click(screen.getByRole("button", { name: "Record Existing L6/L7 Certification" }));
    const form = screen.getByRole("form", { name: "Record instructor qualification" });
    await user.selectOptions(within(form).getByLabelText("Instructor level"), "L6");
    expect(within(form).getByText(/Assigned automatically after this qualification is saved/)).toBeVisible();
    await user.click(within(form).getByRole("button", { name: "Record Qualification" }));

    await screen.findByText("L6 instructor qualification recorded successfully.");
    expect(await screen.findByText("OGI-GI-000001")).toBeVisible();
    const post = calls.find((call) => call.init?.method === "POST");
    expect(JSON.parse(String(post?.init?.body))).toMatchObject({
      certification_level: "L6",
      certification_status: "ACTIVE",
      staff_member_id: personnelId
    });
  });

  it("blocks another current Certification at the same instructor level", async () => {
    const user = userEvent.setup();
    const active = certification({
      certification_level: "L6",
      certification_number: "OGI-GI-CURRENT",
      issue_date: "2026-01-01T00:00:00.000Z",
      expiry_date: "2099-01-01T00:00:00.000Z",
      certification_status: "ACTIVE",
      staff_member_id: personnelId
    });
    const fetchMock = vi.fn(async () => response({ certifications: [active] }));
    vi.stubGlobal("fetch", fetchMock);
    renderPanel();

    await screen.findByText("OGI-GI-CURRENT");
    await user.click(screen.getByRole("button", { name: "Record Existing L6/L7 Certification" }));
    expect(screen.getByRole("alert")).toHaveTextContent("already has a current L6 Certification");
    expect(screen.getByRole("button", { name: "Record Qualification" })).toBeDisabled();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  });

  it("allocates and displays a permanent Instructor Registry Number", async () => {
    const user = userEvent.setup();
    const active = certification({ expiry_date: "2099-01-01T00:00:00.000Z" });
    let allocated = false;
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith(`/certifications/personnel/${personnelId}/instructor-qualifications`)) return response({ certifications: [active] });
      if (url.endsWith(`/instructor-registry/personnel/${personnelId}`) && init?.method === "POST") {
        allocated = true;
        return response(registryIdentity(), 201);
      }
      if (url.endsWith(`/instructor-registry/personnel/${personnelId}`)) {
        return allocated ? response(registryIdentity()) : response({ code: "INSTRUCTOR_REGISTRY_NOT_FOUND", message: "Not found" }, 404);
      }
      throw new Error(`Unexpected request: ${init?.method ?? "GET"} ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={queryClient}><OgiInstructorQualificationPanel canCreate canIssue canManageRegistry canView canViewRegistry personnelId={personnelId} /></QueryClientProvider>);

    await screen.findByText("No Instructor Registry Number has been allocated. An active L5, L6, or L7 Certification is required.");
    await user.click(screen.getByRole("button", { name: "Allocate Instructor Registry Number" }));
    expect(await screen.findByText("OGI-INS-2026-0001")).toBeVisible();
    expect(within(screen.getByRole("region", { name: "Instructor Registry" })).getByText("ACTIVE")).toBeVisible();
  });
});

function renderPanel() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={queryClient}><OgiInstructorQualificationPanel canCreate canIssue canView personnelId={personnelId} /></QueryClientProvider>);
}

function certification(overrides: Record<string, unknown>) {
  return {
    id: "00000000-0000-4000-8000-000000500001",
    certification_level: "L6",
    certification_number: "OGI-GI-000001",
    issue_date: "2026-09-09T00:00:00.000Z",
    expiry_date: "2027-09-09T00:00:00.000Z",
    medical_clearance_provided: false,
    fitness_standard_achieved: false,
    training_hours_completed: null,
    written_exam_score: null,
    certification_status: "ACTIVE",
    staff_member_id: personnelId,
    created_by_user_id: "00000000-0000-4000-8000-000000500002",
    ...overrides
  };
}

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function registryIdentity() {
  return {
    id: "00000000-0000-4000-8000-000000500099",
    personnel_id: personnelId,
    instructor_number: "OGI-INS-2026-0001",
    initial_entry_year: 2026,
    status: "ACTIVE",
    created_by_user_id: "00000000-0000-4000-8000-000000500002",
    created_at: "2026-09-10T00:00:00.000Z"
  };
}
