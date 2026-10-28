"use client";

import { LoadingScreen } from "@/components/LoadingScreen";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Sidebar } from "@/components/Sidebar";
import { SubscribeBanner } from "@/components/SubscribeBanner";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { useRequireAccess } from "@/lib/firebase/useRequireAccess";
import { useSubscription } from "@/lib/firebase/useSubscription";
import { authFetch } from "@/lib/firebase/authFetch";
import { SalesCallEntry, deleteSalesCall, listSalesCalls } from "@/lib/firebase/library";
import { addInsight, deleteInsight, listInsights, saveInsight } from "@/lib/firebase/insights";
import { Credit, emptyLearned, Insight, InsightKind, KIND_LABEL, Learned } from "@/lib/insights/types";
import { ALL_OFFERS, testimonialInsight } from "@/lib/insights/ui";

// Buyer insights: everything your buyers said or did, in one place.
// Testimonials are typed in (a quote, and a name if you have one). Calls,
// stories, DMs and the rest are pasted, dropped as a screenshot or linked,
// and read by the AI. Everything can be edited or deleted, and every change
// saves by itself with a visible "Saved" tick. The copy writer reads all
// of it when it writes a campaign.

type SaveState = "idle" | "saving" | "saved" | "error";
type Filter = "all" | "testimonial" | "call" | "other";

const KIND_OPTIONS: { value: InsightKind | ""; label: string }[] = [
  { value: "", label: "Let Campeos work it out" },
  { value: "call", label: KIND_LABEL.call },
  { value: "story", label: KIND_LABEL.story },
  { value: "message", label: KIND_LABEL.message },
  { value: "survey", label: KIND_LABEL.survey },
  { value: "objection", label: KIND_LABEL.objection },
  { value: "mystory", label: KIND_LABEL.mystory },
  { value: "result", label: KIND_LABEL.result },
  { value: "other", label: KIND_LABEL.other },
];

const CREDIT_OPTIONS: { value: Credit; label: string }[] = [
  { value: "full", label: "Full name" },
  { value: "first", label: "First name only" },
  { value: "initials", label: "Initials only" },
  { value: "none", label: "No name" },
];

const inputCls = "w-full px-3 py-2 border border-faint rounded-lg text-sm bg-paper";

function filterOf(kind: InsightKind): Filter {
  return kind === "testimonial" ? "testimonial" : kind === "call" ? "call" : "other";
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error("Couldn't read that file."));
    r.readAsDataURL(file);
  });
}

export default function BuyerInsightsPage() {
  const { user } = useAuth();
  const { ready } = useRequireAccess();
  const { loading: subLoading, active } = useSubscription();

  const [insights, setInsights] = useState<Insight[] | null>(null);
  const [oldCalls, setOldCalls] = useState<SalesCallEntry[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [status, setStatus] = useState<SaveState>("idle");

  // Autosave: edits are saved 0.7s after the last keystroke. `dirty` holds
  // anything not yet saved so a failed save can be retried.
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const dirty = useRef<Record<string, Insight>>({});
  const inFlight = useRef(0);

  useEffect(() => {
    if (!user) {
      setInsights(null);
      return;
    }
    listInsights(user.uid).then(setInsights).catch(() => setInsights([]));
    listSalesCalls(user.uid).then(setOldCalls).catch(() => setOldCalls([]));
  }, [user]);

  const flush = useCallback(async (id: string) => {
    const next = dirty.current[id];
    if (!next) return;
    inFlight.current += 1;
    try {
      await saveInsight(next);
      if (dirty.current[id] === next) delete dirty.current[id];
    } catch {
      setStatus("error");
      inFlight.current -= 1;
      return;
    }
    inFlight.current -= 1;
    if (inFlight.current === 0 && Object.keys(dirty.current).length === 0) setStatus("saved");
  }, []);

  const update = useCallback(
    (next: Insight) => {
      setInsights((prev) => prev?.map((i) => (i.id === next.id ? next : i)) ?? prev);
      dirty.current[next.id] = next;
      setStatus("saving");
      clearTimeout(timers.current[next.id]);
      timers.current[next.id] = setTimeout(() => flush(next.id), 700);
    },
    [flush]
  );

  async function retry() {
    setStatus("saving");
    await Promise.all(Object.keys(dirty.current).map((id) => flush(id)));
  }

  // Warn before leaving with unsaved edits.
  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => {
      if (Object.keys(dirty.current).length) e.preventDefault();
    };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, []);

  async function remove(id: string) {
    const before = insights;
    clearTimeout(timers.current[id]);
    delete dirty.current[id];
    setInsights((prev) => prev?.filter((i) => i.id !== id) ?? prev);
    setStatus("saving");
    try {
      await deleteInsight(id);
      setStatus("saved");
    } catch {
      setInsights(before);
      setStatus("error");
    }
  }

  async function removeOldCall(id: string) {
    if (!user) return;
    setOldCalls((prev) => prev.filter((c) => c.id !== id));
    try {
      await deleteSalesCall(id);
    } catch {
      setOldCalls(await listSalesCalls(user.uid));
    }
  }

  async function addNew(i: Omit<Insight, "id" | "createdAt">) {
    if (!user) return;
    setStatus("saving");
    try {
      await addInsight(i);
      setInsights(await listInsights(user.uid));
      setStatus("saved");
    } catch (err) {
      setStatus("error");
      throw err;
    }
  }

  const counts = useMemo(() => {
    const c = { all: 0, testimonial: 0, call: 0, other: 0 };
    (insights ?? []).forEach((i) => {
      c.all += 1;
      c[filterOf(i.kind)] += 1;
    });
    return c;
  }, [insights]);

  const shown = (insights ?? []).filter((i) => filter === "all" || filterOf(i.kind) === filter);

  if (!ready) return <LoadingScreen />;

  return (
    <div className="h-screen overflow-hidden flex flex-col bg-paper text-slate font-body">
      {!subLoading && !active && <SubscribeBanner />}
      <div className="flex-grow flex flex-col md:flex-row min-h-0">
        <Sidebar active="buyer-insights" />

        <main className="flex-grow min-w-0 min-h-0 overflow-y-auto px-4 py-6 sm:px-8 sm:py-8 lg:px-12 lg:py-10 flex flex-col gap-6 pb-24 md:pb-10 max-w-3xl">
          <PageHeader title="Buyer insights" right={<SavePill status={status} onRetry={retry} />}>
            Add what your buyers say: testimonials, sales calls, stories and messages. Every campaign you build uses
            it, and real quotes are never made up. You can edit or delete anything, and it saves by itself.
          </PageHeader>

          {user && <TestimonialForm uid={user.uid} onAdd={addNew} />}
          {user && <ReadForm uid={user.uid} onAdd={addNew} />}

          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              {(
                [
                  ["all", "All"],
                  ["testimonial", "Testimonials"],
                  ["call", "Calls"],
                  ["other", "Other"],
                ] as [Filter, string][]
              ).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setFilter(key)}
                  aria-pressed={filter === key}
                  className={`h-8 px-3 rounded-full text-xs font-semibold border ${
                    filter === key ? "bg-slate text-white border-slate" : "bg-paper text-muted border-line"
                  }`}
                >
                  {label} {counts[key]}
                </button>
              ))}
            </div>

            {insights === null && user && <div className="text-sm text-faint">Loading...</div>}
            {insights && shown.length === 0 && (
              <div className="px-4 py-6 text-sm text-faint text-center border border-line rounded-2xl">
                {insights.length === 0
                  ? "Nothing here yet. Add a testimonial above, or paste a sales call."
                  : "Nothing in this list."}
              </div>
            )}
            {shown.map((ins) => (
              <InsightCard key={ins.id} insight={ins} onChange={update} onDelete={() => remove(ins.id)} />
            ))}
          </div>

          {oldCalls.length > 0 && (
            <details className="border border-line rounded-2xl">
              <summary className="px-4 py-3 text-sm font-semibold cursor-pointer">
                Older sales calls ({oldCalls.length})
              </summary>
              <div className="flex flex-col gap-2.5 px-4 pb-4">
                <p className="text-xs text-muted">These were saved before the new page. They still feed your campaigns.</p>
                {oldCalls.map((call) => (
                  <div key={call.id} className="flex flex-col gap-2 px-3.5 py-3 border border-line rounded-xl">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex flex-wrap gap-1.5">
                        {call.themes.map((t, i) => (
                          <span key={i} className="px-2.5 py-1 rounded-full bg-ivory text-xs font-semibold">
                            {t}
                          </span>
                        ))}
                      </div>
                      <button
                        onClick={() => removeOldCall(call.id)}
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
            </details>
          )}
        </main>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Save indicator                                                      */
/* ------------------------------------------------------------------ */

function SavePill({ status, onRetry }: { status: SaveState; onRetry: () => void }) {
  if (status === "idle") return <span className="mt-2 text-xs text-faint">Saves automatically</span>;
  if (status === "saving")
    return <span className="mt-2 text-xs font-semibold text-muted animate-pulse">Saving...</span>;
  if (status === "saved")
    return (
      <span className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M5 12l5 5 9-10" />
        </svg>
        Saved
      </span>
    );
  return (
    <span className="mt-2 text-xs font-semibold text-dangerFg">
      Couldn&apos;t save.{" "}
      <button onClick={onRetry} className="underline">
        Try again
      </button>
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Add a testimonial                                                   */
/* ------------------------------------------------------------------ */

function TestimonialForm({ uid, onAdd }: { uid: string; onAdd: (i: Omit<Insight, "id" | "createdAt">) => Promise<void> }) {
  const [quote, setQuote] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [result, setResult] = useState("");
  const [more, setMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!quote.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await onAdd(testimonialInsight(uid, { quote, name, role, result }));
      setQuote("");
      setName("");
      setRole("");
      setResult("");
    } catch {
      setError("Couldn't save that. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2.5 p-4 border border-line rounded-2xl">
      <div>
        <div className="text-sm font-semibold">Add a testimonial or review</div>
        <div className="text-xs text-muted">Type or paste what they said, word for word. Add their name if you have it.</div>
      </div>
      <textarea
        value={quote}
        onChange={(e) => setQuote(e.target.value)}
        placeholder="I finally feel like I'm not breaking."
        rows={3}
        className={`${inputCls} resize-none`}
      />
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Their name (optional)" className={inputCls} />
      {more && (
        <div className="grid gap-2.5 sm:grid-cols-2">
          <input value={role} onChange={(e) => setRole(e.target.value)} placeholder="Who they are (optional)" className={inputCls} />
          <input value={result} onChange={(e) => setResult(e.target.value)} placeholder="Their result (optional)" className={inputCls} />
        </div>
      )}
      {error && <div className="text-xs text-dangerFg">{error}</div>}
      <div className="flex items-center gap-3">
        <button
          onClick={submit}
          disabled={busy || !quote.trim()}
          className="inline-flex items-center justify-center h-10 px-4 rounded-[10px] bg-gradient-to-r from-clay to-pink text-white text-sm font-semibold disabled:opacity-50"
        >
          {busy ? "Saving..." : "Save testimonial"}
        </button>
        {!more && (
          <button onClick={() => setMore(true)} className="text-xs text-muted font-medium underline">
            Add who they are or their result
          </button>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Add anything else (read by the AI)                                  */
/* ------------------------------------------------------------------ */

function ReadForm({ uid, onAdd }: { uid: string; onAdd: (i: Omit<Insight, "id" | "createdAt">) => Promise<void> }) {
  const [text, setText] = useState("");
  const [link, setLink] = useState("");
  const [kind, setKind] = useState<InsightKind | "">("");
  const [images, setImages] = useState<{ name: string; url: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pick(files: FileList | null) {
    if (!files) return;
    const next = [...images];
    for (const f of Array.from(files)) {
      if (next.length >= 4) break;
      if (!f.type.startsWith("image/")) continue;
      if (f.size > 5 * 1024 * 1024) {
        setError("Each screenshot needs to be under 5 MB.");
        continue;
      }
      next.push({ name: f.name, url: await fileToDataUrl(f) });
    }
    setImages(next);
  }

  async function submit() {
    if (!text.trim() && !link.trim() && images.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const res = await authFetch("/api/insights/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: text.trim() || undefined,
          link: link.trim() || undefined,
          images: images.length ? images.map((i) => i.url) : undefined,
          kindHint: kind || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't read that.");
      const learned: Learned = { ...emptyLearned(), ...data.learned };
      await onAdd({
        uid,
        offerId: ALL_OFFERS,
        kind: data.kind,
        title: data.title,
        text: data.text ?? text.trim(),
        source: data.source ?? "paste",
        learned,
        credit: learned.testimonial ? (learned.testimonial.name ? "full" : "none") : undefined,
      });
      setText("");
      setLink("");
      setImages([]);
      setKind("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save that.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2.5 p-4 border border-line rounded-2xl">
      <div>
        <div className="text-sm font-semibold">Add a sales call, story or message</div>
        <div className="text-xs text-muted">
          Paste it, drop a screenshot or give a link. Campeos pulls out what buyers worried about, wanted and said, in their own words.
        </div>
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Paste a call transcript, a DM, survey answers..."
        rows={5}
        className={`${inputCls} resize-none`}
      />
      <div className="grid gap-2.5 sm:grid-cols-2">
        <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="Or a link (optional)" className={inputCls} />
        <select value={kind} onChange={(e) => setKind(e.target.value as InsightKind | "")} className={inputCls} aria-label="What is it?">
          {KIND_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <label className="inline-flex items-center h-8 px-3 rounded-full border border-line text-xs font-semibold text-muted cursor-pointer">
          Add screenshots
          <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => pick(e.target.files)} />
        </label>
        {images.map((im, i) => (
          <span key={i} className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-ivory text-xs">
            {im.name.slice(0, 22)}
            <button onClick={() => setImages(images.filter((_, j) => j !== i))} aria-label="Remove" className="text-muted">
              ×
            </button>
          </span>
        ))}
      </div>
      {error && <div className="text-xs text-dangerFg">{error}</div>}
      <button
        onClick={submit}
        disabled={busy || (!text.trim() && !link.trim() && images.length === 0)}
        className="self-start inline-flex items-center justify-center h-10 px-4 rounded-[10px] bg-gradient-to-r from-clay to-pink text-white text-sm font-semibold disabled:opacity-50"
      >
        {busy ? "Reading..." : "Read and save"}
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* One insight: edit everything, delete                                */
/* ------------------------------------------------------------------ */

const LIST_FIELDS: { key: "quotes" | "pains" | "desires" | "results" | "words" | "tried" | "whyBought"; label: string }[] = [
  { key: "results", label: "Results" },
  { key: "quotes", label: "Quotes" },
  { key: "pains", label: "Problems they described" },
  { key: "desires", label: "What they want" },
  { key: "whyBought", label: "Why they bought" },
  { key: "tried", label: "What they tried before" },
  { key: "words", label: "Phrases they use" },
];

function InsightCard({ insight, onChange, onDelete }: { insight: Insight; onChange: (i: Insight) => void; onDelete: () => void }) {
  const [confirming, setConfirming] = useState(false);
  const [open, setOpen] = useState(insight.kind === "testimonial");
  const l = insight.learned;
  const isTestimonial = insight.kind === "testimonial";
  const t = l.testimonial ?? { quote: "", name: "", role: "", result: "" };

  const setLearned = (patch: Partial<Learned>) => onChange({ ...insight, learned: { ...l, ...patch } });

  const setTestimonial = (patch: Partial<typeof t>) => {
    const next = { ...t, ...patch };
    onChange({
      ...insight,
      title: next.name.trim() || next.quote.slice(0, 40),
      text: next.quote,
      learned: {
        ...l,
        quotes: next.quote.trim() && next.quote.length <= 160 ? [next.quote] : [],
        results: next.result.trim() ? [next.result] : [],
        testimonial: next,
      },
    });
  };

  const preview = isTestimonial ? t.quote : [...l.pains, ...l.results, ...l.quotes][0] ?? "";

  return (
    <div className="flex flex-col gap-3 px-4 py-3.5 border border-line rounded-xl">
      <div className="flex items-start gap-3">
        <div className="flex-grow min-w-0 flex flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-ivory text-[11px] font-semibold">{KIND_LABEL[insight.kind]}</span>
            {insight.source === "scan" && <span className="text-[11px] text-faint">From your page</span>}
          </div>
          {isTestimonial ? (
            !open && <div className="text-sm text-slate line-clamp-2">&ldquo;{t.quote}&rdquo;{t.name && <span className="text-muted"> {t.name}</span>}</div>
          ) : (
            <input
              value={insight.title}
              onChange={(e) => onChange({ ...insight, title: e.target.value })}
              aria-label="Title"
              className="w-full -mx-1 px-1 py-0.5 rounded-md border-none bg-transparent text-[15px] font-semibold"
            />
          )}
          {!open && !isTestimonial && preview && <div className="text-xs text-faint line-clamp-2">{preview}</div>}
        </div>
        <div className="shrink-0 flex items-center gap-3 text-xs font-medium text-muted">
          <button onClick={() => setOpen((v) => !v)} aria-expanded={open}>
            {open ? "Close" : "Edit"}
          </button>
          {confirming ? (
            <span className="inline-flex items-center gap-2">
              <button onClick={onDelete} className="text-dangerFg font-semibold">
                Yes, delete
              </button>
              <button onClick={() => setConfirming(false)}>No</button>
            </span>
          ) : (
            <button onClick={() => setConfirming(true)} aria-label="Delete">
              Delete
            </button>
          )}
        </div>
      </div>

      {open && isTestimonial && (
        <div className="flex flex-col gap-2.5">
          <textarea
            value={t.quote}
            onChange={(e) => setTestimonial({ quote: e.target.value })}
            rows={3}
            aria-label="Quote"
            className={`${inputCls} resize-none`}
          />
          <div className="grid gap-2.5 sm:grid-cols-2">
            <input value={t.name} onChange={(e) => setTestimonial({ name: e.target.value })} placeholder="Name" aria-label="Name" className={inputCls} />
            <input value={t.role} onChange={(e) => setTestimonial({ role: e.target.value })} placeholder="Who they are" aria-label="Role" className={inputCls} />
            <input value={t.result} onChange={(e) => setTestimonial({ result: e.target.value })} placeholder="Their result" aria-label="Result" className={inputCls} />
            <select
              value={insight.credit ?? (t.name ? "full" : "none")}
              onChange={(e) => onChange({ ...insight, credit: e.target.value as Credit })}
              aria-label="How to credit them"
              className={inputCls}
            >
              {CREDIT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  Credit: {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {open && !isTestimonial && (
        <div className="flex flex-col gap-4">
          {l.objections.length > 0 && (
            <Block label="Reasons they hesitated">
              {l.objections.map((o, i) => (
                <div key={i} className="flex flex-col gap-1.5 p-2.5 border border-line rounded-lg">
                  <div className="flex items-center gap-2">
                    <input
                      value={o.objection}
                      onChange={(e) => setLearned({ objections: l.objections.map((x, j) => (j === i ? { ...x, objection: e.target.value } : x)) })}
                      aria-label="Objection"
                      className={inputCls}
                    />
                    <RemoveButton onClick={() => setLearned({ objections: l.objections.filter((_, j) => j !== i) })} />
                  </div>
                  <input
                    value={o.answer}
                    onChange={(e) => setLearned({ objections: l.objections.map((x, j) => (j === i ? { ...x, answer: e.target.value } : x)) })}
                    placeholder="How it was answered (optional)"
                    aria-label="Answer"
                    className={inputCls}
                  />
                </div>
              ))}
            </Block>
          )}
          {LIST_FIELDS.map(({ key, label }) =>
            l[key].length ? (
              <Block key={key} label={label}>
                {l[key].map((line, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      value={line}
                      onChange={(e) => setLearned({ [key]: l[key].map((x, j) => (j === i ? e.target.value : x)) })}
                      aria-label={label}
                      className={inputCls}
                    />
                    <RemoveButton onClick={() => setLearned({ [key]: l[key].filter((_, j) => j !== i) })} />
                  </div>
                ))}
              </Block>
            ) : null
          )}
          {l.story && (
            <Block label="Story">
              {(["before", "turn", "after"] as const).map((k) => (
                <input
                  key={k}
                  value={l.story![k]}
                  onChange={(e) => setLearned({ story: { ...l.story!, [k]: e.target.value } })}
                  placeholder={k[0].toUpperCase() + k.slice(1)}
                  aria-label={k}
                  className={inputCls}
                />
              ))}
            </Block>
          )}
          {insight.text && (
            <details className="text-xs">
              <summary className="cursor-pointer font-medium text-muted">Original text</summary>
              <div className="mt-2 whitespace-pre-line text-faint leading-relaxed max-h-60 overflow-y-auto">{insight.text}</div>
            </details>
          )}
        </div>
      )}
    </div>
  );
}

function Block({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="font-mono text-[11px] uppercase tracking-wider text-faint">{label}</div>
      {children}
    </div>
  );
}

function RemoveButton({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} aria-label="Remove this line" className="shrink-0 w-8 h-8 rounded-lg border border-line text-muted text-base leading-none">
      ×
    </button>
  );
}
