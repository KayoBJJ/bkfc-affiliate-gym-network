// Keep queue bookkeeping testable without a database or email provider.
export async function deliverReceiptBatch(
  ids: string[],
  deliver: (id: string) => Promise<string>,
  complete: (id: string, outcome: { providerMessageId: string | null; errorCode: string | null }) => Promise<void>,
) {
  let sent = 0;
  let failed = 0;
  for (const id of ids) {
    let providerMessageId: string;
    try {
      providerMessageId = await deliver(id);
    } catch (error) {
      failed++;
      const errorCode = error instanceof Error && /^[A-Z0-9_]{3,80}$/.test(error.message)
        ? error.message : "RECEIPT_DELIVERY_FAILED";
      await complete(id, { providerMessageId: null, errorCode });
      continue;
    }
    // If recording a successful send fails, leave the claim for recovery with
    // the same provider idempotency key; do not mark a sent email as rejected.
    await complete(id, { providerMessageId, errorCode: null });
    sent++;
  }
  return { sent, failed };
}
