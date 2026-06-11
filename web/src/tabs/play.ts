// Play tab: solve the puzzle yourself, then compare against the BFS optimum.

import { BoardView } from '../render/boardView';
import { LevelPicker } from '../ui/levelPicker';
import { el, fmt, TabController } from '../ui/dom';
import { State, Placement, cloneState, isValidState, isSolved } from '../core/board';
import { pieceDef } from '../core/pieces';
import { Solver } from '../core/solver';
import { LEVELS } from '../core/levels';

const OPTIMAL_CAP = 400_000;

export function createPlayTab(): TabController {
  const root = el(`
    <section class="tab tab-play">
      <div class="canvas-host" data-board>
        <div class="overlay" data-overlay hidden>
          <div class="overlay-card">
            <h2 data-overlay-title>Solved!</h2>
            <p data-overlay-text></p>
            <button class="btn primary" data-overlay-close>Keep exploring</button>
          </div>
        </div>
      </div>
      <aside class="side">
        <div class="panel" data-picker></div>
        <div class="panel stats-row">
          <div><span class="stat-label">Your moves</span><span class="stat-value" data-moves>0</span></div>
          <div><span class="stat-label">Optimal</span><span class="stat-value" data-optimal>…</span></div>
        </div>
        <div class="panel">
          <div class="btnrow">
            <button class="btn" data-reset>Reset</button>
            <button class="btn primary" data-solve>Show optimal</button>
          </div>
          <div class="dpad">
            <span></span><button class="btn dir" data-dir="-8">▲</button><span></span>
            <button class="btn dir" data-dir="-1">◀</button>
            <button class="btn dir rotate" data-rotate title="Rotate (R)">⟳</button>
            <button class="btn dir" data-dir="1">▶</button>
            <span></span><button class="btn dir" data-dir="8">▼</button><span></span>
          </div>
          <p class="hint">Click a piece to select it, then slide with the arrows or arrow keys.
          Bring the <b class="gold">gold block</b> to the glowing corner. ⟳ / R rotates a piece
          (when rotation is enabled).</p>
        </div>
        <div class="panel note">
          Every move you make is one <b>edge</b> in a giant graph of board states.
          “Show optimal” runs breadth-first search over that graph — switch to
          the <b>Watch</b> tab to see it happen.
        </div>
      </aside>
    </section>
  `);

  const boardHost = root.querySelector<HTMLElement>('[data-board]')!;
  const overlay = root.querySelector<HTMLElement>('[data-overlay]')!;
  const overlayTitle = root.querySelector<HTMLElement>('[data-overlay-title]')!;
  const overlayText = root.querySelector<HTMLElement>('[data-overlay-text]')!;
  const movesEl = root.querySelector<HTMLElement>('[data-moves]')!;
  const optimalEl = root.querySelector<HTMLElement>('[data-optimal]')!;

  const picker = new LevelPicker({ defaultId: 'first-steps' });
  root.querySelector('[data-picker]')!.appendChild(picker.root);

  let board: BoardView | null = null;
  let levelState: State = cloneState(LEVELS[0].state);
  let current: State = cloneState(levelState);
  let moves = 0;
  let selected = -1;
  let solvedShown = false;

  let optimalSolver: Solver | null = null;
  let optimal: number | null = null;

  let playbackSolver: Solver | null = null;
  let playback: State[] | null = null;
  let playbackStep = 0;
  let playbackClock = 0;

  function updateStats(): void {
    movesEl.textContent = String(moves);
    optimalEl.textContent =
      optimal !== null ? String(optimal) : optimalSolver ? '…' : '—';
  }

  function recomputeOptimal(): void {
    optimal = null;
    optimalSolver = new Solver(cloneState(levelState), 'bfs', picker.rotation);
    updateStats();
  }

  function reset(): void {
    current = cloneState(levelState);
    moves = 0;
    selected = -1;
    solvedShown = false;
    playback = null;
    playbackSolver = null;
    overlay.hidden = true;
    board?.setLevel(current);
    updateStats();
  }

  picker.onLevel = (state) => {
    levelState = state;
    reset();
    recomputeOptimal();
  };
  picker.onRotationChange = () => recomputeOptimal();

  function win(watched: boolean): void {
    if (solvedShown) return;
    solvedShown = true;
    board?.celebrate();
    overlayTitle.textContent = watched ? 'That was the optimal run' : 'Solved! 🎉';
    overlayText.textContent = watched
      ? `Breadth-first search found this ${fmt(playbackStep)}-move solution — the shortest possible.`
      : optimal !== null
        ? `You did it in ${fmt(moves)} moves — the optimum is ${fmt(optimal)}.`
        : `You did it in ${fmt(moves)} moves.`;
    overlay.hidden = false;
  }

  function commit(next: State): void {
    current = next;
    moves++;
    board?.applyState(current);
    updateStats();
    if (isSolved(current)) win(false);
  }

  function trySlide(delta: number): void {
    if (selected < 0 || playback || playbackSolver) return;
    const p = current[selected];
    const next = current.slice();
    next[selected] = { piece: p.piece, index: p.index + delta };
    if (!isValidState(next)) {
      board?.pulseInvalid(selected);
      return;
    }
    commit(next);
  }

  function tryRotate(): void {
    if (selected < 0 || playback || playbackSolver || !picker.rotation) return;
    const p = current[selected];
    const cycle = pieceDef(p.piece).cycle;
    if (cycle.length < 2) {
      board?.pulseInvalid(selected);
      return;
    }
    const at = cycle.indexOf(p.piece);
    for (let k = 1; k < cycle.length; k++) {
      const name = cycle[(at + k) % cycle.length];
      const next = current.slice();
      next[selected] = { piece: name, index: p.index } as Placement;
      if (isValidState(next)) {
        commit(next);
        return;
      }
    }
    board?.pulseInvalid(selected);
  }

  function showOptimal(): void {
    if (playback || playbackSolver || isSolved(current)) return;
    playbackSolver = new Solver(cloneState(current), 'bfs', picker.rotation);
    selected = -1;
    board?.setSelected(-1);
  }

  root.querySelector('[data-reset]')!.addEventListener('click', reset);
  root.querySelector('[data-solve]')!.addEventListener('click', showOptimal);
  root.querySelector('[data-overlay-close]')!.addEventListener('click', () => {
    overlay.hidden = true;
  });
  root.querySelectorAll<HTMLButtonElement>('[data-dir]').forEach((btn) => {
    btn.addEventListener('click', () => trySlide(Number(btn.dataset.dir)));
  });
  root.querySelector('[data-rotate]')!.addEventListener('click', tryRotate);

  function onKey(e: KeyboardEvent): void {
    const dirs: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -8,
      ArrowDown: 8,
    };
    if (e.key in dirs) {
      e.preventDefault();
      trySlide(dirs[e.key]);
    } else if (e.key === 'r' || e.key === 'R') {
      tryRotate();
    } else if (e.key === 'Escape') {
      selected = -1;
      board?.setSelected(-1);
    }
  }

  function tick(dt: number): void {
    picker.tick();

    // background BFS for the "Optimal" counter
    if (optimalSolver) {
      let n = 4000;
      while (n-- > 0 && !optimalSolver.done && optimalSolver.stats.explored < OPTIMAL_CAP) {
        optimalSolver.step();
      }
      if (optimalSolver.done || optimalSolver.stats.explored >= OPTIMAL_CAP) {
        optimal =
          optimalSolver.goalId !== null
            ? optimalSolver.nodes[optimalSolver.goalId].depth
            : null;
        optimalSolver = null;
        updateStats();
      }
    }

    // background BFS for "Show optimal", then animated playback
    if (playbackSolver) {
      let n = 4000;
      while (n-- > 0 && !playbackSolver.done && playbackSolver.stats.explored < OPTIMAL_CAP) {
        playbackSolver.step();
      }
      if (playbackSolver.done || playbackSolver.stats.explored >= OPTIMAL_CAP) {
        const path = playbackSolver.path();
        playbackSolver = null;
        if (path) {
          playback = path.map((node) => node.state);
          playbackStep = 0;
          playbackClock = 0;
        }
      }
    }
    if (playback) {
      playbackClock += dt;
      if (playbackClock > 0.3) {
        playbackClock = 0;
        playbackStep++;
        if (playbackStep < playback.length) {
          current = cloneState(playback[playbackStep]);
          board?.applyState(current);
        }
        if (playbackStep >= playback.length - 1) {
          playbackStep = playback.length - 1;
          playback = null;
          win(true);
        }
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
        board = new BoardView(boardHost, {
          interactive: true,
          onPieceClick: (idx) => {
            if (playback || playbackSolver) return;
            selected = idx ?? -1;
            board?.setSelected(selected);
          },
        });
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
