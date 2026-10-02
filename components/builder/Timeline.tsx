"use client";

import { ScheduledStep } from "@/lib/engine/buildTimeline";

export interface UIStep extends ScheduledStep {
  copy?: Record<string, string>;
}

interface TimelineProps {
  steps: UIStep[];
  selectedId: string;
  onSelect: (templateStepId: string) => void;
  eventDate: Date;
}

const LANES = [
  { key: "ad", label: "Facebook ads", fg: "#1B6B4F", bg: "#DFF0E8" },
  { key: "email", label: "Email", fg: "#1F5FA6", bg: "#E4EDF8" },
  { key: "sms", label: "Texts", fg: "#6B4FA3", bg: "#ECE7F5" },
] as const;

// The day-by-day, 3-lane campaign timeline — a simplified, React-friendly
// version of the absolute-grid layout in Builder.dc.html. Each day is its
// own row; each lane is a column within that row. Faithful to the look
// (white cards, colored lane badges, orange "live" banner) without
// replicating the mockup's manual row-height math.
export function Timeline({ steps, selectedId, onSelect, eventDate }: TimelineProps) {
  const days = groupByCalendarDay(steps, eventDate);
  const needsCount = steps.filter((s) => needsInput(s)).length;

  return (
    <section aria-label="Campaign timeline" className="flex-grow min-w-0 p-6 flex flex-col gap-4 overflow-y-auto">
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="font-display text-[22px] font-semibold tracking-tight">Campaign timeline</h2>
          <div className="text-[13px] text-muted">
            {steps.length} steps with suggested send times.
          </div>
        </div>
        {needsCount > 0 && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#FCEFC7] text-[#7A4B00] text-xs font-semibold whitespace-nowrap">
            {needsCount} steps need your input
          </span>
        )}
      </div>

      <div className="grid grid-cols-[72px_repeat(3,minmax(0,1fr))] items-center">
        <div />
        {LANES.map((lane) => {
          const count = steps.filter((s) => s.channel === lane.key).length;
          return (
            <div key={lane.key} className="flex items-center gap-2 px-2">
              <span
                className="w-7 h-7 rounded-lg flex items-center justify-center"
                style={{ background: lane.bg }}
              >
                <LaneIcon channel={lane.key} color={lane.fg} />
              </span>
              <span className="text-sm font-semibold">{lane.label}</span>
              <span className="font-mono text-xs text-faint">{count}</span>
            </div>
          );
        })}
      </div>

      <div className="flex flex-col gap-3">
        {days.map(({ day, label, steps: dayStepsAll, isEventDay }) => (
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
              <span className="flex-grow h-px bg-[rgba(28,27,24,0.14)]" />
            </div>
            <div className="grid grid-cols-[72px_repeat(3,minmax(0,1fr))] gap-2">
              <div />
              {LANES.map((lane) => (
                <div key={lane.key} className="flex flex-col gap-2">
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
              ))}
            </div>
          </div>
        ))}
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
  const firstField = step.fields[0];
  const preview = step.copy?.[firstField?.key ?? ""] ?? "Not written yet";

  return (
    <button
      onClick={onSelect}
      aria-pressed={selected}
      className="w-full text-left bg-white border border-[#DDD6C5] rounded-xl px-3 py-2.5 flex flex-col gap-0.5"
      style={selected ? { boxShadow: `0 0 0 2px ${lane.fg}` } : undefined}
    >
      <span className="flex items-center gap-1.5">
        <LaneIcon channel={step.channel} color={lane.fg} />
        <span className="font-mono text-[11px] font-medium" style={{ color: lane.fg }}>
          {formatTime(step.scheduledAt)}
        </span>
        <span className="flex-grow" />
        {needsInput(step) && (
          <span className="px-1.5 py-0.5 rounded-full bg-[#FCEFC7] text-[#7A4B00] text-[11px] font-semibold">
            Add details
          </span>
        )}
      </span>
      <span className="text-[13px] font-semibold leading-snug">{step.title}</span>
      <span className="text-xs text-muted whitespace-nowrap overflow-hidden text-ellipsis">
        {preview}
      </span>
    </button>
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
