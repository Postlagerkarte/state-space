import { ensure, noise } from './engine';

/** Low impact thock when a piece hits a wall; intensity in [0, 1]. */
export function thunk(intensity: number): void {
  const c = ensure();
  if (!c) return;
  const t = c.currentTime;
  const osc = c.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(150, t);
  osc.frequency.exponentialRampToValueAtTime(48, t + 0.09);
  const gain = c.createGain();
  const peak = 0.18 + 0.3 * intensity;
  gain.gain.setValueAtTime(peak, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.13);
  osc.connect(gain).connect(c.destination);
  osc.start(t);
  osc.stop(t + 0.15);

  const click = c.createBufferSource();
  click.buffer = noise(c);
  const clickGain = c.createGain();
  clickGain.gain.setValueAtTime(0.1 * intensity, t);
  clickGain.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
  const hp = c.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 1800;
  click.connect(hp).connect(clickGain).connect(c.destination);
  click.start(t);
  click.stop(t + 0.05);
}
