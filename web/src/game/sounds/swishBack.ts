import { ensure, noise } from './engine';

/** Friendly backwards swish for undo — rewinding, not failing. */
export function swishBack(): void {
  const c = ensure();
  if (!c) return;
  const t = c.currentTime;
  const src = c.createBufferSource();
  src.buffer = noise(c);
  const filter = c.createBiquadFilter();
  filter.type = 'bandpass';
  filter.Q.value = 1.4;
  filter.frequency.setValueAtTime(300, t);
  filter.frequency.exponentialRampToValueAtTime(1100, t + 0.18);
  const gain = c.createGain();
  gain.gain.setValueAtTime(0.001, t);
  gain.gain.exponentialRampToValueAtTime(0.1, t + 0.03);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
  src.connect(filter).connect(gain).connect(c.destination);
  src.start(t);
  src.stop(t + 0.25);
}
