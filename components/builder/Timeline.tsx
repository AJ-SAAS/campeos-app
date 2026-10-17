"use client";

import { useMemo, useState } from "react";
import { ScheduledStep } from "@/lib/engine/buildTimeline";
import { CampaignPhase } from "@/lib/templates/types";

export interface UIStep extends ScheduledStep {
  copy?: Record<string, string>;
}

interface TimelineProps {
  steps: UIStep[];
  selectedId: string;
  onSelect: (templateStepId: string) => void;
  eventDate: Date;
  /** The campaign's named stages, in order — renders as the "Campaign
   * strategy overview" above the timeline, so the big-picture plan is
   * visible before diving into any one step. See CampaignPhase. */
  phases: CampaignPhase[];
}

type ChannelKey = "ad" | "email" | "sms";

const LANES: { key: ChannelKey; label: string; fg: string; bg: string }[] = [
  { key: "ad", label: "Facebook ads", fg: "#1B6B4F", bg: "#DFF0E8" },
  { key: "email", label: "Email", fg: "#1F5FA6", bg: "#E4EDF8" },
  { key: "sms", label: "Texts", fg: "#6B4FA3", bg: "#ECE7F5" },
];

const ALL_CHANNELS: ChannelKey[] = ["ad", "email", "sms"];

// The day-by-day, 3-lane campaign timeline — a simplified, React-friendly
// version of the absolute-grid layout in Builder.dc.html. Each day is its
// own row; each lane is a column within that row. The lane header row
// doubles as a channel filter: "All" plus one toggle per channel. You can
// narrow to one or two channels at a time; toggling all three back on
// collapses back to "All" rather than sitting as three separately-lit
// pills. The remaining lane(s) animate to fill the freed-up width.
export function Timeline({ steps, selectedId, onSelect, eventDate, phases }: TimelineProps) {
  const [selectedChannels, setSelectedChannels] = useState<Set<ChannelKey>>(
    new Set(ALL_CHANNELS)
  );
  const [overviewOpen, setOverviewOpen] = useState(false);
  const isAllActive = selectedChannels.size === ALL_CHANNELS.length;
  const visibleLanes = useMemo(
    () => LANES.filter((lane) => isAllActive || selectedChannels.has(lane.key)),
    [isAllActive, selectedChannels]
  );

  function showAll() {
    setSelectedChannels(new Set(ALL_CHANNELS));
  }

  function toggleChannel(key: ChannelKey) {
    setSelectedChannels((prev) => {
      // From "All," clicking any single lane narrows straight down to it —
      // that's the main gesture ("click Facebook ads, see only Facebook ads").
      if (prev.size === ALL_CHANNELS.length) {
        return new Set([key]);
      }
      const next = new Set(prev);
      if (next.has(key)) {
        // Don't let the last visible lane disappear — leave at least one on.
        if (next.size > 1) next.delete(key);
      } else {
        next.add(key);
      }
      // Selecting all three by hand is the same as "All" — collapse to it.
      return next.size === ALL_CHANNELS.length ? new Set(ALL_CHANNELS) : next;
    });
  }

  const days = groupByCalendarDay(steps, eventDate);
  const needsCount = steps.filter((s) => needsInput(s)).length;

  return (
    <section aria-label="Campaign timeline" className="flex-grow min-w-0 w-full p-4 sm:p-6 pb-24 sm:pb-6 flex flex-col gap-4 overflow-y-auto">
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="font-display text-[20px] sm:text-[22px] font-semibold tracking-tight">Campaign timeline</h2>
          <div className="text-[13px] text-muted">
            {steps.length} steps with suggested send times.
          </div>
        </div>
        {needsCount > 0 && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-warnBg text-warnFg text-xs font-semibold whitespace-nowrap">
            {needsCount} need input
          </span>
        )}
      </div>

      {phases.length > 0 && (
        <div className="border border-line rounded-xl bg-ivory/60">
          <button
            onClick={() => setOverviewOpen((v) => !v)}
            aria-expanded={overviewOpen}
            className="w-full flex items-center justify-between gap-3 px-3.5 py-2.5 text-left"
          >
            <span className="flex items-center gap-2 text-sm font-semibold">
              <InfoIcon />
              Campaign strategy overview
            </span>
            <ChevronIcon open={overviewOpen} />
          </button>
          {overviewOpen && (
            <ol className="flex flex-col gap-2 px-3.5 pb-3.5">
              {phases.map((phase, i) => (
                <li key={phase.id} className="flex gap-2.5 text-[13px] leading-snug">
                  <span className="shrink-0 font-mono text-faint">{i + 1}.</span>
                  <span>
                    <span className="font-semibold">{phase.name}.</span>{" "}
                    <span className="text-muted">{phase.objective}</span>
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}

      <div className="flex items-center gap-2 overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
        <button
          onClick={showAll}
          aria-pressed={isAllActive}
          className={`shrink-0 inline-flex items-center h-9 px-3.5 rounded-full text-sm font-semibold transition-colors duration-200 ${
            isAllActive ? "bg-slate text-white" : "bg-paper border border-line text-muted"
          }`}
        >
          All
        </button>
        {LANES.map((lane) => {
          const active = !isAllActive && selectedChannels.has(lane.key);
          const count = steps.filter((s) => s.channel === lane.key).length;
          return (
            <button
              key={lane.key}
              onClick={() => toggleChannel(lane.key)}
              aria-pressed={active}
              className="shrink-0 inline-flex items-center gap-2 h-9 pl-2.5 pr-3.5 rounded-full border transition-colors duration-200"
              style={
                active
                  ? { background: lane.bg, borderColor: lane.fg, color: lane.fg }
                  : { background: "#FFFFFF", borderColor: "#E3E6E1", color: "#5B6560" }
              }
            >
              <span
                className="w-6 h-6 rounded-md flex items-center justify-center shrink-0"
                style={{ background: active ? "rgba(255,255,255,0.6)" : lane.bg }}
              >
                <LaneIcon channel={lane.key} color={lane.fg} />
              </span>
              <span className="text-sm font-semibold">{lane.label}</span>
              <span className="font-mono text-xs opacity-70">{count}</span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-col gap-3">
        {days.map(({ day, label, steps: dayStepsAll, isEventDay }) => {
          const dayHasVisibleStep = dayStepsAll.some((s) =>
            visibleLanes.some((lane) => lane.key === s.channel)
          );
          if (!dayHasVisibleStep) return null;

          return (
            <div key={day} className="flex flex-col gap-2">
              <div className="flex items-center gap-2.5">
                <span className="font-display text-[13px] font-bold uppercase tracking-wider">
                  {label}
                </span>
                {isEventDay && (
                  <span className="px-2.5 py-0.5 rounded-full bg-clay text-white text-xs font-semibold">
                    Live {formatTime(eventDate)}
                  </span>
                )}
                <span className="flex-grow h-px bg-line" />
              </div>
              {/* Scrolls horizontally rather than breaking layout when all
                  three lanes are visible on a narrow screen — each lane
                  keeps its 160px working width instead of being squeezed
                  unreadably thin. */}
              <div className="flex gap-2 items-start overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
                {LANES.map((lane) => {
                  const visible = isAllActive || selectedChannels.has(lane.key);
                  return (
                    <div
                      key={lane.key}
                      className="overflow-hidden transition-[flex-grow,opacity] duration-300 ease-out"
                      style={{
                        flex: visible ? "1 1 0%" : "0 0 0%",
                        opacity: visible ? 1 : 0,
                      }}
                    >
                      <div className="flex flex-col gap-2 min-w-[160px]">
                        {dayStepsAll
                          .filter((s) => s.channel === lane.key)
                          .map((s) => (
                            <StepCard
                              key={s.templateStepId}
                              step={s}
                              lane={lane}
                              selected={s.templateStepId === selectedId}
                              onSelect={() => onSelect(s.templateStepId)}
                            />
                          ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function StepCard({
  step,
  lane,
  selected,
  onSelect,
}: {
  step: UIStep;
  lane: (typeof LANES)[number];
  selected: boolean;
  onSelect: () => void;
}) {
  const [infoOpen, setInfoOpen] = useState(false);
  const firstField = step.fields[0];
  const preview = step.copy?.[firstField?.key ?? ""] ?? "Not written yet";

  return (
    <div
      className="w-full bg-paper border border-line rounded-xl overflow-hidden"
      style={selected ? { boxShadow: `0 0 0 2px ${lane.fg}` } : undefined}
    >
      <button onClick={onSelect} aria-pressed={selected} className="w-full text-left px-3 py-2.5 flex flex-col gap-0.5">
        <span className="flex items-center gap-1.5">
          <LaneIcon channel={step.channel} color={lane.fg} />
          <span className="font-mono text-[11px] font-medium" style={{ color: lane.fg }}>
            {formatTime(step.scheduledAt)}
          </span>
          <span className="flex-grow" />
          {needsInput(step) && (
            <span className="px-1.5 py-0.5 rounded-full bg-warnBg text-warnFg text-[11px] font-semibold">
              Add details
            </span>
          )}
          {/* Separate button, not a nested <button>, so this can sit
              inside the card's own select button without invalid HTML or
              triggering onSelect when tapped. */}
          <span
            role="button"
            tabIndex={0}
            aria-label="Why this step"
            aria-expanded={infoOpen}
            onClick={(e) => {
              e.stopPropagation();
              setInfoOpen((v) => !v);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.stopPropagation();
                e.preventDefault();
                setInfoOpen((v) => !v);
              }
            }}
            className={`shrink-0 w-5 h-5 rounded-full flex items-center justify-center ${
              infoOpen ? "bg-slate text-white" : "text-faint hover:bg-ivory"
            }`}
          >
            <InfoIcon />
          </span>
        </span>
        <span className="text-[13px] font-semibold leading-snug">{step.title}</span>
        <span className="text-xs text-muted whitespace-nowrap overflow-hidden text-ellipsis">
          {preview}
        </span>
      </button>
      {infoOpen && (
        <div className="flex flex-col gap-1.5 px-3 pb-3 pt-0.5 border-t border-line bg-ivory/50">
          {step.phaseName && (
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted">
              {step.phaseName}
            </span>
          )}
          <span className="inline-flex self-start px-2 py-0.5 rounded-full bg-slate text-ivory text-[11px] font-semibold">
            {step.angle}
          </span>
          <span className="text-[12px] leading-relaxed text-slate">{step.purpose}</span>
          {step.goals.length > 0 && (
            <ul className="flex flex-col gap-0.5 pl-0.5">
              {step.goals.map((g, i) => (
                <li key={i} className="text-[12px] leading-relaxed text-muted flex gap-1.5">
                  <span className="shrink-0">•</span>
                  <span>{g}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function LaneIcon({ channel, color }: { channel: string; color: string }) {
  if (channel === "email") {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 6 9-6" />
      </svg>
    );
  }
  if (channel === "sms") {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1.1-4.4A8 8 0 1 1 21 12z" />
      </svg>
    );
  }
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="4.5" /><circle cx="12" cy="12" r="1" />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" /><path d="M12 11v5" /><circle cx="12" cy="8" r="0.5" fill="currentColor" />
    </svg>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={`text-muted transition-transform duration-200 ${open ? "rotate-180" : ""}`}
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

function needsInput(step: UIStep): boolean {
  if (!step.copy) return false;
  const text = Object.values(step.copy).join(" ");
  return /\[(?!LINK\])[A-Z0-9 ]+\]/.test(text);
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function groupByCalendarDay(steps: UIStep[], eventDate: Date) {
  const map = new Map<string, UIStep[]>();
  for (const step of steps) {
    const key = step.scheduledAt.toDateString();
    const list = map.get(key);
    if (list) list.push(step);
    else map.set(key, [step]);
  }
  const eventKey = eventDate.toDateString();
  return Array.from(map.entries())
    .sort(([a], [b]) => new Date(a).getTime() - new Date(b).getTime())
    .map(([day, daySteps]) => ({
      day,
      label: new Date(day).toLocaleDateString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
      }),
      steps: daySteps,
      isEventDay: day === eventKey,
    }));
}
