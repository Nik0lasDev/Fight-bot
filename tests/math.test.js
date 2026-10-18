import test from "node:test";
import assert from "node:assert/strict";
import { clamp, damp, distanceXZ, lerp, lerpAngle } from "../src/math.js";

test("clamp keeps values inside the requested range", () => {
  assert.equal(clamp(-3, 0, 10), 0);
  assert.equal(clamp(4, 0, 10), 4);
  assert.equal(clamp(14, 0, 10), 10);
});

test("lerp interpolates between endpoints", () => {
  assert.equal(lerp(2, 10, 0), 2);
  assert.equal(lerp(2, 10, 0.5), 6);
  assert.equal(lerp(2, 10, 1), 10);
});

test("lerpAngle takes the shortest path across the pi boundary", () => {
  const halfway = lerpAngle(Math.PI - 0.1, -Math.PI + 0.1, 0.5);
  assert.ok(Math.abs(Math.abs(halfway) - Math.PI) < 1e-9);
});

test("damp does not change the value when delta time is zero", () => {
  assert.equal(damp(3, 9, 8, 0), 3);
});

test("distanceXZ measures only the ground plane", () => {
  assert.equal(distanceXZ({ x: 0, y: 100, z: 0 }, { x: 3, y: -100, z: 4 }), 5);
});
