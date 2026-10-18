import { redactSensitiveString } from "@/lib/api-errors";

/**
 * Client-side error reporting entry point.
 *
 * Errors are forwarded to the browser console, the app's existing logging
 * path, with the same conservative redaction that API validation logs use:
 * error messages can embed tokens or payload fragments, so they are scrubbed
 * before anything is written. No user identifiers or request bodies are added
 * here.
 */
export interface ClientErrorContext {
  /** Which boundary or subsystem observed the error, e.g. "widget:charts". */
  boundary: string;
  /** Route pathname when known. */
  route?: string;
}

const MAX_MESSAGE_LENGTH = 300;

export function reportClientError(error: unknown, context: ClientErrorContext): void {
  const raw =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "unknown error";
  const safe = redactSensitiveString(raw).slice(0, MAX_MESSAGE_LENGTH);
  const route = context.route ? ` route=${context.route}` : "";
  console.error(`[client-error] boundary=${context.boundary}${route}: ${safe}`);
}
