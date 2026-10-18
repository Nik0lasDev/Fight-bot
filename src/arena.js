import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { createForest } from "./forest.js";

export function createArena(canvas) {
  const smallScreen = window.matchMedia("(max-width: 800px)").matches;
  const limitedCores = Number.isFinite(navigator.hardwareConcurrency) && navigator.hardwareConcurrency <= 4;
  const lowPower = smallScreen || limitedCores;

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: !lowPower,
    powerPreference: "high-performance",
    alpha: false,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, lowPower ? 1.25 : 1.75));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = !lowPower;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1c2822);
  scene.fog = new THREE.Fog(0x1c2822, 24, 72);

  const camera = new THREE.PerspectiveCamera(42, window.innerWidth / Math.max(window.innerHeight, 1), 0.1, 160);
  camera.position.set(8, 6.5, 14);

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.target.set(0, 1.05, 0);
  controls.maxPolarAngle = Math.PI / 2.08;
  controls.minDistance = 4;
  controls.maxDistance = 52;

  scene.add(new THREE.HemisphereLight(0xc5d7c4, 0x3a2a18, 0.78));
  const sun = new THREE.DirectionalLight(0xfff4e0, 2.15);
  sun.position.set(16, 24, 9);
  sun.castShadow = renderer.shadowMap.enabled;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.near = 2;
  sun.shadow.camera.far = 48;
  sun.shadow.camera.left = -16;
  sun.shadow.camera.right = 16;
  sun.shadow.camera.top = 16;
  sun.shadow.camera.bottom = -16;
  scene.add(sun, sun.target);

  const fill = new THREE.DirectionalLight(0x9fd0ff, 0.55);
  fill.position.set(-12, 8, -6);
  scene.add(fill);

  const trees = createForest(scene);

  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / Math.max(window.innerHeight, 1);
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  return { renderer, scene, camera, controls, sun, trees };
}

const _mid = new THREE.Vector3();
const _delta = new THREE.Vector3();
const _side = new THREE.Vector3();
const _focus = new THREE.Vector3();
const _desired = new THREE.Vector3();

export function frameCamera(controls, camera, positionA, positionB, userOrbit, dt) {
  _mid.copy(positionA).add(positionB).multiplyScalar(0.5);
  _delta.copy(positionB).sub(positionA);
  _delta.y = 0;
  const separation = Math.max(0.8, _delta.length());
  if (_delta.lengthSq() < 1e-4) _delta.set(0, 0, 1);
  _delta.normalize();
  _side.set(-_delta.z, 0, _delta.x);
  const cameraSide = _side.x * (camera.position.x - _mid.x) + _side.z * (camera.position.z - _mid.z);
  if (cameraSide < 0) _side.multiplyScalar(-1);

  const portrait = camera.aspect < 0.9;
  const distance = (portrait ? 13.2 : 11.8) + separation * 0.32;
  const eyeY = (portrait ? 8.6 : 7.6) + separation * 0.04;
  _desired.set(_mid.x + _side.x * distance, eyeY, _mid.z + _side.z * distance);
  _focus.set(_mid.x, 1.2, _mid.z);

  const follow = 1 - Math.exp(-2.8 * dt);
  controls.target.lerp(_focus, follow);
  const fov = portrait ? 56 : 36;
  if (camera.fov !== fov) {
    camera.fov = fov;
    camera.updateProjectionMatrix();
  }
  if (!userOrbit) camera.position.lerp(_desired, follow);
  controls.update();
}

export function frameLight(light, positionA, positionB) {
  _mid.copy(positionA).add(positionB).multiplyScalar(0.5);
  light.position.set(_mid.x + 16, 24, _mid.z + 9);
  light.target.position.set(_mid.x, 0, _mid.z);
  light.target.updateMatrixWorld();
}
