import { ensure } from './engine';

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
