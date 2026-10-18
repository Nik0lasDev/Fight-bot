import * as THREE from "three";
import { createArena, frameCamera, frameLight } from "./arena.js";
import { createAudio } from "./audio.js";
import { Bot, PROFILES } from "./fighter/bot.js";
import { Fighter } from "./fighter/fighter.js";
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

// Each weapon starts physically on the arena floor, ahead of its owner.
const nimbusWeaponPosition = new THREE.Vector3(-0.4, 0.045, -3.25);
const brasaWeaponPosition = new THREE.Vector3(0.4, 0.045, 3.25);
nimbus.weaponPickup.target = nimbusWeaponPosition.clone();
brasa.weaponPickup.target = brasaWeaponPosition.clone();
nimbus.skeleton.dropWeapon(scene, nimbusWeaponPosition, 0);
brasa.skeleton.dropWeapon(scene, brasaWeaponPosition, Math.PI);

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
  botA.reset();
  botB.reset();
  match.phase = "announce";
  match.timer = 0.6;
  showBanner(`Round ${match.round}`);
  updateHud();
}

function startSimulation() {
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
