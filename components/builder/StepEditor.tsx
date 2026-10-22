"use client";

import { missingDetailsLabel, needsInput as sharedNeedsInput } from "@/lib/dashboard";
import { useEffect, useRef, useState } from "react";
import { UIStep } from "./Timeline";
import { ImageSlot } from "./ImageSlot";
import { imageSlots, shapesFor, StepImage } from "@/lib/images";
import { fillPlaceholders, FillChange, scanPlaceholders } from "@/lib/insights/logic";
import { ProofItem } from "@/lib/insights/types";

interface StepEditorProps {
  step: UIStep | undefined;
  stepNumber: number;
  totalSteps: number;
  onRequestVariation: (instruction: string) => void;
  variationPending: boolean;
  isOpen: boolean;
  onClose: () => void;
  // Fired on every keystroke in a field. The parent owns the actual
  // value (step.copy flows back down as a prop) and is responsible for
  // persisting it — debounced while typing, flushed the moment this
  // panel closes — so this component stays a plain controlled view with
  // no save logic or local copy of its own to drift out of sync.
  onFieldChange: (fieldKey: string, value: string) => void;
  // Optional autosave indicator, shown next to "Step X of Y" — mirrors
  // the quiet "Saving.../Saved" Docs shows, so it's clear edits here
  // aren't sitting unsaved in a modal waiting for a Save button.
  saveStatus?: "idle" | "saving" | "saved";
  /** True for a campaign that hasn't been written yet: there's nothing
   * saved to Firestore until it is, so the badge says so. */
  draft?: boolean;
  /** Saved campaign id (null until the campaign is written). Pictures
   * can only be added once there's somewhere to save them. */
  campaignId?: string | null;
  /** Social platforms picked in onboarding, for the best picture size. */
  userPlatforms?: string[];
  /** This step's saved pictures, by slot. */
  images?: Record<string, StepImage>;
  onImageChange?: (slot: string, image: StepImage | null) => void;
  /** Real testimonials from Buyer insights, for "Fill from your proof". */
  proof?: ProofItem[];
  proofResults?: string[];
}

const LANE_STYLE: Record<string, { label: string; fg: string; bg: string }> = {
  ad: { label: "Facebook ad", fg: "#1B6B4F", bg: "#DFF0E8" },
  email: { label: "Email", fg: "#1F5FA6", bg: "#E4EDF8" },
  sms: { label: "Text message", fg: "#6B4FA3", bg: "#ECE7F5" },
  store: { label: "App Store", fg: "#1F5FA6", bg: "#E4EDF8" },
  video: { label: "Video", fg: "#B4342A", bg: "#F8E4E1" },
  social: { label: "Social post", fg: "#1B6B4F", bg: "#DFF0E8" },
};

// A near-fullscreen pop-open panel for the selected step — replaces the
// old fixed 360px sidebar. That sidebar meant the copy itself (the
// actual product) lived in a cramped column next to a wall of metadata.
// This keeps all the same information — send time, why the step exists,
// the fields, the "Ask Campeos" bar — but gives the copy the whole
// centered column, and tucks "why this step" behind a one-line dropdown
// (closed by default) instead of an always-open callout box. Approved
// as a Design-canvas mockup before building: see that artifact's
// "Closed (default)" and "Expanded" artboards for the reference.
export function StepEditor({
  step,
  stepNumber,
  totalSteps,
  onRequestVariation,
  variationPending,
  isOpen,
  onClose,
  onFieldChange,
  saveStatus = "idle",
  draft = false,
  campaignId = null,
  userPlatforms = [],
  images = {},
  onImageChange,
  proof = [],
  proofResults = [],
}: StepEditorProps) {
  const [instruction, setInstruction] = useState("");
  const [whyOpen, setWhyOpen] = useState(false);

  // Reset per-step UI state (the dropdown, the draft instruction) each
  // time a different step opens, rather than carrying over whatever was
  // left expanded/typed on the previous one.
  useEffect(() => {
    setWhyOpen(false);
    setInstruction("");
  }, [step?.templateStepId]);

  useEffect(() => {
    if (!isOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen, onClose]);

  if (!isOpen || !step) return null;

  const lane = LANE_STYLE[step.channel] ?? LANE_STYLE.ad;
  const needs = needsInput(step);
  const shapes = shapesFor(step.channel, userPlatforms);
  const slots = imageSlots(step.channel, step.copy);
  // Pictures whose [IMAGE] line was deleted from the email still show,
  // so they can be removed instead of sitting in storage unseen.
  const orphanSlots = Object.keys(images).filter((id) => !slots.some((s) => s.id === id));
  const isEmail = step.channel === "email";
  const hasBody = step.fields.some((f) => f.key === "body");

  function addPictureSpot() {
    const body = step?.copy?.body ?? "";
    onFieldChange("body", `${body.replace(/\s+$/, "")}\n\n[IMAGE: describe the picture]\n`);
  }

  const slotEl = (id: string, label: string) => (
    <ImageSlot
      key={id}
      campaignId={campaignId}
      stepId={step.templateStepId}
      slot={id}
      label={label}
      shapes={shapes}
      image={images[id]}
      onChange={(img) => onImageChange?.(id, img)}
    />
  );

  function send() {
    if (!instruction.trim()) return;
    onRequestVariation(instruction.trim());
    setInstruction("");
  }

  return (
    <div
      aria-modal="true"
      role="dialog"
      aria-label={step.title}
      className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-6 lg:p-8"
    >
      <button
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-[#0F0C14]/55 backdrop-blur-sm cursor-default"
      />

      <div className="relative w-full h-full sm:h-auto sm:max-h-full max-w-[1400px] bg-paper rounded-none sm:rounded-[28px] shadow-2xl flex flex-col overflow-hidden">
        {/* panel header */}
        <div className="shrink-0 flex items-center justify-between px-5 sm:px-10 py-4 sm:py-6 border-b border-line/60">
          <div className="flex items-center gap-2.5">
            <span
              className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold"
              style={{ background: lane.bg, color: lane.fg }}
            >
              {lane.label}
            </span>
            <span className="font-mono text-xs text-muted">
              Step {stepNumber} of {totalSteps}
            </span>
          </div>
          <div className="flex items-center gap-3">
            {/* Always visible, so after any edit you can see it's kept:
                "Saving..." while typing, then "Saved" with a tick. */}
            <span role="status" aria-live="polite" className="inline-flex items-center gap-2 text-[15px] sm:text-base font-semibold">
              {draft ? (
                <span className="text-muted text-[14px]">Saves when you write the campaign</span>
              ) : saveStatus === "saving" ? (
                <>
                  <svg className="animate-spin text-[#15803D]" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true">
                    <path d="M21 12a9 9 0 1 1-6.2-8.6" />
                  </svg>
                  <span className="text-[#15803D]">Saving...</span>
                </>
              ) : (
                <span key={saveStatus} className={`inline-flex items-center gap-2 text-[#15803D] ${saveStatus === "saved" ? "animate-step-in" : ""}`}>
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M5 12l5 5 9-10" />
                  </svg>
                  Saved
                </span>
              )}
            </span>
            <button
              aria-label="Close"
              onClick={onClose}
              className="w-9 h-9 rounded-[10px] bg-ivory flex items-center justify-center text-muted"
            >
              <CloseIcon />
            </button>
          </div>
        </div>

        {/* centered content column */}
        <div className="flex-grow min-h-0 overflow-y-auto flex justify-center px-5 sm:px-10 pt-9 sm:pt-12">
          <div className="w-full max-w-[680px] flex flex-col items-center text-center gap-9 sm:gap-10 pb-12">
            <div className="flex flex-col items-center gap-3.5">
              <h1 className="font-display text-[28px] sm:text-[34px] font-bold leading-[1.15] tracking-tight">
                {step.title}
              </h1>
              <span className="inline-flex items-center gap-1.5 text-[13px] text-muted">
                <ClockIcon />
                Suggested send time:{" "}
                {step.scheduledAt.toLocaleString(undefined, {
                  weekday: "short",
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </span>
            </div>

            {(step.phaseName || step.purpose || step.goals.length > 0) && (
              <div className="w-full max-w-[560px] flex flex-col">
                <button
                  onClick={() => setWhyOpen((v) => !v)}
                  aria-expanded={whyOpen}
                  className="self-center inline-flex items-center gap-2 rounded-full px-4 py-2"
                >
                  <ChevronIcon open={whyOpen} />
                  <span className="text-[13px] font-semibold text-muted">Why this step</span>
                  {!whyOpen && (
                    <span className="text-xs text-faint">
                      · {step.phaseName ? `${step.phaseName} phase` : ""}
                      {step.phaseName && step.angle ? " · " : ""}
                      {step.angle}
                    </span>
                  )}
                </button>

                {whyOpen && (
                  <div className="mt-4 pt-5 border-t border-line/60 flex flex-col items-center gap-4 text-left">
                    {step.phaseObjective && (
                      <p className="text-center max-w-[480px] text-sm leading-relaxed text-muted">
                        {step.phaseObjective}
                      </p>
                    )}
                    {step.purpose && (
                      <p className="text-[15px] leading-relaxed text-slate">{step.purpose}</p>
                    )}
                    {step.goals.length > 0 && (
                      <ul className="w-full flex flex-col gap-2">
                        {step.goals.map((g, i) => (
                          <li key={i} className="flex gap-2.5 text-[13.5px] leading-relaxed text-muted">
                            <span className="shrink-0 text-[#C9A9F5]">&bull;</span>
                            <span>{g}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                    {step.persuasionElements.length > 0 && (
                      <div className="flex flex-wrap items-center justify-center gap-2 pt-0.5">
                        {step.persuasionElements.map((el, i) => (
                          <span key={i} className="text-[11.5px] font-semibold text-clay">
                            {el}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            <span className="text-xs text-faint">
              Built from: {step.copy?.source ?? "not written yet"}
            </span>

            {needs && (
              <span className="inline-flex px-3 py-1.5 rounded-full bg-warnBg text-warnFg text-[13px] leading-snug">
                {missingDetailsLabel(step.copy)}. Find the parts in [CAPS] below and type over them before you copy this step.
              </span>
            )}

            <FillFromProof
              copy={step.copy}
              proof={proof}
              results={proofResults}
              onApply={(next) => {
                Object.entries(next).forEach(([k, v]) => {
                  if (k !== "source" && v !== step.copy?.[k]) onFieldChange(k, v);
                });
              }}
            />

            <div className="w-full flex flex-col gap-7 text-left">
              {step.fields.map((field) => {
                const value = step.copy?.[field.key] ?? "";
                return (
                  <div key={field.key} className="flex flex-col gap-1.5">
                    <span className="font-mono text-[10.5px] uppercase tracking-wider text-faint">
                      {field.label}
                    </span>
                    {field.kind === "short" ? (
                      <input
                        type="text"
                        value={value}
                        onChange={(e) => onFieldChange(field.key, e.target.value)}
                        placeholder="Not written yet"
                        // Inline style, not a Tailwind class: the site-wide
                        // `:focus-visible` rule in globals.css sets its own
                        // outline at the same CSS specificity as a
                        // `focus:outline-none` utility and comes later in
                        // the stylesheet, so it would otherwise win. These
                        // fields read as plain text either way (the caret
                        // is cue enough), so they opt out of that outline
                        // on purpose rather than failing to apply it.
                        style={{ outline: "none" }}
                        className="w-full -mx-2 rounded-md border-none bg-transparent px-2 py-1 text-[17px] font-semibold text-slate placeholder:font-normal placeholder:text-faint"
                      />
                    ) : (
                      <AutoGrowTextarea
                        value={value}
                        onChange={(v) => onFieldChange(field.key, v)}
                        placeholder="Not written yet"
                        className="w-full -mx-2 resize-none rounded-md border-none bg-transparent px-2 py-1 text-[16px] leading-[1.7] text-slate placeholder:text-faint"
                      />
                    )}
                    {field.key === "visual" && !isEmail && slots[0] && <div className="mt-2">{slotEl(slots[0].id, "")}</div>}
                  </div>
                );
              })}

              {/* Ads saved before they had an image idea field still get a picture */}
              {!isEmail && slots[0] && !step.fields.some((f) => f.key === "visual") && (
                <div className="flex flex-col gap-1.5">
                  <span className="font-mono text-[10.5px] uppercase tracking-wider text-faint">Image</span>
                  {slotEl(slots[0].id, "")}
                </div>
              )}

              {isEmail && hasBody && (
                <div className="flex flex-col gap-2.5 pt-2 border-t border-line/60">
                  <span className="font-mono text-[10.5px] uppercase tracking-wider text-faint pt-5">Pictures in this email</span>
                  {slots.length === 0 && orphanSlots.length === 0 && (
                    <p className="text-[14px] text-muted leading-relaxed">
                      No pictures yet. Add a spot, then move its [IMAGE: ...] line to where the picture should go.
                    </p>
                  )}
                  {slots.map((sl, i) => slotEl(sl.id, sl.label || `Picture ${i + 1}`))}
                  {orphanSlots.map((id) => slotEl(id, "This picture's [IMAGE] line was deleted"))}
                  <button
                    onClick={addPictureSpot}
                    className="self-start inline-flex items-center gap-1.5 h-9 px-3.5 rounded-[10px] border border-[#E3E1E8] bg-white text-[13px] font-semibold"
                  >
                    <span aria-hidden="true" className="text-[16px] leading-none">+</span> Add a picture spot
                  </button>
                  <p className="text-[12px] text-faint leading-snug">
                    When you paste this email into your email tool, put each picture where its [IMAGE] line is.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Ask Campeos bar — pinned to the bottom of the panel, not the page */}
        <div className="shrink-0 flex justify-center px-5 sm:px-10 py-4 sm:py-5 border-t border-line/60 bg-paper">
          <div className="w-full max-w-[680px] flex flex-col gap-2.5">
            <div className="flex flex-wrap gap-1.5">
              <SuggestionChip onClick={() => onRequestVariation("Match my winning headline")}>
                Match my winning headline
              </SuggestionChip>
              <SuggestionChip onClick={() => onRequestVariation("Make it shorter")}>
                Make it shorter
              </SuggestionChip>
            </div>
            <div className="flex items-center gap-2 min-h-12 pl-4 pr-1.5 py-1.5 border border-line rounded-2xl bg-ivory/60">
              <input
                type="text"
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && send()}
                placeholder="Tell Campeos what to write or change..."
                disabled={variationPending}
                className="flex-grow min-w-0 border-none outline-none text-[14px] bg-transparent"
              />
              <button
                aria-label="Send"
                onClick={send}
                disabled={variationPending}
                className="shrink-0 w-9 h-9 rounded-[11px] bg-gradient-to-br from-clay to-pink text-white flex items-center justify-center disabled:opacity-50"
              >
                <SendIcon />
              </button>
            </div>
            <div className="text-[11px] leading-snug text-faint text-center">
              It already knows this offer, your winning copy, and why this step exists. No need to explain.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// A plain <textarea> clips to a fixed box and forces its own scrollbar;
// the old read-only <div> just grew with the text. This keeps that
// same "grows with what you write" feel by measuring scrollHeight and
// setting the element's own height to match, on every value change —
// including the first render, so a long saved paragraph isn't clipped
// before the user ever touches it.
function AutoGrowTextarea({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  return (
    <textarea
      ref={ref}
      rows={1}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      style={{ outline: "none" }}
      className={className}
    />
  );
}

function SuggestionChip({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="min-h-8 px-2.5 rounded-full border border-line bg-paper text-muted text-xs font-medium"
    >
      {children}
    </button>
  );
}

function needsInput(step: UIStep): boolean {
  return sharedNeedsInput(step.copy);
}

function ClockIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8A9089" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
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
function CloseIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  );
}
function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#8A9089"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={`transition-transform duration-200 ${open ? "" : "-rotate-90"}`}
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}


// Blanks like [TESTIMONIAL] or [RESULT] can be filled with the user's real
// proof from Buyer insights. Shows exactly what will change first, and
// nothing is invented: with no proof saved, it says where to add some.
function FillFromProof({
  copy,
  proof,
  results,
  onApply,
}: {
  copy: Record<string, string> | undefined;
  proof: ProofItem[];
  results: string[];
  onApply: (next: Record<string, string>) => void;
}) {
  const [preview, setPreview] = useState<{ copy: Record<string, string>; changes: FillChange[] } | null>(null);
  const [none, setNone] = useState(false);
  const c = scanPlaceholders(copy);
  const fillable = c.testimonial + c.customerName + c.result;
  if (!copy || fillable === 0) return null;

  if (proof.length === 0 && results.length === 0) {
    return (
      <span className="text-[13px] text-muted leading-snug">
        The blanks here ([TESTIMONIAL], [RESULT]) can be filled with real proof.{" "}
        <a href="/buyer-insights" className="underline font-semibold">
          Add a testimonial
        </a>
        .
      </span>
    );
  }

  function run() {
    const r = fillPlaceholders(copy!, proof, { results });
    if (r.changes.length === 0) {
      setNone(true);
      return;
    }
    setNone(false);
    setPreview({ copy: r.copy, changes: r.changes });
  }

  return (
    <div className="w-full flex flex-col gap-2.5 text-left">
      {!preview && (
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={run}
            className="inline-flex items-center h-9 px-4 rounded-full bg-slate text-white text-[13px] font-semibold"
          >
            Fill from your proof
          </button>
          <span className="text-[12.5px] text-muted">
            {fillable} blank{fillable === 1 ? "" : "s"} real proof can fill
          </span>
          {none && <span className="text-[12.5px] text-muted">Nothing to fill with yet. Add more on the Buyer insights page.</span>}
        </div>
      )}
      {preview && (
        <div className="flex flex-col gap-2.5 p-3.5 border border-line rounded-xl bg-ivory/60">
          <span className="text-[13px] font-semibold">Here is what will change</span>
          {preview.changes.map((ch, i) => (
            <div key={i} className="flex flex-col gap-1 text-[13px] leading-snug">
              <span className="text-faint line-through">{ch.before}</span>
              <span className="text-slate">{ch.after}</span>
            </div>
          ))}
          <div className="flex items-center gap-3 pt-1">
            <button
              onClick={() => {
                onApply(preview.copy);
                setPreview(null);
              }}
              className="inline-flex items-center h-9 px-4 rounded-full bg-slate text-white text-[13px] font-semibold"
            >
              Use these
            </button>
            <button onClick={() => setPreview(null)} className="text-[13px] text-muted font-medium">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
