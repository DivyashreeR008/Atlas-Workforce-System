import { computeRetryDelay, isRetryableError } from "@/lib/api-errors";

/**
 * Central React Query retry policy for reads.
 *
 * A failed query is retried only when the failure is transient (no response,
 * timeout, 429 or 5xx) and only up to QUERY_RETRY_MAX_ATTEMPTS extra attempts.
 * Deterministic 4xx answers fail fast, so a permission error or a malformed
 * request never turns into repeated identical requests.
 *
 * The delay mirrors the API client's full-jitter exponential backoff so a
 * dashboard with many failing widgets does not retry in lockstep.
 */
export const QUERY_RETRY_MAX_ATTEMPTS = 2;

export function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  if (failureCount >= QUERY_RETRY_MAX_ATTEMPTS) return false;
  return isRetryableError(error);
}

export function queryRetryDelay(attemptIndex: number): number {
  return computeRetryDelay(attemptIndex);
}
