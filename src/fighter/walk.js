const STEPS = [
  [0, -0.62, 0.12, 0.28, -0.22],
  [0.12, -0.3, 0.42, -0.02, 0.02],
  [0.3, 0.02, 0.16, -0.1, 0.06],
  [0.48, 0.26, 0.2, -0.38, 0.32],
  [0.62, 0.4, 0.38, -0.7, 0.72],
  [0.76, -0.02, 1.18, 0.18, -0.12],
  [0.9, -0.5, 0.32, 0.32, -0.24],
  [1, -0.62, 0.12, 0.28, -0.22],
];

function blend(from, to, amount) {
  return from + (to - from) * amount;
}

function sampleLeg(phase) {
  const cycle = Math.PI * 2;
  const u = ((phase / cycle) % 1 + 1) % 1;
  let index = 0;
  while (index < STEPS.length - 2 && u > STEPS[index + 1][0]) index += 1;
  const from = STEPS[index];
  const to = STEPS[index + 1];
  const span = to[0] - from[0] || 1;
  const t = (u - from[0]) / span;
  const k = t * t * (3 - 2 * t);
  const at = (column) => from[column] + (to[column] - from[column]) * k;
  return { hip: at(1), knee: at(2), ankle: at(3), toe: at(4) };
}

function writeLeg(pose, side, step, amount, stride) {
  const hip = pose[`hip${side}`];
  const outward = side === "L" ? 0.07 : -0.07;
  hip.x = blend(hip.x, step.hip * stride, amount);
  hip.z = blend(hip.z, outward, amount);
  pose[`knee${side}`].x = blend(pose[`knee${side}`].x, step.knee, amount);
  pose[`ankle${side}`].x = blend(pose[`ankle${side}`].x, step.ankle, amount);
  pose[`toe${side}`].x = blend(pose[`toe${side}`].x, step.toe, amount);
}

export function addWalk(pose, phase, speed) {
  const amount = Math.min(1, Math.max(0, (speed - 0.08) / 1.05));
  if (amount <= 0.02) return pose;
  const stride = 0.84 + 0.16 * Math.min(1, speed / 2.1);
  writeLeg(pose, "L", sampleLeg(phase), amount, stride);
  writeLeg(pose, "R", sampleLeg(phase + Math.PI), amount, stride);

  const lead = Math.cos(phase);
  pose.waist.y = blend(pose.waist.y, lead * 0.16, amount);
  pose.waist.x = blend(pose.waist.x, 0.04, amount);
  pose.lumbar.y = blend(pose.lumbar.y, lead * 0.14, amount);
  pose.lumbar.x = blend(pose.lumbar.x, 0.07, amount);
  pose.spine.y = blend(pose.spine.y, -lead * 0.1, amount);
  pose.spine.x = blend(pose.spine.x, 0.05, amount);
  pose.ribs.y = blend(pose.ribs.y, -lead * 0.12, amount);
  pose.ribs.x = blend(pose.ribs.x, 0.04, amount);
  pose.chest.y = blend(pose.chest.y, -lead * 0.06, amount);
  pose.nape.y = blend(pose.nape.y, -lead * 0.1, amount);
  pose.nape.x = blend(pose.nape.x, -0.05, amount);
  pose.head.y = blend(pose.head.y, -lead * 0.08, amount);
  pose.head.x = blend(pose.head.x, -0.03, amount);
  pose.jaw.x = blend(pose.jaw.x, 0.06, amount);
  pose.forearmL.y = blend(pose.forearmL.y, 0.15 + lead * 0.25, amount);
  pose.forearmR.y = blend(pose.forearmR.y, -0.15 - lead * 0.25, amount);
  pose.shoulderL.x = blend(pose.shoulderL.x, -0.35 + lead * 0.5, amount);
  pose.shoulderR.x = blend(pose.shoulderR.x, -0.35 - lead * 0.5, amount);
  pose.shoulderL.z = blend(pose.shoulderL.z, 0.32, amount);
  pose.shoulderR.z = blend(pose.shoulderR.z, -0.32, amount);
  pose.elbowL.x = blend(pose.elbowL.x, -0.55 - Math.max(0, -lead) * 0.45, amount);
  pose.elbowR.x = blend(pose.elbowR.x, -0.55 - Math.max(0, lead) * 0.45, amount);
  pose.clavicleL.y = blend(pose.clavicleL.y, lead * 0.08, amount);
  pose.clavicleR.y = blend(pose.clavicleR.y, -lead * 0.08, amount);
  pose.fingerL.x = blend(pose.fingerL.x, -0.3, amount);
  pose.fingerR.x = blend(pose.fingerR.x, -0.3, amount);
  return pose;
}
