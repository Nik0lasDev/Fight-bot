import test from "node:test";
import assert from "node:assert/strict";
import { clampPose, ROM, stepJoint } from "../src/fighter/body-laws.js";
import { clonePose, GUARD } from "../src/fighter/poses.js";
import { condemnedLimbs, readLimbPose } from "../src/fighter/limbs.js";

test("stepJoint advances by at most speed multiplied by delta time", () => {
  const current = { x: 0, y: 0, z: 0 };
  const result = stepJoint(current, { x: 1, y: 0, z: 0 }, 2, 0.25);
  assert.deepEqual(result, { x: 0.5, y: 0, z: 0 });
  assert.deepEqual(current, { x: 0, y: 0, z: 0 });
});

test("stepJoint can write into a reusable output object", () => {
  const current = { x: 0, y: 0, z: 0 };
  const result = stepJoint(current, { x: 1, y: 0, z: 0 }, 2, 0.25, current);
  assert.strictEqual(result, current);
  assert.deepEqual(current, { x: 0.5, y: 0, z: 0 });
});

test("stepJoint snaps to the target when it is within one step", () => {
  const current = { x: 0, y: 0, z: 0 };
  assert.deepEqual(stepJoint(current, { x: 0.1, y: 0.2, z: 0.3 }, 10, 1), { x: 0.1, y: 0.2, z: 0.3 });
});

test("clampPose respects each joint's range of motion", () => {
  const pose = clonePose(GUARD);
  pose.shoulderL.x = 99;
  clampPose(pose);
  assert.equal(pose.shoulderL.x, ROM.shoulderL.x[1]);
});

test("readLimbPose reuses the supplied sample buffer", () => {
  const joints = {};
  for (const name of ["shoulderL", "elbowL", "wristL", "shoulderR", "elbowR", "wristR", "hipL", "kneeL", "ankleL", "hipR", "kneeR", "ankleR"]) {
    joints[name] = { rotation: { x: 0, y: 0, z: 0 } };
  }
  const buffer = {};
  assert.strictEqual(readLimbPose(joints, buffer), buffer);
  joints.shoulderL.rotation.x = 0.2;
  assert.strictEqual(readLimbPose(joints, buffer), buffer);
  assert.equal(buffer.shoulderL.x, 0.2);
});

test("condemnedLimbs reports joints outside their safe range", () => {
  const pose = {};
  for (const name of ["shoulderL", "elbowL", "wristL", "shoulderR", "elbowR", "wristR", "hipL", "kneeL", "ankleL", "hipR", "kneeR", "ankleR"]) {
    pose[name] = { x: 0, y: 0, z: 0 };
  }
  pose.shoulderL.x = ROM.shoulderL.x[1] + 1;
  assert.deepEqual(condemnedLimbs(pose, null, 0), ["armL"]);
});
