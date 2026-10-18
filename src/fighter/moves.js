import { attackMoves } from "./attack-moves.js";
import { clip, sampleMove } from "./move-clip.js";
import { tacticMoves } from "./tactic-moves.js";

export const MOVES = {
  ...attackMoves(clip),
  ...tacticMoves(clip),
};

export { sampleMove };
