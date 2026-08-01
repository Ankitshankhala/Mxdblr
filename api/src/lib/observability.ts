/**
 * Error monitoring (Sentry) — optional and fail-safe.
 *
 * Activates only when SENTRY_DSN is set AND the '@sentry/node' package is
 * installed. Uses a guarded dynamic require so the app compiles and runs even
 * when the package is absent (e.g. before `npm install` on a fresh checkout) —
 * in that case every function here is a no-op. This keeps observability opt-in
 * per environment without making the dependency load-bearing for boot.
 *
 * Setup: `npm install @sentry/node` and set SENTRY_DSN in the API environment.
 */

let sentry: any = null;

export function initObservability(): void {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    sentry = require('@sentry/node');
    sentry.init({
      dsn,
      environment: process.env.NODE_ENV || 'development',
      tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0),
      release: process.env.SENTRY_RELEASE,
    });
    process.stdout.write('[mxdblr-api] Sentry error monitoring enabled\n');
  } catch {
    sentry = null;
    process.stderr.write(
      '[mxdblr-api] SENTRY_DSN set but @sentry/node not installed — monitoring disabled\n'
    );
  }
}

/** Report an error to Sentry when enabled; safe no-op otherwise. */
export function captureError(err: unknown): void {
  if (!sentry) return;
  try {
    sentry.captureException(err);
  } catch {
    /* never let monitoring throw into the request path */
  }
}
