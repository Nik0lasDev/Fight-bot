import { POSE_JOINTS } from "./poses.js";

const pair = (x, y, z) => ({ x, y, z });

// Articulações com amplitude quase total. O limite de ±2.95 rad (≈169°)
// evita a singularidade exata de 180° durante as interpolações de pose.
const FREE = pair([-2.95, 2.95], [-2.95, 2.95], [-2.95, 2.95]);
export const ROM = {
  waist: FREE,
  lumbar: FREE,
  spine: FREE,
  ribs: FREE,
  chest: FREE,
  neck: FREE,
  nape: FREE,
  head: FREE,
  jaw: pair([-1.4, 1.4], [-2.95, 2.95], [-2.95, 2.95]),
  clavicleL: FREE,
  clavicleR: FREE,
  shoulderL: FREE,
  shoulderR: FREE,
  elbowL: FREE,
  elbowR: FREE,
  forearmL: FREE,
  forearmR: FREE,
  wristL: FREE,
  wristR: FREE,
  fingerL: FREE,
  fingerR: FREE,
  hipL: FREE,
  hipR: FREE,
  kneeL: FREE,
  kneeR: FREE,
  ankleL: FREE,
  ankleR: FREE,
  toeL: FREE,
  toeR: FREE,
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

function clampAxis(value, range) {
  return Math.min(range[1], Math.max(range[0], value));
}

export function clampPose(pose) {
  for (const name of POSE_JOINTS) {
    const limit = ROM[name];
    const joint = pose[name];
    joint.x = clampAxis(joint.x, limit.x);
    joint.y = clampAxis(joint.y, limit.y);
    joint.z = clampAxis(joint.z, limit.z);
  }
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
