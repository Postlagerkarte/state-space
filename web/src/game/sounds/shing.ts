import { ensure } from './engine';

/**
 * One soft bright chime for a *great* move (on the optimal path AND a long,
 * dramatic glide). Rare on purpose: playtesting showed per-move pitch ladders
 * get annoying — scarcity is what keeps a reward sound rewarding.
 */
export function shing(): void {
  const c = ensure();
  if (!c) return;
  const t = c.currentTime;
  for (const [mult, peak] of [
    [1, 0.12],
    [2.01, 0.04],
  ] as const) {
    const osc = c.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 1318.5 * mult; // E6 + shimmer
    const gain = c.createGain();
    gain.gain.setValueAtTime(0.001, t);
    gain.gain.exponentialRampToValueAtTime(peak, t + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
    osc.connect(gain).connect(c.destination);
    osc.start(t);
    osc.stop(t + 0.65);
  }
}
