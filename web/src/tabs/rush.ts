// ⚡ Rush mode: an endless run of generated boards against a draining time bank.
// Solve fast → time refunds, combo multipliers, key-shifting melody, score.
// The generator + BFS solver mint difficulty-calibrated boards live during play —
// an infinitely long, perfectly ramped flow channel.

import { BoardView } from '../render/boardView';
import { glideLayout } from '../render/layouts';
import { el, fmt, TabController } from '../ui/dom';
import {
  GLIDE_DIRS,
  GMove,
  GState,
  GlideLevel,
  GlideLevelSearch,
  GlideGenOptions,
  gCloneState,
  gIsSolved,
  glideMove,
  glideRules,
} from '../core/glide';
import { gKey } from '../core/glide';
import { mulberry32 } from '../core/generator';
import { Solver } from '../core/solver';
import { AssistEvaluator } from '../game/assist';
import * as sound from '../game/sound';

const BANK_START = 25;
const BANK_CAP = 40;
const PREVIEW_DELAY_MS = 2500;
const ASSIST_DELAY_MS = 6500;
const FREEZE_SECONDS = 5;
const BOOSTER_CAP = 3;
const CLUTCH_WINDOW = 2; // seconds left for a clutch bonus
const TIER_THRESHOLDS = [3, 7, 13, 21, 31]; // must match difficulty()
const BEST_KEY = 'statespace.rush.best';

type Booster = 'bomb' | 'freeze';

function tierOf(solved: number): number {
  return 1 + TIER_THRESHOLDS.filter((t) => solved >= t).length;
}

function difficulty(solved: number): GlideGenOptions {
  if (solved < 3) return { blockers: 1, minOptimal: 1, maxOptimal: 2, maxStates: 10_000 };
  if (solved < 7) return { blockers: 2, minOptimal: 2, maxOptimal: 3, maxStates: 15_000 };
  if (solved < 13) return { blockers: 3, minOptimal: 3, maxOptimal: 4, maxStates: 25_000 };
  if (solved < 21) return { blockers: 4, minOptimal: 4, maxOptimal: 5, maxStates: 40_000 };
  if (solved < 31) return { blockers: 5, minOptimal: 5, maxOptimal: 7, maxStates: 60_000 };
  return { blockers: 6, minOptimal: 6, maxOptimal: 9, maxStates: 80_000 };
}

interface Best {
  score: number;
  boards: number;
}

function loadBest(): Best {
  try {
    return JSON.parse(localStorage.getItem(BEST_KEY) ?? '{"score":0,"boards":0}') as Best;
  } catch {
    return { score: 0, boards: 0 };
  }
}

export function createRushTab(): TabController {
  const root = el(`
    <section class="tab tab-rush">
      <div class="canvas-host rush-host" data-board>
        <div class="rush-hud" data-hud hidden>
          <div class="time-bar"><div class="time-fill" data-time-fill></div></div>
          <div class="rush-stats-row">
            <div class="rush-score" data-score>0</div>
            <div class="combo-badge" data-combo hidden>×1</div>
            <div class="rush-boards-wrap">
              <div class="rush-boards" data-boards>board 1</div>
              <div class="rush-pacer" data-pacer hidden></div>
            </div>
            <div class="booster-row" data-boosters></div>
            <button class="btn rush-skip" data-skip title="Skip this board (-5s, breaks combo)">SKIP −5s</button>
          </div>
        </div>
        <div class="mining-note" data-mining hidden>⛏ mining next board…</div>
        <div class="mining-note target-note" data-target-note hidden>💣 click a blocker to destroy it — Esc to cancel</div>
        <div class="vignette" data-vignette></div>
        <div class="popups" data-popups></div>

        <div class="overlay" data-start>
          <div class="overlay-card rush-card">
            <h2>⚡ Rush</h2>
            <p>Endless boards, one draining clock.<br/>
            Solving refunds time — harder boards refund more.<br/>
            Stay at par to build your combo — milestones earn boosters.</p>
            <p class="rush-best" data-best-line></p>
            <div class="btnrow center">
              <button class="btn primary big" data-start-btn>▶ &nbsp;START RUN</button>
            </div>
          </div>
        </div>

        <div class="overlay" data-death hidden>
          <div class="overlay-card rush-card">
            <div class="newbest" data-newbest hidden>🏆 NEW BEST</div>
            <h2 data-final-score>0</h2>
            <p data-death-stats></p>
            <div class="btnrow center">
              <button class="btn primary big" data-again>⚡ &nbsp;RUN AGAIN</button>
              <button class="btn" data-zen>🧘 practice in Zen</button>
            </div>
            <p class="press-r">press <b>R</b> to run again</p>
          </div>
        </div>
      </div>
    </section>
  `);

  const boardHost = root.querySelector<HTMLElement>('[data-board]')!;
  const hud = root.querySelector<HTMLElement>('[data-hud]')!;
  const timeFill = root.querySelector<HTMLElement>('[data-time-fill]')!;
  const scoreEl = root.querySelector<HTMLElement>('[data-score]')!;
  const comboEl = root.querySelector<HTMLElement>('[data-combo]')!;
  const boardsEl = root.querySelector<HTMLElement>('[data-boards]')!;
  const miningEl = root.querySelector<HTMLElement>('[data-mining]')!;
  const vignette = root.querySelector<HTMLElement>('[data-vignette]')!;
  const popupsEl = root.querySelector<HTMLElement>('[data-popups]')!;
  const startOverlay = root.querySelector<HTMLElement>('[data-start]')!;
  const bestLine = root.querySelector<HTMLElement>('[data-best-line]')!;
  const deathOverlay = root.querySelector<HTMLElement>('[data-death]')!;
  const newBestEl = root.querySelector<HTMLElement>('[data-newbest]')!;
  const finalScoreEl = root.querySelector<HTMLElement>('[data-final-score]')!;
  const deathStatsEl = root.querySelector<HTMLElement>('[data-death-stats]')!;
  const boostersEl = root.querySelector<HTMLElement>('[data-boosters]')!;
  const pacerEl = root.querySelector<HTMLElement>('[data-pacer]')!;
  const targetNote = root.querySelector<HTMLElement>('[data-target-note]')!;

  let board: BoardView | null = null;
  let phase: 'idle' | 'running' | 'transition' | 'dead' = 'idle';
  let level: GlideLevel | null = null;
  let current: GState = [];
  let movesThisBoard = 0;
  let solvedCount = 0;
  let bank = BANK_START;
  let score = 0;
  let combo = 1;
  let maxCombo = 1;
  let selected = -1;
  let hoverIdx = -1;
  let previewsShown = false;
  let lastMoveAt = 0;
  let lastTickSecond = -1;
  let impactAt = 0;

  // board pipeline: generated in the background during play
  let pending: GlideLevel[] = [];
  let search: GlideLevelSearch | null = null;
  let searchFor = -1;

  // dead-end detection + great-move reward
  let distSolver: Solver<GState, GMove> | null = null;
  let prevDist: number | null = null;
  let lastMove: { pieceIdx: number; dist: number } | null = null;

  // boosters
  let boosters: Booster[] = [];
  let freezeLeft = 0;
  let bombArmed = false;
  let lastTier = 1;
  let bestCache: Best = loadBest();

  // stage-2 assist (warm/fatal shimmer on the previews)
  let assist: AssistEvaluator | null = null;
  let decoratedToken = '';

  function assistToken(): string {
    const idx = hoverIdx >= 0 ? hoverIdx : selected;
    return `${gKey(current)}|${idx}`;
  }

  function updateHud(): void {
    scoreEl.textContent = fmt(score);
    boardsEl.textContent = `board ${solvedCount + 1}`;
    if (combo > 1) {
      comboEl.hidden = false;
      comboEl.textContent = `×${combo}`;
    } else {
      comboEl.hidden = true;
    }
    // best-run pacer: racing your own ghost
    if (bestCache.boards > 0) {
      pacerEl.hidden = false;
      if (solvedCount + 1 > bestCache.boards) {
        pacerEl.textContent = 'past your best!';
        pacerEl.className = 'rush-pacer gold';
      } else {
        pacerEl.textContent = `best: board ${bestCache.boards}`;
        pacerEl.className =
          bestCache.boards - (solvedCount + 1) <= 2 ? 'rush-pacer warm' : 'rush-pacer';
      }
    } else {
      pacerEl.hidden = true;
    }
  }

  function renderBoosters(): void {
    boostersEl.innerHTML = boosters
      .map(
        (b, i) =>
          `<button class="booster-chip" data-use="${i}" title="${
            b === 'bomb' ? 'Bomb: destroy a blocker' : `Freeze: stop the clock ${FREEZE_SECONDS}s`
          } (key ${i + 1})">${b === 'bomb' ? '💣' : '⏱'}<span>${i + 1}</span></button>`,
      )
      .join('');
  }

  function cancelBombTargeting(): void {
    if (!bombArmed) return;
    bombArmed = false;
    targetNote.hidden = true;
    board?.setTargeting(false);
    if (board) board.domElement.style.cursor = 'default';
  }

  function useBooster(i: number): void {
    if (phase !== 'running' || i >= boosters.length) return;
    const booster = boosters[i];
    if (booster === 'freeze') {
      boosters.splice(i, 1);
      renderBoosters();
      cancelBombTargeting();
      freezeLeft = FREEZE_SECONDS;
      sound.freeze();
      popup(`⏱ frozen ${FREEZE_SECONDS}s`, 'cyan');
    } else {
      // bomb: arm targeting; consumed only when it actually detonates
      cancelBombTargeting();
      bombArmed = true;
      targetNote.hidden = false;
      board?.setTargeting(true);
      if (board) board.domElement.style.cursor = 'crosshair';
    }
  }

  function detonate(pieceIdx: number): void {
    if (!board || !level || pieceIdx <= 0) return;
    const slot = boosters.indexOf('bomb');
    if (slot === -1) return;
    boosters.splice(slot, 1);
    renderBoosters();
    cancelBombTargeting();
    current = current.filter((_, i) => i !== pieceIdx);
    selected = -1;
    hoverIdx = -1;
    board.removePiece(pieceIdx);
    sound.boom();
    decoratedToken = '';
    assist = null;
    // the board changed materially — re-judge it (this is where a bad bomb
    // gets caught: blowing up your own backstop triggers the dead-end skip)
    prevDist = null;
    startDistCheck();
  }

  function earnBooster(): void {
    if (boosters.length >= BOOSTER_CAP) {
      const consolation = 250 * combo;
      score += consolation;
      popup(`+${fmt(consolation)} (pockets full)`, 'gold small');
      return;
    }
    const booster: Booster = Math.random() < 0.55 ? 'bomb' : 'freeze';
    boosters.push(booster);
    renderBoosters();
    sound.boosterEarn();
    popup(`${booster === 'bomb' ? '💣 BOMB' : '⏱ FREEZE'} earned!`, 'cyan');
  }

  function popup(text: string, cls = ''): void {
    const p = el(`<div class="popup ${cls}">${text}</div>`);
    p.style.left = `${38 + Math.random() * 24}%`;
    p.style.top = `${34 + Math.random() * 14}%`;
    popupsEl.appendChild(p);
    p.addEventListener('animationend', () => p.remove());
  }

  // -- board pipeline ----------------------------------------------------------

  function pumpGeneration(): void {
    const needFor = solvedCount + 1 + pending.length;
    if (pending.length >= 2) return;
    if (!search || searchFor !== needFor) {
      search = new GlideLevelSearch(
        mulberry32((Date.now() ^ ((Math.random() * 0xffffff) | 0)) >>> 0),
        difficulty(needFor - 1),
      );
      searchFor = needFor;
    }
    const found = search.tick(2);
    if (found) {
      pending.push(found);
      search = null;
    }
  }

  function loadBoard(lvl: GlideLevel, transition: boolean): void {
    level = lvl;
    current = gCloneState(lvl.state);
    movesThisBoard = 0;
    prevDist = lvl.optimal;
    lastMove = null;
    distSolver = null;
    selected = -1;
    hoverIdx = -1;
    lastMoveAt = performance.now();
    const layout = glideLayout(lvl.spec);
    if (!board) {
      board = new BoardView(boardHost, layout, { interactive: true });
      attachPointer(board);
      board.setLevel(current);
    } else if (transition) {
      board.transitionTo(gCloneState(lvl.state), layout);
    } else {
      board.setLayout(layout);
      board.setLevel(current);
    }
    updateHud();
  }

  function nextBoard(): void {
    const lvl = pending.shift();
    if (!lvl) {
      // generator hasn't caught up — pause the drain and show the mining note
      miningEl.hidden = false;
      return;
    }
    miningEl.hidden = true;
    loadBoard(lvl, true);
    const tier = tierOf(solvedCount);
    if (tier > lastTier) {
      lastTier = tier;
      popup(`TIER ${tier}`, 'big gold');
      sound.tierUp();
      window.setTimeout(() => board?.fanfareRing(), 250);
    }
    window.setTimeout(() => {
      if (phase === 'transition') phase = 'running';
    }, 420);
  }

  // -- run lifecycle -----------------------------------------------------------

  function startRun(): void {
    pending = [];
    search = null;
    searchFor = -1;
    solvedCount = 0;
    score = 0;
    combo = 1;
    maxCombo = 1;
    boosters = [];
    freezeLeft = 0;
    lastTier = 1;
    bestCache = loadBest();
    assist = null;
    decoratedToken = '';
    cancelBombTargeting();
    renderBoosters();
    const bankParam = Number(new URLSearchParams(location.search).get('bank'));
    bank = Number.isFinite(bankParam) && bankParam > 0 ? bankParam : BANK_START;
    lastTickSecond = -1;
    startOverlay.hidden = true;
    deathOverlay.hidden = true;
    hud.hidden = false;

    // first board synchronously — warmup boards generate in milliseconds
    const first = new GlideLevelSearch(
      mulberry32((Date.now() ^ 0x9e3779b9) >>> 0),
      difficulty(0),
    ).runSync(10_000);
    if (!first) return; // practically impossible; keeps types honest
    loadBoard(first, board !== null);
    phase = 'running';
    updateHud();
  }

  function die(): void {
    phase = 'dead';
    sound.gameOver();
    cancelBombTargeting();
    board?.clearPreviews();
    const best = loadBest();
    const isBest = score > best.score;
    if (isBest) {
      localStorage.setItem(BEST_KEY, JSON.stringify({ score, boards: solvedCount }));
    }
    newBestEl.hidden = !isBest;
    deathStatsEl.textContent =
      `${solvedCount} boards · tier ${tierOf(solvedCount)} · best combo ×${maxCombo}` +
      (isBest ? '' : ` · best ${fmt(best.score)}`);
    deathOverlay.hidden = false;
    // score count-up
    const target = score;
    const t0 = performance.now();
    const dur = Math.min(1400, 350 + target / 8);
    const count = (): void => {
      const k = Math.min(1, (performance.now() - t0) / dur);
      finalScoreEl.textContent = fmt(Math.round(target * (1 - Math.pow(1 - k, 3))));
      if (k < 1 && phase === 'dead') requestAnimationFrame(count);
    };
    requestAnimationFrame(count);
  }

  function onSolved(dur: number): void {
    if (!level) return;
    phase = 'transition';
    distSolver = null;
    cancelBombTargeting();
    board?.clearPreviews();
    const par = level.optimal;
    const atPar = movesThisBoard <= par;
    const isClutch = bank < CLUTCH_WINDOW;

    window.setTimeout(() => board?.celebrate('quick'), dur * 1000 + 60);

    if (atPar) {
      combo++;
      maxCombo = Math.max(maxCombo, combo);
      window.setTimeout(() => sound.comboUp(combo), dur * 1000 + 180);
      // combo milestones pay out a booster: protecting the streak pays twice
      if (combo >= 3 && combo % 2 === 1) {
        window.setTimeout(() => earnBooster(), dur * 1000 + 420);
      }
    } else if (combo > 1) {
      combo = 1;
      sound.comboBreak();
      popup('combo lost', 'muted');
    }

    const grant = 3 + 1.5 * par;
    bank = Math.min(BANK_CAP, bank + grant);
    let points = Math.round((100 * par + 15 * Math.max(0, Math.floor(bank))) * combo);
    if (isClutch) {
      const bonus = 250 * combo;
      points += bonus;
      popup('CLUTCH!', 'big gold');
      window.setTimeout(() => sound.clutch(), dur * 1000 + 250);
    }
    score += points;
    solvedCount++;
    popup(`+${fmt(points)}${combo > 1 ? ` ×${combo}` : ''}`, 'gold');
    popup(`+${grant.toFixed(0)}s`, 'green small');
    updateHud();

    window.setTimeout(() => nextBoard(), dur * 1000 + 550);
  }

  function skipBoard(reason: 'manual' | 'dead'): void {
    if (phase !== 'running') return;
    phase = 'transition';
    distSolver = null;
    cancelBombTargeting();
    board?.clearPreviews();
    if (reason === 'manual') {
      bank = Math.max(0.5, bank - 5);
      popup('skipped −5s', 'muted');
    } else {
      popup('dead end — next board', 'muted');
    }
    if (combo > 1) {
      combo = 1;
      sound.comboBreak();
    }
    updateHud();
    window.setTimeout(() => nextBoard(), 250);
  }

  // -- melody / dead-end solver -------------------------------------------------

  function startDistCheck(): void {
    if (!level) return;
    distSolver = new Solver(glideRules(level.spec), gCloneState(current), 'bfs');
  }

  function handleDistance(d: number): void {
    if (!Number.isFinite(d)) {
      skipBoard('dead');
      prevDist = null;
      return;
    }
    if (
      prevDist !== null &&
      d < prevDist &&
      phase === 'running' &&
      lastMove &&
      lastMove.dist >= 4
    ) {
      const move = lastMove;
      const delay = Math.max(0, impactAt - performance.now() + 60);
      window.setTimeout(() => {
        board?.sparklePiece(move.pieceIdx);
        sound.shing();
      }, delay);
    }
    prevDist = d;
  }

  // -- previews (inactivity-gated: waiting for help costs clock) ----------------

  function previewGateOpen(): boolean {
    return phase === 'running' && performance.now() - lastMoveAt > PREVIEW_DELAY_MS;
  }

  function refreshPreviews(): void {
    if (!board || !level || !previewGateOpen()) {
      board?.clearPreviews();
      previewsShown = false;
      return;
    }
    const idx = hoverIdx >= 0 ? hoverIdx : selected;
    if (idx < 0 || idx >= current.length) {
      board.clearPreviews();
      previewsShown = false;
      return;
    }
    const specs = [];
    for (const [dr, dc] of GLIDE_DIRS) {
      const slid = glideMove(level.spec, current, idx, dr, dc);
      if (!slid) continue;
      const placement = slid.state[idx];
      specs.push({
        placement,
        pieceIdx: idx,
        dr,
        dc,
        onGoal: idx === 0 && placement.index === level.spec.goal,
      });
    }
    board.showPreviews(specs, current[idx].index);
    previewsShown = true;
    decoratedToken = ''; // fresh ghosts carry no decoration yet
  }

  // -- input --------------------------------------------------------------------

  let drag: { pieceIdx: number; x: number; y: number; committed: boolean } | null = null;

  function attachPointer(bv: BoardView): void {
    const canvas = bv.domElement;
    canvas.addEventListener(
      'pointerdown',
      (e) => {
        if (phase !== 'running') return;
        if (bombArmed) {
          const target = bv.pickAt(e.clientX, e.clientY);
          if (target !== null && target > 0) {
            detonate(target);
          } else {
            cancelBombTargeting();
            sound.knock();
          }
          return;
        }
        const preview = bv.pickPreviewAt(e.clientX, e.clientY);
        if (preview) {
          tryGlide(preview.pieceIdx, preview.dr, preview.dc);
          return;
        }
        const idx = bv.pickAt(e.clientX, e.clientY);
        if (idx === null) {
          selected = -1;
          bv.setSelected(-1);
          refreshPreviews();
          return;
        }
        selected = idx;
        bv.setSelected(idx);
        refreshPreviews();
        drag = { pieceIdx: idx, x: e.clientX, y: e.clientY, committed: false };
        bv.setOrbitEnabled(false);
        canvas.setPointerCapture(e.pointerId);
      },
      { capture: true },
    );
    canvas.addEventListener('pointermove', (e) => {
      if (drag) {
        if (drag.committed) return;
        const dx = e.clientX - drag.x;
        const dy = e.clientY - drag.y;
        if (Math.hypot(dx, dy) < 22) return;
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
        return;
      }
      if (phase !== 'running') return;
      if (bv.pickPreviewAt(e.clientX, e.clientY)) {
        canvas.style.cursor = 'pointer';
        return;
      }
      const idx = bv.pickAt(e.clientX, e.clientY);
      canvas.style.cursor = idx !== null ? 'grab' : 'default';
      const next = idx ?? -1;
      if (next !== hoverIdx) {
        hoverIdx = next;
        if (previewsShown) refreshPreviews();
      }
    });
    const release = (): void => {
      if (drag) {
        drag = null;
        bv.setOrbitEnabled(true);
      }
    };
    canvas.addEventListener('pointerup', release);
    canvas.addEventListener('pointercancel', release);
  }

  function tryGlide(pieceIdx: number, dr: number, dc: number): void {
    if (!level || !board || phase !== 'running') return;
    const slid = glideMove(level.spec, current, pieceIdx, dr, dc);
    if (!slid) {
      board.pulseInvalid(pieceIdx, dr, dc);
      sound.knock();
      return;
    }
    current = slid.state;
    movesThisBoard++;
    lastMoveAt = performance.now();
    lastMove = { pieceIdx, dist: slid.dist };
    cancelBombTargeting();
    assist = null;
    const dur = board.applyState(current);
    sound.whoosh(slid.dist);
    impactAt = performance.now() + dur * 1000;
    window.setTimeout(() => sound.thunk(Math.min(1, slid.dist / 6)), Math.max(0, dur * 1000 - 40));
    refreshPreviews();

    if (gIsSolved(level.spec, current)) {
      onSolved(dur);
    } else {
      startDistCheck();
    }
  }

  function onKey(e: KeyboardEvent): void {
    if (phase === 'idle' && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      startRun();
      return;
    }
    if (phase === 'dead' && (e.key === 'Enter' || e.key === ' ' || e.key === 'r' || e.key === 'R')) {
      e.preventDefault();
      startRun();
      return;
    }
    if (e.key === '1' || e.key === '2' || e.key === '3') {
      useBooster(Number(e.key) - 1);
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
      if (bombArmed) {
        cancelBombTargeting();
        return;
      }
      selected = -1;
      board?.setSelected(-1);
      refreshPreviews();
    }
  }

  // -- main loop ------------------------------------------------------------------

  function tick(dt: number): void {
    pumpGeneration();

    // waiting on the generator? resume as soon as a board lands
    if (phase === 'transition' && !miningEl.hidden && pending.length > 0) {
      nextBoard();
    }

    if (phase === 'running') {
      if (freezeLeft > 0) {
        freezeLeft -= dt;
      } else {
        bank -= dt;
      }
      if (bank <= 0) {
        bank = 0;
        die();
      }
      const sec = Math.ceil(bank);
      if (freezeLeft <= 0 && bank > 0 && bank < 5 && sec !== lastTickSecond) {
        lastTickSecond = sec;
        sound.tickTock();
      }
      if (!previewsShown && previewGateOpen() && (hoverIdx >= 0 || selected >= 0)) {
        refreshPreviews();
      }

      // stage-2 assist: stuck with ghosts showing? judge the candidate moves
      // with the solver and shimmer the promising ones (red-edge the fatal ones)
      if (previewsShown && performance.now() - lastMoveAt > ASSIST_DELAY_MS && level) {
        const token = assistToken();
        const idx = hoverIdx >= 0 ? hoverIdx : selected;
        if (idx >= 0 && decoratedToken !== token) {
          if (!assist || assist.token !== token) {
            assist = new AssistEvaluator(level.spec, current, idx, token);
          }
          const marks = assist.tick(3000);
          if (marks) {
            if (assist.token === assistToken()) {
              board?.decoratePreviews(marks);
              decoratedToken = token;
            }
            assist = null;
          }
        }
      }
    }

    // HUD: time bar
    const frac = Math.max(0, Math.min(1, bank / BANK_CAP));
    timeFill.style.width = `${frac * 100}%`;
    timeFill.className = `time-fill ${
      freezeLeft > 0 ? 'frozen' : bank < 5 ? 'danger' : bank < 12 ? 'warn' : ''
    }`;
    vignette.style.opacity =
      phase === 'running' && freezeLeft <= 0 && bank < 5 ? String(((5 - bank) / 5) * 0.55) : '0';

    if (distSolver) {
      let n = 4000;
      while (n-- > 0 && !distSolver.done && distSolver.stats.explored < 100_000) {
        distSolver.step();
      }
      if (distSolver.done) {
        const d = distSolver.goalId !== null ? distSolver.nodes[distSolver.goalId].depth : Infinity;
        distSolver = null;
        handleDistance(d);
      } else if (distSolver.stats.explored >= 100_000) {
        distSolver = null;
        prevDist = null;
      }
    }

    board?.frame(dt);
  }

  root.querySelector('[data-start-btn]')!.addEventListener('click', startRun);
  root.querySelector('[data-again]')!.addEventListener('click', startRun);
  root.querySelector('[data-skip]')!.addEventListener('click', () => skipBoard('manual'));
  boostersEl.addEventListener('click', (e) => {
    const chip = (e.target as HTMLElement).closest<HTMLElement>('[data-use]');
    if (chip) useBooster(Number(chip.dataset.use));
  });
  root.querySelector('[data-zen]')!.addEventListener('click', () => {
    root.dispatchEvent(new CustomEvent('switch-tab', { bubbles: true, detail: 'play' }));
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
        const best = loadBest();
        bestLine.textContent =
          best.score > 0 ? `your best: ${fmt(best.score)} (${best.boards} boards)` : '';
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
