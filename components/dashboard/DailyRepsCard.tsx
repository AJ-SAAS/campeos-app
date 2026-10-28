"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { listSprints } from "@/lib/firebase/dailySprints";
import { clock, dateKey, parseSession, remainingMs, streakDays } from "@/lib/daily/sprint";

// The Daily Reps entry on Home: start the one-hour sprint, or pick up the
// one that is already running.
export function DailyRepsCard() {
  const { user } = useAuth();
  const [streak, setStreak] = useState(0);
  const [doneToday, setDoneToday] = useState(false);
  const [leftMs, setLeftMs] = useState<number | null>(null);

  useEffect(() => {
    if (!user) return;
    const today = dateKey(new Date());
    try {
      const s = parseSession(localStorage.getItem(`campeos:daily:${user.uid}`), today, Date.now());
      setLeftMs(s ? remainingMs(s.endsAt, Date.now()) : null);
    } catch {
      /* no storage: just show the start card */
    }
    listSprints(user.uid)
      .then((r) => {
        const dates = r.map((x) => x.date);
        setStreak(streakDays(dates, today));
        setDoneToday(dates.includes(today));
      })
      .catch(() => {});
  }, [user]);

  const running = leftMs !== null;
  const title = running ? "Your reps are running" : doneToday ? "Today's reps are done" : "Daily Reps";
  const sub = running
    ? `${clock(leftMs ?? 0)} left. Pick up where you stopped.`
    : doneToday
      ? "Nice work. Come back tomorrow to keep your streak going."
      : "One focused hour. Eos plans it. You get the reps in that bring customers.";

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
        <div className="font-mono text-[11px] uppercase tracking-[.1em] text-white/70">
          1-hour growth sprint{streak > 0 ? ` · ${streak} ${streak === 1 ? "day" : "days"} in a row` : ""}
        </div>
        <h2 className="font-serif text-[26px] sm:text-[30px] leading-[1.1] font-medium tracking-tight mt-1.5">{title}</h2>
        <p className="text-[15px] text-white/80 mt-1.5 max-w-[520px]">{sub}</p>
      </div>
      <Link
        href="/daily"
        className="relative inline-flex items-center justify-center h-12 px-6 rounded-xl bg-white text-[#2B157F] text-[15px] font-bold hover:bg-white/90"
      >
        {running ? "Resume reps" : doneToday ? "See Daily Reps" : "Start today's reps"}
      </Link>
    </section>
  );
}
