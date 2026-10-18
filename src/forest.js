import * as THREE from "three";

export const PLAY_RADIUS = 32;
export const ROAM_RADIUS = 24;

const CLEARING = 8;

function makeRandom(seed) {
  let state = seed;
  return () => {
    state = (state * 16807) % 2147483647;
    return (state - 1) / 2147483646;
  };
}

function groundTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 1024;
  const context = canvas.getContext("2d");
  context.fillStyle = "#2d4630";
  context.fillRect(0, 0, 1024, 1024);
  const rand = makeRandom(19);
  for (let i = 0; i < 280; i += 1) {
    const x = rand() * 1024;
    const y = rand() * 1024;
    const radius = 8 + rand() * 36;
    context.fillStyle = rand() > 0.5 ? "#3c5a38" : "#243828";
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fill();
  }
  const clearing = (CLEARING / 42) * 512;
  const gradient = context.createRadialGradient(512, 512, clearing * 0.2, 512, 512, clearing);
  gradient.addColorStop(0, "rgba(116, 98, 62, 0.55)");
  gradient.addColorStop(1, "rgba(116, 98, 62, 0)");
  context.fillStyle = gradient;
  context.beginPath();
  context.arc(512, 512, clearing, 0, Math.PI * 2);
  context.fill();
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}

function tooClose(trees, x, z, gap) {
  for (const tree of trees) {
    if (Math.hypot(tree.x - x, tree.z - z) < gap) return true;
  }
  return false;
}

function scatter() {
  const rand = makeRandom(7);
  const trees = [];
  for (let i = 0; i < 52; i += 1) {
    const angle = (i / 52) * Math.PI * 2 + rand() * 0.08;
    const radius = 29.2 + rand() * 1.6;
    trees.push(makeTree(Math.cos(angle) * radius, Math.sin(angle) * radius, rand));
  }
  for (let attempt = 0; attempt < 520 && trees.length < 150; attempt += 1) {
    const angle = rand() * Math.PI * 2;
    const radius = CLEARING + rand() * (26.5 - CLEARING);
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    if (tooClose(trees, x, z, 3.15)) continue;
    trees.push(makeTree(x, z, rand));
  }
  return trees;
}

function makeTree(x, z, rand) {
  const ancient = rand() < 0.14;
  const trunkRadius = (0.32 + rand() * 0.28) * (ancient ? 1.55 : 1);
  return {
    x,
    z,
    radius: trunkRadius,
    trunkHeight: (3.6 + rand() * 3.8) * (ancient ? 1.2 : 1),
    leafRadius: (1.35 + rand() * 1.45) * (ancient ? 1.35 : 1),
    leafHeight: 2.2 + rand() * 2.4,
    lean: rand() * 0.08 - 0.04,
    yaw: rand() * Math.PI * 2,
    trunkColor: new THREE.Color().setHSL(0.07, 0.35, 0.18 + rand() * 0.1),
    leafColor: new THREE.Color().setHSL(0.3 + rand() * 0.06, 0.42, 0.22 + rand() * 0.12),
  };
}

function paintInstances(mesh, trees, place) {
  const dummy = new THREE.Object3D();
  trees.forEach((tree, index) => {
    place(dummy, tree);
    dummy.updateMatrix();
    mesh.setMatrixAt(index, dummy.matrix);
    mesh.setColorAt(index, place.color(tree));
  });
  mesh.instanceMatrix.needsUpdate = true;
  mesh.instanceColor.needsUpdate = true;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
}

export function createForest(scene) {
  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(42, 80),
    new THREE.MeshStandardMaterial({ map: groundTexture(), roughness: 0.96, metalness: 0 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  const trees = scatter();
  const count = trees.length;
  const trunks = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(1, 1.15, 1, 7),
    new THREE.MeshStandardMaterial({ roughness: 0.9, metalness: 0 }),
    count,
  );
  const crowns = new THREE.InstancedMesh(
    new THREE.ConeGeometry(1, 1, 8),
    new THREE.MeshStandardMaterial({ roughness: 0.86, metalness: 0 }),
    count,
  );
  const tops = new THREE.InstancedMesh(
    new THREE.ConeGeometry(1, 1, 7),
    new THREE.MeshStandardMaterial({ roughness: 0.86, metalness: 0 }),
    count,
  );

  paintInstances(trunks, trees, Object.assign((dummy, tree) => {
    dummy.position.set(tree.x, tree.trunkHeight * 0.5, tree.z);
    dummy.rotation.set(tree.lean, tree.yaw, 0);
    dummy.scale.set(tree.radius, tree.trunkHeight, tree.radius);
  }, { color: (tree) => tree.trunkColor }));

  paintInstances(crowns, trees, Object.assign((dummy, tree) => {
    dummy.position.set(tree.x, tree.trunkHeight * 0.72 + tree.leafHeight * 0.35, tree.z);
    dummy.rotation.set(0, tree.yaw, 0);
    dummy.scale.set(tree.leafRadius, tree.leafHeight, tree.leafRadius);
  }, { color: (tree) => tree.leafColor }));

  paintInstances(tops, trees, Object.assign((dummy, tree) => {
    dummy.position.set(tree.x, tree.trunkHeight * 0.72 + tree.leafHeight * 0.85, tree.z);
    dummy.rotation.set(0, tree.yaw * 0.5, 0);
    dummy.scale.set(tree.leafRadius * 0.62, tree.leafHeight * 0.7, tree.leafRadius * 0.62);
  }, { color: (tree) => tree.leafColor }));

  scene.add(trunks, crowns, tops);
  return trees.map((tree) => ({ x: tree.x, z: tree.z, radius: tree.radius }));
}

export function avoidTrees(fighter, trees) {
  if (Math.abs(fighter.throttle) < 0.05 && Math.abs(fighter.strafe) < 0.05) return;
  const yaw = fighter.root.rotation.y;
  const forwardX = Math.sin(yaw);
  const forwardZ = Math.cos(yaw);
  const rightX = Math.cos(yaw);
  const rightZ = -Math.sin(yaw);
  let push = 0;
  let block = 0;
  for (const tree of trees) {
    const dx = tree.x - fighter.root.position.x;
    const dz = tree.z - fighter.root.position.z;
    const distance = Math.hypot(dx, dz);
    const reach = tree.radius + 1.7;
    if (distance > reach || distance < 1e-4) continue;
    const ahead = (dx * forwardX + dz * forwardZ) / distance;
    if (ahead < 0.2) continue;
    const side = dx * rightX + dz * rightZ;
    const weight = (1 - distance / reach) * ahead;
    push -= Math.sign(side || 1) * weight;
    if (distance < tree.radius + 0.95 && ahead > 0.5) block = Math.max(block, weight);
  }
  if (Math.abs(push) < 0.04) return;
  fighter.strafe = Math.max(-1, Math.min(1, fighter.strafe + push * 1.7));
  fighter.throttle *= 1 - block * 0.55;
}

export function resolveTrees(fighter, trees) {
  for (const tree of trees) {
    const dx = fighter.root.position.x - tree.x;
    const dz = fighter.root.position.z - tree.z;
    const distance = Math.hypot(dx, dz) || 0.0001;
    const gap = tree.radius + 0.46;
    if (distance >= gap) continue;
    const nx = dx / distance;
    const nz = dz / distance;
    const overlap = gap - distance;
    fighter.root.position.x += nx * overlap;
    fighter.root.position.z += nz * overlap;
    const closing = fighter.velocity.x * nx + fighter.velocity.z * nz;
    if (closing < 0) {
      fighter.velocity.x -= closing * nx;
      fighter.velocity.z -= closing * nz;
    }
  }
}
