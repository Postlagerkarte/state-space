import { ensure, noise } from './engine';

/** Big muffled explosion for the bomb booster. */
export function boom(): void {
  const c = ensure();
  if (!c) return;
  const t = c.currentTime;
  const osc = c.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(110, t);
  osc.frequency.exponentialRampToValueAtTime(32, t + 0.28);
  const oscGain = c.createGain();
  oscGain.gain.setValueAtTime(0.5, t);
  oscGain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
  osc.connect(oscGain).connect(c.destination);
  osc.start(t);
  osc.stop(t + 0.4);

  const burst = c.createBufferSource();
  burst.buffer = noise(c);
  const lp = c.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(2600, t);
  lp.frequency.exponentialRampToValueAtTime(220, t + 0.3);
  const burstGain = c.createGain();
  burstGain.gain.setValueAtTime(0.4, t);
  burstGain.gain.exponentialRampToValueAtTime(0.001, t + 0.32);
  burst.connect(lp).connect(burstGain).connect(c.destination);
  burst.start(t);
  burst.stop(t + 0.35);
}
