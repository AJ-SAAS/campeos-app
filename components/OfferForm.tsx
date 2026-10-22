"use client";

import { useState } from "react";
import { OfferContext, READING_LEVELS } from "@/lib/ai/prompts";
import { BILLING_OPTIONS, WHO_EXAMPLES } from "@/lib/onboarding/answers";

// The create/edit form for an Offer — shared between the standalone
// /offers page and the new-campaign offer picker in the builder, so the
// same fields and validation live in one place instead of two.
export function OfferForm({
  initial,
  submitLabel,
  onCancel,
  onSubmit,
}: {
  initial: OfferContext;
  submitLabel: string;
  onCancel: () => void;
  onSubmit: (offer: OfferContext) => Promise<void>;
}) {
  const [offer, setOffer] = useState<OfferContext>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof OfferContext>(key: K, value: OfferContext[K]) {
    setOffer((prev) => ({ ...prev, [key]: value }));
  }

  async function save() {
    if (!offer.name.trim()) {
      setError("Give this offer a name.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSubmit(offer);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save that.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-3.5 p-4 border border-line rounded-2xl">
      <OfferField label="Offer name" value={offer.name} onChange={(v) => set("name", v)} />
      <OfferField label="Price" value={offer.price} onChange={(v) => set("price", v)} />
      <div className="flex flex-col gap-2">
        <div className="text-sm font-semibold">How they pay</div>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="How they pay">
          {BILLING_OPTIONS.map((o) => (
            <button
              key={o.id}
              type="button"
              role="radio"
              aria-checked={offer.billing === o.id}
              onClick={() => set("billing", offer.billing === o.id ? undefined : o.id)}
              className={`min-h-9 px-3.5 rounded-full text-[13px] font-semibold border ${
                offer.billing === o.id
                  ? "bg-clay text-white border-clay"
                  : "bg-paper text-slate border-line font-medium hover:border-faint"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>
      <OfferField
        label="Who it's for, in one line"
        value={offer.audience}
        onChange={(v) => set("audience", v)}
        placeholder={WHO_EXAMPLES[0]}
      />
      <OfferField
        label="What they get"
        value={offer.whatTheyGet}
        onChange={(v) => set("whatTheyGet", v)}
      />
      <OfferField
        label="Sign emails as"
        value={offer.fromName ?? ""}
        onChange={(v) => set("fromName", v)}
      />

      <div className="flex flex-col gap-2">
        <div className="text-sm font-semibold">Tone</div>
        <div className="flex flex-wrap gap-2">
          {(["Friendly", "Bold", "Calm"] as const).map((t) => (
            <button
              key={t}
              type="button"
              aria-pressed={offer.tone === t}
              onClick={() => set("tone", t)}
              className={`min-h-9 px-3.5 rounded-full text-[13px] font-semibold border ${
                offer.tone === t
                  ? "bg-clay text-white border-clay"
                  : "bg-paper text-slate border-line font-medium hover:border-faint"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <div className="text-sm font-semibold">Reading level</div>
        <div className="flex flex-wrap gap-2">
          {READING_LEVELS.map((level) => (
            <button
              key={level}
              type="button"
              aria-pressed={(offer.readingLevel ?? "5th grade") === level}
              onClick={() => set("readingLevel", level)}
              className={`min-h-9 px-3.5 rounded-full text-[13px] font-semibold border ${
                (offer.readingLevel ?? "5th grade") === level
                  ? "bg-clay text-white border-clay"
                  : "bg-paper text-slate border-line font-medium hover:border-faint"
              }`}
            >
              {level}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="text-xs text-dangerFg">{error}</div>}

      <div className="flex gap-2">
        <button
          onClick={save}
          disabled={saving}
          className="flex-grow min-h-10 rounded-[10px] bg-gradient-to-r from-clay to-pink text-white text-sm font-semibold disabled:opacity-50"
        >
          {saving ? "Saving..." : submitLabel}
        </button>
        <button
          onClick={onCancel}
          className="min-h-10 px-3 rounded-[10px] border border-line bg-paper text-sm font-semibold"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function OfferField({
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
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-semibold">{label}</label>
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 border border-line rounded-[10px] px-3 text-sm bg-paper"
      />
    </div>
  );
}
