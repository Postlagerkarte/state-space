// Board model ported from LevelGenerator/Board.cs.
// The board is 8x8; the outer ring is wall, leaving a 6x6 playable area.
// A state is the list of piece placements; element 0 is always the hero 'o' piece,
// which starts at index 9 (top-left) and must reach index 45 (bottom-right).

import { pieceDef } from './pieces';

export const W = 8;
export const H = 8;
export const CELLS = W * H;

export const WALL_CELLS: readonly number[] = [
  0, 1, 2, 3, 4, 5, 6, 7,
  8, 15, 16, 23, 24, 31, 32, 39, 40, 47, 48, 55,
  56, 57, 58, 59, 60, 61, 62, 63,
];

export const GOAL_INDEX = 45;
export const HERO_START = 9;

const SLIDE_DELTAS = [-1, 1, -W, W] as const;

export interface Placement {
  piece: string;
  index: number;
}

export type State = Placement[];

export interface Move {
  pieceIdx: number;
  kind: 'slide' | 'rotate';
  from: Placement;
  to: Placement;
}

const WALL_MASK = new Uint8Array(CELLS);
for (const c of WALL_CELLS) WALL_MASK[c] = 1;

export function isWall(cell: number): boolean {
  return WALL_MASK[cell] === 1;
}

export function cellsOf(p: Placement): number[] {
  return pieceDef(p.piece).offsets.map((o) => p.index + o);
}

/** A state is valid when no piece cell leaves the board or overlaps a wall/another piece. */
export function isValidState(state: State): boolean {
  const occ = new Uint8Array(WALL_MASK);
  for (const p of state) {
    for (const o of pieceDef(p.piece).offsets) {
      const cell = p.index + o;
      if (cell < 0 || cell >= CELLS || occ[cell]) return false;
      occ[cell] = 1;
    }
  }
  return true;
}

export function isSolved(state: State): boolean {
  return state[0].index === GOAL_INDEX;
}

/** Unique string key for duplicate detection (the role GetHash played in the C# solver). */
export function keyOf(state: State): string {
  let k = '';
  for (const p of state) k += p.piece + ':' + p.index + '|';
  return k;
}

/** All valid single moves from a state: each piece x each direction (x each rotation). */
export function successors(state: State, allowRotation: boolean): { state: State; move: Move }[] {
  const out: { state: State; move: Move }[] = [];
  for (let i = 0; i < state.length; i++) {
    const p = state[i];
    for (const d of SLIDE_DELTAS) {
      const to: Placement = { piece: p.piece, index: p.index + d };
      const next = state.slice();
      next[i] = to;
      if (isValidState(next)) {
        out.push({ state: next, move: { pieceIdx: i, kind: 'slide', from: p, to } });
      }
    }
    if (allowRotation) {
      const cycle = pieceDef(p.piece).cycle;
      if (cycle.length > 1) {
        for (const name of cycle) {
          if (name === p.piece) continue;
          const to: Placement = { piece: name, index: p.index };
          const next = state.slice();
          next[i] = to;
          if (isValidState(next)) {
            out.push({ state: next, move: { pieceIdx: i, kind: 'rotate', from: p, to } });
          }
        }
      }
    }
  }
  return out;
}

/** Admissible A* heuristic: Manhattan distance of the hero's anchor to the goal anchor. */
export function manhattanToGoal(state: State): number {
  const a = state[0].index;
  return Math.abs((a % W) - (GOAL_INDEX % W)) + Math.abs(((a / W) | 0) - ((GOAL_INDEX / W) | 0));
}

export function cloneState(state: State): State {
  return state.map((p) => ({ piece: p.piece, index: p.index }));
}
