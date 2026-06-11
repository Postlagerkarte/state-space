// Curated levels, mined offline with scripts/mine.ts (generate-and-test + BFS validation).
// `optimal` and `explored` are for slide-only rules (rotation off); with rotation
// enabled the tabs recompute the optimum at load time.

import { State } from './board';

export interface Level {
  id: string;
  name: string;
  blurb: string;
  state: State;
  optimal: number;
  explored: number;
}

export const LEVELS: Level[] = [
  {
    id: 'first-steps',
    name: 'First Steps',
    blurb: 'A gentle start — the optimal solution is 8 moves.',
    state: [
      { piece: 'o', index: 9 },
      { piece: 'i1', index: 17 },
      { piece: 't4', index: 33 },
      { piece: 't2', index: 34 },
    ],
    optimal: 8,
    explored: 271,
  },
  {
    id: 'warming-up',
    name: 'Warming Up',
    blurb: 'Three blockers, 21 moves — pieces must get out of each other’s way.',
    state: [
      { piece: 'o', index: 9 },
      { piece: 'j4', index: 34 },
      { piece: 'z1', index: 12 },
      { piece: 'l3', index: 18 },
    ],
    optimal: 21,
    explored: 2425,
  },
  {
    id: 'the-squeeze',
    name: 'The Squeeze',
    blurb: 'Four pieces, 45 moves optimal. Deceptively cramped.',
    state: [
      { piece: 'o', index: 9 },
      { piece: 'l1', index: 43 },
      { piece: 's1', index: 18 },
      { piece: 's1', index: 20 },
      { piece: 'j2', index: 32 },
    ],
    optimal: 45,
    explored: 4996,
  },
  {
    id: 'heuristics-delight',
    name: "Heuristic's Delight",
    blurb: 'Only 14 moves — but BFS wades through 26k states while A* needs ~3k. Race them!',
    state: [
      { piece: 'o', index: 9 },
      { piece: 's2', index: 25 },
      { piece: 'i2', index: 13 },
      { piece: 'i2', index: 34 },
      { piece: 'i2', index: 12 },
      { piece: 'i2', index: 35 },
    ],
    optimal: 14,
    explored: 26462,
  },
  {
    id: 'century',
    name: 'Century',
    blurb: 'Five pieces, exactly 100 moves optimal. A long, winding corridor of states.',
    state: [
      { piece: 'o', index: 9 },
      { piece: 's1', index: 12 },
      { piece: 'j3', index: 42 },
      { piece: 'j2', index: 28 },
      { piece: 'j4', index: 28 },
      { piece: 'z1', index: 25 },
    ],
    optimal: 100,
    explored: 3852,
  },
  {
    id: 'the-gauntlet',
    name: 'The Gauntlet',
    blurb: 'Six pieces, 141 moves optimal, 40k states explored. The deep end.',
    state: [
      { piece: 'o', index: 9 },
      { piece: 'i2', index: 27 },
      { piece: 's2', index: 13 },
      { piece: 'l4', index: 33 },
      { piece: 'i2', index: 36 },
      { piece: 's1', index: 18 },
      { piece: 'i2', index: 34 },
    ],
    optimal: 141,
    explored: 40500,
  },
];

export function levelById(id: string): Level | undefined {
  return LEVELS.find((l) => l.id === id);
}
