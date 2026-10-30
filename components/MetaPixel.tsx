"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { canTrack, loadPixel, trackPageView } from "@/lib/meta/browser";
import { CONSENT_CHANGED_EVENT } from "@/lib/meta/consent";

// Loads the Meta Pixel (only when consent allows). The script has to be on
// every page so /welcome can send the one Purchase, but PageView is sent
// from the sales page only. Visits inside the signed-in app would just be
// noise. Nothing else is ever sent from here.
const PAGEVIEW_PATHS = new Set(["/"]);
export function MetaPixel() {
  const pathname = usePathname();
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    const sync = () => setAllowed(canTrack());
    sync();
    window.addEventListener(CONSENT_CHANGED_EVENT, sync);
    return () => window.removeEventListener(CONSENT_CHANGED_EVENT, sync);
  }, []);

  useEffect(() => {
    if (!allowed) return;
    loadPixel();
    if (PAGEVIEW_PATHS.has(pathname)) trackPageView();
  }, [allowed, pathname]);

  return null;
}
