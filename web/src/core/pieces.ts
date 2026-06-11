// Piece definitions ported 1:1 from the original WPF project (Common/Helper.cs).
// Offsets are row-major cell offsets from the piece's anchor index on an 8-wide board.

export interface PieceDef {
  name: string;
  family: string;
  offsets: readonly number[];
  /** Orientation cycle this piece belongs to, in rotation order (includes itself). */
  cycle: readonly string[];
}

const defs: PieceDef[] = [];

function family(fam: string, cycle: string[], offsets: number[][]): void {
  cycle.forEach((name, i) => defs.push({ name, family: fam, offsets: offsets[i], cycle }));
}

family('i', ['i1', 'i2'], [
  [8, 9, 10],
  [1, 9, 17],
]);
family('z', ['z1', 'z2'], [
  [0, 1, 9, 10],
  [1, 8, 9, 16],
]);
family('s', ['s1', 's2'], [
  [1, 2, 8, 9],
  [0, 8, 9, 17],
]);
family('t', ['t1', 't2', 't3', 't4'], [
  [8, 9, 10, 17],
  [1, 9, 10, 17],
  [1, 8, 9, 10],
  [1, 8, 9, 17],
]);
family('j', ['j1', 'j2', 'j3', 'j4'], [
  [0, 1, 2, 10],
  [2, 10, 17, 18],
  [0, 8, 9, 10],
  [0, 1, 8, 16],
]);
family('l', ['l1', 'l2', 'l3', 'l4'], [
  [0, 1, 2, 8],
  [1, 2, 10, 18],
  [2, 8, 9, 10],
  [0, 8, 16, 17],
]);
family('o', ['o'], [
  [0, 1, 8, 9],
]);

export const PIECES: ReadonlyMap<string, PieceDef> = new Map(defs.map((d) => [d.name, d]));

/** Families available for random level generation (the hero 'o' is placed separately). */
export const FAMILIES = ['i', 's', 'z', 't', 'j', 'l'] as const;

export const FAMILY_COLORS: Record<string, number> = {
  o: 0xf5a623,
  i: 0x2ec4b6,
  s: 0x6fbf4a,
  z: 0xe05263,
  t: 0x9b5de5,
  j: 0x4d7cfe,
  l: 0xef8c3a,
};

export function pieceDef(name: string): PieceDef {
  const def = PIECES.get(name);
  if (!def) throw new Error(`Unknown piece: ${name}`);
  return def;
}
