// Curated glide levels, mined offline with scripts/mine-glide.ts
// (generate-and-test + BFS validation). `optimal` is the par.

import { GState, GlideSpec, glideSpec } from './glide';

export interface GlideLevelDef {
  id: string;
  name: string;
  spec: GlideSpec;
  state: GState;
  optimal: number;
}

export const GLIDE_LEVELS: GlideLevelDef[] = [
  {
    id: 'touchdown',
    name: 'Touchdown',
    spec: glideSpec([78, 86, 13, 46, 45, 51, 73], 92),
    state: [
      { piece: 'hero', index: 93 },
      { piece: 'hbar3', index: 27 },
      { piece: 'vbar3', index: 52 },
      { piece: 'dot', index: 26 },
    ],
    optimal: 4,
  },
  {
    id: 'runway',
    name: 'Runway',
    spec: glideSpec([13, 61, 22, 54, 103, 87, 33], 50),
    state: [
      { piece: 'hero', index: 43 },
      { piece: 'hbar3', index: 88 },
      { piece: 'dot', index: 25 },
      { piece: 'dot', index: 40 },
    ],
    optimal: 5,
  },
  {
    id: 'bank-shot',
    name: 'Bank Shot',
    spec: glideSpec([94, 32, 27, 64, 58, 51, 56, 45, 17], 28),
    state: [
      { piece: 'hero', index: 78 },
      { piece: 'hbar', index: 14 },
      { piece: 'vbar3', index: 81 },
      { piece: 'vbar3', index: 74 },
    ],
    optimal: 5,
  },
  {
    id: 'detour',
    name: 'Detour',
    spec: glideSpec([93, 82, 62, 77, 25, 69], 33),
    state: [
      { piece: 'hero', index: 51 },
      { piece: 'vbar3', index: 22 },
      { piece: 'dot', index: 90 },
      { piece: 'dot', index: 39 },
      { piece: 'vbar', index: 88 },
    ],
    optimal: 6,
  },
  {
    id: 'switchyard',
    name: 'Switchyard',
    spec: glideSpec([102, 44, 67, 57, 40, 29, 18, 46, 75], 49),
    state: [
      { piece: 'hero', index: 13 },
      { piece: 'hbar3', index: 53 },
      { piece: 'vbar', index: 79 },
      { piece: 'cube', index: 86 },
      { piece: 'cube', index: 81 },
    ],
    optimal: 6,
  },
  {
    id: 'corridor',
    name: 'Corridor',
    spec: glideSpec([65, 87, 37, 94, 82], 32),
    state: [
      { piece: 'hero', index: 61 },
      { piece: 'cube', index: 80 },
      { piece: 'vbar', index: 30 },
      { piece: 'dot', index: 98 },
      { piece: 'vbar', index: 27 },
    ],
    optimal: 7,
  },
  {
    id: 'pinball',
    name: 'Pinball',
    spec: glideSpec([15, 44, 39, 80, 76, 70], 30),
    state: [
      { piece: 'hero', index: 88 },
      { piece: 'hbar', index: 53 },
      { piece: 'dot', index: 64 },
      { piece: 'vbar', index: 37 },
      { piece: 'vbar3', index: 74 },
      { piece: 'hbar3', index: 61 },
    ],
    optimal: 8,
  },
  {
    id: 'crossfire',
    name: 'Crossfire',
    spec: glideSpec([98, 17, 13, 57, 77, 85, 22, 52, 29], 42),
    state: [
      { piece: 'hero', index: 75 },
      { piece: 'dot', index: 73 },
      { piece: 'hbar', index: 64 },
      { piece: 'dot', index: 97 },
      { piece: 'cube', index: 33 },
      { piece: 'hbar', index: 91 },
    ],
    optimal: 8,
  },
  {
    id: 'gridlock',
    name: 'Gridlock',
    spec: glideSpec([75, 46, 67, 93, 61], 52),
    state: [
      { piece: 'hero', index: 57 },
      { piece: 'dot', index: 99 },
      { piece: 'hbar', index: 101 },
      { piece: 'vbar3', index: 31 },
      { piece: 'hbar3', index: 79 },
      { piece: 'dot', index: 98 },
    ],
    optimal: 8,
  },
];
