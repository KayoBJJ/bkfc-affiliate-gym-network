export function resolveIdempotency(
  prior: { applicationReference: string; payloadHash: string } | null,
  payloadHash: string,
) {
  if (!prior) return { outcome: "new" as const };
  if (prior.payloadHash === payloadHash) {
    return { outcome: "reuse" as const, applicationReference: prior.applicationReference };
  }
  return { outcome: "conflict" as const };
}

export async function removeRequestObjects(
  paths: string[],
  remove: (pathsToRemove: string[]) => Promise<{ error: unknown | null }>,
) {
  if (!paths.length) return "not_required" as const;
  const { error } = await remove(paths);
  return error ? "failed" as const : "succeeded" as const;
}
