"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "./AuthProvider";
import { getBusinessProfile } from "./businessProfile";

/**
 * The soft gate for every page inside the signed-in app (dashboard,
 * builder, winning-copy, buyer-insights). Mirrors how mailcheap.ai does
 * it: sign up -> onboarding -> the dashboard itself is visible with no
 * subscription at all. Payment is only enforced at the moment copy
 * would actually get generated (see builder/page.tsx's
 * generateCampaign() and lib/ai/agentActions.ts's executeCreateCampaign)
 * — never here.
 *
 * Not signed in -> /auth.
 * Signed in but never finished onboarding (no businessProfile saved
 * yet) -> /onboarding.
 * Otherwise -> ready.
 *
 * Call this once, unconditionally, near the top of a protected page's
 * component (same rules as any other hook — don't call it after an
 * early return). Render a loading shell instead of the real page while
 * `ready` is false, so the page never flashes before a redirect.
 */
export function useRequireAccess(): { ready: boolean } {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      router.replace("/auth");
      return;
    }

    let cancelled = false;
    getBusinessProfile(user.uid).then((profile) => {
      if (cancelled) return;
      if (!profile) {
        router.replace("/onboarding");
      } else {
        setReady(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [authLoading, user, router]);

  return { ready };
}
