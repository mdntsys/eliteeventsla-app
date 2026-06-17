"use client";

import { useActionState } from "react";
import { login, type LoginState } from "./actions";

export function LoginForm({ redirectTo }: { redirectTo?: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(
    login,
    undefined,
  );

  return (
    <form action={action} className="flex flex-col gap-5">
      <input type="hidden" name="redirectTo" value={redirectTo ?? ""} />

      <label className="flex flex-col gap-1.5">
        <span className="eyebrow">Email</span>
        <input
          name="email"
          type="email"
          autoComplete="email"
          required
          className="rounded-(--radius-card) border border-line bg-cream px-3.5 py-2.5 text-ink outline-none transition focus:border-navy"
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="eyebrow">Password</span>
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="rounded-(--radius-card) border border-line bg-cream px-3.5 py-2.5 text-ink outline-none transition focus:border-navy"
        />
      </label>

      {state?.error && (
        <p role="alert" className="text-sm text-red-700">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="mt-1 rounded-(--radius-card) bg-navy px-4 py-2.5 font-medium text-cream transition hover:opacity-90 disabled:opacity-60"
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
