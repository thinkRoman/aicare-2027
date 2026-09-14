"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { ByokWidget } from "@/components/settings/ByokWidget";
import { PRODUCT_BRAND } from "@/lib/brand";
import { MIN_TOUCH_TARGET_PX } from "@/lib/consumer/triageUi";

type SessionState =
  | { status: "loading" }
  | { status: "anonymous" }
  | { status: "authenticated"; email: string; userId: string }
  | { status: "unavailable"; message: string };

export default function SettingsPage() {
  const [session, setSession] = useState<SessionState>({ status: "loading" });
  const [email, setEmail] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refreshSession = useCallback(async () => {
    try {
      const response = await fetch("/api/auth/session");
      const json = (await response.json()) as {
        ok: boolean;
        authenticated: boolean;
        user: { userId: string; email: string } | null;
        message?: string;
      };
      if (json.message && !json.authenticated) {
        setSession({ status: "unavailable", message: json.message });
        return;
      }
      if (json.authenticated && json.user) {
        setSession({
          status: "authenticated",
          email: json.user.email,
          userId: json.user.userId,
        });
        return;
      }
      setSession({ status: "anonymous" });
    } catch {
      setSession({
        status: "unavailable",
        message: "Unable to check authentication right now.",
      });
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refreshSession();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [refreshSession]);

  async function signIn(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setAuthError(null);
    try {
      const response = await fetch("/api/auth/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const json = (await response.json()) as {
        ok: boolean;
        message?: string;
      };
      if (!response.ok || !json.ok) {
        setAuthError(json.message ?? "Sign-in failed.");
        return;
      }
      await refreshSession();
    } catch {
      setAuthError("Sign-in failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    setBusy(true);
    try {
      await fetch("/api/auth/session", { method: "DELETE" });
      await refreshSession();
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="aicare-shell mx-auto flex min-h-dvh w-full max-w-2xl flex-col gap-6 overflow-x-hidden px-4 py-6">
      <header className="space-y-2">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-teal-800">
          {PRODUCT_BRAND}
        </p>
        <h1 className="text-3xl font-semibold text-slate-950">Settings</h1>
        <p className="text-sm text-slate-600">
          Advanced provider configuration is isolated from the ordinary triage
          flow.
        </p>
        <Link
          href="/"
          className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-medium text-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
          style={{ minHeight: MIN_TOUCH_TARGET_PX }}
        >
          Back to triage
        </Link>
      </header>

      {session.status === "loading" ? (
        <p className="text-sm text-slate-600" role="status">
          Checking sign-in…
        </p>
      ) : null}

      {session.status === "unavailable" ? (
        <section className="rounded-2xl border border-amber-300 bg-amber-50 p-5">
          <h2 className="text-lg font-semibold text-amber-950">
            Sign-in unavailable
          </h2>
          <p className="mt-2 text-sm text-amber-950">{session.message}</p>
        </section>
      ) : null}

      {session.status === "anonymous" ? (
        <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-semibold text-slate-900">Sign in</h2>
          <p className="text-sm text-slate-600">
            Authentication is required before saving advanced AI credentials.
            Your user id is derived on the server and is never taken from form
            fields as authoritative identity.
          </p>
          <form className="space-y-3" onSubmit={(event) => void signIn(event)}>
            <label
              htmlFor="settings-email"
              className="text-sm font-medium text-slate-800"
            >
              Email
            </label>
            <input
              id="settings-email"
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 text-base focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
              style={{ minHeight: MIN_TOUCH_TARGET_PX }}
              autoComplete="email"
              inputMode="email"
              enterKeyHint="go"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
            />
            <button
              type="submit"
              disabled={busy}
              className="inline-flex w-full items-center justify-center rounded-xl bg-teal-800 px-4 text-sm font-semibold text-white disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-900"
              style={{ minHeight: MIN_TOUCH_TARGET_PX }}
            >
              Sign in to manage settings
            </button>
          </form>
          {authError ? (
            <p className="text-sm text-amber-900" role="alert">
              {authError}
            </p>
          ) : null}
        </section>
      ) : null}

      {session.status === "authenticated" ? (
        <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-700">
            Signed in as <span className="font-medium">{session.email}</span>
          </p>
          <button
            type="button"
            disabled={busy}
            className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-medium text-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
            style={{ minHeight: MIN_TOUCH_TARGET_PX }}
            onClick={() => void signOut()}
          >
            Sign out
          </button>
        </section>
      ) : null}

      <ByokWidget authenticated={session.status === "authenticated"} />
    </main>
  );
}
