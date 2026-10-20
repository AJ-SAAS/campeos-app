"use client";

import { useEffect, useState } from "react";
import { UIStep } from "@/components/builder/Timeline";
import { needsInput } from "@/lib/dashboard";
import { channelInfo, PlatformLogo } from "@/components/builder/channels";
import { StatusPill, StepStatus } from "@/components/builder/SequenceView";

// The right-hand panel of the builder: the selected message as the
// customer will see it (an email as an email, a text as a phone bubble,
// an ad or post as a feed card), with Copy, a warning for [PLACEHOLDERS],
// and a one-line way to ask the agent to change just this message.

export function StepPreview({
  step,
  status,
  fromName,
  userPlatforms,
  pending,
  onAsk,
  onEditByHand,
  onUnlock,
  onWrite,
  canWrite,
}: {
  step: UIStep | undefined;
  status: StepStatus;
  fromName: string;
  userPlatforms: string[];
  pending: boolean;
  onAsk: (instruction: string) => void;
  onEditByHand: () => void;
  onUnlock: () => void;
  onWrite: () => void;
  canWrite: boolean;
}) {
  const [ask, setAsk] = useState("");
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    setAsk("");
    setCopied(false);
  }, [step?.templateStepId]);

  if (!step) {
    return <div className="text-sm text-muted">Pick a message on the left to see it here.</div>;
  }

  const info = channelInfo(step.channel, userPlatforms);
  const copy = step.copy;
  const when = step.scheduledAt.toLocaleString(undefined, { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
  const initials = fromName.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("") || "Y";

  async function doCopy() {
    if (!copy) return;
    const text = step!.fields
      .map((f) => (copy[f.key] ? `${f.label}:\n${copy[f.key]}` : null))
      .filter(Boolean)
      .join("\n\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {}
  }

  function send(text: string) {
    const t = text.trim();
    if (!t || pending) return;
    onAsk(t);
    setAsk("");
  }

  const v = (key: string) => copy?.[key] ?? "";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[13px] text-muted">
            {info.name} · {when} <StatusPill status={status} />
          </div>
          <div className="text-[20px] font-semibold tracking-tight mt-0.5">{step.title}</div>
          {info.platforms.length > 1 && (
            <div className="flex items-center gap-1.5 mt-1.5 text-xs text-muted">
              Posting on
              {info.platforms.map((p) => (
                <PlatformLogo key={p} platform={p} size={16} />
              ))}
            </div>
          )}
        </div>
        {copy && (
          <button onClick={doCopy} className="shrink-0 h-[38px] px-3.5 rounded-[10px] border border-[#E3E1E8] bg-paper text-sm font-semibold hover:bg-[#FAFAFA]">
            {copied ? "Copied" : "Copy"}
          </button>
        )}
      </div>

      {!copy ? (
        <div className="rounded-[20px] border border-dashed border-[#D4D1DB] bg-paper p-6 flex flex-col gap-3">
          <div className="text-[15px] font-semibold">{status === "Locked" ? "This message is locked" : status === "Writing" ? "Writing this message..." : "Not written yet"}</div>
          <p className="text-sm text-muted leading-relaxed">{step.purpose}</p>
          {status === "Locked" ? (
            <button onClick={onUnlock} className="self-start h-10 px-4 rounded-xl text-white text-sm font-bold" style={{ background: "linear-gradient(90deg,#3B1FD1,#9B1FD6 55%,#E0109F)" }}>
              Unlock my launch
            </button>
          ) : status === "Not written" && canWrite ? (
            <button onClick={onWrite} className="self-start h-10 px-4 rounded-xl bg-slate text-white text-sm font-semibold">
              Write the campaign
            </button>
          ) : null}
        </div>
      ) : (
        <div className="animate-step-in">
          {step.channel === "email" && (
            <div className="bg-paper border border-[#ECEAF0] rounded-[20px] overflow-hidden shadow-[0_30px_60px_-40px_rgba(23,19,31,.35)]">
              <div className="flex items-center gap-3 px-5 py-4 border-b border-[#F0EEF4]">
                <Avatar initials={initials} />
                <div className="min-w-0">
                  <div className="text-sm font-semibold truncate">{fromName}</div>
                  <div className="text-xs text-muted">To: your list</div>
                </div>
              </div>
              <div className="px-5 pt-[18px] pb-6">
                <div className="text-xs text-muted">Subject</div>
                <div className="font-serif text-[24px] font-medium tracking-tight leading-tight mt-0.5">{v("headline")}</div>
                <p className="text-[15px] leading-relaxed text-[#3D3747] mt-3.5 whitespace-pre-line">{v("body")}</p>
              </div>
            </div>
          )}

          {step.channel === "sms" && (
            <div className="max-w-[340px] mx-auto bg-paper border border-[#ECEAF0] rounded-[32px] px-4 pt-5 pb-7 shadow-[0_30px_60px_-40px_rgba(23,19,31,.35)]">
              <div className="text-center text-xs text-muted">Text message · {when}</div>
              <div className="mt-3.5 max-w-[88%] px-3.5 py-3 rounded-[18px_18px_18px_6px] bg-[#F0F0F3] text-[15px] leading-snug whitespace-pre-line">{v("body")}</div>
              <div className="text-[11px] text-faint mt-1.5 ml-1.5">
                {v("body").length} characters · {Math.max(1, Math.ceil(v("body").length / 160))} {v("body").length > 160 ? "texts" : "text"}
              </div>
            </div>
          )}

          {(step.channel === "ad" || step.channel === "social") && (
            <div className="max-w-[440px] mx-auto bg-paper border border-[#ECEAF0] rounded-[18px] overflow-hidden shadow-[0_30px_60px_-40px_rgba(23,19,31,.35)]">
              <div className="flex items-center gap-2.5 px-3.5 py-3">
                <Avatar initials={initials} small />
                <div className="flex-grow min-w-0">
                  <div className="text-sm font-semibold truncate">{fromName}</div>
                  <div className="text-xs text-muted">{step.channel === "ad" ? "Sponsored" : "Post"}</div>
                </div>
                <PlatformLogo platform={info.platforms[0]} size={18} />
              </div>
              <p className="text-sm leading-relaxed px-3.5 pb-3 m-0 whitespace-pre-line">{step.channel === "ad" ? v("primaryText") : v("caption")}</p>
              <div className="aspect-[1.91/1] flex items-center justify-center px-6 text-center text-[13px] text-muted" style={{ background: "linear-gradient(135deg,#F3EEFF,#FCE7F3)" }}>
                {step.channel === "social" && v("visual") ? `Show: ${v("visual")}` : "Your image or video"}
              </div>
              {step.channel === "ad" && (
                <div className="flex items-center gap-3 px-3.5 py-3 bg-[#FAFAFA]">
                  <div className="flex-grow min-w-0 text-[15px] font-semibold">{v("headline")}</div>
                  <span className="px-3 py-2 rounded-lg bg-[#E9E7EE] text-[13px] font-semibold">Sign up</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {copy && needsInput(copy) && (
        <div className="px-3.5 py-3 rounded-[14px] bg-[#FFF7ED] border border-[#FED7AA] text-sm text-[#7C2D12] leading-snug">
          <b>Fill in the [BRACKETS]</b> before this goes out. Click Edit by hand, or tell the agent the real detail below.
        </div>
      )}

      {copy && (
        <>
          <div className="flex gap-2">
            <label htmlFor="ask-step" className="sr-only">
              Ask the agent to change this message
            </label>
            <input
              id="ask-step"
              value={ask}
              onChange={(e) => setAsk(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  send(ask);
                }
              }}
              disabled={pending}
              placeholder={pending ? "Changing it..." : "Change this message: shorter, more urgent..."}
              className="flex-grow min-w-0 h-[46px] px-3.5 rounded-xl border border-[#D4D1DB] bg-paper text-sm focus:outline-none focus:border-[#9B1FD6] focus:shadow-[0_0_0_4px_rgba(155,31,214,.12)] disabled:opacity-60"
            />
            <button
              onClick={() => send(ask)}
              disabled={pending || !ask.trim()}
              aria-label="Send"
              className="shrink-0 w-[46px] h-[46px] rounded-xl bg-slate text-white flex items-center justify-center disabled:opacity-40"
            >
              {pending ? (
                <svg className="animate-spin" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true">
                  <path d="M21 12a9 9 0 1 1-6.2-8.6" />
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M12 19V5M5 12l7-7 7 7" />
                </svg>
              )}
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5 -mt-1">
            {[
              ["Shorter", "Make it shorter. Keep the same idea."],
              ["More urgent", "Add more urgency, with a real reason to act now."],
              ["New hook", "Try a different opening hook."],
            ].map(([label, instr]) => (
              <button
                key={label}
                onClick={() => send(instr)}
                disabled={pending}
                className="min-h-8 px-3 rounded-full border border-[#ECEAF0] bg-paper text-[13px] hover:border-[#CDB8F5] disabled:opacity-50"
              >
                {label}
              </button>
            ))}
            <button onClick={onEditByHand} className="min-h-8 px-3 rounded-full border border-[#ECEAF0] bg-paper text-[13px] font-semibold hover:border-[#CDB8F5]">
              Edit by hand
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function Avatar({ initials, small }: { initials: string; small?: boolean }) {
  return (
    <span
      className={`${small ? "w-[34px] h-[34px] text-[11px]" : "w-9 h-9 text-xs"} shrink-0 rounded-full flex items-center justify-center text-white font-bold`}
      style={{ background: "linear-gradient(135deg,#3B1FD1,#9B1FD6 55%,#FF00B8)" }}
    >
      {initials}
    </span>
  );
}
