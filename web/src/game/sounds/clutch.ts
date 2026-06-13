import { ensure } from './engine';

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
