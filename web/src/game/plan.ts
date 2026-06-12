// "Show the plan": strategic assistance distilled from a BFS solution.
//
// Move-level hints ("slide this dot left") say WHICH but never WHY. The plan
// view answers the player's real question on hard boards — "what do I do to
// solve this?" — by exposing the solution's skeleton: the HERO's route to the
// pad, plus the cells where a stopper must exist that doesn't exist yet.
// The blockers' moves are deliberately withheld: the strategy is given, the
// tactics stay the player's puzzle. (It's backward-chaining made visible.)

import { GMove, GState, GlideSpec, gCells } from '../core/glide';
import { SearchNode } from '../core/solver';

export interface PlanLeg {
  fromIndex: number;
  toIndex: number;
  dr: number;
  dc: number;
}

export interface Plan {
  legs: PlanLeg[];
  /** Cells that stop the hero somewhere along the route in the solution, but are empty right now. */
  missingStops: number[];
}

export function extractPlan(
  spec: GlideSpec,
  current: GState,
  path: SearchNode<GState, GMove>[],
): Plan {
  const { width, height } = spec;
  const legs: PlanLeg[] = [];
  const missing = new Set<number>();

  // occupancy as the board stands right now (walls + every current piece)
  const occNow = new Uint8Array(width * height);
  for (const w of spec.walls) occNow[w] = 1;
  for (const p of current) {
    for (const cell of gCells(spec, p)) occNow[cell] = 1;
  }

  for (let i = 1; i < path.length; i++) {
    const move = path[i].move;
    if (!move || move.pieceIdx !== 0) continue; // only the hero's glides form the route

    const fromIndex = path[i - 1].state[0].index;
    const toIndex = path[i].state[0].index;
    legs.push({ fromIndex, toIndex, dr: move.dr, dc: move.dc });

    // What stops the hero at this landing, in the solution's world?
    const occThen = new Uint8Array(width * height);
    for (const w of spec.walls) occThen[w] = 1;
    const stateThen = path[i].state;
    for (let pi = 1; pi < stateThen.length; pi++) {
      for (const cell of gCells(spec, stateThen[pi])) occThen[cell] = 1;
    }

    const heroCells = gCells(spec, { piece: 'hero', index: toIndex });
    for (const cell of heroCells) {
      const r = (cell / width) | 0;
      const c = cell % width;
      const nr = r + move.dr;
      const nc = c + move.dc;
      if (nr < 0 || nr >= height || nc < 0 || nc >= width) continue;
      const next = nr * width + nc;
      if (heroCells.includes(next)) continue; // hero's own interior
      // a stop that exists in the solution but not on today's board = build it
      if (occThen[next] && !occNow[next]) missing.add(next);
    }
  }

  return { legs, missingStops: [...missing] };
}
