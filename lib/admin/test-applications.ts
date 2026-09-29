// Explicitly confirmed by Kay during the September 2026 launch cleanup.
// Use stable IDs: names, email addresses and internal notes are not test markers.
const confirmedTests = new Map<string, string>([
  ["72a508c4-acad-4af1-a0f1-8615b03a79bd", "Archived friend-submitted test"],
  ["d58a32fb-c475-4996-aba0-5a198dca559f", "Upload and follow-up test"],
  ["da826f5d-22f9-4395-beaf-e9a841f1def0", "Closed production lifecycle test"],
]);

export function confirmedTestReason(id: string): string | null {
  return confirmedTests.get(id) ?? null;
}

export function partitionApplications<T extends { id: string }>(rows: T[]) {
  return {
    live: rows.filter(row => !confirmedTestReason(row.id)),
    tests: rows.filter(row => confirmedTestReason(row.id)),
  };
}
