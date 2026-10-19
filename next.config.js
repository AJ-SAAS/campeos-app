// withSentryConfig lives under the "/config" subpath in this SDK
// version, not the main "@sentry/nextjs" entry point (that one's
// reserved for the runtime init() calls used in the sentry.*.config.ts
// files and instrumentation-client.ts).
const { withSentryConfig } = require("@sentry/nextjs/config");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Next.js 14 needs this explicitly turned on for instrumentation.ts to
  // run; it's on by default starting in Next.js 15.
  experimental: {
    instrumentationHook: true,
    // The App Router's client-side Router Cache keeps a visited page's
    // RSC payload around for 30s (dynamic routes) by default, and reuses
    // it on the next navigation to that URL instead of fetching fresh.
    // That's what caused the reported bug: visit /builder, then within
    // that window click "Campaigns" in the nav — Next served the stale
    // cached /builder segment instead of /campaigns, and only the
    // *second* click (cache now past its window) showed the real page.
    // Every page here is already a client component reading live
    // Firestore/auth state, so there's no cost to always refetching the
    // shell on navigation — set dynamic staleTime to 0 to disable that
    // cache instead of just narrowing the window.
    staleTimes: {
      dynamic: 0,
    },
  },
};

// Wraps the config so Sentry can inject its build-time plugins (source
// map handling, etc.). Source map upload to Sentry's servers is skipped
// automatically unless a SENTRY_AUTH_TOKEN env var is set — not
// configured yet, so builds work exactly as before, just with Sentry's
// hooks attached. `silent: true` keeps the build log quiet about that.
module.exports = withSentryConfig(nextConfig, {
  org: "campeos",
  project: "campeos-app",
  silent: true,
  widenClientFileUpload: true,
  // We're not using Vercel Cron/edge features that need Sentry's tunnel
  // route, so keep the default off for a smaller build.
  disableLogger: true,
});
