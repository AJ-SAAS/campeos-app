"use client";

import { useEffect, useState } from "react";
import { OfferForm } from "@/components/OfferForm";
import { OfferContext } from "@/lib/ai/prompts";
import { Offer, createOffer, listOffers } from "@/lib/firebase/offers";

// Shown once, before the builder itself, whenever someone starts a new
// campaign with no offer chosen yet. Replaces the old behavior of every
// new campaign silently starting from the same hardcoded placeholder
// offer ("Fall Reset Program") — which is also what was producing
// near-identical draft rows: every test click of "new campaign" began
// from the same defaults, with nothing forcing a real offer to be
// chosen first.
//
// Picking a saved offer, or saving a new one here, only sets the
// starting point for this campaign's fields — the campaign still keeps
// its own copy from here on (see builder/page.tsx), so later edits in
// the builder, or changes to the saved Offer afterward, never cross
// back and forth between the two.
export function OfferPicker({
  uid,
  onPick,
}: {
  uid: string;
  onPick: (offer: OfferContext) => void;
}) {
  const [offers, setOffers] = useState<Offer[] | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    listOffers(uid).then(setOffers);
  }, [uid]);

  async function handleCreate(offer: OfferContext) {
    await createOffer(uid, offer);
    onPick(offer);
  }

  return (
    <div className="h-screen overflow-y-auto flex items-start justify-center bg-paper px-4 py-10 sm:py-16">
      <div className="w-full max-w-lg flex flex-col gap-6">
        <div className="flex flex-col gap-1.5">
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            Which offer is this campaign for?
          </h1>
          <p className="text-sm text-muted">
            Pick a saved offer or add a new one. Campeos writes every step
            from these details.
          </p>
        </div>

        {creating ? (
          <OfferForm
            initial={{
              name: "",
              price: "",
              audience: "",
              whatTheyGet: "",
              tone: "Friendly",
              readingLevel: "5th grade",
            }}
            submitLabel="Use this offer"
            onCancel={() => setCreating(false)}
            onSubmit={handleCreate}
          />
        ) : (
          <div className="flex flex-col gap-3">
            {offers === null && (
              <div className="text-sm text-faint px-1">Loading your saved offers...</div>
            )}

            {offers?.map((offer) => (
              <button
                key={offer.id}
                onClick={() => onPick(offer)}
                className="text-left flex items-start gap-3 px-4 py-3.5 border border-line rounded-xl hover:border-clay hover:bg-ivory/50 transition-colors"
              >
                <div className="flex-grow min-w-0 flex flex-col gap-1">
                  <div className="text-[15px] font-semibold truncate">
                    {offer.name || "Untitled offer"}
                  </div>
                  <div className="text-xs text-muted truncate">
                    {[offer.price, offer.audience].filter(Boolean).join(" · ")}
                  </div>
                </div>
              </button>
            ))}

            {offers?.length === 0 && (
              <div className="px-4 py-6 text-sm text-faint text-center border border-dashed border-line rounded-xl">
                No saved offers yet — add one below.
              </div>
            )}

            <button
              onClick={() => setCreating(true)}
              className="flex items-center justify-center gap-2 min-h-12 rounded-xl border border-line text-sm font-semibold text-slate hover:border-clay hover:text-clay"
            >
              + New offer
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
