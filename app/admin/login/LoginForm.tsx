"use client";

import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type LoginFormProps = {
  initialError?: string;
};

const errorMessages: Record<string, string> = {
  unauthorized: "This account is not approved for BKFC admin access.",
  invalid_credentials: "Invalid email or password.",
};

export function LoginForm({ initialError }: LoginFormProps) {
  const [pending, setPending] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(
    initialError ? errorMessages[initialError] ?? initialError : ""
  );

  const supabase = createSupabaseBrowserClient();

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setPending(true);

    const cleanEmail = email.trim().toLowerCase();

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password,
    });

    if (signInError) {
      setPending(false);
      setError(errorMessages.invalid_credentials);
      return;
    }

    window.location.href = "/admin/applications";
  }

  return (
    <section className="panel admin-login-panel">
      <div className="section-heading">
        <p className="eyebrow">Admin Access</p>
        <h2>Sign in to the BKFC dashboard</h2>
      </div>

      <form className="admin-login-form" onSubmit={handleSubmit}>
        <label className="admin-field">
          <span>Email</span>
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="name@example.com"
            required
          />
        </label>

        <label className="admin-field">
          <span>Password</span>
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Enter your password"
            required
          />
        </label>

        <button type="submit" className="cta-button admin-submit-button" disabled={pending}>
          {pending ? "Signing in..." : "Sign in"}
        </button>

        {error ? <p className="admin-form-message error">{error}</p> : null}
      </form>
    </section>
  );
}
