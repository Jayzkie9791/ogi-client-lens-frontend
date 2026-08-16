import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { configureApiAuth } from "../api/client";
import { getRefreshTokenStorageKey } from "../auth/storage";
import { AppProviders } from "../app/providers/AppProviders";
import { appRoutes } from "../app/router";
import { routes } from "../app/routePaths";
import { RegistrationClient } from "./registrationClientApi";

const baseSession = {
  id: "00000000-0000-4000-8000-000000000001",
  email: "operator@example.test",
  username: null,
  fullName: "Operator One",
  status: "ACTIVE",
  clientId: null,
  facilityScopeMode: null,
  facilityIds: [],
  roles: ["Registration"],
  permissions: [
    "view_client",
    "create_client",
    "update_client",
    "deactivate_client"
  ]
};

const clientA: RegistrationClient = {
  id: "00000000-0000-4000-8000-000000100001",
  organization_name: "Ocean Guard International",
  contact_email: "admin@ogiofficial.com",
  contact_phone: "+63 900 000 0001",
  status: "ACTIVE",
  address: "Makati",
  country: "Philippines",
  notes: "Launch client",
  created_at: "2026-08-01T00:00:00.000Z",
  updated_at: "2026-08-02T00:00:00.000Z",
  deleted_at: null
};

const clientB: RegistrationClient = {
  id: "00000000-0000-4000-8000-000000100002",
  organization_name: "Bluewater Resorts",
  contact_email: null,
  contact_phone: null,
  status: "SUSPENDED",
  address: null,
  country: "United States",
  notes: null,
  created_at: "2026-08-03T00:00:00.000Z",
  updated_at: "2026-08-04T00:00:00.000Z",
  deleted_at: null
};

interface MockResponse {
  status: number;
  body?: unknown;
  statusText?: string;
}

function renderWithRoute(initialPath: string) {
  const router = createMemoryRouter(appRoutes, {
    initialEntries: [initialPath]
  });

  return render(
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>
  );
}

function mockFetchQueue(responses: MockResponse[]) {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const next = responses.shift();

    calls.push({
      url: readRequestPath(input),
      init
    });

    if (!next) {
      throw new Error(`Unexpected fetch call: ${String(input)}`);
    }

    return new Response(
      next.body === undefined ? null : JSON.stringify(next.body),
      {
        status: next.status,
        statusText: next.statusText,
        headers: {
          "Content-Type": "application/json"
        }
      }
    );
  });

  vi.stubGlobal("fetch", fetchMock);

  return { calls, fetchMock };
}

function readRequestPath(input: RequestInfo | URL) {
  const value = String(input);

  if (!value.startsWith("http")) {
    return value;
  }

  const url = new URL(value);

  return `${url.pathname}${url.search}`;
}

function authResponses(session = baseSession): MockResponse[] {
  return [
    { status: 200, body: { accessToken: "access-token" } },
    { status: 200, body: session }
  ];
}

beforeEach(() => {
  window.sessionStorage.clear();
  window.sessionStorage.setItem(getRefreshTokenStorageKey(), "refresh-token");
});

afterEach(() => {
  configureApiAuth(null);
  vi.unstubAllGlobals();
  window.sessionStorage.clear();
});

describe("Registration Clients frontend", () => {
  it("opens Client / Organization registration from permission-gated navigation", async () => {
    const user = userEvent.setup();
    const { calls } = mockFetchQueue([
      ...authResponses(),
      { status: 200, body: { clients: [clientA, clientB] } },
      { status: 200, body: clientA }
    ]);

    renderWithRoute(routes.workbench);

    await user.click(await screen.findByRole("button", { name: "Menu" }));
    await user.click(screen.getByRole("link", { name: "Registration" }));

    expect(
      await screen.findByRole("heading", { name: "Clients / Organizations" })
    ).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { name: "Registration" })).toHaveLength(1);
    expect(screen.getByRole("link", { name: "Clients" })).toHaveAttribute(
      "aria-current",
      "page"
    );
    expect(
      screen.queryByRole("form", { name: "Create Client" })
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Register Client" })).toBeInTheDocument();
    expect(
      screen.queryByText(/backend|API contract|authorized backend/i)
    ).not.toBeInTheDocument();
    expect(
      screen.getByText("Ocean Guard International")
    ).toBeInTheDocument();
    expect(screen.getByText("Bluewater Resorts")).toBeInTheDocument();
    expect(await screen.findByText("Client / Organization Details")).toBeInTheDocument();
    expect(screen.queryByText("Facilities")).not.toBeInTheDocument();
    expect(screen.queryByText("Personnel")).not.toBeInTheDocument();
    expect(calls.map(({ url }) => url)).toEqual([
      "/api/v1/auth/refresh",
      "/api/v1/auth/me",
      "/api/v1/registration/clients",
      `/api/v1/registration/clients/${clientA.id}`
    ]);
  });

  it("keeps the Clients workspace useful without create, update, or deactivate authority", async () => {
    mockFetchQueue([
      ...authResponses({
        ...baseSession,
        permissions: ["view_client"]
      }),
      { status: 200, body: { clients: [clientA] } },
      { status: 200, body: clientA }
    ]);

    renderWithRoute(routes.registrationClients);

    expect(
      await screen.findByRole("heading", { name: "Clients / Organizations" })
    ).toBeInTheDocument();
    expect(await screen.findByText("Ocean Guard International")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Register Client" })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("form", { name: "Save Client / Organization" })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Deactivate Client / Organization" })
    ).not.toBeInTheDocument();
    expect(screen.getByText("admin@ogiofficial.com")).toBeInTheDocument();
  });

  it("blocks registration without view_client and does not call registration endpoints", async () => {
    const { calls } = mockFetchQueue([
      ...authResponses({
        ...baseSession,
        permissions: [],
        roles: ["Registration"]
      })
    ]);

    renderWithRoute(routes.registrationClients);

    await screen.findByText(
      "Your current session does not include Client / Organization registration authority."
    );
    expect(screen.queryByRole("link", { name: "Registration" })).not.toBeInTheDocument();
    expect(calls.map(({ url }) => url)).toContain("/api/v1/auth/refresh");
    expect(calls.map(({ url }) => url)).toContain("/api/v1/auth/me");
    expect(
      calls.some((call) => call.url.startsWith("/api/v1/registration"))
    ).toBe(false);
  });

  it("derives the Clients tab state directly from a direct Clients route load", async () => {
    mockFetchQueue([
      ...authResponses(),
      { status: 200, body: { clients: [clientA] } },
      { status: 200, body: clientA }
    ]);

    renderWithRoute(routes.registrationClients);

    expect(
      await screen.findByRole("heading", { name: "Clients / Organizations" })
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Clients" })).toHaveAttribute(
      "aria-current",
      "page"
    );
  });

  it("enters and cancels explicit Register Client mode without mutation", async () => {
    const user = userEvent.setup();
    const { calls } = mockFetchQueue([
      ...authResponses(),
      { status: 200, body: { clients: [clientA, clientB] } },
      { status: 200, body: clientA },
      { status: 200, body: clientB }
    ]);

    renderWithRoute(routes.registrationClients);

    await screen.findByRole("heading", { name: "Client / Organization Details" });
    await user.click(screen.getByRole("button", { name: /Bluewater Resorts/i }));

    expect(await screen.findByDisplayValue("Bluewater Resorts")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Register Client" }));

    const createForm = await screen.findByRole("form", { name: "Create Client" });
    expect(within(createForm).getByLabelText("Organization name")).toHaveValue("");
    expect(
      screen.queryByRole("form", { name: "Save Client / Organization" })
    ).not.toBeInTheDocument();

    await user.click(within(createForm).getByRole("button", { name: "Cancel" }));

    expect(await screen.findByDisplayValue("Bluewater Resorts")).toBeInTheDocument();
    expect(
      screen.queryByRole("form", { name: "Create Client" })
    ).not.toBeInTheDocument();
    expect(
      calls.some(
        (call) =>
          call.url === "/api/v1/registration/clients" &&
          call.init?.method === "POST"
      )
    ).toBe(false);
  });

  it("renders an empty Clients workspace without permanently showing the create form", async () => {
    const user = userEvent.setup();
    mockFetchQueue([
      ...authResponses(),
      { status: 200, body: { clients: [] } }
    ]);

    renderWithRoute(routes.registrationClients);

    expect(await screen.findByText("No Clients registered yet.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "No Client selected." })).toBeInTheDocument();
    expect(
      screen.queryByRole("form", { name: "Create Client" })
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Register Client" }));

    expect(await screen.findByRole("form", { name: "Create Client" })).toBeInTheDocument();
  });

  it("creates a Client / Organization through the approved POST contract", async () => {
    const user = userEvent.setup();
    const createdClient: RegistrationClient = {
      ...clientA,
      id: "00000000-0000-4000-8000-000000100003",
      organization_name: "New Aquatics Client",
      contact_email: "contact@example.test",
      country: "Canada"
    };
    const { calls } = mockFetchQueue([
      ...authResponses(),
      { status: 200, body: { clients: [] } },
      { status: 201, body: createdClient },
      { status: 200, body: { clients: [createdClient] } }
    ]);

    renderWithRoute(routes.registrationClients);

    expect(
      screen.queryByRole("form", { name: "Create Client" })
    ).not.toBeInTheDocument();
    await user.click(await screen.findByRole("button", { name: "Register Client" }));

    const createForm = await screen.findByRole("form", { name: "Create Client" });
    await user.type(
      within(createForm).getByLabelText("Organization name"),
      "New Aquatics Client"
    );
    await user.type(
      within(createForm).getByLabelText("Contact email"),
      "contact@example.test"
    );
    await user.type(within(createForm).getByLabelText("Country"), "Canada");
    await user.click(
      within(createForm).getByRole("button", {
        name: "Create Client"
      })
    );

    expect(
      await screen.findByText("Client / Organization created successfully.")
    ).toBeInTheDocument();
    const createCall = calls.find(
      (call) => call.url === "/api/v1/registration/clients" && call.init?.method === "POST"
    );

    expect(createCall).toBeDefined();
    expect(await screen.findByDisplayValue("New Aquatics Client")).toBeInTheDocument();
    expect(
      screen.queryByRole("form", { name: "Create Client" })
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /New Aquatics Client/i })).toHaveAttribute(
      "aria-current",
      "true"
    );
    expect(JSON.parse(String(createCall?.init?.body))).toEqual({
      organization_name: "New Aquatics Client",
      status: "ACTIVE",
      contact_email: "contact@example.test",
      contact_phone: null,
      address: null,
      country: "Canada",
      notes: null
    });
  });

  it("updates Client / Organization writable fields through PATCH", async () => {
    const user = userEvent.setup();
    const updatedClient: RegistrationClient = {
      ...clientA,
      organization_name: "Ocean Guard International Updated",
      status: "SUSPENDED",
      notes: "Temporarily suspended"
    };
    const { calls } = mockFetchQueue([
      ...authResponses(),
      { status: 200, body: { clients: [clientA] } },
      { status: 200, body: clientA },
      { status: 200, body: updatedClient },
      { status: 200, body: { clients: [updatedClient] } }
    ]);

    renderWithRoute(routes.registrationClients);

    const editForm = await screen.findByRole("form", {
      name: "Save Client / Organization"
    });
    await user.clear(within(editForm).getByLabelText("Organization name"));
    await user.type(
      within(editForm).getByLabelText("Organization name"),
      "Ocean Guard International Updated"
    );
    await user.selectOptions(within(editForm).getByLabelText("Status"), "SUSPENDED");
    await user.clear(within(editForm).getByLabelText("Notes"));
    await user.type(within(editForm).getByLabelText("Notes"), "Temporarily suspended");
    await user.click(
      within(editForm).getByRole("button", { name: "Save Client / Organization" })
    );

    expect(
      await screen.findByText("Client / Organization updated successfully.")
    ).toBeInTheDocument();
    const updateCall = calls.find(
      (call) =>
        call.url === `/api/v1/registration/clients/${clientA.id}` &&
        call.init?.method === "PATCH" &&
        String(call.init?.body).includes("Ocean Guard International Updated")
    );

    expect(updateCall).toBeDefined();
    expect(JSON.parse(String(updateCall?.init?.body))).toMatchObject({
      organization_name: "Ocean Guard International Updated",
      status: "SUSPENDED",
      notes: "Temporarily suspended"
    });
  });

  it("deactivates a Client / Organization as a status lifecycle update", async () => {
    const user = userEvent.setup();
    const inactiveClient: RegistrationClient = {
      ...clientA,
      status: "INACTIVE"
    };
    const { calls } = mockFetchQueue([
      ...authResponses(),
      { status: 200, body: { clients: [clientA] } },
      { status: 200, body: clientA },
      { status: 200, body: inactiveClient },
      { status: 200, body: { clients: [inactiveClient] } }
    ]);

    renderWithRoute(routes.registrationClients);

    await user.click(
      await screen.findByRole("button", {
        name: "Deactivate Client / Organization"
      })
    );

    expect(
      await screen.findByText("Client / Organization updated successfully.")
    ).toBeInTheDocument();
    const deactivateCall = calls.find(
      (call) =>
        call.url === `/api/v1/registration/clients/${clientA.id}` &&
        call.init?.method === "PATCH" &&
        String(call.init?.body) === JSON.stringify({ status: "INACTIVE" })
    );

    expect(deactivateCall).toBeDefined();
  });

  it("renders backend authorization failures without exposing mutation controls", async () => {
    mockFetchQueue([
      ...authResponses({
        ...baseSession,
        permissions: ["view_client"]
      }),
      {
        status: 403,
        body: {
          error: {
            code: "FORBIDDEN",
            message: "Forbidden"
          }
        }
      }
    ]);

    renderWithRoute(routes.registrationClients);

    expect(
      await screen.findByRole("heading", {
        name: "Client / Organization registration is not available with your current authorization."
      })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Register Client" })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Save Client / Organization" })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Deactivate Client / Organization" })
    ).not.toBeInTheDocument();
  });
});
