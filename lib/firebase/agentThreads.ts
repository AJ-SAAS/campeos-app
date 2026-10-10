import { addDoc, collection, getDocs, query, serverTimestamp, Timestamp, where } from "firebase/firestore";
import { db } from "./client";

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
