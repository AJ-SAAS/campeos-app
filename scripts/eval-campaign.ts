/*
 * Read real generated copy before users do.
 *
 *   npx tsx scripts/eval-campaign.ts            # all sample offers
 *   npx tsx scripts/eval-campaign.ts yoga       # just one
 *   npx tsx scripts/eval-campaign.ts --all      # every step, not a sample
 *   npx tsx scripts/eval-campaign.ts --luna     # write with the cheap model
 *
 * It also prints what each campaign cost, in real tokens and dollars,
 * scaled up to a full 27-message campaign.
 *
 * Needs OPENAI_API_KEY in .env.local. For each sample offer it builds the
 * buyer brief, writes a spread of webinar messages (the same way the app
 * does: play, focus, sequence, quality check and rewrite), then scores
 * the final copy. Everything is saved to eval-output/<offer>.md so you
 * can read it top to bottom.
 *
 * What "good" looks like: every message scores 7+, no filler warnings,
 * and you can't swap in a different business without it breaking.
 */
import { readFileSync, mkdirSync, writeFileSync, existsSync } from "fs";
import { buildBrief, focusFor } from "../lib/ai/brief";
import { generateStepCopyScored } from "../lib/ai/generateStepCopy";
import { lintCopy } from "../lib/ai/quality";
import { COPY_MODEL, meterCost, resetUsageMeter, setCopyModel, usageMeter } from "../lib/ai/client";
import { getPlay, guessPlay } from "../lib/frameworks/plays";
import { webinarTemplate } from "../lib/templates/webinar";
import type { OfferContext, SourceMaterial, StepContext } from "../lib/ai/prompts";

// --luna: write the copy with the cheap model too, to compare quality and cost.
if (process.argv.includes("--luna")) setCopyModel("gpt-6-luna");

// Load .env.local without extra packages.
if (existsSync(".env.local")) {
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
  }
}

const SAMPLES: Record<string, { offer: OfferContext; source: SourceMaterial & { salesPage?: string } }> = {
  coaching: {
    offer: {
      name: "10 Clients in 30 Days",
      price: "$997",
      audience: "Coaches stuck under $10K a month who post every day and still get no clients",
      whatTheyGet: "Done-for-you Facebook ads, a booking funnel and weekly calls, or we keep working for free until you get 10 clients",
      tone: "Direct, friendly",
      readingLevel: "5th grade",
      fromName: "Ajay",
    },
    source: {
      winningCopy: ["Posting every day and still no clients?", "Book 10 calls a week without cold DMs"],
      callThemes: ["tired of posting for nothing", "wants someone to just tell them what to do", "no time to learn ads"],
    },
  },
  yoga: {
    offer: {
      name: "Beginner Yoga in 21 Days",
      price: "$49",
      audience: "Busy women over 40 who feel stiff and have never done yoga",
      whatTheyGet: "21 short follow-along videos, 15 minutes a day, no flexibility needed",
      tone: "Warm, calm",
      readingLevel: "5th grade",
      fromName: "Maya",
    },
    source: { winningCopy: [], callThemes: [] },
  },
  // Thin input on purpose: new users type short answers. The ad for this
  // one used to read like it could sell anything (Oct 2026 walkthrough).
  dfy: {
    offer: {
      name: "Done-for-you Facebook ads",
      price: "$99",
      audience: "Local gym owners",
      whatTheyGet: "We build and run your Facebook ads for you",
      tone: "Friendly",
      readingLevel: "5th grade",
      fromName: "Sam",
    },
    source: { winningCopy: [], callThemes: [] },
  },
  rentals: {
    offer: {
      name: "Rental Property Blueprint",
      price: "$497",
      audience: "Nurses and teachers who want their first rental property but think they need $100K saved first",
      whatTheyGet: "A 6-week online course, a deal analyzer spreadsheet and 2 live Q&A calls, with a 30-day money-back guarantee",
      tone: "Friendly, plain-spoken",
      readingLevel: "5th grade",
      fromName: "Marcus",
    },
    source: {
      winningCopy: ['"I closed on my first duplex 4 months after the course." Dana R., nurse'],
      callThemes: ["scared of picking a bad deal", "thinks you need to be rich", "no time with shift work"],
    },
  },
};

// A spread across the sequence: every play family, not all 27 steps.
const SAMPLE_STEPS = [
  "ad-open",
  "email-invite",
  "sms-save-seat",
  "email-welcome",
  "email-story-time",
  "email-paradigm-shift",
  "email-social-proof",
  "email-takeaway-selling",
  "email-faq",
  "social-last-chance",
];

async function run(key: string, all: boolean) {
  const { offer, source } = SAMPLES[key];
  const event = new Date();
  event.setDate(event.getDate() + 8);
  event.setHours(19, 0, 0, 0);
  const eventAt = event.toLocaleString("en-US", { weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" });

  console.log(`\n=== ${offer.name} (${COPY_MODEL}) ===`);
  resetUsageMeter();
  const t0 = Date.now();
  const brief = await buildBrief({ offer, source, campaignType: webinarTemplate.name, eventAt });
  console.log(`brief built in ${((Date.now() - t0) / 1000).toFixed(1)}s`);

  const ordered = [...webinarTemplate.steps].sort((a, b) => a.offsetHours - b.offsetHours);
  const chosen = all ? ordered : ordered.filter((s) => SAMPLE_STEPS.includes(s.id));
  const phase = (id: string) => webinarTemplate.phases.find((p) => p.id === id);
  const counters: Record<string, number> = {};

  const steps: StepContext[] = chosen.map((t) => {
    const play = getPlay(t.playId) ?? guessPlay(t.channel, t.angle, t.title);
    const n = play ? (counters[play.focus] = (counters[play.focus] ?? -1) + 1) : 0;
    const pos = ordered.findIndex((o) => o.id === t.id);
    const label = (o: typeof t) => `${o.title} (${o.channel}, ${o.angle})`;
    return {
      channel: t.channel,
      title: t.title,
      purpose: t.purpose,
      angle: t.angle,
      goals: t.goals,
      persuasionElements: t.persuasionElements,
      phaseName: phase(t.phaseId)?.name,
      phaseObjective: phase(t.phaseId)?.objective,
      eventAt,
      fields: t.fields,
      play,
      brief,
      focus: play ? focusFor(brief, play.focus, n) : undefined,
      sequence: { position: pos + 1, total: ordered.length, before: ordered.slice(Math.max(0, pos - 2), pos).map(label), after: ordered.slice(pos + 1, pos + 3).map(label) },
    };
  });

  // Same order as the app: the first message alone (warms the prompt
  // cache), then the rest together.
  const scoreOne = async (step: StepContext) => {
      // The score is the editor's grade of the copy the app actually kept,
      // so the eval costs exactly what the app does.
      const r = await generateStepCopyScored(offer, step, source);
      const lint = lintCopy(r.copy, step, `${offer.name} ${offer.audience} ${offer.whatTheyGet}`);
      return { step, copy: r.copy, lint, critic: { score: r.score, problems: r.problems }, rewritten: r.rewritten };
  };
  const first = await scoreOne(steps[0]);
  const results = [first, ...(await Promise.all(steps.slice(1).map(scoreOne)))];

  let md = `# ${offer.name}\n\nModel: ${COPY_MODEL}\n\nCost: about $${((meterCost() / Math.max(1, chosen.length)) * webinarTemplate.steps.length).toFixed(2)} per full campaign\n\n## Buyer brief\n\n\`\`\`json\n${JSON.stringify(brief, null, 2)}\n\`\`\`\n`;
  for (const r of results) {
    const flag = r.critic.score >= 7 && r.lint.length === 0 ? "PASS" : "CHECK";
    console.log(`${flag}  ${String(r.critic.score).padStart(2)}/10  ${r.step.channel.padEnd(6)} ${r.step.title}${r.rewritten ? "  (rewritten)" : ""}`);
    md += `\n---\n\n## ${r.step.title} (${r.step.channel}) · ${r.critic.score}/10 · ${r.step.play?.name ?? "no play"}\n\n`;
    md += `Lead with: ${r.step.focus ?? "-"}\n\n`;
    for (const [k, v] of Object.entries(r.copy)) if (k !== "source") md += `**${k}**\n\n${v}\n\n`;
    if (r.lint.length || r.critic.problems.length) md += `> Notes: ${[...r.lint, ...r.critic.problems].join(" / ")}\n`;
  }
  const avg = results.reduce((a, r) => a + Math.max(0, r.critic.score), 0) / results.length;
  const rewrites = results.filter((r) => r.rewritten).length;
  console.log(`average ${avg.toFixed(1)}/10 · ${rewrites} rewritten · ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  const cost = meterCost();
  const perFull = (cost / results.length) * webinarTemplate.steps.length;
  console.log(`cost: $${cost.toFixed(3)} for ${results.length} messages · about $${perFull.toFixed(2)} for a full ${webinarTemplate.steps.length}-message campaign`);
  for (const [model, u] of Object.entries(usageMeter)) {
    console.log(`  ${model}: ${u.calls} calls · ${u.input} in (${u.cached} cached) · ${u.output} out`);
  }
  mkdirSync("eval-output", { recursive: true });
  const suffix = COPY_MODEL === "gpt-6-luna" ? "-luna" : "";
  writeFileSync(`eval-output/${key}${suffix}.md`, md);
  console.log(`saved eval-output/${key}${suffix}.md`);
}

(async () => {
  const args = process.argv.slice(2);
  const all = args.includes("--all");
  const keys = args.filter((a) => !a.startsWith("--"));
  for (const key of keys.length ? keys : Object.keys(SAMPLES)) {
    if (!SAMPLES[key]) {
      console.log(`No sample called "${key}". Try: ${Object.keys(SAMPLES).join(", ")}`);
      continue;
    }
    await run(key, all);
  }
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
