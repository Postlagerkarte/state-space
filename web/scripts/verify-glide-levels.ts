// Sanity-check every curated glide level: the stored par must match what the
// BFS solver actually finds. Run after editing glideLevels.ts.
// Usage: npx tsx scripts/verify-glide-levels.ts

import { GLIDE_LEVELS } from '../src/core/glideLevels';
import { glideRules, gCloneState } from '../src/core/glide';
import { Solver } from '../src/core/solver';

let failed = false;
for (const level of GLIDE_LEVELS) {
  const solver = new Solver(glideRules(level.spec), gCloneState(level.state), 'bfs');
  solver.run(500_000);
  const par = solver.goalId !== null ? solver.nodes[solver.goalId].depth : -1;
  const ok = par === level.optimal;
  if (!ok) failed = true;
  console.log(
    `${ok ? 'OK  ' : 'FAIL'} ${level.id}: stored par ${level.optimal}, solver says ${par} ` +
      `(explored ${solver.stats.explored})`,
  );
}
process.exit(failed ? 1 : 0);
