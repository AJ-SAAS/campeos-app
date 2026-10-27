"use client";

import { useEffect, useRef, useState } from "react";
import { AgentPanel, AgentPanelCampaignContext } from "./AgentPanel";
import { Mascot } from "@/components/mascot/Mascot";
import type { OrbMood } from "@/lib/mascot/orb";
import { AGENT_NAME } from "@/lib/brand";

interface AgentLauncherProps {
  /** Present when the agent should be able to edit the campaign
   * currently open in the builder, not just build new ones. */
  campaign?: AgentPanelCampaignContext;
}

// A floating entry point to the agent for pages that aren't the
// dashboard — right now, the Campaign Builder. Same chat (same thread,
// same Firestore history) as the dashboard's AgentPanel. When `campaign`
// is passed, the agent also gets the edit_step tool, scoped to the steps
// in that campaign — see lib/ai/agent.ts and components/agent/AgentPanel.tsx.
export function AgentLauncher({ campaign }: AgentLauncherProps) {
  const [open, setOpen] = useState(false);
  // What the agent is doing right now, reported by the panel (thinking
  // while it writes, happy when it's done). Shown on the mascot button.
  const [agentMood, setAgentMood] = useState<OrbMood>("idle");
  // Goes up on every open/close so the mascot hops.
  const [hop, setHop] = useState(0);
  const wrapperRef = useRef<HTMLDivElement>(null);

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
        className="fixed bottom-20 right-3 sm:bottom-5 sm:right-5 z-40 w-[84px] h-[84px] rounded-full flex items-center justify-center transition-transform duration-150 hover:scale-105 active:scale-95"
        style={{ filter: "drop-shadow(0 10px 16px rgba(124,58,237,0.45))" }}
      >
        <Mascot
          size={84}
          fit={0.64}
          glow={false}
          restless={false}
          mood={open && agentMood === "idle" ? "happy" : agentMood}
          hopKey={hop}
          label={`${AGENT_NAME}`}
        />
      </button>

      {/* Mobile: a near-full-screen sheet, since a fixed 380px popover
          overflows a phone viewport entirely. Desktop keeps the original
          anchored popover. */}
      <div
        role="dialog"
        aria-label={AGENT_NAME}
        aria-hidden={!open}
        className={`fixed z-40 rounded-2xl shadow-[0_24px_64px_-12px_rgba(19,23,26,0.3)] transition-all duration-200
          inset-x-3 bottom-20 top-16 sm:inset-x-auto sm:top-auto sm:bottom-24 sm:right-6 sm:w-[380px] sm:max-h-[min(70vh,560px)]
          origin-bottom-right ${
          open ? "opacity-100 scale-100" : "opacity-0 scale-95 pointer-events-none"
        }`}
      >
        <div className="relative h-full">
          <button
            onClick={() => setOpen(false)}
            aria-label={`Close ${AGENT_NAME}`}
            className="absolute top-3.5 right-4 z-10 w-7 h-7 rounded-full bg-[rgba(255,255,255,0.16)] text-white flex items-center justify-center hover:bg-[rgba(255,255,255,0.26)]"
          >
            <CloseIcon small />
          </button>
          <AgentPanel campaign={campaign} mascot="static" onMoodChange={setAgentMood} />
        </div>
      </div>
    </div>
  );
}

function CloseIcon({ small }: { small?: boolean }) {
  const size = small ? 14 : 20;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}
