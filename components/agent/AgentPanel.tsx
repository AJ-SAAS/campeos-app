"use client";

import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { addAgentMessage, clearAgentMessages, listAgentMessages, pruneAgentMessages } from "@/lib/firebase/agentThreads";
import { TIPS_KEY, dayKey, shouldShowTips } from "@/lib/agentTips";
import { SAVED_HISTORY_LIMIT, recentForModel, sessionLabel, startsNewSession } from "@/lib/agentHistory";
import { getBusinessProfile, BusinessProfile } from "@/lib/firebase/businessProfile";
import { executeCreateCampaign, executeEditStep, UsageLimitError, SubscriptionRequiredError } from "@/lib/ai/agentActions";
import { AgentChatMessage, CreateCampaignArgs, EditStepArgs } from "@/lib/ai/agent";
import { buildTimeline } from "@/lib/engine/buildTimeline";
import { webinarTemplate } from "@/lib/templates/webinar";
import { OfferContext, StepContext } from "@/lib/ai/prompts";
import { authFetch } from "@/lib/firebase/authFetch";
import { resolveSignOff } from "@/lib/signOff";
import { Mascot } from "@/components/mascot/Mascot";
import { MascotStatic } from "@/components/mascot/MascotStatic";
import type { OrbMood } from "@/lib/mascot/orb";
import { AGENT_NAME } from "@/lib/brand";

function SessionDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 my-1" role="separator" aria-label={label}>
      <span className="flex-grow h-px bg-[#E3E1E8]" />
      <span className="font-mono text-[11px] uppercase tracking-wider text-muted">{label}</span>
      <span className="flex-grow h-px bg-[#E3E1E8]" />
    </div>
  );
}

interface DisplayMessage {
  role: "user" | "assistant";
  content: string;
  /** When it was sent (ms). Used for the divider between old and new chats. */
  at?: number;
}

/** One step of the campaign currently open in the builder, as the agent
 * needs to see it: enough to pick the right one and to run a variation
 * on it. Passed down from app/builder/page.tsx. */
export interface AgentPanelCampaignStep extends StepContext {
  templateStepId: string;
  copy: Record<string, string> | null;
}

export interface AgentPanelCampaignContext {
  campaignId: string;
  offer: OfferContext;
  steps: AgentPanelCampaignStep[];
  /** Called after the agent successfully edits a step, so the builder
   * page can update its own on-screen copy without a full reload. */
  onStepUpdated: (templateStepId: string, copy: Record<string, string>) => void;
}

interface AgentPanelProps {
  /** Present only when the agent should be able to edit an existing
   * campaign, not just build new ones — see AgentLauncher. */
  campaign?: AgentPanelCampaignContext;
  /** Fill the parent's height (the dashboard's side column) instead of
   * capping the chat at 380px. */
  fill?: boolean;
  /** Fit exactly inside a box that has a set height (the floating popover):
   * the message list scrolls and the input stays in view. */
  contained?: boolean;
  /** False while the panel is tucked away (the closed popover). Pauses the
   * 3D orb, and the chat jumps to the newest message when it shows again. */
  visible?: boolean;
  /** Shows a close button in the header (for the floating popover). */
  onClose?: () => void;
  /** "live" = the animated 3D mascot in the header. "static" = a flat
   * picture, used when the floating launcher already shows the live one
   * (so a page never has more than a couple of 3D orbs). */
  mascot?: "live" | "static";
  /** Tells the parent what the agent is doing (idle, thinking, happy...),
   * so the launcher button can show the same mood. */
  onMoodChange?: (mood: OrbMood) => void;
}

// The dashboard's primary surface — from the "Agent" panel in
// Main.dc.html — and also reachable from the Campaign Builder via the
// floating launcher. Real chat history (Firestore, scoped to the user),
// real tool-calling against /api/agent, and real builds/edits when the
// agent has enough to go on. See lib/ai/agent.ts for what it can do:
// create_campaign always, and edit_step when `campaign` is passed here.
//
// Loads the user's saved business profile (lib/firebase/businessProfile.ts)
// so a second campaign doesn't start the conversation from zero — the
// agent already knows the offer and only asks what's actually new.
export function AgentPanel({ campaign, fill = false, contained = false, visible = true, onClose, mascot = "live", onMoodChange }: AgentPanelProps) {
  const { user } = useAuth();
  const router = useRouter();
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [buildTrace, setBuildTrace] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<BusinessProfile | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  // The mascot's mood follows what the agent is doing. "Happy" is a short
  // moment after it finishes something; `hop` makes it jump with it.
  const [happy, setHappy] = useState(false);
  const [hop, setHop] = useState(0);
  // "Try asking" shows once a day. Starts hidden until we've read the browser's note.
  const [showTips, setShowTips] = useState(false);
  useEffect(() => {
    try {
      setShowTips(shouldShowTips(localStorage.getItem(TIPS_KEY)));
    } catch {
      setShowTips(true);
    }
  }, []);
  // Eos does a spin when it finishes something.
  const [spin, setSpin] = useState(0);
  const happyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const celebrate = useCallback(() => {
    setHappy(true);
    setHop((h) => h + 1);
    setSpin((n) => n + 1);
    if (happyTimer.current) clearTimeout(happyTimer.current);
    happyTimer.current = setTimeout(() => setHappy(false), 2400);
  }, []);
  useEffect(
    () => () => {
      if (happyTimer.current) clearTimeout(happyTimer.current);
    },
    []
  );
  const mood: OrbMood = error
    ? "surprised"
    : sending || buildTrace
      ? "thinking"
      : happy
        ? "happy"
        : "idle";
  useEffect(() => {
    onMoodChange?.(mood);
  }, [mood, onMoodChange]);

  useEffect(() => {
    if (!user) {
      setMessages([]);
      setProfile(null);
      return;
    }
    listAgentMessages(user.uid).then((history) => {
      setMessages(history.slice(-SAVED_HISTORY_LIMIT).map((m) => ({ role: m.role, content: m.content, at: m.createdAt?.toMillis() })));
      // Keep the saved thread short. Best effort, never blocks the chat.
      if (history.length > SAVED_HISTORY_LIMIT) pruneAgentMessages(user.uid).catch(() => {});
    });
    getBusinessProfile(user.uid).then(setProfile);
  }, [user]);

  // Always follow the newest message: when one arrives, while Eos is
  // typing, and when the popover is opened. Waits a frame so the new
  // content has been laid out first.
  useEffect(() => {
    if (!visible) return;
    const el = scrollRef.current;
    if (!el) return;
    const id = requestAnimationFrame(() => el.scrollTo({ top: el.scrollHeight, behavior: "smooth" }));
    // The popover is still growing in when `visible` flips: jump after it settles.
    const id2 = setTimeout(() => el.scrollTo({ top: el.scrollHeight }), 260);
    return () => {
      cancelAnimationFrame(id);
      clearTimeout(id2);
    };
  }, [messages, buildTrace, sending, visible]);

  async function send() {
    const text = input.trim();
    if (!text || !user || sending) return;

    setInput("");
    setError(null);
    setSending(true);
    // Only the last few messages go to the AI: every message sent is paid
    // for, and recent turns are all it needs (the campaign is sent apart).
    const history: AgentChatMessage[] = recentForModel(messages).map((m) => ({ role: m.role, content: m.content }));
    setHop((h) => h + 1);
    // Used up for today: hide "Try asking" until tomorrow.
    setShowTips(false);
    try {
      localStorage.setItem(TIPS_KEY, dayKey());
    } catch {}
    setMessages((prev) => [...prev, { role: "user", content: text, at: Date.now() }]);

    try {
      await addAgentMessage(user.uid, "user", text);

      const res = await authFetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          history,
          message: text,
          profile: profile
            ? {
                name: profile.name,
                price: profile.price,
                audience: profile.audience,
                whatTheyGet: profile.whatTheyGet,
                tone: profile.tone,
              }
            : null,
          campaignContext: campaign
            ? {
                steps: campaign.steps.map((s) => ({
                  templateStepId: s.templateStepId,
                  channel: s.channel,
                  title: s.title,
                  purpose: s.purpose,
                  angle: s.angle,
                  phaseName: s.phaseName,
                })),
              }
            : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `${AGENT_NAME} didn't respond.`);

      setMessages((prev) => [...prev, { role: "assistant", content: data.reply, at: Date.now() }]);
      if (!data.toolCall) celebrate();
      await addAgentMessage(user.uid, "assistant", data.reply);

      if (data.toolCall?.name === "create_campaign") {
        await buildCampaign(user.uid, data.toolCall.arguments);
      } else if (data.toolCall?.name === "edit_step" && campaign) {
        await editStep(user.uid, data.toolCall.arguments, campaign);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSending(false);
    }
  }

  async function buildCampaign(uid: string, args: CreateCampaignArgs) {
    // An honest trace, not a fake progress bar: this is the real
    // schedule buildTimeline() is about to generate, computed the same
    // way executeCreateCampaign computes it, before any network call.
    const trace: string[] = [];
    if (profile) trace.push("Using what I already know about your business");

    try {
      const eventDate = new Date(`${args.webinarDate}T19:00:00`);
      if (!Number.isNaN(eventDate.getTime())) {
        const planned = buildTimeline(webinarTemplate, { event: eventDate });
        const adCount = planned.filter((s) => s.channel === "ad").length;
        const emailCount = planned.filter((s) => s.channel === "email").length;
        const smsCount = planned.filter((s) => s.channel === "sms").length;
        trace.push(
          `Mapping a ${planned.length}-step timeline (${adCount} ads, ${emailCount} emails, ${smsCount} texts)`
        );
      }
    } catch {
      // If the date can't be parsed, skip the preview line — executeCreateCampaign
      // below will surface the real error.
    }
    trace.push(args.stepScope === "first" ? "Writing just the first step..." : "Writing every step...");
    setBuildTrace(trace);

    try {
      const result = await executeCreateCampaign(
        uid,
        args,
        resolveSignOff(profile?.name === args.offerName ? profile?.fromName : undefined, profile?.signOffName, user?.displayName)
      );
      const doneMessage =
        result.failedCount > 0
          ? `Done. ${result.writtenCount - result.failedCount} of ${result.stepCount} steps are ready. ${result.failedCount} didn't write, and you can retry those in the builder.`
          : result.writtenCount < result.stepCount
            ? `Done. The schedule is saved and the first step is written. The other ${result.stepCount - result.writtenCount} are ready whenever you want them. Want to take a look?`
            : `Done. All ${result.stepCount} steps are ready. Want to take a look?`;
      setMessages((prev) => [...prev, { role: "assistant", content: doneMessage, at: Date.now() }]);
      celebrate();
      await addAgentMessage(uid, "assistant", doneMessage);
      setProfile((prev) => ({
        name: args.offerName,
        price: args.price,
        audience: args.audience,
        whatTheyGet: args.whatTheyGet,
        tone: args.tone,
        updatedAt: prev?.updatedAt,
      }));
      router.push(`/builder?id=${result.campaignId}`);
    } catch (err) {
      const message =
        err instanceof UsageLimitError || err instanceof SubscriptionRequiredError
          ? err.message
          : err instanceof Error
            ? `I ran into a problem building that: ${err.message}`
            : "I ran into a problem building that.";
      setMessages((prev) => [...prev, { role: "assistant", content: message, at: Date.now() }]);
      await addAgentMessage(uid, "assistant", message);
    } finally {
      setBuildTrace(null);
    }
  }

  async function editStep(uid: string, args: EditStepArgs, ctx: AgentPanelCampaignContext) {
    const step = ctx.steps.find((s) => s.templateStepId === args.templateStepId);
    if (!step) {
      const message = "I picked a step that isn't in this campaign. Try asking again.";
      setMessages((prev) => [...prev, { role: "assistant", content: message, at: Date.now() }]);
      await addAgentMessage(uid, "assistant", message);
      return;
    }

    setBuildTrace([`Rewriting "${step.title}"...`]);
    try {
      const result = await executeEditStep(
        uid,
        ctx.campaignId,
        step.templateStepId,
        {
          channel: step.channel,
          title: step.title,
          purpose: step.purpose,
          angle: step.angle,
          goals: step.goals,
          persuasionElements: step.persuasionElements,
          phaseName: step.phaseName,
          phaseObjective: step.phaseObjective,
          scheduledAt: step.scheduledAt,
          eventAt: step.eventAt,
          fields: step.fields,
        },
        step.copy ?? {},
        args.instruction,
        ctx.offer
      );
      ctx.onStepUpdated(step.templateStepId, result.copy);
      // The model is asked for a lowercase fragment ("the headline's
      // angle..."), but strip a leading "changed " defensively in case
      // it echoes the word back anyway — avoids "Done — changed Changed...".
      const changedFragment = result.changed?.replace(/^changed\s+/i, "");
      const doneMessage = changedFragment ? `Done. I changed ${changedFragment}.` : "Done. Take a look.";
      setMessages((prev) => [...prev, { role: "assistant", content: doneMessage, at: Date.now() }]);
      celebrate();
      await addAgentMessage(uid, "assistant", doneMessage);
    } catch (err) {
      const message =
        err instanceof UsageLimitError
          ? err.message
          : err instanceof Error
            ? `I ran into a problem with that: ${err.message}`
            : "I ran into a problem with that.";
      setMessages((prev) => [...prev, { role: "assistant", content: message, at: Date.now() }]);
      await addAgentMessage(uid, "assistant", message);
    } finally {
      setBuildTrace(null);
    }
  }

  if (!user) {
    return (
      <section className="flex flex-col bg-paper border border-line rounded-2xl overflow-hidden min-h-[280px] sm:min-h-[320px]">
        <div className="bg-gradient-to-r from-clay to-pink flex items-center gap-2.5 px-5 py-4">
          <MascotStatic size={28} />
          <span className="font-display text-base font-semibold text-white">{AGENT_NAME}</span>
        </div>
        <div className="flex-grow flex items-center justify-center text-sm text-faint px-6 text-center">
          Sign in to talk to {AGENT_NAME} and build a campaign.
        </div>
      </section>
    );
  }

  const renderMessage = (m: DisplayMessage, _i: number) =>
    m.role === "user" ? (
      <div className="flex justify-end">
        <div className="bg-slate text-white rounded-[14px_14px_4px_14px] px-3.5 py-2.5 text-[13.5px] leading-relaxed max-w-[85%] sm:max-w-[420px]">
          {m.content}
        </div>
      </div>
    ) : (
      <div className="flex items-start max-w-[90%] sm:max-w-[440px]">
        <div className="bg-paper border border-[#ECEAF0] rounded-[14px_14px_14px_4px] px-3.5 py-2.5 text-[14px] leading-relaxed whitespace-pre-line">
          {m.content}
        </div>
      </div>
    );

  const emptyStateText = campaign
    ? `Ask ${AGENT_NAME} to change a step in this campaign, or build a new one.`
    : profile
      ? `Tell ${AGENT_NAME} what you need. ${AGENT_NAME} already knows ${profile.name}.`
      : `Tell ${AGENT_NAME} what you need, like "Build me a webinar promo for Thursday".`;

  return (
    <section
      aria-label={AGENT_NAME}
      id="agent"
      className={`flex flex-col min-h-0 bg-paper border border-[#ECEAF0] rounded-[22px] overflow-hidden ${fill ? "lg:h-full" : ""} ${contained ? "h-full" : ""}`}
    >
      <div className="shrink-0 flex items-center gap-2.5 px-5 py-3 border-b border-[#F0F0F0]">
        {mascot === "live" && visible ? (
          <Mascot size={108} fit={1.05} centered interactive bubble={false} ring={mood === "thinking"} glow={false} restless={false} mood={mood} hopKey={hop} spinKey={spin} label={AGENT_NAME} style={{ margin: -22 }} />
        ) : (
          <MascotStatic size={34} mood={mood} />
        )}
        <span className="flex-grow text-base font-semibold">{AGENT_NAME}</span>
        {messages.length > 0 && !sending && !buildTrace && (
          <button
            onClick={() => {
              if (!user) return;
              setMessages([]);
              setError(null);
              clearAgentMessages(user.uid).catch(() => {});
            }}
            className="h-8 px-3 rounded-lg border border-[#E3E1E8] text-xs font-semibold text-slate hover:bg-[#FAFAFA]"
          >
            New chat
          </button>
        )}
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#15803D]">
          <span className="w-1.5 h-1.5 rounded-full bg-lime" />
          Online
        </span>
        {onClose && (
          <button
            onClick={onClose}
            aria-label={`Close ${AGENT_NAME}`}
            className="shrink-0 w-8 h-8 rounded-full bg-[#F2F1F5] text-slate flex items-center justify-center hover:bg-[#E9E7EF]"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        )}
      </div>

      <div ref={scrollRef} className={`flex-grow ${contained ? "min-h-0" : "min-h-[180px] max-h-[380px]"} ${fill ? "lg:max-h-none lg:min-h-0" : ""} overflow-y-auto flex flex-col gap-3 px-4 sm:px-5 py-5 bg-[#FAFAFA]`}>
        {messages.length === 0 && <div className="text-sm text-faint">{emptyStateText}</div>}
        {messages.map((m, i) => (
          <Fragment key={i}>
            {i > 0 && startsNewSession(messages[i - 1].at, m.at) && <SessionDivider label={sessionLabel(m.at ?? Date.now())} />}
            {renderMessage(m, i)}
          </Fragment>
        ))}
        {/* Old chat on screen: a line marks where today's talk starts. */}
        {messages.length > 0 && messages[messages.length - 1].at != null && startsNewSession(messages[messages.length - 1].at, Date.now()) && (
          <SessionDivider label="Today" />
        )}
        {sending && !buildTrace && (
          <div className="flex items-start" role="status" aria-label={`${AGENT_NAME} is typing`}>
            <div className="bg-paper border border-[#ECEAF0] rounded-[14px_14px_14px_4px] px-4 py-3.5 flex items-center gap-1.5">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="w-2 h-2 rounded-full bg-[#9B7BE8] motion-safe:animate-bounce"
                  style={{ animationDelay: `${i * 0.15}s`, animationDuration: "0.9s" }}
                />
              ))}
            </div>
          </div>
        )}
        {buildTrace && (
          <div className="flex items-start">
            <div className="bg-paper border border-line rounded-[14px_14px_14px_4px] px-3.5 py-2.5 text-[12.5px] text-faint font-mono flex flex-col gap-1">
              {buildTrace.map((line, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  {i === buildTrace.length - 1 ? (
                    <span className="w-1.5 h-1.5 rounded-full bg-clay animate-pulse shrink-0" />
                  ) : (
                    <span className="w-1.5 h-1.5 rounded-full bg-clay shrink-0" />
                  )}
                  {line}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {error && <div className="px-5 pt-2 text-xs text-dangerFg">{error}</div>}

      {showTips && !sending && !buildTrace && (
        <div className="shrink-0 px-4 sm:px-5 pt-3.5">
          <div className="font-mono text-[11px] uppercase tracking-wider text-muted">Try asking</div>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {[
              ...(messages.length > 0 ? ["Pick up where we left off"] : []),
              ...(campaign
                ? ["Make the subject lines shorter", "Add more urgency to the last email", "Give me 3 new ad hooks"]
                : ["Build a webinar launch for next Thursday", "Write just the first email", "What do you know about my offer?"]),
            ].map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setInput(t)}
                className="min-h-[34px] px-3 rounded-full border border-[#ECEAF0] bg-paper text-[13px] hover:border-[#CDB8F5]"
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="shrink-0 flex items-center gap-2 px-4 sm:px-5 pt-3 pb-4">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder={
            campaign ? `Ask ${AGENT_NAME} to change something...` : `Tell ${AGENT_NAME} what to build or change...`
          }
          disabled={sending || !!buildTrace}
          className="flex-grow min-w-0 h-[46px] border border-[#D4D1DB] rounded-xl px-3.5 text-[14px] font-body text-slate bg-paper focus:outline-none focus:border-[#9B1FD6] focus:shadow-[0_0_0_4px_rgba(155,31,214,.12)] disabled:opacity-60"
        />
        <button
          onClick={send}
          disabled={sending || !!buildTrace || !input.trim()}
          aria-label="Send"
          className="shrink-0 w-[46px] h-[46px] rounded-xl bg-slate text-white flex items-center justify-center disabled:opacity-40"
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 19V5M5 12l7-7 7 7" />
          </svg>
        </button>
      </div>
    </section>
  );
}
