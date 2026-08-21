"use client";

import { type FormEvent, useState } from "react";

export default function LoginPage() {
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/login", {
      body: JSON.stringify({
        email: form.get("email"),
        password: form.get("password"),
      }),
      headers: { "content-type": "application/json" },
      method: "POST",
    });

    if (response.ok) {
      const next = new URLSearchParams(window.location.search).get("next");
      window.location.assign(
        next?.startsWith("/") && !next.startsWith("//") ? next : "/",
      );
      return;
    }

    setError("That email or password did not work.");
    setSubmitting(false);
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-neutral-950 px-5 text-neutral-50">
      <form
        className="w-full max-w-sm space-y-5 rounded-2xl border border-neutral-800 bg-neutral-900 p-6"
        onSubmit={submit}
      >
        <div>
          <p className="text-sm font-medium uppercase tracking-widest text-lime-400">
            Keep it tight
          </p>
          <h1 className="mt-2 text-3xl font-bold">Sign in</h1>
        </div>

        <label className="block space-y-2">
          <span className="text-sm text-neutral-300">Email</span>
          <input
            autoComplete="email"
            className="min-h-12 w-full rounded-xl border border-neutral-700 bg-neutral-950 px-4 text-base outline-none focus:border-lime-400"
            inputMode="email"
            name="email"
            required
            type="email"
          />
        </label>

        <label className="block space-y-2">
          <span className="text-sm text-neutral-300">Password</span>
          <input
            autoComplete="current-password"
            className="min-h-12 w-full rounded-xl border border-neutral-700 bg-neutral-950 px-4 text-base outline-none focus:border-lime-400"
            name="password"
            required
            type="password"
          />
        </label>

        {error ? (
          <p aria-live="polite" className="text-sm text-red-300">
            {error}
          </p>
        ) : null}

        <button
          className="min-h-12 w-full rounded-xl bg-lime-400 px-4 font-bold text-neutral-950 disabled:opacity-60"
          disabled={submitting}
          type="submit"
        >
          {submitting ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </main>
  );
}
