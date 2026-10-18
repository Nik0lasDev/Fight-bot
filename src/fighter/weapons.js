import * as THREE from "three";

const steel = () => new THREE.MeshStandardMaterial({ color: 0xc7d3df, metalness: 0.86, roughness: 0.25 });
const dark = () => new THREE.MeshStandardMaterial({ color: 0x39424d, metalness: 0.72, roughness: 0.3 });
const wood = () => new THREE.MeshStandardMaterial({ color: 0x69452c, roughness: 0.82 });
const gold = () => new THREE.MeshStandardMaterial({ color: 0xd0a04e, metalness: 0.75, roughness: 0.24 });

function piece(group, geometry, material, position, rotation = [0, 0, 0]) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(...position);
  mesh.rotation.set(...rotation);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  return mesh;
}

export const WEAPON_STATS = {
  sword: { name: "Espada", reach: 0.66, damage: 1.18 },
  mace: { name: "Clava", reach: 0.58, damage: 1.32 },
  axe: { name: "Machado", reach: 0.6, damage: 1.26 },
  spear: { name: "Lança", reach: 0.94, damage: 1.12 },
  dagger: { name: "Adaga", reach: 0.43, damage: 0.92 },
  warhammer: { name: "Martelo de guerra", reach: 0.62, damage: 1.42 },
  doubleaxe: { name: "Machado duplo", reach: 0.68, damage: 1.36 },
};

export function createWeaponModel(type) {
  const root = new THREE.Group();
  root.name = `ground-weapon-${type}`;
  root.userData.weaponType = type;
  const s = steel(), d = dark(), w = wood(), g = gold();
  const shaft = (length) => piece(root, new THREE.CylinderGeometry(0.018, 0.023, length, 8), w, [0, 0, 0]);
  let tipY = -0.65;
  if (type === "sword") {
    piece(root, new THREE.BoxGeometry(0.055, 0.48, 0.026), s, [0, -0.35, 0]);
    piece(root, new THREE.ConeGeometry(0.03, 0.12, 6), s, [0, -0.65, 0]);
    piece(root, new THREE.BoxGeometry(0.2, 0.035, 0.045), g, [0, -0.06, 0]);
    piece(root, new THREE.CylinderGeometry(0.018, 0.018, 0.18, 8), w, [0, 0.04, 0]);
    piece(root, new THREE.SphereGeometry(0.03, 8, 6), g, [0, 0.15, 0]);
  } else if (type === "mace") {
    shaft(0.48);
    piece(root, new THREE.SphereGeometry(0.09, 10, 8), d, [0, -0.27, 0]);
    for (let i = 0; i < 6; i++) {
      const a = i * Math.PI / 3;
      piece(root, new THREE.ConeGeometry(0.025, 0.09, 5), s, [Math.cos(a)*0.075, -0.27, Math.sin(a)*0.075], [0, 0, -a]);
    }
    tipY = -0.42;
  } else if (type === "axe") {
    shaft(0.58);
    piece(root, new THREE.BoxGeometry(0.22, 0.2, 0.055), s, [-0.09, -0.22, 0], [0, 0, -0.18]);
    piece(root, new THREE.ConeGeometry(0.04, 0.13, 5), s, [0.08, -0.22, 0], [0, 0, Math.PI]);
    tipY = -0.52;
  } else if (type === "spear") {
    piece(root, new THREE.CylinderGeometry(0.012, 0.018, 0.88, 7), w, [0, -0.34, 0]);
    piece(root, new THREE.ConeGeometry(0.045, 0.24, 6), s, [0, -0.9, 0]);
    piece(root, new THREE.TorusGeometry(0.025, 0.008, 5, 10), g, [0, -0.77, 0], [Math.PI/2, 0, 0]);
    tipY = -1.03;
  } else if (type === "dagger") {
    piece(root, new THREE.BoxGeometry(0.045, 0.28, 0.022), s, [0, -0.2, 0]);
    piece(root, new THREE.ConeGeometry(0.025, 0.09, 5), s, [0, -0.385, 0]);
    piece(root, new THREE.BoxGeometry(0.13, 0.025, 0.035), g, [0, -0.02, 0]);
    piece(root, new THREE.CylinderGeometry(0.016, 0.016, 0.12, 7), w, [0, 0.055, 0]);
    tipY = -0.43;
  } else if (type === "warhammer") {
    shaft(0.56);
    piece(root, new THREE.BoxGeometry(0.24, 0.16, 0.12), d, [0, -0.27, 0]);
    piece(root, new THREE.BoxGeometry(0.09, 0.19, 0.14), s, [-0.13, -0.27, 0]);
    piece(root, new THREE.ConeGeometry(0.04, 0.14, 5), s, [0.15, -0.27, 0], [0, 0, -Math.PI/2]);
    piece(root, new THREE.SphereGeometry(0.025, 8, 6), g, [0, 0.05, 0]);
    tipY = -0.48;
  } else {
    shaft(0.62);
    piece(root, new THREE.BoxGeometry(0.2, 0.2, 0.055), s, [-0.1, -0.25, 0], [0, 0, -0.2]);
    piece(root, new THREE.BoxGeometry(0.2, 0.2, 0.055), s, [0.1, -0.25, 0], [0, 0, 0.2]);
    piece(root, new THREE.SphereGeometry(0.03, 8, 6), g, [0, 0.1, 0]);
    tipY = -0.58;
  }
  const tip = new THREE.Group();
  tip.name = "weaponTip";
  tip.position.set(type === "axe" || type === "doubleaxe" ? -0.1 : 0, tipY, 0);
  root.add(tip);
  root.userData.tip = tip;
  root.userData.stats = WEAPON_STATS[type] || WEAPON_STATS.sword;
  return root;
}

export function createGroundWeapon(scene, type, x, z, rotation = 0) {
  const model = createWeaponModel(type);
  model.position.set(x, 0.055, z);
  model.rotation.set(Math.PI / 2, rotation, 0);
  model.userData.groundRotation = rotation;
  scene.add(model);
  return { type, name: WEAPON_STATS[type].name, mesh: model, position: new THREE.Vector3(x, 0, z), available: true };
}
