import * as THREE from "three";
import { createArena, frameCamera, frameLight } from "./arena.js";
import { createAudio } from "./audio.js";
import { Bot, PROFILES } from "./fighter/bot.js";
import { Fighter } from "./fighter/fighter.js";
import { createGroundWeapon } from "./fighter/weapons.js";
import { applyEquipment, DEFAULT_LOADOUT, EQUIPMENT_CATALOG, EQUIPMENT_SLOTS, getEquipment } from "./fighter/equipment.js";
import { resolveHits, stayInRing, createImpact, updateImpacts, resolveBodies } from "./combat.js";
import { avoidTrees, PLAY_RADIUS, resolveTrees } from "./forest.js";

const canvas = document.querySelector("#view");
const ui = {
  hpA: document.querySelector("#hp-a"),
  hpB: document.querySelector("#hp-b"),
  intentA: document.querySelector("#intent-a"),
  intentB: document.querySelector("#intent-b"),
  scoreA: document.querySelector("#score-a"),
  scoreB: document.querySelector("#score-b"),
  round: document.querySelector("#round-label"),
  banner: document.querySelector("#banner"),
  feed: document.querySelector("#feed"),
  sound: document.querySelector("#sound-btn"),
  pause: document.querySelector("#pause-btn"),
  restart: document.querySelector("#restart-btn"),
  startScreen: document.querySelector("#start-screen"),
  start: document.querySelector("#start-btn"),
  app: document.querySelector("#app"),
  fighterTabs: document.querySelector("#fighter-tabs"),
  equipmentSummary: document.querySelector("#equipment-summary"),
  equipmentSlots: document.querySelector("#equipment-slots"),
  equipmentOptions: document.querySelector("#equipment-options"),
};

const { renderer, scene, camera, controls, sun, trees } = createArena(canvas);
const audio = createAudio();
const impacts = [];

const spawn = {
  a: new THREE.Vector3(-0.4, 0, -4.2),
  b: new THREE.Vector3(0.4, 0, 4.2),
};

const nimbus = new Fighter({ name: "Nimbus", color: 0x3ee0c5, position: spawn.a, weapon: "sword" });
const brasa = new Fighter({ name: "Brasa", color: 0xff6b4a, position: spawn.b, weapon: "mace" });
scene.add(nimbus.root, brasa.root);

// Seven medieval weapons are scattered across the arena for the bots to choose.
const arsenalLayout = [
  ["sword", -1.7, -3.15, 0.1],
  ["mace", 1.5, 3.05, Math.PI],
  ["axe", 1.45, -2.55, 0.35],
  ["spear", -1.25, 2.55, Math.PI - 0.2],
  ["dagger", -2.35, 0.05, 0.2],
  ["warhammer", 2.25, -0.05, Math.PI - 0.25],
  ["doubleaxe", 0, 1.15, 0.1],
];
let groundWeapons = [];
function resetArsenal() {
  for (const item of groundWeapons) item.mesh.removeFromParent();
  groundWeapons = arsenalLayout.map(([type, x, z, rotation]) => createGroundWeapon(scene, type, x, z, rotation));
  for (const fighter of [nimbus, brasa]) {
    if (fighter.skeleton.weapon) fighter.skeleton.weapon.removeFromParent();
    fighter.skeleton.weapon = null;
    fighter.skeleton.anchors.weaponTip = null;
    fighter.skeleton.weaponOnGround = true;
    fighter.skeleton.weaponType = null;
    fighter.skeleton.weaponDamage = 1;
    fighter.skeleton.weaponReach = 0;
    fighter.hasWeapon = false;
    fighter.weaponPickup.phase = "search";
    fighter.weaponPickup.time = 0;
    fighter.weaponPickup.item = null;
    fighter.weaponPickup.target = null;
  }
}
function assignNearestWeapon(fighter) {
  // Do not let both fighters reserve the same weapon.
  const reserved = new Set(
    [nimbus, brasa]
      .filter((other) => other !== fighter && !other.hasWeapon && other.weaponPickup.item?.available)
      .map((other) => other.weaponPickup.item),
  );
  const available = groundWeapons.filter((item) => item.available && !reserved.has(item));
  if (!available.length) {
    fighter.weaponPickup.item = null;
    fighter.weaponPickup.target = null;
    fighter.weaponPickup.phase = "search";
    return;
  }
  available.sort((a, b) => a.position.distanceTo(fighter.root.position) - b.position.distanceTo(fighter.root.position));
  const item = available[0];
  fighter.weaponPickup.item = item;
  fighter.weaponPickup.target = item.position;
  fighter.weaponPickup.phase = "search";
}
resetArsenal();
assignNearestWeapon(nimbus);
assignNearestWeapon(brasa);

const loadouts = {
  nimbus: { ...DEFAULT_LOADOUT },
  brasa: { ...DEFAULT_LOADOUT },
};
let activeFighterId = "nimbus";
let activeEquipmentSlot = "helmet";

function selectedFighter() {
  return activeFighterId === "nimbus" ? nimbus : brasa;
}

function refreshEquipmentModels() {
  applyEquipment(nimbus, loadouts.nimbus);
  applyEquipment(brasa, loadouts.brasa);
}

function equipmentIllustration(slotId, entry) {
  const id = entry.id;
  const color = entry.color;
  const dark = "#17202d";
  const svgId = `${slotId}-${id}`;
  const metal = "#dce7ef";
  const accent = ["ember", "dragon", "inferno", "flame", "crusher"].includes(id) ? "#ffb05a"
    : ["arcane", "crystal", "astral", "mystic"].includes(id) ? "#9cf4ff"
    : ["royal", "duelist"].includes(id) ? "#ffe09a" : "#d4e2ec";
  let silhouette = "";
  if (slotId === "helmet") {
    silhouette = `<path d="M43 65 Q42 29 80 23 Q118 29 117 65 L108 78 L52 78 Z" fill="url(#metal-${svgId})"/><path d="M47 62 Q80 47 113 62 L111 74 L49 74 Z" fill="${color}"/><path d="M52 77 L108 77 L103 89 L57 89 Z" fill="${color}"/><path d="M59 61 L101 61 L97 68 L63 68 Z" fill="${dark}"/><path d="M80 25 L80 53" stroke="${accent}" stroke-width="4" stroke-linecap="round"/>`;
    if (id === "ember") silhouette += `<path d="M52 39 L35 16 L64 30 M108 39 L125 16 L96 30" fill="${color}" stroke="${accent}" stroke-width="3" stroke-linejoin="round"/>`;
    if (id === "ranger") silhouette += `<path d="M53 32 L80 8 L107 32 L98 39 L80 27 L62 39 Z" fill="${color}" stroke="${accent}" stroke-width="2"/>`;
    if (id === "arcane") silhouette += `<path d="M80 13 L88 25 L80 37 L72 25 Z" fill="${accent}" stroke="#fff" stroke-width="1.5"/>`;
  } else if (slotId === "chest") {
    silhouette = `<path d="M56 26 L68 20 L80 31 L92 20 L104 26 L123 40 L110 57 L103 50 L107 91 Q80 103 53 91 L57 50 L50 57 L37 40 Z" fill="url(#metal)" stroke="${dark}" stroke-width="3" stroke-linejoin="round"/><path d="M58 32 L80 42 L102 32 L98 85 Q80 94 62 85 Z" fill="${color}" stroke="${accent}" stroke-width="2"/><path d="M80 40 L80 88 M63 54 L97 54 M61 69 L99 69" stroke="${accent}" stroke-width="3" opacity=".9"/><circle cx="80" cy="61" r="7" fill="${dark}" stroke="${accent}" stroke-width="3"/>`;
    if (id === "dragon") silhouette += `<path d="M62 30 L51 16 L71 25 M98 30 L109 16 L89 25" fill="${color}" stroke="${accent}" stroke-width="3"/>`;
  } else if (slotId === "legs") {
    silhouette = `<path d="M48 24 Q80 32 112 24 L106 53 L100 91 L83 91 L80 57 L76 91 L59 91 L54 53 Z" fill="url(#metal)" stroke="${dark}" stroke-width="3" stroke-linejoin="round"/><path d="M53 31 L76 35 L72 53 L62 53 L65 84 L59 86 L54 52 Z M84 35 L107 31 L106 52 L95 86 L89 84 L91 53 L81 53 Z" fill="${color}" stroke="${accent}" stroke-width="2"/><path d="M76 36 L84 36 L83 53 L77 53 Z" fill="${accent}"/>`;
  } else if (slotId === "boots") {
    silhouette = `<path d="M54 24 L78 24 L79 58 L92 67 L112 72 Q121 77 116 88 L48 88 Q41 83 48 75 L57 64 Z" fill="url(#metal)" stroke="${dark}" stroke-width="3" stroke-linejoin="round"/><path d="M55 30 L76 30 L76 63 L91 72 L108 77 L108 82 L52 82 L54 74 L62 64 Z" fill="${color}" stroke="${accent}" stroke-width="2"/><path d="M56 43 L76 43 M56 51 L76 51 M56 59 L76 59" stroke="${accent}" stroke-width="3"/>`;
    if (id === "crusher") silhouette += `<path d="M54 83 L62 91 L70 83 L78 91 L86 83 L94 91 L102 83" fill="none" stroke="${accent}" stroke-width="4"/>`;
  } else if (slotId === "bracers") {
    silhouette = `<path d="M60 20 Q80 13 100 20 L108 78 Q80 95 52 78 Z" fill="url(#metal)" stroke="${dark}" stroke-width="3"/><path d="M62 27 Q80 21 98 27 L102 74 Q80 86 58 74 Z" fill="${color}" stroke="${accent}" stroke-width="2"/><path d="M58 39 L102 39 M56 60 L104 60 M61 74 L99 74" stroke="${accent}" stroke-width="4"/>`;
    if (id === "thorn") silhouette += `<path d="M60 34 L47 20 L68 28 M80 34 L80 13 L87 31 M100 34 L114 20 L93 28" fill="${color}" stroke="${accent}" stroke-width="3" stroke-linejoin="round"/>`;
  } else {
    silhouette = `<path d="M65 22 L78 29 L82 29 L95 22 L111 34 L103 48 L111 91 Q80 105 49 91 L57 48 L49 34 Z" fill="${color}" stroke="${dark}" stroke-width="3" stroke-linejoin="round"/><path d="M65 25 L80 36 L95 25 L101 43 L94 87 Q80 94 66 87 L59 43 Z" fill="url(#cloth-${svgId})" stroke="${accent}" stroke-width="2"/><path d="M65 31 L80 42 L95 31 M61 48 L99 48 M59 66 L101 66 M58 83 L102 83" fill="none" stroke="${accent}" stroke-width="3" opacity=".95"/>`;
    if (id === "royal") silhouette += `<path d="M69 40 L80 30 L91 40 L80 52 Z" fill="${accent}" stroke="#fff" stroke-width="1.5"/>`;
    if (id === "forest") silhouette += `<path d="M80 51 Q61 39 65 31 Q80 34 80 51 Q95 35 99 31 Q102 45 80 51 Z" fill="${accent}"/>`;
  }
  const pattern = id === "arcane" || id === "astral" || id === "mystic"
    ? `<circle cx="80" cy="58" r="34" fill="none" stroke="${accent}" stroke-width="1.5" stroke-dasharray="3 5" opacity=".75"/>`
    : id === "shadow" || id === "night" ? `<path d="M36 35 L124 35 M32 48 L128 48 M36 61 L124 61" stroke="#fff" stroke-width="1" opacity=".18"/>`
    : `<path d="M39 100 L121 100" stroke="${accent}" stroke-width="2" opacity=".5"/>`;
  return `<svg class="equipment-art" viewBox="0 0 160 116" role="img" aria-label="${entry.name}, ${entry.material}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="metal-${svgId}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f5fbff"/><stop offset=".35" stop-color="${color}"/><stop offset=".72" stop-color="${dark}"/><stop offset="1" stop-color="${color}"/></linearGradient>
      <linearGradient id="cloth-${svgId}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${accent}"/><stop offset=".35" stop-color="${color}"/><stop offset="1" stop-color="${dark}"/></linearGradient>
      <radialGradient id="glow-${svgId}"><stop stop-color="${color}" stop-opacity=".32"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></radialGradient>
    </defs>
    <ellipse cx="80" cy="63" rx="58" ry="48" fill="url(#glow-${svgId})"/>
    ${pattern}${silhouette}
    <path d="M42 105 Q80 111 118 105" fill="none" stroke="#b8c7d8" stroke-width="1" opacity=".28"/>
  </svg>`;
}

function renderEquipmentWorkshop() {
  const fighter = selectedFighter();
  const loadout = loadouts[activeFighterId];
  const stats = fighter.equipmentStats || { defense: 0, damage: 0, speed: 0, stunResist: 0 };
  ui.fighterTabs.querySelectorAll("[data-fighter]").forEach((button) => {
    const active = button.dataset.fighter === activeFighterId;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  ui.equipmentSummary.innerHTML = [
    ["Defesa", `-${Math.round(stats.defense * 100)}%`],
    ["Dano", `+${Math.round(stats.damage * 100)}%`],
    ["Velocidade", `${stats.speed >= 0 ? "+" : ""}${Math.round(stats.speed * 100)}%`],
    ["Resistência", `${Math.round(stats.stunResist * 100)}%`],
  ].map(([label, value]) => `<div class="stat-chip"><span>${label}</span><strong>${value}</strong></div>`).join("");
  ui.equipmentSlots.innerHTML = EQUIPMENT_SLOTS.map((slot) => {
    const active = slot.id === activeEquipmentSlot;
    const selected = getEquipment(slot.id, loadout[slot.id]);
    return `<button type="button" class="slot-button ${active ? "is-active" : ""}" data-slot="${slot.id}" aria-pressed="${active}">${slot.label}: ${selected.name}</button>`;
  }).join("");
  const options = EQUIPMENT_CATALOG[activeEquipmentSlot];
  ui.equipmentOptions.innerHTML = options.map((entry) => {
    const active = loadout[activeEquipmentSlot] === entry.id;
    return `<button type="button" class="equipment-option ${active ? "is-selected" : ""}" data-item="${entry.id}" aria-pressed="${active}">
      <span class="item-swatch" style="--item-color:${entry.color}"></span>\n      ${equipmentIllustration(activeEquipmentSlot, entry)}
      <span class="item-name">${entry.name}</span>
      <span class="item-material">${entry.material}</span>
      <span class="item-texture">${entry.texture}</span>
      <span class="item-skill">${entry.skill}</span>
      <span class="item-ability">${entry.ability}</span>
    </button>`;
  }).join("");
}

refreshEquipmentModels();
renderEquipmentWorkshop();

ui.fighterTabs.addEventListener("click", (event) => {
  const button = event.target.closest("[data-fighter]");
  if (!button) return;
  activeFighterId = button.dataset.fighter;
  renderEquipmentWorkshop();
});

ui.equipmentSlots.addEventListener("click", (event) => {
  const button = event.target.closest("[data-slot]");
  if (!button) return;
  activeEquipmentSlot = button.dataset.slot;
  renderEquipmentWorkshop();
});

ui.equipmentOptions.addEventListener("click", (event) => {
  const button = event.target.closest("[data-item]");
  if (!button) return;
  loadouts[activeFighterId][activeEquipmentSlot] = button.dataset.item;
  refreshEquipmentModels();
  renderEquipmentWorkshop();
});

for (const fighter of [nimbus, brasa]) {
  fighter.weaponScene = scene;
  fighter.onWeaponDrop = (dropped) => {
    const item = { type: dropped.type, name: dropped.mesh.userData.stats?.name || dropped.type, mesh: dropped.mesh, position: dropped.position, available: true };
    groundWeapons.push(item);
    fighter.weaponPickup.item = item;
    fighter.weaponPickup.target = item.position;
    pushFeed(`${fighter.name} deixa a arma escapar!`);
  };
}

const botA = new Bot(nimbus, PROFILES.nimbus);
const botB = new Bot(brasa, PROFILES.brasa);

const match = {
  scoreA: 0,
  scoreB: 0,
  round: 1,
  phase: "menu",
  timer: 0,
  paused: false,
  userOrbit: false,
  orbitIdle: 0,
  winner: null,
};

const feed = [];
const clock = new THREE.Clock();
const HUD_INTERVAL = 0.1;
let hudElapsed = 0;
let animationFrame = 0;

controls.addEventListener("start", () => {
  match.userOrbit = true;
  match.orbitIdle = 6;
});

function pushFeed(message) {
  feed.unshift(message);
  feed.length = Math.min(feed.length, 6);
  const entries = feed.map((line) => {
    const item = document.createElement("p");
    item.textContent = line;
    return item;
  });
  ui.feed.replaceChildren(...entries);
}

function showBanner(text) {
  ui.banner.textContent = text;
}

function updateHud() {
  ui.hpA.style.transform = `scaleX(${nimbus.health / nimbus.maxHealth})`;
  ui.hpB.style.transform = `scaleX(${brasa.health / brasa.maxHealth})`;
  ui.intentA.textContent = botA.label;
  ui.intentB.textContent = botB.label;
  ui.scoreA.textContent = String(match.scoreA);
  ui.scoreB.textContent = String(match.scoreB);
  ui.round.textContent = match.scoreA >= 3 || match.scoreB >= 3 ? "Fim de luta" : `Round ${match.round}`;
}

function resetRound() {
  ui.restart.hidden = true;
  ui.pause.hidden = false;
  ui.pause.textContent = "Pausar";
  nimbus.reset(spawn.a);
  brasa.reset(spawn.b);
  resetArsenal();
  assignNearestWeapon(nimbus);
  assignNearestWeapon(brasa);
  botA.reset();
  botB.reset();
  match.phase = "announce";
  match.timer = 0.6;
  showBanner(`Round ${match.round}`);
  updateHud();
}

function startSimulation() {
  refreshEquipmentModels();
  ui.startScreen.hidden = true;
  ui.app.classList.remove("is-menu");
  audio.unlock();
  match.paused = false;
  match.scoreA = 0;
  match.scoreB = 0;
  match.round = 1;
  match.winner = null;
  ui.restart.hidden = true;
  ui.pause.hidden = false;
  ui.pause.textContent = "Pausar";
  feed.length = 0;
  ui.feed.replaceChildren();
  resetRound();
  canvas.focus();
}

function beginFight() {
  match.phase = "fight";
  showBanner("");
}

function onKnockout(winner, loser) {
  match.phase = "ko";
  match.timer = 3.1;
  match.winner = winner.name;
  winner.setLocomotion(0, 0);
  loser.setLocomotion(0, 0);
  winner.blocking = false;
  loser.blocking = false;
  if (winner === nimbus) match.scoreA += 1;
  else match.scoreB += 1;
  audio.ko();
  const finished = match.scoreA >= 3 || match.scoreB >= 3;
  showBanner(finished ? `${winner.name} vence a luta` : `${winner.name} vence o round`);
  pushFeed(`${winner.name} nocauteia ${loser.name}`);
  updateHud();
}

function reportLosses(fighter) {
  for (const label of fighter.takeLosses()) {
    pushFeed(`${fighter.name} perde ${label}`);
  }
}

function applyHit(hit) {
  hit.defender.receiveHit(hit);
  audio.hit(hit.blocked);
  impacts.push(createImpact(scene, hit.point, hit.blocked ? 0xf2f2f2 : hit.attacker.color));
  const where = hit.part === "head" ? "na cabeça" : hit.part === "chest" ? "no tronco" : "no corpo";
  if (hit.blocked && hit.move.kind === "punch") {
    pushFeed(`${hit.defender.name} bloqueia o ${hit.move.name}`);
  } else if (hit.blocked) {
    pushFeed(`${hit.attacker.name} acerta um ${hit.move.name} no bloqueio`);
  } else {
    pushFeed(`${hit.attacker.name} acerta um ${hit.move.name} ${where}`);
  }
  if (hit.defender.ko && match.phase === "fight") onKnockout(hit.attacker, hit.defender);
}

function updateMatch(dt) {
  if (match.phase === "announce") {
    match.timer -= dt;
    if (match.timer <= 0) beginFight();
    return;
  }

  if (match.phase === "ko") {
    match.timer -= dt;
    if (match.timer <= 0) {
      if (match.scoreA >= 3 || match.scoreB >= 3) {
        match.phase = "finished";
        showBanner(`${match.winner} venceu a luta`);
        ui.restart.hidden = false;
        ui.pause.hidden = true;
        updateHud();
      } else {
        match.round += 1;
        resetRound();
      }
    }
  }
}

function tick() {
  animationFrame = 0;
  const dt = Math.min(clock.getDelta(), 0.033);

  // Dropped weapons skid briefly across the floor before friction stops them.
  for (const item of groundWeapons) {
    // Only simulate floor movement while the weapon is actually on the ground.
    // A previously dropped weapon can keep velocity data after being picked up.
    if (!item.available || item.mesh.parent !== scene) continue;
    const drift = item.mesh.userData.droppedVelocity;
    if (!drift || drift.lengthSq() < 0.0025) continue;
    item.mesh.position.x += drift.x * dt;
    item.mesh.position.z += drift.z * dt;
    drift.multiplyScalar(Math.max(0, 1 - dt * 2.8));
    item.mesh.position.x = THREE.MathUtils.clamp(item.mesh.position.x, -PLAY_RADIUS, PLAY_RADIUS);
    item.mesh.position.z = THREE.MathUtils.clamp(item.mesh.position.z, -PLAY_RADIUS, PLAY_RADIUS);
    item.position.set(item.mesh.position.x, 0, item.mesh.position.z);
  }

  if (match.orbitIdle > 0) {
    match.orbitIdle -= dt;
    if (match.orbitIdle <= 0) match.userOrbit = false;
  }

  if (!match.paused && match.phase !== "finished") {
    if (match.phase === "fight") {
      botA.update(dt, brasa);
      botB.update(dt, nimbus);
    }

    avoidTrees(nimbus, trees);
    avoidTrees(brasa, trees);
    nimbus.update(dt, brasa);
    brasa.update(dt, nimbus);
    reportLosses(nimbus);
    reportLosses(brasa);

    resolveBodies(nimbus, brasa);
    resolveTrees(nimbus, trees);
    resolveTrees(brasa, trees);
    stayInRing(nimbus, PLAY_RADIUS);
    stayInRing(brasa, PLAY_RADIUS);
    resolveBodies(nimbus, brasa);
    resolveTrees(nimbus, trees);
    resolveTrees(brasa, trees);

    if (match.phase === "fight") {
      for (const hit of resolveHits(nimbus, brasa)) applyHit(hit);
    }
    updateImpacts(impacts, dt);
    updateMatch(dt);
  }

  hudElapsed += dt;
  if (hudElapsed >= HUD_INTERVAL) {
    hudElapsed %= HUD_INTERVAL;
    updateHud();
  }

  frameLight(sun, nimbus.root.position, brasa.root.position);
  frameCamera(controls, camera, nimbus.root.position, brasa.root.position, match.userOrbit, dt);
  renderer.render(scene, camera);

  if (!document.hidden) animationFrame = requestAnimationFrame(tick);
}

function togglePause() {
  if (match.phase === "menu" || match.phase === "finished") return;
  match.paused = !match.paused;
  ui.pause.textContent = match.paused ? "Retomar" : "Pausar";
  showBanner(match.paused ? "Pausado" : match.phase === "fight" ? "" : ui.banner.textContent);
}

window.addEventListener("keydown", (event) => {
  if (match.phase === "menu") return;
  if (event.target instanceof HTMLElement && event.target.closest("button, input, textarea, select, [contenteditable='true']")) return;

  if (event.code === "Space") {
    event.preventDefault();
    togglePause();
  }
  if (event.code === "KeyR") {
    if (match.phase === "finished") {
      startSimulation();
    } else {
      match.paused = false;
      ui.pause.textContent = "Pausar";
      resetRound();
    }
  }
});

ui.pause.addEventListener("click", togglePause);
ui.restart.addEventListener("click", startSimulation);
ui.sound.addEventListener("click", () => {
  const enabled = audio.toggle();
  ui.sound.textContent = enabled ? "Som: ligado" : "Som: desligado";
});

ui.start.addEventListener("click", startSimulation);
canvas.addEventListener("pointerdown", () => audio.unlock());

document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    if (animationFrame) cancelAnimationFrame(animationFrame);
    animationFrame = 0;
    clock.stop();
    return;
  }

  clock.start();
  if (!animationFrame) animationFrame = requestAnimationFrame(tick);
});

document.documentElement.dataset.ready = "1";
clock.start();
animationFrame = requestAnimationFrame(tick);
