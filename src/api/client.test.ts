import { afterEach, describe, expect, it, vi } from "vitest";

import { apiRequest } from "./client";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("apiRequest caller headers", () => {
  it("sends an idempotency key while retaining JSON negotiation", async () => {
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const requestUrl = new URL(String(input));

        expect(requestUrl.pathname).toBe("/api/v1/training/sessions");
        expect(init?.method).toBe("POST");

        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }
    );
    vi.stubGlobal("fetch", fetchMock);

    await apiRequest("/api/v1/training/sessions", {
      method: "POST",
      body: { training_title: "Qualified session" },
      headers: { "idempotency-key": "session-command-1" },
      validate: (value): value is { ok: true } =>
        typeof value === "object" && value !== null && "ok" in value
    });

    const request = fetchMock.mock.calls[0][1] as RequestInit;
    const headers = request.headers as Headers;
    expect(headers.get("idempotency-key")).toBe("session-command-1");
    expect(headers.get("Accept")).toBe("application/json");
    expect(headers.get("Content-Type")).toBe("application/json");
  });
});
