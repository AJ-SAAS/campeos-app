"use client";

import { useState } from "react";
import { UIStep } from "./Timeline";

interface StepEditorProps {
  step: UIStep | undefined;
  stepNumber: number;
  totalSteps: number;
  onRequestVariation: (instruction: string) => void;
  variationPending: boolean;
}

const LANE_LABEL: Record<string, string> = {
  ad: "Facebook ad",
  email: "Email",
  sms: "Text message",
  social: "Social post",
};

// Right panel of the Campaign Builder: the selected step's copy, why it
// exists, what it was built from, and the persistent "Ask Campeos" bar.
// Keeping the AI input always visible (not behind a button) was explicit
// feedback from Ajay: the AI writing the copy IS the product, so it
// should never be one click away from where you're reading the step.
export function StepEditor({
  step,
  stepNumber,
  totalSteps,
  onRequestVariation,
  variationPending,
}: StepEditorProps) {
  const [instruction, setInstruction] = useState("");

  if (!step) {
    return (
      <aside aria-label="Selected step" className="w-[360px] shrink-0 bg-white border-l border-[#DDD6C5] p-6 flex items-center justify-center text-sm text-faint">
        Pick a step on the timeline.
      </aside>
    );
  }

  const needs = needsInput(step);

  function send() {
    if (!instruction.trim()) return;
    onRequestVariation(instruction.trim());
    setInstruction("");
  }

  return (
    <aside aria-label="Selected step" className="w-[360px] shrink-0 bg-white border-l border-[#DDD6C5] p-6 flex flex-col gap-4 overflow-y-auto">
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#E4EDF8] text-[#1F5FA6]">
          {LANE_LABEL[step.channel] ?? step.channel}
        </span>
        <span className="font-mono text-xs text-muted">
          Step {stepNumber} of {totalSteps}
        </span>
      </div>

      <h2 className="font-display text-[26px] leading-tight font-semibold tracking-tight">
        {step.title}
      </h2>

      <div className="flex flex-col gap-1.5">
        <div className="text-sm font-semibold">Suggested send time</div>
        <div className="flex items-center gap-2.5 min-h-12 px-3 border border-line rounded-[10px]">
          <ClockIcon />
          <span className="font-mono text-[13px] flex-grow">
            {step.scheduledAt.toLocaleString(undefined, {
              weekday: "short",
              hour: "numeric",
              minute: "2-digit",
            })}
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-2 p-3.5 bg-ivory rounded-xl">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[11px] uppercase tracking-wider text-muted">Why this step</span>
          <span className="px-2 py-0.5 rounded-full bg-slate text-ivory text-[11px] font-semibold">
            {step.angle}
          </span>
        </div>
        <div className="text-sm leading-relaxed">{step.purpose}</div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono text-[11px] uppercase tracking-wider text-muted">Built from</span>
          <span className="px-2 py-0.5 rounded-full bg-white border border-[#DDD6C5] text-xs font-semibold">
            {step.copy?.source ?? "Not generated yet"}
          </span>
        </div>
      </div>

      {step.fields.map((field) => (
        <div key={field.key} className="flex flex-col gap-1.5">
          <div className="text-sm font-semibold">{field.label}</div>
          <div
            className={`border border-faint rounded-[10px] text-sm whitespace-pre-line ${
              field.kind === "short" ? "px-3 py-2.5 font-semibold" : "min-h-[190px] px-3.5 py-3.5 leading-relaxed"
            }`}
          >
            {step.copy?.[field.key] ?? "Not written yet"}
          </div>
        </div>
      ))}

      {needs && (
        <div className="px-3 py-2.5 rounded-[10px] bg-[#FCEFC7] text-[#7A4B00] text-[13px] leading-snug">
          Fill in the parts in [CAPS] before you copy this step.
        </div>
      )}

      <div className="flex-grow" />

      <div className="flex flex-col gap-2 pt-3.5 border-t border-line">
        <div className="flex items-center gap-1.5">
          <span className="w-4 h-4 rounded-[5px] bg-clay shrink-0" />
          <span className="text-xs font-semibold text-muted">Ask Campeos to write or change this step</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <SuggestionChip onClick={() => onRequestVariation("Match my winning headline")}>
            Match my winning headline
          </SuggestionChip>
          <SuggestionChip onClick={() => onRequestVariation("Make it shorter")}>
            Make it shorter
          </SuggestionChip>
        </div>
        <div className="flex items-center gap-2 min-h-11 px-1 pl-3.5 border border-faint rounded-xl bg-white">
          <input
            type="text"
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder="Tell Campeos what to write or change..."
            disabled={variationPending}
            className="flex-grow min-w-0 border-none outline-none text-[13px] bg-transparent"
          />
          <button
            aria-label="Send"
            onClick={send}
            disabled={variationPending}
            className="shrink-0 w-8 h-8 rounded-[9px] bg-clay text-white flex items-center justify-center disabled:opacity-50"
          >
            <SendIcon />
          </button>
        </div>
        <div className="text-[11px] leading-snug text-faint">
          It already knows this offer, your winning copy, and why this step exists. No need to explain.
        </div>
      </div>
    </aside>
  );
}

function SuggestionChip({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="min-h-8 px-2.5 rounded-full border border-line bg-white text-[#4F4B42] text-xs font-medium"
    >
      {children}
    </button>
  );
}

function needsInput(step: UIStep): boolean {
  if (!step.copy) return false;
  const text = Object.values(step.copy).join(" ");
  return /\[(?!LINK\])[A-Z0-9 ]+\]/.test(text);
}

function ClockIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#5C584D" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" />
    </svg>
  );
}
function SendIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 19V5M5 12l7-7 7 7" />
    </svg>
  );
}
