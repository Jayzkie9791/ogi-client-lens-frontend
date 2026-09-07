import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, expect, it, vi } from "vitest";

import { ForgotPasswordPage, ResetPasswordPage } from "./PasswordResetPages";
import { confirmPasswordReset, requestPasswordReset } from "../../auth/authApi";

vi.mock("../../auth/authApi", () => ({
  requestPasswordReset: vi.fn(),
  confirmPasswordReset: vi.fn()
}));

beforeEach(() => {
  vi.mocked(requestPasswordReset).mockReset();
  vi.mocked(confirmPasswordReset).mockReset();
  window.localStorage.clear();
  window.sessionStorage.clear();
});

it("renders forgot password and shows the same non-disclosing confirmation", async () => {
  vi.mocked(requestPasswordReset).mockResolvedValue({ accepted: true });
  const user = userEvent.setup();
  render(<MemoryRouter><ForgotPasswordPage /></MemoryRouter>);

  await user.type(screen.getByLabelText("Email or Username"), "unknown@example.test");
  await user.click(screen.getByRole("button", { name: "Send reset instructions" }));

  expect(requestPasswordReset).toHaveBeenCalledWith("unknown@example.test");
  expect(await screen.findByRole("status")).toHaveTextContent(
    "If an eligible account matches that information, password reset instructions have been sent."
  );
  expect(screen.getByRole("link", { name: "Return to Sign In" })).toHaveAttribute("href", "/login");
});

it("shows a generic retryable error when a reset request fails", async () => {
  vi.mocked(requestPasswordReset).mockRejectedValue(new Error("sensitive delivery detail"));
  const user = userEvent.setup();
  render(<MemoryRouter><ForgotPasswordPage /></MemoryRouter>);

  await user.type(screen.getByLabelText("Email or Username"), "unknown@example.test");
  await user.click(screen.getByRole("button", { name: "Send reset instructions" }));

  expect(await screen.findByRole("alert")).toHaveTextContent(
    "We couldn't process the request right now. Please try again."
  );
  expect(screen.queryByText("sensitive delivery detail")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Send reset instructions" })).toBeEnabled();
});

it("rejects mismatched replacement passwords without calling the API", async () => {
  const user = userEvent.setup();
  render(<MemoryRouter initialEntries={["/reset-password?token=" + "a".repeat(43)]}><ResetPasswordPage /></MemoryRouter>);
  await user.type(screen.getByLabelText("New password"), "replacement-password");
  await user.type(screen.getByLabelText("Confirm new password"), "different-password");
  await user.click(screen.getByRole("button", { name: "Reset password" }));
  expect(screen.getByRole("alert")).toHaveTextContent("Passwords do not match.");
  expect(confirmPasswordReset).not.toHaveBeenCalled();
});

it("confirms through the real auth client boundary, clears secrets, and guides back to sign in", async () => {
  const token = "a".repeat(43);
  vi.mocked(confirmPasswordReset).mockResolvedValue({ reset: true });
  const user = userEvent.setup();
  render(
    <MemoryRouter initialEntries={[`/reset-password?token=${token}`]}>
      <LocationProbe />
      <Routes><Route path="/reset-password" element={<ResetPasswordPage />} /></Routes>
    </MemoryRouter>
  );
  await user.type(screen.getByLabelText("New password"), "replacement-password");
  await user.type(screen.getByLabelText("Confirm new password"), "replacement-password");
  await user.click(screen.getByRole("button", { name: "Reset password" }));
  expect(confirmPasswordReset).toHaveBeenCalledWith(token, "replacement-password");
  expect(
    await screen.findByText(
      "Your password has been reset. Sign in with your new password."
    )
  ).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Continue to Sign In" })).toHaveAttribute("href", "/login");
  expect(window.localStorage.length).toBe(0);
  expect(window.sessionStorage.length).toBe(0);
  expect(screen.getByTestId("current-location")).toHaveTextContent("/reset-password");
  expect(screen.getByTestId("current-location")).not.toHaveTextContent("token=");
});

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="current-location">{`${location.pathname}${location.search}`}</output>;
}
