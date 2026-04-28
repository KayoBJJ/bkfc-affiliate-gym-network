const allowedAdminEmails = [
  "kkaloyanov@lgsports-ent.com",
  // TODO: Add affiliate@bkfc.com
  // TODO: Add lubo@bkfc.com
  // TODO: Add marchela@bkfc.com
];

export function isAllowedAdminEmail(email: string | undefined | null) {
  if (!email) {
    return false;
  }

  return allowedAdminEmails.includes(email.toLowerCase());
}

