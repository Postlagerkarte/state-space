// Glide rules: pieces slide in a direction until they hit a wall or another
// piece (Ricochet-Robots style). One drag = one dramatic move. The hero must
// come to rest exactly on the goal pad — overshooting flies right past it.
//
// Compared to the classic 2014 rules this gives an open, readable board with
// short, chunky solutions — and it is still a textbook BFS state space.

import { Rules } from './solver';
import { Rng } from './generator';
import { Solver } from './solver';

export type GPieceName = 'hero' | 'dot' | 'hbar' | 'vbar' | 'hbar3' | 'vbar3' | 'cube';

/** Piece shapes as (row, col) offsets from the anchor. No rotation in glide rules. */
export const GLIDE_SHAPES: Record<GPieceName, ReadonlyArray<readonly [number, number]>> = {
  hero: [[0, 0], [0, 1], [1, 0], [1, 1]],
  dot: [[0, 0]],
  hbar: [[0, 0], [0, 1]],
  vbar: [[0, 0], [1, 0]],
  hbar3: [[0, 0], [0, 1], [0, 2]],
  vbar3: [[0, 0], [1, 0], [2, 0]],
  cube: [[0, 0], [0, 1], [1, 0], [1, 1]],
};

export const GLIDE_COLORS: Record<GPieceName, number> = {
  hero: 0xf5a623,
  dot: 0x2ec4b6,
  hbar: 0x4d7cfe,
  vbar: 0x9b5de5,
  hbar3: 0x6fbf4a,
  vbar3: 0xe05263,
  cube: 0x8d99c4,
};

export const GLIDE_W = 12;
export const GLIDE_H = 10;

export interface GlideSpec {
  width: number;
  height: number;
  walls: number[]; // border ring + interior stubs
  goal: number; // anchor cell where the hero must come to rest
}

export interface GPlacement {
  piece: GPieceName;
  index: number;
}

export type GState = GPlacement[]; // element 0 is the hero

export interface GMove {
  pieceIdx: number;
  dr: number;
  dc: number;
  dist: number;
}

export const GLIDE_DIRS: ReadonlyArray<readonly [number, number]> = [
  [0, -1],
  [0, 1],
  [-1, 0],
  [1, 0],
];

/** Build a full spec from interior wall stubs (the border ring is implied). */
export function glideSpec(stubs: number[], goal: number): GlideSpec {
  const walls: number[] = [];
  for (let r = 0; r < GLIDE_H; r++) {
    for (let c = 0; c < GLIDE_W; c++) {
      if (r === 0 || r === GLIDE_H - 1 || c === 0 || c === GLIDE_W - 1) {
        walls.push(r * GLIDE_W + c);
      }
    }
  }
  walls.push(...stubs);
  return { width: GLIDE_W, height: GLIDE_H, walls, goal };
}

export function gCells(spec: GlideSpec, p: GPlacement): number[] {
  const r = (p.index / spec.width) | 0;
  const c = p.index % spec.width;
  return GLIDE_SHAPES[p.piece].map(([dr, dc]) => (r + dr) * spec.width + (c + dc));
}

function buildOcc(spec: GlideSpec, state: GState): Uint8Array {
  const occ = new Uint8Array(spec.width * spec.height);
  for (const w of spec.walls) occ[w] = 1;
  for (const p of state) {
    for (const cell of gCells(spec, p)) occ[cell] = 1;
  }
  return occ;
}

/**
 * Slide piece `pieceIdx` in direction (dr, dc) until it hits something.
 * Returns the resulting state and glide distance, or null if it can't move at all.
 */
export function glideMove(
  spec: GlideSpec,
  state: GState,
  pieceIdx: number,
  dr: number,
  dc: number,
): { state: GState; dist: number } | null {
  const { width, height } = spec;
  const occ = buildOcc(spec, state);
  const cells = gCells(spec, state[pieceIdx]);
  for (const cell of cells) occ[cell] = 0; // the piece doesn't block itself

  const rc = cells.map((cell) => [(cell / width) | 0, cell % width]);
  let dist = 0;
  outer: for (;;) {
    const n = dist + 1;
    for (const [r, c] of rc) {
      const nr = r + dr * n;
      const nc = c + dc * n;
      if (nr < 0 || nr >= height || nc < 0 || nc >= width || occ[nr * width + nc]) break outer;
    }
    dist = n;
  }
  if (dist === 0) return null;

  const next = state.slice();
  next[pieceIdx] = {
    piece: state[pieceIdx].piece,
    index: state[pieceIdx].index + dist * (dr * width + dc),
  };
  return { state: next, dist };
}

export function gSuccessors(spec: GlideSpec, state: GState): { state: GState; move: GMove }[] {
  const out: { state: GState; move: GMove }[] = [];
  for (let i = 0; i < state.length; i++) {
    for (const [dr, dc] of GLIDE_DIRS) {
      const slid = glideMove(spec, state, i, dr, dc);
      if (slid) {
        out.push({ state: slid.state, move: { pieceIdx: i, dr, dc, dist: slid.dist } });
      }
    }
  }
  return out;
}

export function gIsSolved(spec: GlideSpec, state: GState): boolean {
  return state[0].index === spec.goal;
}

export function gKey(state: GState): string {
  // piece types never change under glide rules, so positions identify the state
  return state.map((p) => p.index).join(',');
}

/**
 * Admissible heuristic under glide rules: a single move can cross any distance,
 * so Manhattan distance would overestimate. But the hero needs at least one
 * move if it is off the goal, and at least two if it is aligned with the goal
 * in neither row nor column.
 */
export function gHeuristic(spec: GlideSpec, state: GState): number {
  const a = state[0].index;
  if (a === spec.goal) return 0;
  const sameRow = ((a / spec.width) | 0) === ((spec.goal / spec.width) | 0);
  const sameCol = a % spec.width === spec.goal % spec.width;
  return sameRow || sameCol ? 1 : 2;
}

export function glideRules(spec: GlideSpec): Rules<GState, GMove> {
  return {
    successors: (s) => gSuccessors(spec, s),
    isSolved: (s) => gIsSolved(spec, s),
    key: gKey,
    heuristic: (s) => gHeuristic(spec, s),
  };
}

export function gCloneState(state: GState): GState {
  return state.map((p) => ({ piece: p.piece, index: p.index }));
}

// ---------------------------------------------------------------------------
// Generate-and-test for glide levels (same philosophy as the 2014 generator).
// ---------------------------------------------------------------------------

export interface GlideLevel {
  spec: GlideSpec;
  state: GState;
  optimal: number;
  explored: number;
}

export interface GlideGenOptions {
  blockers?: number;
  minOptimal?: number;
  maxOptimal?: number;
  maxStates?: number;
}

const BLOCKER_POOL: GPieceName[] = ['dot', 'dot', 'hbar', 'vbar', 'dot', 'hbar3', 'vbar3', 'cube'];

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

export class GlideLevelSearch {
  attempts = 0;
  statesChecked = 0;

  private readonly blockers: number;
  private readonly minOptimal: number;
  private readonly maxOptimal: number;
  private readonly maxStates: number;

  constructor(
    private readonly rng: Rng,
    opts: GlideGenOptions = {},
  ) {
    this.blockers = opts.blockers ?? 4;
    this.minOptimal = opts.minOptimal ?? 5;
    this.maxOptimal = opts.maxOptimal ?? 99;
    this.maxStates = opts.maxStates ?? 50_000;
  }

  /** Try up to `attemptBudget` random boards; returns a level when one passes. */
  tick(attemptBudget = 30): GlideLevel | null {
    for (let i = 0; i < attemptBudget; i++) {
      const level = this.attempt();
      if (level) return level;
    }
    return null;
  }

  private attempt(): GlideLevel | null {
    this.attempts++;
    const rng = this.rng;

    // interior wall stubs make the deflection points that create bank shots
    const stubCount = 5 + ((rng() * 5) | 0);
    const stubs = new Set<number>();
    while (stubs.size < stubCount) {
      const r = 1 + ((rng() * (GLIDE_H - 2)) | 0);
      const c = 1 + ((rng() * (GLIDE_W - 2)) | 0);
      stubs.add(r * GLIDE_W + c);
    }

    const wallsOnly = new Uint8Array(GLIDE_W * GLIDE_H);
    for (let r = 0; r < GLIDE_H; r++) {
      for (let c = 0; c < GLIDE_W; c++) {
        if (r === 0 || r === GLIDE_H - 1 || c === 0 || c === GLIDE_W - 1) {
          wallsOnly[r * GLIDE_W + c] = 1;
        }
      }
    }
    for (const s of stubs) wallsOnly[s] = 1;

    // goal pad: any spot the hero could occupy (judged only against walls)
    const goalSpots = anchorsWhereFits('hero', wallsOnly);
    if (goalSpots.length === 0) return null;
    const goal = goalSpots[(rng() * goalSpots.length) | 0];

    // place hero and blockers without overlaps
    const occ = new Uint8Array(wallsOnly);
    const state: GState = [];
    const heroSpots = anchorsWhereFits('hero', occ).filter((a) => a !== goal);
    if (heroSpots.length === 0) return null;
    const hero: GPlacement = { piece: 'hero', index: heroSpots[(rng() * heroSpots.length) | 0] };
    state.push(hero);
    const spec = glideSpec([...stubs], goal);
    for (const cell of gCells(spec, hero)) occ[cell] = 1;

    for (let k = 0; k < this.blockers; k++) {
      const piece = BLOCKER_POOL[(rng() * BLOCKER_POOL.length) | 0];
      const spots = anchorsWhereFits(piece, occ);
      if (spots.length === 0) return null;
      const p: GPlacement = { piece, index: spots[(rng() * spots.length) | 0] };
      state.push(p);
      for (const cell of gCells(spec, p)) occ[cell] = 1;
    }

    const solver = new Solver(glideRules(spec), state, 'bfs');
    solver.run(this.maxStates);
    this.statesChecked += solver.stats.explored;
    if (solver.goalId === null) return null;
    const optimal = solver.nodes[solver.goalId].depth;
    if (optimal < this.minOptimal || optimal > this.maxOptimal) return null;
    return { spec, state, optimal, explored: solver.stats.explored };
  }
}
