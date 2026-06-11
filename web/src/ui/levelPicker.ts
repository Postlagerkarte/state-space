// Level selection shared by all tabs: curated levels plus live random generation
// (generate-and-test with the BFS solver as the judge, exactly like the old
// LevelGenerator app — including the attempt counter).

import { el, fmt } from './dom';
import { LEVELS, levelById } from '../core/levels';
import { State, cloneState } from '../core/board';
import { LevelSearch, mulberry32 } from '../core/generator';

export interface LevelMeta {
  label: string;
  /** BFS-optimal move count if known for the current rules, else null. */
  optimalHint: number | null;
}

export interface LevelPickerOptions {
  defaultId?: string;
  defaultPieces?: number;
}

export class LevelPicker {
  readonly root: HTMLElement;
  onLevel: ((state: State, meta: LevelMeta) => void) | null = null;
  onRotationChange: (() => void) | null = null;

  private select: HTMLSelectElement;
  private piecesRow: HTMLElement;
  private piecesInput: HTMLInputElement;
  private piecesVal: HTMLElement;
  private rotCheck: HTMLInputElement;
  private status: HTMLElement;
  private search: LevelSearch | null = null;

  constructor(opts: LevelPickerOptions = {}) {
    const options = LEVELS.map(
      (l) => `<option value="${l.id}">${l.name} — ${l.state.length - 1} pieces</option>`,
    ).join('');
    this.root = el(`
      <div class="level-picker">
        <label class="field"><span>Level</span>
          <select data-level>${options}<option value="__random">Random board…</option></select>
        </label>
        <label class="field" data-pieces-row hidden><span>Blockers: <b data-pieces-val>4</b></span>
          <input type="range" min="2" max="6" value="4" data-pieces />
        </label>
        <label class="check"><input type="checkbox" data-rot /> Allow rotation</label>
        <div class="btnrow"><button class="btn" data-new>New board</button></div>
        <div class="gen-status" data-status></div>
      </div>
    `);
    this.select = this.root.querySelector('[data-level]')!;
    this.piecesRow = this.root.querySelector('[data-pieces-row]')!;
    this.piecesInput = this.root.querySelector('[data-pieces]')!;
    this.piecesVal = this.root.querySelector('[data-pieces-val]')!;
    this.rotCheck = this.root.querySelector('[data-rot]')!;
    this.status = this.root.querySelector('[data-status]')!;

    if (opts.defaultId) this.select.value = opts.defaultId;
    if (opts.defaultPieces) this.piecesInput.value = String(opts.defaultPieces);
    this.piecesVal.textContent = this.piecesInput.value;

    this.select.addEventListener('change', () => this.load());
    this.piecesInput.addEventListener('input', () => {
      this.piecesVal.textContent = this.piecesInput.value;
    });
    this.rotCheck.addEventListener('change', () => this.onRotationChange?.());
    this.root.querySelector('[data-new]')!.addEventListener('click', () => this.load(true));
  }

  get rotation(): boolean {
    return this.rotCheck.checked;
  }

  /** Load the current selection (curated immediately, random via generation). */
  load(forceNew = false): void {
    void forceNew;
    this.search = null;
    const id = this.select.value;
    if (id === '__random') {
      this.piecesRow.hidden = false;
      const pieces = Number(this.piecesInput.value);
      this.search = new LevelSearch(pieces, this.rotation, mulberry32((Date.now() ^ (Math.random() * 0xffff)) >>> 0), {
        minOptimal: pieces <= 3 ? 8 : 10,
        maxStates: 60_000,
      });
      this.status.textContent = 'generating…';
      return;
    }
    this.piecesRow.hidden = true;
    const level = levelById(id);
    if (!level) return;
    this.status.textContent = level.blurb;
    this.onLevel?.(cloneState(level.state), {
      label: level.name,
      optimalHint: this.rotation ? null : level.optimal,
    });
  }

  /** Advance a running random generation; call this from the tab's animation loop. */
  tick(budget = 4000): void {
    if (!this.search) return;
    const level = this.search.tick(budget);
    if (level) {
      const search = this.search;
      this.search = null;
      this.status.textContent =
        `found board #${fmt(search.attempts)} after testing ${fmt(search.statesChecked)} states — ` +
        `optimal: ${level.optimal} moves`;
      this.onLevel?.(cloneState(level.state), {
        label: `Random (${level.state.length - 1} blockers)`,
        optimalHint: level.optimal,
      });
    } else {
      this.status.textContent =
        `generate-and-test: board #${fmt(this.search.attempts)}, ` +
        `${fmt(this.search.statesChecked)} states checked…`;
    }
  }
}
