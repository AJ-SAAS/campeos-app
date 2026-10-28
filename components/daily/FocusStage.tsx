"use client";

import { useEffect, useRef, useState } from "react";
import { burstConfetti } from "@/lib/confetti";
import { AGENT_NAME } from "@/lib/brand";
import {
  CHANNELS, SCENARIOS, channelTitle, clockMinSec, coachLine, doneCount, logLabel, remainingMs, subtasksFor,
  taskComplete, tasksCompleted, workPercent,
  type ChannelId, type SprintSession, type SprintTask, type Subtask,
} from "@/lib/daily/sprint";

// The Daily Reps work screen: a dark focus stage. A timer ring, the route of
// your four tasks, and ONE task at a time with a big progress ring and a
// playbook that shows only your next step. Nothing here changes the numbers;
// it only changes how doing the work feels.

const GRAD = "linear-gradient(90deg,#3B1FD1,#9B1FD6 55%,#E0109F)";
const SHORT: Record<string, string> = { content: "Create", prospect: "Reach out", engage: "Engage", followup: "Follow up" };

type Update = (fn: (s: SprintSession) => SprintSession) => void;

function useNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}

const Check = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </svg>
);

export function Work({
  session, offerName, update, onFinish,
}: {
  session: SprintSession;
  offerName: string;
  update: Update;
  onFinish: () => void;
}) {
  const now = useNow();
  const tasks = session.plan.tasks;
  const total = session.plan.minutes * 60_000;
  const left = remainingMs(session.endsAt, now);
  const over = left === 0;
  const pct = workPercent(session);
  const allDone = tasksCompleted(session) === tasks.length;
  const repsToday = tasks.reduce((n, t) => n + doneCount(session, t), 0);

  const [activeId, setActiveId] = useState(() => (tasks.find((t) => !taskComplete(session, t)) ?? tasks[0]).id);
  const active = tasks.find((t) => t.id === activeId) ?? tasks[0];
  const stageRef = useRef<HTMLDivElement>(null);
  const [cheer, setCheer] = useState<string | null>(null);

  // When a task becomes complete: a little celebration, then on to the next one.
  const seenDone = useRef<Set<string> | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => {
    const doneIds = new Set(tasks.filter((t) => taskComplete(session, t)).map((t) => t.id));
    if (seenDone.current === null) {
      seenDone.current = doneIds; // what was already done when the page opened
      return;
    }
    const fresh = tasks.find((t) => doneIds.has(t.id) && !seenDone.current!.has(t.id));
    seenDone.current = doneIds;
    if (!fresh) return;
    burstConfetti(stageRef.current);
    setCheer(`${fresh.title} done`);
    timers.current.push(setTimeout(() => setCheer(null), 2600));
    const next = tasks.find((t) => !doneIds.has(t.id) && t.id !== fresh.id);
    if (next && fresh.id === activeId) timers.current.push(setTimeout(() => setActiveId(next.id), 1500));
  }, [session, tasks, activeId]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  return (
    <div ref={stageRef} className="reps-stage relative overflow-hidden rounded-[32px] text-white max-w-[1000px]" style={{ background: "#0D0A1A" }}>
      {/* Slow-moving colour, so the stage feels alive. */}
      <div aria-hidden="true" className="reps-aurora absolute -top-32 -left-24 w-[460px] h-[460px] rounded-full" style={{ background: "radial-gradient(circle,rgba(124,58,237,.55),transparent 68%)" }} />
      <div aria-hidden="true" className="reps-aurora reps-aurora-b absolute -bottom-40 -right-20 w-[520px] h-[520px] rounded-full" style={{ background: "radial-gradient(circle,rgba(224,16,159,.38),transparent 68%)" }} />
      <div aria-hidden="true" className="absolute inset-x-0 top-0 h-[3px] bg-white/10">
        <div className="h-full transition-[width] duration-700 ease-out" style={{ width: `${pct}%`, background: GRAD }} />
      </div>

      <div className="relative flex flex-col gap-6 px-5 sm:px-8 pt-8 pb-6">
        {/* Header: what, how it's going, and the clock */}
        <header className="flex flex-wrap items-start justify-between gap-5">
          <div className="min-w-0 flex-[1_1_300px]">
            <div className="font-mono text-[11px] uppercase tracking-[.12em] text-white/55">
              Daily Reps · {new Date().toLocaleDateString(undefined, { weekday: "long" })}
            </div>
            <h1 className="font-serif text-[32px] sm:text-[40px] leading-[1.05] font-medium tracking-tight mt-2">
              {over ? "Time's up." : offerName ? `Let's grow ${offerName}.` : "Let's grow your business."}
            </h1>
            <p role="status" className="mt-3 inline-flex items-center gap-2 pl-2 pr-3.5 py-1.5 rounded-full bg-white/[.08] border border-white/10 text-[14px] text-white/85">
              <span aria-hidden="true" className="w-5 h-5 rounded-full flex items-center justify-center" style={{ background: GRAD }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="white"><path d="M13 2L4 14h6l-1 8 9-12h-6l1-8z" /></svg>
              </span>
              <span><span className="font-semibold text-white">{AGENT_NAME}:</span> {coachLine(pct, over)}</span>
            </p>
          </div>
          <TimerRing left={left} total={total} over={over} />
        </header>

        {/* The route */}
        <nav aria-label="Your four tasks" className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {tasks.map((t, i) => {
            const n = Math.min(doneCount(session, t), t.target);
            const done = taskComplete(session, t);
            const on = t.id === active.id;
            return (
              <button
                key={t.id}
                type="button"
                aria-current={on ? "step" : undefined}
                onClick={() => setActiveId(t.id)}
                className={`text-left rounded-2xl px-3.5 py-3 border transition-all ${on ? "bg-white/[.12] border-white/45 shadow-[0_0_0_4px_rgba(167,139,250,.14)]" : "bg-white/[.04] border-white/10 hover:bg-white/[.08]"}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[10px] uppercase tracking-[.1em] text-white/50">{String(i + 1).padStart(2, "0")}</span>
                  {done ? (
                    <span className="w-[18px] h-[18px] rounded-full bg-[#22C55E] text-white flex items-center justify-center"><Check size={11} /></span>
                  ) : (
                    <span className="font-mono text-[11px] tabular-nums text-white/60">{n}/{t.target}</span>
                  )}
                </div>
                <div className="text-[15px] font-semibold mt-1">{SHORT[t.kind]}</div>
                <div className="mt-2 h-1 rounded-full bg-white/10 overflow-hidden">
                  <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${(n / t.target) * 100}%`, background: done ? "#22C55E" : GRAD }} />
                </div>
              </button>
            );
          })}
        </nav>

        {cheer && (
          <div role="status" className="reps-cheer self-start inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#22C55E] text-white text-sm font-bold">
            <Check /> {cheer}
          </div>
        )}

        {/* One task at a time */}
        <section key={active.id} aria-label={active.title} className="reps-in grid grid-cols-1 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] gap-4">
          <CounterCard task={active} session={session} update={update} onNext={() => {
            const next = tasks.find((t) => !taskComplete(session, t) && t.id !== active.id);
            if (next) setActiveId(next.id);
          }} />
          <Playbook task={active} session={session} update={update} />
        </section>

        <footer className="flex flex-wrap items-center justify-between gap-4 pt-1">
          <div className="text-sm text-white/65">
            <span className="font-serif text-[28px] text-white font-medium tabular-nums align-middle mr-1.5">{repsToday}</span>
            {repsToday === 1 ? "rep" : "reps"} today
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-[13px] text-white/50 max-w-[260px] hidden sm:block">Nothing counts until you did it yourself.</span>
            <button
              type="button"
              onClick={onFinish}
              className={`h-12 px-6 rounded-xl text-[15px] font-bold ${allDone || over ? "text-white shadow-[0_14px_30px_-14px_rgba(224,16,159,.8)]" : "bg-white text-[#0D0A1A] hover:bg-white/90"}`}
              style={allDone || over ? { background: GRAD } : undefined}
            >
              Finish and log results →
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}

// ------------------------------------------------------------- Timer ring

function TimerRing({ left, total, over }: { left: number; total: number; over: boolean }) {
  const size = 112, r = 48, c = 2 * Math.PI * r;
  const remaining = Math.max(0, Math.min(1, left / total));
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="timer" aria-label="Time left">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <defs>
          <linearGradient id="reps-timer" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#A78BFA" />
            <stop offset="100%" stopColor="#F472B6" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,.1)" strokeWidth="7" />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke="url(#reps-timer)" strokeWidth="7" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - remaining)} style={{ transition: "stroke-dashoffset 1s linear" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="font-mono text-[22px] font-semibold tabular-nums leading-none">{over ? "0:00" : clockMinSec(left)}</div>
        <div className="font-mono text-[9px] uppercase tracking-[.14em] text-white/50 mt-1.5">{over ? "done" : "left"}</div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------ Counter card

function CounterCard({
  task, session, update, onNext,
}: {
  task: SprintTask;
  session: SprintSession;
  update: Update;
  onNext: () => void;
}) {
  const n = doneCount(session, task);
  const shown = Math.min(n, task.target);
  const complete = taskComplete(session, task);
  const size = 196, r = 82, c = 2 * Math.PI * r;
  const bump = (by: number) => update((s) => ({ ...s, counts: { ...s.counts, [task.id]: Math.max(0, (s.counts[task.id] ?? 0) + by) } }));
  const toggleChannel = (id: ChannelId) =>
    update((s) => {
      const has = s.channels.includes(id);
      if (has && s.channels.length === 1) return s;
      return { ...s, channels: has ? s.channels.filter((x) => x !== id) : [...s.channels, id] };
    });

  return (
    <div className="rounded-[26px] bg-white/[.06] border border-white/10 backdrop-blur-sm px-5 sm:px-6 py-6 flex flex-col items-center text-center">
      <div className="font-mono text-[11px] uppercase tracking-[.12em] text-white/50">{task.tag} · {task.minutes} MIN</div>
      <h2 className="font-serif text-[26px] font-medium tracking-tight mt-1.5">{task.title}</h2>

      <div className="relative mt-5" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
          <defs>
            <linearGradient id="reps-count" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor={complete ? "#4ADE80" : "#A78BFA"} />
              <stop offset="100%" stopColor={complete ? "#22C55E" : "#F472B6"} />
            </linearGradient>
          </defs>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,.09)" strokeWidth="12" />
          <circle
            cx={size / 2} cy={size / 2} r={r} fill="none" stroke="url(#reps-count)" strokeWidth="12" strokeLinecap="round"
            strokeDasharray={c} strokeDashoffset={c * (1 - shown / task.target)} style={{ transition: "stroke-dashoffset .6s cubic-bezier(.2,.7,.2,1)" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div key={shown} className="reps-pop font-serif text-[68px] leading-none font-medium tabular-nums">{shown}</div>
          <div className="text-sm text-white/60 mt-1.5">of {task.target}</div>
        </div>
      </div>
      <div className="text-[15px] text-white/75 mt-3">{task.unit}</div>

      {task.kind === "content" ? (
        <div className="mt-5 w-full">
          <p className="text-sm text-white/65">{task.blurb}</p>
          <div className="text-[13px] font-semibold mt-4 mb-2 text-white/85">Where will you publish?</div>
          <div className="flex flex-wrap justify-center gap-2">
            {CHANNELS.map((ch) => {
              const on = session.channels.includes(ch.id);
              return (
                <button
                  key={ch.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggleChannel(ch.id)}
                  className={`h-9 px-3.5 rounded-full text-[13px] font-semibold border transition-colors inline-flex items-center gap-1.5 ${on ? "bg-white text-[#0D0A1A] border-white" : "bg-white/[.06] border-white/20 text-white/80 hover:bg-white/10"}`}
                >
                  {on && <Check size={11} />}
                  {ch.title}
                </button>
              );
            })}
          </div>
          {session.channels.length < task.target && (
            <p className="text-xs text-white/50 mt-2.5">Pick {task.target} to hit the target, or aim lower today.</p>
          )}
        </div>
      ) : complete ? (
        <div className="mt-5 w-full flex flex-col items-center gap-3">
          <div className="inline-flex items-center gap-2 text-[#4ADE80] font-bold"><Check size={16} /> Task complete</div>
          <button type="button" onClick={onNext} className="h-12 px-6 rounded-xl bg-white text-[#0D0A1A] text-[15px] font-bold hover:bg-white/90">Next task →</button>
          <button type="button" onClick={() => bump(1)} className="text-sm text-white/55 hover:text-white">Log another</button>
        </div>
      ) : (
        <div className="mt-5 w-full flex items-center gap-2.5">
          <button
            type="button"
            aria-label={`Undo one: ${task.unit}`}
            onClick={() => bump(-1)}
            disabled={n === 0}
            className="w-12 h-14 rounded-2xl border border-white/20 bg-white/[.06] text-xl text-white/80 hover:bg-white/10 disabled:opacity-30"
          >
            −
          </button>
          <button
            type="button"
            onClick={() => bump(1)}
            className="reps-log flex-1 h-14 rounded-2xl text-[16px] font-bold text-white inline-flex items-center justify-center gap-2.5 active:scale-[.97] transition-transform shadow-[0_16px_34px_-14px_rgba(224,16,159,.8)]"
            style={{ background: GRAD }}
          >
            <span aria-hidden="true" className="text-[22px] leading-none">+1</span>
            {logLabel(task.kind)}
          </button>
        </div>
      )}
      <p className="text-xs text-white/45 mt-4">Done means: {task.done}</p>
    </div>
  );
}

// ---------------------------------------------------------------- Playbook

function Playbook({ task, session, update }: { task: SprintTask; session: SprintSession; update: Update }) {
  const channels = session.channels;
  const [tab, setTab] = useState<ChannelId>(channels[0]);
  const activeTab = channels.includes(tab) ? tab : channels[0];
  const steps = task.kind === "content" ? subtasksFor("content", [activeTab]) : subtasksFor(task.kind);
  const keyOf = (s: Subtask) => (task.kind === "content" ? s.id : `${task.id}:${s.id}`);
  const toggle = (s: Subtask) => update((x) => ({ ...x, steps: { ...x.steps, [keyOf(s)]: !x.steps[keyOf(s)] } }));
  const doneSteps = steps.filter((s) => session.steps[keyOf(s)]).length;
  const [open, setOpen] = useState<string | null>(null);
  const current = steps.findIndex((s) => !session.steps[keyOf(s)]);

  return (
    <div className="rounded-[26px] bg-white/[.06] border border-white/10 backdrop-blur-sm px-5 sm:px-6 py-6">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-mono text-[11px] uppercase tracking-[.12em] text-white/50">Playbook</h3>
        <span className="font-mono text-[11px] text-white/50 tabular-nums">{doneSteps}/{steps.length} steps</span>
      </div>

      {task.kind === "content" && channels.length > 1 && (
        <div role="tablist" aria-label="Platform" className="flex flex-wrap gap-1.5 mt-3.5">
          {channels.map((c) => (
            <button
              key={c}
              role="tab"
              aria-selected={c === activeTab}
              onClick={() => setTab(c)}
              className={`h-8 px-3 rounded-full text-[13px] font-semibold ${c === activeTab ? "bg-white/[.16] text-white" : "text-white/55 hover:text-white"}`}
            >
              {channelTitle(c)}
            </button>
          ))}
        </div>
      )}
      {task.kind === "content" && channels.length === 1 && <div className="mt-3 text-[15px] font-semibold">{channelTitle(channels[0])}</div>}

      <ol className="mt-4 flex flex-col">
        {steps.map((s, i) => {
          const done = !!session.steps[keyOf(s)];
          const isCurrent = i === current;
          const expanded = isCurrent || open === s.id;
          return (
            <li key={s.id} className="relative pl-9 pb-3.5 last:pb-0">
              {i < steps.length - 1 && <span aria-hidden="true" className="absolute left-[11px] top-7 bottom-0 w-px bg-white/15" />}
              <button
                type="button"
                role="checkbox"
                aria-checked={done}
                aria-label={`${done ? "Undo" : "Mark done"}: ${s.title}`}
                onClick={() => toggle(s)}
                className={`absolute left-0 top-0.5 w-[23px] h-[23px] rounded-full flex items-center justify-center border-2 transition-colors ${done ? "bg-[#22C55E] border-[#22C55E] text-white" : isCurrent ? "border-[#C4B5FD] reps-ring-now" : "border-white/25 hover:border-white/50"}`}
              >
                {done && <Check size={12} />}
              </button>
              <button
                type="button"
                onClick={() => setOpen(open === s.id ? null : s.id)}
                aria-expanded={expanded}
                className="w-full text-left flex items-baseline justify-between gap-3"
              >
                <span className={`text-[15px] ${done ? "line-through text-white/40" : isCurrent ? "font-bold text-white" : "font-medium text-white/75"}`}>{s.title}</span>
                <span className="font-mono text-[11px] text-white/40 shrink-0">{s.minutes} min</span>
              </button>
              {expanded && (
                <div className="mt-1.5">
                  <p className="text-sm leading-relaxed text-white/65">{s.how}</p>
                  {isCurrent && (
                    <button
                      type="button"
                      onClick={() => toggle(s)}
                      className="mt-3 h-10 px-4 rounded-xl bg-white text-[#0D0A1A] text-sm font-bold hover:bg-white/90"
                    >
                      {i === steps.length - 1 ? (task.kind === "content" ? "I published it" : "Done") : "Done, next step"} →
                    </button>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ol>

      {task.kind === "followup" && <Scenarios />}
    </div>
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
    <div className="mt-5 pt-5 border-t border-white/10">
      <div className="text-[13px] font-semibold text-white/85 mb-2.5">Who are you following up with?</div>
      <div className="flex flex-wrap gap-1.5 mb-3.5">
        {SCENARIOS.map((s) => (
          <button
            key={s.id}
            type="button"
            aria-pressed={s.id === id}
            onClick={() => setId(s.id)}
            className={`h-8 px-3 rounded-full border text-[12.5px] font-semibold ${s.id === id ? "bg-white text-[#0D0A1A] border-white" : "border-white/20 text-white/75 hover:bg-white/10"}`}
          >
            {s.label}
          </button>
        ))}
      </div>
      <div className="text-[13px] text-white/60"><span className="font-semibold text-white/85">Goal:</span> {sc.goal}</div>
      <blockquote className="mt-2.5 px-4 py-3.5 rounded-2xl bg-white/[.08] border border-white/10 text-[15px] leading-relaxed text-white/90">{sc.message}</blockquote>
      <p className="text-[13px] text-white/55 mt-2.5">{sc.guidance}</p>
      <div className="flex flex-wrap items-center gap-3 mt-3">
        <button type="button" onClick={copy} className="h-9 px-3.5 rounded-lg bg-white/10 border border-white/20 text-sm font-semibold hover:bg-white/15">
          {copied ? "Copied" : "Copy message"}
        </button>
        <span className="text-xs text-white/45">A starting point. Change the name and one detail so it sounds like you.</span>
      </div>
    </div>
  );
}
