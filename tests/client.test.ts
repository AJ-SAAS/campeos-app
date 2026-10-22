import { test } from "node:test";
import assert from "node:assert/strict";
import { chat, setOpenAIClientForTests, UTILITY_MODEL, COPY_MODEL } from "../lib/ai/client";

type Call = { model: string; max_completion_tokens: number; reasoning_effort?: string };

function fake(script: (call: Call, n: number) => unknown) {
  const calls: Call[] = [];
  setOpenAIClientForTests({
    chat: {
      completions: {
        create: async (body: Call) => {
          calls.push({ ...body });
          const out = script(body, calls.length);
          if (out instanceof Error) throw out;
          return out;
        },
      },
    },
  });
  return calls;
}
const reply = (content: string | null, finish = "stop") => ({ model: "x", choices: [{ finish_reason: finish, message: { content } }] });
const httpError = (status: number, message: string) => Object.assign(new Error(message), { status });
const ask = (model: string) => chat({ model, maxTokens: 500, messages: [{ role: "user", content: "hi" }] });

test("quick jobs ask for low thinking and get plenty of room", async () => {
  const calls = fake(() => reply("ok"));
  const res = await ask(UTILITY_MODEL);
  assert.equal(res.choices[0].message.content, "ok");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].reasoning_effort, "low");
  assert.ok(calls[0].max_completion_tokens >= 8000);
});

test("copy asks for medium thinking", async () => {
  const calls = fake(() => reply("ok"));
  await ask(COPY_MODEL);
  assert.equal(calls[0].reasoning_effort, "medium");
});

test("ran out of room: retries the same model with less thinking, no fallback", async () => {
  const calls = fake((c, n) => (n === 1 ? reply(null, "length") : reply("second try")));
  const res = await ask(UTILITY_MODEL);
  assert.equal(res.choices[0].message.content, "second try");
  assert.equal(calls.length, 2);
  assert.equal(calls[1].model, UTILITY_MODEL);
  assert.equal(calls[1].reasoning_effort, "low");
  assert.ok(calls[1].max_completion_tokens > calls[0].max_completion_tokens);
});

test("still nothing: falls back to the old model", async () => {
  const calls = fake((c) => (c.model === UTILITY_MODEL ? reply(null, "length") : reply("from fallback")));
  const res = await ask(UTILITY_MODEL);
  assert.equal(res.choices[0].message.content, "from fallback");
  assert.equal(calls.at(-1)!.model, "gpt-4o-mini");
  assert.equal(calls.at(-1)!.reasoning_effort, undefined, "old models never get reasoning_effort");
});

test("model doesn't take reasoning_effort: same model again without it", async () => {
  const calls = fake((c) => (c.reasoning_effort ? httpError(400, "Unsupported parameter: reasoning_effort") : reply("ok")));
  const res = await ask(COPY_MODEL);
  assert.equal(res.choices[0].message.content, "ok");
  assert.equal(calls.length, 2);
  assert.equal(calls[1].model, COPY_MODEL);
});

test("model not available: falls back to gpt-4o", async () => {
  const calls = fake((c) => (c.model === COPY_MODEL ? httpError(404, "model not found") : reply("ok")));
  const res = await ask(COPY_MODEL);
  assert.equal(res.choices[0].message.content, "ok");
  assert.equal(calls.at(-1)!.model, "gpt-4o");
});

test("a real outage is not hidden", async () => {
  fake(() => httpError(500, "server error"));
  await assert.rejects(() => ask(COPY_MODEL));
});

test("a campaign's calls share one cache key", async () => {
  const calls = fake(() => reply("ok"));
  await chat({ model: COPY_MODEL, maxTokens: 500, cacheKey: "cmp-abc", messages: [{ role: "user", content: "hi" }] });
  assert.equal((calls[0] as Call & { prompt_cache_key?: string }).prompt_cache_key, "cmp-abc");
});

test("an account that rejects the cache key: same model, without it", async () => {
  const calls = fake((c) =>
    (c as Call & { prompt_cache_key?: string }).prompt_cache_key ? httpError(400, "Unrecognized request argument: prompt_cache_key") : reply("ok")
  );
  const res = await chat({ model: COPY_MODEL, maxTokens: 500, cacheKey: "cmp-abc", messages: [{ role: "user", content: "hi" }] });
  assert.equal(res.choices[0].message.content, "ok");
  assert.equal(calls.at(-1)!.model, COPY_MODEL, "no fallback to the old model");
});
