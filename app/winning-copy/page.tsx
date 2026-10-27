"use client";

import { LoadingScreen } from "@/components/LoadingScreen";
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
import { winnerChipLabel } from "@/lib/winners";

// "Best performers": the user's own library of copy that worked. Two ways
// in: "Mark as winner" on any step in the builder (saved with what kind of
// message it was and which campaign type it came from), or pasting a line
// in here by hand. Same Firestore data (winners collection) either way.
// Every campaign you build draws on this library automatically. The URL
// stays /winning-copy so old links and bookmarks keep working.
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
    return <LoadingScreen />;
  }

  return (
    <div className="h-screen overflow-hidden flex flex-col bg-paper text-slate font-body">
      {!subLoading && !active && <SubscribeBanner />}
      <div className="flex-grow flex flex-col md:flex-row min-h-0">
      <Sidebar active="winning-copy" />

      <main className="flex-grow min-w-0 min-h-0 overflow-y-auto px-4 py-6 sm:px-8 sm:py-8 lg:px-12 lg:py-10 flex flex-col gap-6 pb-24 md:pb-10 max-w-2xl">
        <div className="flex flex-col gap-1.5">
          <h1 className="font-display text-[28px] sm:text-[34px] font-semibold tracking-tight">
            Best performers
          </h1>
          <p className="text-sm text-muted">
            The copy that worked for you. Click &quot;Mark as winner&quot; on any
            message in a campaign, or paste a line below. Every campaign you build
            from now on draws on these.
          </p>
        </div>

        {user && (
          <div className="flex flex-col gap-2.5 p-4 border border-line rounded-2xl">
            <div className="text-sm font-semibold">Add a line by hand</div>
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
              No winners yet. Open a message in a campaign and click &quot;Mark as winner&quot;
              on the copy that worked, or paste a line above.
            </div>
          )}

          {entries?.map((entry) => (
            <div
              key={entry.id}
              className="flex items-start gap-3 px-4 py-3.5 border border-line rounded-xl"
            >
              <div className="flex-grow min-w-0 flex flex-col gap-1.5">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[10.5px] uppercase tracking-wider text-faint">
                  {entry.origin === "marked" ? (
                    <>
                      <span>{winnerChipLabel(entry) || "Marked as winner"}</span>
                      {entry.campaignType && <span>· {entry.campaignType}</span>}
                    </>
                  ) : (
                    <span>Added by you</span>
                  )}
                </div>
                <div className="text-sm leading-relaxed whitespace-pre-line">{entry.text}</div>
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
