import * as THREE from "three";

const material = (color, metalness = 0.25, roughness = 0.48) =>
  new THREE.MeshStandardMaterial({ color, metalness, roughness });

function addMesh(parent, geometry, mat, position, scale = null, rotation = null) {
  const mesh = new THREE.Mesh(geometry, mat);
  mesh.position.set(...position);
  if (scale) mesh.scale.set(...scale);
  if (rotation) mesh.rotation.set(...rotation);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function addShoulderGuard(skeleton, side, armor, trim, heavy) {
  const shoulder = skeleton.joints[`shoulder${side}`];
  if (!shoulder) return;
  const pad = addMesh(
    shoulder,
    new THREE.SphereGeometry(0.09, 12, 10),
    armor,
    [0, -0.025, 0],
    [1.16, 0.78, 1.05],
  );
  pad.name = `${skeleton.skinName}-shoulder-armor-${side}`;
  addMesh(
    shoulder,
    new THREE.BoxGeometry(0.105, 0.025, 0.11),
    trim,
    [0, -0.075, 0.018],
    [1, 1, 1],
    [0, 0, side === "L" ? -0.18 : 0.18],
  );
  if (heavy) {
    addMesh(shoulder, new THREE.ConeGeometry(0.035, 0.12, 5), trim,
      [side === "L" ? -0.025 : 0.025, 0.04, 0], null,
      [side === "L" ? -0.2 : 0.2, 0, side === "L" ? -0.35 : 0.35]);
  }
}

function addChestEmblem(chest, trim, symbol, skinName) {
  if (symbol === "nimbus") {
    const crescent = addMesh(chest, new THREE.TorusGeometry(0.052, 0.012, 6, 18),
      trim, [0, 0.065, 0.105], [1, 1.15, 0.5]);
    crescent.name = "nimbus-moon-emblem";
    addMesh(chest, new THREE.SphereGeometry(0.018, 8, 6), trim, [0.025, 0.065, 0.112]);
  } else {
    const badge = addMesh(chest, new THREE.OctahedronGeometry(0.055, 0), trim,
      [0, 0.06, 0.11], [1, 1.2, 0.55]);
    badge.name = "brasa-flame-emblem";
  }
}

export function attachCharacterSkin(skeleton, chest, pelvis, head, color, weaponType) {
  const isNimbus = weaponType === "sword";
  skeleton.skinName = isNimbus ? "nimbus-warden" : "brasa-forgeborn";

  const armor = material(isNimbus ? 0x168f91 : 0x702b30, 0.62, 0.31);
  const trim = material(isNimbus ? 0xc8f5f2 : 0xf1a64b, 0.78, 0.25);
  const dark = material(isNimbus ? 0x163b49 : 0x271b22, 0.35, 0.5);
  const cloth = material(isNimbus ? 0x22b8b1 : 0x9e382e, 0.08, 0.78);
  const leather = material(isNimbus ? 0x244c55 : 0x49302b, 0.12, 0.8);

  // Layered chest armor and a distinct waist sash.
  addMesh(chest, new THREE.SphereGeometry(0.125, 12, 10), armor,
    [0, 0.015, 0.045], [1.03, 0.86, 0.62]);
  addMesh(chest, new THREE.BoxGeometry(0.19, 0.035, 0.105), trim,
    [0, -0.045, 0.075], [1, 1, 0.65]);
  addChestEmblem(chest, trim, isNimbus ? "nimbus" : "brasa", skeleton.skinName);

  const belt = addMesh(pelvis, new THREE.BoxGeometry(0.235, 0.055, 0.16),
    leather, [0, -0.015, 0.015]);
  belt.name = `${skeleton.skinName}-belt`;
  addMesh(pelvis, new THREE.BoxGeometry(0.06, 0.065, 0.025),
    trim, [0, -0.015, 0.101]);

  // Distinct shoulder silhouette; Brasa gets heavier, spiked armor.
  addShoulderGuard(skeleton, "L", armor, trim, !isNimbus);
  addShoulderGuard(skeleton, "R", armor, trim, !isNimbus);

  // Helmet details are attached to the animated head joint.
  if (isNimbus) {
    addMesh(head, new THREE.SphereGeometry(0.142, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.58),
      armor, [0, 0.018, 0], [1.02, 1, 1]);
    addMesh(head, new THREE.BoxGeometry(0.19, 0.025, 0.045),
      trim, [0, 0.065, 0.025], [1, 1, 1], [0, 0, 0]);
    // A swept-back plume gives Nimbus a light, agile knight silhouette.
    addMesh(head, new THREE.ConeGeometry(0.045, 0.22, 6), cloth,
      [0, 0.15, -0.025], [0.72, 1, 0.7], [0.28, 0, 0]);
  } else {
    addMesh(head, new THREE.SphereGeometry(0.145, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.55),
      dark, [0, 0.018, 0], [1.08, 1.03, 1]);
    // Forged brow, cheek plates and horn-like ridges make Brasa bulkier.
    addMesh(head, new THREE.BoxGeometry(0.2, 0.045, 0.07),
      trim, [0, 0.035, 0.095], [1, 1, 1], [0, 0, 0]);
    addMesh(head, new THREE.BoxGeometry(0.055, 0.095, 0.055),
      armor, [-0.09, -0.045, 0.075], [1, 1, 1], [0, 0, -0.25]);
    addMesh(head, new THREE.BoxGeometry(0.055, 0.095, 0.055),
      armor, [0.09, -0.045, 0.075], [1, 1, 1], [0, 0, 0.25]);
    for (const side of [-1, 1]) {
      addMesh(head, new THREE.ConeGeometry(0.035, 0.13, 5),
        trim, [side * 0.105, 0.105, -0.005], [1, 1, 0.8],
        [0, 0, side * -0.38]);
    }
  }

  // Cloth tabard/cape sits behind the torso and moves with the upper body.
  const capeShape = new THREE.Shape();
  capeShape.moveTo(-0.105, 0.12);
  capeShape.lineTo(0.105, 0.12);
  capeShape.lineTo(0.17, -0.32);
  capeShape.lineTo(0.07, -0.39);
  capeShape.lineTo(-0.16, -0.32);
  capeShape.closePath();
  const cape = new THREE.Mesh(new THREE.ShapeGeometry(capeShape), cloth);
  cape.position.set(0, -0.045, -0.095);
  cape.castShadow = true;
  cape.name = `${skeleton.skinName}-cape`;
  chest.add(cape);

  // Small bracers distinguish the arms without replacing the articulated limbs.
  for (const side of ["L", "R"]) {
    const forearm = skeleton.joints[`forearm${side}`];
    if (!forearm) continue;
    addMesh(forearm, new THREE.CylinderGeometry(0.044, 0.048, 0.07, 8),
      trim, [0, -0.045, 0], [1, 1, 1], [0, 0, 0]);
  }

  skeleton.skinVariantColor = color;
}
