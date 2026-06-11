// Watch tab: breadth-first search visualized live — the state-space galaxy grows
// node by node while the pseudocode panel and counters show what the algorithm
// is doing. Click any node to inspect the board state it represents.

import { GraphView } from '../render/graphView';
import { BoardView } from '../render/boardView';
import { LevelPicker } from '../ui/levelPicker';
import { el, fmt, TabController } from '../ui/dom';
import { State, cloneState } from '../core/board';
import { Solver, SolverEvent } from '../core/solver';
import { levelById } from '../core/levels';

const CODE_LINES = [
  'frontier ← queue with [start]',
  'seen ← { hash(start) }',
  'while frontier not empty:',
  '    state ← frontier.dequeue()',
  '    for each move of state:',
  '        if move is goal: return path',
  '        h ← hash(move)',
  '        if h ∈ seen: skip      # duplicate',
  '        seen.add(h)',
  '        frontier.enqueue(move)',
  'return "no solution"',
];
const LINE_EXPAND = 3;
const LINE_GOAL = 5;
const LINE_DUP = 7;
const LINE_DISCOVER = 9;
const LINE_FAIL = 10;

export function createWatchTab(): TabController {
  const root = el(`
    <section class="tab tab-watch">
      <aside class="side">
        <div class="panel" data-picker></div>
        <div class="panel">
          <div class="btnrow">
            <button class="btn primary" data-play>▶ Run</button>
            <button class="btn" data-step>Step</button>
            <button class="btn" data-restart>Restart</button>
          </div>
          <label class="slider-row"><span>Speed</span>
            <input type="range" min="0" max="100" value="40" data-speed />
          </label>
        </div>
        <div class="panel code-panel">
          <h4>Breadth-first search</h4>
          <pre data-code></pre>
        </div>
        <div class="panel stat-grid">
          <span class="stat-label">explored</span><span class="stat-value" data-s-explored>0</span>
          <span class="stat-label">frontier</span><span class="stat-value" data-s-frontier>0</span>
          <span class="stat-label">duplicates pruned</span><span class="stat-value" data-s-dups>0</span>
          <span class="stat-label">depth reached</span><span class="stat-value" data-s-depth>0</span>
        </div>
        <div class="panel board-mini" data-mini></div>
        <div class="panel note">
          Without the <b>seen</b> set, every red flash would become a brand-new
          branch — and the search would never finish. Duplicate detection is what
          makes the state space finite.
        </div>
      </aside>
      <div class="canvas-host" data-graph>
        <div class="banner" data-banner>pick a level and press Run</div>
        <div class="legend">
          <span><i class="dot cyan"></i>frontier</span>
          <span><i class="dot indigo"></i>explored</span>
          <span><i class="dot red"></i>duplicate hit</span>
          <span><i class="dot gold"></i>solution path</span>
        </div>
      </div>
    </section>
  `);

  const graphHost = root.querySelector<HTMLElement>('[data-graph]')!;
  const miniHost = root.querySelector<HTMLElement>('[data-mini]')!;
  const banner = root.querySelector<HTMLElement>('[data-banner]')!;
  const codePre = root.querySelector<HTMLElement>('[data-code]')!;
  const playBtn = root.querySelector<HTMLButtonElement>('[data-play]')!;
  const speedInput = root.querySelector<HTMLInputElement>('[data-speed]')!;
  const sExplored = root.querySelector<HTMLElement>('[data-s-explored]')!;
  const sFrontier = root.querySelector<HTMLElement>('[data-s-frontier]')!;
  const sDups = root.querySelector<HTMLElement>('[data-s-dups]')!;
  const sDepth = root.querySelector<HTMLElement>('[data-s-depth]')!;

  codePre.innerHTML = CODE_LINES.map((l, i) => `<span class="code-line" data-line="${i}">${l}</span>`).join('\n');
  const codeLineEls = Array.from(codePre.querySelectorAll<HTMLElement>('.code-line'));

  const picker = new LevelPicker({ defaultId: 'warming-up' });
  root.querySelector('[data-picker]')!.appendChild(picker.root);

  let graph: GraphView | null = null;
  let mini: BoardView | null = null;
  let solver: Solver | null = null;
  let levelState: State = cloneState(levelById('warming-up')!.state);
  let playing = false;
  let budget = 0;
  let lastExpanded = 0;
  let miniClock = 0;
  let playback: State[] | null = null;
  let playbackStep = 0;
  let playbackClock = 0;
  let highlightLine = -1;

  function setHighlight(line: number): void {
    if (line === highlightLine) return;
    highlightLine = line;
    codeLineEls.forEach((elm, i) => elm.classList.toggle('hl', i === line));
  }

  function setPlaying(value: boolean): void {
    playing = value;
    playBtn.textContent = playing ? '⏸ Pause' : '▶ Run';
  }

  function updateStats(): void {
    if (!solver) return;
    sExplored.textContent = fmt(solver.stats.explored);
    sFrontier.textContent = fmt(solver.frontierSize);
    sDups.textContent = fmt(solver.stats.duplicates);
    sDepth.textContent = fmt(solver.stats.maxDepth);
  }

  function newRun(): void {
    solver = new Solver(cloneState(levelState), 'bfs', picker.rotation);
    graph?.reset();
    graph?.addNode(0, -1, 0);
    mini?.setLevel(levelState);
    setPlaying(false);
    budget = 0;
    lastExpanded = 0;
    playback = null;
    setHighlight(-1);
    banner.textContent = `${levelState.length - 1} blockers — press Run, or Step through one expansion at a time`;
    updateStats();
  }

  picker.onLevel = (state) => {
    levelState = state;
    newRun();
  };
  picker.onRotationChange = () => newRun();

  function onDone(goalId: number | null): void {
    setPlaying(false);
    if (!solver) return;
    if (goalId !== null) {
      const path = solver.path()!;
      graph?.tracePath(path.map((n) => n.id));
      setHighlight(LINE_GOAL);
      banner.textContent =
        `solved — ${fmt(path.length - 1)} moves · explored ${fmt(solver.stats.explored)} states · ` +
        `pruned ${fmt(solver.stats.duplicates)} duplicates`;
      playback = path.map((n) => n.state);
      playbackStep = 0;
      playbackClock = 0;
    } else {
      setHighlight(LINE_FAIL);
      banner.textContent = `no solution — the entire reachable space is ${fmt(solver.nodes.length)} states`;
    }
  }

  function process(events: SolverEvent[]): void {
    for (const evt of events) {
      switch (evt.type) {
        case 'expand':
          graph?.markExpanded(evt.id);
          lastExpanded = evt.id;
          setHighlight(LINE_EXPAND);
          break;
        case 'discover':
          graph?.addNode(evt.id, evt.parent, evt.depth);
          setHighlight(LINE_DISCOVER);
          break;
        case 'dup':
          graph?.flash(evt.id);
          setHighlight(LINE_DUP);
          break;
        case 'done':
          onDone(evt.goalId);
          break;
      }
    }
  }

  function expansionsPerSec(): number {
    const v = Number(speedInput.value) / 100;
    return Math.round(Math.pow(10, 0.4 + v * 3.3)); // ~2.5 .. ~5000
  }

  function tick(dt: number): void {
    picker.tick();

    if (playing && solver && !solver.done) {
      if (graph?.full) {
        setPlaying(false);
        banner.textContent = `graph limit reached (${fmt(graph.capacity)} nodes) — try a smaller level`;
      } else {
        budget += expansionsPerSec() * dt;
        let n = Math.min(2500, Math.floor(budget));
        budget -= n;
        while (n-- > 0 && !solver.done) process(solver.step());
        updateStats();
      }
    }

    // show the state being expanded (throttled so it reads as a flipbook)
    if (solver && !solver.done && playing) {
      miniClock += dt;
      if (miniClock > 0.15) {
        miniClock = 0;
        const node = solver.nodes[lastExpanded];
        if (node) mini?.applyState(node.state, expansionsPerSec() < 30);
      }
    }

    if (playback) {
      playbackClock += dt;
      if (playbackClock > 0.28) {
        playbackClock = 0;
        if (playbackStep < playback.length) {
          mini?.applyState(playback[playbackStep], true);
          playbackStep++;
        } else {
          playbackStep = 0; // loop the victory lap
        }
      }
    }

    graph?.frame(dt);
    mini?.frame(dt);
  }

  playBtn.addEventListener('click', () => {
    if (solver?.done) newRun();
    setPlaying(!playing);
  });
  root.querySelector('[data-step]')!.addEventListener('click', () => {
    if (!solver || solver.done) return;
    setPlaying(false);
    process(solver.step());
    updateStats();
    const node = solver.nodes[lastExpanded];
    if (node) mini?.applyState(node.state, true);
  });
  root.querySelector('[data-restart]')!.addEventListener('click', newRun);

  // click a node to inspect the state it represents
  let down: { x: number; y: number } | null = null;
  graphHost.addEventListener('pointerdown', (e) => (down = { x: e.clientX, y: e.clientY }));
  graphHost.addEventListener('pointerup', (e) => {
    if (!down || !graph || !solver) return;
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
    down = null;
    if (moved > 6) return;
    const id = graph.pick(e.clientX, e.clientY);
    if (id !== null && solver.nodes[id]) {
      setPlaying(false);
      playback = null;
      mini?.applyState(solver.nodes[id].state, true);
      banner.textContent = `state #${fmt(id)} — depth ${solver.nodes[id].depth} (${solver.nodes[id].depth} moves from the start)`;
    }
  });

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
        graph = new GraphView(graphHost, { maxNodes: 60_000, bloom: true });
        mini = new BoardView(miniHost, { interactive: false });
        picker.load();
        if (new URLSearchParams(location.search).get('run') === '1') setPlaying(true);
      }
      last = performance.now();
      raf = requestAnimationFrame(loop);
    },
    deactivate() {
      cancelAnimationFrame(raf);
    },
  };
}
