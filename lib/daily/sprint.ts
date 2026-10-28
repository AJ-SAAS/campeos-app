// Daily Reps: a focused work sprint. Eos plans it, you do it.
//
// Everything here is plain logic with no screens and no database, so it can
// be tested on its own. The rule it is built around: making a draft is not
// the same as doing the work. A task only counts when you say you did it
// (a post published, a person messaged), never when something was written.

export type FocusId = "balanced" | "customers" | "attention";
export type IntensityId = "gentle" | "steady" | "push";
export type TaskKind = "content" | "prospect" | "engage" | "followup";
export type ChannelId = "linkedin" | "x" | "reddit";

export const SPRINT_MINUTES = 60;

export const FOCUSES: { id: FocusId; title: string; sub: string; split: Record<TaskKind, number> }[] = [
  { id: "balanced", title: "Balanced growth", sub: "Content, outreach and sales", split: { content: 20, prospect: 20, engage: 10, followup: 10 } },
  { id: "customers", title: "Get customers", sub: "Prospecting and conversations", split: { content: 10, prospect: 25, engage: 10, followup: 15 } },
  { id: "attention", title: "Build attention", sub: "Content and being seen", split: { content: 30, prospect: 10, engage: 15, followup: 5 } },
];

export const INTENSITIES: { id: IntensityId; title: string; sub: string; factor: number }[] = [
  { id: "gentle", title: "Gentle", sub: "Getting started", factor: 0.6 },
  { id: "steady", title: "Steady", sub: "A solid hour", factor: 1 },
  { id: "push", title: "Push", sub: "You've done this before", factor: 1.5 },
];

export const CHANNELS: { id: ChannelId; title: string; sub: string }[] = [
  { id: "linkedin", title: "LinkedIn", sub: "Professional post" },
  { id: "x", title: "X / Threads", sub: "Short post or thread" },
  { id: "reddit", title: "Reddit", sub: "Community discussion" },
];

export interface Subtask {
  id: string;
  title: string;
  minutes: number;
  how: string;
}

export interface SprintTask {
  id: string;
  kind: TaskKind;
  tag: string;
  title: string;
  minutes: number;
  /** How many of the thing to do. */
  target: number;
  unit: string;
  /** What "done" means, said plainly. */
  done: string;
  blurb: string;
}

export interface SprintPlan {
  minutes: number;
  focus: FocusId;
  intensity: IntensityId;
  tasks: SprintTask[];
}

// How much of each thing fits in a minute at a steady pace.
const RATE: Record<TaskKind, number> = { content: 0.15, prospect: 0.75, engage: 1, followup: 0.5 };

const TASK_TEXT: Record<TaskKind, { tag: string; title: string; unit: string; done: string; blurb: (n: number) => string }> = {
  content: {
    tag: "Attention",
    title: "Create and publish",
    unit: "posts published",
    done: "Each post is live and you pasted its link.",
    blurb: (n) => `Turn one idea into ${n} ${n === 1 ? "post" : "posts"}. Write it, edit it and publish it.`,
  },
  prospect: {
    tag: "Leads",
    title: "Reach out to people",
    unit: "people messaged",
    done: "You sent each message yourself.",
    blurb: (n) => `Find ${n} ${n === 1 ? "person" : "people"} who could use your offer. Read their page, then send a message that fits them.`,
  },
  engage: {
    tag: "Visibility",
    title: "Join the conversation",
    unit: "useful comments",
    done: "Each comment is posted and adds something real.",
    blurb: (n) => `Leave ${n} helpful ${n === 1 ? "comment" : "comments"} where your buyers hang out. Help first. No pitching.`,
  },
  followup: {
    tag: "Convert",
    title: "Follow up",
    unit: "follow-ups sent",
    done: "Each follow-up is sent.",
    blurb: (n) => `Reply to ${n} ${n === 1 ? "person" : "people"} from before. Most sales happen on the second or third message.`,
  },
};

const ORDER: TaskKind[] = ["content", "prospect", "engage", "followup"];

/** Builds the sprint: which tasks, how long each, how many of each. */
export function buildSprint(opts: { minutes?: number; focus: FocusId; intensity: IntensityId }): SprintPlan {
  const minutes = opts.minutes ?? SPRINT_MINUTES;
  const focus = FOCUSES.find((f) => f.id === opts.focus) ?? FOCUSES[0];
  const factor = (INTENSITIES.find((i) => i.id === opts.intensity) ?? INTENSITIES[1]).factor;
  const scale = minutes / SPRINT_MINUTES;
  const tasks = ORDER.map((kind, i): SprintTask => {
    const m = Math.max(5, Math.round((focus.split[kind] * scale) / 5) * 5);
    const target = Math.max(1, Math.round(m * RATE[kind] * factor));
    const t = TASK_TEXT[kind];
    return {
      id: kind,
      kind,
      tag: `${String(i + 1).padStart(2, "0")} · ${t.tag}`,
      title: t.title,
      minutes: m,
      target,
      unit: t.unit,
      done: t.done,
      blurb: t.blurb(target),
    };
  });
  return { minutes, focus: opts.focus, intensity: opts.intensity, tasks };
}

// ---------- Guided steps ----------

const PLAYBOOKS: Record<ChannelId, Subtask[]> = {
  linkedin: [
    { id: "hook", title: "Pick one idea and a strong first line", minutes: 2, how: "Choose one problem your buyers have. The first line should make them stop scrolling. Say it the way you would say it out loud." },
    { id: "write", title: "Write the post", minutes: 4, how: "Short lines. One idea. A real example or a number you can stand behind. End with one question people can answer." },
    { id: "edit", title: "Edit for your voice", minutes: 2, how: "Cut anything that sounds like an ad. Add one thing only you would know. Check every fact." },
    { id: "publish", title: "Publish it and paste the link", minutes: 2, how: "Post when your audience is online. Then reply to the first comments quickly." },
  ],
  x: [
    { id: "hook", title: "Pick the one thing to say", minutes: 1, how: "One lesson, one result or one opinion. If it needs a lot of setup, make it a thread." },
    { id: "write", title: "Write the post or thread", minutes: 3, how: "Post one: the lesson in one sentence. Thread: one point per post, each one easy to read alone." },
    { id: "edit", title: "Tighten it", minutes: 2, how: "Cut filler words. Make the first post work on its own." },
    { id: "publish", title: "Publish it and paste the link", minutes: 2, how: "Post it, then reply to anyone who answers in the first hour." },
  ],
  reddit: [
    { id: "find", title: "Find a discussion you can help with", minutes: 2, how: "Pick a community where your buyers ask questions. Read its rules first. Look for a recent thread, not an old one." },
    { id: "angle", title: "Choose how you will help", minutes: 1, how: "Answer one specific question, share a lesson you learned, or explain a simple framework." },
    { id: "write", title: "Write a natural, useful post", minutes: 3, how: "Write like a person in the community, not a brand. Share your own experience. Leave out links and selling." },
    { id: "publish", title: "Check the rules, publish and paste the link", minutes: 2, how: "Remove anything promotional. Post only if the rules allow it." },
  ],
};

const PROSPECT_STEPS: Subtask[] = [
  { id: "who", title: "Write down who you are looking for", minutes: 2, how: "One sentence. For example: coaches who run webinars. The clearer it is, the faster the search." },
  { id: "find", title: "Make a list of people", minutes: 8, how: "Search LinkedIn, X or communities for your buyer. Look for people who posted lately and who clearly sell something." },
  { id: "read", title: "Read before you write", minutes: 3, how: "Open each person's page. Find one real detail to mention: a post, a launch or a result." },
  { id: "send", title: "Send each message yourself", minutes: 7, how: "Say who you are in one line. Mention the detail. Ask one easy question. Do not paste the same text to everyone." },
];

const ENGAGE_STEPS: Subtask[] = [
  { id: "find", title: "Find live conversations", minutes: 3, how: "Look for recent posts from people your buyers follow, or threads where someone asks for help." },
  { id: "comment", title: "Add something useful", minutes: 5, how: "Share a tip, a short story or a question that moves the talk forward. Two or three sentences is plenty." },
  { id: "note", title: "Note who might need your offer", minutes: 2, how: "If someone describes the problem you solve, write their name down for tomorrow's outreach." },
];

const FOLLOWUP_STEPS: Subtask[] = [
  { id: "list", title: "List the conversations that went quiet", minutes: 2, how: "Look at who you messaged or talked to in the last two weeks and did not hear back from." },
  { id: "pick", title: "Pick the situation for each one", minutes: 2, how: "Use the guide below. The right message depends on where they are." },
  { id: "send", title: "Send each follow-up yourself", minutes: 5, how: "Change the name and one detail so it sounds like you. Then send it." },
  { id: "next", title: "Set the next follow-up", minutes: 1, how: "Decide when you will check again. Two to four days is normal." },
];

/** The guided steps for a task. Content depends on where you will publish. */
export function subtasksFor(kind: TaskKind, channels: ChannelId[] = []): Subtask[] {
  if (kind === "content") {
    return channels.flatMap((c) =>
      PLAYBOOKS[c].map((s) => ({ ...s, id: `${c}:${s.id}`, title: `${s.title}` }))
    );
  }
  if (kind === "prospect") return PROSPECT_STEPS;
  if (kind === "engage") return ENGAGE_STEPS;
  return FOLLOWUP_STEPS;
}

export function channelTitle(id: ChannelId): string {
  return CHANNELS.find((c) => c.id === id)?.title ?? id;
}

/** Which channels start ticked: the ones they already use, then the rest. */
export function defaultChannels(userChannels: string[], target: number): ChannelId[] {
  const supported = CHANNELS.map((c) => c.id);
  const own = supported.filter((c) => userChannels.includes(c === "x" ? "x" : c));
  const rest = supported.filter((c) => !own.includes(c));
  return [...own, ...rest].slice(0, Math.max(1, Math.min(target, supported.length)));
}

// ---------- Follow-up scenarios ----------

export interface Scenario {
  id: string;
  label: string;
  goal: string;
  message: string;
  guidance: string;
}

export const SCENARIOS: Scenario[] = [
  {
    id: "quiet",
    label: "They haven't replied",
    goal: "Restart the chat without any pressure.",
    message: "Hey [NAME], I wanted to follow up on my last message. Is [THE THING YOU HELP WITH] something you are working on right now? No worries at all if it's not a priority.",
    guidance: "Wait two to four days. Send one or two nudges, then stop. Do not keep messaging someone who stays quiet.",
  },
  {
    id: "interested",
    label: "They're interested",
    goal: "Make the next step easy.",
    message: "Great to hear, [NAME]. The easiest next step is [A CALL, A DEMO OR A LINK]. Does [DAY] work for you? If not, tell me what does.",
    guidance: "Offer one clear next step, not three. Reply fast while they are warm.",
  },
  {
    id: "objection",
    label: "They have an objection",
    goal: "Understand it before you answer it.",
    message: "That's fair, [NAME]. Can I ask what worries you most about [THEIR CONCERN]? I want to be sure this is a good fit before you spend anything.",
    guidance: "Ask first. Then answer with a real fact or a short story. Never invent a result or a customer.",
  },
  {
    id: "demo",
    label: "They saw it but haven't bought",
    goal: "Find out what is holding them back.",
    message: "Hi [NAME], thanks again for taking the time to look at [YOUR OFFER]. Is there anything you are still unsure about? I'm happy to answer it.",
    guidance: "Keep it short and warm. The goal is a reply, not a pitch.",
  },
  {
    id: "later",
    label: "They said maybe later",
    goal: "Stay in touch without nagging.",
    message: "Totally understand, [NAME]. Would it help if I checked back in [A MONTH FROM NOW]? In the meantime, here is [A USEFUL LINK OR TIP].",
    guidance: "Write the date in your notes. Come back when you said you would.",
  },
  {
    id: "customer",
    label: "They became a customer",
    goal: "Make them glad they bought.",
    message: "Welcome aboard, [NAME]. Thank you for trusting me with this. If you hit any snag in your first week, reply here and I'll sort it out.",
    guidance: "Help them get a first win fast. Later, ask for honest feedback. Only share a testimonial they actually gave you.",
  },
];

// ---------- A running sprint ----------

export interface SprintSession {
  /** Bumped if the shape changes, so old saved sessions are ignored. */
  v: 1;
  date: string; // yyyy-mm-dd, the day it started
  startedAt: number; // ms
  endsAt: number; // ms
  plan: SprintPlan;
  channels: ChannelId[];
  /** Ticked guided steps, by id. */
  steps: Record<string, boolean>;
  /** How many have been done, by task id. */
  counts: Record<string, number>;
}

export function newSession(plan: SprintPlan, now: number, channels: ChannelId[], date: string): SprintSession {
  return { v: 1, date, startedAt: now, endsAt: now + plan.minutes * 60_000, plan, channels, steps: {}, counts: {} };
}

/** Posts published: one per ticked "publish" step on a chosen channel. */
export function publishedCount(s: SprintSession): number {
  return s.channels.filter((c) => s.steps[`${c}:publish`]).length;
}

export function doneCount(s: SprintSession, task: SprintTask): number {
  return task.kind === "content" ? publishedCount(s) : Math.max(0, s.counts[task.id] ?? 0);
}

export function taskComplete(s: SprintSession, task: SprintTask): boolean {
  return doneCount(s, task) >= task.target;
}

export function tasksCompleted(s: SprintSession): number {
  return s.plan.tasks.filter((t) => taskComplete(s, t)).length;
}

/** 0 to 100: how much of the planned work is done (not how much time has passed). */
export function workPercent(s: SprintSession): number {
  const total = s.plan.tasks.reduce((n, t) => n + t.target, 0);
  if (total <= 0) return 0;
  const done = s.plan.tasks.reduce((n, t) => n + Math.min(doneCount(s, t), t.target), 0);
  return Math.round((done / total) * 100);
}

export function remainingMs(endsAt: number, now: number): number {
  return Math.max(0, endsAt - now);
}

/** 52:18, or 1:02:00 past an hour. */
export function clock(ms: number): string {
  const total = Math.ceil(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const sec = total % 60;
  const mm = String(m).padStart(h > 0 ? 2 : 1, "0");
  return `${h > 0 ? `${h}:` : ""}${mm}:${String(sec).padStart(2, "0")}`;
}

/** Always minutes and seconds, so a full hour reads 60:00 and fits in a ring. */
export function clockMinSec(ms: number): string {
  const total = Math.ceil(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

export function minutesSpent(s: SprintSession, now: number): number {
  return Math.min(s.plan.minutes, Math.max(0, Math.round((now - s.startedAt) / 60_000)));
}

/** A saved session that is still usable: right shape, and not left over from another day. */
export function parseSession(raw: string | null, today: string, now: number): SprintSession | null {
  if (!raw) return null;
  try {
    const s = JSON.parse(raw) as SprintSession;
    if (s?.v !== 1 || !s.plan?.tasks?.length || typeof s.startedAt !== "number" || typeof s.endsAt !== "number") return null;
    if (s.date !== today) return null;
    // Left open for hours after it should have ended: let it go.
    if (now - s.endsAt > 6 * 3600_000) return null;
    return s;
  } catch {
    return null;
  }
}

// ---------- Yesterday's leftovers and the running total ----------

/** A saved session of any day, as long as it has the right shape. */
export function parseAnySession(raw: string | null): SprintSession | null {
  if (!raw) return null;
  try {
    const s = JSON.parse(raw) as SprintSession;
    if (s?.v !== 1 || !s.plan?.tasks?.length || typeof s.startedAt !== "number" || typeof s.endsAt !== "number" || typeof s.date !== "string") return null;
    return s;
  } catch {
    return null;
  }
}

/** True when the session has real work in it (something published or counted). */
export function sessionHasWork(s: SprintSession): boolean {
  return publishedCount(s) > 0 || Object.values(s.counts).some((n) => n > 0);
}

/** A session from an earlier day, or one left open long past its end. It is
 * not today's reps any more: whatever was done gets counted, then it goes. */
export function isStale(s: SprintSession, today: string, now: number): boolean {
  return s.date !== today || now - s.endsAt > 6 * 3600_000;
}

// ---------- Results ----------

export interface SprintResults {
  published: number;
  contacted: number;
  comments: number;
  followUps: number;
  replies: number;
  sales: number;
}

export function resultsFrom(s: SprintSession, extra: { replies: number; sales: number }): SprintResults {
  const n = (id: string) => Math.max(0, s.counts[id] ?? 0);
  return {
    published: publishedCount(s),
    contacted: n("prospect"),
    comments: n("engage"),
    followUps: n("followup"),
    replies: Math.max(0, Math.floor(extra.replies) || 0),
    sales: Math.max(0, Math.floor(extra.sales) || 0),
  };
}

/** Every real action in a sprint: posts, messages, comments, follow-ups. */
export function repsOf(r: SprintResults): number {
  return r.published + r.contacted + r.comments + r.followUps;
}

/** All the reps ever done. This one never resets; only today's sprint does. */
export function totalReps(records: { results: SprintResults }[]): number {
  return records.reduce((n, r) => n + repsOf(r.results), 0);
}

/** One line from Eos while the sprint runs, based on how far along you are. */
export function coachLine(pct: number, over: boolean): string {
  if (over) return pct >= 100 ? "All of it, done. Go log it." : "Time's up. Finish what you're on, then log it.";
  if (pct >= 100) return "Every rep done. That's a full hour of real work.";
  if (pct >= 75) return "Last stretch. Finish strong.";
  if (pct >= 50) return "Halfway there. Keep the pace.";
  if (pct >= 20) return "You're moving. Keep stacking reps.";
  if (pct > 0) return "First rep done. The rest get easier.";
  return "Start with the first step. Momentum does the rest.";
}

/** The button label for logging one rep of a count-based task. */
export function logLabel(kind: TaskKind): string {
  if (kind === "prospect") return "I messaged one person";
  if (kind === "engage") return "I posted a comment";
  if (kind === "followup") return "I sent a follow-up";
  return "I published one";
}

/** What Eos says about how it went. Never scolds a light day. */
export function sprintVerdict(s: SprintSession): { title: string; sub: string } {
  const done = tasksCompleted(s);
  const total = s.plan.tasks.length;
  const pct = workPercent(s);
  if (done === total) return { title: "Reps done.", sub: "You did all of it. That is how it compounds." };
  if (pct >= 50) return { title: "Solid sprint.", sub: "More than half the work is done. That is how momentum builds." };
  if (pct > 0) return { title: "You showed up.", sub: "Some work beats none. Try a gentler plan if the hour felt too big." };
  return { title: "Nothing logged today.", sub: "That's okay. Come back tomorrow, even for a lighter sprint." };
}

// ---------- Streak ----------

export function dateKey(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Days in a row with a sprint, counting back from today (or yesterday, so
 * the streak is still alive until the day is over). */
export function streakDays(dates: string[], today: string): number {
  const set = new Set(dates);
  const [y, m, d] = today.split("-").map(Number);
  const cursor = new Date(y, m - 1, d);
  if (!set.has(dateKey(cursor))) cursor.setDate(cursor.getDate() - 1);
  let n = 0;
  while (set.has(dateKey(cursor))) {
    n++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return n;
}
