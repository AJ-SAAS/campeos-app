"use client";

import { useState } from "react";
import { OfferContext } from "@/lib/ai/prompts";

interface SetupPanelProps {
  offer: OfferContext;
  onOfferChange: (offer: OfferContext) => void;
  winningCopy: string[];
  callThemes: string[];
  onAddWinningCopy: (text: string) => Promise<void>;
  onAddSalesCall: (transcript: string) => Promise<void>;
  onGenerate: () => void;
  generating: boolean;
}

// Left panel of the Campaign Builder — offer fields, "What already
// works" (winning copy) and "Why people buy" (call themes), from
// Builder.dc.html. Both lists are backed by Firestore and scoped to the
// signed-in user — see lib/firebase/library.ts.
export function SetupPanel({
  offer,
  onOfferChange,
  winningCopy,
  callThemes,
  onAddWinningCopy,
  onAddSalesCall,
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

      <WinningCopyCard winningCopy={winningCopy} onAdd={onAddWinningCopy} />
      <SalesCallCard callThemes={callThemes} onAdd={onAddSalesCall} />

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

      {open ? (
        <div className="flex flex-col gap-2">
          <textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Paste a headline or subject line that already converted..."
            rows={3}
            className="border border-faint rounded-[10px] px-3 py-2 text-sm bg-white resize-none"
          />
          {error && <div className="text-xs text-[#B42318]">{error}</div>}
          <div className="flex gap-2">
            <button
              onClick={save}
              disabled={saving || !value.trim()}
              className="flex-grow min-h-10 rounded-[10px] bg-slate text-white text-sm font-semibold disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save"}
            </button>
            <button
              onClick={() => {
                setOpen(false);
                setValue("");
                setError(null);
              }}
              className="min-h-10 px-3 rounded-[10px] border border-faint bg-white text-sm font-semibold"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className="inline-flex items-center justify-center gap-1.5 min-h-11 rounded-[10px] border border-faint bg-white text-sm font-semibold"
        >
          + Add winning copy
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

      {open ? (
        <div className="flex flex-col gap-2">
          <textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Paste the sales call transcript. We'll pull out the buyer's real reasons automatically."
            rows={5}
            className="border border-faint rounded-[10px] px-3 py-2 text-sm bg-white resize-none"
          />
          {error && <div className="text-xs text-[#B42318]">{error}</div>}
          <div className="flex gap-2">
            <button
              onClick={save}
              disabled={saving || !value.trim()}
              className="flex-grow min-h-10 rounded-[10px] bg-slate text-white text-sm font-semibold disabled:opacity-50"
            >
              {saving ? "Analyzing..." : "Save"}
            </button>
            <button
              onClick={() => {
                setOpen(false);
                setValue("");
                setError(null);
              }}
              className="min-h-10 px-3 rounded-[10px] border border-faint bg-white text-sm font-semibold"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className="inline-flex items-center justify-center gap-1.5 min-h-11 rounded-[10px] border border-faint bg-white text-sm font-semibold"
        >
          + Add a sales call
        </button>
      )}
    </div>
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
