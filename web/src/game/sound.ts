// Barrel for the synthesized sound effects. Each effect lives in its own file
// under ./sounds/ and shares the WebAudio engine in ./sounds/engine.ts.
// Consumers keep importing this module unchanged: `import * as sound from '../game/sound'`.

export { isMuted, toggleMute } from './sounds/engine';

export { whoosh } from './sounds/whoosh';
export { thunk } from './sounds/thunk';
export { knock } from './sounds/knock';
export { swishBack } from './sounds/swishBack';
export { shing } from './sounds/shing';
export { tickTock } from './sounds/tickTock';
export { comboUp } from './sounds/comboUp';
export { comboBreak } from './sounds/comboBreak';
export { boom } from './sounds/boom';
export { freeze } from './sounds/freeze';
export { boosterEarn } from './sounds/boosterEarn';
export { clutch } from './sounds/clutch';
export { feverUp } from './sounds/feverUp';
export { tierUp } from './sounds/tierUp';
export { gameOver } from './sounds/gameOver';
export { winJingle } from './sounds/winJingle';
