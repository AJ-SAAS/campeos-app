"use client";

import { useEffect, useRef, useState } from "react";
import { AgentPanel, AgentPanelCampaignContext } from "./AgentPanel";

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
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Close the agent" : "Ask the agent"}
        aria-expanded={open}
        className="fixed bottom-20 right-4 sm:bottom-6 sm:right-6 z-40 w-14 h-14 rounded-full bg-gradient-to-br from-clay to-pink text-white shadow-[0_10px_28px_-4px_rgba(124,58,237,0.4)] flex items-center justify-center transition-transform duration-150 hover:scale-105 active:scale-95"
      >
        {open ? <CloseIcon /> : <SparkIcon />}
      </button>

      {/* Mobile: a near-full-screen sheet, since a fixed 380px popover
          overflows a phone viewport entirely. Desktop keeps the original
          anchored popover. */}
      <div
        role="dialog"
        aria-label="Agent"
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
            aria-label="Close the agent"
            className="absolute top-3.5 right-4 z-10 w-7 h-7 rounded-full bg-[rgba(255,255,255,0.16)] text-white flex items-center justify-center hover:bg-[rgba(255,255,255,0.26)]"
          >
            <CloseIcon small />
          </button>
          <AgentPanel campaign={campaign} />
        </div>
      </div>
    </div>
  );
}

function SparkIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="#FFFFFF" aria-hidden="true">
      <path d="M12 2l1.8 6.4L20 10l-6.2 1.6L12 18l-1.8-6.4L4 10l6.2-1.6z" />
    </svg>
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
