import * as THREE from "three";

export const EQUIPMENT_SLOTS = [
  { id: "helmet", label: "Capacete", icon: "⛑" },
  { id: "chest", label: "Peitoral", icon: "🛡" },
  { id: "legs", label: "Calça", icon: "⚔" },
  { id: "boots", label: "Botas", icon: "🥾" },
  { id: "bracers", label: "Braçadeiras", icon: "🧤" },
  { id: "cape", label: "Capa", icon: "🧣" },
];

const item = (id, name, color, material, texture, skill, ability, stats) => ({
  id, name, color, material, texture, skill, ability, stats,
});

export const EQUIPMENT_CATALOG = {
  helmet: [
    item("iron", "Elmo de Ferro", "#8d9aa9", "Aço escovado", "Placas sobrepostas", "Casco firme", "Recebe 8% menos dano na cabeça", { defense: 0.08 }),
    item("ember", "Coroa das Brasas", "#d65b38", "Ferro vulcânico", "Fissuras incandescentes", "Fúria rubra", "Ataques causam 4% mais dano", { damage: 0.04 }),
    item("ranger", "Capuz do Batedor", "#5a9a75", "Couro reforçado", "Tecido tramado", "Passos leves", "Movimento 7% mais rápido", { speed: 0.07 }),
    item("arcane", "Elmo Rúnico", "#6f74d8", "Prata encantada", "Runas gravadas", "Pulso arcano", "Reduz atordoamento em 10%", { stunResist: 0.1 }),
  ],
  chest: [
    item("guardian", "Couraça do Guardião", "#93a4b7", "Aço polido", "Placas rebitadas", "Muralha", "Recebe 12% menos dano", { defense: 0.12, speed: -0.03 }),
    item("dragon", "Peitoral Dracônico", "#a74732", "Escamas metálicas", "Escamas em relevo", "Sangue de dragão", "Ataques causam 7% mais dano", { damage: 0.07 }),
    item("shadow", "Malha Sombria", "#48475e", "Malha de titânio", "Anéis entrelaçados", "Vulto", "Movimento 5% mais rápido", { speed: 0.05, defense: 0.03 }),
    item("crystal", "Peitoral Prismático", "#4ba6bd", "Cristal temperado", "Facetas luminosas", "Barreira prismática", "Recebe 7% menos dano", { defense: 0.07, stunResist: 0.04 }),
  ],
  legs: [
    item("knight", "Grevas do Cavaleiro", "#9da8b6", "Aço laminado", "Articulações reforçadas", "Base firme", "Recebe 7% menos dano", { defense: 0.07, speed: -0.02 }),
    item("stalker", "Calça do Espreitador", "#4d775e", "Couro flexível", "Costuras cruzadas", "Caçador", "Movimento 9% mais rápido", { speed: 0.09 }),
    item("inferno", "Calça Infernal", "#b94d36", "Couro vulcânico", "Trilhas de brasa", "Impulso ardente", "Ataques causam 4% mais dano", { damage: 0.04, speed: 0.03 }),
    item("astral", "Grevas Astrais", "#7776cb", "Liga celeste", "Linhas rúnicas", "Equilíbrio astral", "Reduz atordoamento em 8%", { stunResist: 0.08, defense: 0.03 }),
  ],
  boots: [
    item("fortress", "Botas da Fortaleza", "#818b9a", "Aço e couro", "Solas segmentadas", "Ancoragem", "Recebe 5% menos dano", { defense: 0.05, speed: -0.02 }),
    item("wind", "Botas do Vendaval", "#4e9da7", "Couro leve", "Riscos aerodinâmicos", "Vento a favor", "Movimento 12% mais rápido", { speed: 0.12 }),
    item("crusher", "Botas Demolidoras", "#b77c43", "Bronze maciço", "Reforços dentados", "Passo sísmico", "Ataques causam 3% mais dano", { damage: 0.03, stunResist: 0.03 }),
    item("mystic", "Botas Místicas", "#8b68c7", "Tecido encantado", "Símbolos brilhantes", "Salto etéreo", "Movimento 5% mais rápido e 4% menos dano recebido", { speed: 0.05, defense: 0.04 }),
  ],
  bracers: [
    item("bulwark", "Manoplas Baluarte", "#9aa8b7", "Aço martelado", "Rebordos angulares", "Aparar", "Recebe 6% menos dano", { defense: 0.06 }),
    item("duelist", "Braçadeiras do Duelista", "#bd8b4c", "Bronze flexível", "Filetes dourados", "Golpe preciso", "Ataques causam 8% mais dano", { damage: 0.08 }),
    item("storm", "Braçadeiras da Tempestade", "#4c9bc4", "Liga condutora", "Veios elétricos", "Reflexo elétrico", "Movimento 5% mais rápido", { speed: 0.05, stunResist: 0.04 }),
    item("thorn", "Manoplas Espinhosas", "#8d5367", "Ferro negro", "Espinhos facetados", "Contra-pressão", "Ataques causam 5% mais dano", { damage: 0.05, defense: 0.02 }),
  ],
  cape: [
    item("royal", "Manto Real", "#b99a50", "Veludo dourado", "Bordado geométrico", "Presença real", "Recebe 3% menos dano", { defense: 0.03 }),
    item("night", "Capa da Noite", "#333849", "Seda fosca", "Tecido sombreado", "Manto silencioso", "Movimento 6% mais rápido", { speed: 0.06 }),
    item("flame", "Manto das Chamas", "#c94f36", "Lã escarlate", "Bordas flamejantes", "Espírito ardente", "Ataques causam 4% mais dano", { damage: 0.04 }),
    item("forest", "Capa da Floresta", "#42775b", "Linho encerado", "Folhas bordadas", "Vigor natural", "Recebe 4% menos dano", { defense: 0.04, stunResist: 0.03 }),
  ],
};

export const DEFAULT_LOADOUT = Object.fromEntries(
  EQUIPMENT_SLOTS.map((slot) => [slot.id, EQUIPMENT_CATALOG[slot.id][0].id]),
);

export function getEquipment(slotId, itemId) {
  return EQUIPMENT_CATALOG[slotId].find((entry) => entry.id === itemId) || EQUIPMENT_CATALOG[slotId][0];
}

function makeMaterial(entry, accent = false) {
  const material = new THREE.MeshStandardMaterial({
    color: accent ? new THREE.Color(entry.color).multiplyScalar(0.68) : entry.color,
    metalness: /aço|ferro|bronze|liga|prata|titânio|metal|escamas/i.test(entry.material) ? 0.78 : 0.18,
    roughness: /veludo|tecido|lã|linho|couro|seda/i.test(entry.material) ? 0.82 : 0.34,
  });
  return material;
}

function addMesh(group, geometry, material, position, scale) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(...position);
  if (scale) mesh.scale.set(...scale);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  return mesh;
}

function addRidges(group, entry, width, y, z, count = 3) {
  const accent = makeMaterial(entry, true);
  for (let i = 0; i < count; i += 1) {
    const x = (i - (count - 1) / 2) * (width / count);
    addMesh(group, new THREE.BoxGeometry(0.012, 0.19, 0.012), accent, [x, y, z]);
  }
}

function buildSlot(slotId, entry) {
  const group = new THREE.Group();
  group.name = `equipment-${slotId}-${entry.id}`;
  const main = makeMaterial(entry);
  const accent = makeMaterial(entry, true);
  const dark = new THREE.MeshStandardMaterial({ color: 0x202633, metalness: 0.35, roughness: 0.7 });

  if (slotId === "helmet") {
    addMesh(group, new THREE.SphereGeometry(0.145, 12, 9, 0, Math.PI * 2, 0, Math.PI * 0.66), main, [0, 0.025, 0]);
    addMesh(group, new THREE.BoxGeometry(0.205, 0.045, 0.14), main, [0, -0.045, 0.015]);
    addMesh(group, new THREE.BoxGeometry(0.15, 0.018, 0.018), accent, [0, -0.018, 0.088]);
    addMesh(group, new THREE.BoxGeometry(0.11, 0.018, 0.02), dark, [0, -0.047, 0.09]);
    if (entry.id === "ember") {
      for (const side of [-1, 1]) addMesh(group, new THREE.ConeGeometry(0.035, 0.13, 5), accent, [side * 0.105, 0.105, 0], [1, 1.2, 1]);
    } else if (entry.id === "ranger") {
      addMesh(group, new THREE.ConeGeometry(0.055, 0.12, 5), main, [0, 0.16, -0.02]);
    } else if (entry.id === "arcane") {
      addMesh(group, new THREE.OctahedronGeometry(0.045), accent, [0, 0.12, 0.105]);
    } else addRidges(group, entry, 0.13, 0.04, 0.09, 3);
  } else if (slotId === "chest") {
    addMesh(group, new THREE.BoxGeometry(0.29, 0.28, 0.18), main, [0, 0.015, 0.015]);
    addMesh(group, new THREE.BoxGeometry(0.09, 0.22, 0.025), accent, [0, 0.015, 0.11]);
    for (const side of [-1, 1]) {
      addMesh(group, new THREE.BoxGeometry(0.065, 0.22, 0.19), main, [side * 0.16, 0.01, 0]);
      addMesh(group, new THREE.SphereGeometry(0.028, 8, 6), accent, [side * 0.075, 0.11, 0.12]);
    }
    if (entry.id === "dragon") {
      for (let i = 0; i < 4; i += 1) addMesh(group, new THREE.ConeGeometry(0.028, 0.07, 5), accent, [(i - 1.5) * 0.065, 0.15, -0.09], [1, 1, 0.7]);
    } else addRidges(group, entry, 0.18, 0.01, 0.125, 4);
  } else if (slotId === "legs") {
    for (const side of [-1, 1]) {
      addMesh(group, new THREE.BoxGeometry(0.12, 0.25, 0.14), main, [side * 0.09, -0.12, 0]);
      addMesh(group, new THREE.BoxGeometry(0.125, 0.055, 0.15), accent, [side * 0.09, -0.06, 0.012]);
      addMesh(group, new THREE.BoxGeometry(0.075, 0.16, 0.15), main, [side * 0.09, -0.3, 0]);
    }
    addMesh(group, new THREE.BoxGeometry(0.24, 0.075, 0.13), accent, [0, 0.005, 0.02]);
  } else if (slotId === "boots") {
    addMesh(group, new THREE.BoxGeometry(0.12, 0.11, 0.16), main, [0, -0.005, 0.015]);
    addMesh(group, new THREE.BoxGeometry(0.13, 0.035, 0.19), accent, [0, -0.055, 0.035]);
    addMesh(group, new THREE.BoxGeometry(0.125, 0.04, 0.08), main, [0, 0.025, -0.005]);
    if (entry.id === "crusher") addMesh(group, new THREE.BoxGeometry(0.11, 0.02, 0.02), dark, [0, -0.035, 0.13]);
  } else if (slotId === "bracers") {
    addMesh(group, new THREE.CylinderGeometry(0.052, 0.044, 0.2, 8), main, [0, -0.08, 0], [1, 1, 0.85]);
    addMesh(group, new THREE.BoxGeometry(0.11, 0.075, 0.045), accent, [0, -0.045, 0.045]);
    addMesh(group, new THREE.BoxGeometry(0.105, 0.035, 0.035), accent, [0, -0.13, 0.045]);
    if (entry.id === "thorn") {
      for (let i = -1; i <= 1; i += 1) addMesh(group, new THREE.ConeGeometry(0.018, 0.075, 4), accent, [i * 0.035, -0.05, 0.07], [1, 1, 0.7]);
    }
  } else if (slotId === "cape") {
    const cloth = addMesh(group, new THREE.BoxGeometry(0.31, 0.46, 0.035), main, [0, -0.22, -0.12]);
    cloth.rotation.x = -0.12;
    addMesh(group, new THREE.BoxGeometry(0.34, 0.055, 0.045), accent, [0, -0.025, -0.105]);
    for (const side of [-1, 1]) {
      const edge = addMesh(group, new THREE.BoxGeometry(0.018, 0.4, 0.042), accent, [side * 0.145, -0.22, -0.115]);
      edge.rotation.x = -0.12;
    }
    if (entry.id === "royal") addMesh(group, new THREE.OctahedronGeometry(0.035), accent, [0, -0.05, 0.015]);
  }

  return group;
}

export function applyEquipment(fighter, loadout) {
  if (fighter.equipmentMeshes) {
    for (const mesh of fighter.equipmentMeshes) mesh.removeFromParent();
  }
  const skeleton = fighter.skeleton;
  const totals = { defense: 0, damage: 0, speed: 0, stunResist: 0 };
  const meshes = [];
  for (const slot of EQUIPMENT_SLOTS) {
    const entry = getEquipment(slot.id, loadout[slot.id]);
    for (const [key, value] of Object.entries(entry.stats)) totals[key] += value;
    const model = buildSlot(slot.id, entry);
    const attach = (parent, position = null) => {
      if (!parent) return;
      if (position) model.position.set(...position);
      parent.add(model);
      meshes.push(model);
    };
    if (slot.id === "helmet") attach(skeleton.joints.head, [0, 0, 0]);
    if (slot.id === "chest") attach(skeleton.joints.chest, [0, -0.01, 0]);
    if (slot.id === "legs") attach(skeleton.joints.pelvis, [0, -0.03, 0]);
    if (slot.id === "boots") {
      for (const side of ["L", "R"]) {
        const boot = buildSlot("boots", entry);
        skeleton.joints[`ankle${side}`].add(boot);
        boot.position.set(0, -0.02, 0.015);
        meshes.push(boot);
      }
      model.clear();
    }
    if (slot.id === "bracers") {
      for (const side of ["L", "R"]) {
        const bracer = buildSlot("bracers", entry);
        skeleton.joints[`forearm${side}`].add(bracer);
        bracer.position.set(0, -0.015, 0);
        meshes.push(bracer);
      }
      model.clear();
    }
    if (slot.id === "cape") attach(skeleton.joints.chest, [0, 0.025, 0]);
  }
  fighter.equipmentMeshes = meshes;
  fighter.equipmentLoadout = { ...loadout };
  fighter.equipmentStats = {
    defense: Math.max(0, Math.min(0.35, totals.defense)),
    damage: Math.max(0, Math.min(0.3, totals.damage)),
    speed: Math.max(-0.08, Math.min(0.25, totals.speed)),
    stunResist: Math.max(0, Math.min(0.3, totals.stunResist)),
  };
}
