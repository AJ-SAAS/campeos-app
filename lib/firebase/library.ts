import { addDoc, collection, deleteDoc, doc, getDocs, query, serverTimestamp, where } from "firebase/firestore";
import { db } from "./client";
import { WinnerEntry, WinnerMeta, findWinner, winnersForPrompt } from "../winners";

// A signed-in user's personal library of proven copy and sales-call
// themes. Scoped to the user (not a single campaign), so anything added
// here is reused across every campaign they build from then on.

/** One saved winner. Same shape the Best performers page and the builder
 * use (see lib/winners.ts). Kept under its old name too. */
export type WinningCopyEntry = WinnerEntry;

export interface SalesCallEntry {
  id: string;
  transcript: string;
  themes: string[];
  addedAt: Date | null;
}

/**
 * Saves one line of winning copy. Pasted by hand (no `meta`) or marked
 * from a step in the builder (`meta` says what kind of message it was and
 * which campaign type it came from). Returns the new doc's id.
 */
export async function addWinningCopy(uid: string, text: string, meta?: WinnerMeta): Promise<string> {
  const data: Record<string, unknown> = {
    uid,
    text,
    origin: meta ? "marked" : "pasted",
    addedAt: serverTimestamp(),
  };
  // Firestore rejects `undefined`, so only set the fields we have.
  if (meta?.channel) data.channel = meta.channel;
  if (meta?.fieldLabel) data.fieldLabel = meta.fieldLabel;
  if (meta?.campaignType) data.campaignType = meta.campaignType;
  const ref = await addDoc(collection(db, "winners"), data);
  return ref.id;
}

/** "Mark as winner" on a step. Saving the same line twice is a no-op, so a
 * double click (or marking something already in the library) can't
 * create duplicates. Returns the id of the saved entry. */
export async function markAsWinner(uid: string, text: string, meta: WinnerMeta): Promise<string> {
  const existing = findWinner(await listWinningCopyEntries(uid), text);
  if (existing) return existing.id;
  return addWinningCopy(uid, text.trim(), meta);
}

/** The lines the AI sees as reference: newest first, capped, and tagged
 * with what kind of copy each one was (see winnersForPrompt). */
export async function listWinningCopy(uid: string): Promise<string[]> {
  return winnersForPrompt(await listWinningCopyEntries(uid));
}

/** Every winner this user has saved, with ids, tags and timestamps, newest
 * first — for the Best performers page and the builder's "Winner" buttons. */
export async function listWinningCopyEntries(uid: string): Promise<WinnerEntry[]> {
  const q = query(collection(db, "winners"), where("uid", "==", uid));
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => {
      const data = d.data();
      return {
        id: d.id,
        text: (data.text as string) ?? "",
        origin: data.origin === "marked" ? ("marked" as const) : ("pasted" as const),
        channel: (data.channel as string) || undefined,
        fieldLabel: (data.fieldLabel as string) || undefined,
        campaignType: (data.campaignType as string) || undefined,
        addedAt: data.addedAt?.toDate?.() ?? null,
      };
    })
    .filter((e) => e.text)
    .sort((a, b) => (b.addedAt?.getTime() ?? 0) - (a.addedAt?.getTime() ?? 0));
}

export async function deleteWinningCopy(id: string): Promise<void> {
  await deleteDoc(doc(db, "winners", id));
}

/**
 * Saves a sales call transcript plus the buyer-language themes already
 * pulled from it (see lib/ai/analyzeSalesCall.ts — the transcript itself
 * is kept for reference, but only the themes feed into copy generation).
 */
export async function addSalesCall(
  uid: string,
  transcript: string,
  themes: string[]
): Promise<void> {
  await addDoc(collection(db, "salesCalls"), {
    uid,
    transcript,
    themes,
    addedAt: serverTimestamp(),
  });
}

/** Lists every theme pulled from every sales call this user has added,
 * flattened into one list for the builder's "Why people buy" panel. */
export async function listCallThemes(uid: string): Promise<string[]> {
  const q = query(collection(db, "salesCalls"), where("uid", "==", uid));
  const snap = await getDocs(q);
  const themes: string[] = [];
  for (const d of snap.docs) {
    const data = d.data();
    if (Array.isArray(data.themes)) themes.push(...(data.themes as string[]));
  }
  return themes;
}

/** Same calls as listCallThemes, but each one's own record (transcript +
 * its themes) rather than flattened — for the standalone /buyer-insights
 * library page, where entries can be deleted. */
export async function listSalesCalls(uid: string): Promise<SalesCallEntry[]> {
  const q = query(collection(db, "salesCalls"), where("uid", "==", uid));
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => {
      const data = d.data();
      return {
        id: d.id,
        transcript: (data.transcript as string) ?? "",
        themes: Array.isArray(data.themes) ? (data.themes as string[]) : [],
        addedAt: data.addedAt?.toDate?.() ?? null,
      };
    })
    .sort((a, b) => (b.addedAt?.getTime() ?? 0) - (a.addedAt?.getTime() ?? 0));
}

export async function deleteSalesCall(id: string): Promise<void> {
  await deleteDoc(doc(db, "salesCalls", id));
}
