// Mine curated glide levels: generate-and-test across difficulty tiers,
// print candidates as JSON for src/core/glideLevels.ts.
// Usage: npx tsx scripts/mine-glide.ts

import { GlideLevel, GlideLevelSearch } from '../src/core/glide';
import { mulberry32 } from '../src/core/generator';

interface Tier {
  blockers: number;
  minOptimal: number;
  maxOptimal: number;
  want: number;
}

const TIERS: Tier[] = [
  { blockers: 2, minOptimal: 4, maxOptimal: 6, want: 4 }, // "bridge" levels: clean boards that teach chaining
  { blockers: 3, minOptimal: 4, maxOptimal: 5, want: 3 },
  { blockers: 4, minOptimal: 6, maxOptimal: 7, want: 3 },
  { blockers: 5, minOptimal: 8, maxOptimal: 10, want: 3 },
];

for (const tier of TIERS) {
  const rng = mulberry32(7000 + tier.blockers);
  const search = new GlideLevelSearch(rng, tier);
  const found: GlideLevel[] = [];
  const t0 = Date.now();
  while (found.length < tier.want && search.attempts < 40_000) {
    const level = search.tick(200);
    if (level) found.push(level);
  }
  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(
    `\n=== ${tier.blockers} blockers, optimal ${tier.minOptimal}-${tier.maxOptimal}: ` +
      `${found.length} found in ${search.attempts} attempts (${secs}s) ===`,
  );
  for (const lvl of found) {
    const interiorStubs = lvl.spec.walls.filter((w) => {
      const r = (w / lvl.spec.width) | 0;
      const c = w % lvl.spec.width;
      return r > 0 && r < lvl.spec.height - 1 && c > 0 && c < lvl.spec.width - 1;
    });
    console.log(
      JSON.stringify({
        optimal: lvl.optimal,
        explored: lvl.explored,
        goal: lvl.spec.goal,
        stubs: interiorStubs,
        state: lvl.state,
      }),
    );
  }
}
