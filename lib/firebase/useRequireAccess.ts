"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "./AuthProvider";
import { getBusinessProfile, hasOnboarded } from "./businessProfile";

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
 *
 * Every page under the sidebar nav (dashboard, campaigns, winning-copy,
 * buyer-insights, ...) is its own top-level route with no shared layout
 * wrapping them, so each one calls this hook fresh on every navigation —
 * React fully unmounts the page you're leaving and mounts the next one.
 * Without caching, that meant re-running the Firestore
 * getBusinessProfile() read on every single click between nav tabs,
 * `ready` sitting false (blank white screen) until it resolved, even
 * though the same uid had just been confirmed ready one click earlier.
 * This in-memory, session-lifetime cache remembers a uid once it's
 * verified, so every navigation after the first resolves synchronously —
 * no blank screen, no repeat network round trip. It intentionally
 * doesn't survive a hard reload (module state resets), which is correct:
 * a fresh page load should still confirm onboarding for real.
 */
const verifiedReadyUids = new Set<string>();

export function useRequireAccess(): { ready: boolean } {
  const { user, loading: authLoading, needsVerification } = useAuth();
  const router = useRouter();
  const [ready, setReady] = useState(() => !!user && verifiedReadyUids.has(user.uid));

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      router.replace("/auth");
      return;
    }

    // Email sign-ups must confirm their address first. /auth shows the
    // "check your email" screen for them.
    if (needsVerification) {
      router.replace("/auth");
      return;
    }

    if (verifiedReadyUids.has(user.uid)) {
      setReady(true);
      return;
    }

    let cancelled = false;
    getBusinessProfile(user.uid).then((profile) => {
      if (cancelled) return;
      if (!hasOnboarded(profile)) {
        router.replace("/onboarding");
      } else {
        verifiedReadyUids.add(user.uid);
        setReady(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [authLoading, user, needsVerification, router]);

  return { ready };
}
