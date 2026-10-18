import * as THREE from "three";
import { attachToes } from "./toes.js";
import { attachCharacterSkin } from "./skins.js";

const LENGTH = {
  upperArm: 0.3,
  forearm: 0.27,
  thigh: 0.42,
  shin: 0.4,
};

const PELVIS_Y = 0.96;

export class Skeleton {
  constructor(color, weapon = "sword") {
    this.joints = {};
    this.anchors = {};
    this.accents = {};
    this.limbRoots = {};
    this.weaponType = weapon;
    this.fingerDigits = { L: [], R: [] };
    this.handGrip = { L: 0, R: 0 };
    this.gripStrength = 1;
    this.weaponOnGround = true;
    this.root = new THREE.Group();
    this.skin = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.46,
      metalness: 0.08,
    });
    this.jointMaterial = new THREE.MeshStandardMaterial({
      color: 0x12151c,
      roughness: 0.55,
      metalness: 0.25,
    });
    this._build(color);
  }

  _joint(parent, name, x, y, z) {
    const group = new THREE.Group();
    group.name = name;
    group.position.set(x, y, z);
    parent.add(group);
    this.joints[name] = group;
    return group;
  }

  _sphere(parent, radius, material, y = 0) {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 12, 10), material);
    mesh.position.y = y;
    mesh.castShadow = true;
    parent.add(mesh);
    return mesh;
  }

  _bone(parent, length, radius, material) {
    const shaft = Math.max(0.02, length - radius * 2);
    const mesh = new THREE.Mesh(
      new THREE.CapsuleGeometry(radius, shaft, 4, 8),
      material,
    );
    mesh.position.y = -length * 0.5;
    mesh.castShadow = true;
    parent.add(mesh);
    return mesh;
  }

  _upBone(parent, length, radius, material) {
    const shaft = Math.max(0.02, length - radius * 2);
    const mesh = new THREE.Mesh(
      new THREE.CapsuleGeometry(radius, shaft, 4, 8),
      material,
    );
    mesh.position.y = length * 0.5;
    mesh.castShadow = true;
    parent.add(mesh);
    return mesh;
  }

  _digit(parent, x, y, z, length, radius, restX = 0, fan = 0) {
    const root = new THREE.Group();
    root.position.set(x, y, z);
    root.rotation.set(restX, 0, fan);
    parent.add(root);
    this._sphere(root, radius * 1.25, this.jointMaterial);
    this._bone(root, length, radius, this.skin);

    const middle = new THREE.Group();
    middle.position.y = -length;
    middle.rotation.x = -0.55;
    root.add(middle);
    root.userData.middle = middle;
    this._sphere(middle, radius * 1.05, this.jointMaterial);
    this._bone(middle, length * 0.72, radius * 0.82, this.skin);
    return root;
  }

  _fingers(wrist, side, palmMaterial) {
    const sign = side === "L" ? -1 : 1;
    const hand = this._joint(wrist, `finger${side}`, 0, -0.015, 0.02);
    const palm = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.05, 0.075), palmMaterial);
    palm.position.set(0, -0.035, 0.01);
    palm.castShadow = true;
    hand.add(palm);

    const spread = [-0.036, -0.012, 0.012, 0.036];
    spread.forEach((offset, index) => {
      const digit = this._digit(hand, offset, -0.06, 0.02, 0.062, 0.014, 0, offset * -1.4 + (index - 1.5) * 0.02);
      this.fingerDigits[side].push(digit);
    });
    const thumb = this._digit(hand, sign * 0.055, -0.02, -0.015, 0.05, 0.015, -0.8, sign * 0.55);
    this.fingerDigits[side].push(thumb);
  }

  _weapon(wrist, type) {
    const weapon = new THREE.Group();
    weapon.name = `medieval-${type}`;
    weapon.position.set(0, -0.025, 0.035);
    weapon.rotation.x = -0.12;
    wrist.add(weapon);

    const steel = new THREE.MeshStandardMaterial({
      color: type === "sword" ? 0xd8e2ee : 0x9aa8b7,
      metalness: 0.88,
      roughness: 0.24,
    });
    const darkSteel = new THREE.MeshStandardMaterial({ color: 0x3c4653, metalness: 0.72, roughness: 0.3 });
    const grip = new THREE.MeshStandardMaterial({ color: 0x65442c, roughness: 0.86 });
    const gold = new THREE.MeshStandardMaterial({ color: 0xb88b45, metalness: 0.72, roughness: 0.3 });

    const add = (geometry, material, x, y, z, rotationZ = 0) => {
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(x, y, z);
      mesh.rotation.z = rotationZ;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      weapon.add(mesh);
      return mesh;
    };

    if (type === "sword") {
      add(new THREE.CylinderGeometry(0.018, 0.028, 0.48, 6), steel, 0, -0.39, 0);
      add(new THREE.BoxGeometry(0.19, 0.035, 0.055), gold, 0, -0.105, 0);
      add(new THREE.CylinderGeometry(0.018, 0.018, 0.19, 8), grip, 0, -0.025, 0);
      add(new THREE.SphereGeometry(0.035, 8, 6), gold, 0, 0.09, 0);
      add(new THREE.ConeGeometry(0.027, 0.11, 6), steel, 0, -0.685, 0);
      this.weaponReach = 0.66;
      this.weaponDamage = 1.18;
    } else if (type === "mace") {
      add(new THREE.CylinderGeometry(0.018, 0.024, 0.38, 8), grip, 0, -0.23, 0);
      add(new THREE.CylinderGeometry(0.055, 0.07, 0.16, 8), darkSteel, 0, -0.49, 0);
      for (let i = 0; i < 6; i += 1) {
        const angle = (i / 6) * Math.PI * 2;
        add(new THREE.ConeGeometry(0.025, 0.09, 5), steel,
          Math.cos(angle) * 0.065, -0.49, Math.sin(angle) * 0.065,
          -angle);
      }
      add(new THREE.SphereGeometry(0.045, 8, 6), gold, 0, -0.59, 0);
      this.weaponReach = 0.58;
      this.weaponDamage = 1.32;
    } else {
      add(new THREE.CylinderGeometry(0.018, 0.023, 0.4, 8), grip, 0, -0.24, 0);
      add(new THREE.BoxGeometry(0.23, 0.16, 0.055), steel, -0.09, -0.48, 0, -0.28);
      add(new THREE.ConeGeometry(0.04, 0.16, 5), steel, 0.07, -0.49, 0, Math.PI);
      add(new THREE.SphereGeometry(0.035, 8, 6), gold, 0, -0.46, 0);
      this.weaponReach = 0.6;
      this.weaponDamage = 1.26;
    }

    const tip = new THREE.Group();
    tip.name = "weaponTip";
    tip.position.set(type === "axe" ? -0.1 : 0, type === "sword" ? -0.74 : -0.62, 0);
    weapon.add(tip);
    // Keep the same metadata contract for starting weapons and ground weapons.
    weapon.userData.tip = tip;
    weapon.userData.weaponType = type;
    weapon.userData.stats = {
      name: type,
      reach: this.weaponReach,
      damage: this.weaponDamage,
    };
    this.anchors.weaponTip = tip;
    this.weapon = weapon;
    this.weaponType = type;
    this.weaponGrip = grip;
  }

  _arm(chest, side, color) {
    const sign = side === "L" ? -1 : 1;
    const clavicle = this._joint(chest, `clavicle${side}`, sign * 0.08, 0.15, 0);
    this._sphere(clavicle, 0.042, this.jointMaterial);

    const shoulder = this._joint(clavicle, `shoulder${side}`, sign * 0.14, -0.02, 0);
    this.limbRoots[side === "L" ? "armL" : "armR"] = shoulder;
    this._sphere(shoulder, 0.05, this.jointMaterial);
    this._bone(shoulder, LENGTH.upperArm, 0.052, this.skin);

    const elbowMat = this.jointMaterial.clone();
    elbowMat.emissive = new THREE.Color(color);
    elbowMat.emissiveIntensity = 0.04;
    const elbow = this._joint(shoulder, `elbow${side}`, 0, -LENGTH.upperArm, 0);
    this._sphere(elbow, 0.05, elbowMat);
    this.accents[`elbow${side}`] = elbowMat;
    this.anchors[`elbow${side}`] = elbow;
    this._bone(elbow, LENGTH.forearm * 0.5, 0.044, this.skin);
    const forearm = this._joint(elbow, `forearm${side}`, 0, -LENGTH.forearm * 0.5, 0);
    this._sphere(forearm, 0.036, this.jointMaterial);
    this._bone(forearm, LENGTH.forearm * 0.5, 0.038, this.skin);

    const wrist = this._joint(forearm, `wrist${side}`, 0, -LENGTH.forearm * 0.5, 0);
    this._sphere(wrist, 0.032, this.jointMaterial);
    const palmMaterial = this.skin.clone();
    palmMaterial.emissive = new THREE.Color(color);
    palmMaterial.emissiveIntensity = 0.05;
    this.accents[`hand${side}`] = palmMaterial;
    this.anchors[`hand${side}`] = wrist;
    this._fingers(wrist, side, palmMaterial);
    if (side === "R") this._weapon(wrist, this.weaponType);
  }

  _leg(pelvis, side, color) {
    const sign = side === "L" ? -1 : 1;
    const hip = this._joint(pelvis, `hip${side}`, sign * 0.11, -0.06, 0);
    this.limbRoots[side === "L" ? "legL" : "legR"] = hip;
    this._sphere(hip, 0.065, this.jointMaterial);
    this._bone(hip, LENGTH.thigh, 0.075, this.skin);

    const kneeMat = this.jointMaterial.clone();
    kneeMat.emissive = new THREE.Color(color);
    kneeMat.emissiveIntensity = 0.04;
    const knee = this._joint(hip, `knee${side}`, 0, -LENGTH.thigh, 0);
    this._sphere(knee, 0.055, kneeMat);
    this.accents[`knee${side}`] = kneeMat;
    this.anchors[`knee${side}`] = knee;
    this._bone(knee, LENGTH.shin, 0.055, this.skin);

    const ankle = this._joint(knee, `ankle${side}`, 0, -LENGTH.shin, 0);
    this._sphere(ankle, 0.045, this.jointMaterial);
    const accent = this.skin.clone();
    accent.emissive = new THREE.Color(color);
    accent.emissiveIntensity = 0.05;
    const heel = new THREE.Mesh(new THREE.BoxGeometry(0.098, 0.05, 0.085), accent);
    heel.position.set(0, -0.02, -0.01);
    heel.castShadow = true;
    ankle.add(heel);
    this.accents[`foot${side}`] = accent;
    attachToes(this, ankle, side);

    const sole = new THREE.Group();
    sole.position.set(0, -0.048, 0.0);
    ankle.add(sole);
    this.anchors[`foot${side}`] = sole;
  }

  _build(color) {
    const pelvis = this._joint(this.root, "pelvis", 0, PELVIS_Y, 0);
    const hips = new THREE.Mesh(new THREE.SphereGeometry(0.14, 16, 12), this.skin);
    hips.scale.set(1.25, 0.72, 0.95);
    hips.castShadow = true;
    pelvis.add(hips);
    this.anchors.pelvis = pelvis;

    const waist = this._joint(pelvis, "waist", 0, 0.05, 0);
    this._sphere(waist, 0.072, this.jointMaterial);
    this._upBone(waist, 0.08, 0.09, this.skin);

    const lumbar = this._joint(waist, "lumbar", 0, 0.08, 0);
    this._sphere(lumbar, 0.06, this.jointMaterial);
    this._upBone(lumbar, 0.08, 0.078, this.skin);

    const spine = this._joint(lumbar, "spine", 0, 0.08, 0);
    this._sphere(spine, 0.052, this.jointMaterial);
    this._upBone(spine, 0.09, 0.07, this.skin);

    const ribs = this._joint(spine, "ribs", 0, 0.09, 0);
    this._sphere(ribs, 0.058, this.jointMaterial);
    this._upBone(ribs, 0.08, 0.086, this.skin);

    const chest = this._joint(ribs, "chest", 0, 0.08, 0);
    this._upBone(chest, 0.16, 0.11, this.skin);
    this.anchors.chest = chest;

    this._arm(chest, "L", color);
    this._arm(chest, "R", color);

    const neck = this._joint(chest, "neck", 0, 0.16, 0);
    this._sphere(neck, 0.042, this.jointMaterial);
    this._upBone(neck, 0.07, 0.04, this.skin);

    const nape = this._joint(neck, "nape", 0, 0.07, 0);
    this._sphere(nape, 0.036, this.jointMaterial);
    this._upBone(nape, 0.05, 0.034, this.skin);

    const headJoint = this._joint(nape, "head", 0, 0.12, 0);
    this._sphere(headJoint, 0.135, this.skin);
    const visor = new THREE.Mesh(
      new THREE.BoxGeometry(0.14, 0.045, 0.05),
      this.jointMaterial,
    );
    visor.position.set(0, 0.02, 0.12);
    headJoint.add(visor);
    this.anchors.head = headJoint;
    this._jaw(headJoint);

    this._leg(pelvis, "L", color);
    this._leg(pelvis, "R", color);
    attachCharacterSkin(this, chest, pelvis, headJoint, color, this.weaponType);
    this._status(headJoint);
  }

  _jaw(head) {
    const jaw = this._joint(head, "jaw", 0, -0.045, 0.02);
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.04, 0.07), this.skin);
    mesh.position.set(0, -0.02, 0.05);
    mesh.castShadow = true;
    jaw.add(mesh);
  }

  _status(head) {
    this.barCanvas = document.createElement("canvas");
    this.barCanvas.width = 256;
    this.barCanvas.height = 48;
    this.barTexture = new THREE.CanvasTexture(this.barCanvas);
    this.barTexture.colorSpace = THREE.SRGBColorSpace;
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: this.barTexture, transparent: true }),
    );
    sprite.position.set(0, 0.46, 0);
    sprite.scale.set(0.48, 0.09, 1);
    sprite.renderOrder = 2;
    head.add(sprite);
    this.setHealth(1);
  }

  setHealth(ratio) {
    const context = this.barCanvas.getContext("2d");
    context.clearRect(0, 0, 256, 48);
    context.fillStyle = "rgba(10, 12, 18, 0.92)";
    context.fillRect(0, 6, 256, 36);
    const health = Math.max(0, Math.min(1, ratio));
    const color = health > 0.5 ? "#3ee07a" : health > 0.25 ? "#e2b341" : "#e23b32";
    context.fillStyle = color;
    context.fillRect(6, 12, Math.max(0, 244 * health), 24);
    this.barTexture.needsUpdate = true;
  }


  dropWeapon(scene, worldPosition, facing = 0) {
    if (!this.weapon || !scene) return;
    this.root.updateMatrixWorld(true);
    this.weapon.removeFromParent();
    scene.add(this.weapon);
    this.weapon.position.copy(worldPosition);
    this.weapon.rotation.set(Math.PI / 2, facing, 0);
    this.weaponOnGround = true;
    this.anchors.weaponTip.visible = true;
  }

  gripWeapon(wrist, item) {
    if (!wrist || !item?.mesh || !item.available || !item.mesh.isObject3D) return false;
    const weapon = item.mesh;
    const type = item.type || weapon.userData.weaponType || "sword";
    const stats = weapon.userData.stats || {};
    const tip = weapon.userData.tip || weapon.getObjectByName("weaponTip") || null;

    // Attach only after all required references have been validated.
    if (this.weapon && this.weapon !== weapon) this.weapon.removeFromParent();
    weapon.removeFromParent();
    wrist.add(weapon);
    // Keep the handle inside the palm rather than floating above the fingers.
    weapon.position.set(0, -0.045, 0.025);
    weapon.rotation.set(0, 0, 0);
    this.weapon = weapon;
    this.weaponType = type;
    this.weaponReach = Number.isFinite(stats.reach) ? stats.reach : 0.6;
    this.weaponDamage = Number.isFinite(stats.damage) ? stats.damage : 1;
    this.anchors.weaponTip = tip;
    // Clear stale ground movement before the weapon becomes attached to the hand.
    delete weapon.userData.droppedVelocity;
    this.weaponOnGround = false;
    this.gripStrength = 0.72 + Math.random() * 0.28;
    item.available = false;
    this.setHandGrip("R", true);
    return true;
  }

  releaseWeapon(scene, facing = 0, velocity = null) {
    if (!this.weapon || !scene || this.weaponOnGround) return null;
    this.root.updateMatrixWorld(true);
    const worldPosition = this.weapon.getWorldPosition(new THREE.Vector3());
    const weapon = this.weapon;
    weapon.removeFromParent();
    scene.add(weapon);
    weapon.position.set(worldPosition.x, 0.085, worldPosition.z);
    weapon.rotation.set(Math.PI / 2, facing + (Math.random() - 0.5) * 0.7, (Math.random() - 0.5) * 0.25);
    weapon.userData.droppedVelocity = new THREE.Vector3((velocity?.x || 0) * 0.35 + (Math.random() - 0.5) * 1.4, 0, (velocity?.z || 0) * 0.35 + (Math.random() - 0.5) * 1.4);
    this.weaponOnGround = true;
    this.anchors.weaponTip = null;
    this.setHandGrip('R', false);
    return { mesh: weapon, type: this.weaponType, position: new THREE.Vector3(worldPosition.x, 0, worldPosition.z) };
  }

  setHandGrip(side, closed, amount = closed ? 1 : 0) {
    // Accept a continuous amount so fingers can wrap around a handle naturally.
    const target = THREE.MathUtils.clamp(amount, 0, 1);
    this.handGrip[side] = target;
    for (const [index, digit] of (this.fingerDigits[side] || []).entries()) {
      const thumb = index === 4;
      const openAngle = thumb ? -0.8 : 0;
      const closedAngle = thumb ? -1.12 : -0.98;
      digit.rotation.x = THREE.MathUtils.lerp(openAngle, closedAngle, target);
      if (digit.userData.middle) {
        digit.userData.middle.rotation.x = THREE.MathUtils.lerp(-0.55, -1.28, target);
      }
      // The thumb rotates inward across the palm, opposing the fingers around
      // the grip instead of curling in the same plane as every other digit.
      if (thumb) {
        if (digit.userData.openZ === undefined) digit.userData.openZ = digit.rotation.z;
        digit.rotation.z = THREE.MathUtils.lerp(digit.userData.openZ, -0.42, target);
      }
    }
    const hand = this.joints['finger' + side];
    if (hand) hand.rotation.x = THREE.MathUtils.lerp(0, -0.12, target);
  }

  anchorWorld(name, target) {
    this.anchors[name].getWorldPosition(target);
    return target;
  }

  hideLimb(id) {
    const root = this.limbRoots[id];
    if (root) root.visible = false;
  }

  showLimbs() {
    for (const root of Object.values(this.limbRoots)) root.visible = true;
  }
}
