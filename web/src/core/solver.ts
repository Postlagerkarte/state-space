// Incremental graph-search solver, ported from LevelGeneratorService.Solve (the BFS)
// and generalized: the frontier data structure is the only difference between
// BFS (queue), DFS (stack) and A* (priority queue ordered by depth + heuristic).
//
// The solver advances one expansion at a time via step() and emits events,
// so the UI can visualize the search as it happens.

import { State, Move, keyOf, successors, isSolved, manhattanToGoal } from './board';

export type Algo = 'bfs' | 'dfs' | 'astar';

export interface SearchNode {
  id: number;
  state: State;
  parent: number;
  depth: number;
  move: Move | null;
}

export type SolverEvent =
  | { type: 'expand'; id: number }
  | { type: 'discover'; id: number; parent: number; depth: number }
  | { type: 'dup'; id: number }
  | { type: 'done'; goalId: number | null };

export interface SolverStats {
  explored: number;
  generated: number;
  duplicates: number;
  maxDepth: number;
}

class MinHeap {
  private ids: number[] = [];
  private pri: number[] = [];

  get size(): number {
    return this.ids.length;
  }

  push(id: number, p: number): void {
    const ids = this.ids;
    const pri = this.pri;
    let i = ids.length;
    ids.push(id);
    pri.push(p);
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (pri[parent] <= pri[i]) break;
      [pri[parent], pri[i]] = [pri[i], pri[parent]];
      [ids[parent], ids[i]] = [ids[i], ids[parent]];
      i = parent;
    }
  }

  pop(): number | undefined {
    const ids = this.ids;
    const pri = this.pri;
    if (ids.length === 0) return undefined;
    const top = ids[0];
    const lastId = ids.pop()!;
    const lastPri = pri.pop()!;
    if (ids.length > 0) {
      ids[0] = lastId;
      pri[0] = lastPri;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let smallest = i;
        if (l < ids.length && pri[l] < pri[smallest]) smallest = l;
        if (r < ids.length && pri[r] < pri[smallest]) smallest = r;
        if (smallest === i) break;
        [pri[smallest], pri[i]] = [pri[i], pri[smallest]];
        [ids[smallest], ids[i]] = [ids[i], ids[smallest]];
        i = smallest;
      }
    }
    return top;
  }
}

export class Solver {
  readonly nodes: SearchNode[] = [];
  readonly stats: SolverStats = { explored: 0, generated: 0, duplicates: 0, maxDepth: 0 };
  done = false;
  goalId: number | null = null;

  private seen = new Map<string, number>();
  private closed = new Set<number>();
  private queue: number[] = [];
  private qHead = 0;
  private heap = new MinHeap();

  constructor(
    readonly start: State,
    readonly algo: Algo,
    readonly allowRotation: boolean,
  ) {
    const root: SearchNode = { id: 0, state: start, parent: -1, depth: 0, move: null };
    this.nodes.push(root);
    this.seen.set(keyOf(start), 0);
    this.push(0);
    if (isSolved(start)) {
      this.done = true;
      this.goalId = 0;
    }
  }

  get frontierSize(): number {
    if (this.algo === 'astar') return this.heap.size;
    if (this.algo === 'dfs') return this.queue.length;
    return this.queue.length - this.qHead;
  }

  private push(id: number): void {
    if (this.algo === 'astar') {
      this.heap.push(id, this.nodes[id].depth + manhattanToGoal(this.nodes[id].state));
    } else {
      this.queue.push(id);
    }
  }

  private pop(): number | undefined {
    if (this.algo === 'astar') {
      // Re-discovered nodes are re-pushed with a better priority, leaving stale
      // entries in the heap; skip any node that was already expanded.
      let id = this.heap.pop();
      while (id !== undefined && this.closed.has(id)) id = this.heap.pop();
      return id;
    }
    if (this.algo === 'dfs') return this.queue.pop();
    return this.qHead < this.queue.length ? this.queue[this.qHead++] : undefined;
  }

  /** Expand one state from the frontier; returns the events that happened. */
  step(): SolverEvent[] {
    if (this.done) return [];
    const events: SolverEvent[] = [];

    const id = this.pop();
    if (id === undefined) {
      this.done = true;
      events.push({ type: 'done', goalId: null });
      return events;
    }

    const node = this.nodes[id];
    this.closed.add(id);
    events.push({ type: 'expand', id });
    this.stats.explored++;

    // A* must check the goal when a state is *expanded*, or optimality is lost.
    if (this.algo === 'astar' && isSolved(node.state)) {
      this.done = true;
      this.goalId = id;
      events.push({ type: 'done', goalId: id });
      return events;
    }

    for (const { state, move } of successors(node.state, this.allowRotation)) {
      this.stats.generated++;
      const key = keyOf(state);
      const existing = this.seen.get(key);
      if (existing !== undefined) {
        // A* may find a *shorter* path to a state that is still in the open list.
        // Unlike BFS (which always discovers states in shortest-path order), A*
        // must adopt the better path or it loses its optimality guarantee.
        if (this.algo === 'astar') {
          const ex = this.nodes[existing];
          if (!this.closed.has(existing) && node.depth + 1 < ex.depth) {
            ex.depth = node.depth + 1;
            ex.parent = id;
            ex.move = move;
            this.push(existing);
          }
        }
        this.stats.duplicates++;
        events.push({ type: 'dup', id: existing });
        continue;
      }

      const child: SearchNode = {
        id: this.nodes.length,
        state,
        parent: id,
        depth: node.depth + 1,
        move,
      };
      this.nodes.push(child);
      this.seen.set(key, child.id);
      if (child.depth > this.stats.maxDepth) this.stats.maxDepth = child.depth;
      events.push({ type: 'discover', id: child.id, parent: id, depth: child.depth });

      // BFS/DFS may stop as soon as the goal is generated (matches the C# solver).
      if (this.algo !== 'astar' && isSolved(state)) {
        this.done = true;
        this.goalId = child.id;
        events.push({ type: 'done', goalId: child.id });
        return events;
      }
      this.push(child.id);
    }
    return events;
  }

  /** Root-to-goal node chain, or null if no solution (yet). */
  path(): SearchNode[] | null {
    if (this.goalId === null) return null;
    const out: SearchNode[] = [];
    for (let id = this.goalId; id !== -1; id = this.nodes[id].parent) {
      out.push(this.nodes[id]);
    }
    return out.reverse();
  }

  /** Run synchronously until done or the expansion cap is hit. Returns true if solved. */
  run(maxExpansions: number): boolean {
    while (!this.done && this.stats.explored < maxExpansions) this.step();
    return this.goalId !== null;
  }
}
