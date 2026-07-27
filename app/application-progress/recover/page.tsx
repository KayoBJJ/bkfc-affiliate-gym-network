import type { Metadata } from "next";
import Image from "next/image";
import { unstable_noStore as noStore } from "next/cache";
import { notFound } from "next/navigation";
import {
  isApplicantPortalEmailDeliveryEnabled,
  isApplicantPortalEnabled,
  isApplicantPortalRecoveryEnabled,
} from "@/lib/config/server";
import { RecoveryForm } from "./RecoveryForm";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata: Metadata = {
  title: "Recover Application Portal | BKFC Gym Network",
  description: "Recover private BKFC Gym Network application portal access.",
  robots: { index: false, follow: false, nocache: true },
  referrer: "no-referrer",
};

export default function ApplicantPortalRecoveryPage() {
  noStore();
  if (
    !isApplicantPortalEnabled() ||
    !isApplicantPortalRecoveryEnabled() ||
    !isApplicantPortalEmailDeliveryEnabled()
  ) {
    notFound();
  }
  return (
    <main className="portal-page portal-recovery-page">
      <div className="portal-shell">
        <header className="portal-header">
          <Image
            src="/bkfc-logo.png"
            width={188}
            height={70}
            alt="BKFC"
            className="portal-logo"
            priority
          />
          <div className="portal-security-note">
            <span aria-hidden="true">●</span>
            Secure access recovery
          </div>
        </header>
        <section className="portal-recovery-card">
          <p className="eyebrow">BKFC Gym Network</p>
          <h1>Recover your application portal</h1>
          <p>
            Enter the application reference and original email used for your gym
            application. For privacy, the response is identical whether or not
            the details match.
          </p>
          <RecoveryForm />
          <p className="portal-recovery-help">
            Recovery links expire after 30 minutes and can be used once. Your
            current portal link remains valid until recovery is completed.
          </p>
        </section>
      </div>
    </main>
  );
}
