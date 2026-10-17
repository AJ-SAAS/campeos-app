"use client";

import { useEffect, useState } from "react";
import { useAuth } from "./AuthProvider";
import { getSubscription, isActive, Subscription } from "./subscription";

/**
 * Live-ish subscription status for the signed-in user — used wherever
 * the UI needs to know "has this person actually paid" without
 * blocking the page on it (see lib/firebase/useRequireAccess.ts for the
 * page-level gate, which deliberately does NOT check this). Used by
 * the Sidebar's plan status and the dashboard/builder nag banner.
 */
export function useSubscription(): { sub: Subscription | null; loading: boolean; active: boolean } {
  const { user } = useAuth();
  const [sub, setSub] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setSub(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    getSubscription(user.uid).then((s) => {
      if (cancelled) return;
      setSub(s);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [user]);

  return { sub, loading, active: sub ? isActive(sub) : false };
}
