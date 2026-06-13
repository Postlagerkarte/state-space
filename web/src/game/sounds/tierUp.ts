import { ensure } from './engine';

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
