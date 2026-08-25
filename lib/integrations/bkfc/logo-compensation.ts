export async function removeUploadedLogo(
  remove: () => PromiseLike<{ error: unknown | null }>,
  emit: (event: { stage: string; code: string; requestId: string }) => void,
  requestId: string,
) {
  try {
    const result = await remove();
    if (result.error) {
      emit({ stage: "submission_cleanup", code: "CLEANUP_FAILED", requestId });
      return false;
    }
    return true;
  } catch {
    emit({ stage: "submission_cleanup", code: "CLEANUP_FAILED", requestId });
    return false;
  }
}
