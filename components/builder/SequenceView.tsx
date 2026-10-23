"use client";

import { MergeText } from "@/components/MergeText";
import { useMemo, useState } from "react";
import { CampaignPhase, Channel } from "@/lib/templates/types";
import { UIStep } from "@/components/builder/Timeline";
import { missingDetailsLabel, needsInput } from "@/lib/dashboard";
import { channelInfo, LogoStack, PlatformLogo } from "@/components/builder/channels";
import { ADDABLE_CHANNELS } from "@/lib/engine/customStep";

// The campaign as a sequence (approved "Campaign builder" design): read
// top to bottom in chapters (the template's phases), one line per day on
// a timeline. A day with one message shows that message; a busy day
// collapses to one row ("3 of 4 messages", stacked logos) that opens.
// Every message has an on/off switch to leave it out.

export type StepStatus = "Ready" | "Needs input" | "Not written" | "Writing" | "Locked" | "Left out";

export interface SequenceProps {
  steps: UIStep[];
  phases: CampaignPhase[];
  eventDate: Date;
  selectedId: string;
  onSelect: (id: string) => void;
  isOn: (s: UIStep) => boolean;
  onToggleStep: (id: string) => void;
  lockedIds?: Set<string>;
  generating: boolean;
  userPlatforms: string[];
  /** How many pictures each message has, by templateStepId. */
  imageCounts?: Record<string, number>;
  /** Adds a blank user-made post for this one channel, outside the
   * template's own plan (see lib/engine/customStep.ts). Omit the prop to
   * hide the "+ Add a post" button entirely. */
  onAddStep?: (channel: Channel) => void;
}

export function statusOf(s: UIStep, on: boolean, locked: boolean, generating: boolean): StepStatus {
  if (!on) return "Left out";
  if (s.copy) return needsInput(s.copy) ? "Needs input" : "Ready";
  if (locked) return "Locked";
  return generating ? "Writing" : "Not written";
}

const STATUS_STYLE: Record<StepStatus, { pill: string; dot: string }> = {
  Ready: { pill: "bg-[#DCFCE7] text-[#166534]", dot: "#22C55E" },
  "Needs input": { pill: "bg-[#FFEDD5] text-[#9A3412]", dot: "#F59E0B" },
  "Not written": { pill: "bg-[#F2F1F5] text-muted", dot: "#C9C4D2" },
  Writing: { pill: "bg-[#F3EEFF] text-[#5B21B6]", dot: "#9B1FD6" },
  Locked: { pill: "bg-[#F2F1F5] text-muted", dot: "#C9C4D2" },
  "Left out": { pill: "bg-[#F2F1F5] text-muted", dot: "#E3E1E8" },
};

const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
const dayLabel = (d: Date) => `${d.toLocaleDateString(undefined, { weekday: "short" })} ${d.getDate()}`;
const timeLabel = (d: Date) => d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

export function SequenceView(props: SequenceProps) {
  const { steps, phases, eventDate, selectedId, onAddStep, userPlatforms } = props;
  const [openDays, setOpenDays] = useState<Record<string, boolean>>({});

  // phase -> ordered day groups. The webinar itself goes after the last
  // message sent before it starts.
  const grouped = useMemo(() => {
    const sorted = [...steps].sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime());
    const liveAfter = [...sorted].reverse().find((s) => s.scheduledAt.getTime() <= eventDate.getTime());
    const order = phases.map((p) => p.id);
    const byPhase = new Map<string, UIStep[]>();
    for (const s of sorted) {
      // A step whose phase isn't in this template (older saved
      // campaigns) goes in the last chapter rather than disappearing.
      const pid = order.find((id) => phases.find((p) => p.id === id)?.name === s.phaseName) ?? order[order.length - 1];
      byPhase.set(pid, [...(byPhase.get(pid) ?? []), s]);
    }
    return phases
      .map((p, i) => {
        const list = byPhase.get(p.id) ?? [];
        const days: { key: string; date: Date; items: UIStep[] }[] = [];
        for (const s of list) {
          const k = dayKey(s.scheduledAt);
          const last = days[days.length - 1];
          if (last && last.key === k) last.items.push(s);
          else days.push({ key: k, date: s.scheduledAt, items: [s] });
        }
        const liveIndex = liveAfter ? days.findIndex((d) => d.items.some((s) => s.templateStepId === liveAfter.templateStepId)) : -1;
        return { phase: p, num: String(i + 1).padStart(2, "0"), days, liveIndex };
      })
      .filter((g) => g.days.length > 0);
  }, [steps, phases, eventDate]);

  return (
    <div className="flex flex-col gap-6">
      {grouped.map((g) => (
        <section key={g.phase.id} aria-label={g.phase.name}>
          <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5 mb-3">
            <span className="font-mono text-[11px] tracking-[.1em] font-semibold text-[#6D28D9]">{g.num}</span>
            <span className="text-base font-semibold">{g.phase.name}</span>
            <span className="text-[13px] text-muted line-clamp-1">{shortObjective(g.phase.objective)}</span>
          </div>
          <div className="relative pl-[84px] sm:pl-[96px]">
            <span aria-hidden="true" className="absolute left-[62px] sm:left-[74px] top-1.5 bottom-1.5 w-0.5 rounded bg-[#ECEAF0]" />
            {g.days.map((d, i) => (
              <div key={d.key}>
                <DayRow
                  {...props}
                  date={d.date}
                  items={d.items}
                  open={openDays[d.key] ?? d.items.some((s) => s.templateStepId === selectedId)}
                  onToggleOpen={() =>
                    setOpenDays((o) => ({ ...o, [d.key]: !(o[d.key] ?? d.items.some((s) => s.templateStepId === selectedId)) }))
                  }
                />
                {i === g.liveIndex && (
                  <div
                    className="relative flex items-center gap-3 mb-2 px-3.5 py-2.5 rounded-[14px] text-white"
                    style={{ background: "linear-gradient(90deg,#3B1FD1,#9B1FD6 55%,#E0109F)" }}
                  >
                    <span className="font-mono text-xs font-semibold tracking-[.08em]">LIVE</span>
                    <span className="text-[15px] font-semibold">
                      Your webinar ·{" "}
                      {eventDate.toLocaleString(undefined, { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      ))}
      {onAddStep && <AddStepRow onAdd={onAddStep} userPlatforms={userPlatforms} />}
    </div>
  );
}

// A quiet "+ Add a post" pill at the end of the sequence. Click it to
// pick a channel, which adds a blank post for that channel to this
// campaign only and opens it straight in the editor (see
// app/builder/page.tsx's addCustomStep). Minimalist on purpose — this
// should look like a natural continuation of the list, not a feature
// calling attention to itself.
function AddStepRow({ onAdd, userPlatforms }: { onAdd: (channel: Channel) => void; userPlatforms: string[] }) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mt-1 inline-flex items-center gap-2 h-11 px-4 rounded-full border border-dashed border-[#D4D1DB] text-[14px] font-semibold text-muted hover:text-slate hover:border-slate transition-colors"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 5v14M5 12h14" />
        </svg>
        Add a post
      </button>
    );
  }

  return (
    <div className="mt-1 flex flex-wrap items-center gap-2 animate-step-in">
      <span className="text-[13px] text-muted mr-0.5">Add a</span>
      {ADDABLE_CHANNELS.map((ch) => {
        const info = channelInfo(ch, userPlatforms);
        return (
          <button
            key={ch}
            onClick={() => {
              onAdd(ch);
              setOpen(false);
            }}
            className="inline-flex items-center gap-2 h-10 pl-2 pr-3.5 rounded-full border border-line bg-paper text-sm font-semibold hover:border-slate"
          >
            {info.platforms.length > 1 ? (
              <LogoStack platforms={info.platforms.slice(0, 3)} size={14} />
            ) : (
              <PlatformLogo platform={info.platforms[0]} size={18} />
            )}
            {info.short}
          </button>
        );
      })}
      <button onClick={() => setOpen(false)} className="h-10 px-3 text-sm text-muted">
        Cancel
      </button>
    </div>
  );
}

function shortObjective(text: string): string {
  const first = text.split(/(?<=[.!?])\s/)[0] ?? text;
  return first.replace(/\s+[—-]\s+.*$/, "").replace(/\.$/, "");
}

function DayRow(
  props: SequenceProps & { date: Date; items: UIStep[]; open: boolean; onToggleOpen: () => void }
) {
  const { date, items, open, onToggleOpen, isOn, lockedIds, generating, selectedId, userPlatforms } = props;
  const statuses = items.map((s) => statusOf(s, isOn(s), !!lockedIds?.has(s.templateStepId), generating));
  const live = items.filter((s) => isOn(s));
  const needs = statuses.filter((st) => st === "Needs input").length;
  const dot =
    live.length === 0 ? "#E3E1E8" : needs > 0 ? "#F59E0B" : statuses.every((st) => st === "Ready" || st === "Left out") ? "#22C55E" : "#C9C4D2";
  const multi = items.length > 1;
  const hasSel = items.some((s) => s.templateStepId === selectedId);

  const rail = (
    <>
      <div className="absolute -left-[84px] sm:-left-[96px] top-3 w-[50px] sm:w-[58px] text-right">
        <div className="text-[13px] font-semibold whitespace-nowrap">{dayLabel(date)}</div>
        <div className="font-mono text-[11px] text-muted whitespace-nowrap">{multi ? `${items.length} msgs` : timeLabel(items[0].scheduledAt)}</div>
      </div>
      <span
        aria-hidden="true"
        className="absolute -left-[27px] top-[18px] w-3 h-3 rounded-full border-2 border-paper"
        style={{ background: dot, boxShadow: `0 0 0 1px ${dot}` }}
      />
    </>
  );

  if (!multi) {
    const s = items[0];
    return (
      <div className="relative mb-2">
        {rail}
        <StepCard {...props} step={s} status={statuses[0]} />
      </div>
    );
  }

  const platforms = Array.from(new Set(items.flatMap((s) => channelInfo(s.channel, userPlatforms).platforms))).slice(0, 4);
  return (
    <div className="relative mb-2">
      {rail}
      <div className={`rounded-2xl bg-paper overflow-hidden ${hasSel ? "border-[1.5px] border-slate" : "border border-[#ECEAF0]"}`}>
        <button onClick={onToggleOpen} aria-expanded={open} className="w-full flex items-center gap-3 px-3.5 py-3 text-left">
          <LogoStack platforms={platforms} size={18} />
          <span className="flex-grow min-w-0">
            <span className="flex items-center gap-2">
              <span className="text-[15px] font-semibold">
                {live.length === items.length ? `${items.length} posts` : `${live.length} of ${items.length} posts`}
              </span>
              {needs > 0 && (
                <span className="text-[11px] font-bold px-[7px] py-px rounded-full bg-[#FFEDD5] text-[#9A3412]">{needs} need input</span>
              )}
            </span>
            <span className="block text-[13px] text-muted truncate mt-px">{items.map((s) => s.title).join(" · ")}</span>
          </span>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6B6577" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={`shrink-0 transition-transform ${open ? "rotate-180" : ""}`}>
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
        {open && (
          <div className="border-t border-[#F0F0F0] p-1.5 bg-[#FCFCFD] grid gap-1 animate-step-in">
            {items.map((s, i) => (
              <CompactRow key={s.templateStepId} {...props} step={s} status={statuses[i]} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Toggle({ on, onClick, label, small }: { on: boolean; onClick: () => void; label: string; small?: boolean }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={on}
      aria-label={label}
      title={label}
      className={`relative shrink-0 rounded-full transition-colors ${small ? "w-10 h-6" : "w-11 h-[26px]"} ${on ? "bg-slate" : "bg-[#E3E1E8]"}`}
    >
      <span
        className={`absolute top-[3px] rounded-full bg-paper shadow-[0_1px_3px_rgba(23,19,31,.25)] transition-[left] ${small ? "w-[18px] h-[18px]" : "w-5 h-5"}`}
        style={{ left: on ? (small ? 19 : 21) : 3 }}
      />
    </button>
  );
}

function StepCard(props: SequenceProps & { step: UIStep; status: StepStatus }) {
  const { step: s, status, selectedId, onSelect, onToggleStep, isOn, userPlatforms } = props;
  const on = isOn(s);
  const info = channelInfo(s.channel, userPlatforms);
  const picked = s.templateStepId === selectedId;
  const firstKey = s.fields[0]?.key;
  const preview = s.copy ? (firstKey && s.copy[firstKey]) || Object.values(s.copy)[0] : s.purpose;
  return (
    <div
      className={`flex items-center gap-3 pl-3.5 pr-3 py-3 rounded-2xl bg-paper transition-opacity ${
        picked ? "border-[1.5px] border-slate shadow-[0_16px_32px_-22px_rgba(23,19,31,.45)]" : "border border-[#ECEAF0]"
      } ${on ? "" : "opacity-45"}`}
    >
      <button onClick={() => onSelect(s.templateStepId)} className="flex-grow min-w-0 flex items-center gap-3 text-left">
        <span className="shrink-0 w-[38px] h-[38px] rounded-[11px] bg-[#F8F8F8] border border-[#F0F0F0] flex items-center justify-center">
          <PlatformLogo platform={info.platforms[0]} size={22} />
        </span>
        <span className="min-w-0 flex-grow">
          <span className="flex items-center gap-2">
            <span className="text-xs text-muted font-medium">
              {info.name}
              {info.platforms.length > 1 ? ` · ${info.platforms.length} platforms` : ""}
            </span>
            <StatusPill status={status} />
            {!!props.imageCounts?.[s.templateStepId] && (
              <span title="Has pictures" className="inline-flex items-center gap-1 text-[11px] font-semibold text-muted">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="3" y="4" width="18" height="16" rx="3" />
                  <circle cx="9" cy="10" r="1.8" />
                  <path d="M21 16l-5-5-8 9" />
                </svg>
                {props.imageCounts[s.templateStepId] > 1 ? props.imageCounts[s.templateStepId] : ""}
              </span>
            )}
          </span>
          <span className="block text-[15px] font-semibold mt-px">{s.title}</span>
          {status === "Needs input" ? (
            <span className="block text-[13px] font-medium text-[#9A3412] truncate mt-px">{missingDetailsLabel(s.copy)}</span>
          ) : (
            <span className="block text-[13px] text-muted truncate mt-px"><MergeText text={preview ?? ""} /></span>
          )}
        </span>
      </button>
      <Toggle on={on} onClick={() => onToggleStep(s.templateStepId)} label={on ? "Leave this post out" : "Put this post back"} />
    </div>
  );
}

function CompactRow(props: SequenceProps & { step: UIStep; status: StepStatus }) {
  const { step: s, status, selectedId, onSelect, onToggleStep, isOn, userPlatforms } = props;
  const on = isOn(s);
  const info = channelInfo(s.channel, userPlatforms);
  const picked = s.templateStepId === selectedId;
  return (
    <div className={`flex items-center gap-3 pl-2.5 pr-2 py-2 rounded-xl ${picked ? "bg-paper border-[1.5px] border-slate" : "border-[1.5px] border-transparent"} ${on ? "" : "opacity-45"}`}>
      <button onClick={() => onSelect(s.templateStepId)} className="flex-grow min-w-0 flex items-center gap-3 text-left">
        <span className="shrink-0 w-[34px] h-[34px] rounded-[10px] bg-paper border border-[#F0F0F0] flex items-center justify-center">
          <PlatformLogo platform={info.platforms[0]} size={20} />
        </span>
        <span className="shrink-0 w-[64px] font-mono text-[11px] text-muted">{timeLabel(s.scheduledAt)}</span>
        <span className="min-w-0 flex-grow">
          <span className="block text-sm font-semibold truncate">{s.title}</span>
          <span className="block text-xs text-muted">{info.name}</span>
        </span>
        <StatusPill status={status} />
      </button>
      <Toggle small on={on} onClick={() => onToggleStep(s.templateStepId)} label={on ? "Leave this post out" : "Put this post back"} />
    </div>
  );
}

export function StatusPill({ status }: { status: StepStatus }) {
  return (
    <span className={`shrink-0 inline-flex items-center gap-1 text-[11px] font-bold px-[7px] py-px rounded-full ${STATUS_STYLE[status].pill}`}>
      {status === "Locked" && (
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="5" y="11" width="14" height="10" rx="2" />
          <path d="M8 11V7a4 4 0 0 1 8 0v4" />
        </svg>
      )}
      {status === "Writing" ? "Writing..." : status}
    </span>
  );
}
