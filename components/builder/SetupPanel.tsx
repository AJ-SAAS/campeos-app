"use client";

import { useState } from "react";
import { OfferContext, READING_LEVELS } from "@/lib/ai/prompts";

interface SetupPanelProps {
  offer: OfferContext;
  onOfferChange: (offer: OfferContext) => void;
  winningCopy: string[];
  callThemes: string[];
  onAddWinningCopy: (text: string) => Promise<void>;
  onAddSalesCall: (transcript: string) => Promise<void>;
  onGenerate: () => void;
  generating: boolean;
  /** Shown greyed in "Sign emails as" when the offer has none: the name
   * that will actually be used (account default or first name). */
  signOffPlaceholder?: string;
}

// Left panel of the Campaign Builder — offer fields, "What already
// works" (winning copy) and "Why people buy" (call themes), from
// Builder.dc.html. Both lists are backed by Firestore and scoped to the
// signed-in user — see lib/firebase/library.ts.
//
// Redesigned (Oct 2026) away from the "four identical bordered boxes"
// look: the offer fields are one connected sheet instead of four
// separate cards, reading level is a real 4-way segmented control
// instead of a slider standing in for discrete options, the campaign-
// type banner lost its tracked-uppercase eyebrow, and every
// selected/active state uses the brand violet instead of plain black —
// the same gradient accent-bar device the /campaigns gallery cards use,
// so this panel reads as the same product rather than a generic form.
// The "Generate" button stays the one place with the full two-color
// gradient — every other accent here is the flatter single violet, so
// that button keeps reading as the boldest, most important thing on
// the panel.
export function SetupPanel({
  offer,
  onOfferChange,
  winningCopy,
  callThemes,
  onAddWinningCopy,
  onAddSalesCall,
  onGenerate,
  generating,
  signOffPlaceholder,
}: SetupPanelProps) {
  function set<K extends keyof OfferContext>(key: K, value: OfferContext[K]) {
    onOfferChange({ ...offer, [key]: value });
  }

  return (
    <aside aria-label="Campaign setup" className="w-full lg:w-80 shrink-0 bg-paper p-4 sm:p-5 pb-24 lg:pb-5 flex flex-col gap-5 overflow-y-auto">
      <h2 className="shrink-0 font-display text-lg font-semibold">Campaign setup</h2>

      {/* shrink-0 on every card below: without it, this flex column gets
          squeezed shorter than its content inside the builder's real
          nested layout (a flex-shrink parent a few levels up), and any
          child here that ALSO has overflow-hidden (for the rounded
          corners on the accent bar) has no protected minimum size — so
          it gets crushed to a couple of px while plain siblings refuse
          to shrink and keep their size. Reproduced and confirmed via a
          throwaway render of this exact nesting; shrink-0 is the fix,
          not a smaller fix to the overflow-hidden itself. */}
      <div className="shrink-0 relative rounded-2xl border border-line overflow-hidden">
        <div className="h-[3px] bg-gradient-to-r from-clay to-pink" />
        <div className="p-3.5 flex flex-col gap-1">
          <div className="text-xs font-semibold text-faint">Campaign type</div>
          <div className="font-display text-[15px] font-semibold">Webinar launch</div>
          <div className="text-xs text-muted leading-relaxed">
            Registration through an 11-day backend sequence: emails, texts, ads and social posts.
          </div>
        </div>
      </div>

      <div className="shrink-0 rounded-2xl border border-line divide-y divide-line overflow-hidden">
        <SheetField label="Offer name" value={offer.name} onChange={(v) => set("name", v)} />
        <SheetField label="Price" value={offer.price} onChange={(v) => set("price", v)} />
        <SheetField label="Who it's for" value={offer.audience} onChange={(v) => set("audience", v)} />
        <SheetField label="What they get" value={offer.whatTheyGet} onChange={(v) => set("whatTheyGet", v)} />
        <SheetField
          label="Sign emails as"
          value={offer.fromName ?? ""}
          placeholder={signOffPlaceholder}
          onChange={(v) => set("fromName", v)}
        />
      </div>

      <div className="shrink-0">
        <SegmentedField
          label="Reading level"
          helper="How simple or sophisticated the actual sentences should read. Applies to every step."
          options={READING_LEVELS as unknown as string[]}
          value={offer.readingLevel ?? "5th grade"}
          onChange={(v) => set("readingLevel", v)}
        />
      </div>

      <div className="shrink-0">
        <WinningCopyCard winningCopy={winningCopy} onAdd={onAddWinningCopy} />
      </div>
      <div className="shrink-0">
        <SalesCallCard callThemes={callThemes} onAdd={onAddSalesCall} />
      </div>

      <div className="shrink-0">
        <SegmentedField
          label="Tone"
          options={["Friendly", "Bold", "Calm"]}
          value={offer.tone}
          onChange={(v) => set("tone", v)}
        />
      </div>

      <div className="flex-grow" />

      <button
        onClick={onGenerate}
        disabled={generating}
        className="shrink-0 flex items-center justify-center gap-2 min-h-12 rounded-xl bg-gradient-to-r from-clay to-pink text-white text-sm font-semibold shadow-[0_8px_20px_-6px_rgba(124,58,237,0.5)] disabled:opacity-50"
      >
        {generating && <Spinner />}
        {generating ? "Writing your campaign..." : "Generate campaign copy"}
      </button>
    </aside>
  );
}

function WinningCopyCard({
  winningCopy,
  onAdd,
}: {
  winningCopy: string[];
  onAdd: (text: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!value.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await onAdd(value.trim());
      setValue("");
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save that.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-2.5 p-3.5 rounded-2xl border border-line">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold">What already works</div>
        <span className="font-mono text-xs text-faint">{winningCopy.length} winners</span>
      </div>

      {winningCopy.length > 0 && (
        <div className="flex flex-col gap-2">
          {winningCopy.map((line, i) => (
            <div key={i} className="text-[13px] font-semibold leading-snug">
              {line}
            </div>
          ))}
        </div>
      )}

      {open ? (
        <div className="flex flex-col gap-2">
          <textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Paste a headline or subject line that already converted..."
            rows={3}
            autoFocus
            className="border border-line rounded-[10px] px-3 py-2 text-sm bg-paper resize-none focus:border-clay focus:ring-2 focus:ring-clay/15 outline-none"
          />
          {error && <div className="text-xs text-dangerFg">{error}</div>}
          <div className="flex gap-2">
            <button
              onClick={save}
              disabled={saving || !value.trim()}
              className="flex-grow min-h-9 rounded-[10px] bg-clay text-white text-sm font-semibold disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save"}
            </button>
            <button
              onClick={() => {
                setOpen(false);
                setValue("");
                setError(null);
              }}
              className="min-h-9 px-3 rounded-[10px] text-muted text-sm font-semibold"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className="self-start inline-flex items-center gap-1.5 text-[13px] font-semibold text-clay"
        >
          <PlusIcon /> {winningCopy.length === 0 ? "Add winning copy" : "Add another"}
        </button>
      )}
    </div>
  );
}

function SalesCallCard({
  callThemes,
  onAdd,
}: {
  callThemes: string[];
  onAdd: (transcript: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!value.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await onAdd(value.trim());
      setValue("");
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't analyze that call.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-2.5 p-3.5 rounded-2xl border border-line">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold">Why people buy</div>
        <span className="font-mono text-xs text-faint">{callThemes.length} themes</span>
      </div>

      {callThemes.length > 0 && (
        <div className="flex flex-col gap-2">
          {callThemes.map((theme, i) => (
            <div key={i} className="text-[13px] font-semibold">
              {theme}
            </div>
          ))}
        </div>
      )}

      {open ? (
        <div className="flex flex-col gap-2">
          <textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Paste the sales call transcript. We'll pull out the buyer's real reasons automatically."
            rows={5}
            autoFocus
            className="border border-line rounded-[10px] px-3 py-2 text-sm bg-paper resize-none focus:border-clay focus:ring-2 focus:ring-clay/15 outline-none"
          />
          {error && <div className="text-xs text-dangerFg">{error}</div>}
          <div className="flex gap-2">
            <button
              onClick={save}
              disabled={saving || !value.trim()}
              className="flex-grow min-h-9 rounded-[10px] bg-clay text-white text-sm font-semibold disabled:opacity-50"
            >
              {saving ? "Analyzing..." : "Save"}
            </button>
            <button
              onClick={() => {
                setOpen(false);
                setValue("");
                setError(null);
              }}
              className="min-h-9 px-3 rounded-[10px] text-muted text-sm font-semibold"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className="self-start inline-flex items-center gap-1.5 text-[13px] font-semibold text-clay"
        >
          <PlusIcon /> {callThemes.length === 0 ? "Add a sales call" : "Add another"}
        </button>
      )}
    </div>
  );
}

/**
 * A row of mutually-exclusive options shown as a true segmented control
 * — used for both Reading level and Tone, so the two read as a matched
 * pair rather than two different widget styles for the same kind of
 * choice. Replaces a <input type="range"> that used to stand in for
 * reading level: a slider implies a continuous value, but there are
 * only ever 4 named levels, so the control was lying about its own
 * shape. Wraps to a second row on narrow screens instead of shrinking
 * illegibly.
 */
function SegmentedField({
  label,
  helper,
  options,
  value,
  onChange,
}: {
  label: string;
  helper?: string;
  options: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="text-sm font-semibold">{label}</div>
      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={label}>
        {options.map((option) => {
          const selected = option === value;
          return (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(option)}
              className={`min-h-9 px-3.5 rounded-full text-[13px] font-semibold border transition-colors ${
                selected
                  ? "bg-clay text-white border-clay"
                  : "bg-paper text-muted border-line hover:border-faint"
              }`}
            >
              {option}
            </button>
          );
        })}
      </div>
      {helper && <div className="text-xs text-faint leading-relaxed">{helper}</div>}
    </div>
  );
}

function Spinner() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      className="shrink-0 animate-spin"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.5" opacity="0.3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

/**
 * One row inside the offer "sheet" — label-over-value, no own border or
 * background, with the parent's divide-y supplying the only separators.
 * Replaces four separate bordered boxes (one per field) with one
 * connected card, the way a native settings list groups related fields
 * instead of repeating a card chrome for each one.
 */
function SheetField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="flex flex-col gap-1 px-3.5 py-3 cursor-text focus-within:bg-ivory/60 transition-colors">
      <span className="text-xs font-semibold text-faint">{label}</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="bg-transparent text-[15px] font-medium text-slate outline-none placeholder:text-faint placeholder:font-normal"
      />
    </label>
  );
}
