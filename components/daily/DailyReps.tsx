"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Mascot } from "@/components/mascot/Mascot";
import { burstConfetti } from "@/lib/confetti";
import { AGENT_NAME } from "@/lib/brand";
import {
  CHANNELS, FOCUSES, INTENSITIES, SCENARIOS, SPRINT_MINUTES,
  buildSprint, channelTitle, clock, dateKey, defaultChannels, doneCount, minutesSpent, newSession,
  parseSession, remainingMs, resultsFrom, sprintVerdict, streakDays, subtasksFor, taskComplete,
  tasksCompleted, workPercent,
  type ChannelId, type FocusId, type IntensityId, type SprintSession, type SprintTask,
} from "@/lib/daily/sprint";
import { listSprints, saveSprint } from "@/lib/firebase/dailySprints";

// Daily Reps: pick your time, press start, and work through four guided
// tasks. Eos plans it; you do it. Three screens: start, work, finish.

const GRAD = "linear-gradient(90deg,#3B1FD1,#9B1FD6 55%,#E0109F)";
const storeKey = (uid: string) => `campeos:daily:${uid}`;

function readStore(uid: string): string | null {
  try {
    return localStorage.getItem(storeKey(uid));
  } catch {
    return null;
  }
}
function writeStore(uid: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(storeKey(uid));
    else localStorage.setItem(storeKey(uid), value);
  } catch {
    /* private window: the sprint still runs, it just won't survive a refresh */
  }
}

export function DailyReps({ uid, offerName, userChannels }: { uid: string; offerName: string; userChannels: string[] }) {
  const today = useMemo(() => dateKey(new Date()), []);
  const [session, setSession] = useState<SprintSession | null>(null);
  const [phase, setPhase] = useState<"start" | "work" | "done">("start");
  const [loaded, setLoaded] = useState(false);
  const [dates, setDates] = useState<string[]>([]);

  // Pick up a sprint that was running before a refresh.
  useEffect(() => {
    const saved = parseSession(readStore(uid), today, Date.now());
    if (saved) {
      setSession(saved);
      setPhase("work");
    }
    setLoaded(true);
    listSprints(uid).then((r) => setDates(r.map((x) => x.date))).catch(() => {});
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
        onSaved={(d) => {
          writeStore(uid, null);
          setDates((x) => (x.includes(d) ? x : [d, ...x]));
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
  streak, doneToday, userChannels, onStart,
}: {
  streak: number;
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
      <div className="flex flex-wrap items-center gap-5">
        <div className="shrink-0">
          <Mascot size={120} fit={1.05} centered bubble={false} glow={false} restless={false} mood="happy" label={AGENT_NAME} style={{ margin: -8 }} />
        </div>
        <div className="min-w-[240px] flex-1">
          <div className="font-mono text-xs uppercase tracking-[.08em] text-muted">Daily Reps</div>
          <h1 className="font-serif text-[34px] sm:text-[42px] leading-[1.05] font-medium tracking-tight mt-1.5">
            Your business grows when you do the work.
          </h1>
          <p className="text-[16px] text-muted mt-2">
            Pick your time. {AGENT_NAME} plans the hour and gets the guidance ready. You get the reps in.
          </p>
        </div>
      </div>

      {(streak > 0 || doneToday) && (
        <div className="self-start inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#F4EEFE] text-[#5B21B6] text-sm font-semibold">
          {doneToday ? "Today's sprint is done" : `${streak} ${streak === 1 ? "day" : "days"} in a row`}
          {doneToday && streak > 0 ? ` · ${streak} in a row` : ""}
        </div>
      )}

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

// ----------------------------------------------------------------- Work

function useNow(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [active]);
  return now;
}

function Work({
  session, offerName, update, onFinish,
}: {
  session: SprintSession;
  offerName: string;
  update: (fn: (s: SprintSession) => SprintSession) => void;
  onFinish: () => void;
}) {
  const now = useNow(true);
  const left = remainingMs(session.endsAt, now);
  const over = left === 0;
  const pct = workPercent(session);
  const done = tasksCompleted(session);
  const total = session.plan.tasks.length;
  const [open, setOpen] = useState<string>(session.plan.tasks[0].id);
  const weekday = new Date().toLocaleDateString(undefined, { weekday: "long" });
  const elapsed = Math.round(((session.plan.minutes * 60_000 - left) / (session.plan.minutes * 60_000)) * 100);

  return (
    <div className="max-w-[860px] flex flex-col gap-5">
      <section aria-label="Sprint status" className="rounded-[24px] border border-[#E9DDFB] overflow-hidden" style={{ background: "linear-gradient(135deg,#F7F2FE,#FDEFF7)" }}>
        <div className="flex flex-wrap items-center justify-between gap-4 px-5 sm:px-6 py-5">
          <div className="min-w-0">
            <div className="font-mono text-xs uppercase tracking-[.08em] text-[#5B21B6]">Daily Reps · {weekday}</div>
            <h1 className="font-serif text-[28px] sm:text-[34px] leading-[1.1] font-medium tracking-tight mt-1">
              {over ? "Time's up." : offerName ? `Let's grow ${offerName}.` : "Let's grow your business."}
            </h1>
            <p className="text-sm text-muted mt-1">
              {done} of {total} tasks done · {pct}% of the work
            </p>
          </div>
          <div className="text-right">
            <div className="font-mono text-[11px] uppercase tracking-[.08em] text-muted">{over ? "Finished" : "Time left"}</div>
            <div role="timer" aria-live="off" className="font-mono text-[40px] sm:text-[48px] leading-none font-semibold tabular-nums">
              {clock(left)}
            </div>
          </div>
        </div>
        <div className="px-5 sm:px-6 pb-5">
          <div className="relative h-2 rounded-full bg-white/80 overflow-hidden" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label="Work done">
            <div className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-700 ease-out" style={{ width: `${pct}%`, background: GRAD }} />
          </div>
          <div className="mt-1.5 flex justify-between text-xs text-muted">
            <span>Work done</span>
            <span>{elapsed}% of the hour used</span>
          </div>
        </div>
      </section>

      {over && (
        <div role="status" className="px-4 py-3 rounded-xl bg-[#FEF7E0] text-[#7A4B00] text-sm font-semibold">
          Your hour is up. Finish what you are on, then log your results.
        </div>
      )}

      <ol className="flex flex-col gap-3">
        {session.plan.tasks.map((t) => (
          <TaskCard
            key={t.id}
            task={t}
            session={session}
            open={open === t.id}
            onToggle={() => setOpen(open === t.id ? "" : t.id)}
            update={update}
          />
        ))}
      </ol>

      <div className="flex flex-wrap items-center gap-4 pt-1">
        <button
          type="button"
          onClick={onFinish}
          className="h-[52px] px-7 rounded-xl text-white text-[16px] font-bold"
          style={{ background: done === total ? GRAD : "#13171A" }}
        >
          {done === total ? "Finish sprint" : "Finish and log results"}
        </button>
        <p className="text-sm text-muted">Done early? Finish any time. Nothing counts until you did it yourself.</p>
      </div>
    </div>
  );
}

function TaskCard({
  task, session, open, onToggle, update,
}: {
  task: SprintTask;
  session: SprintSession;
  open: boolean;
  onToggle: () => void;
  update: (fn: (s: SprintSession) => SprintSession) => void;
}) {
  const n = doneCount(session, task);
  const complete = taskComplete(session, task);
  const steps = subtasksFor(task.kind, session.channels);
  const toggleStep = (id: string) => update((s) => ({ ...s, steps: { ...s.steps, [id]: !s.steps[id] } }));
  const bump = (by: number) =>
    update((s) => ({ ...s, counts: { ...s.counts, [task.id]: Math.max(0, (s.counts[task.id] ?? 0) + by) } }));
  const toggleChannel = (c: ChannelId) =>
    update((s) => {
      const has = s.channels.includes(c);
      if (has && s.channels.length === 1) return s;
      return { ...s, channels: has ? s.channels.filter((x) => x !== c) : [...s.channels, c] };
    });

  return (
    <li className={`rounded-[22px] border overflow-hidden transition-colors ${complete ? "border-[#BBF7D0] bg-[#F6FDF8]" : "border-[#ECEAF0] bg-white"}`}>
      <button type="button" onClick={onToggle} aria-expanded={open} className="w-full flex items-center gap-4 px-5 py-4 text-left">
        <span
          aria-hidden="true"
          className={`w-7 h-7 shrink-0 rounded-full flex items-center justify-center ${complete ? "bg-[#22C55E] text-white" : "border-2 border-[#D4D1DB]"}`}
        >
          {complete && (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
          )}
        </span>
        <span className="flex-1 min-w-0">
          <span className="block font-mono text-[11px] uppercase tracking-[.08em] text-muted">
            {task.tag} · {task.minutes} MIN
          </span>
          <span className="block text-[17px] font-semibold">{task.title}</span>
        </span>
        <span className="text-sm font-semibold tabular-nums text-[#5B21B6] shrink-0">
          {Math.min(n, task.target)} / {task.target}
        </span>
        <span aria-hidden="true" className={`text-muted transition-transform ${open ? "rotate-180" : ""}`}>⌄</span>
      </button>

      {open && (
        <div className="px-5 pb-5 flex flex-col gap-4 border-t border-[#F0EEF4] pt-4">
          <p className="text-[15px] text-muted">{task.blurb}</p>

          {task.kind === "content" && (
            <div>
              <div className="text-sm font-semibold mb-2">Where will you publish?</div>
              <div className="flex flex-wrap gap-2">
                {CHANNELS.map((c) => {
                  const on = session.channels.includes(c.id);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() => toggleChannel(c.id)}
                      className={`h-10 px-3.5 rounded-xl border text-sm font-semibold ${on ? "border-transparent shadow-[inset_0_0_0_2px_#13171A] bg-[#FAF9FC]" : "border-[#D4D1DB] hover:border-[#B9B3C7]"}`}
                    >
                      {c.title} <span className="font-normal text-muted">· {c.sub}</span>
                    </button>
                  );
                })}
              </div>
              {session.channels.length < task.target && (
                <p className="text-xs text-muted mt-2">
                  You picked {session.channels.length} of {task.target}. Pick more to hit the target, or aim lower today.
                </p>
              )}
            </div>
          )}

          {task.kind !== "content" && (
            <div className="flex items-center gap-3">
              <div className="inline-flex items-center rounded-xl border border-[#D4D1DB] overflow-hidden">
                <button type="button" aria-label={`One fewer ${task.unit}`} onClick={() => bump(-1)} className="w-11 h-11 text-xl hover:bg-[#FAFAFA]">−</button>
                <span className="w-14 text-center font-semibold tabular-nums" aria-live="polite">{n}</span>
                <button type="button" aria-label={`One more ${task.unit}`} onClick={() => bump(1)} className="w-11 h-11 text-xl hover:bg-[#FAFAFA]">+</button>
              </div>
              <span className="text-sm text-muted">{task.unit}</span>
            </div>
          )}

          <Steps task={task} steps={steps} session={session} onToggle={toggleStep} />

          {task.kind === "followup" && <Scenarios />}

          <p className="text-xs text-muted">Done means: {task.done}</p>
        </div>
      )}
    </li>
  );
}

function Steps({
  task, steps, session, onToggle,
}: {
  task: SprintTask;
  steps: ReturnType<typeof subtasksFor>;
  session: SprintSession;
  onToggle: (id: string) => void;
}) {
  if (task.kind === "content") {
    return (
      <div className="flex flex-col gap-4">
        {session.channels.map((c) => (
          <div key={c} className="rounded-2xl bg-[#FAFAFC] border border-[#F0EEF4] px-4 py-3.5">
            <div className="text-sm font-semibold mb-1">{channelTitle(c)} steps</div>
            <StepList steps={steps.filter((s) => s.id.startsWith(`${c}:`))} done={session.steps} onToggle={onToggle} />
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="rounded-2xl bg-[#FAFAFC] border border-[#F0EEF4] px-4 py-3.5">
      <div className="text-sm font-semibold mb-1">How to do it</div>
      <StepList steps={steps} done={session.steps} onToggle={(id) => onToggle(`${task.id}:${id}`)} prefix={`${task.id}:`} />
    </div>
  );
}

function StepList({
  steps, done, onToggle, prefix = "",
}: {
  steps: ReturnType<typeof subtasksFor>;
  done: Record<string, boolean>;
  onToggle: (id: string) => void;
  prefix?: string;
}) {
  return (
    <ul className="flex flex-col">
      {steps.map((s) => {
        const key = `${prefix}${s.id}`;
        const on = !!done[key];
        return (
          <li key={s.id} className="py-2">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={on}
                onChange={() => onToggle(s.id)}
                className="mt-1 w-[18px] h-[18px] accent-[#7C3AED] shrink-0"
              />
              <span className="min-w-0">
                <span className={`block text-[15px] font-semibold ${on ? "line-through text-muted" : ""}`}>
                  {s.title} <span className="font-mono text-[11px] font-normal text-muted">{s.minutes} min</span>
                </span>
                <span className="block text-sm text-muted mt-0.5">{s.how}</span>
              </span>
            </label>
          </li>
        );
      })}
    </ul>
  );
}

function Scenarios() {
  const [id, setId] = useState(SCENARIOS[0].id);
  const [copied, setCopied] = useState(false);
  const sc = SCENARIOS.find((s) => s.id === id) ?? SCENARIOS[0];
  async function copy() {
    try {
      await navigator.clipboard.writeText(sc.message);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* the text is on screen to select by hand */
    }
  }
  return (
    <div className="rounded-2xl border border-[#E9DDFB] bg-[#FBF8FF] px-4 py-4">
      <div className="text-sm font-semibold mb-2">Who are you following up with?</div>
      <div className="flex flex-wrap gap-2 mb-3">
        {SCENARIOS.map((s) => (
          <button
            key={s.id}
            type="button"
            aria-pressed={s.id === id}
            onClick={() => setId(s.id)}
            className={`h-9 px-3 rounded-full border text-[13px] font-semibold ${s.id === id ? "border-transparent bg-[#13171A] text-white" : "border-[#D4D1DB] bg-white hover:border-[#B9B3C7]"}`}
          >
            {s.label}
          </button>
        ))}
      </div>
      <div className="text-sm"><span className="font-semibold">Goal:</span> {sc.goal}</div>
      <blockquote className="mt-2 px-3.5 py-3 rounded-xl bg-white border border-[#ECEAF0] text-[15px] leading-relaxed">
        {sc.message}
      </blockquote>
      <p className="text-sm text-muted mt-2">{sc.guidance}</p>
      <div className="flex items-center gap-3 mt-3">
        <button type="button" onClick={copy} className="h-9 px-3.5 rounded-lg border border-[#D4D1DB] bg-white text-sm font-semibold hover:bg-[#FAFAFA]">
          {copied ? "Copied" : "Copy message"}
        </button>
        <span className="text-xs text-muted">A starting point. Change the name and one detail so it sounds like you.</span>
      </div>
    </div>
  );
}

// --------------------------------------------------------------- Finish

function Finish({
  session, streak, uid, onSaved, onNew,
}: {
  session: SprintSession;
  streak: number;
  uid: string;
  onSaved: (date: string) => void;
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
      await saveSprint(uid, {
        date: session.date,
        minutes: session.plan.minutes,
        focus: session.plan.focus,
        intensity: session.plan.intensity,
        tasksCompleted: tasksCompleted(session),
        workPercent: workPercent(session),
        results,
      });
      setSaved(true);
      onSaved(session.date);
    } catch {
      setSaveFailed(true);
    } finally {
      setSaving(false);
    }
  }

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
