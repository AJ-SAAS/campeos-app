"use client";

import { useEffect, useState } from "react";
import { Sidebar } from "@/components/Sidebar";
import { SubscribeBanner } from "@/components/SubscribeBanner";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { useRequireAccess } from "@/lib/firebase/useRequireAccess";
import { useSubscription } from "@/lib/firebase/useSubscription";
import {
  WinningCopyEntry,
  addWinningCopy,
  deleteWinningCopy,
  listWinningCopyEntries,
} from "@/lib/firebase/library";

// Standalone home for "What already works" — previously only reachable
// as a cramped widget inside the Builder's setup panel, with the sidebar
// links to it going nowhere (href="#"). Same Firestore data (winners
// collection), now with its own page: view everything you've saved,
// add more, delete what's no longer useful. Every campaign you build
// still draws on this same library automatically.
export default function WinningCopyPage() {
  const { user } = useAuth();
  const { ready } = useRequireAccess();
  const { loading: subLoading, active } = useSubscription();
  const [entries, setEntries] = useState<WinningCopyEntry[] | null>(null);
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setEntries(null);
      return;
    }
    listWinningCopyEntries(user.uid).then(setEntries);
  }, [user]);

  async function handleAdd() {
    if (!user || !value.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await addWinningCopy(user.uid, value.trim());
      setValue("");
      setEntries(await listWinningCopyEntries(user.uid));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save that.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!user) return;
    setEntries((prev) => prev?.filter((e) => e.id !== id) ?? prev);
    try {
      await deleteWinningCopy(id);
    } catch {
      // Put it back if the delete failed server-side.
      setEntries(await listWinningCopyEntries(user.uid));
    }
  }

  if (!ready) {
    return <div className="min-h-screen bg-paper" />;
  }

  return (
    <div className="h-screen overflow-hidden flex flex-col bg-paper text-slate font-body">
      {!subLoading && !active && <SubscribeBanner />}
      <div className="flex-grow flex flex-col md:flex-row">
      <Sidebar active="winning-copy" />

      <main className="flex-grow min-w-0 min-h-0 overflow-y-auto px-4 py-6 sm:px-8 sm:py-8 lg:px-12 lg:py-10 flex flex-col gap-6 pb-24 md:pb-10 max-w-2xl">
        <div className="flex flex-col gap-1.5">
          <h1 className="font-display text-[28px] sm:text-[34px] font-semibold tracking-tight">
            Winning copy
          </h1>
          <p className="text-sm text-muted">
            Headlines and lines that already converted for you. Every campaign you
            build draws on this automatically.
          </p>
        </div>

        {user && (
          <div className="flex flex-col gap-2.5 p-4 border border-line rounded-2xl">
            <div className="text-sm font-semibold">Add a line</div>
            <textarea
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Paste a headline, subject line, or ad line that already worked..."
              rows={3}
              className="w-full px-3.5 py-3 border border-faint rounded-xl text-sm resize-none"
            />
            {error && <div className="text-xs text-dangerFg">{error}</div>}
            <button
              onClick={handleAdd}
              disabled={saving || !value.trim()}
              className="self-start inline-flex items-center justify-center h-10 px-4 rounded-[10px] bg-gradient-to-r from-clay to-pink text-white text-sm font-semibold disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        )}

        <div className="flex flex-col gap-2.5">
          <div className="font-mono text-xs uppercase tracking-wider text-faint">
            {entries ? `${entries.length} saved` : user ? "Loading..." : ""}
          </div>

          {user && entries?.length === 0 && (
            <div className="px-4 py-6 text-sm text-faint text-center border border-line rounded-2xl">
              No winning copy added yet.
            </div>
          )}

          {entries?.map((entry) => (
            <div
              key={entry.id}
              className="flex items-start gap-3 px-4 py-3.5 border border-line rounded-xl"
            >
              <div className="flex-grow min-w-0 text-sm leading-relaxed whitespace-pre-line">
                {entry.text}
              </div>
              <button
                onClick={() => handleDelete(entry.id)}
                aria-label="Delete"
                className="shrink-0 text-xs text-muted font-medium"
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      </main>
      </div>
    </div>
  );
}
