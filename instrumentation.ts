import * as Sentry from "@sentry/nextjs";

// Next.js's instrumentation hook — runs once when the server starts, in
// both the Node.js runtime (API routes, server components) and the Edge
// runtime (middleware, if any gets added later). This is what actually
// turns on Sentry for everything that isn't the browser; see
// instrumentation-client.ts for that half.
//
// Required alongside `experimental.instrumentationHook: true` in
// next.config.js on Next.js 14 (this becomes on-by-default in 15+).
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

// Reports an error thrown while handling a server request (an API route,
// a server component render) that Next.js would otherwise only log to
// the console — this is what actually gets Stripe webhook failures,
// crawl errors, etc. into Sentry rather than just Vercel's logs. Must be
// named exactly `onRequestError` — that's the hook name Next.js itself
// looks for in this file, not a Sentry-specific convention.
export const onRequestError = Sentry.captureRequestError;
