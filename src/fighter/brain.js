import { MOVES } from "./moves.js";
import { limbReady } from "./limbs.js";
import { ROAM_RADIUS } from "../forest.js";

function yawRight(yaw) {
  return { x: Math.cos(yaw), z: -Math.sin(yaw) };
}

function bandOf(distance) {
  if (distance > 1.85) return "far";
  if (distance > 1.22) return "mid";
  return "close";
}

function inRange(id, distance) {
  const move = MOVES[id];
  return !!move && distance >= move.range.min && distance <= move.range.max;
}

function weaveId(fighter) {
  const right = yawRight(fighter.root.rotation.y);
  const towardCenter = -(fighter.root.position.x * right.x + fighter.root.position.z * right.z);
  return towardCenter > 0 ? "weaveR" : "weaveL";
}

function bestMove(ids, distance, personality, opponent, lastId, followUp, fighter) {
  let best = null;
  let bestScore = -Infinity;
  for (const id of ids) {
    const move = MOVES[id];
    if (!move || !inRange(id, distance) || !limbReady(fighter, move)) continue;
    let score = move.bias * (personality.weights[move.kind] ?? 0.8);
    if (opponent.stun > 0 && move.damage > 0) score += 0.7;
    if (opponent.phase === "recover" && move.damage > 0) score += 0.45;
    if (opponent.blocking && (move.kind === "kick" || move.kind === "knee")) score += 1.1;
    if (opponent.blocking && move.kind === "punch") score -= 0.85;
    if (id === lastId) score -= 0.9;
    if (id === followUp) score += 0.28;
    const center = (move.range.min + move.range.max) * 0.5;
    score += (1 - Math.min(1, Math.abs(distance - center) / 0.55)) * 0.4;
    const answer = opponent.recentId ? MOVES[opponent.recentId] : null;
    if (answer && answer.kind === "punch" && (move.kind === "kick" || move.kind === "knee")) score += 0.34;
    if (answer && answer.kind === move.kind) score -= 0.22;
    if (distance < 1.05 && (id === "elbow" || id === "knee" || id === "uppercut")) score += 0.45;
    if (distance > 1.45 && (id === "jab" || id === "lowkick" || id === "sweep")) score += 0.3;
    if (score > bestScore) {
      bestScore = score;
      best = move;
    }
  }
  return best;
}

function strike(move, label) {
  return { type: "strike", id: move.id, label, throttle: 0, strafe: 0 };
}

function answerThreat(fighter, opponent, distance, personality) {
  const name = opponent.move?.name || "golpe";
  const kind = opponent.move?.kind;
  const patient = personality.defense >= 1;

  if (opponent.phase === "active") {
    if (kind === "kick" || kind === "knee") {
      return strike(MOVES[weaveId(fighter)], `esquiva o ${name}`);
    }
    if (patient) return strike(MOVES.duck, `agacha no ${name}`);
    return { type: "block", throttle: -0.45, strafe: 0, hold: 0.42, label: `bloqueia o ${name}` };
  }

  if (patient) {
    if (kind === "kick" || kind === "knee") {
      return { type: "go", throttle: -0.85, strafe: 0.55, label: `sai do ${name}` };
    }
    return { type: "block", throttle: -0.15, strafe: 0, hold: 0.36, label: `lê o ${name}` };
  }

  const interrupt = bestMove(["jab", "lowkick", "cross"], distance, personality, opponent, null, null, fighter);
  if (interrupt && distance < 1.7) return strike(interrupt, `interrompe com ${interrupt.name}`);
  return { type: "block", throttle: 0, strafe: 0, hold: 0.32, label: `segura o ${name}` };
}

function stepInward(fighter, action) {
  if (action.type !== "go") return action;
  const radius = Math.hypot(fighter.root.position.x, fighter.root.position.z);
  if (radius < ROAM_RADIUS) return action;
  const right = yawRight(fighter.root.rotation.y);
  const yaw = fighter.root.rotation.y;
  const vx = Math.sin(yaw) * action.throttle + right.x * action.strafe;
  const vz = Math.cos(yaw) * action.throttle + right.z * action.strafe;
  const outward = (fighter.root.position.x * vx + fighter.root.position.z * vz) / radius;
  if (outward <= 0.05) return action;
  return { type: "go", throttle: 0.15, strafe: action.strafe > 0 ? -0.7 : 0.7, label: "volta ao centro" };
}

export function situationKey(fighter, opponent, distance) {
  const band = bandOf(distance);
  const threat = opponent.isThreatening ? `${opponent.phase}:${opponent.move?.id}` : "calm";
  const state = opponent.stun > 0 ? "stun" : opponent.blocking ? "guard" : opponent.phase;
  return `${band}|${threat}|${state}|${fighter.recentSerial}`;
}

export function chooseAction(bot, fighter, opponent, distance) {
  const personality = bot.profile;
  const myHp = fighter.health / fighter.maxHealth;
  const theirHp = opponent.health / opponent.maxHealth;
  const band = bandOf(distance);

  if (opponent.isThreatening && distance < 2.2) {
    return stepInward(fighter, answerThreat(fighter, opponent, distance, personality));
  }

  if (opponent.stun > 0 || opponent.phase === "recover") {
    const punish = bestMove(personality.kit, distance, personality, opponent, bot.lastId, bot.followUp, fighter);
    if (punish?.damage > 0) {
      const label = punish.id === bot.followUp ? `emenda ${punish.name}` : `castiga com ${punish.name}`;
      return strike(punish, label);
    }
  }

  if (opponent.blocking) {
    const breaker = bestMove(
      personality.kit.filter((id) => MOVES[id].kind === "kick" || MOVES[id].kind === "knee"),
      distance,
      personality,
      opponent,
      bot.lastId,
      bot.followUp,
      fighter,
    );
    if (breaker) return strike(breaker, "quebra a guarda");
    return { type: "go", throttle: -0.35, strafe: 0.7, label: "procura o lado aberto" };
  }

  if (bot.justMissed && bot.lastId) {
    const side = weaveId(fighter) === "weaveR" ? 0.85 : -0.85;
    return stepInward(fighter, { type: "go", throttle: 0.1, strafe: side, label: "reposiciona após o erro" });
  }

  if (band === "far") {
    if (myHp < 0.34 && myHp + 0.08 < theirHp) return { type: "go", throttle: -0.35, strafe: 0.75, label: "segura a distância" };
    if (theirHp + 0.22 < myHp && inRange("taunt", distance) && personality.kit.includes("taunt")) {
      return strike(MOVES.taunt, "provoca");
    }
    return stepInward(fighter, { type: "go", throttle: 1, strafe: 0, label: "fecha a distância" });
  }

  const pool = (band === "close"
    ? ["elbow", "knee", "uppercut", "hook", "shove", "cross"]
    : ["jab", "cross", "hook", "lowkick", "kick", "sweep", "feint"]
  ).filter((id) => personality.kit.includes(id));

  const chosen = bestMove(pool, distance, personality, opponent, bot.lastId, bot.followUp, fighter);
  if (chosen) {
    const label = chosen.id === bot.followUp ? `emenda ${chosen.name}` : chosen.name;
    return strike(chosen, label);
  }

  if (band === "close") return { type: "go", throttle: -0.55, strafe: 0.2, label: "abre espaço" };
  return stepInward(fighter, { type: "go", throttle: 0.85, strafe: 0, label: "ajusta a distância" });
}
