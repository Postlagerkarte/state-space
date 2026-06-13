import { ensure } from './engine';

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
