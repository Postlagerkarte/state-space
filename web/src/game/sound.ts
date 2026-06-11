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

/** Soft denied blip when a piece can't move that way. */
export function blocked(): void {
  const c = ensure();
  if (!c) return;
  const t = c.currentTime;
  const osc = c.createOscillator();
  osc.type = 'square';
  osc.frequency.value = 95;
  const gain = c.createGain();
  gain.gain.setValueAtTime(0.07, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
  osc.connect(gain).connect(c.destination);
  osc.start(t);
  osc.stop(t + 0.08);
}

// Major pentatonic over two octaves: any sequence of these sounds musical,
// which is the point — optimal play should literally be a melody.
const PENTATONIC = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];
const MELODY_ROOT = 293.66; // D4

/**
 * One step of the progress melody. `step` is how close the hero is to the goal
 * (1 = first step of progress, par = the final note before the win resolves).
 */
export function melodyNote(step: number): void {
  const c = ensure();
  if (!c) return;
  const idx = Math.min(PENTATONIC.length - 1, Math.max(0, step - 1));
  const freq = MELODY_ROOT * Math.pow(2, PENTATONIC[idx] / 12);
  const t = c.currentTime;
  const voices: ReadonlyArray<readonly [number, number]> = [
    [1, 0.2], // fundamental
    [2, 0.05], // octave shimmer
  ];
  for (const [mult, peak] of voices) {
    const osc = c.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = freq * mult;
    const gain = c.createGain();
    gain.gain.setValueAtTime(0.001, t);
    gain.gain.exponentialRampToValueAtTime(peak, t + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
    osc.connect(gain).connect(c.destination);
    osc.start(t);
    osc.stop(t + 0.55);
  }
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
