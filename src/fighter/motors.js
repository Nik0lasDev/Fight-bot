import { clampPose } from "./body-laws.js";
import { SPECS } from "./intents.js";
import { clonePose, GUARD } from "./poses.js";

const YAW = [
  ["waist", 0.32],
  ["lumbar", 0.2],
  ["spine", 0.18],
  ["ribs", 0.14],
  ["chest", 0.12],
  ["nape", 0.1],
  ["head", 0.08],
];

const FLEX = [
  ["waist", 0.18],
  ["lumbar", 0.24],
  ["spine", 0.24],
  ["ribs", 0.18],
  ["chest", 0.16],
];

function ease(value) {
  const t = Math.max(0, Math.min(1, value));
  return t * t * (3 - 2 * t);
}

function phaseWeights(time, windup, active, duration) {
  if (time <= windup) return { coil: ease(time / Math.max(0.04, windup)), strike: 0 };
  if (time <= active) {
    const along = ease((time - windup) / Math.max(0.04, active - windup));
    return { coil: 1 - along, strike: along };
  }
  const back = ease((time - active) / Math.max(0.05, duration - active));
  return { coil: 0, strike: 1 - back };
}

function styleOf(weights = {}) {
  const cap = (value) => Math.min(1, Math.max(0.7, value));
  return {
    arm: cap(0.82 + (weights.punch ?? 1) * 0.14),
    hip: cap(0.82 + Math.max(weights.kick ?? 1, weights.knee ?? 1) * 0.14),
    torso: cap(0.78 + ((weights.punch ?? 1) + (weights.kick ?? 1)) * 0.08),
  };
}

function reach(distance, near, far) {
  return Math.max(0, Math.min(1, (distance - near) / (far - near)));
}

function put(pose, name, coil, strike, w, gain = 1) {
  const base = GUARD[name];
  const joint = pose[name];
  for (const key of ["x", "y", "z"]) {
    if (coil[key] == null && strike[key] == null) continue;
    const mixed = (coil[key] ?? base[key]) * w.coil + (strike[key] ?? base[key]) * w.strike + base[key] * (1 - w.coil - w.strike);
    joint[key] = base[key] + (mixed - base[key]) * gain;
  }
}

function twist(pose, coil, strike, w, gain) {
  for (const [name, share] of YAW) put(pose, name, { y: coil * share }, { y: strike * share }, w, gain);
}

function flex(pose, coil, strike, w) {
  for (const [name, share] of FLEX) put(pose, name, { x: coil * share }, { x: strike * share }, w, 1);
}

function solveArm(pose, spec, w, distance, style) {
  const side = spec.side;
  const sign = side === "L" ? 1 : -1;
  const ext = reach(distance, spec.near ?? 0.75, spec.far ?? 1.6);
  const gain = Math.min(style.arm, spec.gainCap ?? 1);
  const elbowStrike = spec.lockElbow ?? (-1.7 + ext * 1.48);
  put(pose, `shoulder${side}`, {
    x: spec.coilX ?? -0.25,
    y: sign * (spec.coilY ?? 0.32),
    z: sign * (spec.coilZ ?? 0.4),
  }, {
    x: spec.strikeX ?? -0.7 - ext * 0.85,
    y: sign * (spec.strikeY ?? 0.04),
    z: sign * (spec.strikeZ ?? 0.14),
  }, w, gain);
  put(pose, `elbow${side}`, { x: spec.coilElbow ?? -2.1 }, { x: elbowStrike }, w, gain);
  put(pose, `forearm${side}`, { y: sign * 0.45 }, { y: sign * (0.15 + ext * 0.85) }, w, gain);
  put(pose, `wrist${side}`, { x: -0.4 }, { x: -0.12 }, w, gain);
  put(pose, `finger${side}`, { x: spec.fingerCoil ?? -1.3 }, { x: spec.finger ?? -1.35 }, w, 1);
  put(pose, `clavicle${side}`, { z: sign * 0.12 }, { z: sign * 0.22, y: sign * 0.1 }, w, gain);
  put(pose, "jaw", { x: 0.08 }, { x: 0.16 }, w, 0.7);
  if (!spec.both) {
    const other = side === "L" ? "R" : "L";
    put(pose, `shoulder${other}`, { z: -sign * 0.2 }, { x: -0.75, z: -sign * 0.8 }, w, 0.5);
    put(pose, `elbow${other}`, { x: -1.55 }, { x: -1.75 }, w, 0.5);
  }
  if (!spec.skipYaw) twist(pose, spec.yawCoil ?? sign * 0.35, spec.yawStrike ?? -sign * 0.5, w, style.torso);
  if (!spec.knees) return;
  put(pose, "kneeL", { x: 1.05 }, { x: 0.5 }, w, 1);
  put(pose, "kneeR", { x: 1.15 }, { x: 0.4 }, w, 1);
  put(pose, "hipL", { x: -0.35 }, { x: -0.2 }, w, 0.7);
  put(pose, "hipR", { x: -0.2 }, { x: -0.35 }, w, 0.7);
}

function solveLeg(pose, spec, w, distance, style) {
  const ext = reach(distance, spec.near ?? 0.95, spec.far ?? 1.85);
  const knee = spec.kneeClose + (spec.kneeFar - spec.kneeClose) * ext;
  const gain = style.hip;
  put(pose, "hipR", { x: spec.coilHipX ?? 0.35, z: spec.coilHipZ ?? 0.04 }, { x: spec.strikeHipX ?? -1.15, z: spec.strikeHipZ ?? -0.08 }, w, gain);
  put(pose, "kneeR", { x: spec.coilKnee ?? 1.7 }, { x: knee }, w, gain);
  put(pose, "ankleR", { x: spec.coilAnkle ?? -0.15 }, { x: spec.strikeAnkle ?? -0.4 }, w, gain);
  put(pose, "toeR", { x: 0.12 }, { x: spec.toe ?? 0.5 }, w, 1);
  put(pose, "hipL", { x: -0.4 }, { x: -0.55 }, w, 0.75);
  put(pose, "kneeL", { x: 0.95 }, { x: 1.05 }, w, 0.75);
  put(pose, "ankleL", { x: -0.1 }, { x: 0.12 }, w, 0.6);
  put(pose, "shoulderL", { z: 0.85 }, { x: -0.45, z: 1.2 }, w, 0.65);
  put(pose, "shoulderR", { z: -0.85 }, { x: -0.4, z: -1.15 }, w, 0.65);
  put(pose, "elbowL", { x: -1.2 }, { x: -0.9 }, w, 0.6);
  put(pose, "elbowR", { x: -1.2 }, { x: -0.9 }, w, 0.6);
  if (spec.flex) flex(pose, spec.flex * 0.35, spec.flex, w);
  twist(pose, -0.12, 0.18, w, style.torso);
}

function duck(pose, w) {
  flex(pose, 0.3, 0.9, w);
  put(pose, "kneeL", { x: 1.05 }, { x: 1.5 }, w, 1);
  put(pose, "kneeR", { x: 1.0 }, { x: 1.45 }, w, 1);
  put(pose, "hipL", { x: -0.5 }, { x: -0.72 }, w, 1);
  put(pose, "hipR", { x: -0.45 }, { x: -0.68 }, w, 1);
  put(pose, "head", { x: 0.12 }, { x: 0.38 }, w, 1);
  put(pose, "neck", { x: 0.06 }, { x: 0.18 }, w, 1);
  put(pose, "nape", { x: 0.05 }, { x: 0.14 }, w, 1);
}

function weave(pose, w, sign) {
  put(pose, "waist", { y: sign * 0.16, z: sign * 0.1 }, { y: sign * 0.42, z: sign * 0.26 }, w, 1);
  put(pose, "lumbar", { z: sign * 0.08 }, { z: sign * 0.16 }, w, 1);
  put(pose, "spine", { y: sign * 0.1, z: sign * 0.1 }, { y: sign * 0.2, z: sign * 0.2 }, w, 1);
  put(pose, "ribs", { z: sign * 0.06 }, { z: sign * 0.12 }, w, 1);
  put(pose, "head", { y: -sign * 0.12 }, { y: -sign * 0.32, z: -sign * 0.12 }, w, 1);
  put(pose, "nape", { y: -sign * 0.08 }, { y: -sign * 0.18 }, w, 1);
  put(pose, sign > 0 ? "kneeL" : "kneeR", { x: 0.9 }, { x: 1.15 }, w, 1);
}

function taunt(pose, w) {
  for (const side of ["L", "R"]) {
    const sign = side === "L" ? 1 : -1;
    put(pose, `shoulder${side}`, { z: sign * 0.35 }, { x: -1.15, z: sign * 1.3 }, w, 1);
    put(pose, `elbow${side}`, { x: -1.15 }, { x: -0.6 }, w, 1);
    put(pose, `finger${side}`, { x: -0.45 }, { x: -0.08 }, w, 1);
    put(pose, `clavicle${side}`, { z: sign * 0.12 }, { z: sign * 0.35 }, w, 1);
  }
  put(pose, "chest", { x: 0.02 }, { x: -0.16 }, w, 1);
  put(pose, "head", { x: -0.08 }, { x: -0.28, y: 0.1 }, w, 1);
  put(pose, "jaw", { x: 0.1 }, { x: 0.26 }, w, 1);
}

function block(pose, w) {
  for (const side of ["L", "R"]) {
    const sign = side === "L" ? 1 : -1;
    put(pose, `shoulder${side}`, { x: -0.95, z: sign * 0.35 }, { x: -1.3, y: sign * 0.35, z: sign * 0.42 }, w, 1);
    put(pose, `elbow${side}`, { x: -1.6 }, { x: -1.9 }, w, 1);
    put(pose, `forearm${side}`, { y: sign * 0.3 }, { y: sign * 0.7 }, w, 1);
    put(pose, `wrist${side}`, { x: -0.2 }, { x: -0.4 }, w, 1);
    put(pose, `finger${side}`, { x: -1.15 }, { x: -1.3 }, w, 1);
  }
  put(pose, "head", { x: 0.04 }, { x: 0.16 }, w, 1);
  put(pose, "chest", { x: 0.04 }, { x: -0.06 }, w, 1);
  put(pose, "jaw", { x: 0.06 }, { x: 0.04 }, w, 1);
}

function applyIntent(id, pose, w, distance, style) {
  const spec = SPECS[id];
  if (!spec) return;
  if (spec.kind === "arm") {
    solveArm(pose, spec, w, distance, style);
    if (spec.both) solveArm(pose, { ...spec, side: "R", skipYaw: true }, w, distance, style);
    return;
  }
  if (spec.kind === "leg") solveLeg(pose, spec, w, distance, style);
  else if (spec.kind === "duck") duck(pose, w);
  else if (spec.kind === "weave") weave(pose, w, spec.sign);
  else if (spec.kind === "taunt") taunt(pose, w);
  else if (spec.kind === "block") block(pose, w);
}

export function articulate(move, time, distance, weights) {
  const pose = clonePose(GUARD);
  const style = styleOf(weights);
  applyIntent(move.id, pose, phaseWeights(time, move.windup, move.active, move.duration), distance, style);
  return clampPose(pose);
}

export function holdPose(id, distance, weights) {
  const pose = clonePose(GUARD);
  applyIntent(id, pose, { coil: 0, strike: 1 }, distance, styleOf(weights));
  return clampPose(pose);
}
