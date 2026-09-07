import { FormEvent, useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";

import { isApiError } from "../../api/errors";
import { useAuth } from "../../auth/useAuth";
import { routes } from "../routePaths";

export function LoginPage() {
  const auth = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState("");
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

    if (!identifier.trim() || !password) {
      setFieldError("Enter your email or username and password.");
      return;
    }

    setIsSubmitting(true);

    try {
      await auth.login({
        identifier: identifier.trim(),
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
    <main
      className="relative min-h-screen overflow-hidden bg-cover bg-center bg-no-repeat px-5 py-8 sm:px-8 lg:bg-cover lg:bg-[center_15%] lg:px-12"
      data-testid="login-page"
      style={{ backgroundImage: "url('/brand/LoginBackround.png')" }}
    >
      <div
        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/80 to-white/100"
        aria-hidden="true"
      />
      <div className="relative mx-auto grid min-h-[calc(100vh-4rem)] max-w-[1540px] items-center gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:gap-12">
        <div className="relative flex flex-col items-center justify-center lg:-translate-y-10 lg:items-start lg:pl-[3%] xl:-translate-y-14">
          <img
            alt="Client Lens by OGI Ltd."
            className="w-full max-w-[32rem] drop-shadow-[0_12px_32px_rgba(255,255,255,0.62)] sm:max-w-[36rem] lg:w-[90%] lg:max-w-[30rem] lg:translate-x-12 xl:w-[80%] xl:max-w-[35rem] xl:translate-x-60"
            src="/brand/client-lens-logo.png"
          />
          <p className="mt-3 text-center text-xs font-semibold uppercase leading-relaxed tracking-[0.32em] text-primary-navy sm:text-sm lg:ml-[70%] whitespace-nowrap lg:-translate-y-[40px] lg:text-left xl:mt-4 xl:text-base">
            Safer operations.
            <br />
            Stronger tomorrows.
          </p>
        </div>

        <section
          aria-labelledby="login-heading"
          className="w-full max-w-[39rem] justify-self-center rounded-[1rem] border border-white/80 bg-white/[0.88] p-7 shadow-[0_24px_70px_rgba(15,45,95,0.14)] backdrop-blur-md sm:p-10 lg:justify-self-end lg:p-12"
        >
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-primary-blue sm:text-base">
            Secure access
          </p>
          <h1
            id="login-heading"
            className="mt-3 text-3xl font-semibold tracking-tight text-primary-navy sm:text-4xl"
          >
            Sign in to Client Lens
          </h1>
        </div>

        <form className="mt-9 space-y-6" onSubmit={handleSubmit}>
          <div>
            <label
              className="block text-base font-semibold text-primary-navy"
              htmlFor="identifier"
            >
              Email or Username
            </label>
            <input
              autoComplete="username"
              className="mt-2 min-h-14 w-full rounded-lg border border-blue-200 bg-blue-50/70 px-4 text-base outline-none transition focus:border-focus focus:bg-white focus:ring-2 focus:ring-focus"
              id="identifier"
              name="identifier"
              onChange={(event) => setIdentifier(event.target.value)}
              type="text"
              value={identifier}
            />
          </div>

          <div>
            <label
              className="block text-base font-semibold text-primary-navy"
              htmlFor="password"
            >
              Password
            </label>
            <input
              autoComplete="current-password"
              className="mt-2 min-h-14 w-full rounded-lg border border-blue-200 bg-blue-50/70 px-4 text-base outline-none transition focus:border-focus focus:bg-white focus:ring-2 focus:ring-focus"
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
            className="inline-flex min-h-14 w-full items-center justify-center rounded-lg bg-primary-blue px-4 text-base font-semibold text-text-inverse shadow-sm outline-none transition hover:bg-primary-navy focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:cursor-not-allowed disabled:opacity-70"
            disabled={isSubmitting}
            type="submit"
          >
            {isSubmitting ? "Signing in..." : "Sign in"}
          </button>
          <div className="flex items-center gap-4 pt-2" aria-hidden="true"><span className="h-px flex-1 bg-border"/><span className="text-xs font-semibold text-text-muted">OR</span><span className="h-px flex-1 bg-border"/></div>
          <Link className="block text-center text-sm font-semibold text-primary-blue hover:text-primary-navy" to={routes.forgotPassword}>Forgot your password?</Link>
        </form>
        </section>
      </div>

      <p className="relative mt-4 text-center text-[0.7rem] font-semibold uppercase tracking-[0.28em] text-primary-navy/70 lg:absolute lg:bottom-8 lg:right-12 lg:mt-0">
        People <span aria-hidden="true">|</span> Places <span aria-hidden="true">|</span> Progress
      </p>
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
