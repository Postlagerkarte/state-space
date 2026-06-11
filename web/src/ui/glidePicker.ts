// Level selection for the glide game: curated levels (with earned stars) plus
// live random generation — generate-and-test with the BFS solver as the judge,
// the same philosophy as the original 2014 LevelGenerator.

import { el, fmt } from './dom';
import { GLIDE_LEVELS } from '../core/glideLevels';
import { GState, GlideSpec, GlideLevelSearch, gCloneState } from '../core/glide';
import { mulberry32 } from '../core/generator';

const PROGRESS_KEY = 'statespace.glide.progress';

export function getStars(id: string): number {
  try {
    const data = JSON.parse(localStorage.getItem(PROGRESS_KEY) ?? '{}') as Record<string, number>;
    return data[id] ?? 0;
  } catch {
    return 0;
  }
}

export function setStars(id: string, stars: number): void {
  try {
    const data = JSON.parse(localStorage.getItem(PROGRESS_KEY) ?? '{}') as Record<string, number>;
    data[id] = Math.max(data[id] ?? 0, stars);
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(data));
  } catch {
    // localStorage unavailable: progress just isn't persisted
  }
}

export interface PickedLevel {
  id: string;
  name: string;
  spec: GlideSpec;
  state: GState;
  optimal: number;
}

const MIN_OPTIMAL_BY_BLOCKERS: Record<number, number> = { 3: 4, 4: 5, 5: 6, 6: 7 };

export class GlidePicker {
  readonly root: HTMLElement;
  onLevel: ((level: PickedLevel) => void) | null = null;

  private select: HTMLSelectElement;
  private blockersRow: HTMLElement;
  private blockersInput: HTMLInputElement;
  private blockersVal: HTMLElement;
  private status: HTMLElement;
  private search: GlideLevelSearch | null = null;

  constructor(opts: { defaultId?: string } = {}) {
    this.root = el(`
      <div class="level-picker">
        <label class="field"><span>Level</span><select data-level></select></label>
        <label class="field" data-blockers-row hidden><span>Blockers: <b data-blockers-val>4</b></span>
          <input type="range" min="3" max="6" value="4" data-blockers />
        </label>
        <div class="btnrow"><button class="btn" data-new>New board</button></div>
        <div class="gen-status" data-status></div>
      </div>
    `);
    this.select = this.root.querySelector('[data-level]')!;
    this.blockersRow = this.root.querySelector('[data-blockers-row]')!;
    this.blockersInput = this.root.querySelector('[data-blockers]')!;
    this.blockersVal = this.root.querySelector('[data-blockers-val]')!;
    this.status = this.root.querySelector('[data-status]')!;

    this.refresh();
    if (opts.defaultId && GLIDE_LEVELS.some((l) => l.id === opts.defaultId)) {
      this.select.value = opts.defaultId;
    }
    this.select.addEventListener('change', () => this.load());
    this.blockersInput.addEventListener('input', () => {
      this.blockersVal.textContent = this.blockersInput.value;
    });
    this.root.querySelector('[data-new]')!.addEventListener('click', () => this.load());
  }

  /** Rebuild the option labels (star markers may have changed). */
  refresh(): void {
    const selected = this.select.value;
    this.select.innerHTML =
      GLIDE_LEVELS.map((l) => {
        const stars = getStars(l.id);
        const marker = stars > 0 ? ` ${'★'.repeat(stars)}` : '';
        return `<option value="${l.id}">${l.name} · par ${l.optimal}${marker}</option>`;
      }).join('') + '<option value="__random">Random board…</option>';
    if (selected) this.select.value = selected;
    if (!this.select.value) this.select.value = GLIDE_LEVELS[0].id;
  }

  load(): void {
    this.search = null;
    const id = this.select.value;
    if (id === '__random') {
      this.blockersRow.hidden = false;
      const blockers = Number(this.blockersInput.value);
      this.search = new GlideLevelSearch(mulberry32((Date.now() ^ (Math.random() * 0xffff)) >>> 0), {
        blockers,
        minOptimal: MIN_OPTIMAL_BY_BLOCKERS[blockers] ?? 5,
        maxStates: 15_000,
      });
      this.status.textContent = 'generating…';
      return;
    }
    this.blockersRow.hidden = true;
    const def = GLIDE_LEVELS.find((l) => l.id === id);
    if (!def) return;
    this.status.textContent = '';
    this.onLevel?.({
      id: def.id,
      name: def.name,
      spec: def.spec,
      state: gCloneState(def.state),
      optimal: def.optimal,
    });
  }

  /** Advance a running random generation; call from the tab's animation loop. */
  tick(): void {
    if (!this.search) return;
    const level = this.search.tick(2);
    if (level) {
      const search = this.search;
      this.search = null;
      this.status.textContent =
        `board #${fmt(search.attempts)} passed (${fmt(search.statesChecked)} states tested) — par ${level.optimal}`;
      this.onLevel?.({
        id: 'random',
        name: 'Random board',
        spec: level.spec,
        state: level.state,
        optimal: level.optimal,
      });
    } else {
      this.status.textContent =
        `generate-and-test: board #${fmt(this.search.attempts)}, ` +
        `${fmt(this.search.statesChecked)} states checked…`;
    }
  }

  /** Move on to the next curated level (or roll a fresh random board). */
  selectNext(): void {
    if (this.select.value === '__random') {
      this.load();
      return;
    }
    const idx = GLIDE_LEVELS.findIndex((l) => l.id === this.select.value);
    const next = GLIDE_LEVELS[(idx + 1) % GLIDE_LEVELS.length];
    this.select.value = next.id;
    this.load();
  }
}
