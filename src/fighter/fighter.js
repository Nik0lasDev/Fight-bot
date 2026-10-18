import * as THREE from "three";
import { dampAngle } from "../math.js";
import { clampPose, JOINT_SPEED, stepJoint } from "./body-laws.js";
import { clonePose, flinchPose, LIMB, GUARD, POSE_JOINTS, VICTORY } from "./poses.js";
import { addWalk } from "./walk.js";
import { sampleMove } from "./moves.js";
import { articulate, holdPose } from "./motors.js";
import { Skeleton } from "./skeleton.js";
import { bodyPart, condemnedLimbs, LIMB_LABEL, readLimbPose } from "./limbs.js";

const _forward = new THREE.Vector3();
const _right = new THREE.Vector3();
const _toOpponent = new THREE.Vector3();
const _sole = new THREE.Vector3();

export class Fighter {
  constructor({ name, color, position, weapon = "sword" }) {
    this.name = name;
    this.color = color;
    this.skeleton = new Skeleton(color, weapon);
    this.weaponPickup = { phase: "search", time: 0, target: null, item: null };
    this.hasWeapon = false;
    this.root = this.skeleton.root;
    this.root.position.set(position.x, 0, position.z);
    this.hasWeapon = false;
    this.weaponPickup.phase = "search";
    this.weaponPickup.time = 0;

    this.health = 100;
    this.maxHealth = 100;
    this.stun = 0;
    this.ko = false;
    this.koTime = 0;
    this.standY = 0;
    this.move = null;
    this.moveTime = 0;
    this.phase = "idle";
    this.didHit = false;
    this.blocking = false;
    this.flinchSide = 1;
    this.throttle = 0;
    this.strafe = 0;
    this.planarSpeed = 0;
    this.walkPhase = Math.random() * Math.PI * 2;
    this.velocity = new THREE.Vector3();
    this.style = { punch: 1, kick: 1, knee: 1 };
    this.recentId = null;
    this.recentContact = null;
    this.recentSerial = 0;
    this.missing = new Set();
    this.losses = [];
    this._jointSample = null;
    this._jointSampleNext = null;
    this._lostDesired = [];
    this._lostActual = [];

    this._applyPose(1 / 60, { ko: false });
  }

  get isThreatening() {
    if (!this.move || this.ko) return false;
    if (this.phase !== "windup" && this.phase !== "active") return false;
    return this.move.damage > 0 || this.move.threat;
  }

  tryMove(move) {
    const part = bodyPart(move?.limb);
    if (part && this.missing.has(part)) return false;
    if (this.move || this.stun > 0 || this.ko || this.blocking) return false;
    this.move = move;
    this.moveTime = 0;
    this.phase = "windup";
    this.didHit = false;
    return true;
  }

  setLocomotion(throttle, strafe) {
    this.throttle = throttle;
    this.strafe = strafe;
  }

  receiveHit({ damage, stun, force, direction, blocked, side }) {
    this.health = Math.max(0, this.health - damage);
    this.flinchSide = side;
    if (stun > 0) this.stun = Math.max(this.stun, stun);
    if (!blocked) {
      this._finishMove("hurt");
      this.move = null;
      this.phase = "idle";
      this.blocking = false;
    }
    this.velocity.x += direction.x * force * 3.4;
    this.velocity.z += direction.z * force * 3.4;
    if (this.health <= 0) {
      this.ko = true;
      this.koTime = 0;
      this.move = null;
      this.blocking = false;
    }
    this.skeleton.setHealth(this.health / this.maxHealth);
  }

  reset(position) {
    this.health = this.maxHealth;
    this.stun = 0;
    this.ko = false;
    this.koTime = 0;
    this.move = null;
    this.phase = "idle";
    this.didHit = false;
    this.blocking = false;
    this.throttle = 0;
    this.strafe = 0;
    this.velocity.set(0, 0, 0);
    this.root.position.set(position.x, 0, position.z);
    this.root.rotation.set(0, 0, 0);
    this.missing.clear();
    this.losses = [];
    this._jointSample = null;
    this._jointSampleNext = null;
    this._lostDesired.length = 0;
    this._lostActual.length = 0;
    this.skeleton.showLimbs();
    this.skeleton.setHealth(1);
    this._applyPose(1, { ko: false });
    this._plantFeet();
    this.root.updateMatrixWorld(true);
  }

  anchorWorld(name, target) {
    return this.skeleton.anchorWorld(name, target);
  }

  forward(target) {
    target.set(Math.sin(this.root.rotation.y), 0, Math.cos(this.root.rotation.y));
    return target;
  }

  update(dt, opponent) {
    this.stun = Math.max(0, this.stun - dt);

    if (!this.ko) {
      this._face(opponent, dt);
      this._advanceMove(dt);
      this._move(dt);
    } else {
      this.koTime += dt;
      this.throttle = 0;
      this.strafe = 0;
    }

    this._applyPose(dt, opponent);
    this._updateWeaponPickup(dt);
    if (!this.ko) this._plantFeet();
    else this._fall();

    this.root.updateMatrixWorld(true);
  }

  _face(opponent, dt) {
    _toOpponent.set(
      opponent.root.position.x - this.root.position.x,
      0,
      opponent.root.position.z - this.root.position.z,
    );
    if (_toOpponent.lengthSq() < 1e-6) return;
    const yaw = Math.atan2(_toOpponent.x, _toOpponent.z);
    this.root.rotation.y = dampAngle(this.root.rotation.y, yaw, 10, dt);
  }

  _advanceMove(dt) {
    if (!this.move) return;
    this.moveTime += dt;
    this.phase = sampleMove(this.move, this.moveTime).phase;
    if (this.moveTime >= this.move.duration) {
      this._finishMove(this.didHit ? "landed" : "miss");
      this.move = null;
      this.phase = "idle";
    }
  }

  _finishMove(contact) {
    if (!this.move) return;
    this.recentId = this.move.id;
    this.recentContact = contact;
    this.recentSerial += 1;
  }

  _steer(desiredX, desiredZ, rate, dt) {
    const dx = desiredX - this.velocity.x;
    const dz = desiredZ - this.velocity.z;
    const length = Math.hypot(dx, dz);
    const step = rate * dt;
    if (length <= step || length < 1e-5) {
      this.velocity.x = desiredX;
      this.velocity.z = desiredZ;
      return;
    }
    this.velocity.x += (dx / length) * step;
    this.velocity.z += (dz / length) * step;
  }

  _move(dt) {
    const yaw = this.root.rotation.y;
    _forward.set(Math.sin(yaw), 0, Math.cos(yaw));
    _right.set(Math.cos(yaw), 0, -Math.sin(yaw));
    let throttle = this.throttle;
    let strafe = this.strafe;
    const driving = this.phase === "active" || this.phase === "windup" || this.phase === "defend";
    if (this.move && this.stun <= 0 && driving) {
      throttle = this.move.lunge || 0;
      strafe = this.move.strafe || 0;
    }
    if (this.stun > 0) {
      throttle = 0;
      strafe = 0;
    }

    const walk = 2.25;
    const desiredX = _forward.x * throttle * walk + _right.x * strafe * walk * 0.82;
    const desiredZ = _forward.z * throttle * walk + _right.z * strafe * walk * 0.82;
    const pushing = Math.hypot(desiredX, desiredZ) > 0.2;
    const rate = this.stun > 0 ? 4.5 : pushing ? (this.move ? 13 : 7.2) : 10;
    this._steer(desiredX, desiredZ, rate, dt);

    this.root.position.x += this.velocity.x * dt;
    this.root.position.z += this.velocity.z * dt;
    this.planarSpeed = Math.hypot(this.velocity.x, this.velocity.z);
    this.walkPhase += dt * (2.6 + this.planarSpeed * 1.7);
  }

  _distanceTo(opponent) {
    if (!opponent?.root) return 1.4;
    return Math.hypot(
      opponent.root.position.x - this.root.position.x,
      opponent.root.position.z - this.root.position.z,
    );
  }

  _desiredPose(opponent) {
    const distance = this._distanceTo(opponent);
    if (this.ko) return clampPose(clonePose(LIMB));
    if (this.stun > 0) return clampPose(flinchPose(this.flinchSide));
    if (opponent.ko) return clampPose(clonePose(VICTORY));
    if (this.move) return articulate(this.move, this.moveTime, distance, this.style);
    if (this.blocking) return holdPose("block", distance, this.style);
    const pose = clonePose(GUARD);
    addWalk(pose, this.walkPhase, this.planarSpeed);
    pose.waist.y += Math.sin(this.walkPhase * 0.55) * 0.04;
    pose.spine.x += Math.sin(this.walkPhase * 0.45) * 0.025;
    pose.lumbar.x += Math.sin(this.walkPhase * 0.4) * 0.025;
    pose.ribs.y += Math.sin(this.walkPhase * 0.5) * 0.03;
    pose.head.y += Math.sin(this.walkPhase * 0.32) * 0.05;
    pose.nape.x += Math.sin(this.walkPhase * 0.32) * 0.035;
    pose.jaw.x += Math.sin(this.walkPhase * 0.65) * 0.05;
    pose.fingerL.x += Math.sin(this.walkPhase * 0.9) * 0.08;
    pose.fingerR.x += Math.sin(this.walkPhase * 0.9 + 0.7) * 0.08;
    return clampPose(pose);
  }


  _updateWeaponPickup(dt) {
    if (this.hasWeapon || !this.weaponPickup.target || !this.weaponPickup.item) return;
    const pickup = this.weaponPickup;
    const target = pickup.target;
    const dx = target.x - this.root.position.x;
    const dz = target.z - this.root.position.z;
    const distance = Math.hypot(dx, dz);
    if (pickup.phase === "search" && distance < 0.9) {
      pickup.phase = "reach";
      pickup.time = 0;
      this.setLocomotion(0, 0);
      this.velocity.x *= 0.25;
      this.velocity.z *= 0.25;
    }
    if (pickup.phase !== "reach") return;
    pickup.time += dt;
    const t = Math.min(1, pickup.time / 0.95);
    const shoulder = this.skeleton.joints.shoulderR;
    const elbow = this.skeleton.joints.elbowR;
    const wrist = this.skeleton.joints.wristR;
    const fingers = this.skeleton.joints.fingerR;
    if (shoulder) {
      shoulder.rotation.x = THREE.MathUtils.lerp(shoulder.rotation.x, -1.85, Math.min(1, dt * 7));
      shoulder.rotation.z = THREE.MathUtils.lerp(shoulder.rotation.z, -0.25, Math.min(1, dt * 7));
    }
    if (elbow) elbow.rotation.x = THREE.MathUtils.lerp(elbow.rotation.x, -0.45, Math.min(1, dt * 7));
    if (wrist) wrist.rotation.x = THREE.MathUtils.lerp(wrist.rotation.x, -0.45, Math.min(1, dt * 7));
    if (fingers) fingers.rotation.x = THREE.MathUtils.lerp(fingers.rotation.x, -0.2, Math.min(1, dt * 7));
    this.skeleton.setHandGrip("R", t > 0.42);
    if (pickup.time >= 0.95) {
      const wristJoint = this.skeleton.joints.wristR;
      this.root.updateMatrixWorld(true);
      this.skeleton.gripWeapon(wristJoint, pickup.item);
      this.hasWeapon = true;
      pickup.phase = "done";
      this.throttle = 0;
      this.strafe = 0;
    }
  }

  takeLosses() {
    const pending = this.losses;
    this.losses = [];
    return pending;
  }

  _applyPose(dt, opponent) {
    const desired = this._desiredPose(opponent);
    for (const name of POSE_JOINTS) {
      const joint = this.skeleton.joints[name];
      stepJoint(joint.rotation, desired[name], JOINT_SPEED[name], dt, joint.rotation);
    }
    this._ripLimbs(desired, dt);

    for (const limb of ["handL", "handR", "footL", "footR", "elbowL", "elbowR", "kneeL", "kneeR"]) {
      const striking = this.move && this.phase === "active" && this.move.limb === limb;
      this.skeleton.accents[limb].emissiveIntensity = striking ? 0.9 : 0.05;
    }
  }

  _ripLimbs(desired, dt) {
    const actual = readLimbPose(this.skeleton.joints, this._jointSampleNext || undefined);
    for (const id of condemnedLimbs(desired, null, 0, this._lostDesired)) this._loseLimb(id);
    for (const id of condemnedLimbs(actual, this._jointSample, dt, this._lostActual)) this._loseLimb(id);
    this._jointSampleNext = this._jointSample;
    this._jointSample = actual;
  }

  _loseLimb(id) {
    if (this.missing.has(id)) return;
    this.missing.add(id);
    this.skeleton.hideLimb(id);
    this.losses.push(LIMB_LABEL[id]);
    if (this.move && bodyPart(this.move.limb) === id) {
      this._finishMove("miss");
      this.move = null;
      this.phase = "idle";
    }
  }

  _plantFeet() {
    this.root.updateMatrixWorld(true);
    let lowest = Infinity;
    for (const name of ["footL", "footR", "toeTipL", "toeTipR"]) {
      this.skeleton.anchorWorld(name, _sole);
      lowest = Math.min(lowest, _sole.y);
    }
    this.root.position.y -= lowest - 0.02;
    this.standY = this.root.position.y;
  }

  _fall() {
    const k = Math.min(1, this.koTime / 0.75);
    const ease = k * k * (3 - 2 * k);
    this.root.rotation.x = ease * 1.25;
    this.root.position.y = this.standY * (1 - ease) + 0.2 * ease;
  }
}
