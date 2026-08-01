/**
 * Next.js server instrumentation — optional Sentry error monitoring.
 *
 * register() runs once when the server process boots. Activates only when
 * SENTRY_DSN is set AND '@sentry/nextjs' is installed; otherwise it's a no-op,
 * so the app builds and runs without the dependency. onRequestError forwards
 * server-side render/route errors to Sentry when enabled.
 *
 * Setup: `npm install @sentry/nextjs` and set SENTRY_DSN in the web environment.
 */

let sentry: any = null;

export async function register(): Promise<void> {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;
  try {
    // Indirected specifier: keeps TypeScript/Next from statically resolving (and
    // requiring at build time) a package that may not be installed yet.
    const mod = '@sentry/nextjs';
    sentry = await import(/* webpackIgnore: true */ mod);
    sentry.init({
      dsn,
      environment: process.env.NODE_ENV || 'development',
      tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0),
      release: process.env.SENTRY_RELEASE,
    });
  } catch {
    sentry = null;
  }
}

export async function onRequestError(
  err: unknown,
  request: unknown,
  context: unknown
): Promise<void> {
  if (!sentry) return;
  try {
    if (typeof sentry.captureRequestError === 'function') {
      sentry.captureRequestError(err, request, context);
    } else {
      sentry.captureException(err);
    }
  } catch {
    /* never let monitoring throw */
  }
}
