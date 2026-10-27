import { test } from "node:test";
import assert from "node:assert/strict";
import { MIN_FIT, MOOD_STYLE, ORB_MOODS, bubbleLayout, clampFit } from "../lib/mascot/orb";

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

test("the orb is never framed tighter than the minimum that shows all of it", () => {
  assert.equal(clampFit(0.5), MIN_FIT);
  assert.equal(clampFit(0.64), MIN_FIT);
  assert.equal(clampFit(1.05), 1.05);
  // At the minimum the camera must see below the orb's lowest point (-1.24).
  const halfH = 6.3 * MIN_FIT * Math.tan((34 * Math.PI) / 360);
  assert.ok(0.25 - halfH <= -1.24, "bottom of the orb is in view");
});

test("the thinking bubble keeps its size when there is room", () => {
  const b = bubbleLayout(2.0, 2.0, 0.25, -0.2, 1, 0);
  assert.equal(b.w, 1.4);
  assert.equal(b.h, 0.98);
  assert.equal(b.x, 1.15);
});

test("the thinking bubble shrinks and moves in so it is never cut off", () => {
  for (const [halfW, halfH] of [[1.7, 1.7], [1.2, 1.2], [1.0, 1.4]]) {
    for (const rootY of [-0.2, 0.55]) {
      const b = bubbleLayout(halfW, halfH, 0.25, rootY, 1, 0.04);
      assert.ok(b.x + b.w / 2 <= halfW, `right edge in view (${halfW})`);
      assert.ok(b.y + b.h / 2 <= 0.25 + halfH, `top edge in view (${halfH})`);
      assert.ok(b.w > 0.3, "still readable");
    }
  }
});
