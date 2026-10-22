"use client";

import { useEffect, useState } from "react";

interface PreflightProps {
  templateId: string;
  title: string;
  intro?: string;
  items: string[];
}

// A short "do this before you send" list for campaigns that need work
// outside Campeos (Audience Revival: clean the list, check the domain).
// Ticks are a per-person convenience, kept in the browser only.
export function Preflight({ templateId, title, intro, items }: PreflightProps) {
  const key = `preflight:${templateId}`;
  const [done, setDone] = useState<number[]>([]);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw) setDone(JSON.parse(raw));
    } catch {
      /* storage unavailable: the list still works */
    }
  }, [key]);

  function toggle(i: number) {
    setDone((prev) => {
      const next = prev.includes(i) ? prev.filter((n) => n !== i) : [...prev, i];
      try {
        window.localStorage.setItem(key, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  return (
    <div className="mb-5 border border-line rounded-xl bg-ivory/60">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-3 px-3.5 py-2.5 text-left"
      >
        <span className="text-sm font-semibold">{title}</span>
        <span className="font-mono text-[11px] text-faint">
          {done.length} of {items.length} done
        </span>
      </button>
      {open && (
        <div className="px-3.5 pb-3.5">
          {intro && <p className="text-[13px] text-muted leading-snug mb-2.5">{intro}</p>}
          <ul className="flex flex-col gap-2">
            {items.map((item, i) => (
              <li key={i}>
                <label className="flex gap-2.5 items-start text-[13px] leading-snug cursor-pointer">
                  <input
                    type="checkbox"
                    checked={done.includes(i)}
                    onChange={() => toggle(i)}
                    className="mt-0.5 w-4 h-4 shrink-0"
                  />
                  <span className={done.includes(i) ? "text-faint line-through" : ""}>{item}</span>
                </label>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
