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

## The four tabs

- **⚡ Rush** (default) — an endless arcade run on generated "glide" boards
  (pieces slide until they hit something; park the gold block exactly on the
  pad). A global time bank drains; solves refund time; at-par streaks build a
  combo multiplier that earns boosters (bomb, freeze). The generator + BFS
  solver mine difficulty-calibrated boards live during play.
- **🧘 Zen** — the curated campaign with stars, undo and hints. Landing
  previews (ghosts of every spot a piece can glide to) appear after a moment
  of inactivity; stuck longer, and the solver shimmers the optimal landings.
- **Watch** — the game's own breadth-first search, visualized live on the same
  glide boards. Every node is one board position, colored by search depth so
  BFS reads as expanding waves; a white cursor marks the position being
  expanded; red flashes are duplicates pruned by the seen-set. Click any node
  to see its board. Step mode for lectures.
- **Race** — BFS, DFS and A* explore the same level side by side (the classic
  2014 sliding rules, whose bigger state space makes the differences vivid).
  Try "Heuristic's Delight": BFS wades through ~26k states, A* needs ~3k.

Deep links for the classroom: `?tab=watch&run=1`, `?tab=race&run=1`,
`?tab=play` (Zen). Debug: `?bank=N` sets the Rush starting clock.

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
