import test from "node:test";
import assert from "node:assert/strict";
import { MOVES } from "../src/fighter/moves.js";
import { PROFILES } from "../src/fighter/bot.js";

test("every AI profile only references moves that exist", () => {
  for (const [profileName, profile] of Object.entries(PROFILES)) {
    for (const id of profile.kit) {
      assert.ok(MOVES[id], `Profile ${profileName} references missing move: ${id}`);
    }
  }
});

test("every move has a valid timeline and distance range", () => {
  for (const [id, move] of Object.entries(MOVES)) {
    assert.equal(move.id, id);
    assert.ok(move.duration > 0, `${id} must have a positive duration`);
    assert.ok(move.windup >= 0 && move.active >= move.windup && move.duration > move.active, `${id} has an invalid timeline`);
    assert.ok(move.range.min >= 0 && move.range.max > move.range.min, `${id} has an invalid range`);
    if (move.damage > 0) assert.ok(move.limb, `${id} deals damage but has no limb`);
  }
});
