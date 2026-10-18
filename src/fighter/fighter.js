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
    this.weaponScene = null;
    this.onWeaponDrop = null;
    this.gripSlipCooldown = 0;
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
    this.jointCommand = null;
    this.phase = "idle";
    this.didHit = false;
    this.blocking = false;
    this.flinchSide = 1;
    this.throttle = 0;
    this.strafe = 0;
    this.planarSpeed = 0;
    this.walkPhase = Math.random() * Math.PI * 2;
    this.velocity = new THREE.Vector3();
    this.bodyAngularVelocity = new THREE.Vector2();
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
    if (this.jointCommand && !this.jointCommand.didHit && this.jointCommand.time < this.jointCommand.duration * 0.78 && !this.ko) return true;
    if (!this.move || this.ko) return false;
    if (this.phase !== "windup" && this.phase !== "active") return false;
    return this.move.damage > 0 || this.move.threat;
  }

  startJointMotion(command) {
    if (!command?.targets || this.move || this.jointCommand || this.stun > 0 || this.ko || this.blocking) return false;
    const part = bodyPart(command.limb);
    if (part && this.missing.has(part)) return false;
    this.jointCommand = { ...command, time: 0, didHit: false };
    this.phase = "windup";
    return true;
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
    this._testWeaponGrip(force, blocked);
    this.flinchSide = side;
    if (stun > 0) this.stun = Math.max(this.stun, stun * (1 - (this.equipmentStats?.stunResist || 0)));
    if (!blocked) {
      this._finishMove("hurt");
      this.move = null;
      this.jointCommand = null;
      this.phase = "idle";
      this.blocking = false;
    }
    const impactMass = 1 + Math.max(0, Math.min(0.5, this.equipmentStats?.defense || 0)) * 0.8;
    this.velocity.x += direction.x * force * 3.4 / impactMass;
    this.velocity.z += direction.z * force * 3.4 / impactMass;
    // Off-center hits add angular momentum, briefly tipping the body before it recovers.
    this.bodyAngularVelocity.x += direction.z * force * 0.14;
    this.bodyAngularVelocity.y += (-direction.x * force * 0.14) + side * force * 0.055;
    if (this.health <= 0) {
      this.ko = true;
      this.koTime = 0;
      this.move = null;
      this.jointCommand = null;
      this.blocking = false;
    }
    if (this.health <= 0) this._dropHeldWeapon();
    this.skeleton.setHealth(this.health / this.maxHealth);
  }

  _testWeaponGrip(force = 0, blocked = false) {
    if (!this.hasWeapon || this.gripSlipCooldown > 0) return;
    const wrist = this.skeleton.joints.wristR;
    const closure = this.skeleton.handGrip.R || 0;
    const wristStrain = wrist ? Math.min(1, Math.abs(wrist.rotation.x) * 0.12 + Math.abs(wrist.rotation.z) * 0.1) : 0.2;
    const impact = Math.max(0, force || 0) * (blocked ? 0.48 : 1);
    this.skeleton.gripStrength = Math.max(0, this.skeleton.gripStrength - impact * (0.075 + wristStrain * 0.045));
    const weakGrip = (1 - closure) * 0.22 + (1 - this.skeleton.gripStrength) * 0.28;
    const slipChance = Math.min(0.88, Math.max(0, impact - 0.55) * 0.22 + weakGrip);
    if (impact > 1.05 && Math.random() < slipChance) {
      this._dropHeldWeapon();
      this.gripSlipCooldown = 1.2;
    }
  }

  _dropHeldWeapon() {
    if (!this.hasWeapon || !this.weaponScene) return;
    const dropped = this.skeleton.releaseWeapon(this.weaponScene, this.root.rotation.y, this.velocity);
    if (!dropped) return;
    this.hasWeapon = false;
    this.weaponPickup.phase = 'search';
    this.weaponPickup.time = 0;
    this.weaponPickup.item = null;
    this.weaponPickup.target = null;
    if (this.onWeaponDrop) this.onWeaponDrop(dropped);
  }

  reset(position) {
    this.health = this.maxHealth;
    this.stun = 0;
    this.ko = false;
    this.koTime = 0;
    this.move = null;
    this.jointCommand = null;
    this.phase = "idle";
    this.didHit = false;
    this.blocking = false;
    this.throttle = 0;
    this.strafe = 0;
    this.velocity.set(0, 0, 0);
    this.bodyAngularVelocity.set(0, 0);
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
    this.gripSlipCooldown = Math.max(0, this.gripSlipCooldown - dt);
    if (this.hasWeapon) this.skeleton.gripStrength = Math.min(1, this.skeleton.gripStrength + dt * 0.018);

    if (!this.ko) {
      this._face(opponent, dt);
      this._advanceMove(dt);
      if (this.jointCommand) {
        this.jointCommand.time += dt;
        if (this.jointCommand.time >= this.jointCommand.duration) this.jointCommand = null;
      }
      this._move(dt);
      this._updateBodyBalance(dt);
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
    // During a pickup, orient the body toward the actual item rather than the
    // opponent, otherwise the reaching hand can miss the weapon on the floor.
    const pickupTarget = !this.hasWeapon && this.weaponPickup.target && this.weaponPickup.item
      ? this.weaponPickup.target
      : null;
    _toOpponent.set(
      (pickupTarget?.x ?? opponent.root.position.x) - this.root.position.x,
      0,
      (pickupTarget?.z ?? opponent.root.position.z) - this.root.position.z,
    );
    if (_toOpponent.lengthSq() < 1e-6) return;
    const yaw = Math.atan2(_toOpponent.x, _toOpponent.z);
    this.root.rotation.y = dampAngle(this.root.rotation.y, yaw, pickupTarget ? 14 : 10, dt);
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

    const walk = 2.25 * (1 + (this.equipmentStats?.speed || 0));
    const desiredX = _forward.x * throttle * walk + _right.x * strafe * walk * 0.82;
    const desiredZ = _forward.z * throttle * walk + _right.z * strafe * walk * 0.82;
    const desiredSpeed = Math.hypot(desiredX, desiredZ);
    const pushing = desiredSpeed > 0.2;

    if (pushing) {
      // Acceleration is limited, so changing direction carries a little momentum.
      const rate = this.stun > 0 ? 2.8 : this.move ? 9.2 : 6.4;
      this._steer(desiredX, desiredZ, rate, dt);
    } else {
      // Ground friction slows the fighter gradually instead of cancelling velocity instantly.
      const drag = this.stun > 0 ? 0.85 : this.ko ? 1.8 : 3.4;
      const damping = Math.exp(-drag * dt);
      this.velocity.x *= damping;
      this.velocity.z *= damping;
    }

    // Keep lunges and knockback bounded while still allowing a short burst of speed.
    const maxSpeed = this.stun > 0 ? 4.2 : this.move ? 3.65 : 2.8;
    const speed = Math.hypot(this.velocity.x, this.velocity.z);
    if (speed > maxSpeed) {
      const scale = maxSpeed / speed;
      this.velocity.x *= scale;
      this.velocity.z *= scale;
    }

    this.root.position.x += this.velocity.x * dt;
    this.root.position.z += this.velocity.z * dt;
    this.planarSpeed = Math.hypot(this.velocity.x, this.velocity.z);
    this.walkPhase += dt * (2.6 + this.planarSpeed * 1.7);
  }

  _updateBodyBalance(dt) {
    const spring = 16;
    const damping = 5.2;
    this.bodyAngularVelocity.x += (-this.root.rotation.x * spring - this.bodyAngularVelocity.x * damping) * dt;
    this.bodyAngularVelocity.y += (-this.root.rotation.z * spring - this.bodyAngularVelocity.y * damping) * dt;
    this.root.rotation.x = THREE.MathUtils.clamp(this.root.rotation.x + this.bodyAngularVelocity.x * dt, -0.24, 0.24);
    this.root.rotation.z = THREE.MathUtils.clamp(this.root.rotation.z + this.bodyAngularVelocity.y * dt, -0.24, 0.24);
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
    if (!this.hasWeapon && this.weaponPickup.phase === "reach" && this.weaponPickup.item) {
      // A staged pickup: lower the body first, then extend the arm, curl the
      // fingers around the grip, and finally rise with the item.
      // Hold the crouched reach pose while searching for contact; never loop
      // back to standing just because the hand missed on the first attempt.
      const t = Math.min(0.72, THREE.MathUtils.clamp(this.weaponPickup.time / 1.35, 0, 1));
      const crouch = THREE.MathUtils.smoothstep(t, 0.02, 0.48);
      const reach = THREE.MathUtils.smoothstep(t, 0.22, 0.7);
      const lift = THREE.MathUtils.smoothstep(t, 0.7, 1);
      const pose = clonePose(GUARD);
      pose.waist.x += 0.5 * crouch - 0.28 * lift;
      pose.lumbar.x += 0.34 * crouch - 0.22 * lift;
      pose.spine.x += 0.18 * crouch - 0.12 * lift;
      pose.chest.x += 0.12 * crouch;
      pose.head.x += -0.12 * crouch;
      pose.hipL.x += -0.52 * crouch;
      pose.hipR.x += -0.52 * crouch;
      pose.kneeL.x += 0.92 * crouch;
      pose.kneeR.x += 0.92 * crouch;
      pose.ankleL.x += -0.32 * crouch;
      pose.ankleR.x += -0.32 * crouch;
      pose.shoulderR.x += -1.25 * reach + 0.72 * lift;
      pose.shoulderR.z += 0.12 * reach;
      pose.elbowR.x += -0.5 * reach + 0.18 * lift;
      pose.wristR.x += -0.28 * reach;
      pose.fingerR.x += -0.28 * THREE.MathUtils.smoothstep(t, 0.42, 0.68);
      // The free arm counterbalances the torso while the right hand reaches down.
      pose.shoulderL.x += -0.3 * crouch;
      pose.shoulderL.z += 0.18 * crouch;
      pose.elbowL.x += -0.2 * crouch;
      return clampPose(pose);
    }
    if (this.jointCommand) {
      const pose = clonePose(GUARD);
      const t = Math.max(0, Math.min(1, this.jointCommand.time / this.jointCommand.duration));
      const envelope = t < 0.42 ? t / 0.42 : Math.max(0, (1 - t) / 0.58);
      const eased = envelope * envelope * (3 - 2 * envelope);
      for (const [name, values] of Object.entries(this.jointCommand.targets)) {
        if (!pose[name]) continue;
        for (const axis of ["x", "y", "z"]) {
          if (values[axis] !== undefined) pose[name][axis] += (values[axis] - pose[name][axis]) * eased;
        }
      }
      return clampPose(pose);
    }
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

    if (pickup.phase === "search" && distance < 0.56) {
      pickup.phase = "reach";
      pickup.time = 0;
      this.setLocomotion(0, 0);
      this.velocity.x *= 0.12;
      this.velocity.z *= 0.12;
    }
    if (pickup.phase !== "reach") return;

    pickup.time += dt;
    // Once the hand is fully extended, keep it there until pickup succeeds.
    const t = Math.min(0.72, pickup.time / 1.35);
    const shoulder = this.skeleton.joints.shoulderR;
    const elbow = this.skeleton.joints.elbowR;
    const wrist = this.skeleton.joints.wristR;
    const fingers = this.skeleton.joints.fingerR;

    // Keep the weapon visibly on the floor throughout the reach. The hand
    // moves down first; only a real hand-to-item contact can attach it.
    if (shoulder) {
      shoulder.rotation.x = THREE.MathUtils.lerp(shoulder.rotation.x, -2.35, Math.min(1, dt * 9));
      shoulder.rotation.z = THREE.MathUtils.lerp(shoulder.rotation.z, -0.08, Math.min(1, dt * 9));
    }
    if (elbow) elbow.rotation.x = THREE.MathUtils.lerp(elbow.rotation.x, -0.12, Math.min(1, dt * 9));
    if (wrist) wrist.rotation.x = THREE.MathUtils.lerp(wrist.rotation.x, -0.12, Math.min(1, dt * 9));
    if (fingers) fingers.rotation.x = THREE.MathUtils.lerp(fingers.rotation.x, -0.12, Math.min(1, dt * 9));
    // Fingers curl progressively instead of snapping shut. The grip starts
    // closing as the palm approaches the handle, then tightens at contact.
    const gripProgress = THREE.MathUtils.smoothstep(t, 0.34, 0.78);
    this.skeleton.setHandGrip("R", true, gripProgress);

    this.root.updateMatrixWorld(true);
    const palm = this.skeleton.joints.fingerR || wrist;
    const handWorld = palm ? palm.getWorldPosition(_sole) : null;
    const itemWorld = pickup.item.mesh?.getWorldPosition(new THREE.Vector3());
    const contactDistance = handWorld && itemWorld ? handWorld.distanceTo(itemWorld) : Infinity;
    // The weapon's model origin is its handle/grip reference. A small tolerance
    // accounts for the palm volume and different handle lengths, not the blade.
    const contactTolerance = pickup.item.type === "spear" || pickup.item.type === "warhammer" ? 0.48 : 0.44;

    // Do not teleport the item to the hand at the end of a timer. Wait until
    // the palm reaches the handle zone and the fingers have started to close.
    if (contactDistance > contactTolerance) {
      // Make small, continuous stance corrections while keeping the hand down.
      // The timer deliberately does not reset, preventing an infinite crouch/stand loop.
      if (pickup.time > 1.1) {
        this.root.position.x += dx * Math.min(0.012, Math.abs(dx) * 0.035);
        this.root.position.z += dz * Math.min(0.012, Math.abs(dz) * 0.035);
      }
      return;
    }

    // Contact reached: close the fingers around the handle, then attach it.
    if (t < 0.68 || gripProgress < 0.8) return;
    const wristJoint = this.skeleton.joints.wristR;
    this.root.updateMatrixWorld(true);
    let equipped = false;
    try {
      equipped = this.skeleton.gripWeapon(wristJoint, pickup.item);
    } catch (error) {
      console.error("Falha ao equipar arma; a luta continuará sem equipá-la.", error);
      if (pickup.item) pickup.item.available = true;
    }
    this.hasWeapon = equipped;
    pickup.phase = equipped ? "done" : "search";
    if (!equipped) {
      pickup.item = null;
      pickup.target = null;
      this.skeleton.setHandGrip("R", false);
    }
    this.throttle = 0;
    this.strafe = 0;
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
    // Only lift the root when a foot penetrates the floor. Do not force the
    // lowest foot onto the floor every frame: during kicks/jumps both feet may
    // be raised, and correcting that as a planted stance makes the whole fighter
    // float upward.
    this.root.position.y = Math.max(0, this.root.position.y - lowest + 0.02);
    this.standY = this.root.position.y;
  }

  _fall() {
    const k = Math.min(1, this.koTime / 0.75);
    const ease = k * k * (3 - 2 * k);
    this.root.rotation.x = ease * 1.25;
    this.root.position.y = this.standY * (1 - ease) + 0.2 * ease;
  }
}
