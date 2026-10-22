import OpenAI from "openai";

// Server-side only. Never import this file from a client component — the
// API key must never reach the browser bundle.
let client: OpenAI | null = null;

/** Tests only: use a fake OpenAI client. */
export function setOpenAIClientForTests(fake: unknown): void {
  client = fake as OpenAI | null;
}

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

// Two tiers, not one model for everything. The copy a subscriber reads
// uses the strongest writing model; backend-only jobs (call themes, the
// agent's chat replies, the quality critic) use the cheap fast one.
//
// Oct 2026: moved off gpt-4o (deprecated, retires Jan 14 2027) to the
// GPT-6 family. Both are overridable from Vercel env vars without a code
// change, and every call falls back to the old model if the new one
// errors, so a model problem never stops a campaign from being written.

/** Everything the end user actually reads: campaign copy, variations,
 * the buyer brief, and quality rewrites. */
export let COPY_MODEL = process.env.OPENAI_COPY_MODEL || "gpt-6-sol";

/** Test script only: write copy with a different model. */
export function setCopyModel(model: string): void {
  COPY_MODEL = model;
}

/** Backend-only jobs where speed/cost matter more than prose quality. */
export const UTILITY_MODEL = process.env.OPENAI_UTILITY_MODEL || "gpt-6-luna";

const FALLBACK_COPY_MODEL = process.env.OPENAI_FALLBACK_COPY_MODEL || "gpt-4o";
const FALLBACK_UTILITY_MODEL = process.env.OPENAI_FALLBACK_UTILITY_MODEL || "gpt-4o-mini";

type ChatParams = OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming;

/** $ per 1M tokens: [input, output]. Cached input is billed at 10%. Used
 * only for the cost report in scripts/eval-campaign.ts. */
export const PRICES: Record<string, [number, number]> = {
  "gpt-6-sol": [2, 10],
  "gpt-6.1-sol": [2, 10],
  "gpt-6-luna": [0.1, 0.5],
  "gpt-4o": [2.5, 10],
  "gpt-4o-mini": [0.15, 0.6],
};

/** Running token totals per model since the process started (or since
 * the last reset). Server requests don't read it; the test script does. */
export const usageMeter: Record<string, { input: number; cached: number; output: number; calls: number }> = {};

export function resetUsageMeter(): void {
  for (const k of Object.keys(usageMeter)) delete usageMeter[k];
}

export function meterCost(): number {
  let total = 0;
  for (const [model, u] of Object.entries(usageMeter)) {
    const [inp, out] = PRICES[model] ?? PRICES["gpt-6-sol"];
    total += ((u.input - u.cached) * inp + u.cached * inp * 0.1 + u.output * out) / 1_000_000;
  }
  return total;
}

function record(res: { model?: string; usage?: OpenAI.CompletionUsage | null }, asked: string): void {
  const u = res.usage;
  if (!u) return;
  const key = Object.keys(PRICES).find((m) => (res.model ?? "").startsWith(m)) ?? asked;
  const m = (usageMeter[key] ??= { input: 0, cached: 0, output: 0, calls: 0 });
  m.input += u.prompt_tokens ?? 0;
  m.cached += (u as { prompt_tokens_details?: { cached_tokens?: number } }).prompt_tokens_details?.cached_tokens ?? 0;
  m.output += u.completion_tokens ?? 0;
  m.calls += 1;
}
type ChatResult = OpenAI.Chat.Completions.ChatCompletion;

/** Newer models think before they answer, and that thinking counts
 * against the token limit. */
function isThinking(model: string): boolean {
  return /^(gpt-5|gpt-6|o\d)/.test(model);
}

/** Room for the thinking plus the answer. Too little and the model runs
 * out before it writes anything (finish_reason "length"). */
function tokenBudget(model: string, maxTokens: number): number {
  return isThinking(model) ? Math.max(maxTokens * 6, 8000) : maxTokens;
}

type Effort = "low" | "medium" | "high";

/**
 * One chat completion, with an automatic retry on the older model if the
 * new one is unavailable, rejects a parameter, or runs out of room
 * before answering. Use instead of calling the client directly.
 */
/** Tests only (tests/*.test.ts): answer every chat() call with a stand-in
 * instead of OpenAI, so the whole pipeline can be checked offline. */
type ChatOverride = (params: { model: string; messages: ChatParams["messages"] }) => string | Promise<string>;
let chatOverride: ChatOverride | null = null;
export function setChatOverride(fn: ChatOverride | null): void {
  chatOverride = fn;
}

export async function chat(
  params: Omit<ChatParams, "max_tokens" | "max_completion_tokens"> & {
    maxTokens: number;
    effort?: Effort;
    /** Same key for every call in one campaign, so OpenAI sends them to the
     * same machine and the shared prompt start is billed at the cached rate.
     * Without it, calls made in parallel land on different machines and
     * nothing caches (Oct 2026 eval: 0 cached tokens). */
    cacheKey?: string;
  }
): Promise<ChatResult> {
  const { maxTokens, effort: _effort, cacheKey, ...rest } = params;
  if (chatOverride) {
    const content = await chatOverride({ model: rest.model, messages: rest.messages });
    return {
      id: "test",
      object: "chat.completion",
      created: 0,
      model: rest.model,
      choices: [{ index: 0, finish_reason: "stop", logprobs: null, message: { role: "assistant", content, refusal: null } }],
    } as ChatResult;
  }
  const fallback =
    rest.model === COPY_MODEL ? FALLBACK_COPY_MODEL : rest.model === UTILITY_MODEL ? FALLBACK_UTILITY_MODEL : null;
  // Quick jobs (the quality check, reading insights) don't need deep
  // thinking; the copy itself gets a bit more.
  const effort: Effort = params.effort ?? (rest.model === UTILITY_MODEL ? "low" : "medium");
  const client = getOpenAIClient();

  let useCacheKey = Boolean(cacheKey);
  const attempt = async (model: string, budget: number, withEffort: Effort | null): Promise<ChatResult> => {
    const body = { ...rest, model, max_completion_tokens: budget } as ChatParams & { reasoning_effort?: Effort; prompt_cache_key?: string };
    delete (body as { effort?: unknown }).effort;
    if (withEffort && isThinking(model)) body.reasoning_effort = withEffort;
    if (useCacheKey) body.prompt_cache_key = cacheKey;
    let res: ChatResult;
    try {
      res = await client.chat.completions.create(body as ChatParams);
    } catch (err) {
      // An account or model that doesn't know the cache key: same call without it.
      if (useCacheKey && (err as { status?: number }).status === 400 && /prompt_cache/i.test((err as Error).message ?? "")) {
        useCacheKey = false;
        delete body.prompt_cache_key;
        res = await client.chat.completions.create(body as ChatParams);
      } else {
        throw err;
      }
    }
    record(res, model);
    return res;
  };
  const empty = (res: ChatResult) => {
    const m = res.choices[0]?.message;
    return !m?.content && !m?.tool_calls?.length;
  };
  const toFallback = async (why: string): Promise<ChatResult> => {
    console.warn(`[ai] ${rest.model} ${why}; retrying on ${fallback}`);
    return attempt(fallback as string, maxTokens, null);
  };

  let res: ChatResult;
  try {
    try {
      res = await attempt(rest.model, tokenBudget(rest.model, maxTokens), effort);
    } catch (err) {
      // A model that doesn't take reasoning_effort: same model, without it.
      if ((err as { status?: number }).status === 400 && /reasoning/i.test((err as Error).message ?? "")) {
        res = await attempt(rest.model, tokenBudget(rest.model, maxTokens), null);
      } else {
        throw err;
      }
    }
    if (empty(res) && res.choices[0]?.finish_reason === "length" && isThinking(rest.model)) {
      // Ran out of room thinking: once more with less thinking and more room.
      res = await attempt(rest.model, tokenBudget(rest.model, maxTokens) * 2, "low");
    }
  } catch (err) {
    const status = (err as { status?: number }).status;
    if (fallback && fallback !== rest.model && (status === 400 || status === 404 || status === 403)) {
      return toFallback(`failed (${status}: ${(err as Error).message})`);
    }
    throw err;
  }
  if (empty(res) && fallback && fallback !== rest.model) {
    return toFallback(`returned nothing (${res.choices[0]?.finish_reason})`);
  }
  return res;
}
