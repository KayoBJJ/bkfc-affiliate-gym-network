export async function runNonCriticalNotification(notify: () => Promise<unknown>) {
  try {
    await notify();
    return "sent" as const;
  } catch {
    return "failed" as const;
  }
}
