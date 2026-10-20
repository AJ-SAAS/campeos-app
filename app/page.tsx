"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/firebase/AuthProvider";
import LandingPage from "@/components/landing/LandingPage";

// The marketing/sales page at campeos.com — the first-touch page for
// everyone who isn't signed in yet. The actual page is the hand-built,
// 1:1 drop-in LandingPage component (components/landing/) converted
// directly from the approved "Campeos sales page" Design mockup —
// copied in as-is, not rebuilt here. This file only keeps the
// sign-in gate: a signed-in user who lands on "/" (bookmark, back
// button, etc.) is bounced to /dashboard instead of seeing the pitch
// again.
export default function MarketingPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (authLoading || !user) return;
    router.replace("/dashboard");
  }, [authLoading, user, router]);

  // Signed-in users get an empty shell for the instant it takes the
  // effect above to redirect, rather than a flash of the sales pitch.
  if (authLoading || user) {
    return <div className="min-h-screen bg-paper" />;
  }

  return <LandingPage />;
}
