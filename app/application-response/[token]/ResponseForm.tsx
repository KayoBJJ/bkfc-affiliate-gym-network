"use client";

import { FormEvent, useState, useTransition } from "react";
import { useFormState } from "react-dom";
import { STORAGE_BUCKET } from "@/lib/application/policy";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type {
  InformationResponseState,
} from "./actions";

const initialState: InformationResponseState = {
  message: "",
  status: "idle",
};

function SubmitButton({
  completed,
  pending,
}: {
  completed: boolean;
  pending: boolean;
}) {
  return (
    <button type="submit" className="cta-button" disabled={pending || completed}>
      {pending ? "Submitting securely..." : completed ? "Response received" : "Submit response"}
    </button>
  );
}

type Props = {
  token: string;
  action: (
    state: InformationResponseState,
    formData: FormData
  ) => Promise<InformationResponseState>;
};

export function ResponseForm({ token, action }: Props) {
  const [state, formAction] = useFormState(action, initialState);
  const [file, setFile] = useState<File | null>(null);
  const [uploadedAttachmentId, setUploadedAttachmentId] = useState("");
  const [uploadMessage, setUploadMessage] = useState("");
  const [clientError, setClientError] = useState("");
  const [isPending, startTransition] = useTransition();
  const completed = state.status === "success";

  async function uploadAttachment(selectedFile: File) {
    const createResponse = await fetch("/api/application-response/attachment", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "create",
        token,
        file: {
          name: selectedFile.name,
          size: selectedFile.size,
          type: selectedFile.type,
        },
      }),
    });
    const created = await createResponse.json() as {
      success?: boolean;
      message?: string;
      attachmentId?: string;
      path?: string;
      uploadToken?: string;
      contentType?: string;
    };
    if (
      !createResponse.ok ||
      !created.attachmentId ||
      !created.path ||
      !created.uploadToken
    ) {
      throw new Error(created.message || "Unable to prepare the secure upload.");
    }

    try {
      setUploadMessage("Uploading file securely...");
      const supabase = createSupabaseBrowserClient();
      const { error: uploadError } = await supabase.storage
        .from(STORAGE_BUCKET)
        .uploadToSignedUrl(created.path, created.uploadToken, selectedFile, {
          contentType: created.contentType || selectedFile.type,
        });
      if (uploadError) throw new Error("The file upload did not complete. Please try again.");

      setUploadMessage("Verifying file...");
      const finalizeResponse = await fetch("/api/application-response/attachment", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "finalize",
          token,
          attachmentId: created.attachmentId,
        }),
      });
      const finalized = await finalizeResponse.json() as {
        success?: boolean;
        message?: string;
      };
      if (!finalizeResponse.ok || !finalized.success) {
        throw new Error(finalized.message || "Unable to verify the uploaded file.");
      }
      setUploadedAttachmentId(created.attachmentId);
      setUploadMessage(`${selectedFile.name} uploaded and verified.`);
      return created.attachmentId;
    } catch (error) {
      await fetch("/api/application-response/attachment", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "abort",
          token,
          attachmentId: created.attachmentId,
        }),
      }).catch(() => undefined);
      throw error;
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setClientError("");
    const formData = new FormData(event.currentTarget);
    const responseText = String(formData.get("response_text") ?? "").trim();
    if (!responseText && !file && !uploadedAttachmentId) {
      setClientError("Add a file or write a response before submitting.");
      return;
    }

    try {
      let attachmentId = uploadedAttachmentId;
      if (file && !attachmentId) {
        attachmentId = await uploadAttachment(file);
      }
      if (attachmentId) formData.set("attachment_id", attachmentId);
      startTransition(() => {
        formAction(formData);
      });
    } catch (error) {
      setUploadMessage("");
      setClientError(
        error instanceof Error ? error.message : "The secure upload could not be completed.",
      );
    }
  }

  return (
    <form onSubmit={handleSubmit} className="response-form">
      <input type="hidden" name="token" value={token} />
      <label className="admin-field">
        <span>Requested file</span>
        <input
          type="file"
          accept=".pdf,.docx,.xlsx,.png,.jpg,.jpeg,.webp"
          disabled={completed || isPending || Boolean(uploadedAttachmentId)}
          onChange={(event) => {
            setFile(event.target.files?.[0] ?? null);
            setUploadedAttachmentId("");
            setUploadMessage("");
            setClientError("");
          }}
        />
        <small>PDF, DOCX, XLSX, PNG, JPG, or WebP · maximum 10 MB</small>
      </label>
      <label className="admin-field">
        <span>Optional note</span>
        <textarea
          name="response_text"
          rows={10}
          maxLength={6000}
          disabled={completed}
          placeholder="Add context for the BKFC team if needed."
        />
      </label>
      <SubmitButton completed={completed} pending={isPending || Boolean(uploadMessage && !uploadedAttachmentId)} />
      {uploadMessage ? (
        <p className="admin-form-message success" role="status">{uploadMessage}</p>
      ) : null}
      {clientError ? (
        <p className="admin-form-message error" role="alert">{clientError}</p>
      ) : null}
      {state.message ? (
        <p className={`admin-form-message ${state.status}`} role="status">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
