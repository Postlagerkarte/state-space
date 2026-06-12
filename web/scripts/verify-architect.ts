// Prove the architect generator's contract on a batch of mined boards:
// (1) the delivered board is exhaustively unsolvable,
// (2) adding the known fix stub makes it solvable at the recorded par.
// Usage: npx tsx scripts/verify-architect.ts

import { ArchitectSearch } from '../src/core/architect';
import { mulberry32 } from '../src/core/generator';
import { GlideSpec, gCloneState, glideRules } from '../src/core/glide';
import { Solver } from '../src/core/solver';

let failed = false;
const t0 = Date.now();
const search = new ArchitectSearch(mulberry32(20260613), { minPar: 3, maxPar: 7 });

for (let i = 0; i < 6; i++) {
  const level = search.runSync(search.attempts + 4000);
  if (!level) {
    console.error('FAIL: generator could not find an architect board');
    failed = true;
    break;
  }
  const broken = new Solver(glideRules(level.spec), gCloneState(level.state), 'bfs');
  broken.run(50_000);
  const unsolvable = broken.done && broken.goalId === null;

  const fixedSpec: GlideSpec = { ...level.spec, walls: [...level.spec.walls, level.knownFix] };
  const fixed = new Solver(glideRules(fixedSpec), gCloneState(level.state), 'bfs');
  fixed.run(50_000);
  const par = fixed.goalId !== null ? fixed.nodes[fixed.goalId].depth : -1;

  const ok = unsolvable && par === level.parAfter;
  if (!ok) failed = true;
  console.log(
    `${ok ? 'OK  ' : 'FAIL'} board #${i + 1}: unsolvable=${unsolvable}, ` +
      `fix@${level.knownFix} -> par ${par} (recorded ${level.parAfter}), ` +
      `pieces=${level.state.length}, attempts so far=${search.attempts}`,
  );
}

console.log(`done in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
process.exit(failed ? 1 : 0);
