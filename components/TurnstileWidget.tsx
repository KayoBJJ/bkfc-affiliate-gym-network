"use client";

import Script from "next/script";
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { TURNSTILE_ACTION } from "@/lib/application/turnstile-contract";

type TurnstileApi = {
  render: (element: HTMLElement, options: Record<string, unknown>) => string;
  reset: (widgetId: string) => void;
  remove: (widgetId: string) => void;
};

declare global {
  interface Window { turnstile?: TurnstileApi }
}

export type TurnstileWidgetHandle = { reset: () => void };

type Props = {
  onToken: (token: string | null) => void;
  onStateChange: (state: "loading" | "ready" | "error" | "expired") => void;
  unavailableMessage: string;
};

export const TurnstileWidget = forwardRef<TurnstileWidgetHandle, Props>(function TurnstileWidget(
  { onToken, onStateChange, unavailableMessage },
  ref,
) {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string>();
  const [scriptError, setScriptError] = useState(false);

  const renderWidget = useCallback(() => {
    if (!siteKey || !containerRef.current || !window.turnstile || widgetIdRef.current) return;
    widgetIdRef.current = window.turnstile.render(containerRef.current, {
      sitekey: siteKey,
      action: TURNSTILE_ACTION,
      theme: "dark",
      appearance: "interaction-only",
      callback: (token: string) => {
        onToken(token);
        onStateChange("ready");
      },
      "expired-callback": () => {
        onToken(null);
        onStateChange("expired");
      },
      "timeout-callback": () => {
        onToken(null);
        onStateChange("expired");
      },
      "error-callback": () => {
        onToken(null);
        onStateChange("error");
      },
    });
  }, [onStateChange, onToken, siteKey]);

  useImperativeHandle(ref, () => ({
    reset() {
      onToken(null);
      if (widgetIdRef.current && window.turnstile) window.turnstile.reset(widgetIdRef.current);
      onStateChange("loading");
    },
  }), [onStateChange, onToken]);

  useEffect(() => () => {
    if (widgetIdRef.current && window.turnstile) window.turnstile.remove(widgetIdRef.current);
    widgetIdRef.current = undefined;
  }, []);

  if (!siteKey || scriptError) {
    return <div className="turnstile-error" role="alert">{unavailableMessage}</div>;
  }

  return (
    <div className="turnstile-shell">
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
        onReady={renderWidget}
        onError={() => {
          setScriptError(true);
          onStateChange("error");
        }}
      />
      <div ref={containerRef} className="turnstile-widget" aria-label="Security verification" />
    </div>
  );
});
