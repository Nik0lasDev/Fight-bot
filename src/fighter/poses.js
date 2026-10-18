const JOINTS = [
  "waist",
  "lumbar",
  "spine",
  "ribs",
  "chest",
  "neck",
  "nape",
  "head",
  "jaw",
  "clavicleL",
  "shoulderL",
  "elbowL",
  "forearmL",
  "wristL",
  "fingerL",
  "clavicleR",
  "shoulderR",
  "elbowR",
  "forearmR",
  "wristR",
  "fingerR",
  "hipL",
  "kneeL",
  "ankleL",
  "toeL",
  "hipR",
  "kneeR",
  "ankleR",
  "toeR",
];

export const POSE_JOINTS = JOINTS;

function empty() {
  return { x: 0, y: 0, z: 0 };
}

export const GUARD = {
  waist: { x: 0.05, y: -0.04, z: 0 },
  lumbar: { x: 0.08, y: -0.03, z: 0 },
  spine: { x: 0.08, y: -0.04, z: 0 },
  ribs: { x: 0.06, y: -0.04, z: 0 },
  chest: { x: 0.05, y: -0.05, z: 0 },
  neck: { x: -0.06, y: 0.03, z: 0 },
  nape: { x: -0.06, y: 0.02, z: 0 },
  head: { x: -0.04, y: 0.06, z: 0 },
  jaw: { x: 0.08, y: 0, z: 0 },
  clavicleL: { x: 0.05, y: 0.12, z: 0.18 },
  shoulderL: { x: -0.8, y: 0.22, z: 0.72 },
  elbowL: { x: -1.45, y: 0, z: 0 },
  forearmL: { x: 0, y: 0.2, z: 0 },
  wristL: { x: -0.2, y: 0.1, z: 0 },
  fingerL: { x: -1.05, y: 0, z: 0 },
  clavicleR: { x: 0.02, y: -0.1, z: -0.2 },
  shoulderR: { x: -0.5, y: -0.32, z: -1.0 },
  elbowR: { x: -1.7, y: 0, z: 0 },
  forearmR: { x: 0, y: -0.2, z: 0 },
  wristR: { x: -0.25, y: -0.1, z: 0 },
  fingerR: { x: -1.1, y: 0, z: 0 },
  hipL: { x: -0.4, y: 0, z: 0.06 },
  kneeL: { x: 0.8, y: 0, z: 0 },
  ankleL: { x: -0.32, y: 0, z: 0 },
  toeL: { x: 0.2, y: 0, z: 0 },
  hipR: { x: -0.28, y: 0, z: -0.05 },
  kneeR: { x: 0.7, y: 0, z: 0 },
  ankleR: { x: -0.28, y: 0, z: 0 },
  toeR: { x: 0.18, y: 0, z: 0 },
};

export function withPose(overlay = {}) {
  const pose = {};
  for (const name of JOINTS) {
    pose[name] = { ...empty(), ...GUARD[name], ...(overlay[name] || {}) };
  }
  return pose;
}

export function clonePose(pose) {
  const copy = {};
  for (const name of JOINTS) {
    const joint = pose[name] || empty();
    copy[name] = { x: joint.x || 0, y: joint.y || 0, z: joint.z || 0 };
  }
  return copy;
}

export const VICTORY = withPose({
  waist: { x: -0.08, y: 0, z: 0 },
  spine: { x: -0.05, y: 0, z: 0 },
  chest: { x: -0.12, y: 0, z: 0 },
  neck: { x: -0.2, y: 0, z: 0 },
  head: { x: -0.35, y: 0, z: 0 },
  shoulderL: { x: -2.7, y: 0.1, z: 0.25 },
  elbowL: { x: -0.25, y: 0, z: 0 },
  fingerL: { x: -0.2, y: 0, z: 0 },
  shoulderR: { x: -2.7, y: -0.1, z: -0.25 },
  elbowR: { x: -0.25, y: 0, z: 0 },
  fingerR: { x: -0.2, y: 0, z: 0 },
});

export const LIMB = withPose({
  spine: { x: 0.55, y: 0, z: 0.15 },
  chest: { x: 0.25, y: 0, z: 0 },
  neck: { x: 0.35, y: 0, z: 0 },
  shoulderL: { x: -0.2, y: 0, z: 0.4 },
  elbowL: { x: -0.45, y: 0, z: 0 },
  shoulderR: { x: -0.15, y: 0, z: -0.35 },
  elbowR: { x: -0.4, y: 0, z: 0 },
  hipL: { x: 0.1, y: 0, z: 0 },
  kneeL: { x: 0.35, y: 0, z: 0 },
  hipR: { x: 0.2, y: 0, z: 0 },
  kneeR: { x: 0.5, y: 0, z: 0 },
});

export function flinchPose(side) {
  return withPose({
    waist: { x: 0.2, y: side * 0.25, z: side * 0.1 },
    spine: { x: 0.42, y: side * 0.18, z: side * 0.1 },
    chest: { x: 0.18, y: side * 0.12, z: 0 },
    neck: { x: -0.45, y: side * 0.3, z: 0 },
    head: { x: -0.35, y: side * 0.4, z: side * 0.15 },
    shoulderL: { x: -0.35, y: 0.2, z: 0.7 },
    elbowL: { x: -1.1, y: 0, z: 0 },
    fingerL: { x: -0.4, y: 0, z: 0 },
    shoulderR: { x: -0.3, y: -0.2, z: -0.65 },
    elbowR: { x: -1.05, y: 0, z: 0 },
    fingerR: { x: -0.4, y: 0, z: 0 },
  });
}
