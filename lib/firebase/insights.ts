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
import { emptyLearned, Insight } from "../insights/types";

// Buyer insights: everything a user's buyers said or did (calls,
// testimonials, stories, DMs...). One document each, owned by the user.
// See lib/insights/types.ts for the shape and lib/insights/logic.ts for
// how they are turned into what the copy writer reads.

type NewInsight = Omit<Insight, "id" | "createdAt">;

// Firestore refuses undefined values.
const clean = <T extends object>(o: T): T =>
  JSON.parse(JSON.stringify(o)) as T;

export async function addInsight(insight: NewInsight): Promise<string> {
  const ref = await addDoc(collection(db, "insights"), {
    ...clean(insight),
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function listInsights(uid: string): Promise<Insight[]> {
  const snap = await getDocs(query(collection(db, "insights"), where("uid", "==", uid)));
  return snap.docs
    .map((d) => {
      const data = d.data();
      return {
        id: d.id,
        uid: data.uid as string,
        offerId: (data.offerId as string) ?? "all",
        kind: data.kind,
        title: (data.title as string) ?? "",
        text: (data.text as string) ?? "",
        source: data.source ?? "paste",
        learned: { ...emptyLearned(), ...(data.learned ?? {}) },
        credit: data.credit,
        createdAt: data.createdAt?.toDate?.()?.toISOString?.() ?? new Date().toISOString(),
      } as Insight;
    })
    .sort((a, b) => (b.createdAt > a.createdAt ? 1 : b.createdAt < a.createdAt ? -1 : 0));
}

/** Saves the editable parts of an insight (title, what was learned, credit). */
export async function saveInsight(insight: Insight): Promise<void> {
  const { id, createdAt: _createdAt, ...rest } = insight;
  await setDoc(doc(db, "insights", id), clean(rest), { merge: true });
}

export async function deleteInsight(id: string): Promise<void> {
  await deleteDoc(doc(db, "insights", id));
}
