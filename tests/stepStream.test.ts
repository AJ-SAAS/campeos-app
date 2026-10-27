import test from "node:test";
import assert from "node:assert/strict";
import { readStepStream, splitLines } from "../lib/builder/stepStream";

function streamOf(chunks: string[]): Response {
  const enc = new TextEncoder();
  return new Response(
    new ReadableStream({
      start(c) {
        for (const ch of chunks) c.enqueue(enc.encode(ch));
        c.close();
      },
    })
  );
}

test("splitLines keeps a half line for the next chunk", () => {
  const a = splitLines("", '{"a":1}\n{"b"');
  assert.deepEqual(a.lines, ['{"a":1}']);
  assert.equal(a.rest, '{"b"');
  const b = splitLines(a.rest, ":2}\n");
  assert.deepEqual(b.lines, ['{"b":2}']);
  assert.equal(b.rest, "");
});

test("steps arrive one by one, lines split across chunks", async () => {
  const seen: string[] = [];
  const line1 = JSON.stringify({ type: "step", templateStepId: "a", copy: { f1: "x" } }) + "\n";
  const line2 = JSON.stringify({ type: "step", templateStepId: "b", copy: { f1: "y" } }) + "\n";
  const done = JSON.stringify({ type: "done", failed: [{ templateStepId: "c", error: "no" }], brief: { k: 1 } }) + "\n";
  const res = streamOf([line1.slice(0, 20), line1.slice(20) + line2, done]);
  const out = await readStepStream(res, (id) => seen.push(id));
  assert.deepEqual(seen, ["a", "b"]);
  assert.equal(out.failed.length, 1);
  assert.deepEqual(out.brief, { k: 1 });
});

test("an error line throws", async () => {
  const res = streamOf([JSON.stringify({ type: "error", error: "Nope." }) + "\n"]);
  await assert.rejects(() => readStepStream(res, () => {}), /Nope/);
});

test("a dropped stream keeps what arrived", async () => {
  const seen: string[] = [];
  const res = streamOf([JSON.stringify({ type: "step", templateStepId: "a", copy: { f1: "x" } }) + "\n"]);
  const out = await readStepStream(res, (id) => seen.push(id));
  assert.deepEqual(seen, ["a"]);
  assert.deepEqual(out.failed, []);
});
