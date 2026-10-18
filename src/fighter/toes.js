import * as THREE from "three";

export function attachToes(body, ankle, side) {
  const medial = side === "L" ? 1 : -1;
  const ball = body._joint(ankle, `toe${side}`, 0, -0.012, 0.045);
  [-0.04, -0.016, 0.008, 0.03].forEach((offset, index) => {
    toeDigit(body, ball, medial * offset, 0.062 - index * 0.006, 0.013, -0.05);
  });
  toeDigit(body, ball, medial * 0.05, 0.078, 0.017, 0.02);
  const tip = new THREE.Group();
  tip.position.set(medial * 0.046, -0.015, 0.09);
  ball.add(tip);
  body.anchors[`toeTip${side}`] = tip;
}

function toeDigit(body, parent, x, length, radius, restX) {
  const root = new THREE.Group();
  root.position.set(x, -0.008, 0.01);
  root.rotation.x = restX;
  parent.add(root);
  body._sphere(root, radius * 1.15, body.jointMaterial);
  const mesh = new THREE.Mesh(
    new THREE.CapsuleGeometry(radius, Math.max(0.02, length - radius), 3, 6),
    body.skin,
  );
  mesh.rotation.x = Math.PI / 2;
  mesh.position.z = length * 0.45;
  mesh.castShadow = true;
  root.add(mesh);
  const next = new THREE.Group();
  next.position.z = length * 0.82;
  next.rotation.x = 0.22;
  root.add(next);
  body._sphere(next, radius * 0.9, body.jointMaterial);
  const tip = new THREE.Mesh(
    new THREE.CapsuleGeometry(radius * 0.72, Math.max(0.015, length * 0.42), 3, 6),
    body.skin,
  );
  tip.rotation.x = Math.PI / 2;
  tip.position.z = length * 0.28;
  tip.castShadow = true;
  next.add(tip);
}
