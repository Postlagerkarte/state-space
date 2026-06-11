// BoardLayout adapters: how each rule set maps onto the generic BoardView.

import { BoardLayout, ViewPlacement } from './boardView';
import { W, H, WALL_CELLS, GOAL_INDEX, Placement, cellsOf } from '../core/board';
import { FAMILY_COLORS, pieceDef } from '../core/pieces';
import { GPlacement, GlideSpec, GLIDE_COLORS, GPieceName, gCells } from '../core/glide';

export function classicLayout(): BoardLayout {
  return {
    width: W,
    height: H,
    walls: [...WALL_CELLS],
    goalCells: [GOAL_INDEX, GOAL_INDEX + 1, GOAL_INDEX + W, GOAL_INDEX + W + 1],
    cells: (p: ViewPlacement) => cellsOf(p as Placement),
    color: (p: ViewPlacement) => FAMILY_COLORS[pieceDef(p.piece).family] ?? 0xffffff,
  };
}

export function glideLayout(spec: GlideSpec): BoardLayout {
  return {
    width: spec.width,
    height: spec.height,
    walls: [...spec.walls],
    goalCells: gCells(spec, { piece: 'hero', index: spec.goal }),
    cells: (p: ViewPlacement) => gCells(spec, p as GPlacement),
    color: (p: ViewPlacement) => GLIDE_COLORS[p.piece as GPieceName] ?? 0xffffff,
  };
}
