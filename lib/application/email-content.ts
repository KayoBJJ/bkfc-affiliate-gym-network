export type EmailApplication = {
  applicationReference: string;
  gymName: string;
  cityCountry: string;
  contactPerson: string;
  email: string;
  phone: string;
  websiteInstagram: string;
  disciplinesOffered: string;
  promoVideoLink: string;
  bkfcAppAccessInterest: boolean;
  reviewConsent: boolean;
  followUpConsent: boolean;
  facilityPhotoCount: number;
  fighterListSupplied: boolean;
};

export function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;",
  })[character]!);
}

function row(label: string, value: string) {
  return `<p><strong>${escapeHtml(label)}:</strong> ${escapeHtml(value)}</p>`;
}

export function buildInternalNotificationEmail(application: EmailApplication) {
  const optional = (value: string) => value || "Not provided";
  return [
    "<h1>New BKFC Gym Network application</h1>",
    row("Application reference", application.applicationReference),
    row("Gym", application.gymName),
    row("Location", application.cityCountry),
    row("Contact", application.contactPerson),
    row("Email", application.email),
    row("Phone", application.phone),
    row("Website or social profile", optional(application.websiteInstagram)),
    row("Disciplines", application.disciplinesOffered),
    row("Promotional video", optional(application.promoVideoLink)),
    row("BKFC App access interest", application.bkfcAppAccessInterest ? "Yes" : "No"),
    row("Review consent", application.reviewConsent ? "Yes" : "No"),
    row("Follow-up consent", application.followUpConsent ? "Yes" : "No"),
    row("Facility photos", String(application.facilityPhotoCount)),
    row("Fighter list supplied", application.fighterListSupplied ? "Yes" : "No"),
    "<p>Review private attachments in the authenticated admin dashboard.</p>",
  ].join("");
}
