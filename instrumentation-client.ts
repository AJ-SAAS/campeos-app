import * as Sentry from "@sentry/nextjs";

// Browser-side Sentry setup — this is what catches errors thrown in the
// client components (app/page.tsx, app/builder/page.tsx, etc. are all
// "use client"). The DSN is safe to ship to the browser: it's a public
// write-only endpoint for sending error reports, not a secret, the same
// way a Firebase client config is safe to expose (see lib/firebase/client.ts).
//
// Same minimal, error-capture-only config as the server/edge configs —
// no performance tracing, no session replay.
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0,
});

// Required export as of @sentry/nextjs v9+ for the SDK to track
// client-side route changes (App Router navigations) — without it,
// Sentry logs a startup warning. Harmless to include even without
// tracing enabled.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
