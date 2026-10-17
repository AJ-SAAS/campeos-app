"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "./AuthProvider";
import { getSubscription, isActive } from "./subscription";

/**
 * The hard-paywall guard for every page inside the signed-in app
 * (dashboard, builder, winning-copy, buyer-insights). "You want
 * access, you pay" is the decision on record — there is no
 * free-to-browse dashboard, so a page behind this is never shown to
 * someone who isn't signed in AND subscribed.
 *
 * Not signed in -> /auth (the sign-in/create-account page).
 * Signed in but no active subscription -> /billing (pick a plan).
 * Signed in and active -> ready.
 *
 * Call this once, unconditionally, near the top of a protected page's
 * component (same rules as any other hook — don't call it after an
 * early return). Render a loading shell instead of the real page
 * while `ready` is false, so the protected content never flashes for
 * someone who's a redirect away from being bounced out of it.
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
    getSubscription(user.uid).then((sub) => {
      if (cancelled) return;
      if (isActive(sub)) {
        setReady(true);
      } else {
        router.replace("/billing");
      }
    });
    return () => {
      cancelled = true;
    };
  }, [authLoading, user, router]);

  return { ready };
}
