import { test } from "node:test";
import assert from "node:assert/strict";
import { buildTimeline, groupByDay } from "./buildTimeline";
import { webinarTemplate } from "../templates/webinar";
import { CampaignTemplate } from "../templates/types";

test("schedules every step relative to the event date", () => {
  const event = new Date("2026-10-15T18:00:00.000Z");
  const steps = buildTimeline(webinarTemplate, { event });

  assert.equal(steps.length, webinarTemplate.steps.length);

  const liveStep = steps.find((s) => s.templateStepId === "sms-live-now");
  assert.ok(liveStep);
  assert.equal(liveStep!.scheduledAt.toISOString(), event.toISOString());

  const inviteStep = steps.find((s) => s.templateStepId === "email-invite");
  assert.ok(inviteStep);
  assert.equal(
    inviteStep!.scheduledAt.toISOString(),
    "2026-10-10T18:00:00.000Z" // 5 days (120h) before event
  );
});

test("resolves each step's phase name and objective from the template", () => {
  const event = new Date("2026-10-15T18:00:00.000Z");
  const steps = buildTimeline(webinarTemplate, { event });

  const welcome = steps.find((s) => s.templateStepId === "email-welcome");
  assert.ok(welcome);
  assert.equal(welcome!.phaseName, "Consumption");
  assert.ok(welcome!.phaseObjective.length > 0);
  assert.ok(Array.isArray(welcome!.goals));
  assert.ok(welcome!.goals.length > 0);
});

// The "end" anchor (used by templates whose steps are timed off a close
// date rather than the main event) is exercised with a small fixture
// here, rather than against webinarTemplate — the real webinar template
// doesn't use a separate close date; its whole backend sequence is timed
// off the event anchor.
const endAnchorFixture: CampaignTemplate = {
  id: "end-anchor-fixture",
  name: "End anchor fixture",
  description: "test template",
  kind: "test",
  phases: [{ id: "main", name: "Main", objective: "test" }],
  steps: [
    {
      id: "kickoff",
      channel: "email",
      anchor: "event",
      offsetHours: 0,
      title: "Kickoff",
      phaseId: "main",
      purpose: "test",
      angle: "test",
      goals: ["test"],
      fields: [{ key: "body", label: "Body", kind: "long" }],
    },
    {
      id: "closing",
      channel: "sms",
      anchor: "end",
      offsetHours: -4,
      title: "Closing",
      phaseId: "main",
      purpose: "test",
      angle: "test",
      goals: ["test"],
      fields: [{ key: "body", label: "Text", kind: "long" }],
    },
  ],
};

test("defaults the close date to 72 hours after the event", () => {
  const event = new Date("2026-10-15T18:00:00.000Z");
  const steps = buildTimeline(endAnchorFixture, { event });

  const closing = steps.find((s) => s.templateStepId === "closing");
  assert.ok(closing);
  // end = event + 72h; step offset is -4h from end
  const expected = new Date(event.getTime() + 72 * 60 * 60 * 1000 - 4 * 60 * 60 * 1000);
  assert.equal(closing!.scheduledAt.toISOString(), expected.toISOString());
});

test("respects an explicit end date when given", () => {
  const event = new Date("2026-10-15T18:00:00.000Z");
  const end = new Date("2026-10-20T12:00:00.000Z");
  const steps = buildTimeline(endAnchorFixture, { event, end });

  const closing = steps.find((s) => s.templateStepId === "closing");
  assert.ok(closing);
  assert.equal(
    closing!.scheduledAt.toISOString(),
    "2026-10-20T08:00:00.000Z" // end - 4h
  );
});

test("returns steps sorted chronologically", () => {
  const event = new Date("2026-10-15T18:00:00.000Z");
  const steps = buildTimeline(webinarTemplate, { event });

  for (let i = 1; i < steps.length; i++) {
    assert.ok(
      steps[i].scheduledAt.getTime() >= steps[i - 1].scheduledAt.getTime()
    );
  }
});

test("groupByDay buckets steps by calendar day and sorts days ascending", () => {
  const event = new Date("2026-10-15T18:00:00.000Z");
  const steps = buildTimeline(webinarTemplate, { event });
  const groups = groupByDay(steps);

  assert.ok(groups.length > 1);
  for (let i = 1; i < groups.length; i++) {
    assert.ok(groups[i].day > groups[i - 1].day);
  }

  const total = groups.reduce((sum, g) => sum + g.steps.length, 0);
  assert.equal(total, steps.length);
});

test("works for a minimal template with a single step", () => {
  const tiny: CampaignTemplate = {
    id: "tiny",
    name: "Tiny",
    description: "test template",
    kind: "test",
    phases: [{ id: "p", name: "P", objective: "obj" }],
    steps: [
      {
        id: "only-step",
        channel: "email",
        anchor: "event",
        offsetHours: 0,
        title: "Go",
        phaseId: "p",
        purpose: "test",
        angle: "test",
        goals: ["test"],
        fields: [{ key: "body", label: "Body", kind: "long" }],
      },
    ],
  };

  const event = new Date("2026-01-01T00:00:00.000Z");
  const steps = buildTimeline(tiny, { event });
  assert.equal(steps.length, 1);
  assert.equal(steps[0].scheduledAt.toISOString(), event.toISOString());
});
