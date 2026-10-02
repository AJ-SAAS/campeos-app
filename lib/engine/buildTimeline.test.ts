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

test("defaults the close date to 72 hours after the event", () => {
  const event = new Date("2026-10-15T18:00:00.000Z");
  const steps = buildTimeline(webinarTemplate, { event });

  const lastCall = steps.find((s) => s.templateStepId === "email-last-call");
  assert.ok(lastCall);
  // end = event + 72h; step offset is -4h from end
  const expected = new Date(event.getTime() + 72 * 60 * 60 * 1000 - 4 * 60 * 60 * 1000);
  assert.equal(lastCall!.scheduledAt.toISOString(), expected.toISOString());
});

test("respects an explicit end date when given", () => {
  const event = new Date("2026-10-15T18:00:00.000Z");
  const end = new Date("2026-10-20T12:00:00.000Z");
  const steps = buildTimeline(webinarTemplate, { event, end });

  const closesTonight = steps.find(
    (s) => s.templateStepId === "sms-closes-tonight"
  );
  assert.ok(closesTonight);
  assert.equal(
    closesTonight!.scheduledAt.toISOString(),
    "2026-10-20T11:00:00.000Z" // end - 1h
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
    steps: [
      {
        id: "only-step",
        channel: "email",
        anchor: "event",
        offsetHours: 0,
        title: "Go",
        purpose: "test",
        angle: "test",
        fields: [{ key: "body", label: "Body", kind: "long" }],
      },
    ],
  };

  const event = new Date("2026-01-01T00:00:00.000Z");
  const steps = buildTimeline(tiny, { event });
  assert.equal(steps.length, 1);
  assert.equal(steps[0].scheduledAt.toISOString(), event.toISOString());
});
