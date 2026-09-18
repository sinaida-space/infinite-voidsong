// Focus Boost: a slow amplitude pulse on the music layer only.
//   gain(t) = 1 - depth/2 + (depth/2) * sin(2*pi*rateHz*t)
// Built from native nodes so it costs nothing on the main thread:
//   OscillatorNode(rateHz) -> GainNode(depth/2) -> modulated.gain (base 1 - depth/2)
// The engine inserts { input, output } into the path of every layer whose
// family is 'music' and nowhere else (task 3 wiring).
import type { FocusBoost } from '../state/types';
import { clamp, ramp } from './music/util';

export interface FocusBoostNode {
  input: AudioNode;
  output: AudioNode;
  set(fb: FocusBoost): void;
  dispose(): void;
}

const RAMP_SEC = 1;   // every change (depth or rate) glides over one second

export function focusBoostNode(ctx: AudioContext): FocusBoostNode {
  const modulated = ctx.createGain();      // the one GainNode in the music path
  const depthGain = ctx.createGain();      // scales the ±1 sine to ±depth/2
  const lfo = ctx.createOscillator();
  lfo.type = 'sine';
  lfo.frequency.value = 16;
  depthGain.gain.value = 0;                // depth 0 by default: pass-through
  modulated.gain.value = 1;
  lfo.connect(depthGain).connect(modulated.gain);
  lfo.start();

  return {
    input: modulated,
    output: modulated,
    set(fb) {
      const depth = clamp(fb.depth, 0, 1);
      const rate = clamp(fb.rateHz, 12, 20);
      const at = ctx.currentTime;
      ramp(depthGain.gain, depth / 2, at, RAMP_SEC);
      ramp(modulated.gain, 1 - depth / 2, at, RAMP_SEC);
      ramp(lfo.frequency, rate, at, RAMP_SEC);
    },
    dispose() {
      try { lfo.stop(); } catch { /* already stopped */ }
      lfo.disconnect();
      depthGain.disconnect();
      modulated.disconnect();
    },
  };
}
