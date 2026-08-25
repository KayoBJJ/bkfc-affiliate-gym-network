import { createHash, timingSafeEqual } from "node:crypto";

export type BearerAuthentication = {
  authorized: true;
  credentialFingerprint: string;
} | {
  authorized: false;
};

export function authenticateBearer(header: string | null, acceptedSecrets: readonly string[]): BearerAuthentication {
  if (!header || acceptedSecrets.length === 0) return { authorized: false };
  const supplied = Buffer.from(header, "utf8");
  let matchedSecret: string | undefined;
  for (const secret of acceptedSecrets) {
    const expected = Buffer.from(`Bearer ${secret}`, "utf8");
    const sameLength = supplied.length === expected.length;
    const comparison = sameLength ? supplied : Buffer.alloc(expected.length);
    if (timingSafeEqual(comparison, expected) && sameLength) matchedSecret = secret;
  }
  return matchedSecret
    ? { authorized: true, credentialFingerprint: createHash("sha256").update(matchedSecret).digest("hex") }
    : { authorized: false };
}

export function bearerAuthorized(header: string | null, acceptedSecrets: readonly string[]) {
  return authenticateBearer(header, acceptedSecrets).authorized;
}
