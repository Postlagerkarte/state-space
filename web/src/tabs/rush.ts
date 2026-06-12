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
  gCells,
  gCloneState,
  gIsSolved,
  glideMove,
  glideRules,
} from '../core/glide';
import { gKey } from '../core/glide';
import { ArchitectSearch } from '../core/architect';
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
const FEVER_COMBO = 5;
const FEVER_MULT = 1.5;
const ARCHITECT_BONUS = 300;
const QUICK_START_BOARDS = 7; // quick start begins at tier 3 (as if 7 boards solved)
const QUICK_UNLOCK_BOARDS = 13; // unlocked once a run has reached tier 4
const BEST_KEY = 'statespace.rush.best';

type Booster = 'bomb' | 'freeze' | 'wall';
type StartMode = 'full' | 'quick';
type RushBoard = GlideLevel & { architect?: boolean };

function tierOf(solved: number): number {
  return 1 + TIER_THRESHOLDS.filter((t) => solved >= t).length;
}

// At high tiers every 5th board is deliberately easy: grace, rhythm, and a
// breath for the brain — thinking under a clock is taxing.
function isBreather(n: number): boolean {
  return n >= 13 && (n + 1) % 5 === 0;
}

// Roughly one board in seven (from tier 3 on) arrives UNSOLVABLE: the player
// places a wall to make a solution exist, then solves their own board.
const FORCE_ARCHITECT = new URLSearchParams(location.search).has('arch');
function isArchitect(n: number): boolean {
  if (FORCE_ARCHITECT) return true;
  return n >= 7 && (n + 3) % 7 === 0 && !isBreather(n);
}

function difficulty(solved: number): GlideGenOptions {
  if (isBreather(solved)) return { blockers: 2, minOptimal: 2, maxOptimal: 3, maxStates: 10_000 };
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

        <div class="overlay overlay-attract" data-start>
          <div class="overlay-card rush-card">
            <h2>⚡ Rush</h2>
            <p>Endless boards, one draining clock.<br/>
            Solving refunds time — harder boards refund more.<br/>
            Stay at par to build your combo — milestones earn boosters.</p>
            <p class="controls-hint">drag a piece to move · <b>right-drag</b> to rotate ·
            <b>1 2 3</b> use boosters</p>
            <p class="rush-best" data-best-line></p>
            <div class="btnrow center">
              <button class="btn primary big" data-start-btn>▶ &nbsp;START RUN</button>
              <button class="btn big" data-quick-btn hidden>⚡ QUICK START · tier 3</button>
            </div>
          </div>
        </div>

        <div class="overlay" data-death hidden>
          <div class="overlay-card rush-card">
            <div class="newbest" data-newbest hidden>🏆 NEW BEST</div>
            <h2 data-final-score>0</h2>
            <p class="death-tease" data-tease hidden></p>
            <p data-death-stats></p>
            <div class="btnrow center">
              <button class="btn primary big" data-again>⚡ &nbsp;RUN AGAIN</button>
              <button class="btn big" data-quick-again hidden>⚡ quick start</button>
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
  const teaseEl = root.querySelector<HTMLElement>('[data-tease]')!;
  const quickBtn = root.querySelector<HTMLButtonElement>('[data-quick-btn]')!;
  const quickAgainBtn = root.querySelector<HTMLButtonElement>('[data-quick-again]')!;

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
  let pending: RushBoard[] = [];
  let search: GlideLevelSearch | null = null;
  let archSearch: ArchitectSearch | null = null;
  let searchFor = -1;

  // dead-end detection + great-move reward
  let distSolver: Solver<GState, GMove> | null = null;
  let prevDist: number | null = null;
  let lastMove: { pieceIdx: number; dist: number } | null = null;

  // attract mode: the AI auto-plays boards behind the start screen
  const attract = {
    active: false,
    sub: 'gen' as 'gen' | 'play' | 'done',
    solution: null as GState[] | null,
    step: 0,
    clock: 0,
  };

  // boosters + targeting ('architect' = the mandatory wall placement on broken boards)
  let boosters: Booster[] = [];
  let freezeLeft = 0;
  let armed: null | 'bomb' | 'wall' | 'architect' = null;
  let lastTier = 1;
  let bestCache: Best = loadBest();
  let fever = false;
  let lastStartMode: StartMode = 'full';

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
      comboEl.textContent = `×${combo}${fever ? ' 🔥' : ''}`;
      comboEl.classList.toggle('fever', fever);
    } else {
      comboEl.hidden = true;
      comboEl.classList.remove('fever');
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

  const BOOSTER_META: Record<Booster, { icon: string; label: string }> = {
    bomb: { icon: '💣', label: 'Bomb: destroy a blocker' },
    freeze: { icon: '⏱', label: `Freeze: stop the clock ${FREEZE_SECONDS}s` },
    wall: { icon: '🧱', label: 'Wall: build a stub anywhere' },
  };

  function renderBoosters(): void {
    boostersEl.innerHTML = boosters
      .map(
        (b, i) =>
          `<button class="booster-chip" data-use="${i}" title="${BOOSTER_META[b].label} (key ${i + 1})">${BOOSTER_META[b].icon}<span>${i + 1}</span></button>`,
      )
      .join('');
  }

  /** Drop bomb/wall targeting. Architect placement is mandatory — only force clears it. */
  function cancelTargeting(force = false): void {
    if (!armed) return;
    if (armed === 'architect' && !force) return;
    armed = null;
    targetNote.hidden = true;
    board?.setTargeting(false);
    if (board) board.domElement.style.cursor = 'default';
  }

  function arm(kind: 'bomb' | 'wall' | 'architect', note: string): void {
    cancelTargeting(true);
    armed = kind;
    targetNote.textContent = note;
    targetNote.hidden = false;
    board?.setTargeting(kind === 'bomb');
    if (board) board.domElement.style.cursor = 'crosshair';
  }

  function useBooster(i: number): void {
    if (phase !== 'running' || i >= boosters.length || armed === 'architect') return;
    const booster = boosters[i];
    if (booster === 'freeze') {
      boosters.splice(i, 1);
      renderBoosters();
      cancelTargeting();
      freezeLeft = FREEZE_SECONDS;
      sound.freeze();
      popup(`⏱ frozen ${FREEZE_SECONDS}s`, 'cyan');
    } else if (booster === 'bomb') {
      // consumed only when it actually detonates
      arm('bomb', '💣 click a blocker to destroy it — Esc to cancel');
    } else {
      // consumed only when the wall is actually built
      arm('wall', '🧱 click an empty cell to build a wall — Esc to cancel');
    }
  }

  function detonate(pieceIdx: number): void {
    if (!board || !level || pieceIdx <= 0) return;
    const slot = boosters.indexOf('bomb');
    if (slot === -1) return;
    boosters.splice(slot, 1);
    renderBoosters();
    cancelTargeting();
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

  /** Is this cell free of walls and pieces (and on the board)? */
  function cellIsEmpty(cell: number | null): cell is number {
    if (cell === null || !level) return false;
    if (level.spec.walls.includes(cell)) return false;
    for (const p of current) {
      if (gCells(level.spec, p).includes(cell)) return false;
    }
    return true;
  }

  function placeWallBooster(cell: number): void {
    if (!board || !level) return;
    const slot = boosters.indexOf('wall');
    if (slot === -1) return;
    boosters.splice(slot, 1);
    renderBoosters();
    cancelTargeting();
    level.spec.walls.push(cell);
    board.addWall(cell);
    sound.thunk(0.6);
    decoratedToken = '';
    assist = null;
    // double-edged like the bomb: walling off your own route gets caught here
    prevDist = null;
    startDistCheck();
    refreshPreviews();
  }

  function placeArchitectWall(cell: number): void {
    if (!board || !level) return;
    // validate BEFORE committing: the placement must create a solution
    const fixedSpec = { ...level.spec, walls: [...level.spec.walls, cell] };
    const solver = new Solver(glideRules(fixedSpec), gCloneState(current), 'bfs');
    solver.run(10_000);
    if (solver.goalId === null) {
      popup('still unsolvable — try another cell', 'muted');
      sound.knock();
      return; // stay armed, keep trying (the clock is the pressure)
    }
    const par = solver.nodes[solver.goalId].depth;
    level.spec.walls.push(cell);
    level.optimal = par;
    board.addWall(cell);
    sound.boosterEarn();
    popup(`solvable — par ${par}!`, 'gold');
    armed = null;
    targetNote.hidden = true;
    board.domElement.style.cursor = 'default';
    movesThisBoard = 0;
    prevDist = par;
    lastMove = null;
    lastMoveAt = performance.now();
    decoratedToken = '';
    assist = null;
    refreshPreviews();
  }

  function earnBooster(): void {
    if (boosters.length >= BOOSTER_CAP) {
      const consolation = 250 * combo;
      score += consolation;
      popup(`+${fmt(consolation)} (pockets full)`, 'gold small');
      return;
    }
    const r = Math.random();
    const booster: Booster = r < 0.4 ? 'bomb' : r < 0.7 ? 'freeze' : 'wall';
    boosters.push(booster);
    renderBoosters();
    sound.boosterEarn();
    popup(`${BOOSTER_META[booster].icon} ${booster.toUpperCase()} earned!`, 'cyan');
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

    if (isArchitect(needFor - 1)) {
      if (!archSearch || searchFor !== needFor) {
        archSearch = new ArchitectSearch(
          mulberry32((Date.now() ^ ((Math.random() * 0xffffff) | 0)) >>> 0),
          { minPar: 3, maxPar: 7 },
        );
        search = null;
        searchFor = needFor;
      }
      const found = archSearch.tick(1);
      if (found) {
        pending.push({
          spec: found.spec,
          state: found.state,
          optimal: found.parAfter, // provisional — recomputed for the player's own fix
          explored: 0,
          architect: true,
        });
        archSearch = null;
      }
      return;
    }

    if (!search || searchFor !== needFor) {
      search = new GlideLevelSearch(
        mulberry32((Date.now() ^ ((Math.random() * 0xffffff) | 0)) >>> 0),
        difficulty(needFor - 1),
      );
      archSearch = null;
      searchFor = needFor;
    }
    const found = search.tick(2);
    if (found) {
      pending.push(found);
      search = null;
    }
  }

  function loadBoard(lvl: RushBoard, transition: boolean): void {
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
    if (lvl.architect) {
      // this board is broken on purpose: the player must build the missing wall
      popup('🏗 ARCHITECT', 'big cyan');
      arm('architect', '🏗 this board is unsolvable — click a cell to build the missing wall');
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
    } else if (isBreather(solvedCount)) {
      popup('breather ☕', 'muted');
    }
    window.setTimeout(() => {
      if (phase === 'transition') phase = 'running';
    }, 420);
  }

  // -- run lifecycle -----------------------------------------------------------

  function quickStartUnlocked(): boolean {
    return bestCache.boards >= QUICK_UNLOCK_BOARDS;
  }

  function updateStartButtons(): void {
    quickBtn.hidden = !quickStartUnlocked();
    quickAgainBtn.hidden = !quickStartUnlocked();
  }

  function startRun(mode: StartMode = 'full'): void {
    stopAttract();
    bestCache = loadBest();
    if (mode === 'quick' && !quickStartUnlocked()) mode = 'full';
    lastStartMode = mode;
    pending = [];
    search = null;
    searchFor = -1;
    // quick start: skip the warmup you've outgrown — begin at tier 3
    solvedCount = mode === 'quick' ? QUICK_START_BOARDS : 0;
    lastTier = tierOf(solvedCount);
    score = 0;
    combo = 1;
    maxCombo = 1;
    boosters = [];
    freezeLeft = 0;
    fever = false;
    board?.setFever(false);
    assist = null;
    decoratedToken = '';
    cancelTargeting(true);
    renderBoosters();
    const bankParam = Number(new URLSearchParams(location.search).get('bank'));
    bank = Number.isFinite(bankParam) && bankParam > 0 ? bankParam : BANK_START;
    lastTickSecond = -1;
    startOverlay.hidden = true;
    deathOverlay.hidden = true;
    hud.hidden = false;

    // first board synchronously (warmups mine in milliseconds, tier 3 in ~a second)
    let first: RushBoard | null = null;
    if (FORCE_ARCHITECT) {
      const arch = new ArchitectSearch(mulberry32((Date.now() ^ 0x9e3779b9) >>> 0)).runSync(4000);
      if (arch) {
        first = { spec: arch.spec, state: arch.state, optimal: arch.parAfter, explored: 0, architect: true };
      }
    }
    if (!first) {
      first = new GlideLevelSearch(
        mulberry32((Date.now() ^ 0x9e3779b9) >>> 0),
        difficulty(solvedCount),
      ).runSync(10_000);
    }
    if (!first) return; // practically impossible; keeps types honest
    loadBoard(first, board !== null);
    phase = 'running';
    updateHud();
  }

  function die(): void {
    phase = 'dead';
    sound.gameOver();
    cancelTargeting(true);
    fever = false;
    board?.setFever(false);
    board?.clearPreviews();
    const best = loadBest();
    const isBest = score > best.score;
    if (isBest) {
      localStorage.setItem(BEST_KEY, JSON.stringify({ score, boards: solvedCount }));
      bestCache = { score, boards: solvedCount };
    }
    newBestEl.hidden = !isBest;
    deathStatsEl.textContent =
      `${solvedCount} boards · tier ${tierOf(solvedCount)} · best combo ×${maxCombo}` +
      (isBest ? '' : ` · best ${fmt(best.score)}`);

    // near-miss drama: the gap is the hook
    teaseEl.hidden = true;
    if (isBest && best.score > 0) {
      teaseEl.textContent = `+${fmt(score - best.score)} over your old best`;
      teaseEl.className = 'death-tease gold';
      teaseEl.hidden = false;
    } else if (!isBest && best.boards > 0) {
      const boardsGap = best.boards - solvedCount;
      const nextThr = TIER_THRESHOLDS.find((t) => t > solvedCount);
      if (boardsGap > 0 && boardsGap <= 2) {
        teaseEl.textContent = `${boardsGap} board${boardsGap > 1 ? 's' : ''} short of your best — run again!`;
        teaseEl.className = 'death-tease hot';
        teaseEl.hidden = false;
      } else if (nextThr && nextThr - solvedCount <= 2) {
        const gap = nextThr - solvedCount;
        teaseEl.textContent = `tier ${tierOf(nextThr)} was ${gap} board${gap > 1 ? 's' : ''} away`;
        teaseEl.className = 'death-tease amber';
        teaseEl.hidden = false;
      }
    }
    updateStartButtons();
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

  function breakStreak(): void {
    combo = 1;
    sound.comboBreak();
    if (fever) {
      fever = false;
      board?.setFever(false);
      vignette.classList.remove('fever');
      popup('fever lost', 'muted');
    } else {
      popup('combo lost', 'muted');
    }
  }

  function onSolved(dur: number): void {
    if (!level) return;
    phase = 'transition';
    distSolver = null;
    cancelTargeting(true);
    board?.clearPreviews();
    const par = level.optimal;
    const wasArchitect = (level as RushBoard).architect === true;
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
      // FEVER: the streak's summit — gold regime, hotter board, 1.5x points
      if (!fever && combo >= FEVER_COMBO) {
        fever = true;
        board?.setFever(true);
        popup('FEVER!', 'big gold');
        window.setTimeout(() => sound.feverUp(), dur * 1000 + 320);
      }
    } else if (combo > 1) {
      breakStreak();
    }

    const grant = 3 + 1.5 * par + (wasArchitect ? 3 : 0);
    bank = Math.min(BANK_CAP, bank + grant);
    let points = Math.round(
      (100 * par + 15 * Math.max(0, Math.floor(bank))) * combo * (fever ? FEVER_MULT : 1),
    );
    if (wasArchitect) {
      points += ARCHITECT_BONUS;
      popup(`architect +${ARCHITECT_BONUS}`, 'cyan small');
    }
    if (isClutch) {
      const bonus = 250 * combo;
      points += bonus;
      popup('CLUTCH!', 'big gold');
      window.setTimeout(() => sound.clutch(), dur * 1000 + 250);
    }
    score += points;
    solvedCount++;
    popup(`+${fmt(points)}${combo > 1 ? ` ×${combo}` : ''}${fever ? ' 🔥' : ''}`, 'gold');
    popup(`+${grant.toFixed(0)}s`, 'green small');
    updateHud();

    window.setTimeout(() => nextBoard(), dur * 1000 + 550);
  }

  function skipBoard(reason: 'manual' | 'dead'): void {
    if (phase !== 'running') return;
    phase = 'transition';
    distSolver = null;
    cancelTargeting(true);
    board?.clearPreviews();
    if (reason === 'manual') {
      bank = Math.max(0.5, bank - 5);
      popup('skipped −5s', 'muted');
    } else {
      popup('dead end — next board', 'muted');
    }
    if (combo > 1) breakStreak();
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
        if (e.button !== 0) return; // right/middle button is reserved for the camera
        if (phase !== 'running') return;
        if (armed === 'bomb') {
          const target = bv.pickAt(e.clientX, e.clientY);
          if (target !== null && target > 0) {
            detonate(target);
          } else {
            cancelTargeting();
            sound.knock();
          }
          return;
        }
        if (armed === 'wall' || armed === 'architect') {
          const cell = bv.pickCellAt(e.clientX, e.clientY);
          if (!cellIsEmpty(cell)) {
            sound.knock();
            if (armed === 'wall') cancelTargeting();
            return;
          }
          if (armed === 'wall') placeWallBooster(cell);
          else placeArchitectWall(cell);
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
      if (armed) {
        canvas.style.cursor = 'crosshair';
        return;
      }
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
    if (armed === 'architect') {
      sound.knock();
      return; // the wall must be built first
    }
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
    cancelTargeting();
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
      startRun(lastStartMode);
      return;
    }
    if (phase === 'dead' && (e.key === 'Enter' || e.key === ' ' || e.key === 'r' || e.key === 'R')) {
      e.preventDefault();
      startRun(lastStartMode);
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
      if (armed) {
        if (armed === 'architect') sound.knock(); // can't back out — build the wall
        else cancelTargeting();
        return;
      }
      selected = -1;
      board?.setSelected(-1);
      refreshPreviews();
    }
  }

  // -- attract mode ---------------------------------------------------------------
  // Before the first START, the solver auto-plays a stream of boards behind the
  // dialog: glide, solve, fireworks, next. It's the game demonstrating itself.

  function startAttract(): void {
    if (phase !== 'idle') return;
    attract.active = true;
    attract.sub = 'gen';
    attract.solution = null;
    attract.step = 0;
    attract.clock = 0;
    board?.setAutoRotate(true);
  }

  function stopAttract(): void {
    attract.active = false;
    attract.solution = null;
    board?.setAutoRotate(false);
  }

  function attractTick(dt: number): void {
    const STEP = 0.62;
    const DONE_WAIT = 2.2;

    if (attract.sub === 'gen') {
      const lvl = new GlideLevelSearch(
        mulberry32((Date.now() ^ ((Math.random() * 0xffffff) | 0)) >>> 0),
        { blockers: 3, minOptimal: 4, maxOptimal: 6, maxStates: 20_000 },
      ).runSync(4000);
      if (!lvl) return; // unlucky batch — try again next frame
      const solver = new Solver(glideRules(lvl.spec), gCloneState(lvl.state), 'bfs');
      solver.run(50_000);
      const path = solver.path();
      if (!path) return;
      attract.solution = path.map((n) => n.state);
      attract.step = 0;
      attract.clock = 0;
      const layout = glideLayout(lvl.spec);
      if (!board) {
        board = new BoardView(boardHost, layout, { interactive: true });
        attachPointer(board);
        board.setLevel(gCloneState(lvl.state));
      } else {
        board.transitionTo(gCloneState(lvl.state), layout);
      }
      board.setAutoRotate(true);
      attract.sub = 'play';
      return;
    }

    if (attract.sub === 'play') {
      if (!attract.solution || !board) {
        attract.sub = 'gen';
        return;
      }
      attract.clock += dt;
      if (attract.clock >= STEP) {
        attract.clock = 0;
        attract.step++;
        if (attract.step < attract.solution.length) {
          board.applyState(attract.solution[attract.step]);
          if (attract.step === attract.solution.length - 1) {
            board.celebrate('quick');
            attract.sub = 'done';
          }
        } else {
          attract.sub = 'done';
        }
      }
      return;
    }

    // 'done': linger on the win, then roll the next board
    attract.clock += dt;
    if (attract.clock >= DONE_WAIT) {
      attract.sub = 'gen';
      attract.solution = null;
      attract.clock = 0;
    }
  }

  // -- main loop ------------------------------------------------------------------

  function tick(dt: number): void {
    pumpGeneration();

    if (phase === 'idle' && attract.active) attractTick(dt);

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
    // vignette: red danger takes priority; otherwise fever bathes the edges gold
    const danger = phase === 'running' && freezeLeft <= 0 && bank < 5;
    vignette.classList.toggle('fever', fever && !danger);
    vignette.style.opacity = danger
      ? String(((5 - bank) / 5) * 0.55)
      : fever && phase === 'running'
        ? '0.4'
        : '0';

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

  root.querySelector('[data-start-btn]')!.addEventListener('click', () => startRun('full'));
  root.querySelector('[data-again]')!.addEventListener('click', () => startRun(lastStartMode));
  quickBtn.addEventListener('click', () => startRun('quick'));
  quickAgainBtn.addEventListener('click', () => startRun('quick'));
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
        updateStartButtons();
      }
      window.addEventListener('keydown', onKey);
      if (phase === 'idle') startAttract();
      last = performance.now();
      raf = requestAnimationFrame(loop);
    },
    deactivate() {
      window.removeEventListener('keydown', onKey);
      cancelAnimationFrame(raf);
    },
  };
}
