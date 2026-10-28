"use client";

import { useEffect, useRef, useState } from "react";
import { AgentPanel, AgentPanelCampaignContext } from "./AgentPanel";
import { Mascot } from "@/components/mascot/Mascot";
import type { OrbMood } from "@/lib/mascot/orb";
import { AGENT_NAME } from "@/lib/brand";
import { AUTO_OPEN_KEY, shouldAutoOpen } from "@/lib/agentPages";

interface AgentLauncherProps {
  /** Present when the agent should be able to edit the campaign
   * currently open in the builder, not just build new ones. */
  campaign?: AgentPanelCampaignContext;
  /** Start open on screens wide enough to leave the page usable beside it.
   * On a phone the chat is a full-screen sheet, so it starts closed. */
  openOnDesktop?: boolean;
  /** Who is signed in. The "already opened once" note is kept per person. */
  userId?: string;
}

// A floating entry point to the agent for pages that aren't the
// dashboard — right now, the Campaign Builder. Same chat (same thread,
// same Firestore history) as the dashboard's AgentPanel. When `campaign`
// is passed, the agent also gets the edit_step tool, scoped to the steps
// in that campaign — see lib/ai/agent.ts and components/agent/AgentPanel.tsx.
export function AgentLauncher({ campaign, openOnDesktop = false, userId }: AgentLauncherProps) {
  const [open, setOpen] = useState(false);
  // What the agent is doing right now, reported by the panel (thinking
  // while it writes, happy when it's done). Shown on the mascot button.
  const [agentMood, setAgentMood] = useState<OrbMood>("idle");
  // Goes up on every open/close so the mascot hops.
  const [hop, setHop] = useState(0);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Opens by itself only the first time, so it isn't in your face on every
  // visit. After that it stays closed until you open it.
  useEffect(() => {
    if (!openOnDesktop || !userId) return;
    if (!window.matchMedia?.("(min-width: 640px)").matches) return;
    const key = `${AUTO_OPEN_KEY}:${userId}`;
    let seen: string | null = null;
    let canRemember = true;
    try {
      seen = localStorage.getItem(key);
    } catch {
      canRemember = false;
    }
    if (!shouldAutoOpen(seen, canRemember)) return;
    try {
      localStorage.setItem(key, "1");
    } catch {
      return;
    }
    setOpen(true);
  }, [openOnDesktop, userId]);

  // Three ways to dismiss: the FAB itself (toggle), clicking outside the
  // panel, and Escape. A popover with only one way to close is a popover
  // people get stuck in.
  useEffect(() => {
    if (!open) return;

    function handlePointerDown(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div ref={wrapperRef}>
      {/* The mascot IS the button. No circle behind it: a soft purple glow
          under it instead (a CSS shadow, because the glow the orb draws
          for itself would be cut off at the edge of a small canvas). */}
      <button
        onClick={() => {
          setOpen((o) => !o);
          setHop((h) => h + 1);
        }}
        aria-label={open ? `Close ${AGENT_NAME}` : `Ask ${AGENT_NAME}`}
        aria-expanded={open}
        className="fixed bottom-20 right-3 sm:bottom-5 sm:right-5 z-40 w-[96px] h-[96px] rounded-full flex items-center justify-center transition-transform duration-150 hover:scale-105 active:scale-95"
        style={{ filter: "drop-shadow(0 10px 16px rgba(124,58,237,0.45))" }}
      >
        {/* One live Eos at a time: this button while the chat is closed,
            the chat's header while it is open (then this is a close button). */}
        {open ? (
          <span className="w-[52px] h-[52px] rounded-full bg-slate text-white flex items-center justify-center" style={{ filter: "none" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </span>
        ) : (
          <>
            <Mascot
              size={124}
              fit={1.0}
              centered
              bubble={false}
              style={{ margin: -14 }}
              glow={false}
              restless={false}
              ring={agentMood === "thinking"}
              mood={agentMood}
              hopKey={hop}
              label={`${AGENT_NAME}`}
            />
            {agentMood === "thinking" && (
              <span
                className="absolute -top-1 right-1 flex items-center gap-1 rounded-full bg-white px-2.5 py-2 shadow-[0_4px_12px_rgba(19,23,26,0.18)]"
                aria-hidden="true"
              >
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="w-1.5 h-1.5 rounded-full bg-[#9B7BE8] motion-safe:animate-bounce"
                    style={{ animationDelay: `${i * 0.15}s`, animationDuration: "0.9s" }}
                  />
                ))}
              </span>
            )}
          </>
        )}
      </button>

      {/* Mobile: a near-full-screen sheet, since a fixed 380px popover
          overflows a phone viewport entirely. Desktop keeps the original
          anchored popover. */}
      <div
        role="dialog"
        aria-label={AGENT_NAME}
        aria-hidden={!open}
        className={`fixed z-40 rounded-2xl shadow-[0_24px_64px_-12px_rgba(19,23,26,0.3)] transition-all duration-200
          inset-x-3 bottom-[11.5rem] top-16 sm:inset-x-auto sm:top-auto sm:bottom-[7.5rem] sm:right-6 sm:w-[380px] sm:h-[min(70vh,560px)]
          origin-bottom-right ${
          open ? "opacity-100 scale-100" : "opacity-0 scale-95 pointer-events-none"
        }`}
      >
        <div className="relative h-full">
          <AgentPanel campaign={campaign} contained visible={open} onClose={() => setOpen(false)} onMoodChange={setAgentMood} />
        </div>
      </div>
    </div>
  );
}
