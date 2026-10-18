"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

// The App Router's required top-level error boundary — the only one
// that can catch an error thrown while rendering app/layout.tsx itself.
// Without this file, a render error there would just show Next.js's
// default blank error screen with nothing reported to Sentry.
// Everything else (a single page or component throwing) is already
// covered by instrumentation.ts's onRequestError on the server and by
// Sentry's automatic client-side error listener in the browser — this
// file exists for that one top-of-tree gap.
export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html>
      <body style={{ fontFamily: "sans-serif", padding: "48px 24px", textAlign: "center" }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Something went wrong</h1>
        <p style={{ color: "#5B6560", fontSize: 14 }}>
          We&apos;ve been notified. Try reloading the page.
        </p>
      </body>
    </html>
  );
}
