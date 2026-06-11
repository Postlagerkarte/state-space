// Race tab: BFS, DFS and A* explore the *same* puzzle side by side.
// Same number of expansions per frame for each — the difference you see
// is purely the search strategy.

import { GraphView } from '../render/graphView';
import { LevelPicker } from '../ui/levelPicker';
import { el, fmt, TabController } from '../ui/dom';
import { Move, State, classicRules, cloneState } from '../core/board';
import { Algo, Solver, SolverEvent } from '../core/solver';
import { levelById } from '../core/levels';

interface RacerSpec {
  algo: Algo;
  name: string;
  blurb: string;
}

const SPECS: RacerSpec[] = [
  {
    algo: 'bfs',
    name: 'Breadth-first',
    blurb: 'Explores level by level. First solution found is guaranteed shortest.',
  },
  {
    algo: 'dfs',
    name: 'Depth-first',
    blurb: 'Dives as deep as possible. Often finds a solution fast — rarely a good one.',
  },
  {
    algo: 'astar',
    name: 'A*',
    blurb: 'BFS steered by a heuristic (hero distance to goal). Optimal, but explores far less.',
  },
];

interface Racer {
  spec: RacerSpec;
  host: HTMLElement;
  graph: GraphView | null;
  solver: Solver<State, Move> | null;
  finished: boolean;
  statusEl: HTMLElement;
  exploredEl: HTMLElement;
  frontierEl: HTMLElement;
  dupsEl: HTMLElement;
  card: HTMLElement;
}

export function createRaceTab(): TabController {
  const root = el(`
    <section class="tab tab-race">
      <div class="panel race-controls">
        <div class="race-picker" data-picker></div>
        <label class="slider-row"><span>Speed</span>
          <input type="range" min="0" max="100" value="55" data-speed />
        </label>
        <div class="btnrow">
          <button class="btn primary" data-start>▶ Start race</button>
          <button class="btn" data-reset>Reset</button>
        </div>
        <p class="rules-badge">runs the <b>classic 2014 sliding rules</b> — their bigger
        state space makes the differences between the algorithms vivid</p>
      </div>
      <div class="race-grid" data-grid></div>
      <div class="panel race-summary" data-summary hidden></div>
    </section>
  `);

  const grid = root.querySelector<HTMLElement>('[data-grid]')!;
  const summaryEl = root.querySelector<HTMLElement>('[data-summary]')!;
  const startBtn = root.querySelector<HTMLButtonElement>('[data-start]')!;
  const speedInput = root.querySelector<HTMLInputElement>('[data-speed]')!;

  const picker = new LevelPicker({ defaultId: 'heuristics-delight' });
  root.querySelector('[data-picker]')!.appendChild(picker.root);

  const racers: Racer[] = SPECS.map((spec) => {
    const card = el(`
      <div class="racer panel">
        <header>
          <h3>${spec.name}</h3>
          <p>${spec.blurb}</p>
        </header>
        <div class="canvas-host racer-host" data-host></div>
        <div class="racer-stats">
          <span class="stat-label">explored</span><span class="stat-value" data-explored>0</span>
          <span class="stat-label">frontier</span><span class="stat-value" data-frontier>0</span>
          <span class="stat-label">pruned</span><span class="stat-value" data-dups>0</span>
        </div>
        <div class="racer-status" data-status>waiting…</div>
      </div>
    `);
    grid.appendChild(card);
    return {
      spec,
      card,
      host: card.querySelector<HTMLElement>('[data-host]')!,
      graph: null,
      solver: null,
      finished: false,
      statusEl: card.querySelector<HTMLElement>('[data-status]')!,
      exploredEl: card.querySelector<HTMLElement>('[data-explored]')!,
      frontierEl: card.querySelector<HTMLElement>('[data-frontier]')!,
      dupsEl: card.querySelector<HTMLElement>('[data-dups]')!,
    };
  });

  let levelState: State = cloneState(levelById('heuristics-delight')!.state);
  let running = false;
  let budget = 0;
  let finishOrder = 0;

  function resetRace(): void {
    running = false;
    budget = 0;
    finishOrder = 0;
    summaryEl.hidden = true;
    startBtn.textContent = '▶ Start race';
    for (const r of racers) {
      r.solver = null;
      r.finished = false;
      r.graph?.reset();
      r.statusEl.textContent = 'waiting…';
      r.card.classList.remove('winner');
      r.exploredEl.textContent = '0';
      r.frontierEl.textContent = '0';
      r.dupsEl.textContent = '0';
    }
  }

  picker.onLevel = (state) => {
    levelState = state;
    resetRace();
  };
  picker.onRotationChange = () => resetRace();

  function startRace(): void {
    resetRace();
    for (const r of racers) {
      r.solver = new Solver(classicRules(picker.rotation), cloneState(levelState), r.spec.algo);
      r.graph?.addNode(0, -1, 0);
      r.statusEl.textContent = 'searching…';
    }
    running = true;
    startBtn.textContent = '⏸ Pause';
  }

  function finish(r: Racer, goalId: number | null): void {
    r.finished = true;
    finishOrder++;
    if (!r.solver) return;
    if (goalId !== null) {
      const path = r.solver.path()!;
      r.graph?.tracePath(path.map((n) => n.id));
      const medal = finishOrder === 1 ? '🥇 ' : finishOrder === 2 ? '🥈 ' : '🥉 ';
      r.statusEl.textContent =
        `${medal}solution: ${fmt(path.length - 1)} moves · ${fmt(r.solver.stats.explored)} states explored`;
      if (finishOrder === 1) r.card.classList.add('winner');
    } else {
      r.statusEl.textContent = `✗ no solution (${fmt(r.solver.nodes.length)} states)`;
    }
    if (racers.every((x) => x.finished)) {
      running = false;
      startBtn.textContent = '▶ Start race';
      showSummary();
    }
  }

  function showSummary(): void {
    const bfs = racers.find((r) => r.spec.algo === 'bfs')!;
    const dfs = racers.find((r) => r.spec.algo === 'dfs')!;
    const astar = racers.find((r) => r.spec.algo === 'astar')!;
    const len = (r: Racer) =>
      r.solver?.goalId != null ? r.solver.nodes[r.solver.goalId].depth : null;
    const bfsLen = len(bfs);
    const dfsLen = len(dfs);
    const astarLen = len(astar);
    if (bfsLen === null) {
      summaryEl.textContent = 'No algorithm found a solution — this board is unsolvable.';
    } else {
      const saved = bfs.solver!.stats.explored / Math.max(1, astar.solver!.stats.explored);
      summaryEl.innerHTML =
        `<b>The takeaway:</b> BFS guarantees the shortest solution (${fmt(bfsLen)} moves) but had to explore ` +
        `${fmt(bfs.solver!.stats.explored)} states. A* found the <i>same</i> ${fmt(astarLen ?? bfsLen)}-move solution ` +
        `after only ${fmt(astar.solver!.stats.explored)} states — ${saved.toFixed(1)}× less work, thanks to the heuristic. ` +
        (dfsLen !== null
          ? `DFS needed just ${fmt(dfs.solver!.stats.explored)} states to find <i>a</i> solution — but it is ` +
            `${fmt(dfsLen)} moves long (${(dfsLen / bfsLen).toFixed(1)}× the optimum). Fast to find, terrible to follow.`
          : `DFS found no solution.`);
    }
    summaryEl.hidden = false;
  }

  function process(r: Racer, events: SolverEvent[]): void {
    for (const evt of events) {
      switch (evt.type) {
        case 'expand':
          r.graph?.markExpanded(evt.id);
          break;
        case 'discover':
          r.graph?.addNode(evt.id, evt.parent, evt.depth);
          break;
        case 'dup':
          r.graph?.flash(evt.id);
          break;
        case 'done':
          finish(r, evt.goalId);
          break;
      }
    }
  }

  function expansionsPerSec(): number {
    const v = Number(speedInput.value) / 100;
    return Math.round(Math.pow(10, 1 + v * 2.7)); // ~10 .. ~5000
  }

  function tick(dt: number): void {
    picker.tick();

    if (running) {
      budget += expansionsPerSec() * dt;
      let n = Math.min(1500, Math.floor(budget));
      budget -= n;
      while (n-- > 0) {
        let active = false;
        for (const r of racers) {
          if (!r.solver || r.finished || r.solver.done) continue;
          if (r.graph?.full) {
            r.finished = true;
            r.statusEl.textContent = `graph limit (${fmt(r.graph.capacity)} nodes) reached`;
            continue;
          }
          active = true;
          process(r, r.solver.step());
        }
        if (!active) break;
      }
      for (const r of racers) {
        if (!r.solver) continue;
        r.exploredEl.textContent = fmt(r.solver.stats.explored);
        r.frontierEl.textContent = fmt(r.solver.frontierSize);
        r.dupsEl.textContent = fmt(r.solver.stats.duplicates);
      }
    }

    for (const r of racers) r.graph?.frame(dt);
  }

  startBtn.addEventListener('click', () => {
    if (racers.every((r) => !r.solver)) {
      startRace();
    } else if (racers.every((r) => r.finished)) {
      startRace();
    } else {
      running = !running;
      startBtn.textContent = running ? '⏸ Pause' : '▶ Resume';
    }
  });
  root.querySelector('[data-reset]')!.addEventListener('click', resetRace);

  let raf = 0;
  let last = 0;
  let built = false;

  function loop(t: number): void {
    raf = requestAnimationFrame(loop);
    const dt = Math.min(0.05, (t - last) / 1000);
    last = t;
    tick(dt);
  }

  return {
    root,
    activate() {
      if (!built) {
        built = true;
        for (const r of racers) {
          r.graph = new GraphView(r.host, { maxNodes: 30_000, bloom: false });
        }
        picker.load();
        if (new URLSearchParams(location.search).get('run') === '1') startRace();
      }
      last = performance.now();
      raf = requestAnimationFrame(loop);
    },
    deactivate() {
      cancelAnimationFrame(raf);
    },
  };
}
