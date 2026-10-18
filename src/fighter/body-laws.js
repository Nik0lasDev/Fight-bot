import { POSE_JOINTS } from "./poses.js";

const pair = (x, y, z) => ({ x, y, z });

export const ROM = {
  waist: pair([-0.28, 0.5], [-0.6, 0.6], [-0.32, 0.32]),
  lumbar: pair([-0.22, 0.42], [-0.4, 0.4], [-0.28, 0.28]),
  spine: pair([-0.28, 0.48], [-0.45, 0.45], [-0.32, 0.32]),
  ribs: pair([-0.22, 0.38], [-0.4, 0.4], [-0.26, 0.26]),
  chest: pair([-0.32, 0.4], [-0.5, 0.5], [-0.3, 0.3]),
  neck: pair([-0.55, 0.65], [-0.75, 0.75], [-0.4, 0.4]),
  nape: pair([-0.4, 0.45], [-0.5, 0.5], [-0.3, 0.3]),
  head: pair([-0.65, 0.75], [-0.85, 0.85], [-0.4, 0.4]),
  jaw: pair([-0.04, 0.5], [-0.08, 0.08], [-0.06, 0.06]),
  clavicleL: pair([-0.25, 0.4], [-0.25, 0.5], [-0.15, 0.55]),
  clavicleR: pair([-0.25, 0.4], [-0.5, 0.25], [-0.55, 0.15]),
  shoulderL: pair([-2.6, 0.45], [-1.2, 1.2], [-0.4, 1.7]),
  shoulderR: pair([-2.6, 0.45], [-1.2, 1.2], [-1.7, 0.4]),
  elbowL: pair([-2.35, 0.05], [-0.2, 0.2], [-0.15, 0.15]),
  elbowR: pair([-2.35, 0.05], [-0.2, 0.2], [-0.15, 0.15]),
  forearmL: pair([-0.12, 0.12], [-0.4, 1.35], [-0.15, 0.15]),
  forearmR: pair([-0.12, 0.12], [-1.35, 0.4], [-0.15, 0.15]),
  wristL: pair([-1.15, 0.9], [-0.55, 0.55], [-0.7, 0.35]),
  wristR: pair([-1.15, 0.9], [-0.55, 0.55], [-0.35, 0.7]),
  fingerL: pair([-1.5, 0.12], [-0.15, 0.15], [-0.12, 0.12]),
  fingerR: pair([-1.5, 0.12], [-0.15, 0.15], [-0.12, 0.12]),
  hipL: pair([-1.7, 0.55], [-0.45, 0.45], [-0.35, 0.7]),
  hipR: pair([-1.7, 0.55], [-0.45, 0.45], [-0.7, 0.35]),
  kneeL: pair([-0.08, 2.25], [-0.12, 0.12], [-0.1, 0.1]),
  kneeR: pair([-0.08, 2.25], [-0.12, 0.12], [-0.1, 0.1]),
  ankleL: pair([-0.75, 0.45], [-0.3, 0.3], [-0.35, 0.35]),
  ankleR: pair([-0.75, 0.45], [-0.3, 0.3], [-0.35, 0.35]),
  toeL: pair([-0.3, 0.9], [-0.12, 0.12], [-0.1, 0.1]),
  toeR: pair([-0.3, 0.9], [-0.12, 0.12], [-0.1, 0.1]),
};

export const JOINT_SPEED = {
  waist: 6, lumbar: 6, spine: 6, ribs: 6, chest: 6.5,
  neck: 8, nape: 8, head: 8, jaw: 5,
  clavicleL: 7, clavicleR: 7,
  shoulderL: 14, shoulderR: 14,
  elbowL: 16, elbowR: 16,
  forearmL: 10, forearmR: 10,
  wristL: 12, wristR: 12,
  fingerL: 11, fingerR: 11,
  hipL: 11, hipR: 11,
  kneeL: 14, kneeR: 14,
  ankleL: 10, ankleR: 10,
  toeL: 8, toeR: 8,
};

const FLEX = ["waist", "lumbar", "spine", "ribs", "chest"];
const YAW = ["waist", "lumbar", "spine", "ribs", "chest", "nape", "head"];
const BEND = ["waist", "lumbar", "spine", "ribs"];

function clampAxis(value, range) {
  return Math.min(range[1], Math.max(range[0], value));
}

function capSum(pose, names, axis, maxAbs) {
  let positive = 0;
  let negative = 0;
  for (const name of names) {
    const value = pose[name][axis];
    if (value > 0) positive += value;
    else negative += value;
  }
  if (positive > maxAbs) {
    const scale = maxAbs / positive;
    for (const name of names) if (pose[name][axis] > 0) pose[name][axis] *= scale;
  }
  if (-negative > maxAbs) {
    const scale = maxAbs / -negative;
    for (const name of names) if (pose[name][axis] < 0) pose[name][axis] *= scale;
  }
}

export function clampPose(pose) {
  for (const name of POSE_JOINTS) {
    const limit = ROM[name];
    const joint = pose[name];
    joint.x = clampAxis(joint.x, limit.x);
    joint.y = clampAxis(joint.y, limit.y);
    joint.z = clampAxis(joint.z, limit.z);
  }
  capSum(pose, FLEX, "x", 1.05);
  capSum(pose, YAW, "y", 1.15);
  capSum(pose, BEND, "z", 0.7);
  capSum(pose, ["neck", "nape", "head"], "x", 0.9);
  capSum(pose, ["neck", "nape", "head"], "y", 1.05);
  return pose;
}

export function stepJoint(current, target, speed, dt, output = {}) {
  const dx = target.x - current.x;
  const dy = target.y - current.y;
  const dz = target.z - current.z;
  const length = Math.hypot(dx, dy, dz);
  const maxStep = Math.max(0, speed * dt);

  if (length <= maxStep || length < 1e-8) {
    output.x = target.x;
    output.y = target.y;
    output.z = target.z;
    return output;
  }

  const scale = maxStep / length;
  output.x = current.x + dx * scale;
  output.y = current.y + dy * scale;
  output.z = current.z + dz * scale;
  return output;
}
