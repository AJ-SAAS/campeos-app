import { z } from "zod";
import { getOpenAIClient, OPENAI_MODEL } from "./client";

// The agent's whole job: hold a conversation, ask whatever's missing,
// and when it has enough, call create_campaign. It is NOT given free-form
// code execution or direct Firestore access — it can only ever call the
// one tool defined below. The actual campaign build (buildTimeline,
// generate-step, createCampaign) runs client-side after this route
// returns the tool call, same as the rest of the app's AI calls — see
// lib/ai/agentActions.ts.
//
// Campeos only has one real template today (lib/templates/webinar.ts), so
// that's the only thing the agent is allowed to promise. If you add a
// second template, add it to the schema's enum AND the system prompt below
// — don't let the agent claim a template that doesn't exist yet.

export interface AgentChatMessage {
  role: "user" | "assistant";
  content: string;
}

const createCampaignArgsSchema = z.object({
  templateId: z.enum(["webinar"]),
  offerName: z.string().min(1),
  price: z.string().min(1),
  audience: z.string().min(1),
  whatTheyGet: z.string().min(1),
  tone: z.enum(["Friendly", "Bold", "Calm"]),
  webinarDate: z.string().min(1), // "YYYY-MM-DD", the day the webinar goes live
});
export type CreateCampaignArgs = z.infer<typeof createCampaignArgsSchema>;

export interface AgentResult {
  reply: string;
  toolCall: { name: "create_campaign"; arguments: CreateCampaignArgs } | null;
}

const SYSTEM_PROMPT = `You are the Campeos agent. You help the user build a marketing campaign by calling the create_campaign tool once you have enough information. You do not write any copy yourself here — that happens after the tool call.

Campeos only has one real campaign type today: "webinar" (a 7 day high-ticket webinar promo: ads, reminders, the live event, replay, and call booking). If the user asks for anything else (a flash sale, a product launch, etc.), say plainly that only the webinar promo is wired up right now, and offer to build that instead, or suggest "Start from scratch" in the builder for anything else. Don't pretend to build something that doesn't exist.

Before calling create_campaign you need all of: an offer name, a price, who it's for, what they get, a tone (Friendly, Bold, or Calm — default to Friendly if they never say), and the date the webinar goes live. Ask ONE short, plain question at a time for whatever's missing — never a list of questions at once. Never invent a detail the user hasn't given you; ask instead.

Keep replies short and conversational, like a capable coworker, not a sales page. No em dashes. Once you call create_campaign, say something short like "Building that now." — the actual "done" message comes later, after the copy is written.`;

export async function runAgentTurn(
  history: AgentChatMessage[],
  message: string
): Promise<AgentResult> {
  const messages = [
    { role: "system" as const, content: SYSTEM_PROMPT },
    ...history.map((m) => ({ role: m.role, content: m.content })),
    { role: "user" as const, content: message },
  ];

  const response = await getOpenAIClient().chat.completions.create({
    model: OPENAI_MODEL,
    max_tokens: 400,
    messages,
    tools: [
      {
        type: "function",
        function: {
          name: "create_campaign",
          description:
            "Create a new campaign once you have the offer name, price, audience, what they get, tone, and webinar date.",
          parameters: {
            type: "object",
            properties: {
              templateId: { type: "string", enum: ["webinar"] },
              offerName: { type: "string" },
              price: { type: "string" },
              audience: { type: "string" },
              whatTheyGet: { type: "string" },
              tone: { type: "string", enum: ["Friendly", "Bold", "Calm"] },
              webinarDate: { type: "string", description: "YYYY-MM-DD" },
            },
            required: ["templateId", "offerName", "price", "audience", "whatTheyGet", "tone", "webinarDate"],
          },
        },
      },
    ],
  });

  const choice = response.choices[0];
  const toolCalls = choice?.message?.tool_calls;

  if (toolCalls && toolCalls.length > 0) {
    const call = toolCalls[0];
    let args: unknown;
    try {
      args = JSON.parse(call.function.arguments);
    } catch {
      throw new Error("The agent's tool call wasn't valid JSON.");
    }
    const parsed = createCampaignArgsSchema.safeParse(args);
    if (!parsed.success) {
      throw new Error(`Tool call didn't match the expected shape: ${parsed.error.message}`);
    }
    return {
      reply: choice.message.content?.trim() || "Building that now.",
      toolCall: { name: "create_campaign", arguments: parsed.data },
    };
  }

  const text = choice?.message?.content;
  if (!text) {
    throw new Error("The agent returned no reply.");
  }
  return { reply: text.trim(), toolCall: null };
}
