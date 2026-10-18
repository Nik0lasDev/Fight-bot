import { ROAM_RADIUS } from "../forest.js";

function inward(fighter, throttle, strafe) {
  const radius = Math.hypot(fighter.root.position.x, fighter.root.position.z);
  if (radius < ROAM_RADIUS) return { type: "go", throttle, strafe, label: "ajusta a posição" };
  const yaw = fighter.root.rotation.y;
  const vx = Math.sin(yaw) * throttle + Math.cos(yaw) * strafe;
  const vz = Math.cos(yaw) * throttle - Math.sin(yaw) * strafe;
  const outward = (fighter.root.position.x * vx + fighter.root.position.z * vz) / Math.max(0.001, radius);
  return outward > 0.05
    ? { type: "go", throttle: 0.1, strafe: strafe > 0 ? -0.65 : 0.65, label: "retorna ao centro" }
    : { type: "go", throttle, strafe, label: "ajusta a posição" };
}

function jointMotion(distance, opponent, fighter) {
  const useLeg = distance > 1.25 && Math.random() < 0.48;
  const side = Math.random() < 0.5 ? "L" : "R";
  const sign = side === "L" ? 1 : -1;
  const duration = 0.62 + Math.random() * 0.28;
  const targets = {
    waist: { y: sign * (0.12 + Math.random() * 0.3), z: sign * (Math.random() - 0.5) * 0.16 },
    spine: { x: -0.08 - Math.random() * 0.25, y: -sign * 0.08 },
    chest: { x: -0.08 - Math.random() * 0.22, y: -sign * 0.1 },
    head: { x: Math.random() * 0.12, y: sign * 0.06 },
  };
  let limb;
  if (useLeg) {
    limb = `foot${side}`;
    targets[`hip${side}`] = { x: -0.65 - Math.random() * 0.75, z: sign * (0.05 + Math.random() * 0.16) };
    targets[`knee${side}`] = { x: 0.18 + Math.random() * 0.65 };
    targets[`ankle${side}`] = { x: -0.15 - Math.random() * 0.25 };
    targets[`hip${side === "L" ? "R" : "L"}`] = { x: -0.2 - Math.random() * 0.25 };
  } else {
    limb = `hand${side}`;
    targets[`shoulder${side}`] = { x: -0.9 - Math.random() * 0.85, y: sign * (Math.random() * 0.25), z: sign * (0.08 + Math.random() * 0.32) };
    targets[`elbow${side}`] = { x: -0.45 - Math.random() * 1.0 };
    targets[`forearm${side}`] = { y: sign * (0.2 + Math.random() * 0.5) };
    targets[`wrist${side}`] = { x: -0.08 - Math.random() * 0.3, y: sign * Math.random() * 0.2 };
    targets[`shoulder${side === "L" ? "R" : "L"}`] = { x: -0.6, z: side === "L" ? -0.8 : 0.8 };
  }
  return {
    type: "joint",
    limb,
    targets,
    duration,
    damage: 5.5 + Math.random() * 5.5,
    stun: 0.08 + Math.random() * 0.1,
    force: 0.35 + Math.random() * 0.35,
    label: "movimento articular livre",
  };
}

export function situationKey(fighter, opponent, distance) {
  const band = distance > 1.9 ? "far" : distance > 1.15 ? "mid" : "close";
  const threat = opponent.isThreatening ? opponent.phase : "calm";
  return `${band}|${threat}|${opponent.blocking ? "guard" : "free"}|${fighter.stun > 0}`;
}

export function chooseAction(bot, fighter, opponent, distance) {
  if (opponent.isThreatening && distance < 2.15) {
    const kind = opponent.move?.kind;
    if (kind === "kick" || kind === "knee") {
      return inward(fighter, -0.62, Math.random() < 0.5 ? -0.7 : 0.7);
    }
    return { type: "block", throttle: -0.18, strafe: 0, hold: 0.28 + Math.random() * 0.18, label: "protege o corpo" };
  }
  if (distance > 1.75) return inward(fighter, 0.78, (Math.random() - 0.5) * 0.35);
  if (distance < 0.82) return inward(fighter, -0.35, Math.random() < 0.5 ? -0.55 : 0.55);
  if (Math.random() < 0.2) return inward(fighter, (Math.random() - 0.5) * 0.25, Math.random() < 0.5 ? -0.55 : 0.55);
  return jointMotion(distance, opponent, fighter);
}
