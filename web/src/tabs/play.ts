// Play tab — glide rules: drag a piece and it flies until it hits something.
// Park the gold block exactly on the glowing pad. Par comes from the BFS
// solver; stars reward matching it.

import { BoardView } from '../render/boardView';
import { glideLayout } from '../render/layouts';
import { el, TabController } from '../ui/dom';
import { GlidePicker, PickedLevel, setStars } from '../ui/glidePicker';
import { GMove, GState, gCloneState, gIsSolved, glideMove, glideRules } from '../core/glide';
import { Solver } from '../core/solver';
import * as sound from '../game/sound';

export function createPlayTab(): TabController {
  const root = el(`
    <section class="tab tab-play">
      <div class="canvas-host" data-board>
        <div class="overlay" data-overlay hidden>
          <div class="overlay-card">
            <div class="stars" data-stars></div>
            <h2 data-overlay-title>Level clear!</h2>
            <p data-overlay-text></p>
            <div class="btnrow center">
              <button class="btn" data-replay>Replay</button>
              <button class="btn primary" data-next>Next level</button>
            </div>
          </div>
        </div>
        <div class="toast" data-toast hidden>
          ⚠ No path to the goal from here — <button class="btn-link" data-toast-undo>undo</button>
        </div>
      </div>
      <aside class="side">
        <div class="panel" data-picker></div>
        <div class="panel stats-row">
          <div><span class="stat-label">Your moves</span><span class="stat-value" data-moves>0</span></div>
          <div><span class="stat-label">Par</span><span class="stat-value" data-par>—</span></div>
        </div>
        <div class="panel">
          <div class="btnrow">
            <button class="btn" data-undo title="Undo (Ctrl+Z)">↶ Undo</button>
            <button class="btn" data-hint title="Show the next optimal move">💡 Hint</button>
            <button class="btn" data-reset>Reset</button>
            <button class="btn" data-mute title="Toggle sound"></button>
          </div>
          <p class="hint"><b>Drag a piece</b> — it glides until it hits something.
          Park the <b class="gold">gold block</b> so it covers the glowing pad exactly;
          if nothing stops it there, it flies right past. Arrow keys move the
          selected piece.</p>
        </div>
        <div class="panel note">
          Par is computed live by breadth-first search — every level you play is a
          state-space the solver has already conquered. Watch it work in the
          <b>Watch</b> tab.
        </div>
      </aside>
    </section>
  `);

  const boardHost = root.querySelector<HTMLElement>('[data-board]')!;
  const overlay = root.querySelector<HTMLElement>('[data-overlay]')!;
  const overlayTitle = root.querySelector<HTMLElement>('[data-overlay-title]')!;
  const overlayText = root.querySelector<HTMLElement>('[data-overlay-text]')!;
  const starsEl = root.querySelector<HTMLElement>('[data-stars]')!;
  const movesEl = root.querySelector<HTMLElement>('[data-moves]')!;
  const parEl = root.querySelector<HTMLElement>('[data-par]')!;
  const muteBtn = root.querySelector<HTMLButtonElement>('[data-mute]')!;

  const picker = new GlidePicker();
  root.querySelector('[data-picker]')!.appendChild(picker.root);

  const toast = root.querySelector<HTMLElement>('[data-toast]')!;

  let board: BoardView | null = null;
  let level: PickedLevel | null = null;
  let current: GState = [];
  let history: GState[] = [];
  let selected = -1;
  let hintsUsed = false;
  let solvedShown = false;

  // The melody mechanic: after each move a background BFS recomputes the true
  // distance to the goal. Moves that bring the hero closer play the next note
  // of an ascending pentatonic ladder — optimal play is literally a tune.
  // The same solver result powers the "this position is dead" toast.
  let distSolver: Solver<GState, GMove> | null = null;
  let prevDist: number | null = null;
  let baseDist = 0;
  let impactAt = 0; // wall-clock ms when the current glide lands (for note timing)

  function startDistCheck(): void {
    if (!level) return;
    distSolver = new Solver(glideRules(level.spec), gCloneState(current), 'bfs');
  }

  function handleDistance(d: number): void {
    if (!Number.isFinite(d)) {
      toast.hidden = false;
      prevDist = Infinity;
      return;
    }
    toast.hidden = true;
    if (prevDist !== null && d < prevDist && !solvedShown) {
      const note = Math.max(1, baseDist - d);
      const delay = Math.max(0, impactAt - performance.now() + 90);
      setTimeout(() => sound.melodyNote(note), delay);
    }
    prevDist = d;
  }

  function updateMoves(): void {
    movesEl.textContent = String(history.length - 1);
  }

  function updateMuteLabel(): void {
    muteBtn.textContent = sound.isMuted() ? '🔇' : '🔊';
  }
  updateMuteLabel();

  // -- drag-to-glide input ---------------------------------------------------

  let drag: { pieceIdx: number; x: number; y: number; committed: boolean } | null = null;

  function attachPointer(bv: BoardView): void {
    const canvas = bv.domElement;
    // capture phase so we can disable orbiting before OrbitControls sees the event
    canvas.addEventListener(
      'pointerdown',
      (e) => {
        const idx = bv.pickAt(e.clientX, e.clientY);
        if (idx === null) {
          selected = -1;
          bv.setSelected(-1);
          return;
        }
        selected = idx;
        bv.setSelected(idx);
        drag = { pieceIdx: idx, x: e.clientX, y: e.clientY, committed: false };
        bv.setOrbitEnabled(false);
        canvas.setPointerCapture(e.pointerId);
      },
      { capture: true },
    );
    canvas.addEventListener('pointermove', (e) => {
      if (!drag || drag.committed) return;
      const dx = e.clientX - drag.x;
      const dy = e.clientY - drag.y;
      if (Math.hypot(dx, dy) < 22) return;
      // map the screen-space drag onto the board axes (works at any camera angle)
      const axes = bv.screenAxes();
      const candidates: [number, number, { x: number; y: number }][] = [
        [0, 1, axes.x],
        [0, -1, { x: -axes.x.x, y: -axes.x.y }],
        [1, 0, axes.z],
        [-1, 0, { x: -axes.z.x, y: -axes.z.y }],
      ];
      let bestDr = 0;
      let bestDc = 1;
      let bestDot = -Infinity;
      for (const [dr, dc, v] of candidates) {
        const len = Math.hypot(v.x, v.y) || 1;
        const dot = (dx * v.x + dy * v.y) / len;
        if (dot > bestDot) {
          bestDot = dot;
          bestDr = dr;
          bestDc = dc;
        }
      }
      drag.committed = true;
      tryGlide(drag.pieceIdx, bestDr, bestDc);
    });
    const release = () => {
      if (drag) {
        drag = null;
        bv.setOrbitEnabled(true);
      }
    };
    canvas.addEventListener('pointerup', release);
    canvas.addEventListener('pointercancel', release);
  }

  // -- game logic --------------------------------------------------------------

  function loadLevel(lvl: PickedLevel): void {
    level = lvl;
    board?.dispose();
    board = new BoardView(boardHost, glideLayout(lvl.spec), { interactive: true });
    attachPointer(board);
    current = gCloneState(lvl.state);
    history = [gCloneState(lvl.state)];
    selected = -1;
    hintsUsed = false;
    solvedShown = false;
    overlay.hidden = true;
    toast.hidden = true;
    distSolver = null;
    baseDist = lvl.optimal;
    prevDist = lvl.optimal;
    board.setLevel(current);
    parEl.textContent = String(lvl.optimal);
    updateMoves();
  }

  function tryGlide(pieceIdx: number, dr: number, dc: number): void {
    if (!level || !board || solvedShown) return;
    const slid = glideMove(level.spec, current, pieceIdx, dr, dc);
    if (!slid) {
      board.pulseInvalid(pieceIdx);
      sound.blocked();
      return;
    }
    current = slid.state;
    history.push(gCloneState(current));
    board.clearHint();
    toast.hidden = true;
    const dur = board.applyState(current);
    sound.whoosh(slid.dist);
    const bv = board;
    impactAt = performance.now() + dur * 1000;
    setTimeout(() => sound.thunk(Math.min(1, slid.dist / 6)), Math.max(0, dur * 1000 - 40));
    updateMoves();

    if (gIsSolved(level.spec, current)) {
      solvedShown = true;
      distSolver = null;
      // the melody's top note lands with the final impact, then resolves
      setTimeout(() => sound.melodyNote(baseDist), Math.max(0, dur * 1000 - 10));
      setTimeout(() => {
        bv.celebrate();
        sound.winJingle();
      }, dur * 1000 + 140);
      setTimeout(() => showWin(), dur * 1000 + 750);
    } else {
      startDistCheck();
    }
  }

  function showWin(): void {
    if (!level) return;
    const moves = history.length - 1;
    let stars = moves <= level.optimal ? 3 : moves <= level.optimal + 2 ? 2 : 1;
    if (hintsUsed && stars > 2) stars = 2;
    starsEl.innerHTML = [0, 1, 2]
      .map((i) => {
        const filled = i < stars;
        return `<span class="star ${filled ? '' : 'empty'}" style="animation-delay:${0.15 + i * 0.22}s">${filled ? '★' : '☆'}</span>`;
      })
      .join('');
    for (let i = 0; i < stars; i++) {
      setTimeout(() => sound.thunk(0.45 + i * 0.25), (0.15 + i * 0.22) * 1000 + 200);
    }
    overlayTitle.textContent = stars === 3 ? 'Perfect!' : 'Level clear!';
    overlayText.textContent =
      `${moves} ${moves === 1 ? 'move' : 'moves'} · par ${level.optimal}` +
      (hintsUsed ? ' · hint used' : '');
    if (level.id !== 'random') {
      setStars(level.id, stars);
      picker.refresh();
    }
    overlay.hidden = false;
  }

  function undo(): void {
    if (history.length < 2 || solvedShown || !board) return;
    history.pop();
    current = gCloneState(history[history.length - 1]);
    board.clearHint();
    toast.hidden = true;
    board.applyState(current);
    updateMoves();
    // recompute the distance silently so the melody baseline stays honest
    prevDist = null;
    startDistCheck();
  }

  function hint(): void {
    if (!level || !board || solvedShown) return;
    const solver = new Solver(glideRules(level.spec), gCloneState(current), 'bfs');
    solver.run(80_000);
    const path = solver.path();
    if (!path || path.length < 2) {
      board.pulseInvalid(0);
      sound.blocked();
      return;
    }
    const move = path[1].move as GMove;
    hintsUsed = true;
    selected = move.pieceIdx;
    board.setSelected(selected);
    board.showHint(move.pieceIdx, move.dr, move.dc);
  }

  function reset(): void {
    if (level) loadLevel({ ...level, state: gCloneState(history[0]) });
  }

  picker.onLevel = loadLevel;
  root.querySelector('[data-toast-undo]')!.addEventListener('click', undo);
  root.querySelector('[data-undo]')!.addEventListener('click', undo);
  root.querySelector('[data-hint]')!.addEventListener('click', hint);
  root.querySelector('[data-reset]')!.addEventListener('click', reset);
  muteBtn.addEventListener('click', () => {
    sound.toggleMute();
    updateMuteLabel();
  });
  root.querySelector('[data-replay]')!.addEventListener('click', reset);
  root.querySelector('[data-next]')!.addEventListener('click', () => picker.selectNext());

  function onKey(e: KeyboardEvent): void {
    if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) {
      e.preventDefault();
      undo();
      return;
    }
    const dirs: Record<string, [number, number]> = {
      ArrowLeft: [0, -1],
      ArrowRight: [0, 1],
      ArrowUp: [-1, 0],
      ArrowDown: [1, 0],
    };
    if (e.key in dirs) {
      e.preventDefault();
      if (selected >= 0) tryGlide(selected, dirs[e.key][0], dirs[e.key][1]);
    } else if (e.key === 'Escape') {
      selected = -1;
      board?.setSelected(-1);
    }
  }

  function tick(dt: number): void {
    picker.tick();

    // pump the background distance solver a few thousand expansions per frame
    if (distSolver) {
      let n = 4000;
      while (n-- > 0 && !distSolver.done && distSolver.stats.explored < 150_000) {
        distSolver.step();
      }
      if (distSolver.done) {
        const d =
          distSolver.goalId !== null ? distSolver.nodes[distSolver.goalId].depth : Infinity;
        distSolver = null;
        handleDistance(d);
      } else if (distSolver.stats.explored >= 150_000) {
        // state space too large to judge — stay silent rather than guess
        distSolver = null;
        prevDist = null;
      }
    }

    board?.frame(dt);
  }

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
        picker.load();
      }
      window.addEventListener('keydown', onKey);
      last = performance.now();
      raf = requestAnimationFrame(loop);
    },
    deactivate() {
      window.removeEventListener('keydown', onKey);
      cancelAnimationFrame(raf);
    },
  };
}
