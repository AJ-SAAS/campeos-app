import OpenAI from "openai";

// Server-side only. Never import this file from a client component — the
// API key must never reach the browser bundle.
let client: OpenAI | null = null;

export function getOpenAIClient(): OpenAI {
  if (typeof window !== "undefined") {
    throw new Error(
      "getOpenAIClient() was called in the browser. The OpenAI API key " +
        "must only be used from app/api routes."
    );
  }
  if (!client) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error(
        "OPENAI_API_KEY is not set. Copy .env.local.example to " +
          ".env.local and add your key."
      );
    }
    client = new OpenAI({ apiKey });
  }
  return client;
}

// Two tiers, not one model for everything. A real campaign generated on
// gpt-4o-mini came back readable but generic and hedged — exactly what
// the product can't afford to feel like (see CLAUDE.md: "if the user
// gets a hint of generic AI copy, we are done"). The actual marketing
// copy a subscriber reads uses the stronger model; cheaper, lower-stakes
// jobs (pulling themes out of a call transcript, the agent's own chat
// replies) stay on mini, where "good enough" really is good enough and
// the cost difference compounds across a 22-step campaign times however
// many users regenerate.

/** Used for everything the end user actually reads: generateStepCopy and
 * generateStepVariation (lib/ai/generateStepCopy.ts). */
export const COPY_MODEL = "gpt-4o";

/** Used for backend-only jobs where speed/cost matter more than prose
 * quality: pulling themes from a sales call (analyzeSalesCall.ts) and the
 * agent's own conversational replies (agent.ts) — neither is copy a
 * subscriber reads in the finished campaign. */
export const UTILITY_MODEL = "gpt-4o-mini";
