// Stage-2 assist: when a player has been stuck for a while with previews
// showing, evaluate each candidate move of the previewed piece with the BFS
// solver — chunked across idle frames — and report which landings lie on an
// optimal path ("warm") and which would make the board unsolvable ("fatal").
// Deliberately categorical: no percentages, no full ranking — one bit of
// guidance that preserves the aha.

import { GLIDE_DIRS, GMove, GState, GlideSpec, gCloneState, glideMove, glideRules } from '../core/glide';
import { Solver } from '../core/solver';

export interface AssistMark {
  dr: number;
  dc: number;
  kind: 'warm' | 'fatal';
}

interface Candidate {
  dr: number;
  dc: number;
  state: GState;
}

export class AssistEvaluator {
  readonly token: string;
  private queue: Candidate[] = [];
  private results: { dr: number; dc: number; dist: number }[] = [];
  private solver: Solver<GState, GMove> | null = null;
  private cur: Candidate | null = null;
  private readonly maxStates: number;

  constructor(
    private readonly spec: GlideSpec,
    state: GState,
    pieceIdx: number,
    token: string,
    maxStates = 80_000,
  ) {
    this.token = token;
    this.maxStates = maxStates;
    for (const [dr, dc] of GLIDE_DIRS) {
      const slid = glideMove(spec, state, pieceIdx, dr, dc);
      if (slid) this.queue.push({ dr, dc, state: slid.state });
    }
  }

  /** Advance by ~budget expansions; returns the marks once every candidate is judged. */
  tick(budget: number): AssistMark[] | null {
    let remaining = budget;
    while (remaining > 0) {
      if (!this.solver) {
        this.cur = this.queue.shift() ?? null;
        if (!this.cur) return this.finish();
        this.solver = new Solver(glideRules(this.spec), gCloneState(this.cur.state), 'bfs');
      }
      const before = this.solver.stats.explored;
      while (
        !this.solver.done &&
        this.solver.stats.explored - before < remaining &&
        this.solver.stats.explored < this.maxStates
      ) {
        this.solver.step();
      }
      remaining -= this.solver.stats.explored - before;
      if (this.solver.done) {
        this.results.push({
          dr: this.cur!.dr,
          dc: this.cur!.dc,
          dist:
            this.solver.goalId !== null ? this.solver.nodes[this.solver.goalId].depth : Infinity,
        });
        this.solver = null;
      } else if (this.solver.stats.explored >= this.maxStates) {
        // too big to judge: stay silent about this candidate
        this.results.push({ dr: this.cur!.dr, dc: this.cur!.dc, dist: NaN });
        this.solver = null;
      } else {
        return null; // budget spent, resume next frame
      }
    }
    return null;
  }

  private finish(): AssistMark[] {
    const marks: AssistMark[] = [];
    const finite = this.results.filter((r) => Number.isFinite(r.dist));
    const best = finite.length > 0 ? Math.min(...finite.map((r) => r.dist)) : NaN;
    for (const r of this.results) {
      if (Number.isFinite(r.dist) && r.dist === best) {
        marks.push({ dr: r.dr, dc: r.dc, kind: 'warm' });
      } else if (r.dist === Infinity) {
        marks.push({ dr: r.dr, dc: r.dc, kind: 'fatal' });
      }
    }
    return marks;
  }
}
