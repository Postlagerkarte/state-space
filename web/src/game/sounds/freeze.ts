import { ensure } from './engine';

/** Icy shimmer for the time-freeze booster. */
export function freeze(): void {
  const c = ensure();
  if (!c) return;
  const t = c.currentTime;
  for (let i = 0; i < 4; i++) {
    const osc = c.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 1568 * Math.pow(2, -i / 12 / 2);
    const gain = c.createGain();
    const at = t + i * 0.07;
    gain.gain.setValueAtTime(0.001, at);
    gain.gain.exponentialRampToValueAtTime(0.08, at + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, at + 0.3);
    osc.connect(gain).connect(c.destination);
    osc.start(at);
    osc.stop(at + 0.32);
  }
}
