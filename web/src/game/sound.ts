// Synthesized sound effects via WebAudio — no asset files needed.
// The AudioContext is created lazily on the first user gesture.

const MUTE_KEY = 'statespace.muted';

let ctx: AudioContext | null = null;
let noiseBuf: AudioBuffer | null = null;
let muted = localStorage.getItem(MUTE_KEY) === '1';

function ensure(): AudioContext | null {
  if (muted) return null;
  if (!ctx) {
    try {
      ctx = new AudioContext();
    } catch {
      return null;
    }
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

function noise(c: AudioContext): AudioBuffer {
  if (!noiseBuf) {
    noiseBuf = c.createBuffer(1, c.sampleRate, c.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  return noiseBuf;
}

export function isMuted(): boolean {
  return muted;
}

export function toggleMute(): boolean {
  muted = !muted;
  localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
  return muted;
}

/** Filtered-noise whoosh whose length scales with the glide distance. */
export function whoosh(dist: number): void {
  const c = ensure();
  if (!c) return;
  const dur = Math.min(0.45, 0.1 + dist * 0.04);
  const src = c.createBufferSource();
  src.buffer = noise(c);
  const filter = c.createBiquadFilter();
  filter.type = 'bandpass';
  filter.Q.value = 1.2;
  filter.frequency.setValueAtTime(950, c.currentTime);
  filter.frequency.exponentialRampToValueAtTime(260, c.currentTime + dur);
  const gain = c.createGain();
  gain.gain.setValueAtTime(0.001, c.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.16, c.currentTime + 0.03);
  gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
  src.connect(filter).connect(gain).connect(c.destination);
  src.start();
  src.stop(c.currentTime + dur + 0.05);
}

/** Low impact thock when a piece hits a wall; intensity in [0, 1]. */
export function thunk(intensity: number): void {
  const c = ensure();
  if (!c) return;
  const t = c.currentTime;
  const osc = c.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(150, t);
  osc.frequency.exponentialRampToValueAtTime(48, t + 0.09);
  const gain = c.createGain();
  const peak = 0.18 + 0.3 * intensity;
  gain.gain.setValueAtTime(peak, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.13);
  osc.connect(gain).connect(c.destination);
  osc.start(t);
  osc.stop(t + 0.15);

  const click = c.createBufferSource();
  click.buffer = noise(c);
  const clickGain = c.createGain();
  clickGain.gain.setValueAtTime(0.1 * intensity, t);
  clickGain.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
  const hp = c.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 1800;
  click.connect(hp).connect(clickGain).connect(c.destination);
  click.start(t);
  click.stop(t + 0.05);
}

/**
 * Soft wooden knock-knock when a piece is already against a wall.
 * Deliberately gentle: bumping a wall is information, not failure.
 */
export function knock(): void {
  const c = ensure();
  if (!c) return;
  for (const [offset, peak] of [
    [0, 0.14],
    [0.085, 0.09],
  ] as const) {
    const t = c.currentTime + offset;
    const osc = c.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(190, t);
    osc.frequency.exponentialRampToValueAtTime(120, t + 0.05);
    const gain = c.createGain();
    gain.gain.setValueAtTime(peak, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
    osc.connect(gain).connect(c.destination);
    osc.start(t);
    osc.stop(t + 0.08);

    const tap = c.createBufferSource();
    tap.buffer = noise(c);
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 450;
    const tapGain = c.createGain();
    tapGain.gain.setValueAtTime(peak * 0.6, t);
    tapGain.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
    tap.connect(lp).connect(tapGain).connect(c.destination);
    tap.start(t);
    tap.stop(t + 0.05);
  }
}

/** Friendly backwards swish for undo — rewinding, not failing. */
export function swishBack(): void {
  const c = ensure();
  if (!c) return;
  const t = c.currentTime;
  const src = c.createBufferSource();
  src.buffer = noise(c);
  const filter = c.createBiquadFilter();
  filter.type = 'bandpass';
  filter.Q.value = 1.4;
  filter.frequency.setValueAtTime(300, t);
  filter.frequency.exponentialRampToValueAtTime(1100, t + 0.18);
  const gain = c.createGain();
  gain.gain.setValueAtTime(0.001, t);
  gain.gain.exponentialRampToValueAtTime(0.1, t + 0.03);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
  src.connect(filter).connect(gain).connect(c.destination);
  src.start(t);
  src.stop(t + 0.25);
}

/**
 * One soft bright chime for a *great* move (on the optimal path AND a long,
 * dramatic glide). Rare on purpose: playtesting showed per-move pitch ladders
 * get annoying — scarcity is what keeps a reward sound rewarding.
 */
export function shing(): void {
  const c = ensure();
  if (!c) return;
  const t = c.currentTime;
  for (const [mult, peak] of [
    [1, 0.12],
    [2.01, 0.04],
  ] as const) {
    const osc = c.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 1318.5 * mult; // E6 + shimmer
    const gain = c.createGain();
    gain.gain.setValueAtTime(0.001, t);
    gain.gain.exponentialRampToValueAtTime(peak, t + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
    osc.connect(gain).connect(c.destination);
    osc.start(t);
    osc.stop(t + 0.65);
  }
}

/** Urgent clock tick for the last seconds of a rush run. */
export function tickTock(): void {
  const c = ensure();
  if (!c) return;
  const t = c.currentTime;
  const osc = c.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(880, t);
  osc.frequency.exponentialRampToValueAtTime(660, t + 0.04);
  const gain = c.createGain();
  gain.gain.setValueAtTime(0.12, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
  osc.connect(gain).connect(c.destination);
  osc.start(t);
  osc.stop(t + 0.07);
}

/** Quick rising zip when the combo multiplier climbs. */
export function comboUp(combo: number): void {
  const c = ensure();
  if (!c) return;
  const base = 392 * Math.pow(2, Math.min(combo, 8) / 12);
  for (let i = 0; i < 2; i++) {
    const t = c.currentTime + i * 0.06;
    const osc = c.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = base * (i === 0 ? 1 : 1.5);
    const gain = c.createGain();
    gain.gain.setValueAtTime(0.001, t);
    gain.gain.exponentialRampToValueAtTime(0.14, t + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
    osc.connect(gain).connect(c.destination);
    osc.start(t);
    osc.stop(t + 0.18);
  }
}

/** Gentle two-note sigh when a streak breaks. */
export function comboBreak(): void {
  const c = ensure();
  if (!c) return;
  for (const [offset, freq] of [
    [0, 330],
    [0.09, 277],
  ] as const) {
    const t = c.currentTime + offset;
    const osc = c.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = freq;
    const gain = c.createGain();
    gain.gain.setValueAtTime(0.08, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
    osc.connect(gain).connect(c.destination);
    osc.start(t);
    osc.stop(t + 0.18);
  }
}

/** Big muffled explosion for the bomb booster. */
export function boom(): void {
  const c = ensure();
  if (!c) return;
  const t = c.currentTime;
  const osc = c.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(110, t);
  osc.frequency.exponentialRampToValueAtTime(32, t + 0.28);
  const oscGain = c.createGain();
  oscGain.gain.setValueAtTime(0.5, t);
  oscGain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
  osc.connect(oscGain).connect(c.destination);
  osc.start(t);
  osc.stop(t + 0.4);

  const burst = c.createBufferSource();
  burst.buffer = noise(c);
  const lp = c.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(2600, t);
  lp.frequency.exponentialRampToValueAtTime(220, t + 0.3);
  const burstGain = c.createGain();
  burstGain.gain.setValueAtTime(0.4, t);
  burstGain.gain.exponentialRampToValueAtTime(0.001, t + 0.32);
  burst.connect(lp).connect(burstGain).connect(c.destination);
  burst.start(t);
  burst.stop(t + 0.35);
}

/** Icy shimmer for the time-freeze booster. */
export function freeze(): void {
  const c = ensure();
  if (!c) return;
  const t = c.currentTime;
  for (let i = 0; i < 4; i++) {
    const osc = c.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 1568 * Math.pow(2, -i / 12 / 2);
    const gain = c.createGain();
    const at = t + i * 0.07;
    gain.gain.setValueAtTime(0.001, at);
    gain.gain.exponentialRampToValueAtTime(0.08, at + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, at + 0.3);
    osc.connect(gain).connect(c.destination);
    osc.start(at);
    osc.stop(at + 0.32);
  }
}

/** Sparkle when a booster is earned. */
export function boosterEarn(): void {
  const c = ensure();
  if (!c) return;
  const notes = [784, 1175];
  notes.forEach((freq, i) => {
    const t = c.currentTime + i * 0.08;
    const osc = c.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = freq;
    const gain = c.createGain();
    gain.gain.setValueAtTime(0.001, t);
    gain.gain.exponentialRampToValueAtTime(0.13, t + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
    osc.connect(gain).connect(c.destination);
    osc.start(t);
    osc.stop(t + 0.28);
  });
}

/** Triumphant double-hit for a clutch solve (under two seconds left). */
export function clutch(): void {
  const c = ensure();
  if (!c) return;
  const notes = [659.25, 987.77];
  notes.forEach((freq, i) => {
    const t = c.currentTime + i * 0.09;
    const osc = c.createOscillator();
    osc.type = 'square';
    osc.frequency.value = freq;
    const gain = c.createGain();
    gain.gain.setValueAtTime(0.001, t);
    gain.gain.exponentialRampToValueAtTime(0.09, t + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
    osc.connect(gain).connect(c.destination);
    osc.start(t);
    osc.stop(t + 0.25);
  });
}

/** Rising fanfare when the difficulty tier climbs. */
export function tierUp(): void {
  const c = ensure();
  if (!c) return;
  const notes = [392, 523.25, 659.25];
  notes.forEach((freq, i) => {
    const t = c.currentTime + i * 0.1;
    const osc = c.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = freq;
    const gain = c.createGain();
    gain.gain.setValueAtTime(0.001, t);
    gain.gain.exponentialRampToValueAtTime(0.14, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    osc.connect(gain).connect(c.destination);
    osc.start(t);
    osc.stop(t + 0.33);
  });
}

/** Descending womp for the end of a run. */
export function gameOver(): void {
  const c = ensure();
  if (!c) return;
  const notes = [392, 311, 233, 196];
  notes.forEach((freq, i) => {
    const t = c.currentTime + i * 0.16;
    const osc = c.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = freq;
    const gain = c.createGain();
    gain.gain.setValueAtTime(0.001, t);
    gain.gain.exponentialRampToValueAtTime(0.16, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
    osc.connect(gain).connect(c.destination);
    osc.start(t);
    osc.stop(t + 0.45);
  });
}

/** Tiny victory arpeggio. */
export function winJingle(): void {
  const c = ensure();
  if (!c) return;
  const notes = [523.25, 659.25, 783.99, 1046.5];
  notes.forEach((freq, i) => {
    const t = c.currentTime + i * 0.11;
    const osc = c.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = freq;
    const gain = c.createGain();
    gain.gain.setValueAtTime(0.001, t);
    gain.gain.exponentialRampToValueAtTime(0.16, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.32);
    osc.connect(gain).connect(c.destination);
    osc.start(t);
    osc.stop(t + 0.35);
  });
}
