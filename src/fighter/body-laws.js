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
  clavicleL: pair([-1.2, 1.2], [-1.1, 1.1], [-1.1, 1.1]),
  clavicleR: pair([-1.2, 1.2], [-1.1, 1.1], [-1.1, 1.1]),
  // Anatomical limits reduce limbs folding through the torso or each other.
  shoulderL: pair([-2.55, 0.45], [-1.55, 1.55], [-1.55, 1.55]),
  shoulderR: pair([-2.55, 0.45], [-1.55, 1.55], [-1.55, 1.55]),
  elbowL: pair([-2.45, 0.2], [-1.15, 1.15], [-1.15, 1.15]),
  elbowR: pair([-2.45, 0.2], [-1.15, 1.15], [-1.15, 1.15]),
  forearmL: pair([-1.2, 1.2], [-1.3, 1.3], [-1.2, 1.2]),
  forearmR: pair([-1.2, 1.2], [-1.3, 1.3], [-1.2, 1.2]),
  wristL: pair([-1.1, 1.1], [-1.1, 1.1], [-1.1, 1.1]),
  wristR: pair([-1.1, 1.1], [-1.1, 1.1], [-1.1, 1.1]),
  fingerL: pair([-1.5, 0.3], [-1.0, 1.0], [-1.0, 1.0]),
  fingerR: pair([-1.5, 0.3], [-1.0, 1.0], [-1.0, 1.0]),
  hipL: pair([-1.65, 0.9], [-0.85, 0.85], [-0.85, 0.85]),
  hipR: pair([-1.65, 0.9], [-0.85, 0.85], [-0.85, 0.85]),
  kneeL: pair([-0.2, 2.0], [-0.55, 0.55], [-0.55, 0.55]),
  kneeR: pair([-0.2, 2.0], [-0.55, 0.55], [-0.55, 0.55]),
  ankleL: pair([-0.9, 0.85], [-0.55, 0.55], [-0.55, 0.55]),
  ankleR: pair([-0.9, 0.85], [-0.55, 0.55], [-0.55, 0.55]),
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
