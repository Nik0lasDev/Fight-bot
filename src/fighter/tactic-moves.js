export function tacticMoves(clip) {
  return {
    feint: clip({
      id: "feint", name: "finta", kind: "show", damage: 0, threat: true,
      duration: 0.34, windup: 0.14, active: 0.2, lunge: 0.25, bias: 0.8,
      range: { min: 0.9, max: 2.0 },
    }),
    duck: clip({
      id: "duck", name: "agachar", kind: "defend", damage: 0,
      duration: 0.42, windup: 0.12, active: 0.28, lunge: -0.15, bias: 0.2,
      range: { min: 0.4, max: 2.3 },
    }),
    weaveL: clip({
      id: "weaveL", name: "esquiva", kind: "defend", damage: 0,
      duration: 0.36, windup: 0.1, active: 0.24, strafe: -1.35, bias: 0.2,
      range: { min: 0.4, max: 2.4 },
    }),
    weaveR: clip({
      id: "weaveR", name: "esquiva", kind: "defend", damage: 0,
      duration: 0.36, windup: 0.1, active: 0.24, strafe: 1.35, bias: 0.2,
      range: { min: 0.4, max: 2.4 },
    }),
    taunt: clip({
      id: "taunt", name: "provocação", kind: "show", damage: 0,
      duration: 0.78, windup: 0.2, active: 0.55, bias: 0.18,
      range: { min: 1.35, max: 3.4 },
    }),
  };
}
