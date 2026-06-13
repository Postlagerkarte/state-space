import { ensure } from './engine';

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
