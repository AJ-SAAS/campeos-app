import { test } from "node:test";
import assert from "node:assert/strict";
import { MOOD_STYLE, ORB_MOODS } from "../lib/mascot/orb";

test("every mood the mascot can show has a color style", () => {
  assert.deepEqual(Object.keys(MOOD_STYLE).sort(), [...ORB_MOODS].sort());
});

test("mood colors stay in a sane range", () => {
  for (const mood of ORB_MOODS) {
    const { tint, halo, dim } = MOOD_STYLE[mood];
    for (const v of tint) assert.ok(v >= 0 && v <= 1, `${mood} tint`);
    assert.ok(Number.isInteger(halo) && halo >= 0 && halo <= 0xffffff, `${mood} halo`);
    assert.ok(dim > 0 && dim <= 1.2, `${mood} dim`);
  }
});
