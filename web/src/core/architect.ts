// Architect boards: generated UNSOLVABLE, on purpose. The player gets to place
// one wall stub to make a solution exist — then solves the board they fixed.
// A different verb (construction) inside the same physics: deduce → create.
//
// Mining: random small boards are exhaustively proven unsolvable by the BFS
// solver, then we verify that at least one empty cell, when filled with a
// stub, yields a solution with a reasonable par. The same generate-and-test
// philosophy as everything else here — the solver is the judge.

import { Rng } from './generator';
import {
  GLIDE_H,
  GLIDE_SHAPES,
  GLIDE_W,
  GPieceName,
  GPlacement,
  GState,
  GlideSpec,
  gCells,
  glideRules,
  glideSpec,
} from './glide';
import { Solver } from './solver';

export interface ArchitectLevel {
  /** The broken board as delivered (unsolvable). */
  spec: GlideSpec;
  state: GState;
  /** At least one cell that fixes it (kept for verification/debugging). */
  knownFix: number;
  /** Par of the board after applying knownFix. */
  parAfter: number;
}

const BLOCKER_POOL: GPieceName[] = ['dot', 'dot', 'hbar', 'vbar'];
const SOLVE_CAP = 8_000;

function anchorsWhereFits(piece: GPieceName, blocked: Uint8Array): number[] {
  const out: number[] = [];
  for (let r = 0; r < GLIDE_H; r++) {
    for (let c = 0; c < GLIDE_W; c++) {
      let ok = true;
      for (const [dr, dc] of GLIDE_SHAPES[piece]) {
        const nr = r + dr;
        const nc = c + dc;
        if (nr >= GLIDE_H || nc >= GLIDE_W || blocked[nr * GLIDE_W + nc]) {
          ok = false;
          break;
        }
      }
      if (ok) out.push(r * GLIDE_W + c);
    }
  }
  return out;
}

export interface ArchitectGenOptions {
  minPar?: number;
  maxPar?: number;
}

export class ArchitectSearch {
  attempts = 0;

  private readonly minPar: number;
  private readonly maxPar: number;

  constructor(
    private readonly rng: Rng,
    opts: ArchitectGenOptions = {},
  ) {
    this.minPar = opts.minPar ?? 3;
    this.maxPar = opts.maxPar ?? 7;
  }

  tick(attemptBudget = 1): ArchitectLevel | null {
    for (let i = 0; i < attemptBudget; i++) {
      const level = this.attempt();
      if (level) return level;
    }
    return null;
  }

  runSync(maxAttempts: number): ArchitectLevel | null {
    while (this.attempts < maxAttempts) {
      const level = this.tick(5);
      if (level) return level;
    }
    return null;
  }

  private attempt(): ArchitectLevel | null {
    this.attempts++;
    const rng = this.rng;

    const stubCount = 4 + ((rng() * 5) | 0);
    const stubs = new Set<number>();
    while (stubs.size < stubCount) {
      const r = 1 + ((rng() * (GLIDE_H - 2)) | 0);
      const c = 1 + ((rng() * (GLIDE_W - 2)) | 0);
      stubs.add(r * GLIDE_W + c);
    }

    const blocked = new Uint8Array(GLIDE_W * GLIDE_H);
    for (let r = 0; r < GLIDE_H; r++) {
      for (let c = 0; c < GLIDE_W; c++) {
        if (r === 0 || r === GLIDE_H - 1 || c === 0 || c === GLIDE_W - 1) {
          blocked[r * GLIDE_W + c] = 1;
        }
      }
    }
    for (const s of stubs) blocked[s] = 1;

    const goalSpots = anchorsWhereFits('hero', blocked);
    if (goalSpots.length === 0) return null;
    const goal = goalSpots[(rng() * goalSpots.length) | 0];
    const spec = glideSpec([...stubs], goal);

    const occ = new Uint8Array(blocked);
    const heroSpots = anchorsWhereFits('hero', occ).filter((a) => a !== goal);
    if (heroSpots.length === 0) return null;
    const hero: GPlacement = { piece: 'hero', index: heroSpots[(rng() * heroSpots.length) | 0] };
    const state: GState = [hero];
    for (const cell of gCells(spec, hero)) occ[cell] = 1;

    const blockers = 1 + (rng() < 0.4 ? 1 : 0);
    for (let k = 0; k < blockers; k++) {
      const piece = BLOCKER_POOL[(rng() * BLOCKER_POOL.length) | 0];
      const spots = anchorsWhereFits(piece, occ);
      if (spots.length === 0) return null;
      const p: GPlacement = { piece, index: spots[(rng() * spots.length) | 0] };
      state.push(p);
      for (const cell of gCells(spec, p)) occ[cell] = 1;
    }

    // must be PROVABLY unsolvable: the solver exhausts the reachable space
    const broken = new Solver(glideRules(spec), state, 'bfs');
    broken.run(SOLVE_CAP);
    if (broken.goalId !== null) return null; // already solvable
    if (!broken.done) return null; // too big to prove — reject

    // ...and fixable: some empty cell, filled with a stub, yields a solution
    const empties: number[] = [];
    for (let cell = 0; cell < GLIDE_W * GLIDE_H; cell++) {
      if (!occ[cell]) empties.push(cell);
    }
    // shuffle so the known fix isn't biased to a corner
    for (let i = empties.length - 1; i > 0; i--) {
      const j = (rng() * (i + 1)) | 0;
      [empties[i], empties[j]] = [empties[j], empties[i]];
    }
    for (const cell of empties.slice(0, 60)) {
      const fixed: GlideSpec = { ...spec, walls: [...spec.walls, cell] };
      const solver = new Solver(glideRules(fixed), state, 'bfs');
      solver.run(SOLVE_CAP);
      if (solver.goalId !== null) {
        const par = solver.nodes[solver.goalId].depth;
        if (par >= this.minPar && par <= this.maxPar) {
          return { spec, state, knownFix: cell, parAfter: par };
        }
      }
    }
    return null;
  }
}
