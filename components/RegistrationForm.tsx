"use client";

import { FormEvent, useState } from "react";

type SubmissionState =
  | {
      status: "idle";
      message: "";
    }
  | {
      status: "success" | "error";
      message: string;
    };

const initialState: SubmissionState = {
  status: "idle",
  message: ""
};

export function RegistrationForm() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionState, setSubmissionState] =
    useState<SubmissionState>(initialState);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const form = event.currentTarget;

    if (!form.reportValidity()) {
      return;
    }

    setIsSubmitting(true);
    setSubmissionState(initialState);

    try {
      const formData = new FormData(form);
      const response = await fetch("/api/affiliate-registration", {
        method: "POST",
        body: formData
      });

      const payload = (await response.json()) as { message?: string };

      if (!response.ok) {
        throw new Error(payload.message || "Unable to submit registration.");
      }

      form.reset();
      setSubmissionState({
        status: "success",
        message:
          payload.message ||
          "Registration submitted successfully. Your materials have been received for review by BKFC International Development. Applications are typically reviewed within 5–10 business days. If additional information is required during evaluation, you will be contacted at the email provided."
      });
    } catch (error) {
      setSubmissionState({
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "Unable to submit registration."
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="registration-form" onSubmit={handleSubmit}>
      <div className="form-grid">
        <label className="field">
          <span>Gym name</span>
          <input name="gymName" type="text" required />
        </label>

        <label className="field">
          <span>City / Country</span>
          <input name="cityCountry" type="text" required />
        </label>

        <label className="field">
          <span>Primary contact / Owner</span>
          <input name="contactPerson" type="text" required />
        </label>

        <label className="field">
          <span>Email address</span>
          <input name="email" type="email" required />
        </label>

        <label className="field">
          <span>Phone number</span>
          <input name="phone" type="tel" required />
        </label>

        <label className="field">
          <span>Website / Social media profile</span>
          <input
            name="websiteInstagram"
            type="text"
            required
            placeholder="https://example.com or @gymhandle"
          />
        </label>

        <label className="field field-full">
          <span>Disciplines offered</span>
          <textarea
            name="disciplinesOffered"
            rows={4}
            required
            placeholder="Example: Boxing, Muay Thai, MMA, strength and conditioning, youth classes..."
          />
        </label>

        <label className="field">
          <span>Logo upload</span>
          <input
            name="logoUpload"
            type="file"
            accept="image/*,.pdf,.svg"
            required
          />
        </label>

        <label className="field">
          <span>Gym photos upload</span>
          <input
            name="gymPhotos"
            type="file"
            accept="image/*"
            multiple
            required
          />
        </label>

        <label className="field">
          <span>Fighter list upload</span>
          <input
            name="fighterListUpload"
            type="file"
            accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt"
          />
        </label>

        <label className="field">
  <span>Promo video link</span>
  <input
    name="promoVideoLink"
    type="url"
    placeholder="YouTube, Google Drive, Dropbox, WeTransfer or Instagram link"
  />
</label>
      </div>

      <section className="consent-panel" aria-labelledby="consent-heading">
        <div className="section-heading">
          <p className="eyebrow">Consent</p>
          <h3 id="consent-heading">Data collection and review</h3>
        </div>
        <p className="privacy-copy">
          Submitted information will be collected and stored for affiliate
          network evaluation, internal processing, and follow-up communication
          related to onboarding.
        </p>

        <label className="checkbox-field">
          <input name="reviewConsent" type="checkbox" required />
          <span>
            I agree to submit the provided information for review and internal
            processing.
          </span>
        </label>

        <label className="checkbox-field">
          <input name="followUpConsent" type="checkbox" />
          <span>I would like to receive follow-up communication.</span>
        </label>
      </section>

      <div className="submit-row">
        <button type="submit" className="submit-button" disabled={isSubmitting}>
          {isSubmitting ? "Submitting..." : "Submit for Review"}
        </button>
        {submissionState.status !== "idle" ? (
          <p
            className={`submission-message ${submissionState.status}`}
            role="status"
            aria-live="polite"
          >
            {submissionState.message}
          </p>
        ) : null}
      </div>
    </form>
  );
}
