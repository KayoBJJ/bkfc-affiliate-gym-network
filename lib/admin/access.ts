const allowedAdminEmails = [
  "kkaloyanov@lgsports-ent.com",
  "lubo@bkfc.com",
  // TODO: Add affiliate@bkfc.com
  // TODO: Add marchela@bkfc.com
];

export function isAllowedAdminEmail(email: string | undefined | null) {
  if (!email) {
    return false;
  }

  return allowedAdminEmails.includes(email.toLowerCase());
}

