import { z } from "zod";
import { getOpenAIClient, UTILITY_MODEL } from "./client";
import { OfferContext } from "./prompts";

// The agent's job: hold a conversation and, when it has enough, call one
// of two tools. It is NOT given free-form code execution or direct
// Firestore access — these are the only two actions it can ever take.
// The actual work (buildTimeline, generate-step, Firestore writes) runs
// client-side after this route returns a tool call — see
// lib/ai/agentActions.ts.
//
// - create_campaign: always available. Builds a brand-new webinar promo.
// - edit_step: only available when the caller passes a CampaignContext —
//   i.e. the agent is being used from inside an already-open campaign
//   (the floating launcher on the Campaign Builder page, not the
//   dashboard's "build me something new" panel). Lets the agent change
//   one existing step's copy instead of only ever creating new things.
//
// Campeos only has one real template today (lib/templates/webinar.ts), so
// that's the only thing create_campaign is allowed to promise. If you add
// a second template, add it to the schema's enum AND the system prompt
// below — don't let the agent claim a template that doesn't exist yet.

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
  // "all" (the default) writes copy for every step in the template.
  // "first" saves the full schedule (every step in the template, see
  // lib/templates/webinar.ts) but only writes copy for the earliest-dated
  // step — for when the user explicitly asks for just one step rather
  // than the whole campaign. See executeCreateCampaign.
  stepScope: z.enum(["all", "first"]).optional().default("all"),
});
export type CreateCampaignArgs = z.infer<typeof createCampaignArgsSchema>;

const editStepArgsSchema = z.object({
  templateStepId: z.string().min(1),
  instruction: z.string().min(1),
});
export type EditStepArgs = z.infer<typeof editStepArgsSchema>;

export type AgentToolCall =
  | { name: "create_campaign"; arguments: CreateCampaignArgs }
  | { name: "edit_step"; arguments: EditStepArgs };

export interface AgentResult {
  reply: string;
  toolCall: AgentToolCall | null;
}

/** A short, read-only summary of one step in the campaign currently
 * open in the builder — just enough for the model to match "change the
 * headline on the FB ad" to the right templateStepId. Not the copy
 * itself; that stays out of the prompt and is handled client-side. */
export interface CampaignStepSummary {
  templateStepId: string;
  channel: string;
  title: string;
  purpose: string;
  angle: string;
}

export interface CampaignContext {
  steps: CampaignStepSummary[];
}

const BASE_PROMPT = `You are the Campeos agent. You help the user build and improve marketing campaigns. You do not write any copy yourself in this conversation — tool calls trigger the actual writing, which happens after you call a tool.

Campeos only has one real campaign type today: "webinar" (a full-lifecycle webinar launch: registration ads and emails, day-of reminders, then an 11-day backend sequence — consumption, consideration and connection, conversion, and marketing intel — that turns registrants into buyers). If the user asks to build anything else (a flash sale, a product launch, etc.), say plainly that only the webinar launch is wired up right now, and offer to build that instead, or suggest "Start from scratch" in the builder for anything else. Don't pretend to build something that doesn't exist.

Keep replies short and conversational, like a capable coworker, not a sales page. No em dashes.`;

const CREATE_CAMPAIGN_PROMPT = `To build a new campaign with create_campaign you need all of: an offer name, a price, who it's for, what they get, a tone (Friendly, Bold, or Calm — default to Friendly if they never say), and the date the webinar goes live. Ask ONE short, plain question at a time for whatever's missing — never a list of questions at once. Never invent a detail the user hasn't given you; ask instead.

create_campaign always saves the full campaign schedule, but the stepScope argument controls how much COPY gets written: pass "all" (the default) when the user wants the whole campaign written now, or "first" when they ask you to write just one step, just the first one, or only a specific single step right now (the rest get saved with no copy yet, ready to write later). Never default to "all" after the user has specifically asked for only one — that silently does far more than they asked.

Once you call create_campaign, say something short like "Building that now." — the real "done" message comes later, after the copy is written.`;

function buildSystemPrompt(
  knownProfile: OfferContext | null,
  campaignContext: CampaignContext | null
): string {
  let prompt = `${BASE_PROMPT}\n\n${CREATE_CAMPAIGN_PROMPT}`;

  if (knownProfile) {
    prompt += `\n\nYou already know this about the user's business from a previous campaign — don't ask for any of it again for a new campaign unless the user says it's changed:
- Offer name: ${knownProfile.name}
- Price: ${knownProfile.price}
- Audience: ${knownProfile.audience}
- What they get: ${knownProfile.whatTheyGet}
- Tone: ${knownProfile.tone}

For a new campaign, the only thing you're missing is the webinar date — ask for that.`;
  }

  if (campaignContext && campaignContext.steps.length > 0) {
    const stepList = campaignContext.steps
      .map((s) => `- ${s.templateStepId} (${s.channel}): "${s.title}" — ${s.purpose}`)
      .join("\n");
    prompt += `\n\nThe user is currently looking at an existing campaign with these steps:
${stepList}

If they ask you to change, rewrite, tighten, or vary a specific step's copy, call edit_step with that exact templateStepId and a short, specific instruction describing the one thing to change — e.g. "make the headline more urgent" or "shorten the primary text," not "rewrite everything" (Campeos changes one thing at a time, never a full rewrite, so the user can tell what changed). If it's unclear which step they mean — more than one ad, say — ask which one, listing the short titles as options, before calling the tool. You can still call create_campaign if they explicitly ask for a brand-new campaign instead.`;
  }

  return prompt;
}

export async function runAgentTurn(
  history: AgentChatMessage[],
  message: string,
  knownProfile: OfferContext | null = null,
  campaignContext: CampaignContext | null = null
): Promise<AgentResult> {
  const messages = [
    { role: "system" as const, content: buildSystemPrompt(knownProfile, campaignContext) },
    ...history.map((m) => ({ role: m.role, content: m.content })),
    { role: "user" as const, content: message },
  ];

  const tools: Array<{
    type: "function";
    function: { name: string; description: string; parameters: Record<string, unknown> };
  }> = [
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
            stepScope: {
              type: "string",
              enum: ["all", "first"],
              description:
                "'all' writes copy for every step (default). 'first' saves the full schedule but only writes the earliest-dated step, for when the user asked for just one step.",
            },
          },
          required: ["templateId", "offerName", "price", "audience", "whatTheyGet", "tone", "webinarDate"],
        },
      },
    },
  ];

  const validStepIds = new Set(campaignContext?.steps.map((s) => s.templateStepId) ?? []);
  if (campaignContext && campaignContext.steps.length > 0) {
    tools.push({
      type: "function",
      function: {
        name: "edit_step",
        description:
          "Change one existing step's copy in the campaign currently open in the builder. One change at a time, never a full rewrite.",
        parameters: {
          type: "object",
          properties: {
            templateStepId: {
              type: "string",
              enum: Array.from(validStepIds),
              description: "The exact templateStepId of the step to change.",
            },
            instruction: {
              type: "string",
              description: "A short, specific instruction describing the one thing to change.",
            },
          },
          required: ["templateStepId", "instruction"],
        },
      },
    });
  }

  const response = await getOpenAIClient().chat.completions.create({
    model: UTILITY_MODEL,
    max_tokens: 400,
    messages,
    tools,
  });

  const choice = response.choices[0];
  const toolCalls = choice?.message?.tool_calls;

  if (toolCalls && toolCalls.length > 0) {
    const call = toolCalls[0];
    if (call.type !== "function") {
      throw new Error("Unexpected tool call type from the agent.");
    }
    let args: unknown;
    try {
      args = JSON.parse(call.function.arguments);
    } catch {
      throw new Error("The agent's tool call wasn't valid JSON.");
    }

    if (call.function.name === "edit_step") {
      const parsed = editStepArgsSchema.safeParse(args);
      if (!parsed.success) {
        throw new Error(`Tool call didn't match the expected shape: ${parsed.error.message}`);
      }
      if (!validStepIds.has(parsed.data.templateStepId)) {
        throw new Error("The agent picked a step that isn't in this campaign.");
      }
      return {
        reply: choice.message.content?.trim() || "Updating that now.",
        toolCall: { name: "edit_step", arguments: parsed.data },
      };
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
