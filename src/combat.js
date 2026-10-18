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
  const nx = x / distance;
  const nz = z / distance;
  fighter.root.position.x = nx * radius;
  fighter.root.position.z = nz * radius;
  const outward = fighter.velocity.x * nx + fighter.velocity.z * nz;
  if (outward > 0) {
    fighter.velocity.x -= outward * nx;
    fighter.velocity.z -= outward * nz;
  }
}

const BODY_GAP = 0.98;

export function resolveBodies(a, b) {
  const dx = b.root.position.x - a.root.position.x;
  const dz = b.root.position.z - a.root.position.z;
  const distance = Math.hypot(dx, dz) || 0.0001;
  const nx = dx / distance;
  const nz = dz / distance;
  if (distance < BODY_GAP) {
    const overlap = BODY_GAP - distance;
    a.root.position.x -= nx * overlap * 0.5;
    a.root.position.z -= nz * overlap * 0.5;
    b.root.position.x += nx * overlap * 0.5;
    b.root.position.z += nz * overlap * 0.5;
  } else if (distance > BODY_GAP + 0.04) {
    return;
  }

  const rel = (b.velocity.x - a.velocity.x) * nx + (b.velocity.z - a.velocity.z) * nz;
  if (rel < 0) {
    const impulse = -rel * 0.5;
    a.velocity.x -= impulse * nx;
    a.velocity.z -= impulse * nz;
    b.velocity.x += impulse * nx;
    b.velocity.z += impulse * nz;
  }
}

function connect(attacker, defender) {
  const move = attacker.move;
  if (!move || !move.limb || !(move.damage > 0) || attacker.phase !== "active" || attacker.didHit || defender.ko) {
    return null;
  }
  const part = bodyPart(move.limb);
  if (part && attacker.missing.has(part)) return null;

  const weaponStrike = move.limb === "handR" && attacker.skeleton?.weapon;
  if (weaponStrike && attacker.skeleton.anchors.weaponTip) {
    attacker.anchorWorld("weaponTip", _strike);
  } else {
    attacker.anchorWorld(move.limb, _strike);
  }
  let best = null;
  for (const part of HURT) {
    defender.anchorWorld(part.name, _hurt);
    const distance = _strike.distanceTo(_hurt);
    const weaponReach = weaponStrike ? 0.12 : 0;
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
  let damage = move.damage * best.multiplier * weaponDamage;
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

export function resolveHits(a, b) {
  return [connect(a, b), connect(b, a)].filter(Boolean);
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
