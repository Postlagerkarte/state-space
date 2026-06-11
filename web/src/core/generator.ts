// Generate-and-test level generation, the same idea as LevelGeneratorService.CreateValidBoard:
// throw random piece placements at the board, keep the first one the solver can actually solve.
// LevelSearch is written as a resumable state machine so the browser can run it across
// animation frames (showing the attempt counter live) without freezing the UI.

import { FAMILIES, pieceDef } from './pieces';
import { CELLS, HERO_START, Move, Placement, State, classicRules, isWall } from './board';
import { Solver } from './solver';

export type Rng = () => number;

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const anchorCache = new Map<string, number[]>();

/** Anchor indices where the piece lies fully on playable (non-wall) cells. */
function anchorsFor(piece: string): number[] {
  let anchors = anchorCache.get(piece);
  if (!anchors) {
    anchors = [];
    const offsets = pieceDef(piece).offsets;
    for (let a = 0; a < CELLS; a++) {
      let ok = true;
      for (const o of offsets) {
        const cell = a + o;
        if (cell >= CELLS || isWall(cell)) {
          ok = false;
          break;
        }
      }
      if (ok) anchors.push(a);
    }
    anchorCache.set(piece, anchors);
  }
  return anchors;
}

function fits(occ: Uint8Array, piece: string, anchor: number): boolean {
  for (const o of pieceDef(piece).offsets) {
    if (occ[anchor + o]) return false;
  }
  return true;
}

function mark(occ: Uint8Array, p: Placement): void {
  for (const o of pieceDef(p.piece).offsets) occ[p.index + o] = 1;
}

/** One random placement attempt; null when a piece doesn't fit anywhere. */
function randomPlacement(pieceCount: number, rng: Rng): State | null {
  const occ = new Uint8Array(CELLS);
  for (let c = 0; c < CELLS; c++) if (isWall(c)) occ[c] = 1;

  const state: State = [{ piece: 'o', index: HERO_START }];
  mark(occ, state[0]);

  for (let k = 0; k < pieceCount; k++) {
    const fam = FAMILIES[(rng() * FAMILIES.length) | 0];
    const cycle = pieceDef(fam + '1').cycle;
    const name = cycle[(rng() * cycle.length) | 0];
    const candidates = anchorsFor(name).filter((a) => fits(occ, name, a));
    if (candidates.length === 0) return null;
    const p: Placement = { piece: name, index: candidates[(rng() * candidates.length) | 0] };
    mark(occ, p);
    state.push(p);
  }
  return state;
}

export interface GeneratedLevel {
  state: State;
  optimal: number;
  explored: number;
}

export interface LevelSearchOptions {
  minOptimal?: number;
  maxStates?: number;
}

export class LevelSearch {
  attempts = 0;
  statesChecked = 0;

  private solver: Solver<State, Move> | null = null;
  private candidate: State | null = null;
  private readonly minOptimal: number;
  private readonly maxStates: number;

  constructor(
    private readonly pieceCount: number,
    private readonly allowRotation: boolean,
    private readonly rng: Rng,
    opts: LevelSearchOptions = {},
  ) {
    this.minOptimal = opts.minOptimal ?? 6;
    this.maxStates = opts.maxStates ?? 120_000;
  }

  /** Advance by roughly `budget` solver expansions; returns the level once found. */
  tick(budget: number): GeneratedLevel | null {
    let remaining = budget;
    while (remaining > 0) {
      if (!this.solver) {
        const placed = randomPlacement(this.pieceCount, this.rng);
        this.attempts++;
        if (!placed) {
          remaining--; // failed placements are cheap but must still consume budget
          continue;
        }
        this.candidate = placed;
        this.solver = new Solver(classicRules(this.allowRotation), placed, 'bfs');
      }

      const before = this.solver.stats.explored;
      while (!this.solver.done && this.solver.stats.explored - before < remaining) {
        if (this.solver.stats.explored >= this.maxStates) break;
        this.solver.step();
      }
      const used = this.solver.stats.explored - before;
      remaining -= used;
      this.statesChecked += used;

      const exhausted = this.solver.done || this.solver.stats.explored >= this.maxStates;
      if (!exhausted) return null; // budget spent, resume next tick

      if (this.solver.goalId !== null) {
        const optimal = this.solver.nodes[this.solver.goalId].depth;
        if (optimal >= this.minOptimal) {
          const level: GeneratedLevel = {
            state: this.candidate!,
            optimal,
            explored: this.solver.stats.explored,
          };
          this.solver = null;
          this.candidate = null;
          return level;
        }
      }
      // Rejected (unsolvable, too easy, or too expensive) — try the next random board.
      this.solver = null;
      this.candidate = null;
      if (used === 0) remaining--; // safety: always make progress
    }
    return null;
  }

  /** Synchronous convenience for scripts/tests. */
  runSync(maxAttempts: number): GeneratedLevel | null {
    while (this.attempts < maxAttempts) {
      const level = this.tick(this.maxStates);
      if (level) return level;
    }
    return null;
  }
}
