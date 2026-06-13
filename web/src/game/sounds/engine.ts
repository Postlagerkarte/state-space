// Shared WebAudio engine for the synthesized sound effects.
// Every effect in this folder builds its nodes on the AudioContext created here.
// The context is created lazily on the first user gesture; nothing plays while muted.

const MUTE_KEY = 'statespace.muted';

let ctx: AudioContext | null = null;
let noiseBuf: AudioBuffer | null = null;
let muted = localStorage.getItem(MUTE_KEY) === '1';

/** Get the (resumed) AudioContext, or null when muted/unavailable. */
export function ensure(): AudioContext | null {
  if (muted) return null;
  if (!ctx) {
    try {
      ctx = new AudioContext();
    } catch {
      return null;
    }
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

/** A one-second white-noise buffer, shared by every percussive/whoosh effect. */
export function noise(c: AudioContext): AudioBuffer {
  if (!noiseBuf) {
    noiseBuf = c.createBuffer(1, c.sampleRate, c.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  return noiseBuf;
}

export function isMuted(): boolean {
  return muted;
}

export function toggleMute(): boolean {
  muted = !muted;
  localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
  return muted;
}
