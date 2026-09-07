import { afterEach, expect, it, vi } from "vitest";

import { confirmPasswordReset, requestPasswordReset } from "./authApi";

afterEach(() => vi.unstubAllGlobals());

it("requests password reset anonymously with only the account identifier", async () => {
  const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ accepted: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  }));
  vi.stubGlobal("fetch", fetchMock);

  await expect(requestPasswordReset("user@example.test")).resolves.toEqual({ accepted: true });
  const [requestUrl, init] = fetchMock.mock.calls[0] as [string, RequestInit];
  expect(new URL(requestUrl, window.location.origin).pathname).toBe("/api/v1/auth/password-reset/request");
  expect(init.method).toBe("POST");
  expect((init.headers as Headers).get("Authorization")).toBeNull();
  expect(JSON.parse(String(init.body))).toEqual({ identifier: "user@example.test" });
});

it("confirms password reset without persisting the token in browser storage", async () => {
  const token = "a".repeat(43);
  const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ reset: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  }));
  vi.stubGlobal("fetch", fetchMock);

  await expect(confirmPasswordReset(token, "replacement-password")).resolves.toEqual({ reset: true });
  const [requestUrl, init] = fetchMock.mock.calls[0] as [string, RequestInit];
  expect(new URL(requestUrl, window.location.origin).pathname).toBe("/api/v1/auth/password-reset/confirm");
  expect(init.method).toBe("POST");
  expect((init.headers as Headers).get("Authorization")).toBeNull();
  expect(JSON.parse(String(init.body))).toEqual({ token, newPassword: "replacement-password" });
  expect(window.localStorage.length).toBe(0);
  expect(window.sessionStorage.length).toBe(0);
});

it("fails closed on malformed reset responses", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ token: "leaked" }), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  })));
  await expect(requestPasswordReset("user@example.test")).rejects.toMatchObject({ code: "MALFORMED_RESPONSE" });
});
