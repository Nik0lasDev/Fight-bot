import { distanceXZ } from "../math.js";
import { MOVES } from "./moves.js";
import { chooseAction, situationKey } from "./brain.js";

export class Bot {
  constructor(fighter, profile) {
    this.fighter = fighter;
    this.profile = profile;
    fighter.style = profile.weights;
    this.blockTimer = 0;
    this.attackCooldown = 0;
    this.label = "lendo o combate";
    this.followUp = null;
    this.followTime = 0;
    this.justMissed = false;
    this.repositionTime = 0;
    this.lastId = null;
    this.seenSerial = 0;
    this.lastKey = "";
    this.plan = { type: "go", throttle: 0, strafe: 0, label: "lendo o combate" };
  }

  update(dt, opponent) {
    const fighter = this.fighter;
    this.blockTimer = Math.max(0, this.blockTimer - dt);
    this.attackCooldown = Math.max(0, this.attackCooldown - dt);
    if (this.followTime > 0) {
      this.followTime -= dt;
      if (this.followTime <= 0) this.followUp = null;
    }
    if (this.repositionTime > 0) {
      this.repositionTime -= dt;
      if (this.repositionTime <= 0) {
        this.justMissed = false;
        this.lastKey = "";
      }
    }
    this._readFinish(fighter);

    if (fighter.ko) return this._hold("nocaute");
    if (opponent.ko) return this._hold("vitória");
    if (fighter.stun > 0) return this._hold("atordoado");
    if (!fighter.hasWeapon) {
      const target = fighter.weaponPickup.target;
      if (target && fighter.weaponPickup.item?.available) {
        const dx = target.x - fighter.root.position.x;
        const dz = target.z - fighter.root.position.z;
        const distanceToWeapon = Math.hypot(dx, dz);
        if (distanceToWeapon > 0.48) {
          fighter.blocking = false;
          fighter.root.rotation.y = Math.atan2(dx, dz);
          fighter.setLocomotion(0.72, 0);
          this.label = `buscando ${fighter.weaponPickup.item.name}`;
        } else {
          fighter.setLocomotion(0, 0);
          this.label = `pegando ${fighter.weaponPickup.item.name}`;
        }
        return;
      }
    }
    if (fighter.jointCommand) {
      this.label = "controlando articulações";
      fighter.blocking = false;
      fighter.setLocomotion(0, 0);
      return;
    }
    if (fighter.move) {
      this.label = this.plan.label || fighter.move.name;
      fighter.blocking = false;
      fighter.setLocomotion(0, 0);
      return;
    }

    if (this.attackCooldown > 0) {
      this.label = "recuperando após o golpe";
      fighter.blocking = false;
      fighter.setLocomotion(0, 0);
      return;
    }

    if (this.blockTimer > 0) {
      this.label = this.plan.label;
      fighter.blocking = true;
      fighter.setLocomotion(this.plan.throttle || 0, this.plan.strafe || 0);
      return;
    }
    if (fighter.blocking) {
      fighter.blocking = false;
      this.lastKey = "";
    }

    const distance = distanceXZ(fighter.root.position, opponent.root.position);
    const key = situationKey(fighter, opponent, distance);
    if (key !== this.lastKey) {
      this.lastKey = key;
      this._commit(fighter, opponent, distance);
    }

    if (this.plan.type === "go") {
      this.label = this.plan.label;
      fighter.blocking = false;
      fighter.setLocomotion(this.plan.throttle, this.plan.strafe);
    }
  }

  reset() {
    this.blockTimer = 0;
    this.attackCooldown = 0;
    this.followUp = null;
    this.followTime = 0;
    this.justMissed = false;
    this.repositionTime = 0;
    this.lastId = null;
    this.lastKey = "";
    this.seenSerial = this.fighter.recentSerial;
    this.label = "lendo o combate";
    this.plan = { type: "go", throttle: 0, strafe: 0, label: "lendo o combate" };
    this.fighter.setLocomotion(0, 0);
  }

  _hold(label) {
    this.label = label;
    this.fighter.blocking = false;
    this.fighter.setLocomotion(0, 0);
  }

  _readFinish(fighter) {
    if (!fighter.recentSerial || fighter.recentSerial === this.seenSerial) return;
    this.seenSerial = fighter.recentSerial;
    this.lastId = fighter.recentId;
    // Re-evaluate immediately after every completed action, even if the
    // opponent remains in the same distance band.
    this.lastKey = "";
    if (MOVES[fighter.recentId]?.damage > 0) this.attackCooldown = 0.24;
    if (fighter.recentId === "feint") {
      this.followUp = this.profile.combo.feint || null;
      this.followTime = this.followUp ? 0.8 : 0;
      this.justMissed = false;
      return;
    }
    if (fighter.recentContact === "landed") {
      this.followUp = this.profile.combo[fighter.recentId] || null;
      this.followTime = this.followUp ? 0.8 : 0;
      this.justMissed = false;
      return;
    }
    this.followUp = null;
    if (fighter.recentContact === "miss") {
      this.justMissed = true;
      this.repositionTime = 0.48;
      return;
    }
    this.justMissed = false;
  }

  _commit(fighter, opponent, distance) {
    const action = chooseAction(this, fighter, opponent, distance);
    this.plan = action;
    this.label = action.label;
    if (action.type === "joint") {
      if (fighter.startJointMotion(action)) this.attackCooldown = action.duration * 0.28;
      fighter.blocking = false;
      fighter.setLocomotion(0, 0);
      return;
    }
    if (action.type === "block") {
      this.blockTimer = action.hold ?? 0.4;
      fighter.blocking = true;
      fighter.setLocomotion(action.throttle || 0, action.strafe || 0);
      return;
    }
    fighter.blocking = false;
    const move = MOVES[action.id];
    if (action.type === "strike" && move) {
      const weaponNames = { sword: "corte de espada", mace: "golpe de clava", axe: "golpe de machado" };
      const armedLabel = move.limb === "handR" && weaponNames[fighter.skeleton.weaponType]
        ? weaponNames[fighter.skeleton.weaponType]
        : action.label;
      this.plan = { ...action, label: armedLabel };
      this.label = armedLabel;
      if (fighter.tryMove(move)) {
        if (this.followUp === action.id) this.followUp = null;
        return;
      }
    }
    if (action.type === "strike") {
      this.plan = { type: "go", throttle: 0.45, strafe: 0, label: "ajusta a distância" };
      this.label = this.plan.label;
    }
    fighter.setLocomotion(this.plan.throttle, this.plan.strafe);
  }
}

export const PROFILES = {
  nimbus: {
    delay: 0.35,
    attack: 1.2,
    defense: 0.62,
    circle: 0.75,
    show: 0.25,
    noise: 0.22,
    margin: 0.36,
    keepDistance: 1.12,
    weights: { punch: 1.3, kick: 0.55, knee: 0.95, show: 1.05, defend: 0.4 },
    kit: ["jab", "cross", "hook", "uppercut", "elbow", "knee", "shove", "feint", "lowkick"],
    combo: {
      jab: "cross",
      cross: "hook",
      hook: "uppercut",
      uppercut: "knee",
      feint: "cross",
      shove: "knee",
      lowkick: "jab",
    },
  },
  brasa: {
    delay: 0.55,
    attack: 0.92,
    defense: 1.2,
    circle: 1.25,
    show: 0.95,
    noise: 0.24,
    margin: 0.38,
    keepDistance: 1.48,
    weights: { punch: 0.72, kick: 1.35, knee: 1.05, show: 1, defend: 0.5 },
    kit: ["jab", "cross", "hook", "lowkick", "kick", "sweep", "knee", "feint", "taunt"],
    combo: {
      feint: "lowkick",
      lowkick: "kick",
      kick: "knee",
      jab: "kick",
      sweep: "cross",
      cross: "sweep",
    },
  },
};
