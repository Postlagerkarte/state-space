import { ensure } from './engine';

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
