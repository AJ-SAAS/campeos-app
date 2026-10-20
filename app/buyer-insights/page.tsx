"use client";

import { useEffect, useState } from "react";
import { Sidebar } from "@/components/Sidebar";
import { SubscribeBanner } from "@/components/SubscribeBanner";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { useRequireAccess } from "@/lib/firebase/useRequireAccess";
import { useSubscription } from "@/lib/firebase/useSubscription";
import {
  SalesCallEntry,
  addSalesCall,
  deleteSalesCall,
  listSalesCalls,
} from "@/lib/firebase/library";
import { authFetch } from "@/lib/firebase/authFetch";

// Standalone home for "Why people buy" — same fix as /winning-copy:
// previously only reachable as a cramped widget inside the Builder, with
// a dead sidebar link. Pasting a transcript here runs it through
// /api/analyze-call to pull out buyer-language themes, same as the
// Builder's flow, then saves both to Firestore (salesCalls collection).
export default function BuyerInsightsPage() {
  const { user } = useAuth();
  const { ready } = useRequireAccess();
  const { loading: subLoading, active } = useSubscription();
  const [calls, setCalls] = useState<SalesCallEntry[] | null>(null);
  const [transcript, setTranscript] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setCalls(null);
      return;
    }
    listSalesCalls(user.uid).then(setCalls);
  }, [user]);

  async function handleAdd() {
    if (!user || !transcript.trim()) return;
    setAnalyzing(true);
    setError(null);
    try {
      const res = await authFetch("/api/analyze-call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: transcript.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't analyze that call.");
      await addSalesCall(user.uid, transcript.trim(), data.themes);
      setTranscript("");
      setCalls(await listSalesCalls(user.uid));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save that.");
    } finally {
      setAnalyzing(false);
    }
  }

  async function handleDelete(id: string) {
    if (!user) return;
    setCalls((prev) => prev?.filter((c) => c.id !== id) ?? prev);
    try {
      await deleteSalesCall(id);
    } catch {
      setCalls(await listSalesCalls(user.uid));
    }
  }

  if (!ready) {
    return <div className="min-h-screen bg-paper" />;
  }

  return (
    <div className="h-screen overflow-hidden flex flex-col bg-paper text-slate font-body">
      {!subLoading && !active && <SubscribeBanner />}
      <div className="flex-grow flex flex-col md:flex-row min-h-0">
      <Sidebar active="buyer-insights" />

      <main className="flex-grow min-w-0 min-h-0 overflow-y-auto px-4 py-6 sm:px-8 sm:py-8 lg:px-12 lg:py-10 flex flex-col gap-6 pb-24 md:pb-10 max-w-2xl">
        <div className="flex flex-col gap-1.5">
          <h1 className="font-display text-[28px] sm:text-[34px] font-semibold tracking-tight">
            Buyer insights
          </h1>
          <p className="text-sm text-muted">
            Paste a sales call transcript and Campeos pulls out the themes in your
            buyers&apos; own words. Every campaign you build uses them.
          </p>
        </div>

        {user && (
          <div className="flex flex-col gap-2.5 p-4 border border-line rounded-2xl">
            <div className="text-sm font-semibold">Add a sales call</div>
            <textarea
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              placeholder="Paste the call transcript here..."
              rows={6}
              className="w-full px-3.5 py-3 border border-faint rounded-xl text-sm resize-none"
            />
            {error && <div className="text-xs text-dangerFg">{error}</div>}
            <button
              onClick={handleAdd}
              disabled={analyzing || !transcript.trim()}
              className="self-start inline-flex items-center justify-center h-10 px-4 rounded-[10px] bg-gradient-to-r from-clay to-pink text-white text-sm font-semibold disabled:opacity-50"
            >
              {analyzing ? "Finding themes..." : "Analyze and save"}
            </button>
          </div>
        )}

        <div className="flex flex-col gap-2.5">
          <div className="font-mono text-xs uppercase tracking-wider text-faint">
            {calls ? `${calls.length} calls` : user ? "Loading..." : ""}
          </div>

          {user && calls?.length === 0 && (
            <div className="px-4 py-6 text-sm text-faint text-center border border-line rounded-2xl">
              No sales calls added yet.
            </div>
          )}

          {calls?.map((call) => (
            <div
              key={call.id}
              className="flex flex-col gap-2.5 px-4 py-3.5 border border-line rounded-xl"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex flex-wrap gap-1.5">
                  {call.themes.map((theme, i) => (
                    <span
                      key={i}
                      className="px-2.5 py-1 rounded-full bg-ivory text-xs font-semibold"
                    >
                      {theme}
                    </span>
                  ))}
                </div>
                <button
                  onClick={() => handleDelete(call.id)}
                  aria-label="Delete"
                  className="shrink-0 text-xs text-muted font-medium"
                >
                  Delete
                </button>
              </div>
              <div className="text-xs text-faint leading-relaxed line-clamp-3 whitespace-pre-line">
                {call.transcript}
              </div>
            </div>
          ))}
        </div>
      </main>
      </div>
    </div>
  );
}
