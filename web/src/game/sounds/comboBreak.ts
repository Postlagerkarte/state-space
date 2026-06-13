import { ensure } from './engine';

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
