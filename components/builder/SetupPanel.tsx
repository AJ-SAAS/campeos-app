"use client";

import { OfferContext } from "@/lib/ai/prompts";

interface SetupPanelProps {
  offer: OfferContext;
  onOfferChange: (offer: OfferContext) => void;
  winningCopy: string[];
  callThemes: string[];
  onGenerate: () => void;
  generating: boolean;
}

// Left panel of the Campaign Builder — offer fields, "What already
// works" (winning copy) and "Why people buy" (call themes), from
// Builder.dc.html. Winning copy and call themes are read-only here for
// now; the "Add winning copy" / "Add a sales call" flows are a separate
// feature (pasted-text ingestion, per CLAUDE.md's build order).
export function SetupPanel({
  offer,
  onOfferChange,
  winningCopy,
  callThemes,
  onGenerate,
  generating,
}: SetupPanelProps) {
  function set<K extends keyof OfferContext>(key: K, value: OfferContext[K]) {
    onOfferChange({ ...offer, [key]: value });
  }

  return (
    <aside aria-label="Campaign setup" className="w-80 shrink-0 bg-white border-r border-[#DDD6C5] p-5 flex flex-col gap-4.5 overflow-y-auto">
      <h2 className="font-display text-lg font-semibold">Campaign setup</h2>

      <div className="flex items-center justify-between gap-2 p-3.5 bg-ivory rounded-xl">
        <div className="flex flex-col gap-0.5">
          <div className="font-mono text-[11px] uppercase tracking-wider text-faint">Campaign type</div>
          <div className="text-[15px] font-semibold">High-ticket webinar</div>
          <div className="text-xs text-muted">7 days. Ads, reminders, live event, replay, call booking.</div>
        </div>
      </div>

      <Field label="Offer name" value={offer.name} onChange={(v) => set("name", v)} />
      <Field label="Price" value={offer.price} onChange={(v) => set("price", v)} />
      <Field label="Who it's for" value={offer.audience} onChange={(v) => set("audience", v)} />
      <Field label="What they get" value={offer.whatTheyGet} onChange={(v) => set("whatTheyGet", v)} />

      <div className="flex flex-col gap-2.5 p-3.5 border border-[#DDD6C5] rounded-xl">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold">What already works</div>
          <span className="font-mono text-xs text-muted">{winningCopy.length} winners</span>
        </div>
        <div className="flex flex-col gap-2">
          {winningCopy.map((line, i) => (
            <div key={i} className="text-[13px] font-semibold leading-snug">
              {line}
            </div>
          ))}
          {winningCopy.length === 0 && (
            <div className="text-xs text-faint">No winning copy added yet.</div>
          )}
        </div>
        <button className="inline-flex items-center justify-center gap-1.5 min-h-11 rounded-[10px] border border-faint bg-white text-sm font-semibold">
          + Add winning copy
        </button>
      </div>

      <div className="flex flex-col gap-2.5 p-3.5 border border-[#DDD6C5] rounded-xl">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold">Why people buy</div>
          <span className="font-mono text-xs text-muted">{callThemes.length} themes</span>
        </div>
        <div className="flex flex-col gap-2">
          {callThemes.map((theme, i) => (
            <div key={i} className="text-[13px] font-semibold">
              {theme}
            </div>
          ))}
          {callThemes.length === 0 && (
            <div className="text-xs text-faint">No sales calls added yet.</div>
          )}
        </div>
        <button className="inline-flex items-center justify-center gap-1.5 min-h-11 rounded-[10px] border border-faint bg-white text-sm font-semibold">
          + Add a sales call
        </button>
      </div>

      <div className="flex flex-col gap-2">
        <div className="text-sm font-semibold">Tone</div>
        <div className="flex flex-wrap gap-2">
          {(["Friendly", "Bold", "Calm"] as const).map((t) => (
            <button
              key={t}
              aria-pressed={offer.tone === t}
              onClick={() => set("tone", t)}
              className={`min-h-10 px-3.5 rounded-full text-[13px] font-semibold border ${
                offer.tone === t
                  ? "bg-slate text-white border-slate"
                  : "bg-white text-slate border-faint font-medium"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-grow" />

      <button
        onClick={onGenerate}
        disabled={generating}
        className="flex items-center justify-center gap-2 min-h-12 rounded-xl border border-slate bg-white text-slate text-sm font-semibold disabled:opacity-50"
      >
        {generating ? "Writing your campaign..." : "Generate campaign copy"}
      </button>
    </aside>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-semibold">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 border border-faint rounded-[10px] px-3 text-sm bg-white"
      />
    </div>
  );
}
