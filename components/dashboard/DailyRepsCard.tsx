"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { listSprints } from "@/lib/firebase/dailySprints";
import { todaysSession } from "@/lib/daily/session";
import { clock, dateKey, remainingMs, streakDays, totalReps, workPercent } from "@/lib/daily/sprint";

// The Daily Reps entry on Home. Three states: not started, started but not
// finished (the button says so), and done for today. Today's reps reset
// every day; the all-time total and the streak carry on.
export function DailyRepsCard() {
  const { user } = useAuth();
  const [streak, setStreak] = useState(0);
  const [total, setTotal] = useState(0);
  const [doneToday, setDoneToday] = useState(false);
  const [running, setRunning] = useState<{ left: number; pct: number } | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const today = dateKey(new Date());
    (async () => {
      // A sprint left over from yesterday is cleared here (and its work kept).
      const s = await todaysSession(user.uid, today, Date.now());
      if (cancelled) return;
      setRunning(s ? { left: remainingMs(s.endsAt, Date.now()), pct: workPercent(s) } : null);
      listSprints(user.uid)
        .then((r) => {
          if (cancelled) return;
          const dates = r.map((x) => x.date);
          setStreak(streakDays(dates, today));
          setTotal(totalReps(r));
          setDoneToday(dates.includes(today));
        })
        .catch(() => {});
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const unfinished = running !== null && !doneToday;
  const title = unfinished ? "Finish today's reps" : doneToday ? "Today's reps are done" : "Daily Reps";
  const sub = unfinished
    ? running.left > 0
      ? `${running.pct}% done · ${clock(running.left)} left. Pick up where you stopped.`
      : `${running.pct}% done. Your hour is up. Log what you did.`
    : doneToday
      ? "Nice work. Come back tomorrow to keep your streak going."
      : "One focused hour. Eos plans it. You get the reps in that bring customers.";
  const label = unfinished ? "Finish reps" : doneToday ? "See Daily Reps" : "Start today's reps";
  const eyebrow = [
    "1-hour growth sprint",
    streak > 0 ? `${streak} ${streak === 1 ? "day" : "days"} in a row` : "",
    total > 0 ? `${total.toLocaleString()} ${total === 1 ? "rep" : "reps"} all time` : "",
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <section
      aria-label="Daily Reps"
      className="relative overflow-hidden flex flex-wrap items-center gap-x-6 gap-y-4 px-5 sm:px-7 py-6 rounded-[24px] text-white"
      style={{ background: "linear-gradient(120deg,#2B157F 0%,#6D1FC4 55%,#C21A8E 100%)" }}
    >
      <div
        aria-hidden="true"
        className="absolute -right-10 -top-16 w-56 h-56 rounded-full opacity-30"
        style={{ background: "radial-gradient(circle,#ffffff 0%,transparent 70%)" }}
      />
      <div className="relative flex-[1_1_320px] min-w-0">
        <div className="font-mono text-[11px] uppercase tracking-[.1em] text-white/70">{eyebrow}</div>
        <h2 className="font-serif text-[26px] sm:text-[30px] leading-[1.1] font-medium tracking-tight mt-1.5">{title}</h2>
        <p className="text-[15px] text-white/80 mt-1.5 max-w-[520px]">{sub}</p>
      </div>
      <Link
        href="/daily"
        className={`group relative inline-flex items-center justify-center gap-2 h-12 px-6 rounded-xl bg-white text-[#2B157F] text-[15px] font-bold hover:bg-white/90 ${doneToday ? "" : "reps-nudge"}`}
      >
        {label}
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className="transition-transform group-hover:translate-x-0.5 reps-arrow"
        >
          <path d="M5 12h14M13 6l6 6-6 6" />
        </svg>
      </Link>
    </section>
  );
}
