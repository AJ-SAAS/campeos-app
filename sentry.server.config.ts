import * as Sentry from "@sentry/nextjs";

// Server-side (Node.js runtime) Sentry setup — loaded from
// instrumentation.ts, not imported directly anywhere else. Covers API
// routes (app/api/*), server components, and anything else running on
// the Node.js runtime.
//
// Deliberately minimal: error capture only. Performance tracing, session
// replay, logging, and profiling are all separate opt-in features we
// chose to leave off for now (see the Sentry onboarding wizard) — each
// one eats its own slice of the free-tier quota and adds moving parts
// we don't need yet for "tell me when something breaks."
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0,
});
