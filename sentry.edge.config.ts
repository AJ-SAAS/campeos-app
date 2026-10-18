import * as Sentry from "@sentry/nextjs";

// Edge-runtime Sentry setup — loaded from instrumentation.ts. Campeos
// doesn't currently have any middleware.ts or edge API routes, but
// Next.js's instrumentation hook always offers this branch, and it costs
// nothing to have ready for if/when one gets added. Same minimal,
// error-capture-only config as sentry.server.config.ts.
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0,
});
