import { addDoc, collection, deleteDoc, doc, getDocs, query, serverTimestamp, where } from "firebase/firestore";
import { db } from "./client";

// A signed-in user's personal library of proven copy and sales-call
// themes. Scoped to the user (not a single campaign), so anything added
// here is reused across every campaign they build from then on.

export interface WinningCopyEntry {
  id: string;
  text: string;
  addedAt: Date | null;
}

export interface SalesCallEntry {
  id: string;
  transcript: string;
  themes: string[];
  addedAt: Date | null;
}

/** Saves one pasted-in headline/line of copy that already converted. */
export async function addWinningCopy(uid: string, text: string): Promise<void> {
  await addDoc(collection(db, "winners"), {
    uid,
    text,
    addedAt: serverTimestamp(),
  });
}

/** Lists every winning copy line this user has saved. */
export async function listWinningCopy(uid: string): Promise<string[]> {
  const q = query(collection(db, "winners"), where("uid", "==", uid));
  const snap = await getDocs(q);
  return snap.docs.map((d) => (d.data().text as string) ?? "").filter(Boolean);
}

/** Same as listWinningCopy, but with doc ids and timestamps — for the
 * standalone /winning-copy library page, where entries can be deleted. */
export async function listWinningCopyEntries(uid: string): Promise<WinningCopyEntry[]> {
  const q = query(collection(db, "winners"), where("uid", "==", uid));
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => {
      const data = d.data();
      return {
        id: d.id,
        text: (data.text as string) ?? "",
        addedAt: data.addedAt?.toDate?.() ?? null,
      };
    })
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
