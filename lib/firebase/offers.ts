import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";
import { db } from "./client";
import { OfferContext } from "../ai/prompts";

// A signed-in user's saved offers — the reusable "what am I selling"
// building block a campaign is built from. Before this existed, every
// campaign's offer fields (name, price, audience, ...) were typed fresh
// into the builder's SetupPanel each time, with no way to reuse one
// across campaigns and no dedicated place to manage them — see
// app/offers/page.tsx. A client with several products/services saves
// each one once here, then picks from the list (or edits in place)
// instead of retyping it.

export interface Offer extends OfferContext {
  id: string;
  uid: string;
  createdAt: Date | null;
}

// Firestore refuses a field whose value is undefined (an offer with no
// "sign emails as" or no billing type, say), so those are left out.
const withoutUndefined = <T extends object>(o: T): T =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;

/** Saves a new offer for this user. Returns the new doc's id. */
export async function createOffer(uid: string, offer: OfferContext): Promise<string> {
  const ref = await addDoc(collection(db, "offers"), {
    uid,
    ...withoutUndefined(offer),
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

/** Lists this user's saved offers, most recently created first. */
export async function listOffers(uid: string): Promise<Offer[]> {
  const q = query(collection(db, "offers"), where("uid", "==", uid));
  const snap = await getDocs(q);
  const offers = snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      uid: data.uid as string,
      name: (data.name as string) ?? "",
      price: (data.price as string) ?? "",
      billing: data.billing as string | undefined,
      audience: (data.audience as string) ?? "",
      whatTheyGet: (data.whatTheyGet as string) ?? "",
      tone: (data.tone as string) ?? "",
      readingLevel: data.readingLevel as string | undefined,
      // "Sign emails as" for this offer. Empty means use the account
      // default (see lib/signOff.ts).
      fromName: (data.fromName as string | undefined) ?? "",
      createdAt: data.createdAt?.toDate?.() ?? null,
    } as Offer;
  });
  offers.sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0));
  return offers;
}

/** Overwrites an existing offer's fields in place (editing, not creating a new one). */
export async function updateOffer(id: string, offer: OfferContext): Promise<void> {
  await setDoc(doc(db, "offers", id), withoutUndefined(offer), { merge: true });
}

export async function deleteOffer(id: string): Promise<void> {
  await deleteDoc(doc(db, "offers", id));
}
