"use client";

import { useRef, useState } from "react";
import {
  TurnstileWidget,
  type TurnstileWidgetHandle,
} from "@/components/TurnstileWidget";
import { PORTAL_RECOVERY_TURNSTILE_ACTION } from "@/lib/application/turnstile-contract";

const GENERIC_MESSAGE =
  "If the details match an application, a secure recovery email will arrive shortly.";

export function RecoveryForm() {
  const turnstileRef = useRef<TurnstileWidgetHandle>(null);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [securityState, setSecurityState] = useState<
    "loading" | "ready" | "error" | "expired"
  >("loading");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");

  async function submit(formData: FormData) {
    if (!turnstileToken) {
      setStatus("error");
      setMessage("Complete the security verification before continuing.");
      return;
    }
    setPending(true);
    setMessage("");
    try {
      const response = await fetch("/api/application-progress/recovery", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          applicationReference: formData.get("application_reference"),
          email: formData.get("email"),
          idempotencyKey: crypto.randomUUID(),
          turnstileToken,
        }),
      });
      const result = await response.json() as { message?: string };
      if (!response.ok) throw new Error("The recovery request could not be completed.");
      setStatus("success");
      setMessage(result.message || GENERIC_MESSAGE);
    } catch {
      setStatus("error");
      setMessage(
        "The recovery request could not be completed. Please wait and try again.",
      );
    } finally {
      setPending(false);
      turnstileRef.current?.reset();
    }
  }

  return (
    <form action={submit} className="portal-recovery-form">
      <label>
        <span>Application reference</span>
        <input
          name="application_reference"
          type="text"
          placeholder="BKFC-GYM-XXXXXXXXXXXX"
          autoCapitalize="characters"
          autoComplete="off"
          maxLength={40}
          required
        />
      </label>
      <label>
        <span>Original application email</span>
        <input
          name="email"
          type="email"
          autoComplete="email"
          maxLength={254}
          required
        />
      </label>
      <TurnstileWidget
        ref={turnstileRef}
        action={PORTAL_RECOVERY_TURNSTILE_ACTION}
        onToken={setTurnstileToken}
        onStateChange={setSecurityState}
        unavailableMessage="Security verification is unavailable. Please try again later."
      />
      <button
        type="submit"
        className="cta-button"
        disabled={pending || securityState !== "ready"}
      >
        {pending ? "Requesting access..." : "Email recovery link"}
      </button>
      {message ? (
        <p className={`portal-recovery-message ${status}`} role="status">
          {message}
        </p>
      ) : null}
    </form>
  );
}
