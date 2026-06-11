// Level mining: run generate-and-test offline and print the most interesting
// solvable boards per piece count, to be curated into src/core/levels.ts.
// Usage: npm run mine

import { LevelSearch, mulberry32, GeneratedLevel } from '../src/core/generator';
import { Solver } from '../src/core/solver';

function mine(pieceCount: number, total: number, seed: number): GeneratedLevel[] {
  const rng = mulberry32(seed);
  const found: GeneratedLevel[] = [];
  const search = new LevelSearch(pieceCount, false, rng, { minOptimal: 6, maxStates: 200_000 });
  while (search.attempts < total) {
    const level = search.runSync(total);
    if (!level) break;
    found.push(level);
  }
  return found.sort((a, b) => b.optimal - a.optimal);
}

for (const pieceCount of [3, 4, 5, 6]) {
  const t0 = Date.now();
  const found = mine(pieceCount, 600, 42 + pieceCount);
  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`\n=== ${pieceCount} extra pieces: ${found.length} solvable levels in ${secs}s ===`);
  const interesting = [...found.slice(0, 5), ...found.slice(-2)];
  for (const lvl of interesting) {
    // Re-solve to double-check and report A* stats for comparison.
    const astar = new Solver(lvl.state, 'astar', false);
    astar.run(500_000);
    const astarOptimal = astar.goalId !== null ? astar.nodes[astar.goalId].depth : -1;
    console.log(
      JSON.stringify({
        optimal: lvl.optimal,
        astarOptimal,
        bfsExplored: lvl.explored,
        astarExplored: astar.stats.explored,
        state: lvl.state,
      }),
    );
  }
}
