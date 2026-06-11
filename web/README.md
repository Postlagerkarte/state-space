# State Space — watch search algorithms think

An interactive teaching tool built on the sliding-block puzzle from this repo's
original WPF project. The puzzle's C# core (`Common/`, `LevelGenerator/`) is
ported 1:1 to TypeScript and visualized with three.js.

```bash
npm install
npm run dev      # local dev server
npm run build    # static site in dist/ (deployable to GitHub Pages etc.)
npm run mine     # offline level mining (generate-and-test + BFS validation)
```

## The three tabs

- **Play** — solve the puzzle by hand. Click a piece, slide with arrow keys or
  the on-screen pad, bring the gold 2×2 block to the glowing corner. A
  background BFS computes the optimal move count so students can compare.
- **Watch** — breadth-first search visualized live. Every board state the
  solver discovers becomes a glowing node (depth = distance from center);
  cyan = frontier, indigo = explored, red flash = duplicate pruned by the hash
  set, gold = solution path. Pseudocode and counters update as it runs; click
  any node to see the board state it represents. Step mode for lectures.
- **Race** — BFS, DFS and A* explore the *same* level side by side with the
  same expansion budget. Try the "Heuristic's Delight" level: BFS wades through
  ~26k states, A* needs ~3k for the same optimal answer, and DFS finds a fast
  but absurdly long solution.

Deep links for the classroom: `?tab=watch&run=1`, `?tab=race&run=1`.

## Where things live

| Web (TypeScript)         | Original (C#)                              |
| ------------------------ | ------------------------------------------ |
| `src/core/pieces.ts`     | `Common/Helper.cs` (KnownPieces)           |
| `src/core/board.ts`      | `LevelGenerator/Board.cs`                  |
| `src/core/solver.ts`     | `LevelGeneratorService.Solve` (the BFS)    |
| `src/core/generator.ts`  | `LevelGeneratorService.CreateValidBoard`   |
| `src/core/levels.ts`     | curated boards mined with `scripts/mine.ts`|
| `src/render/*`           | three.js renderers (board + state graph)   |
| `src/tabs/*`             | the three tab controllers                  |

The solver generalizes the original BFS: the frontier data structure is the
only difference between BFS (queue), DFS (stack) and A* (priority queue with a
Manhattan-distance heuristic). It runs incrementally and emits events
(`expand`/`discover`/`dup`/`done`) that drive the visualization.
