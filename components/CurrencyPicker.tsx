"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CURRENCIES, POPULAR_CURRENCIES, findCurrency, type Currency } from "@/lib/onboarding/answers";

// A currency picker in the style of Wise and Revolut: a round flag and the
// code on the button, then a searchable list with the popular ones first.
// `value` and `onChange` use the currency's symbol ("$", "CA$", "SEK"),
// the same thing that goes in front of the price.

// Extra words people type when they look for a currency.
const ALSO: Record<string, string> = {
  USD: "us usa america united states dollar",
  EUR: "europe european union",
  GBP: "uk united kingdom britain england scotland wales sterling",
  CAD: "canada",
  AUD: "australia aussie",
  NZD: "new zealand kiwi",
  INR: "india",
  ZAR: "south africa",
  CHF: "switzerland swiss",
  SEK: "sweden",
  NOK: "norway",
  DKK: "denmark",
  PLN: "poland",
  CZK: "czech czechia",
  AED: "uae emirates dubai",
  SAR: "saudi arabia",
  ILS: "israel",
  SGD: "singapore",
  HKD: "hong kong",
  JPY: "japan",
  KRW: "korea",
  CNY: "china rmb",
  MXN: "mexico",
  BRL: "brazil",
  TRY: "turkey",
};

export function CurrencyPicker({
  value,
  onChange,
  className = "",
}: {
  value: string;
  onChange: (symbol: string) => void;
  className?: string;
}) {
  const current = findCurrency(value) ?? CURRENCIES[0];
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const { rows, popularCount } = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (term) {
      const hits = CURRENCIES.filter((c) =>
        `${c.code} ${c.name} ${c.symbol} ${ALSO[c.code] ?? ""}`.toLowerCase().includes(term)
      );
      return { rows: hits, popularCount: 0 };
    }
    const popular = POPULAR_CURRENCIES.map((s) => CURRENCIES.find((c) => c.symbol === s)!).filter(Boolean);
    const rest = CURRENCIES.filter((c) => !POPULAR_CURRENCIES.includes(c.symbol)).sort((a, b) => a.code.localeCompare(b.code));
    return { rows: [...popular, ...rest], popularCount: popular.length };
  }, [q]);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent | TouchEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
    };
  }, [open]);

  useEffect(() => {
    if (open) {
      const i = rows.findIndex((c) => c.symbol === current.symbol);
      setActive(Math.max(0, i));
      // Focus the search box once the panel exists.
      setTimeout(() => searchRef.current?.focus(), 0);
    } else {
      setQ("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => setActive(0), [q]);

  useEffect(() => {
    if (!open) return;
    const el = listRef.current?.querySelector<HTMLElement>(`[data-i="${active}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  function pick(c: Currency) {
    onChange(c.symbol);
    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(rows.length - 1, a + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (rows[active]) pick(rows[active]);
    }
  }

  return (
    <div ref={rootRef} className="relative" onKeyDown={onKeyDown}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Currency: ${current.code}. Change`}
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-2 w-full text-left cursor-pointer ${className}`}
      >
        <Flag c={current} size={22} />
        <span className="font-semibold tracking-tight">{current.code}</span>
        <svg className="ml-auto shrink-0" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8A8494" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 top-[calc(100%+8px)] z-50 w-[min(320px,calc(100vw-48px))] rounded-2xl border border-line bg-paper shadow-[0_30px_60px_-24px_rgba(23,19,31,.45)] overflow-hidden">
          <div className="p-2.5 border-b border-line">
            <div className="flex items-center gap-2 h-10 px-3 rounded-xl bg-ivory">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8A8494" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="11" cy="11" r="7" />
                <path d="M20 20l-3.5-3.5" />
              </svg>
              <input
                ref={searchRef}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search currency or country"
                aria-label="Search currency or country"
                className="flex-1 min-w-0 bg-transparent text-[15px]"
                style={{ outline: "none", boxShadow: "none", border: 0, minHeight: 0, padding: 0 }}
              />
            </div>
          </div>

          <div ref={listRef} role="listbox" aria-label="Currencies" className="max-h-[300px] overflow-y-auto py-1.5">
            {rows.length === 0 && <div className="px-4 py-6 text-sm text-muted text-center">No match. Try the country or the code.</div>}
            {rows.map((c, i) => {
              const selected = c.symbol === current.symbol;
              return (
                <div key={c.symbol}>
                  {popularCount > 0 && i === 0 && <div className="px-4 pt-1.5 pb-1 text-[11px] font-semibold uppercase tracking-wider text-faint">Popular</div>}
                  {popularCount > 0 && i === popularCount && <div className="px-4 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-faint">All currencies</div>}
                  <div
                    role="option"
                    aria-selected={selected}
                    data-i={i}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => pick(c)}
                    className={`flex items-center gap-3 mx-1.5 px-2.5 py-2 rounded-xl cursor-pointer ${i === active ? "bg-ivory" : ""}`}
                  >
                    <Flag c={c} size={30} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[15px] font-semibold leading-tight">{c.code}</span>
                      <span className="block text-[13px] text-muted leading-tight mt-0.5 truncate">{c.name}</span>
                    </span>
                    <span className="text-[14px] text-muted shrink-0">{c.symbol}</span>
                    {selected && (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#17131F" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M5 12l5 5 9-10" />
                      </svg>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function Flag({ c, size }: { c: Currency; size: number }) {
  return (
    <img
      src={`/flags/${c.cc}.svg`}
      alt=""
      width={size}
      height={size}
      className="shrink-0 rounded-full object-cover border border-black/10"
      style={{ width: size, height: size }}
    />
  );
}
