/** OpenAI uses 429 for both an exhausted balance and temporary rate limits. */
export function isQuotaError(status: number, body: string) {
  if (status !== 429) return false;
  try {
    const error = JSON.parse(body)?.error;
    return error?.code === "insufficient_quota" || error?.type === "insufficient_quota";
  } catch {
    return false;
  }
}
