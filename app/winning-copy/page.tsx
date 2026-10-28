"use client";

import { LoadingScreen } from "@/components/LoadingScreen";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
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

      <main className="flex-grow min-w-0 min-h-0 overflow-y-auto px-4 py-6 sm:px-8 sm:py-8 lg:px-12 lg:py-10 flex flex-col gap-6 pb-24 md:pb-10 max-w-3xl">
        <PageHeader title="Best performers" right={entries ? <span className="mt-2 inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-[#F4EEFE] text-[#5B21B6] text-xs font-semibold">{entries.length} saved</span> : undefined}>
          The copy that worked for you. Click &quot;Mark as winner&quot; on any
          message in a campaign, or paste a line below. Every campaign you build
          from now on draws on these.
        </PageHeader>

        {user && (
          <section className="flex flex-col gap-3.5 p-5 sm:p-6 rounded-[26px] border border-[#ECEAF0] bg-white shadow-[0_1px_0_rgba(20,10,40,.03),0_18px_40px_-28px_rgba(59,31,209,.25)]">
            <div>
              <div className="font-serif text-[22px] font-medium tracking-tight">Add a line by hand</div>
              <div className="text-sm text-muted mt-0.5">A headline, subject line or ad line that already got results.</div>
            </div>
            <textarea
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Paste a headline, subject line, or ad line that already worked..."
              rows={3}
              className="w-full px-3.5 py-3 rounded-xl border border-[#E4E1EC] bg-white text-sm resize-none placeholder:text-faint transition focus:outline-none focus:border-[#7C3AED] focus:ring-4 focus:ring-[#7C3AED]/10"
            />
            {error && <div className="text-xs text-dangerFg">{error}</div>}
            <button
              onClick={handleAdd}
              disabled={saving || !value.trim()}
              className="self-start inline-flex items-center justify-center h-11 px-6 rounded-full text-white text-sm font-semibold shadow-[0_8px_20px_-8px_rgba(155,31,214,.55)] transition hover:brightness-110 active:scale-[.98] disabled:opacity-40 disabled:shadow-none disabled:cursor-not-allowed"
              style={{ background: "linear-gradient(90deg,#3B1FD1,#9B1FD6 55%,#E0109F)" }}
            >
              {saving ? "Saving..." : "Save to best performers"}
            </button>
          </section>
        )}

        <div className="flex flex-col gap-3">
          {!entries && user && <div className="text-sm text-faint">Loading...</div>}

          {user && entries?.length === 0 && (
            <div className="flex flex-col items-center text-center gap-3 px-6 py-12 rounded-[26px] border border-dashed border-[#D9D4E6] bg-[#FBFAFD]">
              <div className="w-12 h-12 rounded-2xl grid place-items-center text-white" style={{ background: "linear-gradient(90deg,#3B1FD1,#9B1FD6 55%,#E0109F)" }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z" />
                </svg>
              </div>
              <div className="font-serif text-xl font-medium">No winners yet</div>
              <p className="text-sm text-muted max-w-[46ch]">
                Open a message in a campaign and click &quot;Mark as winner&quot; on the copy that worked, or paste a line above.
              </p>
            </div>
          )}

          {entries?.map((entry) => (
            <div
              key={entry.id}
              className="group flex items-start gap-4 px-5 py-4 rounded-[22px] border border-[#ECEAF0] bg-white transition hover:shadow-[0_14px_30px_-22px_rgba(59,31,209,.35)]"
            >
              <span className="font-serif text-4xl leading-none text-[#C9B8F5] select-none" aria-hidden="true">&ldquo;</span>
              <div className="flex-grow min-w-0 flex flex-col gap-2.5">
                <div className="font-serif text-[18px] leading-snug whitespace-pre-line">{entry.text}</div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {entry.origin === "marked" ? (
                    <>
                      <span className="px-2.5 py-0.5 rounded-full bg-[#F4EEFE] text-[#5B21B6] text-[11px] font-semibold">
                        {winnerChipLabel(entry) || "Marked as winner"}
                      </span>
                      {entry.campaignType && (
                        <span className="px-2.5 py-0.5 rounded-full bg-[#F1EFF5] text-[#4B4560] text-[11px] font-semibold">{entry.campaignType}</span>
                      )}
                    </>
                  ) : (
                    <span className="px-2.5 py-0.5 rounded-full bg-[#F1EFF5] text-[#4B4560] text-[11px] font-semibold">Added by you</span>
                  )}
                </div>
              </div>
              <button
                onClick={() => handleDelete(entry.id)}
                aria-label="Delete"
                className="shrink-0 w-9 h-9 grid place-items-center rounded-full text-muted hover:bg-red-50 hover:text-dangerFg transition"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      </main>
      </div>
    </div>
  );
}
