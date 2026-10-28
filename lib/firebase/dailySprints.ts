import { addDoc, collection, getDocs, query, serverTimestamp, where } from "firebase/firestore";
import { db } from "./client";
import type { SprintResults } from "../daily/sprint";

// One doc per finished Daily Reps sprint, so tomorrow's sprint (and the
// streak) can build on what happened. A sprint still in progress lives only
// in the browser; it is saved here when the person finishes it.

export interface SprintRecord {
  date: string; // yyyy-mm-dd
  minutes: number;
  focus: string;
  intensity: string;
  tasksCompleted: number;
  workPercent: number;
  results: SprintResults;
}

export async function saveSprint(uid: string, record: SprintRecord): Promise<void> {
  await addDoc(collection(db, "dailySprints"), { uid, ...record, finishedAt: serverTimestamp() });
}

/** Everything this person has finished, newest first. */
export async function listSprints(uid: string): Promise<SprintRecord[]> {
  const snap = await getDocs(query(collection(db, "dailySprints"), where("uid", "==", uid)));
  return snap.docs
    .map((d) => d.data() as SprintRecord)
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}
