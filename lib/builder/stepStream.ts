// Reads the line-by-line answer from /api/generate-step (stream: true).
// Each line is one JSON object: a written step, then a last "done" line,
// or an "error" line if the whole run fell over.

export type StepCopy = Record<string, string>;

export interface StreamDone {
  failed: { templateStepId: string; error: string }[];
  brief?: unknown;
}

/** Turns chunks of text into complete lines, keeping any half line for later. */
export function splitLines(buffer: string, chunk: string): { lines: string[]; rest: string } {
  const parts = (buffer + chunk).split("\n");
  const rest = parts.pop() ?? "";
  return { lines: parts.filter((l) => l.trim()), rest };
}

/** Handles one line. Returns the "done" payload when that line arrives. */
export function handleLine(
  line: string,
  onStep: (templateStepId: string, copy: StepCopy) => void
): StreamDone | null {
  let msg: { type?: string; [k: string]: unknown };
  try {
    msg = JSON.parse(line);
  } catch {
    return null;
  }
  if (msg.type === "step" && typeof msg.templateStepId === "string" && msg.copy && typeof msg.copy === "object") {
    onStep(msg.templateStepId, msg.copy as StepCopy);
    return null;
  }
  if (msg.type === "error") {
    throw new Error(typeof msg.error === "string" ? msg.error : "Writing that didn't work. Try again in a minute.");
  }
  if (msg.type === "done") {
    return { failed: Array.isArray(msg.failed) ? (msg.failed as StreamDone["failed"]) : [], brief: msg.brief };
  }
  return null;
}

export async function readStepStream(
  res: Response,
  onStep: (templateStepId: string, copy: StepCopy) => void
): Promise<StreamDone> {
  if (!res.body) throw new Error("Writing that didn't work. Try again in a minute.");
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let rest = "";
  let done: StreamDone | null = null;
  for (;;) {
    const { value, done: finished } = await reader.read();
    const split = splitLines(rest, value ? decoder.decode(value, { stream: !finished }) : "");
    rest = split.rest;
    for (const line of split.lines) done = handleLine(line, onStep) ?? done;
    if (finished) break;
  }
  if (rest.trim()) done = handleLine(rest, onStep) ?? done;
  // The stream ended with no "done" line: the connection dropped. Keep
  // what arrived rather than throwing it away.
  return done ?? { failed: [] };
}
