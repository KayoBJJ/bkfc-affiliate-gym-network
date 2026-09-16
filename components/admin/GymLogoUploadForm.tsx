"use client";
import { useRef, useState, type FormEvent } from "react";
import { prepareGymLogoUpload } from "@/app/admin/applications/[id]/logo-upload-actions";
import { submitGymControlAction } from "@/app/admin/applications/[id]/gym-control-actions";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { GYM_LOGO_BUCKET, GYM_LOGO_MAX_BYTES, GYM_LOGO_CONTENT_TYPES } from "@/lib/integrations/bkfc/logo-upload-policy";
export function GymLogoUploadForm({ applicationId, version, disabled }: { applicationId: string; version: string | null; disabled: boolean }) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const attempt = useRef<{ key: string; commandId: string }>();
  const fileInput = useRef<HTMLInputElement>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const file = fileInput.current?.files?.[0];
    if (disabled || pending || !version) return;
    if (!file || file.size < 1 || file.size > GYM_LOGO_MAX_BYTES || !GYM_LOGO_CONTENT_TYPES.includes(file.type as typeof GYM_LOGO_CONTENT_TYPES[number])) {
      setMessage("Choose a JPEG, PNG, WebP, GIF or AVIF image up to 10 MiB."); return;
    }
    setPending(true); setMessage("Preparing secure upload…");
    try {
      const hash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", await file.arrayBuffer())), b => b.toString(16).padStart(2, "0")).join("");
      const key = `${version}:${file.type}:${hash}`;
      if (attempt.current?.key !== key) attempt.current = { key, commandId: crypto.randomUUID() };
      const commandId = attempt.current.commandId;
      const upload = await prepareGymLogoUpload({ applicationId, commandId, version, contentType: file.type, size: file.size, sha256: hash });
      setMessage("Uploading logo…");
      // The image goes directly to private Storage, not through a Vercel Function.
      // A retry may find the same immutable object already uploaded. Finalization
      // checks the server-held path, byte length, digest and image signature.
      try { if (upload.token) await createSupabaseBrowserClient().storage.from(GYM_LOGO_BUCKET).uploadToSignedUrl(upload.path, upload.token, file, { contentType: file.type }); } catch { /* reconcile a potentially completed upload below */ }
      setMessage("Verifying and recording the logo replacement…");
      const form = new FormData();
      form.set("applicationId", applicationId); form.set("commandId", commandId); form.set("kind", "logo"); form.set("version", version);
      const result = await submitGymControlAction({ status: "idle", message: "" }, form);
      setMessage(result.message);
    } catch { setMessage("Upload or confirmation is pending. Retry the same file, or refresh BKFC state if the listing changed."); }
    finally { setPending(false); }
  }
  return <form onSubmit={submit}>
    <label>Logo image (up to 10 MiB)<input ref={fileInput} type="file" accept={GYM_LOGO_CONTENT_TYPES.join(",")} required disabled={disabled || pending} /></label>
    <button type="submit" className="secondary-button" disabled={disabled || pending || !version}>{pending ? "Processing logo…" : "Replace logo"}</button>
    {message && <p role="status">{message}</p>}
  </form>;
}
