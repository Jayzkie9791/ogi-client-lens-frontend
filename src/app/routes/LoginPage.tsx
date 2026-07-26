import { FormEvent, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";

import { isApiError } from "../../api/errors";
import { useAuth } from "../../auth/useAuth";
import { routes } from "../routePaths";

export function LoginPage() {
  const auth = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (auth.status === "authenticated") {
    return <Navigate replace to={readDestination(location.state) ?? routes.workbench} />;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFieldError(null);
    auth.clearAuthError();

    if (!email.trim() || !password) {
      setFieldError("Enter your email and password.");
      return;
    }

    setIsSubmitting(true);

    try {
      await auth.login({
        email: email.trim(),
        password
      });
      navigate(readDestination(location.state) ?? routes.workbench, {
        replace: true
      });
    } catch (error) {
      setFieldError(
        isApiError(error)
          ? error.message
          : "Sign in failed. Check your credentials and try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  const visibleError = fieldError ?? auth.errorMessage;

  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas px-4 py-8">
      <section
        aria-labelledby="login-heading"
        className="w-full max-w-md rounded-panel border border-border bg-surface p-6 shadow-panel"
      >
        <img
          alt="Client Lens by OGI Ltd."
          className="h-14 w-auto"
          src="/brand/client-lens-logo.png"
        />
        <div className="mt-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary-blue">
            Secure access
          </p>
          <h1
            id="login-heading"
            className="mt-2 text-2xl font-semibold text-text-primary"
          >
            Sign in to Client Lens
          </h1>
        </div>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <div>
            <label
              className="block text-sm font-semibold text-text-primary"
              htmlFor="email"
            >
              Email
            </label>
            <input
              autoComplete="email"
              className="mt-1 min-h-11 w-full rounded-component border border-border bg-surface px-3 text-sm outline-none focus:border-focus focus:ring-2 focus:ring-focus"
              id="email"
              name="email"
              onChange={(event) => setEmail(event.target.value)}
              type="email"
              value={email}
            />
          </div>

          <div>
            <label
              className="block text-sm font-semibold text-text-primary"
              htmlFor="password"
            >
              Password
            </label>
            <input
              autoComplete="current-password"
              className="mt-1 min-h-11 w-full rounded-component border border-border bg-surface px-3 text-sm outline-none focus:border-focus focus:ring-2 focus:ring-focus"
              id="password"
              name="password"
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              value={password}
            />
          </div>

          {visibleError ? (
            <p className="rounded-component border border-state-error bg-red-50 px-3 py-2 text-sm text-state-error">
              {visibleError}
            </p>
          ) : null}

          <button
            className="inline-flex min-h-11 w-full items-center justify-center rounded-component bg-primary-blue px-4 text-sm font-semibold text-text-inverse outline-none hover:bg-primary-navy focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:cursor-not-allowed disabled:opacity-70"
            disabled={isSubmitting}
            type="submit"
          >
            {isSubmitting ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </section>
    </main>
  );
}

function readDestination(state: unknown) {
  if (!state || typeof state !== "object" || !("from" in state)) {
    return null;
  }

  const value = (state as { from?: unknown }).from;

  return typeof value === "string" && value.startsWith("/") ? value : null;
}
