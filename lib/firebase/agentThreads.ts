import { addDoc, collection, deleteDoc, getDocs, query, serverTimestamp, Timestamp, where } from "firebase/firestore";
import { db } from "./client";
import { SAVED_HISTORY_LIMIT, splitForPrune } from "../agentHistory";

// One flat, per-user chat history with the agent. Scoped to the user
// (not a single campaign), matching lib/firebase/library.ts. We fetch
// by uid only and sort client-side, rather than adding createdAt to the
// query, so this doesn't need a composite Firestore index to work.

export interface AgentMessage {
  role: "user" | "assistant";
  content: string;
  createdAt?: Timestamp;
}

export async function addAgentMessage(
  uid: string,
  role: "user" | "assistant",
  content: string
): Promise<void> {
  await addDoc(collection(db, "agentMessages"), {
    uid,
    role,
    content,
    createdAt: serverTimestamp(),
  });
}

/** Lists this user's agent chat history, oldest first. */
export async function listAgentMessages(uid: string): Promise<AgentMessage[]> {
  const q = query(collection(db, "agentMessages"), where("uid", "==", uid));
  const snap = await getDocs(q);
  const messages = snap.docs.map((d) => d.data() as AgentMessage);
  messages.sort((a, b) => (a.createdAt?.toMillis() ?? 0) - (b.createdAt?.toMillis() ?? 0));
  return messages;
}

async function sortedDocs(uid: string) {
  const snap = await getDocs(query(collection(db, "agentMessages"), where("uid", "==", uid)));
  return [...snap.docs].sort(
    (a, b) => ((a.data() as AgentMessage).createdAt?.toMillis() ?? 0) - ((b.data() as AgentMessage).createdAt?.toMillis() ?? 0)
  );
}

/** Deletes the oldest saved messages past the limit. Best effort. */
export async function pruneAgentMessages(uid: string, keep = SAVED_HISTORY_LIMIT): Promise<void> {
  const { drop } = splitForPrune(await sortedDocs(uid), keep);
  await Promise.all(drop.map((d) => deleteDoc(d.ref)));
}

/** "New chat": deletes this user's whole saved thread. */
export async function clearAgentMessages(uid: string): Promise<void> {
  await Promise.all((await sortedDocs(uid)).map((d) => deleteDoc(d.ref)));
}
