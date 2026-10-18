export function attackMoves(clip) {
  return {
    jab: clip({
      id: "jab", name: "jab", limb: "handL", kind: "punch",
      damage: 8, stun: 0.14, force: 0.5, reach: 0.34,
      duration: 0.68, windup: 0.24, active: 0.39, lunge: 0.75, bias: 0.78,
      range: { min: 0.85, max: 1.7 },
    }),
    cross: clip({
      id: "cross", name: "direto", limb: "handR", kind: "punch",
      damage: 13, stun: 0.2, force: 0.8, reach: 0.36,
      duration: 0.82, windup: 0.29, active: 0.46, lunge: 1, bias: 0.82,
      range: { min: 0.9, max: 1.8 },
    }),
    hook: clip({
      id: "hook", name: "gancho", limb: "handR", kind: "punch",
      damage: 15, stun: 0.24, force: 0.7, reach: 0.38,
      duration: 0.86, windup: 0.28, active: 0.48, lunge: 0.4, bias: 0.76,
      range: { min: 0.72, max: 1.35 },
    }),
    uppercut: clip({
      id: "uppercut", name: "uppercut", limb: "handR", kind: "punch",
      damage: 14, stun: 0.23, force: 0.75, reach: 0.36,
      duration: 0.84, windup: 0.29, active: 0.49, lunge: 0.55, bias: 0.74,
      range: { min: 0.7, max: 1.32 },
    }),
    elbow: clip({
      id: "elbow", name: "cotovelada", limb: "elbowR", kind: "punch",
      damage: 12, stun: 0.18, force: 0.45, reach: 0.32,
      duration: 0.74, windup: 0.23, active: 0.42, lunge: 0.35, bias: 0.73,
      range: { min: 0.62, max: 1.15 },
    }),
    knee: clip({
      id: "knee", name: "joelhada", limb: "kneeR", kind: "knee",
      damage: 14, stun: 0.22, force: 0.7, reach: 0.36,
      duration: 0.86, windup: 0.28, active: 0.49, lunge: 0.5, bias: 0.75,
      range: { min: 0.62, max: 1.22 },
    }),
    kick: clip({
      id: "kick", name: "chute", limb: "footR", kind: "kick",
      damage: 16, stun: 0.24, force: 1.1, reach: 0.4,
      duration: 0.98, windup: 0.34, active: 0.56, lunge: 0.65, bias: 0.74,
      range: { min: 1.05, max: 1.95 },
    }),
    lowkick: clip({
      id: "lowkick", name: "chute baixo", limb: "footR", kind: "kick",
      damage: 11, stun: 0.17, force: 0.8, reach: 0.42,
      duration: 0.88, windup: 0.3, active: 0.5, lunge: 0.35, bias: 0.82,
      range: { min: 1.0, max: 1.85 },
    }),
    sweep: clip({
      id: "sweep", name: "rasteira", limb: "footR", kind: "kick",
      damage: 13, stun: 0.27, force: 1.2, reach: 0.46,
      duration: 1.02, windup: 0.36, active: 0.59, lunge: 0.25, bias: 0.72,
      range: { min: 1.1, max: 2.05 },
    }),
    shove: clip({
      id: "shove", name: "empurrão", limb: "handL", kind: "punch",
      damage: 6, stun: 0.08, force: 1.35, reach: 0.42,
      duration: 0.78, windup: 0.25, active: 0.44, lunge: 0.9, bias: 0.7,
      range: { min: 0.75, max: 1.45 },
    }),
  };
}
