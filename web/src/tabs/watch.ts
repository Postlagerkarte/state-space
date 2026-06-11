// Watch tab: the game's own solver, visualized. Breadth-first search runs on
// the same glide boards you play in Rush and Zen — every dot in the galaxy is
// one board position, colored by how many moves deep the search found it, so
// BFS literally reads as expanding waves. Click any dot to see its board.

import { GraphView } from '../render/graphView';
import { BoardView } from '../render/boardView';
import { glideLayout } from '../render/layouts';
import { GlidePicker, PickedLevel } from '../ui/glidePicker';
import { el, fmt, TabController } from '../ui/dom';
import { GMove, GState, gCloneState, glideRules } from '../core/glide';
import { Solver, SolverEvent } from '../core/solver';

const CODE_LINES = [
  'queue ← [ start position ]',
  'seen ← { start }',
  'while the queue is not empty:',
  '    position ← take the next from the queue',
  '    for every piece and direction:',
  '        glide it until it hits something',
  '        seen this position before? skip it',
  '        goal reached? trace the path back!',
  '        remember it · add it to the queue',
  'queue empty? then it is unsolvable',
];
const LINE_EXPAND = 3;
const LINE_DUP = 6;
const LINE_GOAL = 7;
const LINE_DISCOVER = 8;
const LINE_FAIL = 9;

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
        <div class="panel note big-note">
          The solver plays <b>every possible move</b>, one wave at a time, and
          never looks at the same position twice. Each glowing dot on the right
          is one board position — <b>color = how many moves deep</b>.
        </div>
        <div class="stat-cards">
          <div class="card cyan"><b data-s-explored>0</b><span>positions checked</span></div>
          <div class="card"><b data-s-frontier>0</b><span>waiting in queue</span></div>
          <div class="card red"><b data-s-dups>0</b><span>duplicates skipped</span></div>
          <div class="card gold"><b data-s-wave>0</b><span>moves deep</span></div>
        </div>
        <div class="panel code-panel">
          <h4>Breadth-first search</h4>
          <pre data-code></pre>
        </div>
        <div class="panel board-mini" data-mini></div>
      </aside>
      <div class="canvas-host" data-graph>
        <div class="banner" data-banner>pick a level and press Run</div>
        <div class="legend">
          <span><i class="dot cyan"></i>frontier (queue)</span>
          <span><i class="dot wave"></i>explored, by depth</span>
          <span><i class="dot red"></i>duplicate skipped</span>
          <span><i class="dot gold"></i>solution path</span>
          <span><i class="dot white"></i>looking at now</span>
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
  const sWave = root.querySelector<HTMLElement>('[data-s-wave]')!;

  codePre.innerHTML = CODE_LINES.map(
    (l, i) => `<span class="code-line" data-line="${i}">${l}</span>`,
  ).join('\n');
  const codeLineEls = Array.from(codePre.querySelectorAll<HTMLElement>('.code-line'));

  const picker = new GlidePicker({ defaultId: 'detour' });
  root.querySelector('[data-picker]')!.appendChild(picker.root);

  let graph: GraphView | null = null;
  let mini: BoardView | null = null;
  let solver: Solver<GState, GMove> | null = null;
  let level: PickedLevel | null = null;
  let playing = false;
  let budget = 0;
  let lastExpanded = 0;
  let wave = 0;
  let miniClock = 0;
  let playback: GState[] | null = null;
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
    sWave.textContent = fmt(wave);
  }

  function newRun(): void {
    if (!level) return;
    solver = new Solver(glideRules(level.spec), gCloneState(level.state), 'bfs');
    graph?.reset();
    graph?.addNode(0, -1, 0);
    mini?.setLayout(glideLayout(level.spec));
    mini?.setLevel(level.state);
    setPlaying(false);
    budget = 0;
    lastExpanded = 0;
    wave = 0;
    playback = null;
    setHighlight(-1);
    banner.textContent = `${level.name} — press Run, or Step through one position at a time`;
    updateStats();
  }

  picker.onLevel = (lvl) => {
    level = lvl;
    newRun();
  };

  function onDone(goalId: number | null): void {
    setPlaying(false);
    graph?.setCursor(-1);
    if (!solver) return;
    if (goalId !== null) {
      const path = solver.path()!;
      graph?.tracePath(path.map((n) => n.id));
      setHighlight(LINE_GOAL);
      banner.textContent =
        `solved in ${fmt(path.length - 1)} moves — checked ${fmt(solver.stats.explored)} positions, ` +
        `skipped ${fmt(solver.stats.duplicates)} duplicates · replaying the gold path on the board`;
      playback = path.map((n) => n.state);
      playbackStep = 0;
      playbackClock = 0;
    } else {
      setHighlight(LINE_FAIL);
      banner.textContent = `unsolvable — the solver tried every one of its ${fmt(solver.nodes.length)} reachable positions`;
    }
  }

  function process(events: SolverEvent[]): void {
    for (const evt of events) {
      switch (evt.type) {
        case 'expand':
          graph?.markExpanded(evt.id);
          graph?.setCursor(evt.id);
          lastExpanded = evt.id;
          wave = solver?.nodes[evt.id].depth ?? wave;
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
        if (!solver.done) {
          banner.textContent = `wave ${wave} — ${fmt(solver.stats.explored)} positions explored`;
        }
      }
    }

    // show the position being inspected (throttled so it reads as a flipbook)
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
      if (playbackClock > 0.45) {
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

  // click a node to inspect the position it represents
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
      banner.textContent = `position #${fmt(id)} — ${solver.nodes[id].depth} moves from the start`;
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
        graph.depthWaves = true;
        // mini board needs a layout up front; the picker will set the real one
        mini = null;
        picker.load();
        if (level) {
          mini = new BoardView(miniHost, glideLayout(level.spec), { interactive: false });
          mini.setLevel(level.state);
        }
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
