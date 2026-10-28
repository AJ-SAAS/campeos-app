"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Mascot } from "@/components/mascot/Mascot";
import { burstConfetti } from "@/lib/confetti";
import { AGENT_NAME } from "@/lib/brand";
import {
  CHANNELS, FOCUSES, INTENSITIES, SCENARIOS, SPRINT_MINUTES,
  buildSprint, channelTitle, clock, dateKey, defaultChannels, doneCount, minutesSpent, newSession,
  remainingMs, repsOf, totalReps, resultsFrom, sprintVerdict, streakDays, subtasksFor, taskComplete,
  tasksCompleted, workPercent,
  type ChannelId, type FocusId, type IntensityId, type SprintSession, type SprintTask,
} from "@/lib/daily/sprint";
import { listSprints, saveSprint, type SprintRecord } from "@/lib/firebase/dailySprints";
import { todaysSession, writeStore } from "@/lib/daily/session";
import { Work } from "./FocusStage";

// Daily Reps: pick your time, press start, and work through four guided
// tasks. Eos plans it; you do it. Three screens: start, work, finish.

const GRAD = "linear-gradient(90deg,#3B1FD1,#9B1FD6 55%,#E0109F)";

export function DailyReps({ uid, offerName, userChannels }: { uid: string; offerName: string; userChannels: string[] }) {
  const today = useMemo(() => dateKey(new Date()), []);
  const [session, setSession] = useState<SprintSession | null>(null);
  const [phase, setPhase] = useState<"start" | "work" | "done">("start");
  const [loaded, setLoaded] = useState(false);
  const [records, setRecords] = useState<SprintRecord[]>([]);
  const dates = useMemo(() => records.map((r) => r.date), [records]);

  // Pick up a sprint that was running before a refresh. One from an earlier
  // day is not shown (the reps reset daily), but its work is counted.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const saved = await todaysSession(uid, today, Date.now());
      if (cancelled) return;
      if (saved) {
        setSession(saved);
        setPhase("work");
      }
      setLoaded(true);
      listSprints(uid).then((r) => !cancelled && setRecords(r)).catch(() => {});
    })();
    return () => {
      cancelled = true;
    };
  }, [uid, today]);

  const update = useCallback(
    (fn: (s: SprintSession) => SprintSession) => {
      setSession((prev) => {
        if (!prev) return prev;
        const next = fn(prev);
        writeStore(uid, JSON.stringify(next));
        return next;
      });
    },
    [uid]
  );

  const streak = streakDays(dates, today);
  const doneToday = dates.includes(today);

  if (!loaded) return <div className="h-[420px] rounded-[26px] bg-[#F8F8F8] animate-pulse max-w-[860px]" />;

  if (phase === "work" && session) {
    return (
      <Work
        session={session}
        offerName={offerName}
        update={update}
        onFinish={() => setPhase("done")}
      />
    );
  }
  if (phase === "done" && session) {
    return (
      <Finish
        session={session}
        streak={streak + (doneToday ? 0 : 1)}
        before={totalReps(records)}
        onSaved={(rec) => {
          writeStore(uid, null);
          setRecords((x) => [rec, ...x]);
        }}
        uid={uid}
        onNew={() => {
          writeStore(uid, null);
          setSession(null);
          setPhase("start");
        }}
      />
    );
  }
  return (
    <Start
      streak={streak}
      total={totalReps(records)}
      doneToday={doneToday}
      userChannels={userChannels}
      onStart={(focus, intensity) => {
        const plan = buildSprint({ focus, intensity });
        const content = plan.tasks.find((t) => t.kind === "content");
        const s = newSession(plan, Date.now(), defaultChannels(userChannels, content?.target ?? 3), today);
        writeStore(uid, JSON.stringify(s));
        setSession(s);
        setPhase("work");
      }}
    />
  );
}

// ---------------------------------------------------------------- Start

function Start({
  streak, total, doneToday, userChannels, onStart,
}: {
  streak: number;
  total: number;
  doneToday: boolean;
  userChannels: string[];
  onStart: (f: FocusId, i: IntensityId) => void;
}) {
  const [focus, setFocus] = useState<FocusId>("balanced");
  const [intensity, setIntensity] = useState<IntensityId>("steady");
  const plan = buildSprint({ focus, intensity });
  void userChannels;

  return (
    <div className="max-w-[860px] flex flex-col gap-7">
      <header className="relative overflow-hidden rounded-[32px] text-white px-6 sm:px-9 py-8" style={{ background: "#0D0A1A" }}>
        <div aria-hidden="true" className="reps-aurora absolute -top-28 -left-20 w-[420px] h-[420px] rounded-full" style={{ background: "radial-gradient(circle,rgba(124,58,237,.55),transparent 68%)" }} />
        <div aria-hidden="true" className="reps-aurora reps-aurora-b absolute -bottom-36 -right-16 w-[460px] h-[460px] rounded-full" style={{ background: "radial-gradient(circle,rgba(224,16,159,.38),transparent 68%)" }} />
        <div className="relative flex flex-wrap items-center gap-6">
          <div className="shrink-0">
            <Mascot size={176} fit={1.05} centered bubble={false} glow={false} restless={false} mood="happy" label={AGENT_NAME} style={{ margin: -22 }} />
          </div>
          <div className="min-w-[240px] flex-1">
            <div className="font-mono text-[11px] uppercase tracking-[.12em] text-white/55">Daily Reps</div>
            <h1 className="font-serif text-[34px] sm:text-[44px] leading-[1.04] font-medium tracking-tight mt-2">
              Your business grows when you do the work.
            </h1>
            <p className="text-[16px] text-white/70 mt-3 max-w-[520px]">
              Pick your time. {AGENT_NAME} plans the hour and gets the guidance ready. You get the reps in.
            </p>
            {(streak > 0 || doneToday || total > 0) && (
              <div className="mt-4 inline-flex flex-wrap items-center gap-x-2 px-3.5 py-1.5 rounded-full bg-white/10 border border-white/15 text-sm font-semibold">
                {doneToday ? <span>Today&apos;s reps are done</span> : streak > 0 ? <span>{streak} {streak === 1 ? "day" : "days"} in a row</span> : null}
                {doneToday && streak > 0 && <span>· {streak} in a row</span>}
                {total > 0 && <span>{doneToday || streak > 0 ? "· " : ""}{total.toLocaleString()} {total === 1 ? "rep" : "reps"} all time</span>}
              </div>
            )}
          </div>
        </div>
      </header>

      <section aria-label="How much time">
        <h2 className="text-[15px] font-semibold mb-2.5">How much time are you putting in today?</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button type="button" aria-pressed="true" className="text-left px-4 py-4 rounded-2xl border-2 border-slate bg-[#FAF9FC]">
            <div className="text-[22px] font-semibold">1 hour</div>
            <div className="text-sm text-muted">Quick sprint</div>
          </button>
          {[{ t: "2 hours", s: "Deep work" }, { t: "4 hours", s: "Full commitment" }].map((x) => (
            <div key={x.t} aria-disabled="true" className="px-4 py-4 rounded-2xl border border-[#ECEAF0] opacity-60">
              <div className="text-[22px] font-semibold">{x.t}</div>
              <div className="text-sm text-muted">
                {x.s} <span className="ml-1 px-2 py-0.5 rounded-full bg-[#F2F1F5] text-xs font-semibold">Soon</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section aria-label="Today's focus">
        <h2 className="text-[15px] font-semibold mb-2.5">Today&apos;s focus</h2>
        <div role="radiogroup" className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {FOCUSES.map((f) => (
            <button
              key={f.id}
              type="button"
              role="radio"
              aria-checked={focus === f.id}
              onClick={() => setFocus(f.id)}
              className={`text-left px-4 py-3.5 rounded-2xl border transition-shadow ${focus === f.id ? "border-transparent shadow-[inset_0_0_0_2px_#13171A] bg-[#FAF9FC]" : "border-[#E3E1E8] hover:border-[#B9B3C7]"}`}
            >
              <div className="font-semibold">{f.title}</div>
              <div className="text-sm text-muted">{f.sub}</div>
            </button>
          ))}
        </div>
      </section>

      <section aria-label="How hard">
        <h2 className="text-[15px] font-semibold mb-2.5">How hard do you want to push?</h2>
        <div role="radiogroup" className="flex flex-wrap gap-2.5">
          {INTENSITIES.map((i) => (
            <button
              key={i.id}
              type="button"
              role="radio"
              aria-checked={intensity === i.id}
              onClick={() => setIntensity(i.id)}
              className={`h-11 px-4 rounded-xl border text-[15px] font-semibold ${intensity === i.id ? "border-transparent shadow-[inset_0_0_0_2px_#13171A] bg-[#FAF9FC]" : "border-[#D4D1DB] hover:border-[#B9B3C7]"}`}
            >
              {i.title} <span className="font-normal text-muted">· {i.sub}</span>
            </button>
          ))}
        </div>
      </section>

      <section aria-label="Your sprint" className="border border-[#ECEAF0] rounded-[22px] overflow-hidden">
        <div className="flex items-baseline justify-between px-5 py-3.5 border-b border-[#F0F0F0]">
          <h2 className="text-[16px] font-semibold">Your {SPRINT_MINUTES}-minute sprint</h2>
          <span className="font-mono text-xs text-muted">{plan.tasks.length} tasks</span>
        </div>
        <ul className="divide-y divide-[#F3F2F6]">
          {plan.tasks.map((t) => (
            <li key={t.id} className="flex items-center gap-4 px-5 py-3.5">
              <span className="font-mono text-xs text-muted w-[54px] shrink-0">{t.minutes} MIN</span>
              <span className="flex-1 min-w-0">
                <span className="font-semibold">{t.title}</span>
                <span className="text-muted"> · {t.target} {t.unit}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <div className="flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={() => onStart(focus, intensity)}
          className="h-[52px] px-7 rounded-xl text-white text-[16px] font-bold shadow-[0_14px_30px_-14px_rgba(155,31,214,.7)]"
          style={{ background: GRAD }}
        >
          Start today's reps
        </button>
        <p className="text-sm text-muted max-w-[420px]">
          Targets are starting points to test, not promises. A lighter day still counts.
        </p>
      </div>
    </div>
  );
}

// --------------------------------------------------------------- Finish

function Finish({
  session, streak, before, uid, onSaved, onNew,
}: {
  session: SprintSession;
  streak: number;
  /** Reps from earlier sprints. Today's are added on top. */
  before: number;
  uid: string;
  onSaved: (record: SprintRecord) => void;
  onNew: () => void;
}) {
  const [replies, setReplies] = useState("");
  const [sales, setSales] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const mascotRef = useRef<HTMLDivElement>(null);
  const verdict = sprintVerdict(session);
  const results = resultsFrom(session, { replies: Number(replies), sales: Number(sales) });
  const allDone = tasksCompleted(session) === session.plan.tasks.length;

  useEffect(() => {
    if (allDone) burstConfetti(mascotRef.current);
  }, [allDone]);

  async function save() {
    setSaving(true);
    setSaveFailed(false);
    try {
      const record: SprintRecord = {
        date: session.date,
        minutes: session.plan.minutes,
        focus: session.plan.focus,
        intensity: session.plan.intensity,
        tasksCompleted: tasksCompleted(session),
        workPercent: workPercent(session),
        results,
      };
      await saveSprint(uid, record);
      setSaved(true);
      onSaved(record);
    } catch {
      setSaveFailed(true);
    } finally {
      setSaving(false);
    }
  }

  const allTime = before + repsOf(results);
  const tiles: [string, number][] = [
    ["Posts published", results.published],
    ["People messaged", results.contacted],
    ["Comments", results.comments],
    ["Follow-ups", results.followUps],
  ];

  return (
    <div className="max-w-[760px] flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-5">
        <div ref={mascotRef} className="shrink-0">
          <Mascot size={110} fit={1.05} centered bubble={false} glow={false} restless={false} mood={allDone ? "happy" : "idle"} label={AGENT_NAME} style={{ margin: -6 }} />
        </div>
        <div>
          <div className="font-mono text-xs uppercase tracking-[.08em] text-muted">Daily Reps · {minutesSpent(session, Date.now())} min</div>
          <h1 className="font-serif text-[34px] sm:text-[42px] leading-[1.05] font-medium tracking-tight mt-1.5">{verdict.title}</h1>
          <p className="text-[16px] text-muted mt-2">{verdict.sub}</p>
        </div>
      </div>

      <section aria-label="What you did" className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {tiles.map(([label, n]) => (
          <div key={label} className="px-4 py-4 rounded-2xl border border-[#ECEAF0]">
            <div className="text-[32px] font-semibold tabular-nums leading-none">{n}</div>
            <div className="text-sm text-muted mt-1.5">{label}</div>
          </div>
        ))}
      </section>

      <p className="text-sm text-muted -mt-2">
        {allTime.toLocaleString()} {allTime === 1 ? "rep" : "reps"} all time. Today&apos;s sprint resets tomorrow. Your total doesn&apos;t.
      </p>

      <section aria-label="What came back" className="border border-[#ECEAF0] rounded-[22px] px-5 py-5">
        <h2 className="text-[16px] font-semibold">What came back so far?</h2>
        <p className="text-sm text-muted mt-1">Optional. Fill it in now or come back later. Zero is a fine answer.</p>
        <div className="grid grid-cols-2 gap-3 mt-4 max-w-[420px]">
          <label className="text-sm font-semibold">
            Positive replies
            <input inputMode="numeric" value={replies} onChange={(e) => setReplies(e.target.value.replace(/\D/g, ""))} placeholder="0" className="mt-1.5 w-full h-12 px-3.5 rounded-xl border border-[#D4D1DB] text-[16px] font-normal" />
          </label>
          <label className="text-sm font-semibold">
            Sales
            <input inputMode="numeric" value={sales} onChange={(e) => setSales(e.target.value.replace(/\D/g, ""))} placeholder="0" className="mt-1.5 w-full h-12 px-3.5 rounded-xl border border-[#D4D1DB] text-[16px] font-normal" />
          </label>
        </div>
        <p className="text-xs text-muted mt-3">Zero sales doesn&apos;t mean it failed. The point is steady effort and learning what works.</p>
      </section>

      <section aria-label="Tomorrow" className="px-5 py-4 rounded-[20px] bg-[#F4EEFE] text-[15px]">
        <span className="font-semibold">Before you go:</span> pick tomorrow&apos;s content idea and add a few people to your list. It makes the next sprint start fast.
      </section>

      <div className="flex flex-wrap items-center gap-4">
        {!saved ? (
          <button type="button" onClick={save} disabled={saving} className="h-[52px] px-7 rounded-xl text-white text-[16px] font-bold disabled:opacity-60" style={{ background: GRAD }}>
            {saving ? "Saving..." : "Save my results"}
          </button>
        ) : (
          <div role="status" className="inline-flex items-center gap-2 h-[52px] px-5 rounded-xl bg-[#DCFCE7] text-[#166534] font-semibold">
            Saved. {streak > 0 ? `${streak} ${streak === 1 ? "day" : "days"} in a row.` : ""}
          </div>
        )}
        <button type="button" onClick={onNew} className="h-[52px] px-5 rounded-xl border border-[#D4D1DB] text-[16px] font-semibold hover:bg-[#FAFAFA]">
          {saved ? "Back to Daily Reps" : "Skip and start over"}
        </button>
      </div>
      {saveFailed && (
        <p role="alert" className="text-sm text-[#B42318]">
          Couldn&apos;t save just now. Check your connection and try again. Your numbers are still here.
        </p>
      )}
    </div>
  );
}
