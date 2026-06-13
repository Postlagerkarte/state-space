import { ensure } from './engine';

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
