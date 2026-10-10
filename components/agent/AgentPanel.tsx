"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { addAgentMessage, listAgentMessages } from "@/lib/firebase/agentThreads";
import { executeCreateCampaign, UsageLimitError } from "@/lib/ai/agentActions";
import { AgentChatMessage } from "@/lib/ai/agent";

interface DisplayMessage {
  role: "user" | "assistant";
  content: string;
}

// The dashboard's primary surface — from the "Agent" panel in
// Main.dc.html. Real chat history (Firestore, scoped to the user),
// real tool-calling against /api/agent, and a real build when the
// agent has enough to go on. See lib/ai/agent.ts for what it can do
// today: one tool, create_campaign, webinar promo only.
export function AgentPanel() {
  const { user } = useAuth();
  const router = useRouter();
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [building, setBuilding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) {
      setMessages([]);
      return;
    }
    listAgentMessages(user.uid).then((history) =>
      setMessages(history.map((m) => ({ role: m.role, content: m.content })))
    );
  }, [user]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, building]);

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
        body: JSON.stringify({ history, message: text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "The agent didn't respond.");

      setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
      await addAgentMessage(user.uid, "assistant", data.reply);

      if (data.toolCall?.name === "create_campaign") {
        setBuilding(true);
        try {
          const result = await executeCreateCampaign(user.uid, data.toolCall.arguments);
          const doneMessage =
            result.failedCount > 0
              ? `Done. ${result.stepCount - result.failedCount} of ${result.stepCount} steps are ready — ${result.failedCount} failed to generate, you can retry those in the builder.`
              : `Done. All ${result.stepCount} steps are ready. Want to take a look?`;
          setMessages((prev) => [...prev, { role: "assistant", content: doneMessage }]);
          await addAgentMessage(user.uid, "assistant", doneMessage);
          router.push(`/builder?id=${result.campaignId}`);
        } catch (err) {
          const message =
            err instanceof UsageLimitError
              ? err.message
              : err instanceof Error
                ? `I ran into a problem building that: ${err.message}`
                : "I ran into a problem building that.";
          setMessages((prev) => [...prev, { role: "assistant", content: message }]);
          await addAgentMessage(user.uid, "assistant", message);
        } finally {
          setBuilding(false);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSending(false);
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
        {messages.length === 0 && (
          <div className="text-sm text-faint">
            Tell the agent what you need — "Build me a webinar promo for Thursday" works.
          </div>
        )}
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
        {(sending || building) && (
          <div className="flex gap-2.5 items-start">
            <span className="w-[26px] h-[26px] rounded-full bg-agent flex items-center justify-center shrink-0 mt-0.5">
              <AgentIcon small />
            </span>
            <div className="bg-white border border-[#E1DAF0] rounded-[14px_14px_14px_4px] px-3.5 py-2.5 text-[12.5px] text-faint font-mono">
              {building ? "Writing your campaign..." : "..."}
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
          placeholder="Tell the agent what to build or change..."
          disabled={sending || building}
          className="flex-grow min-w-0 h-[46px] border-[1.5px] border-agent rounded-xl px-3.5 text-[13.5px] font-body text-slate bg-white disabled:opacity-60"
        />
        <button
          onClick={send}
          disabled={sending || building || !input.trim()}
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
