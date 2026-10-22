"use client";

import { LoadingScreen } from "@/components/LoadingScreen";
import { useEffect, useState } from "react";
import { Sidebar } from "@/components/Sidebar";
import { SubscribeBanner } from "@/components/SubscribeBanner";
import { OfferForm } from "@/components/OfferForm";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { useRequireAccess } from "@/lib/firebase/useRequireAccess";
import { useSubscription } from "@/lib/firebase/useSubscription";
import { Offer, createOffer, deleteOffer, listOffers, updateOffer } from "@/lib/firebase/offers";
import { OfferContext } from "@/lib/ai/prompts";
import { priceLabel } from "@/lib/onboarding/answers";

// Standalone home for a client's saved offers — what am I selling,
// reusable across every campaign instead of retyped from scratch each
// time. Mirrors the /winning-copy page's shape (list + inline add form +
// delete), but each entry is a structured OfferContext, not a single
// line of text, so it gets its own form component shared between "add
// new" and "edit existing" instead of a bare textarea.
//
// Creating a campaign from one of these COPIES the offer's fields into
// the campaign document at that moment (see builder/page.tsx) rather
// than referencing this offer by id — so editing or deleting an offer
// here never changes a campaign already built from it.

const EMPTY_OFFER: OfferContext = {
  name: "",
  price: "",
  audience: "",
  whatTheyGet: "",
  tone: "Friendly",
  readingLevel: "5th grade",
};

export default function OffersPage() {
  const { user } = useAuth();
  const { ready } = useRequireAccess();
  const { loading: subLoading, active } = useSubscription();
  const [offers, setOffers] = useState<Offer[] | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setOffers(null);
      return;
    }
    listOffers(user.uid).then(setOffers);
  }, [user]);

  async function refresh() {
    if (!user) return;
    setOffers(await listOffers(user.uid));
  }

  async function handleCreate(offer: OfferContext) {
    if (!user) return;
    await createOffer(user.uid, offer);
    setFormOpen(false);
    await refresh();
  }

  async function handleUpdate(id: string, offer: OfferContext) {
    await updateOffer(id, offer);
    setEditingId(null);
    await refresh();
  }

  async function handleDelete(id: string) {
    if (!user) return;
    setOffers((prev) => prev?.filter((o) => o.id !== id) ?? prev);
    try {
      await deleteOffer(id);
    } catch {
      // Put it back if the delete failed server-side.
      await refresh();
    }
  }

  if (!ready) {
    return <LoadingScreen />;
  }

  return (
    <div className="h-screen overflow-hidden flex flex-col bg-paper text-slate font-body">
      {!subLoading && !active && <SubscribeBanner />}
      <div className="flex-grow flex flex-col md:flex-row min-h-0">
        <Sidebar active="offers" />

        <main className="flex-grow min-w-0 min-h-0 overflow-y-auto px-4 py-6 sm:px-8 sm:py-8 lg:px-12 lg:py-10 flex flex-col gap-6 pb-24 md:pb-10 max-w-2xl">
          <div className="flex flex-col gap-1.5">
            <h1 className="font-display text-[28px] sm:text-[34px] font-semibold tracking-tight">
              Offers
            </h1>
            <p className="text-sm text-muted">
              What you&apos;re selling. Save an offer once, then pick it for any
              campaign instead of retyping the same details every time.
            </p>
          </div>

          {user && !formOpen && (
            <button
              onClick={() => setFormOpen(true)}
              className="self-start inline-flex items-center justify-center gap-1.5 h-10 px-4 rounded-[10px] bg-gradient-to-r from-clay to-pink text-white text-sm font-semibold"
            >
              + New offer
            </button>
          )}

          {formOpen && (
            <OfferForm
              initial={EMPTY_OFFER}
              submitLabel="Save offer"
              onCancel={() => setFormOpen(false)}
              onSubmit={handleCreate}
            />
          )}

          <div className="flex flex-col gap-2.5">
            <div className="font-mono text-xs uppercase tracking-wider text-faint">
              {offers ? `${offers.length} saved` : user ? "Loading..." : ""}
            </div>

            {user && offers?.length === 0 && !formOpen && (
              <div className="px-4 py-6 text-sm text-faint text-center border border-line rounded-2xl">
                No offers saved yet.
              </div>
            )}

            {offers?.map((offer) =>
              editingId === offer.id ? (
                <OfferForm
                  key={offer.id}
                  initial={offer}
                  submitLabel="Save changes"
                  onCancel={() => setEditingId(null)}
                  onSubmit={(updated) => handleUpdate(offer.id, updated)}
                />
              ) : (
                <div
                  key={offer.id}
                  className="flex items-start gap-3 px-4 py-3.5 border border-line rounded-xl"
                >
                  <div className="flex-grow min-w-0 flex flex-col gap-1">
                    <div className="text-[15px] font-semibold truncate">
                      {offer.name || "Untitled offer"}
                    </div>
                    <div className="text-xs text-muted truncate">
                      {[priceLabel(offer.price, offer.billing), offer.audience].filter(Boolean).join(" · ")}
                    </div>
                    {offer.whatTheyGet && (
                      <div className="text-[13px] text-muted leading-snug">{offer.whatTheyGet}</div>
                    )}
                  </div>
                  <div className="flex flex-col gap-1.5 shrink-0">
                    <button
                      onClick={() => setEditingId(offer.id)}
                      className="text-xs text-muted font-medium"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(offer.id)}
                      aria-label={`Delete ${offer.name || "offer"}`}
                      className="text-xs text-dangerFg font-medium"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
