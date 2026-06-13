import { ensure, noise } from './engine';

/** Filtered-noise whoosh whose length scales with the glide distance. */
export function whoosh(dist: number): void {
  const c = ensure();
  if (!c) return;
  const dur = Math.min(0.45, 0.1 + dist * 0.04);
  const src = c.createBufferSource();
  src.buffer = noise(c);
  const filter = c.createBiquadFilter();
  filter.type = 'bandpass';
  filter.Q.value = 1.2;
  filter.frequency.setValueAtTime(950, c.currentTime);
  filter.frequency.exponentialRampToValueAtTime(260, c.currentTime + dur);
  const gain = c.createGain();
  gain.gain.setValueAtTime(0.001, c.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.16, c.currentTime + 0.03);
  gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
  src.connect(filter).connect(gain).connect(c.destination);
  src.start();
  src.stop(c.currentTime + dur + 0.05);
}
