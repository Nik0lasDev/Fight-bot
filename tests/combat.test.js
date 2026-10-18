import test from "node:test";
import assert from "node:assert/strict";
import { resolveBodies, stayInRing } from "../src/combat.js";

test("stayInRing clamps position and softly rebounds from the arena edge", () => {
  const fighter = {
    root: { position: { x: 5, z: 0 } },
    velocity: { x: 2, z: 1 },
  };
  stayInRing(fighter, 3);
  assert.equal(fighter.root.position.x, 3);
  assert.equal(fighter.root.position.z, 0);
  assert.ok(fighter.velocity.x < 0, "outward velocity should rebound inward");
  assert.ok(Math.abs(fighter.velocity.x + 0.24) < 1e-9);
  assert.ok(fighter.velocity.z < 1, "edge friction should reduce tangential sliding");
});

test("resolveBodies separates fighters and conserves momentum with a soft collision bounce", () => {
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
  assert.ok(a.velocity.x < 0, "first fighter should rebound from contact");
  assert.ok(b.velocity.x > 0, "second fighter should rebound from contact");
  assert.ok(Math.abs(a.velocity.x + b.velocity.x) < 1e-9, "equal masses should conserve momentum");
});
