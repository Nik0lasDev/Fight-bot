export function clip(spec) {
  return {
    id: spec.id,
    name: spec.name,
    limb: spec.limb || null,
    kind: spec.kind,
    damage: spec.damage,
    stun: spec.stun || 0,
    force: spec.force || 0,
    reach: spec.reach || 0,
    duration: spec.duration,
    windup: spec.windup,
    active: spec.active,
    lunge: spec.lunge ?? 0,
    strafe: spec.strafe ?? 0,
    bias: spec.bias,
    range: spec.range,
    threat: Boolean(spec.threat),
    damaging: spec.damage > 0,
  };
}

export function sampleMove(move, time) {
  if (time < move.windup) return { phase: move.damaging || move.threat ? "windup" : "defend" };
  if (time < move.active) {
    if (move.damaging) return { phase: "active" };
    if (move.threat) return { phase: "windup" };
    return { phase: "defend" };
  }
  return { phase: "recover" };
}
