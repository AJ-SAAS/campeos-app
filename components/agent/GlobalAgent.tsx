"use client";

import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { AgentLauncher } from "./AgentLauncher";
import { opensAutomatically, showsFloatingAgent } from "@/lib/agentPages";

/** The floating Eos on every signed-in app page (not Settings). Mounted once
 * in the root layout. The Campaign Builder has its own, with the open
 * campaign attached. */
export function GlobalAgent() {
  const { user, needsVerification } = useAuth();
  const pathname = usePathname();
  if (!user || needsVerification || !showsFloatingAgent(pathname)) return null;
  const home = opensAutomatically(pathname);
  // Remounted only when moving to or from Home, so Eos opens on arrival
  // there and starts closed when you leave.
  return <AgentLauncher key={home ? "home" : "other"} openOnDesktop={home} />;
}
