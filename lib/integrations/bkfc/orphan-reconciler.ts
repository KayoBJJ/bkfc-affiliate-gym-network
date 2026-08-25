const APPLICATION_DIRECTORY = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type OrphanStorageEntry = {
  name: string;
  created_at?: string | null;
  metadata?: unknown;
};

export type OrphanReconcilerDependencies = {
  list: (prefix: string, options: { limit: number; offset: number }) => Promise<{ data: OrphanStorageEntry[] | null; error: unknown | null }>;
  isLinked: (path: string) => Promise<{ data: boolean | null; error: unknown | null }>;
  remove: (paths: string[]) => Promise<{ error: unknown | null }>;
  log: (event: Record<string, string | number | boolean>) => void;
};

export type OrphanReconcilerPolicy = {
  dryRun: boolean;
  batchSize: number;
  minimumAgeHours: number;
  maximumPages: number;
};

export type OrphanReconcilerSummary = {
  dryRun: boolean;
  scanned: number;
  eligible: number;
  protected: number;
  removed: number;
  failures: number;
  pages: number;
};

function oldEnough(createdAt: string | null | undefined, cutoff: number) {
  const parsed = Date.parse(createdAt ?? "");
  return Number.isFinite(parsed) && parsed < cutoff;
}

export async function reconcileBkfcIntegrationOrphans(
  dependencies: OrphanReconcilerDependencies,
  policy: OrphanReconcilerPolicy,
  now = Date.now(),
): Promise<OrphanReconcilerSummary> {
  const summary: OrphanReconcilerSummary = {
    dryRun: policy.dryRun, scanned: 0, eligible: 0, protected: 0, removed: 0, failures: 0, pages: 0,
  };
  const pageSize = Math.max(1, Math.min(100, policy.batchSize));
  const cutoff = now - policy.minimumAgeHours * 60 * 60 * 1000;

  for (let rootPage = 0; rootPage < policy.maximumPages && summary.scanned < policy.batchSize; rootPage += 1) {
    const root = await dependencies.list("", { limit: pageSize, offset: rootPage * pageSize });
    summary.pages += 1;
    if (root.error) {
      summary.failures += 1;
      dependencies.log({ code: "ORPHAN_ROOT_LIST_FAILED", page: rootPage + 1 });
      break;
    }
    const directories = (root.data ?? []).filter((entry) => APPLICATION_DIRECTORY.test(entry.name));
    for (const directory of directories) {
      if (summary.scanned >= policy.batchSize) break;
      for (let objectPage = 0; objectPage < policy.maximumPages && summary.scanned < policy.batchSize; objectPage += 1) {
        const prefix = `${directory.name}/logo`;
        const listed = await dependencies.list(prefix, { limit: pageSize, offset: objectPage * pageSize });
        summary.pages += 1;
        if (listed.error) {
          summary.failures += 1;
          dependencies.log({ code: "ORPHAN_OBJECT_LIST_FAILED", page: objectPage + 1 });
          break;
        }
        const objects = listed.data ?? [];
        for (const object of objects) {
          if (summary.scanned >= policy.batchSize) break;
          summary.scanned += 1;
          if (!oldEnough(object.created_at, cutoff)) continue;
          const path = `${prefix}/${object.name}`;
          const reference = await dependencies.isLinked(path);
          if (reference.error || typeof reference.data !== "boolean") {
            summary.failures += 1;
            dependencies.log({ code: "ORPHAN_REFERENCE_CHECK_FAILED" });
            continue;
          }
          if (reference.data) {
            summary.protected += 1;
            continue;
          }
          summary.eligible += 1;
          if (policy.dryRun) continue;
          const removal = await dependencies.remove([path]);
          if (removal.error) {
            summary.failures += 1;
            dependencies.log({ code: "ORPHAN_REMOVE_FAILED" });
            continue;
          }
          summary.removed += 1;
        }
        if (objects.length < pageSize) break;
      }
    }
    if ((root.data ?? []).length < pageSize) break;
  }
  dependencies.log({ code: "ORPHAN_RECONCILIATION_COMPLETE", ...summary });
  return summary;
}
