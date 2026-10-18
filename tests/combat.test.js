import test from "node:test";
import assert from "node:assert/strict";
import { resolveBodies, stayInRing } from "../src/combat.js";

test("stayInRing clamps position and removes outward velocity", () => {
  const fighter = {
    root: { position: { x: 5, z: 0 } },
    velocity: { x: 2, z: 1 },
  };
  stayInRing(fighter, 3);
  assert.equal(fighter.root.position.x, 3);
  assert.equal(fighter.root.position.z, 0);
  assert.equal(fighter.velocity.x, 0);
  assert.equal(fighter.velocity.z, 1);
});

test("resolveBodies separates overlapping fighters and removes closing velocity", () => {
  const a = {
    root: { position: { x: 0, z: 0 } },
    velocity: { x: 1, z: 0 },
  };
  const b = {
    root: { position: { x: 0.5, z: 0 } },
    velocity: { x: -1, z: 0 },
  };
  resolveBodies(a, b);
  assert.ok(Math.abs((b.root.position.x - a.root.position.x) - 0.98) < 1e-9);
  assert.equal(a.velocity.x, 0);
  assert.equal(b.velocity.x, 0);
});
