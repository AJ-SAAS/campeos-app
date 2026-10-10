"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { addAgentMessage, listAgentMessages } from "@/lib/firebase/agentThreads";
import { getBusinessProfile, BusinessProfile } from "@/lib/firebase/businessProfile";
import { executeCreateCampaign, executeEditStep, UsageLimitError } from "@/lib/ai/agentActions";
import { AgentChatMessage, CreateCampaignArgs, EditStepArgs } from "@/lib/ai/agent";
import { buildTimeline } from "@/lib/engine/buildTimeline";
import { webinarTemplate } from "@/lib/templates/webinar";
import { OfferContext, StepContext } from "@/lib/ai/prompts";

interface DisplayMessage {
  role: "user" | "assistant";
  content: string;
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
export function AgentPanel({ campaign }: AgentPanelProps) {
  const { user } = useAuth();
  const router = useRouter();
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [buildTrace, setBuildTrace] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<BusinessProfile | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) {
      setMessages([]);
      setProfile(null);
      return;
    }
    listAgentMessages(user.uid).then((history) =>
      setMessages(history.map((m) => ({ role: m.role, content: m.content })))
    );
    getBusinessProfile(user.uid).then(setProfile);
  }, [user]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, buildTrace]);

  async function send() {
    const text = input.trim();
    if (!text || !user || sending) return;

    setInput("");
    setError(null);
    setSending(true);
    const history: AgentChatMessage[] = messages.map((m) => ({ role: m.role, content: m.content }));
    setMessages((prev) => [...prev, { role: "user", content: text }]);

    try {
      await addAgentMessage(user.uid, "user", text);

      const res = await fetch("/api/agent", {
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
                })),
              }
            : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "The agent didn't respond.");

      setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
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
    trace.push("Writing every step...");
    setBuildTrace(trace);

    try {
      const result = await executeCreateCampaign(uid, args);
      const doneMessage =
        result.failedCount > 0
          ? `Done. ${result.stepCount - result.failedCount} of ${result.stepCount} steps are ready — ${result.failedCount} failed to generate, you can retry those in the builder.`
          : `Done. All ${result.stepCount} steps are ready. Want to take a look?`;
      setMessages((prev) => [...prev, { role: "assistant", content: doneMessage }]);
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
        err instanceof UsageLimitError
          ? err.message
          : err instanceof Error
            ? `I ran into a problem building that: ${err.message}`
            : "I ran into a problem building that.";
      setMessages((prev) => [...prev, { role: "assistant", content: message }]);
      await addAgentMessage(uid, "assistant", message);
    } finally {
      setBuildTrace(null);
    }
  }

  async function editStep(uid: string, args: EditStepArgs, ctx: AgentPanelCampaignContext) {
    const step = ctx.steps.find((s) => s.templateStepId === args.templateStepId);
    if (!step) {
      const message = "I picked a step that isn't actually in this campaign — try asking again.";
      setMessages((prev) => [...prev, { role: "assistant", content: message }]);
      await addAgentMessage(uid, "assistant", message);
      return;
    }

    setBuildTrace([`Rewriting "${step.title}"...`]);
    try {
      const result = await executeEditStep(
        uid,
        ctx.campaignId,
        step.templateStepId,
        { channel: step.channel, title: step.title, purpose: step.purpose, angle: step.angle, fields: step.fields },
        step.copy ?? {},
        args.instruction,
        ctx.offer
      );
      ctx.onStepUpdated(step.templateStepId, result.copy);
      const doneMessage = result.changed ? `Done — changed ${result.changed}.` : "Done — take a look.";
      setMessages((prev) => [...prev, { role: "assistant", content: doneMessage }]);
      await addAgentMessage(uid, "assistant", doneMessage);
    } catch (err) {
      const message =
        err instanceof UsageLimitError
          ? err.message
          : err instanceof Error
            ? `I ran into a problem with that: ${err.message}`
            : "I ran into a problem with that.";
      setMessages((prev) => [...prev, { role: "assistant", content: message }]);
      await addAgentMessage(uid, "assistant", message);
    } finally {
      setBuildTrace(null);
    }
  }

  if (!user) {
    return (
      <section className="flex flex-col bg-white border border-[#DDD6C5] rounded-2xl overflow-hidden min-h-[320px]">
        <div className="bg-slate flex items-center gap-2.5 px-5 py-4">
          <AgentIcon />
          <span className="font-display text-base font-semibold text-ivory">Agent</span>
        </div>
        <div className="flex-grow flex items-center justify-center text-sm text-faint px-6 text-center">
          Sign in to talk to the agent and build a campaign.
        </div>
      </section>
    );
  }

  const emptyStateText = campaign
    ? "Ask the agent to change a step in this campaign, or build a new one."
    : profile
      ? `Tell the agent what you need — it already knows ${profile.name}.`
      : 'Tell the agent what you need — "Build me a webinar promo for Thursday" works.';

  return (
    <section
      aria-label="Agent"
      className="flex flex-col min-h-0 bg-white border border-[#DDD6C5] rounded-2xl overflow-hidden shadow-[0_1px_2px_rgba(28,27,24,0.04),0_28px_56px_-26px_rgba(75,58,140,0.3)]"
    >
      <div className="shrink-0 bg-slate flex items-center gap-2.5 px-5 py-4">
        <AgentIcon />
        <span className="font-display text-base font-semibold text-ivory">Agent</span>
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[rgba(27,107,79,0.3)] text-[#8FD9BB] text-[11px] font-semibold">
          <span className="w-1.5 h-1.5 rounded-full bg-[#4ADE9A]" />
          Online
        </span>
      </div>

      <div ref={scrollRef} className="flex-grow min-h-[260px] max-h-[460px] overflow-y-auto flex flex-col gap-3.5 px-5 py-5 bg-[#FAF8FC]">
        {messages.length === 0 && <div className="text-sm text-faint">{emptyStateText}</div>}
        {messages.map((m, i) =>
          m.role === "user" ? (
            <div key={i} className="flex justify-end">
              <div className="bg-slate text-ivory rounded-[14px_14px_4px_14px] px-3.5 py-2.5 text-[13.5px] leading-relaxed max-w-[420px]">
                {m.content}
              </div>
            </div>
          ) : (
            <div key={i} className="flex gap-2.5 items-start">
              <span className="w-[26px] h-[26px] rounded-full bg-agent flex items-center justify-center shrink-0 mt-0.5">
                <AgentIcon small />
              </span>
              <div className="bg-white border border-[#E1DAF0] rounded-[14px_14px_14px_4px] px-3.5 py-2.5 text-[13.5px] leading-relaxed max-w-[440px] whitespace-pre-line">
                {m.content}
              </div>
            </div>
          )
        )}
        {sending && !buildTrace && (
          <div className="flex gap-2.5 items-start">
            <span className="w-[26px] h-[26px] rounded-full bg-agent flex items-center justify-center shrink-0 mt-0.5">
              <AgentIcon small />
            </span>
            <div className="bg-white border border-[#E1DAF0] rounded-[14px_14px_14px_4px] px-3.5 py-2.5 text-[12.5px] text-faint font-mono">
              ...
            </div>
          </div>
        )}
        {buildTrace && (
          <div className="flex gap-2.5 items-start">
            <span className="w-[26px] h-[26px] rounded-full bg-agent flex items-center justify-center shrink-0 mt-0.5">
              <AgentIcon small />
            </span>
            <div className="bg-white border border-[#E1DAF0] rounded-[14px_14px_14px_4px] px-3.5 py-2.5 text-[12.5px] text-faint font-mono flex flex-col gap-1">
              {buildTrace.map((line, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  {i === buildTrace.length - 1 ? (
                    <span className="w-1.5 h-1.5 rounded-full bg-agent animate-pulse shrink-0" />
                  ) : (
                    <span className="w-1.5 h-1.5 rounded-full bg-[#1B6B4F] shrink-0" />
                  )}
                  {line}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {error && <div className="px-5 pt-2 text-xs text-[#B42318]">{error}</div>}

      <div className="shrink-0 flex items-center gap-2 px-5 py-4 border-t border-line">
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
            campaign ? "Ask the agent to change something..." : "Tell the agent what to build or change..."
          }
          disabled={sending || !!buildTrace}
          className="flex-grow min-w-0 h-[46px] border-[1.5px] border-agent rounded-xl px-3.5 text-[13.5px] font-body text-slate bg-white disabled:opacity-60"
        />
        <button
          onClick={send}
          disabled={sending || !!buildTrace || !input.trim()}
          aria-label="Send"
          className="shrink-0 w-10 h-10 rounded-[11px] bg-agent text-white flex items-center justify-center disabled:opacity-50"
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 19V5M5 12l7-7 7 7" />
          </svg>
        </button>
      </div>
    </section>
  );
}

function AgentIcon({ small }: { small?: boolean }) {
  const size = small ? 13 : 16;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="#FFFFFF" aria-hidden="true">
      <path d="M12 2l1.8 6.4L20 10l-6.2 1.6L12 18l-1.8-6.4L4 10l6.2-1.6z" />
    </svg>
  );
}
