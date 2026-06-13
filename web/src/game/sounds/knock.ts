import { ensure, noise } from './engine';

/**
 * Soft wooden knock-knock when a piece is already against a wall.
 * Deliberately gentle: bumping a wall is information, not failure.
 */
export function knock(): void {
  const c = ensure();
  if (!c) return;
  for (const [offset, peak] of [
    [0, 0.14],
    [0.085, 0.09],
  ] as const) {
    const t = c.currentTime + offset;
    const osc = c.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(190, t);
    osc.frequency.exponentialRampToValueAtTime(120, t + 0.05);
    const gain = c.createGain();
    gain.gain.setValueAtTime(peak, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
    osc.connect(gain).connect(c.destination);
    osc.start(t);
    osc.stop(t + 0.08);

    const tap = c.createBufferSource();
    tap.buffer = noise(c);
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 450;
    const tapGain = c.createGain();
    tapGain.gain.setValueAtTime(peak * 0.6, t);
    tapGain.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
    tap.connect(lp).connect(tapGain).connect(c.destination);
    tap.start(t);
    tap.stop(t + 0.05);
  }
}
