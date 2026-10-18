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
