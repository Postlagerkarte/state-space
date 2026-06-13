import { ensure } from './engine';

/** Hot, fast ascending shimmer for entering fever. */
export function feverUp(): void {
  const c = ensure();
  if (!c) return;
  const notes = [659.25, 830.61, 987.77, 1318.5];
  notes.forEach((freq, i) => {
    const t = c.currentTime + i * 0.06;
    const osc = c.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = freq;
    const gain = c.createGain();
    gain.gain.setValueAtTime(0.001, t);
    gain.gain.exponentialRampToValueAtTime(0.12, t + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
    osc.connect(gain).connect(c.destination);
    osc.start(t);
    osc.stop(t + 0.25);
  });
}
