import { JOINT_SPEED, ROM } from "./body-laws.js";

const CHECK = [
  "shoulderL", "elbowL", "wristL",
  "shoulderR", "elbowR", "wristR",
  "hipL", "kneeL", "ankleL",
  "hipR", "kneeR", "ankleR",
];

const LIMB_OF = {
  shoulderL: "armL",
  elbowL: "armL",
  wristL: "armL",
  shoulderR: "armR",
  elbowR: "armR",
  wristR: "armR",
  hipL: "legL",
  kneeL: "legL",
  ankleL: "legL",
  hipR: "legR",
  kneeR: "legR",
  ankleR: "legR",
};

export const LIMB_LABEL = {
  armL: "o braço esquerdo",
  armR: "o braço direito",
  legL: "a perna esquerda",
  legR: "a perna direita",
};

function outside(rotation, limit) {
  return (
    rotation.x < limit.x[0] ||
    rotation.x > limit.x[1] ||
    rotation.y < limit.y[0] ||
    rotation.y > limit.y[1] ||
    rotation.z < limit.z[0] ||
    rotation.z > limit.z[1]
  );
}

export function bodyPart(anchor) {
  if (!anchor) return null;
  if (anchor.startsWith("hand") || anchor.startsWith("elbow")) {
    return anchor.endsWith("L") ? "armL" : "armR";
  }
  if (anchor.startsWith("foot") || anchor.startsWith("knee")) {
    return anchor.endsWith("L") ? "legL" : "legR";
  }
  return null;
}

export function limbReady(fighter, move) {
  const part = bodyPart(move?.limb);
  return !part || !fighter.missing.has(part);
}

export function readLimbPose(joints) {
  const pose = {};
  for (const name of CHECK) {
    const joint = joints[name];
    pose[name] = { x: joint.rotation.x, y: joint.rotation.y, z: joint.rotation.z };
  }
  return pose;
}

export function condemnedLimbs(pose, previous, dt) {
  const lost = [];
  for (const joint of CHECK) {
    const rotation = pose[joint];
    if (!rotation) continue;
    const limb = LIMB_OF[joint];
    if (lost.includes(limb)) continue;
    if (outside(rotation, ROM[joint])) {
      lost.push(limb);
      continue;
    }
    const prior = previous?.[joint];
    if (!prior || !(dt > 0.004)) continue;
    const speed = Math.hypot(rotation.x - prior.x, rotation.y - prior.y, rotation.z - prior.z) / dt;
    if (speed > JOINT_SPEED[joint] * 1.8) lost.push(limb);
  }
  return lost;
}
