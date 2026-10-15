export const RECONNECT_BASE_MS = 1000;
export const RECONNECT_MAX_MS = 30000;

export function getReconnectDelay(attempt: number): number {
  const safeAttempt = Math.max(0, Math.min(Math.floor(attempt), 5));
  return Math.min(RECONNECT_BASE_MS * 2 ** safeAttempt, RECONNECT_MAX_MS);
}
