import * as THREE from "three";
import { bodyPart } from "./fighter/limbs.js";

const _strike = new THREE.Vector3();
const _hurt = new THREE.Vector3();
const _push = new THREE.Vector3();
const _forward = new THREE.Vector3();
const IMPACT_GEOMETRY = new THREE.SphereGeometry(0.045, 6, 6);
const impactMaterials = new Map();

const HURT = [
  { name: "head", radius: 0.2, multiplier: 1.25 },
  { name: "chest", radius: 0.26, multiplier: 1 },
  { name: "pelvis", radius: 0.22, multiplier: 0.85 },
];

export function stayInRing(fighter, radius) {
  const { x, z } = fighter.root.position;
  const distance = Math.hypot(x, z);
  if (distance <= radius) return;
  const nx = x / (distance || 1);
  const nz = z / (distance || 1);
  fighter.root.position.x = nx * radius;
  fighter.root.position.z = nz * radius;

  // The arena edge behaves like a slightly soft barrier, not a teleporting wall.
  const outward = fighter.velocity.x * nx + fighter.velocity.z * nz;
  if (outward > 0) {
    const restitution = fighter.ko ? 0.04 : 0.12;
    fighter.velocity.x -= outward * (1 + restitution) * nx;
    fighter.velocity.z -= outward * (1 + restitution) * nz;
    const tangentX = fighter.velocity.x - (fighter.velocity.x * nx + fighter.velocity.z * nz) * nx;
    const tangentZ = fighter.velocity.z - (fighter.velocity.x * nx + fighter.velocity.z * nz) * nz;
    fighter.velocity.x -= tangentX * 0.08;
    fighter.velocity.z -= tangentZ * 0.08;
  }
}

const BODY_GAP = 0.98;
const CONTACT_SLOP = 0.015;

function bodyInverseMass(fighter) {
  const armor = Math.max(0, Math.min(0.5, fighter.equipmentStats?.defense || 0));
  return 1 / (1 + armor * 0.8 + (fighter.ko ? 0.25 : 0));
}

export function resolveBodies(a, b) {
  const dx = b.root.position.x - a.root.position.x;
  const dz = b.root.position.z - a.root.position.z;
  const distance = Math.hypot(dx, dz) || 0.0001;
  const nx = dx / distance;
  const nz = dz / distance;
  const overlap = BODY_GAP - distance;
  if (overlap < -0.04) return;

  const invA = bodyInverseMass(a);
  const invB = bodyInverseMass(b);
  const invTotal = invA + invB;

  // Positional correction removes penetration without the old equal-split jitter.
  if (overlap > CONTACT_SLOP) {
    const correction = (overlap - CONTACT_SLOP) * 0.82 / invTotal;
    a.root.position.x -= nx * correction * invA;
    a.root.position.z -= nz * correction * invA;
    b.root.position.x += nx * correction * invB;
    b.root.position.z += nz * correction * invB;
  }

  const relativeX = b.velocity.x - a.velocity.x;
  const relativeZ = b.velocity.z - a.velocity.z;
  const normalSpeed = relativeX * nx + relativeZ * nz;
  if (normalSpeed >= 0) return;

  // Small restitution gives body checks a little bounce while preserving momentum.
  const restitution = Math.min(0.18, Math.abs(normalSpeed) * 0.035 + 0.04);
  const normalImpulse = -(1 + restitution) * normalSpeed / invTotal;
  a.velocity.x -= normalImpulse * invA * nx;
  a.velocity.z -= normalImpulse * invA * nz;
  b.velocity.x += normalImpulse * invB * nx;
  b.velocity.z += normalImpulse * invB * nz;

  // Coulomb-like tangential friction reduces sideways skating during contact.
  const tangentX = relativeX - normalSpeed * nx;
  const tangentZ = relativeZ - normalSpeed * nz;
  const tangentSpeed = Math.hypot(tangentX, tangentZ);
  if (tangentSpeed > 1e-5) {
    const friction = Math.min(tangentSpeed / invTotal, normalImpulse * 0.32);
    const tx = tangentX / tangentSpeed;
    const tz = tangentZ / tangentSpeed;
    a.velocity.x += friction * invA * tx;
    a.velocity.z += friction * invA * tz;
    b.velocity.x -= friction * invB * tx;
    b.velocity.z -= friction * invB * tz;
  }
}

function connect(attacker, defender) {
  const move = attacker.move;
  if (!move || !move.limb || !(move.damage > 0) || attacker.phase !== "active" || attacker.didHit || defender.ko) {
    return null;
  }
  const part = bodyPart(move.limb);
  if (part && attacker.missing.has(part)) return null;

  const weaponStrike = move.limb === "handR" && attacker.hasWeapon && attacker.skeleton?.weapon;
  if (weaponStrike && attacker.skeleton.anchors.weaponTip) {
    attacker.anchorWorld("weaponTip", _strike);
  } else {
    attacker.anchorWorld(move.limb, _strike);
  }
  let best = null;
  for (const part of HURT) {
    defender.anchorWorld(part.name, _hurt);
    const distance = _strike.distanceTo(_hurt);
    const weaponReach = weaponStrike ? 0.12 + ((attacker.skeleton.weaponReach || 0.58) - 0.58) * 0.7 : 0;
    if (distance <= move.reach + weaponReach + part.radius && (!best || distance < best.distance)) {
      best = { ...part, distance, point: _hurt.clone() };
    }
  }
  if (!best) return null;

  attacker.didHit = true;
  _push.set(
    defender.root.position.x - attacker.root.position.x,
    0,
    defender.root.position.z - attacker.root.position.z,
  );
  if (_push.lengthSq() < 1e-6) _push.set(0, 0, 1);
  _push.normalize();

  defender.forward(_forward);
  const facing = _forward.dot(_push.clone().multiplyScalar(-1));
  const guardUp = defender.blocking && facing > 0.25;
  const breaksGuard = move.kind === "kick" || move.kind === "knee";
  const blocked = guardUp && !breaksGuard;
  const chipped = guardUp && breaksGuard;

  const weaponDamage = weaponStrike ? (attacker.skeleton.weaponDamage || 1.15) : 1;
  const attackBonus = 1 + (attacker.equipmentStats?.damage || 0);
  let damage = move.damage * best.multiplier * weaponDamage * attackBonus;
  let stun = move.stun;
  let force = move.force;
  if (blocked) {
    damage *= 0.12;
    stun = 0;
    force *= 0.22;
  } else if (chipped) {
    damage *= 0.55;
    stun *= 0.4;
    force *= 0.6;
    defender.blocking = false;
  }

  damage *= 1 - (defender.equipmentStats?.defense || 0);

  return {
    attacker,
    defender,
    damage,
    stun,
    force,
    direction: _push.clone(),
    blocked: blocked || chipped,
    side: Math.random() < 0.5 ? -1 : 1,
    point: best.point,
    part: best.name,
    move,
  };
}

function connectJoint(attacker, defender) {
  const command = attacker.jointCommand;
  if (!command || command.didHit || defender.ko) return null;
  const t = command.time / command.duration;
  if (t < 0.3 || t > 0.76) return null;
  const part = bodyPart(command.limb);
  if (part && attacker.missing.has(part)) return null;
  attacker.anchorWorld(command.limb, _strike);
  let best = null;
  for (const target of HURT) {
    defender.anchorWorld(target.name, _hurt);
    const distance = _strike.distanceTo(_hurt);
    if (distance <= 0.34 + target.radius && (!best || distance < best.distance)) {
      best = { ...target, distance, point: _hurt.clone() };
    }
  }
  if (!best) return null;
  command.didHit = true;
  _push.set(defender.root.position.x - attacker.root.position.x, 0, defender.root.position.z - attacker.root.position.z);
  if (_push.lengthSq() < 1e-6) _push.set(0, 0, 1);
  _push.normalize();
  defender.forward(_forward);
  const facing = _forward.dot(_push.clone().multiplyScalar(-1));
  const blocked = defender.blocking && facing > 0.25;
  const damage = command.damage * best.multiplier * (blocked ? 0.12 : 1) * (1 - (defender.equipmentStats?.defense || 0));
  return {
    attacker, defender, damage,
    stun: blocked ? 0 : command.stun,
    force: command.force * (blocked ? 0.22 : 1),
    direction: _push.clone(), blocked,
    side: Math.random() < 0.5 ? -1 : 1,
    point: best.point, part: best.name,
    move: { id: "joint-motion", name: "movimento articular", kind: "free", limb: command.limb },
  };
}

export function resolveHits(a, b) {
  return [connect(a, b) || connectJoint(a, b), connect(b, a) || connectJoint(b, a)].filter(Boolean);
}

export function createImpact(scene, point, color) {
  const group = new THREE.Group();
  group.position.copy(point);
  const key = Number(color);
  let material = impactMaterials.get(key);
  if (!material) {
    material = new THREE.MeshBasicMaterial({ color });
    impactMaterials.set(key, material);
  }
  for (let i = 0; i < 8; i += 1) {
    const piece = new THREE.Mesh(IMPACT_GEOMETRY, material);
    piece.userData.velocity = new THREE.Vector3(
      (Math.random() - 0.5) * 3.2,
      Math.random() * 2.4,
      (Math.random() - 0.5) * 3.2,
    );
    group.add(piece);
  }
  scene.add(group);
  return { group, life: 0.32 };
}

export function updateImpacts(impacts, dt) {
  for (let i = impacts.length - 1; i >= 0; i -= 1) {
    const impact = impacts[i];
    impact.life -= dt;
    for (const piece of impact.group.children) {
      piece.position.addScaledVector(piece.userData.velocity, dt);
      piece.userData.velocity.y -= 6 * dt;
    }
    if (impact.life <= 0) {
      impact.group.parent?.remove(impact.group);
      impacts.splice(i, 1);
    }
  }
}
